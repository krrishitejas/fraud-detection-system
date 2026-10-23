"""
POST /api/model/predict -- the Week 4 interface contract, as specified.

The Week 8 review tabulated eight places where the service and the contract disagreed:
the path, the payload shape, where encoding happens, whether calibration is applied,
whether the cutoff is a record or a constant, whether versions are returned, whether a
version mismatch is detectable, and whether anything is stored. It recommended changing
the service rather than the contract. This module is that change.

The older /api/predict endpoints are untouched and still serve the front end and the
batch and CSV paths. They take a prepared feature vector and return a label. This one
takes a payment and returns a decision somebody can audit.
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import xgboost as xgb
from fastapi import APIRouter, Header, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.schemas.contract import (Classification, DecisionBlock, ErrorBody,
                                  ErrorDetail, ErrorResponse, Explanation,
                                  GroupContribution, InputReport, PayloadType,
                                  PredictRequest, PredictResponse, RuleBlock)
from app.services.codec_service import TransactionCodec
from app.services.preprocessing_service import (PreprocessingService,
                                                PreprocessingValidationError)
from app.services.registry_service import ServingRegistry
from app.services.rules_service import RulesService
from app.services.store_service import StoreService, utcnow
from app.utils.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Model Contract"])

# Documented IEEE-CIS feature groups. Vesta published what each family counts in
# general terms and deliberately masked the individual columns, so an explanation is
# honest at this level and would be invented at any finer one.
FEATURE_GROUPS: Dict[str, str] = {
    "TransactionDT": "time", "TransactionAmt": "amount", "ProductCD": "product",
    "card1": "card", "card2": "card", "card3": "card", "card4": "card",
    "card5": "card", "card6": "card",
    "addr1": "address", "addr2": "address", "dist1": "distance", "dist2": "distance",
    "P_emaildomain": "email", "R_emaildomain": "email",
    **{f"C{i}": "counting" for i in range(1, 15)},
    **{f"D{i}": "timedelta" for i in range(1, 16)},
}

# Idempotency-Key -> (body fingerprint, stored response). In-process and bounded,
# which is honest for a single-process demonstration; a deployment would use the
# database. The contract requires a reused key with a different body to be a 409.
_IDEMPOTENCY: Dict[str, Tuple[str, Dict[str, Any]]] = {}
_IDEMPOTENCY_MAX = 512


def _error(status_code: int, code: str, message: str,
           details: Optional[List[ErrorDetail]] = None,
           request_id: Optional[str] = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(
        code=code, message=message, details=details or [],
        request_id=request_id or str(uuid.uuid4())))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def _classify(prob: float, threshold: float, review_low: float) -> Classification:
    """Three outcomes, not two.

    The assignment asks for fraud or legitimate. A review band between review_low and
    the cutoff is a PROPOSED EXTENSION, and it exists because P3 is the clearest
    evidence in the corpus that the useful output of a fraud model is a queue an
    analyst works, not a verdict. Set review_low equal to the threshold to collapse it
    back to the two-way decision the assignment specifies.
    """
    if prob >= threshold:
        return Classification.FRAUD
    if prob >= review_low:
        return Classification.REVIEW
    return Classification.LEGITIMATE


def _group_explanation(registry: ServingRegistry, scaled: np.ndarray,
                       columns: List[str]) -> Explanation:
    dmat = xgb.DMatrix(scaled, feature_names=None)
    contribs = registry.booster.predict(
        dmat, pred_contribs=True, iteration_range=registry.iteration_range)[0]
    base = float(contribs[-1])
    totals: Dict[str, float] = {}
    for i, col in enumerate(columns):
        g = FEATURE_GROUPS.get(col, "other")
        totals[g] = totals.get(g, 0.0) + float(contribs[i])
    groups = [GroupContribution(
        group=g, contribution=round(v, 6),
        direction="increases_risk" if v > 0 else "decreases_risk")
        for g, v in sorted(totals.items(), key=lambda kv: -abs(kv[1]))]
    return Explanation(base_value=round(base, 6), groups=groups)


@router.post(
    "/model/predict",
    response_model=PredictResponse,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse},
               404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Score one payment under the Week 4 interface contract",
)
def model_predict(request: PredictRequest, response: Response,
                  idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                  x_request_id: Optional[str] = Header(None, alias="X-Request-Id")):
    started = time.perf_counter()
    # The contract lets a caller supply its own correlation id so a decision can be
    # traced back through the caller's logs as well as ours; we generate one if not.
    request_id = (x_request_id or "").strip()[:64] or str(uuid.uuid4())
    registry = ServingRegistry.get_instance()
    store = StoreService.get_instance()

    # V11 -- there has to be an active model.
    if not registry.is_loaded:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, "NO_ACTIVE_MODEL",
                      registry.load_error or "No model is in active status.",
                      request_id=request_id)

    # V12 -- a reused key with a different body is a conflict, not a second scoring.
    fingerprint = ""
    if idempotency_key:
        fingerprint = hashlib.sha256(
            json.dumps(request.model_dump(mode="json"), sort_keys=True).encode()
        ).hexdigest()
        prior = _IDEMPOTENCY.get(idempotency_key)
        if prior and prior[0] != fingerprint:
            return _error(status.HTTP_409_CONFLICT, "IDEMPOTENCY_CONFLICT",
                          f"Idempotency-Key {idempotency_key!r} was already used with a "
                          "different request body.",
                          [ErrorDetail(field="Idempotency-Key",
                                       issue="key reused with a different body")],
                          request_id)
        if prior:
            response.headers["Idempotent-Replay"] = "true"
            return prior[1]

    # V10 -- a pinned model must be the one that is actually loaded.
    if request.model_version and request.model_version != registry.model_version:
        return _error(status.HTTP_404_NOT_FOUND, "MODEL_NOT_FOUND",
                      f"Model version {request.model_version!r} is not available. "
                      f"The active model is {registry.model_version!r}.",
                      [ErrorDetail(field="model_version",
                                   issue=f"requested={request.model_version} "
                                         f"active={registry.model_version}")],
                      request_id)

    prep = PreprocessingService.get_instance()
    codec = TransactionCodec(registry, prep)
    columns = codec.columns

    # ---- build the prepared row, by the declared path
    if request.payload_type is PayloadType.processed_features:
        # V9 -- the single most important check in this contract. Scoring a vector
        # built by a different transformer produces a confident, meaningless number.
        # Failing loudly is the design.
        if request.preprocessing_version != registry.preprocessing_version:
            store.record_event("preprocessing_version_mismatch", {
                "declared": request.preprocessing_version,
                "expected": registry.preprocessing_version,
                "model_version": registry.model_version}, request_id)
            return _error(
                status.HTTP_409_CONFLICT, "PREPROCESSING_VERSION_MISMATCH",
                f"Declared preprocessing_version "
                f"{request.preprocessing_version!r} does not match "
                f"{registry.preprocessing_version!r}, which is bound to active model "
                f"{registry.model_version!r}.",
                [ErrorDetail(field="preprocessing_version",
                             issue=f"declared={request.preprocessing_version} "
                                   f"expected={registry.preprocessing_version}")],
                request_id)
        supplied = request.features or {}
        unknown = sorted(set(supplied) - set(columns))
        missing = sorted(set(columns) - set(supplied))
        if unknown or missing:
            details = [ErrorDetail(field=f"features.{f}", issue="unknown feature name")
                       for f in unknown[:10]]
            details += [ErrorDetail(field=f"features.{f}", issue="required feature absent")
                        for f in missing[:10]]
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          "The processed path requires exactly the declared feature set.",
                          details, request_id)
        # The processed path carries an ALREADY-transformed vector: the caller did
        # the imputing and the standardising, which is what declaring a
        # preprocessing_version means. Running it through the transform again would
        # standardise twice and produce a confident, meaningless score -- the exact
        # failure the version check two lines above exists to prevent. So the values
        # go to the model as they arrived, in the declared column order, in float32.
        try:
            scaled = np.array(
                [[float(supplied[c]) for c in columns]], dtype=np.float32)
        except (TypeError, ValueError) as exc:
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          f"every feature must be a number: {exc}",
                          request_id=request_id)
        if not np.isfinite(scaled).all():
            bad = [c for c, v in zip(columns, scaled[0]) if not np.isfinite(v)]
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          "features must be finite numbers.",
                          [ErrorDetail(field=f"features.{c}", issue="not a finite number")
                           for c in bad[:10]], request_id)
        provenance = {c: "supplied" for c in columns}
        values = {c: float(v) for c, v in zip(columns, scaled[0])}
        raw_fields = dict(supplied)
    else:
        body = dict(request.transaction or {})
        # V6 -- the one field the contract makes mandatory on the raw path.
        amt = body.get("TransactionAmt")
        if amt is None:
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          "TransactionAmt is required on the raw path.",
                          [ErrorDetail(field="transaction.TransactionAmt",
                                       issue="required field absent")], request_id)
        try:
            if float(amt) < 0:
                raise ValueError
        except (TypeError, ValueError):
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          "TransactionAmt must be a number of at least zero.",
                          [ErrorDetail(field="transaction.TransactionAmt",
                                       issue=f"expected number >= 0, received {amt!r}")],
                          request_id)
        # The contract accepts the whole IEEE-CIS schema, of which this model uses 32
        # columns. A field the dataset defines but the model does not use is accepted
        # and ignored; a field the dataset does not define at all is a typo, and V7
        # says a typo must surface rather than become a silent missing value.
        known = set(columns) | {"identity", "TransactionID"} | \
            {f"V{i}" for i in range(1, 340)} | {f"M{i}" for i in range(1, 10)} | \
            {f"D{i}" for i in range(1, 16)} | {f"C{i}" for i in range(1, 15)} | \
            {"card1", "card2", "card3", "card4", "card5", "card6"}
        typos = sorted(set(body) - known)
        if typos:
            return _error(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Request failed schema validation.",
                [ErrorDetail(field=f"transaction.{f}",
                             issue="unknown field; it is not part of the IEEE-CIS schema")
                 for f in typos[:10]], request_id)
        body.setdefault("TransactionDT", request.transaction_dt)
        try:
            scaled, provenance, values = codec.prepare(body)
        except PreprocessingValidationError as exc:
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                          str(exc), request_id=request_id)
        raw_fields = body

    # ---- score
    raw = float(registry.raw_score(scaled)[0])
    prob = float(registry.calibrate(np.array([raw]))[0]) \
        if registry.score_scale == "calibrated" else raw
    classification = _classify(prob, registry.threshold, registry.review_low)
    rules = RulesService.get_instance().evaluate(raw_fields,
                                                 {"TransactionDT": request.transaction_dt})
    explanation = (_group_explanation(registry, scaled, columns)
                   if request.return_explanation else None)

    summary = codec.summarise(provenance)
    record = registry.threshold_record()
    latency_ms = round((time.perf_counter() - started) * 1000.0, 3)
    scored_at = utcnow()

    result = PredictResponse(
        request_id=request_id,
        transaction_id=request.transaction_id,
        fraud_probability=round(prob, 8),
        raw_score=round(raw, 8),
        threshold=registry.threshold,
        classification=classification,
        decision=DecisionBlock(
            threshold_config_id=registry.threshold_config_id,
            score_scale=registry.score_scale,
            calibration=registry.calibration_method,
            applies_to_model_version=registry.model_version,
            selection_method=registry.config.get(
                "selection_method", "min_expected_cost_on_validation"),
            selected_on_split=registry.config.get("selected_on_split", "validation"),
            cost_false_negative=registry.cost_fn,
            cost_false_positive=registry.cost_fp,
            cost_assumption_note=record["cost_assumption_note"],
            review_low=registry.review_low,
            approved_by=registry.config.get("approved_by", "project team"),
            approved_at=registry.config.get("approved_at"),
        ),
        rules=RuleBlock(**rules),
        input_report=InputReport(
            fields_supplied=len([k for k in raw_fields if k in set(columns)]),
            fields_expected=len(columns), **summary),
        model_version=registry.model_version,
        preprocessing_version=registry.preprocessing_version,
        scored_at=scored_at,
        latency_ms=latency_ms,
        stored=store.enabled,
        explanation=explanation,
    )

    store.record_prediction({
        "request_id": request_id, "scored_at": scored_at,
        "model_version": registry.model_version,
        "preprocessing_version": registry.preprocessing_version,
        "threshold_config_id": registry.threshold_config_id,
        "threshold_value": registry.threshold,
        "score_scale": registry.score_scale,
        "fraud_probability": prob, "raw_score": raw,
        "decision": "fraud" if classification is Classification.FRAUD else "legitimate",
        "risk_band": classification.value,
        "highest_rule_risk": rules["highest_rule_risk"],
        "rules_fired": rules["rules_fired"],
        "feature_values": values, "field_provenance": provenance,
        "latency_ms": latency_ms,
    })

    payload = result.model_dump(mode="json")
    if idempotency_key:
        if len(_IDEMPOTENCY) >= _IDEMPOTENCY_MAX:
            _IDEMPOTENCY.clear()
        _IDEMPOTENCY[idempotency_key] = (fingerprint, payload)
    return result


@router.get("/model/threshold", summary="The decision threshold as a governed record")
def get_threshold():
    """The cutoff, with everything needed to argue about it later.

    The clearest finding in this project is that a cutoff belongs to one trained model
    and to the score scale it was chosen on. The model before this one had its boundary
    near 0.50; this one has it at 0.065. Had the value been a constant in the code,
    swapping the model in would have cut recall from 0.63 to 0.33 and approved roughly
    930 more frauds, with nothing crashing and nothing logged.
    """
    registry = ServingRegistry.get_instance()
    if not registry.is_loaded:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, "NO_ACTIVE_MODEL",
                      registry.load_error or "No model is in active status.")
    record = registry.threshold_record()
    record["sensitivity"] = registry.config.get("threshold_sensitivity", [])
    return record


@router.get("/rules", summary="The rule table, including the rule that was switched off")
def get_rules():
    registry = ServingRegistry.get_instance()
    if not registry.is_loaded:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, "NO_ACTIVE_MODEL",
                      registry.load_error or "No model is in active status.")
    rules = RulesService.get_instance()
    return {
        "active": len(registry.rules),
        "total": len(registry.all_rules),
        "note": ("A rule that was built, measured and rejected stays in the table with "
                 "its measurement attached. RULE_VELOCITY_CARD24H fires on 39.9% of "
                 "training rows at a lift of 1.04, so it is off."),
        "rules": rules.catalogue(),
    }


@router.get("/model/categories",
            summary="The category values the server knows how to encode")
def get_categories():
    """What a caller may send for each text field.

    The encoding table is a training artefact and belongs on the server, which is
    the whole reason the contract takes a payment rather than a feature vector. But
    a client building a form needs to know what the vocabulary is, so it is
    published here rather than copied into the client by hand. A value not on these
    lists is still accepted: it codes to -1, exactly as training coded anything it
    had not seen, and the response names it under input_report.unknown_category.
    """
    registry = ServingRegistry.get_instance()
    if not registry.is_loaded:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, "NO_ACTIVE_MODEL",
                      registry.load_error or "No model is in active status.")
    out = {}
    for column, table in registry.encoding.items():
        values = sorted((v for v in table if v not in {"nan", "None", ""}),
                        key=lambda v: table[v])
        out[column] = {"values": values, "count": len(values),
                       "absent_code": -1}
    return {
        "columns": out,
        "note": ("Absent and unrecognised values both code to -1, which is what "
                 "training meant by absent. A caller may also send the integer code "
                 "directly if it has already encoded."),
    }


@router.get("/audit/recent", summary="Recently stored decisions")
def recent(limit: int = 25):
    store = StoreService.get_instance()
    return {"summary": store.summary(), "predictions": store.recent_predictions(limit)}
