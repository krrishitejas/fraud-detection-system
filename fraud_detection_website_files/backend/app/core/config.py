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
    MODEL_FILE_NAME: str = "A_all_32_transaction_extended.json"
    FEATURE_COLUMNS_FILE_NAME: str = "feature_columns.json"
    PREPROCESSING_FILE_NAME: str = "feature_preprocessing.npz"
    FEATURE_IMPORTANCE_FILE_NAME: str = "explainability_feature_importance.csv"
    PSI_SUMMARY_FILE_NAME: str = "concept_drift_psi_summary.csv"
    DRIFT_NO_TIME_FILE_NAME: str = "final_drift_summary_excluding_time.csv"
    MODEL_COMPARISON_FILE_NAME: str = "final_model_comparison.csv"
    ADAPTIVE_RESULTS_FILE_NAME: str = "fixed_vs_retrained_adaptive_results.csv"
    RESEARCH_SUMMARY_FILE_NAME: str = "final_research_summary.json"

    # Prediction Decision & Risk Categorization Thresholds
    # Note: These are configurable presentation thresholds for demonstration.
    # They are NOT calibrated financial loss or operational decision thresholds.
    DECISION_THRESHOLD: float = 0.50
    RISK_THRESHOLD_LOW: float = 0.20
    RISK_THRESHOLD_HIGH: float = 0.60

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
