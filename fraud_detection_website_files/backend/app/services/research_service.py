import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd

from app.core.config import settings
from app.utils.logging_config import get_logger
from app.schemas.prediction import (
    ModelInfoResponse,
    ModelComparisonItem,
    AdaptiveBlockResult,
    ServedModelInfo,
)
from app.services.preprocessing_service import PreprocessingService

logger = get_logger(__name__)


class ResearchService:
    _instance = None

    def __init__(self):
        self.cached_info: Optional[ModelInfoResponse] = None
        self.load_research_data()

    @classmethod
    def get_instance(cls) -> "ResearchService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_research_data(self) -> None:
        """Loads research summary, model comparison, and adaptive results."""
        summary_path = settings.research_summary_path
        comparison_path = settings.model_comparison_path
        adaptive_path = settings.adaptive_results_path

        research_title = "An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift"
        limitations: List[str] = []
        eval_note = (
            "Sequential adaptation evaluation: earlier block labels are used only for later blocks. "
            "Do not describe the full sequence as an untouched heldout evaluation."
        )
        adaptation_summary: Dict[str, Any] = {}

        if summary_path.exists():
            try:
                with open(summary_path, "r", encoding="utf-8") as f:
                    summary_json = json.load(f)
                    research_title = summary_json.get("research_title", research_title)
                    limitations = summary_json.get("limitations", [])
                    eval_note = summary_json.get("evaluation_note", eval_note)
                    adaptation_summary = {
                        "baseline_validation_pr_auc": summary_json.get("baseline_validation_pr_auc"),
                        "graph_validation_pr_auc": summary_json.get("graph_validation_pr_auc"),
                        "graph_validation_roc_auc": summary_json.get("graph_validation_roc_auc"),
                        "mean_sequential_adaptation_pr_auc_gain": summary_json.get("mean_sequential_adaptation_pr_auc_gain"),
                        "block_5_fixed_pr_auc": summary_json.get("block_5_fixed_pr_auc"),
                        "block_5_adaptive_pr_auc": summary_json.get("block_5_adaptive_pr_auc"),
                    }
            except Exception as e:
                logger.error(f"Error loading {summary_path.name}: {str(e)}")

        # Model comparison items
        comparison_items: List[ModelComparisonItem] = []
        if comparison_path.exists():
            try:
                df_comp = pd.read_csv(comparison_path)
                for _, row in df_comp.iterrows():
                    comparison_items.append(
                        ModelComparisonItem(
                            model=str(row["model"]),
                            validation_pr_auc=round(float(row["validation_pr_auc"]), 4),
                            validation_roc_auc=round(float(row["validation_roc_auc"]), 4),
                            status=str(row["status"]),
                        )
                    )
            except Exception as e:
                logger.error(f"Error loading {comparison_path.name}: {str(e)}")

        # Adaptive results items
        adaptive_items: List[AdaptiveBlockResult] = []
        if adaptive_path.exists():
            try:
                df_adapt = pd.read_csv(adaptive_path)
                for _, row in df_adapt.iterrows():
                    adaptive_items.append(
                        AdaptiveBlockResult(
                            block=int(row["block"]),
                            transactions=int(row["transactions"]),
                            fraud_count=int(row["fraud_count"]),
                            fixed_pr_auc=round(float(row["fixed_pr_auc"]), 4),
                            adaptive_pr_auc=round(float(row["adaptive_pr_auc"]), 4),
                            fixed_roc_auc=round(float(row["fixed_roc_auc"]), 4),
                            adaptive_roc_auc=round(float(row["adaptive_roc_auc"]), 4),
                            previous_labeled_transactions=int(row["previous_labeled_transactions"]),
                            pr_auc_gain=round(float(row.get("pr_auc_change", 0.0)), 4),
                            roc_auc_gain=round(float(row.get("roc_auc_change", 0.0)), 4),
                        )
                    )
            except Exception as e:
                logger.error(f"Error loading {adaptive_path.name}: {str(e)}")

        prep = PreprocessingService.get_instance()
        feature_names = prep.feature_columns
        served = self._served_model()

        self.cached_info = ModelInfoResponse(
            research_title=research_title,
            active_inference_model=(
                f"XGBoost, {len(feature_names)} features, "
                f"{served.ensemble_members} models averaged" if served
                else "XGBoost Baseline (32 features, tree-based)"),
            served_model=served,
            expected_features=len(feature_names),
            feature_names=feature_names,
            model_comparison=comparison_items,
            sequential_adaptation_summary=adaptation_summary,
            adaptive_block_results=adaptive_items,
            research_limitations=limitations,
            evaluation_protocol_note=eval_note,
        )

    @staticmethod
    def _served_model() -> Optional[ServedModelInfo]:
        """Read the served model's own numbers out of the serving bundle.

        Returns None when the bundle is absent, so the older endpoints keep
        working and the dashboard simply omits the block rather than falling
        back to a figure that would be wrong.
        """
        try:
            from app.services.registry_service import ServingRegistry
            r = ServingRegistry.get_instance()
            if not r.is_loaded:
                return None
            m = r.config["held_out_block_metrics"]
            return ServedModelInfo(
                model_version=r.model_version,
                preprocessing_version=r.preprocessing_version,
                ensemble_members=int(r.config.get("ensemble_members", len(r.members))),
                combine=r.combine,
                threshold=r.threshold,
                score_scale=r.score_scale,
                held_out_pr_auc=m["pr_auc"], held_out_roc_auc=m["roc_auc"],
                held_out_brier=m["brier"], held_out_ece=m["ece"],
                held_out_rows=m["rows"], alert_rate_pct=m["alert_rate_pct"],
                recall=m["recall"], precision=m["precision"])
        except Exception as exc:                                   # noqa: BLE001
            logger.warning("Served-model block unavailable: %s", exc)
            return None

    def get_research_info(self) -> ModelInfoResponse:
        if self.cached_info is None:
            self.load_research_data()
        return self.cached_info
