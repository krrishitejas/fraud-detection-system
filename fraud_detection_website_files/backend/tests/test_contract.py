"""
Tests for POST /api/model/predict -- the Week 4 interface contract.

These check the contract, not the model. Each one names the validation rule or the
response guarantee it covers, so a reader can line the file up against the contract
document and see what is and is not tested.

The two that matter most are the version-mismatch test and the absent-category test.
The first guards the failure the contract calls its most important error: scoring a
vector built by a different transformer gives a confident, meaningless number, and
the only safe answer is to refuse. The second guards a defect that was really in this
service -- a missing text column was filled with that column's median code, which is
the code for the commonest category rather than for absent, and it flipped 518
decisions on the held-out blocks.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.preprocessing_service import (ABSENT_CATEGORY_CODE,
                                                CATEGORICAL_COLUMNS,
                                                PreprocessingService)
from app.services.registry_service import ServingRegistry


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def registry():
    return ServingRegistry.get_instance()


def raw_body(**overrides):
    """A complete, plausible payment with text categories, as a client would send it."""
    body = {
        "payload_type": "raw_transaction",
        "transaction_id": 2987000,
        "transaction_dt": 86400,
        "transaction": {
            "TransactionAmt": 68.5, "ProductCD": "W",
            "card1": 13926, "card2": 361, "card3": 150,
            "card4": "discover", "card5": 142, "card6": "credit",
            "addr1": 315, "addr2": 87, "dist1": 19, "dist2": None,
            "P_emaildomain": "gmail.com", "R_emaildomain": None,
            "C1": 1, "C2": 1, "C3": 0, "C4": 0, "C5": 0, "C6": 1, "C7": 0,
            "C8": 0, "C9": 1, "C10": 0, "C11": 1, "C12": 0, "C13": 1, "C14": 1,
            "D1": 14, "D2": None, "D3": 13,
        },
    }
    body.update(overrides)
    return body


# --------------------------------------------------------------- the registry

def test_registry_loads_a_complete_bundle(registry):
    """The model, preprocessing, calibration, cutoff and rules load together."""
    assert registry.is_loaded, registry.load_error
    assert registry.model_version
    assert registry.preprocessing_version
    assert 0.0 < registry.threshold < 1.0
    assert registry.score_scale in {"calibrated", "raw"}
    assert len(registry.feature_columns) == 32
    assert registry.rules, "at least one rule should be active"


def test_only_the_rounds_early_stopping_chose_are_scored(registry):
    """Early stopping does not delete the trees built after it; the range must."""
    assert registry.best_iteration is not None
    assert registry.iteration_range == (0, registry.best_iteration + 1)
    assert registry.iteration_range[1] <= registry.trees_in_file


def test_calibration_is_monotone(registry):
    """Platt scaling may move the numbers but must never reorder them, which is why
    it is safe to apply underneath a threshold chosen on the calibrated scale."""
    import numpy as np
    raw = np.linspace(0.001, 0.999, 200)
    cal = registry.calibrate(raw)
    assert np.all(np.diff(cal) > 0)


# ------------------------------------------------------------- the happy path

def test_raw_path_returns_a_full_decision(client, registry):
    """V1, V2, V6, and every field the response guarantees."""
    r = client.post("/api/model/predict", json=raw_body(return_explanation=True))
    assert r.status_code == 200, r.text
    d = r.json()
    for field in ("request_id", "transaction_id", "fraud_probability", "raw_score",
                  "threshold", "classification", "decision", "rules", "input_report",
                  "model_version", "preprocessing_version", "scored_at", "latency_ms"):
        assert field in d, f"the response must always carry {field}"
    assert 0.0 <= d["fraud_probability"] <= 1.0
    assert d["classification"] in {"FRAUD", "REVIEW", "LEGITIMATE"}
    assert d["transaction_id"] == 2987000
    assert d["model_version"] == registry.model_version
    assert d["preprocessing_version"] == registry.preprocessing_version
    assert d["threshold"] == registry.threshold
    assert d["decision"]["applies_to_model_version"] == registry.model_version


def test_the_response_never_returns_a_bare_label(client):
    """A decision that cannot be reproduced cannot be audited, so the probability,
    the threshold and both versions are present whatever the outcome."""
    d = client.post("/api/model/predict", json=raw_body()).json()
    assert d["decision"]["selection_method"]
    assert d["decision"]["cost_false_negative"] > 0
    assert "assumption" in d["decision"]["cost_assumption_note"].lower()


def test_explanation_is_reported_per_feature_group(client):
    """Vesta masked the meaning of the individual columns, so an explanation is
    honest at the group level and would be invented at any finer one."""
    d = client.post("/api/model/predict", json=raw_body(return_explanation=True)).json()
    groups = {g["group"] for g in d["explanation"]["groups"]}
    assert {"amount", "card", "counting"} <= groups
    assert not any(g.startswith("V") or g.startswith("C1") for g in groups)


def test_explanation_is_omitted_unless_asked_for(client):
    assert client.post("/api/model/predict",
                       json=raw_body(return_explanation=False)).json()["explanation"] is None


def test_text_categories_are_encoded_server_side(client):
    """The contract takes a payment, not a feature vector: a caller sends 'visa',
    not 2.0, so the encoding table stays a training artefact on the server."""
    a = client.post("/api/model/predict", json=raw_body()).json()
    assert a["input_report"]["fields_supplied"] >= 30
    assert "ProductCD" not in (a["input_report"].get("unknown_category") or [])


# ---------------------------------------------------------------- the defect

def test_an_absent_category_is_coded_absent_not_commonest(client, registry):
    """The defect this fix exists for.

    Leaving a text column out used to fill it with that column's median code, which
    is the code for the commonest category -- so a payment with no sender domain was
    scored as though it came from the most ordinary one there is.
    """
    prep = PreprocessingService.get_instance()
    for col in CATEGORICAL_COLUMNS:
        idx = prep.feature_indices[col]
        assert prep.fill_value_for(idx) == ABSENT_CATEGORY_CODE, col
        # ...and the fix must not have changed how numeric columns are filled.
    for col in ("TransactionAmt", "C1", "D1"):
        idx = prep.feature_indices[col]
        assert prep.fill_value_for(idx) == pytest.approx(float(prep.medians[idx]))


def test_absent_category_is_reported_to_the_caller(client):
    body = raw_body()
    body["transaction"].pop("P_emaildomain")
    d = client.post("/api/model/predict", json=body).json()
    assert "P_emaildomain" in d["input_report"]["absent"]


def test_an_unknown_category_is_accepted_and_named(client):
    """New email domains appear every day. Refusing them would mean a service that
    fails whenever the world moves, so it scores and says what it did not recognise."""
    body = raw_body()
    body["transaction"]["P_emaildomain"] = "a-domain-that-did-not-exist-in-training.example"
    r = client.post("/api/model/predict", json=body)
    assert r.status_code == 200
    assert "P_emaildomain" in r.json()["input_report"]["unknown_category"]


# ----------------------------------------------------------------- the errors

def test_version_mismatch_is_409_not_a_best_effort_score(client, registry):
    """V9 -- the most important error in the contract."""
    r = client.post("/api/model/predict", json={
        "payload_type": "processed_features",
        "transaction_id": 1, "transaction_dt": 0,
        "preprocessing_version": "prep-v0-wrong",
        "features": {c: 0.0 for c in registry.feature_columns},
    })
    assert r.status_code == 409
    e = r.json()["error"]
    assert e["code"] == "PREPROCESSING_VERSION_MISMATCH"
    assert registry.preprocessing_version in e["message"]
    assert e["request_id"]


def test_matching_version_on_the_processed_path_scores(client, registry):
    r = client.post("/api/model/predict", json={
        "payload_type": "processed_features",
        "transaction_id": 2, "transaction_dt": 0,
        "preprocessing_version": registry.preprocessing_version,
        "features": {c: 0.0 for c in registry.feature_columns},
    })
    assert r.status_code == 200, r.text


def test_pinning_a_model_that_is_not_loaded_is_404(client):
    """V10."""
    r = client.post("/api/model/predict", json=raw_body(model_version="xgb-v9.9.9"))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "MODEL_NOT_FOUND"


def test_the_label_may_never_arrive_with_the_question(client):
    """A client sending isFraud alongside the features is a wiring error, and
    ignoring it quietly would hide it."""
    body = raw_body()
    body["transaction"]["isFraud"] = 1
    assert client.post("/api/model/predict", json=body).status_code == 422


def test_a_typo_in_a_field_name_is_rejected(client):
    """V7 -- a typo must surface, not become a silent missing value."""
    body = raw_body()
    body["transaction"]["TransactionAmount"] = 50.0
    r = client.post("/api/model/predict", json=body)
    assert r.status_code == 422
    assert any("TransactionAmount" in d.get("field", "")
               for d in r.json()["error"]["details"])


def test_amount_is_required_and_must_be_non_negative(client):
    """V6."""
    body = raw_body()
    body["transaction"].pop("TransactionAmt")
    assert client.post("/api/model/predict", json=body).status_code == 422
    body = raw_body()
    body["transaction"]["TransactionAmt"] = -1
    assert client.post("/api/model/predict", json=body).status_code == 422


def test_the_payload_must_match_the_declared_path(client):
    """V2 and V3, both directions."""
    assert client.post("/api/model/predict", json={
        "payload_type": "raw_transaction", "transaction_id": 1,
        "transaction_dt": 0, "features": {}}).status_code == 422
    assert client.post("/api/model/predict", json={
        "payload_type": "processed_features", "transaction_id": 1,
        "transaction_dt": 0, "features": {}}).status_code == 422


def test_transaction_id_must_be_positive(client):
    """V4."""
    assert client.post("/api/model/predict",
                       json=raw_body(transaction_id=0)).status_code == 422


# ------------------------------------------------------------ idempotency

def test_the_same_key_with_the_same_body_replays(client):
    """V12. Scoring twice must not produce two stored decisions."""
    body = raw_body(transaction_id=4242)
    h = {"Idempotency-Key": "test-key-same"}
    a = client.post("/api/model/predict", json=body, headers=h).json()
    b = client.post("/api/model/predict", json=body, headers=h).json()
    assert a["request_id"] == b["request_id"]


def test_the_same_key_with_a_different_body_is_409(client):
    h = {"Idempotency-Key": "test-key-different"}
    client.post("/api/model/predict", json=raw_body(transaction_id=1), headers=h)
    r = client.post("/api/model/predict", json=raw_body(transaction_id=2), headers=h)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


# ------------------------------------------------------- governance endpoints

def test_the_threshold_is_served_as_a_record(client, registry):
    d = client.get("/api/model/threshold").json()
    assert d["value"] == registry.threshold
    assert d["applies_to_model_version"] == registry.model_version
    assert d["score_scale"] == registry.score_scale
    assert d["sensitivity"], "the cost sweep should be published with the cutoff"
    ratios = [r["cost_ratio"] for r in d["sensitivity"]]
    assert ratios == sorted(ratios)


def test_the_rule_table_keeps_the_rule_that_was_rejected(client):
    d = client.get("/api/rules").json()
    assert d["total"] > d["active"], "the rejected rule should still be listed"
    off = [r for r in d["rules"] if not r["is_active"]]
    assert off and off[0]["train_lift"] is not None, (
        "a rejected rule keeps the measurement that rejected it")


def test_decisions_are_stored_and_retrievable(client):
    before = client.get("/api/audit/recent").json()["summary"]["stored_predictions"]
    client.post("/api/model/predict", json=raw_body(transaction_id=777001))
    after = client.get("/api/audit/recent?limit=5").json()
    assert after["summary"]["stored_predictions"] == before + 1
    top = after["predictions"][0]
    assert top["model_version"] and top["preprocessing_version"]
    assert top["decision"] in {"fraud", "legitimate"}


def test_the_two_paths_agree_on_the_same_payment(client, registry):
    """The raw path and the processed path must be two doors into one room.

    Prepare the payment exactly as the service does, send the result down the
    processed path, and the score must match what the raw path produced for the
    same payment. This is the test that catches a double transform: standardising
    an already-standardised vector shifts every value and the scores diverge.
    """
    from app.services.codec_service import TransactionCodec
    from app.services.preprocessing_service import PreprocessingService

    body = raw_body(transaction_id=991001)
    raw_response = client.post("/api/model/predict", json=body)
    assert raw_response.status_code == 200, raw_response.text

    codec = TransactionCodec(registry, PreprocessingService.get_instance())
    payment = dict(body["transaction"])
    payment.setdefault("TransactionDT", body["transaction_dt"])
    scaled, _, _ = codec.prepare(payment)

    processed = client.post("/api/model/predict", json={
        "payload_type": "processed_features",
        "transaction_id": 991002,
        "transaction_dt": body["transaction_dt"],
        "preprocessing_version": registry.preprocessing_version,
        "features": {c: float(v) for c, v in zip(registry.feature_columns, scaled[0])},
    })
    assert processed.status_code == 200, processed.text
    assert processed.json()["fraud_probability"] == pytest.approx(
        raw_response.json()["fraud_probability"], abs=1e-8)


def test_a_supplied_correlation_id_is_echoed(client):
    """A caller may bring its own request id so one decision can be traced through
    both sides' logs."""
    r = client.post("/api/model/predict", json=raw_body(transaction_id=991003),
                    headers={"X-Request-Id": "caller-supplied-id-123"})
    assert r.json()["request_id"] == "caller-supplied-id-123"


