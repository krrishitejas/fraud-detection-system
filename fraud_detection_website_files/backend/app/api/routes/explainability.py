from fastapi import APIRouter, HTTPException, status
from app.schemas.prediction import FeatureImportanceResponse, SinglePredictionRequest, LocalFeatureContribution
from app.services.explainability_service import ExplainabilityService
from app.services.model_service import ModelService
from app.services.preprocessing_service import PreprocessingValidationError

router = APIRouter(prefix="/explainability", tags=["Explainability"])


@router.get("/feature-importance", response_model=FeatureImportanceResponse, summary="Get global SHAP feature importance")
def get_feature_importance():
    """
    Returns global feature importance ranked by mean absolute TreeSHAP contribution,
    extracted from model evaluation across the study dataset.
    """
    service = ExplainabilityService.get_instance()
    return service.get_global_importance()


@router.post("/local", summary="Compute local TreeSHAP explanation for a specific transaction")
def get_local_explanation(request: SinglePredictionRequest):
    """
    Computes per-feature TreeSHAP attribution for an individual transaction,
    identifying which specific features pushed the score higher or lower.
    """
    model_service = ModelService.get_instance()
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not loaded."
        )

    try:
        scaled_matrix, _ = model_service.preprocessing_service.transform_single(request.features)
        explanations = model_service.compute_local_shap(scaled_matrix, top_k=15)
        top_contribs = explanations[0] if explanations else []

        probs = model_service.classifier.predict_proba(scaled_matrix)[0]
        fraud_prob = float(probs[1])

        return {
            "fraud_probability": round(fraud_prob, 4),
            "risk_category": model_service.determine_risk_category(fraud_prob),
            "top_contributions": top_contribs,
            "disclaimer": (
                "Local TreeSHAP values reflect model decision logic attribution. "
                "They describe how the model scored this input relative to its baseline, "
                "not causal mechanisms in real financial behavior."
            )
        }
    except PreprocessingValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
