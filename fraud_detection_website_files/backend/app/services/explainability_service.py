import pandas as pd
from typing import List, Optional
from app.core.config import settings
from app.utils.logging_config import get_logger
from app.schemas.prediction import FeatureImportanceResponse, FeatureImportanceItem

logger = get_logger(__name__)


class ExplainabilityService:
    _instance = None

    def __init__(self):
        self.cached_response: Optional[FeatureImportanceResponse] = None
        self.load_importance_data()

    @classmethod
    def get_instance(cls) -> "ExplainabilityService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_importance_data(self) -> None:
        """Loads SHAP feature importance rankings from CSV."""
        path = settings.feature_importance_path
        if not path.exists():
            logger.warning(f"Feature importance file not found at {path}")
            return

        try:
            df = pd.read_csv(path)
            # Expecting columns 'feature' and 'mean_absolute_shap_contribution'
            feature_col = "feature" if "feature" in df.columns else df.columns[0]
            val_col = "mean_absolute_shap_contribution" if "mean_absolute_shap_contribution" in df.columns else df.columns[1]

            # Sort descending by contribution
            df = df.sort_values(by=val_col, ascending=False).reset_index(drop=True)

            items: List[FeatureImportanceItem] = []
            for rank, row in enumerate(df.itertuples(index=False), start=1):
                feat_name = str(getattr(row, feature_col))
                shap_val = float(getattr(row, val_col))
                items.append(
                    FeatureImportanceItem(
                        feature=feat_name,
                        mean_absolute_shap_contribution=round(shap_val, 4),
                        rank=rank,
                    )
                )

            self.cached_response = FeatureImportanceResponse(
                total_features=len(items),
                features=items,
            )
            logger.info(f"ExplainabilityService loaded {len(items)} feature importances successfully.")
        except Exception as e:
            logger.error(f"Failed to load feature importance CSV: {str(e)}")

    def get_global_importance(self) -> FeatureImportanceResponse:
        if self.cached_response is None:
            self.load_importance_data()
        if self.cached_response is None:
            return FeatureImportanceResponse(
                total_features=0,
                features=[],
                disclaimer="Feature importance artifact is unavailable."
            )
        return self.cached_response