# ------------------------------------------------------------------ the ensemble

def test_the_served_model_is_the_ensemble_the_bundle_names(registry):
    """The service must score with every member, not with whichever loads first.

    A single boosted model is a draw: across the seven seeds of this configuration
    held-out PR-AUC moved by 0.0089, which is larger than most differences this
    project has spent its time measuring. The decision cutoff is chosen on a score
    scale that moves with the draw, so shipping one seed ships that movement too.
    """
    assert registry.members, "at least one member must be loaded"
    expected = registry.config.get("ensemble_members")
    if expected:
        assert len(registry.members) == expected, (
            "the service loaded a different number of members than the bundle records")
        assert registry.combine == "mean_logodds"
    for m in registry.members:
        lo, hi = m["iteration_range"]
        assert lo == 0 and hi > 0
        assert hi <= m["booster"].num_boosted_rounds(), (
            "a member must not be scored past the round early stopping chose")


def test_contributions_are_averaged_over_the_members(registry):
    """TreeSHAP is exact here, not an approximation, and the test says why.

    The members are combined on the log-odds scale, which is the scale TreeSHAP
    works on, so the mean of the members' contributions is the contribution of the
    mean model. Averaging probabilities instead would break that silently. The check
    is that the contributions reconstruct the margin the scorer actually used.
    """
    import numpy as np
    row = np.zeros((1, len(registry.feature_columns)), dtype=np.float32)
    contribs = registry.contributions(row)[0]
    assert contribs.shape[0] == len(registry.feature_columns) + 1
    reconstructed = float(contribs.sum())
    scored = float(registry.raw_score(row)[0])
    margin = np.log(scored / (1.0 - scored))
    assert reconstructed == pytest.approx(margin, abs=1e-4), (
        "the explanation must add up to the score it is explaining")
