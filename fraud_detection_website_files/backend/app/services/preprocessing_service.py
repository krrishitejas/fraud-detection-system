"""
Turning a payment into the 32 numbers the model was trained on.

The one rule this file exists to enforce is that serving must repeat training
exactly. Training filled a missing numeric field with that column's training median,
coded a missing category as -1, and did the arithmetic in float32. Serving does the
same three things, in the same order, or the model is being asked about rows it has
never seen the like of.

That middle one was a real defect, found in the Week 8 review and fixed here. Leaving
a text column out of a request used to fill it with the column's *median code*, which
is the code for the commonest category, not for absent. P_emaildomain's median is 16,
the commonest sender domain -- so a payment with no sender domain was being scored as
though it came from the most ordinary one there is. 15,910 of the 88,081 held-out rows
genuinely have no sender domain, and the fault flipped 518 decisions at the serving
cutoff. Categories now fill with -1, which is what training meant by absent.
"""
import json
from pathlib import Path
from typing import Dict, List, Any, Tuple
import numpy as np
import pandas as pd

from app.core.config import settings
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

# The five columns IEEE-CIS supplies as text. Training coded each one to an integer
# and coded absence as -1; a value never seen in training also codes to -1.
CATEGORICAL_COLUMNS = ("ProductCD", "card4", "card6", "P_emaildomain", "R_emaildomain")
ABSENT_CATEGORY_CODE = -1.0


class PreprocessingValidationError(Exception):
    """Raised when incoming features violate schema or cannot be safely transformed."""
    pass


