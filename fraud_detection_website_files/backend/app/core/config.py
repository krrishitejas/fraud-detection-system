from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "Explainable Adaptive Fraud Detection API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Path to directory containing model and CSV research artifacts
    ARTIFACTS_DIR: Path = Path(__file__).resolve().parents[3]

    # Specific artifact file names
    # The model selected by the imbalance comparison in
    # WEEK 8/experiments/imbalance_study.py. Trained without class weighting,
    # which beat full-ratio weighting, square-root weighting, negative
    # downsampling and majority bootstrap over three seeds on held-out data.
    # The previous model is kept at A_all_32_transaction_extended.json.
    MODEL_FILE_NAME: str = "A_all_32_noweight_improved.json"
    FEATURE_COLUMNS_FILE_NAME: str = "feature_columns.json"
    PREPROCESSING_FILE_NAME: str = "feature_preprocessing.npz"
    FEATURE_IMPORTANCE_FILE_NAME: str = "explainability_feature_importance.csv"
    PSI_SUMMARY_FILE_NAME: str = "concept_drift_psi_summary.csv"
    DRIFT_NO_TIME_FILE_NAME: str = "final_drift_summary_excluding_time.csv"
    MODEL_COMPARISON_FILE_NAME: str = "final_model_comparison.csv"
    ADAPTIVE_RESULTS_FILE_NAME: str = "fixed_vs_retrained_adaptive_results.csv"
    RESEARCH_SUMMARY_FILE_NAME: str = "final_research_summary.json"

    # The serving bundle behind POST /api/model/predict. Generated from the real
    # dataset by WEEK 8/scripts/fit_serving_config.py: the model version, the
    # preprocessing version, the calibration fitted on the first half of validation,
    # the cutoff chosen on the second half, and the measured rule table. The service
    # reads its decision policy from here rather than from constants in this file,
    # which is the whole point of the model_version / preprocessing_version /
    # threshold_config entities in the Week 4 database design.
    SERVING_CONFIG_FILE_NAME: str = "serving/serving_config.json"
    CATEGORY_ENCODING_FILE_NAME: str = "serving/category_encoding.json"

    # Storing each decision. The Week 4 design has prediction and audit_event tables;
    # the service used to score, answer and forget, which makes a decision impossible
    # to appeal or to measure in production afterwards. SQLite keeps the demonstration
    # honest on one machine; the column names match the Week 4 schema, so moving to
    # PostgreSQL or MySQL is a connection change rather than a redesign.
    PERSIST_PREDICTIONS: bool = True
    PREDICTION_STORE_FILE_NAME: str = "serving/predictions.sqlite3"

    # Prediction Decision & Risk Categorization Thresholds.
    #
    # These belong to the model above and must change with it. The previous model was
    # trained with full-ratio class weighting, which inflates every score, so 0.50 was
    # a sensible cutoff for it. This model is trained without weighting and its scores
    # are naturally calibrated, so 0.50 would flag only 1.48% of payments and catch
    # 1,001 frauds where the old model caught 1,698.
    #
    # 0.065 is the cutoff that costs least on the validation window, assuming a missed
    # fraud costs ten times a false alarm. It was never chosen on the held-out data.
    # On the held-out blocks it catches 1,933 of 3,065 frauds (recall 0.6307, precision
    # 0.3079, alert rate 7.13%) against 1,001 (recall 0.3266) at 0.50.
    #
    # This service applies no calibration layer, so this threshold is on the model's
    # raw output. Searching the full validation window on that raw scale lands on
    # 0.065 as well. Do not copy this value to a different model: the one before this
    # had its boundary near 0.50, and carrying a cutoff across a model change cuts
    # recall silently. See WEEK 8/experiments/.
    DECISION_THRESHOLD: float = 0.065
    RISK_THRESHOLD_LOW: float = 0.0325
    RISK_THRESHOLD_HIGH: float = 0.20

    # Limits
    MAX_BATCH_SIZE: int = 1000
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_CSV_ROWS: int = 5000

    # CORS configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def model_path(self) -> Path:
        return self._resolve_path(self.MODEL_FILE_NAME)

    @property
    def feature_columns_path(self) -> Path:
        return self._resolve_path(self.FEATURE_COLUMNS_FILE_NAME)

    @property
    def preprocessing_path(self) -> Path:
        return self._resolve_path(self.PREPROCESSING_FILE_NAME)

    @property
    def feature_importance_path(self) -> Path:
        return self._resolve_path(self.FEATURE_IMPORTANCE_FILE_NAME)

    @property
    def psi_summary_path(self) -> Path:
        return self._resolve_path(self.PSI_SUMMARY_FILE_NAME)

    @property
    def drift_no_time_path(self) -> Path:
        return self._resolve_path(self.DRIFT_NO_TIME_FILE_NAME)

    @property
    def model_comparison_path(self) -> Path:
        return self._resolve_path(self.MODEL_COMPARISON_FILE_NAME)

    @property
    def adaptive_results_path(self) -> Path:
        return self._resolve_path(self.ADAPTIVE_RESULTS_FILE_NAME)

    @property
    def research_summary_path(self) -> Path:
        return self._resolve_path(self.RESEARCH_SUMMARY_FILE_NAME)

    @property
    def serving_config_path(self) -> Path:
        return self._resolve_path(self.SERVING_CONFIG_FILE_NAME)

    @property
    def category_encoding_path(self) -> Path:
        return self._resolve_path(self.CATEGORY_ENCODING_FILE_NAME)

    @property
    def prediction_store_path(self) -> Path:
        return self._resolve_path(self.PREDICTION_STORE_FILE_NAME)

    def _resolve_path(self, filename: str) -> Path:
        """
        Check ARTIFACTS_DIR first, then check parent directories to support
        running from different working directories safely without hardcoded paths.
        """
        # Primary location: ARTIFACTS_DIR
        candidate = self.ARTIFACTS_DIR / filename
        if candidate.exists():
            return candidate

        # Secondary: parent directory of ARTIFACTS_DIR
        candidate_parent = self.ARTIFACTS_DIR.parent / filename
        if candidate_parent.exists():
            return candidate_parent

        # Sibling fraud_detection_website_files if run from major project root
        candidate_sibling = self.ARTIFACTS_DIR / "fraud_detection_website_files" / filename
        if candidate_sibling.exists():
            return candidate_sibling

        # Fallback to configured target
        return candidate


settings = Settings()
