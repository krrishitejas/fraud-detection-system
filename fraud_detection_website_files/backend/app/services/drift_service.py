import pandas as pd
from typing import List, Optional
from app.core.config import settings
from app.utils.logging_config import get_logger
from app.schemas.prediction import DriftMonitoringResponse, DriftBlockItem

logger = get_logger(__name__)


class DriftService:
    _instance = None

    def __init__(self):
        self.cached_drift: Optional[DriftMonitoringResponse] = None
        self.load_drift_data()

    @classmethod
    def get_instance(cls) -> "DriftService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_drift_data(self) -> None:
        """Loads historical Population Stability Index (PSI) summaries from CSV."""
        psi_all_path = settings.psi_summary_path
        psi_no_time_path = settings.drift_no_time_path

        items_all: List[DriftBlockItem] = []
        items_no_time: List[DriftBlockItem] = []

        if psi_all_path.exists():
            try:
                df_all = pd.read_csv(psi_all_path)
                for _, row in df_all.iterrows():
                    items_all.append(
                        DriftBlockItem(
                            time_block=int(row["time_block"]),
                            transactions=int(row["transactions"]) if "transactions" in row else None,
                            median_psi=round(float(row["median_psi"]), 4),
                            mean_psi=round(float(row["mean_psi"]), 4),
                            features_psi_over_010=int(row.get("features_psi_over_010", row.get("features_psi_ge_010", 0))),
                            features_psi_over_025=int(row.get("features_psi_over_025", row.get("features_psi_ge_025", 0))),
                        )
                    )
            except Exception as e:
                logger.error(f"Error loading {psi_all_path.name}: {str(e)}")

        if psi_no_time_path.exists():
            try:
                df_no_time = pd.read_csv(psi_no_time_path)
                for _, row in df_no_time.iterrows():
                    items_no_time.append(
                        DriftBlockItem(
                            time_block=int(row["time_block"]),
                            transactions=int(row["transactions"]) if "transactions" in row else None,
                            median_psi=round(float(row["median_psi"]), 4),
                            mean_psi=round(float(row["mean_psi"]), 4),
                            features_psi_over_010=int(row.get("features_psi_over_010", row.get("features_psi_ge_010", 0))),
                            features_psi_over_025=int(row.get("features_psi_over_025", row.get("features_psi_ge_025", 0))),
                        )
                    )
            except Exception as e:
                logger.error(f"Error loading {psi_no_time_path.name}: {str(e)}")

        interpretation = (
            "PSI evaluates covariate feature distribution shifts across 5 chronological blocks. "
            "When the temporal feature (TransactionDT) is included, mean PSI appears artificially inflated (~0.40) "
            "due to monotonically increasing time. Excluding TransactionDT reveals stable feature distributions "
            "(median PSI ~0.007-0.025, mean PSI ~0.010-0.029, with at most 1 feature showing PSI >= 0.10)."
        )

        limitations = (
            "Covariate shift (changes in P(X)) does not prove concept drift (changes in P(Y|X)). "
            "These metrics represent offline experimental evaluation results from historical Colab blocks, "
            "not a live stream monitoring process."
        )

        self.cached_drift = DriftMonitoringResponse(
            evaluated_blocks=max(len(items_all), len(items_no_time)),
            psi_summary_all_features=items_all,
            psi_summary_excluding_time=items_no_time,
            interpretation=interpretation,
            limitations=limitations,
        )

    def get_drift_summary(self) -> DriftMonitoringResponse:
        if self.cached_drift is None:
            self.load_drift_data()
        return self.cached_drift
