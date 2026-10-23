from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import xgboost as xgb

from app.core.config import settings
from app.utils.logging_config import get_logger
from app.schemas.prediction import (
    PredictionResult,
    LocalFeatureContribution,
    BatchPredictionResponse,
)
from app.services.preprocessing_service import PreprocessingService, PreprocessingValidationError

logger = get_logger(__name__)


class ModelService:
    _instance = None

    def __init__(self):
        self.classifier: Optional[xgb.XGBClassifier] = None
        self.booster: Optional[xgb.Booster] = None
        self.is_loaded: bool = False
        self.model_type: Optional[str] = None
        self.num_features: int = 32
        self.num_trees: Optional[int] = None
        self.best_iteration: Optional[int] = None
        self.best_score: Optional[float] = None
        self.load_error: Optional[str] = None
        self.model_version: Optional[str] = None
        self.preprocessing_service = PreprocessingService.get_instance()
        self.initialize_model()

    @classmethod
    def get_instance(cls) -> "ModelService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize_model(self) -> None:
        """
        Loads the XGBoost model once at startup into memory.
        Uses CPU inference.
        """
        model_path = settings.model_path
        logger.info(f"Resolving model artifact from: {model_path}")

        if not model_path.exists():
            self.load_error = f"Model artifact not found at {model_path.name}"
            self.is_loaded = False
            logger.error(self.load_error)
            return

        try:
            # 1. Load native Booster for fast inference and native TreeSHAP
            self.booster = xgb.Booster()
            self.booster.load_model(str(model_path))

            # 2. Load Scikit-Learn wrapper XGBClassifier for high-level classification
            self.classifier = xgb.XGBClassifier()
            self.classifier.load_model(str(model_path))

            # 3. Extract model metadata
            self.num_features = self.booster.num_features()
            self.model_type = "XGBoost Binary Classifier (gbtree)"

            attrs = self.booster.attributes()
            if "best_iteration" in attrs:
                self.best_iteration = int(attrs["best_iteration"])
            if "best_score" in attrs:
                self.best_score = float(attrs["best_score"])

            # Count trees from booster dump summary
            dump = self.booster.get_dump()
            self.num_trees = len(dump)

            # When the serving bundle is present it, not this fallback file, is
            # what scores every request, so the reported metadata follows it.
            registry = self._registry()
            if registry is not None and registry.is_loaded:
                self.num_trees = registry.trees_in_file
                self.best_iteration = registry.best_iteration
                self.model_type = (
                    f"XGBoost, {len(registry.members)} model"
                    f"{'' if len(registry.members) == 1 else 's'} averaged "
                    f"({registry.combine})")
                self.model_version = registry.model_version

            self.is_loaded = True
            self.load_error = None
            logger.info(
                f"Model successfully loaded! Trees: {self.num_trees}, "
                f"Best Iteration: {self.best_iteration}, Expected Features: {self.num_features}"
            )
        except Exception as e:
            self.load_error = f"Failed to load XGBoost model: {str(e)}"
            self.is_loaded = False
            logger.error(self.load_error, exc_info=True)

    def _score(self, scaled_matrix: np.ndarray) -> np.ndarray:
        """Fraud probability for prepared rows, from the serving registry.

        These older endpoints used to score with their own copy of the model, which
        was fine while there was one model and became wrong the moment the served
        model became an average of seven. Two endpoints answering differently about
        the same payment is the kind of fault nobody finds until a customer asks why
        the dashboard and the API disagree. Both now go through one scorer.

        If the registry has not loaded, these endpoints fall back to their own
        booster rather than failing: they predate the registry and the dashboard
        depends on them.
        """
        registry = self._registry()
        if registry is not None and registry.is_loaded:
            return registry.raw_score(scaled_matrix)
        return self.classifier.predict_proba(scaled_matrix)[:, 1]

    @staticmethod
    def _registry():
        try:
            from app.services.registry_service import ServingRegistry
            return ServingRegistry.get_instance()
        except Exception:                                          # noqa: BLE001
            return None

    def determine_risk_category(self, fraud_prob: float) -> str:
        """
        Classifies transaction into a risk category based on configurable thresholds.
        Presentation label only, not an actuarially calibrated financial risk score.
        """
        if fraud_prob >= settings.RISK_THRESHOLD_HIGH:
            return "high"
        elif fraud_prob >= settings.RISK_THRESHOLD_LOW:
            return "medium"
        return "low"

    def compute_local_shap(
        self, scaled_matrix: np.ndarray, top_k: int = 8
    ) -> List[List[LocalFeatureContribution]]:
        """
        Computes native TreeSHAP feature contributions using the loaded Booster.
        Returns top positive and negative contributing features for each transaction.
        """
        if not self.booster:
            return [[] for _ in range(scaled_matrix.shape[0])]

        try:
            # Through the registry when it is loaded, so the contributions are
            # averaged across the ensemble members and still add up to the score
            # these endpoints returned.
            registry = self._registry()
            if registry is not None and registry.is_loaded:
                contribs = registry.contributions(scaled_matrix)
            else:
                dmat = xgb.DMatrix(scaled_matrix)
                # pred_contribs=True returns (N, num_features + 1); the last column
                # is the model base margin.
                contribs = self.booster.predict(dmat, pred_contribs=True)
            feature_names = self.preprocessing_service.feature_columns

            all_explanations: List[List[LocalFeatureContribution]] = []
            for row in contribs:
                feat_contribs = row[:-1]  # Exclude bias term
                # Sort indices by absolute contribution magnitude
                top_indices = np.argsort(-np.abs(feat_contribs))[:top_k]

                row_explanations: List[LocalFeatureContribution] = []
                for idx in top_indices:
                    shap_val = float(feat_contribs[idx])
                    row_explanations.append(
                        LocalFeatureContribution(
                            feature=feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
                            shap_value=round(shap_val, 4),
                            abs_contribution=round(abs(shap_val), 4),
                            direction="increases_risk" if shap_val > 0 else "decreases_risk",
                        )
                    )
                all_explanations.append(row_explanations)
            return all_explanations
        except Exception as e:
            logger.warning(f"Local TreeSHAP calculation failed: {str(e)}")
            return [[] for _ in range(scaled_matrix.shape[0])]

    def predict_single(
        self, features: Dict[str, Any], include_explanation: bool = True
    ) -> PredictionResult:
        """Runs validated preprocessing and inference for a single transaction."""
        if not self.is_loaded:
            raise RuntimeError(f"Prediction unavailable: {self.load_error or 'Model not loaded.'}")

        scaled_matrix, _ = self.preprocessing_service.transform_single(features)
        fraud_prob = float(self._score(scaled_matrix)[0])
        legit_prob = 1.0 - fraud_prob

        is_fraud = bool(fraud_prob >= settings.DECISION_THRESHOLD)
        prediction_label = "fraud" if is_fraud else "legitimate"
        risk_category = self.determine_risk_category(fraud_prob)

        local_expl: Optional[List[LocalFeatureContribution]] = None
        if include_explanation:
            expl_list = self.compute_local_shap(scaled_matrix, top_k=8)
            if expl_list:
                local_expl = expl_list[0]

        return PredictionResult(
            prediction=prediction_label,
            is_fraud=is_fraud,
            fraud_probability=round(fraud_prob, 4),
            legitimate_probability=round(legit_prob, 4),
            risk_category=risk_category,
            decision_threshold=settings.DECISION_THRESHOLD,
            model_identifier=f"XGBoost_Baseline_32f_best_iter_{self.best_iteration or 'default'}",
            status="success",
            local_explanations=local_expl,
        )

    def predict_batch(
        self, batch: List[Dict[str, Any]], include_explanations: bool = False
    ) -> BatchPredictionResponse:
        """Runs validated preprocessing and inference for a batch of transactions."""
        if not self.is_loaded:
            raise RuntimeError(f"Prediction unavailable: {self.load_error or 'Model not loaded.'}")

        if len(batch) > settings.MAX_BATCH_SIZE:
            raise ValueError(
                f"Batch size {len(batch)} exceeds maximum allowed limit of {settings.MAX_BATCH_SIZE} transactions."
            )

        scaled_matrix, _ = self.preprocessing_service.transform_batch(batch)
        probs = self._score(scaled_matrix)

        explanations = (
            self.compute_local_shap(scaled_matrix, top_k=5)
            if include_explanations
            else [None] * len(batch)
        )

        results: List[PredictionResult] = []
        fraud_count = 0
        legit_count = 0
        high_risk_count = 0
        med_risk_count = 0
        low_risk_count = 0

        for i, fraud_prob in enumerate(float(v) for v in probs):
            legit_prob = 1.0 - fraud_prob
            is_fraud = bool(fraud_prob >= settings.DECISION_THRESHOLD)
            prediction_label = "fraud" if is_fraud else "legitimate"
            risk_cat = self.determine_risk_category(fraud_prob)

            if is_fraud:
                fraud_count += 1
            else:
                legit_count += 1

            if risk_cat == "high":
                high_risk_count += 1
            elif risk_cat == "medium":
                med_risk_count += 1
            else:
                low_risk_count += 1

            results.append(
                PredictionResult(
                    prediction=prediction_label,
                    is_fraud=is_fraud,
                    fraud_probability=round(fraud_prob, 4),
                    legitimate_probability=round(legit_prob, 4),
                    risk_category=risk_cat,
                    decision_threshold=settings.DECISION_THRESHOLD,
                    model_identifier=f"XGBoost_Baseline_32f_best_iter_{self.best_iteration or 'default'}",
                    status="success",
                    local_explanations=explanations[i],
                )
            )

        return BatchPredictionResponse(
            total_processed=len(batch),
            fraud_count=fraud_count,
            legitimate_count=legit_count,
            high_risk_count=high_risk_count,
            medium_risk_count=med_risk_count,
            low_risk_count=low_risk_count,
            predictions=results,
        )