class PreprocessingService:
    _instance = None

    def __init__(self):
        self.feature_columns: List[str] = []
        self.feature_indices: Dict[str, int] = {}
        self.medians: np.ndarray = np.array([], dtype=np.float32)
        self.means: np.ndarray = np.array([], dtype=np.float32)
        self.stds: np.ndarray = np.array([], dtype=np.float32)
        self.categorical_indices: set = set()
        self.is_initialized: bool = False
        self.initialize()

    @classmethod
    def get_instance(cls) -> "PreprocessingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self) -> None:
        """Loads feature columns and standardization parameters."""
        cols_path = settings.feature_columns_path
        npz_path = settings.preprocessing_path

        if not cols_path.exists():
            logger.error(f"Feature columns file not found at {cols_path}")
            return

        if not npz_path.exists():
            logger.error(f"Preprocessing npz file not found at {npz_path}")
            return

        try:
            with open(cols_path, "r", encoding="utf-8") as f:
                self.feature_columns = json.load(f)

            self.feature_indices = {col: i for i, col in enumerate(self.feature_columns)}
            self.categorical_indices = {
                self.feature_indices[c] for c in CATEGORICAL_COLUMNS
                if c in self.feature_indices
            }

            npz_data = np.load(npz_path, allow_pickle=True)
            self.medians = npz_data["medians"].astype(np.float32)
            self.means = npz_data["means"].astype(np.float32)
            self.stds = npz_data["stds"].astype(np.float32)

            # Prevent division by zero if std is zero
            self.stds = np.where(self.stds == 0.0, 1.0, self.stds)

            num_cols = len(self.feature_columns)
            if self.medians.shape[0] != num_cols or self.means.shape[0] != num_cols or self.stds.shape[0] != num_cols:
                raise ValueError(
                    f"Dimension mismatch between feature_columns ({num_cols}) "
                    f"and preprocessing parameters: medians={self.medians.shape}, "
                    f"means={self.means.shape}, stds={self.stds.shape}"
                )

            self.is_initialized = True
            logger.info(f"PreprocessingService initialized successfully with {num_cols} features.")
        except Exception as e:
            logger.error(f"Failed to initialize PreprocessingService: {str(e)}")
            self.is_initialized = False

    def fill_value_for(self, col_idx: int) -> float:
        """What an absent value becomes for this column.

        A category gets -1, which is the code training used for absent. Everything
        else gets that column's training median. Using the median for a category is
        the defect described at the top of this file: the median of a code table is
        the commonest category, so it states the opposite of what is known.
        """
        if col_idx in self.categorical_indices:
            return ABSENT_CATEGORY_CODE
        return float(self.medians[col_idx])

    def get_default_sample_dict(self) -> Dict[str, float]:
        """Returns a baseline transaction with the verified median values."""
        if not self.is_initialized:
            raise PreprocessingValidationError("Preprocessing service is not initialized.")
        return {col: float(self.medians[i]) for i, col in enumerate(self.feature_columns)}

    def transform_single(self, features: Dict[str, Any]) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Validates, imputes, and standardizes a single transaction dictionary.
        Returns (scaled_array of shape (1, 32), sanitized_input_dict).
        """
        scaled_batch, sanitized = self.transform_batch([features])
        return scaled_batch, sanitized[0]

    def transform_batch(self, batch: List[Dict[str, Any]]) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Validates, imputes, and standardizes a list of transaction dictionaries.
        Returns (scaled_array of shape (N, 32), list of sanitized input dicts).
        """
        if not self.is_initialized:
            raise PreprocessingValidationError(
                "Preprocessing service is not initialized. Feature configuration or metadata is missing."
            )

        n_rows = len(batch)
        if n_rows == 0:
            raise PreprocessingValidationError("Batch contains zero records.")

        raw_matrix = np.empty((n_rows, len(self.feature_columns)), dtype=np.float32)
        sanitized_batch: List[Dict[str, Any]] = []

        for row_idx, record in enumerate(batch):
            sanitized_row: Dict[str, Any] = {}
            for col_idx, col_name in enumerate(self.feature_columns):
                val = record.get(col_name)

                # 1. Missing or None or empty string -> Impute with median
                if val is None or val == "" or (isinstance(val, float) and np.isnan(val)):
                    imputed_val = self.fill_value_for(col_idx)
                    raw_matrix[row_idx, col_idx] = imputed_val
                    sanitized_row[col_name] = imputed_val
                    continue

                # 2. Check for raw string non-numeric categorical values
                if isinstance(val, str):
                    try:
                        numeric_val = float(val)
                    except ValueError:
                        raise PreprocessingValidationError(
                            f"Feature '{col_name}' received non-numeric string value: '{val}'. "
                            f"The exported model artifacts contain only numeric standardization parameters "
                            f"(means, stds, medians) and do not contain raw string category mappings. "
                            f"Please supply the pre-encoded numeric value."
                        )
                elif isinstance(val, (int, float, np.integer, np.floating)):
                    if np.isnan(val) or np.isinf(val):
                        imputed_val = self.fill_value_for(col_idx)
                        raw_matrix[row_idx, col_idx] = imputed_val
                        sanitized_row[col_name] = imputed_val
                        continue
                    numeric_val = float(val)
                else:
                    raise PreprocessingValidationError(
                        f"Feature '{col_name}' has unsupported data type {type(val).__name__} with value {val}."
                    )

                raw_matrix[row_idx, col_idx] = numeric_val
                sanitized_row[col_name] = numeric_val

            sanitized_batch.append(sanitized_row)

        # Apply standardization: (x - mean) / std
        scaled_matrix = (raw_matrix - self.means) / self.stds
        return scaled_matrix.astype(np.float32), sanitized_batch

    def transform_dataframe(self, df: pd.DataFrame) -> Tuple[np.ndarray, pd.DataFrame]:
        """
        Validates and standardizes a pandas DataFrame (e.g. from CSV upload).
        Ensures columns match, imputes missing values, and standardizes.
        """
        if not self.is_initialized:
            raise PreprocessingValidationError("Preprocessing service is not initialized.")

        # Check required columns
        missing_cols = [col for col in self.feature_columns if col not in df.columns]
        if missing_cols:
            raise PreprocessingValidationError(
                f"Uploaded data is missing {len(missing_cols)} required feature column(s): {missing_cols[:5]}"
                + ("..." if len(missing_cols) > 5 else "")
                + ". The CSV must contain all 32 required model features."
            )

        # Convert records to dicts and use validated batch transform
        records = df[self.feature_columns].to_dict(orient="records")
        scaled_matrix, sanitized_records = self.transform_batch(records)
        return scaled_matrix, pd.DataFrame(sanitized_records)
