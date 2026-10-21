from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# --- Health Schema ---
class HealthResponse(BaseModel):
    status: str = Field(..., description="API operational status ('healthy' or 'degraded')")
    model_loaded: bool = Field(..., description="Whether the XGBoost model loaded successfully")
    model_type: Optional[str] = Field(None, description="Model architecture type")
    expected_features: int = Field(..., description="Number of features expected by the model")
    boosting_rounds: Optional[int] = Field(None, description="Total trees in model")
    best_iteration: Optional[int] = Field(None, description="Optimal boosting round selected")
    initialization_error: Optional[str] = Field(None, description="Sanitized initialization error if model failed")


# --- Explainability & SHAP Schemas ---
class LocalFeatureContribution(BaseModel):
    feature: str = Field(..., description="Feature name")
    shap_value: float = Field(..., description="TreeSHAP log-odds contribution (positive increases fraud risk)")
    abs_contribution: float = Field(..., description="Magnitude of contribution")
    direction: str = Field(..., description="'increases_risk' or 'decreases_risk'")


class FeatureImportanceItem(BaseModel):
    feature: str = Field(..., description="Feature name")
    mean_absolute_shap_contribution: float = Field(..., description="Mean |SHAP| across training/validation sample")
    rank: int = Field(..., description="Importance rank (1 = highest)")


class FeatureImportanceResponse(BaseModel):
    total_features: int
    features: List[FeatureImportanceItem]
    method: str = "Global Mean Absolute TreeSHAP Contribution"
    disclaimer: str = (
        "Global feature importance measures overall model feature attribution across the study sample. "
        "It does not represent a causal explanation for individual fraud events."
    )


# --- Prediction Schemas ---
class SinglePredictionRequest(BaseModel):
    features: Dict[str, Any] = Field(
        ...,
        description="Dictionary mapping feature names to their numeric or pre-encoded values. "
                    "Missing values are safely imputed using training set medians."
    )
    include_explanation: bool = Field(
        default=True,
        description="Whether to compute local TreeSHAP feature contributions for this prediction"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "features": {
                    "TransactionDT": 4758851.0,
                    "TransactionAmt": 68.95,
                    "ProductCD": 4.0,
                    "card1": 9633.0,
                    "card2": 361.0,
                    "card3": 150.0,
                    "card4": 3.0,
                    "card5": 226.0,
                    "card6": 2.0,
                    "addr1": 299.0,
                    "addr2": 87.0,
                    "dist1": 9.0,
                    "dist2": 36.0,
                    "P_emaildomain": 16.0,
                    "R_emaildomain": -1.0,
                    "C1": 1.0, "C2": 1.0, "C3": 0.0, "C4": 0.0,
                    "C5": 0.0, "C6": 1.0, "C7": 0.0, "C8": 0.0,
                    "C9": 1.0, "C10": 0.0, "C11": 1.0, "C12": 0.0,
                    "C13": 2.0, "C14": 1.0,
                    "D1": 0.0, "D2": 97.0, "D3": 8.0
                },
                "include_explanation": True
            }
        }
    }


class PredictionResult(BaseModel):
    prediction: str = Field(..., description="'fraud' or 'legitimate'")
    is_fraud: bool = Field(..., description="Boolean flag: True if fraud")
    fraud_probability: float = Field(..., description="Estimated fraud probability [0.0 - 1.0]")
    legitimate_probability: float = Field(..., description="Estimated legitimate probability [0.0 - 1.0]")
    risk_category: str = Field(..., description="Configurable presentation risk tier ('low', 'medium', 'high')")
    decision_threshold: float = Field(..., description="Configurable threshold used to separate fraud from legitimate")
    model_identifier: str = Field(..., description="Model identifier string")
    status: str = Field("success", description="Processing status")
    local_explanations: Optional[List[LocalFeatureContribution]] = Field(
        None,
        description="Top local TreeSHAP feature contributions if requested"
    )
    disclaimer: str = (
        "Risk categories and probabilities are research demonstration outputs. "
        "Decision thresholds require financial validation before real-world operational deployment."
    )


class BatchPredictionRequest(BaseModel):
    transactions: List[Dict[str, Any]] = Field(
        ...,
        description="List of transaction feature dictionaries"
    )
    include_explanations: bool = Field(
        default=False,
        description="Whether to compute local TreeSHAP explanations for each item in batch"
    )


class BatchPredictionResponse(BaseModel):
    total_processed: int
    fraud_count: int
    legitimate_count: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    predictions: List[PredictionResult]


# --- Drift Monitoring Schemas ---
class DriftBlockItem(BaseModel):
    time_block: int
    transactions: Optional[int] = None
    median_psi: float
    mean_psi: float
    features_psi_over_010: int
    features_psi_over_025: int


class DriftMonitoringResponse(BaseModel):
    evaluated_blocks: int
    psi_summary_all_features: List[DriftBlockItem]
    psi_summary_excluding_time: List[DriftBlockItem]
    interpretation: str
    limitations: str


# --- Model Information Schemas ---
class ModelComparisonItem(BaseModel):
    model: str
    validation_pr_auc: float
    validation_roc_auc: float
    status: str


class AdaptiveBlockResult(BaseModel):
    block: int
    transactions: int
    fraud_count: int
    fixed_pr_auc: float
    adaptive_pr_auc: float
    fixed_roc_auc: float
    adaptive_roc_auc: float
    previous_labeled_transactions: int
    pr_auc_gain: float
    roc_auc_gain: float


class ModelInfoResponse(BaseModel):
    research_title: str
    active_inference_model: str
    expected_features: int
    feature_names: List[str]
    model_comparison: List[ModelComparisonItem]
    sequential_adaptation_summary: Dict[str, Any]
    adaptive_block_results: List[AdaptiveBlockResult]
    research_limitations: List[str]
    evaluation_protocol_note: str
