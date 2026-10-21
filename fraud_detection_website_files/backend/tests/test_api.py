import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.model_service import ModelService
from app.services.preprocessing_service import PreprocessingService


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def sample_payload():
    prep = PreprocessingService.get_instance()
    features = prep.get_default_sample_dict()
    return {"features": features, "include_explanation": True}


def test_health_endpoint(client):
    """Verifies that GET /api/health returns 200, healthy status, and expected 32 features."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["expected_features"] == 32
    assert data["boosting_rounds"] == 2038
    assert data["best_iteration"] == 1937


def test_model_loaded_and_metadata():
    """Verifies that ModelService loaded the XGBoost model and extracted metadata correctly."""
    service = ModelService.get_instance()
    assert service.is_loaded is True
    assert service.num_features == 32
    assert service.best_iteration == 1937
    assert service.best_score is not None
    assert service.classifier is not None
    assert service.booster is not None


def test_preprocessing_feature_ordering_and_imputation():
    """Verifies that PreprocessingService preserves 32 columns and imputes missing values with median."""
    prep = PreprocessingService.get_instance()
    assert len(prep.feature_columns) == 32
    assert prep.feature_columns[0] == "TransactionDT"
    assert prep.feature_columns[1] == "TransactionAmt"

    # Test with partial dictionary (missing most features)
    partial_input = {"TransactionAmt": 150.0}
    scaled, sanitized = prep.transform_single(partial_input)

    assert scaled.shape == (1, 32)
    # Check that missing features received their respective medians in sanitized dict
    assert sanitized["card1"] == float(prep.medians[prep.feature_indices["card1"]])
    assert sanitized["TransactionAmt"] == 150.0


def test_preprocessing_rejects_unmapped_categorical_strings():
    """Verifies that raw non-numeric categorical strings raise a clear validation error."""
    prep = PreprocessingService.get_instance()
    invalid_input = {"ProductCD": "W", "TransactionAmt": 100.0}

    with pytest.raises(Exception) as exc_info:
        prep.transform_single(invalid_input)
    assert "received non-numeric string value" in str(exc_info.value)
    assert "ProductCD" in str(exc_info.value)


def test_single_prediction_valid(client, sample_payload):
    """Verifies POST /api/predict produces a valid prediction and probability score."""
    response = client.post("/api/predict", json=sample_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] in ["fraud", "legitimate"]
    assert 0.0 <= data["fraud_probability"] <= 1.0
    assert 0.0 <= data["legitimate_probability"] <= 1.0
    assert data["risk_category"] in ["low", "medium", "high"]
    assert data["local_explanations"] is not None
    assert len(data["local_explanations"]) > 0


def test_single_prediction_invalid_string(client):
    """Verifies POST /api/predict returns 422 error for unencoded string categories."""
    invalid_payload = {
        "features": {
            "ProductCD": "CreditCardProduct",
            "TransactionAmt": 100.0
        }
    }
    response = client.post("/api/predict", json=invalid_payload)
    assert response.status_code == 422
    data = response.json()
    assert "non-numeric string value" in data["detail"]


def test_batch_prediction(client, sample_payload):
    """Verifies POST /api/predict/batch processes a list of transactions."""
    batch = [sample_payload["features"], sample_payload["features"]]
    response = client.post(
        "/api/predict/batch",
        json={"transactions": batch, "include_explanations": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_processed"] == 2
    assert len(data["predictions"]) == 2
    assert (data["fraud_count"] + data["legitimate_count"]) == 2


def test_batch_prediction_limit_exceeded(client, sample_payload):
    """Verifies POST /api/predict/batch rejects batches exceeding MAX_BATCH_SIZE."""
    oversized = [sample_payload["features"]] * (settings.MAX_BATCH_SIZE + 1)
    response = client.post(
        "/api/predict/batch",
        json={"transactions": oversized}
    )
    assert response.status_code == 400
    assert "exceeds maximum allowed limit" in response.json()["detail"]


def test_predict_csv_valid(client, sample_payload):
    """Verifies POST /api/predict/csv accepts a valid CSV and returns scored results."""
    # Build CSV content from sample features
    prep = PreprocessingService.get_instance()
    headers = prep.feature_columns
    row1 = [str(prep.medians[i]) for i in range(len(headers))]
    csv_text = ",".join(headers) + "\n" + ",".join(row1) + "\n"

    csv_file = io.BytesIO(csv_text.encode("utf-8"))
    response = client.post(
        "/api/predict/csv",
        files={"file": ("test_transactions.csv", csv_file, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows_scored"] == 1
    assert len(data["predictions"]) == 1
    assert data["predictions"][0]["prediction"] in ["fraud", "legitimate"]


def test_predict_csv_missing_columns(client):
    """Verifies POST /api/predict/csv rejects CSV files missing required feature columns."""
    csv_text = "TransactionAmt,card1\n100.0,9633.0\n"
    csv_file = io.BytesIO(csv_text.encode("utf-8"))
    response = client.post(
        "/api/predict/csv",
        files={"file": ("incomplete.csv", csv_file, "text/csv")}
    )
    assert response.status_code == 422
    assert "missing" in response.json()["detail"].lower()


def test_explainability_global(client):
    """Verifies GET /api/explainability/feature-importance returns global TreeSHAP rankings."""
    response = client.get("/api/explainability/feature-importance")
    assert response.status_code == 200
    data = response.json()
    assert data["total_features"] == 32
    assert len(data["features"]) == 32
    assert data["features"][0]["feature"] == "C5"
    assert data["features"][0]["rank"] == 1


def test_explainability_local(client, sample_payload):
    """Verifies POST /api/explainability/local computes transaction-specific feature attributions."""
    response = client.post("/api/explainability/local", json=sample_payload)
    assert response.status_code == 200
    data = response.json()
    assert "top_contributions" in data
    assert len(data["top_contributions"]) > 0


def test_drift_monitoring(client):
    """Verifies GET /api/monitoring/drift returns 5-block PSI summaries."""
    response = client.get("/api/monitoring/drift")
    assert response.status_code == 200
    data = response.json()
    assert data["evaluated_blocks"] == 5
    assert len(data["psi_summary_all_features"]) == 5
    assert len(data["psi_summary_excluding_time"]) == 5
    assert "PSI evaluates covariate feature distribution shifts" in data["interpretation"]


def test_model_info(client):
    """Verifies GET /api/model/info returns research title, comparisons, and limitations."""
    response = client.get("/api/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "Adaptive Financial Fraud Detection" in data["research_title"]
    assert len(data["model_comparison"]) >= 2
    assert len(data["adaptive_block_results"]) == 5
    assert len(data["research_limitations"]) == 4


def test_model_missing_file_handling():
    """Verifies that ModelService handles missing model file gracefully without unhandled crashes."""
    # Temporarily instantiate service with dummy path
    from app.services.model_service import ModelService
    svc = ModelService.__new__(ModelService)
    svc.classifier = None
    svc.booster = None
    svc.is_loaded = False
    svc.num_features = 32
    svc.load_error = "Model artifact not found"
    assert svc.is_loaded is False
    with pytest.raises(RuntimeError):
        svc.predict_single({"TransactionAmt": 100.0})
