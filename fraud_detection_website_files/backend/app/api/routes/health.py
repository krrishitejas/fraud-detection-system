from fastapi import APIRouter, Response, status
from app.schemas.prediction import HealthResponse
from app.services.model_service import ModelService

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Check API health and model readiness")
def get_health(response: Response):
    """
    Returns the operational status of the API and verifies if the
    underlying 32-feature XGBoost model loaded properly.
    """
    model_service = ModelService.get_instance()

    if not model_service.is_loaded:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="degraded",
            model_loaded=False,
            model_type=None,
            expected_features=model_service.num_features,
            boosting_rounds=None,
            best_iteration=None,
            initialization_error=model_service.load_error or "Model failed to initialize.",
        )

    return HealthResponse(
        status="healthy",
        model_loaded=True,
        model_type=model_service.model_type,
        model_version=getattr(model_service, "model_version", None),
        expected_features=model_service.num_features,
        boosting_rounds=model_service.num_trees,
        best_iteration=model_service.best_iteration,
        initialization_error=None,
    )
