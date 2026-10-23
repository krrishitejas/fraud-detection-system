"""
Raw payment in, prepared row out.

The Week 4 interface contract says the API takes a transaction, not a feature vector.
The service as built took a feature vector: a caller had to know that `card4` means
`2.0` before it could ask a question, which puts the encoding table -- a training
artefact -- into every client. That is the wrong way round, and it is how encodings
drift apart between training and serving without anyone noticing.

So the codec is here, on the server, loaded from the same bundle as the model. A
caller sends `"card4": "visa"`. A caller may still send `2.0` if it has already
encoded, because the batch and CSV paths do, and both are accepted and labelled.

An unknown category is not an error. Training coded anything it had not seen as -1,
and new email domains appear every day; refusing them would mean a service that
fails whenever the world moves, rather than one that says so. The response reports
which fields were unknown, and absent, so the caller can see what the score was
actually based on.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np

from app.services.preprocessing_service import (ABSENT_CATEGORY_CODE,
                                                CATEGORICAL_COLUMNS,
                                                PreprocessingService,
                                                PreprocessingValidationError)
from app.services.registry_service import ServingRegistry
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


class TransactionCodec:
    """Encodes raw transactions and prepares them exactly as training did."""

    def __init__(self, registry: ServingRegistry, prep: PreprocessingService):
        self.registry = registry
        self.prep = prep
        self.columns: List[str] = list(prep.feature_columns)
        self.index: Dict[str, int] = dict(prep.feature_indices)

    # -------------------------------------------------------------- encoding

    def encode_category(self, column: str, value: Any) -> Tuple[float, str]:
        """(code, how) where how is one of supplied, encoded, unknown, absent."""
        if value is None or (isinstance(value, str) and not value.strip()):
            return ABSENT_CATEGORY_CODE, "absent"
        if isinstance(value, (int, float, np.integer, np.floating)):
            if isinstance(value, float) and np.isnan(value):
                return ABSENT_CATEGORY_CODE, "absent"
            return float(value), "supplied"           # already encoded by the caller
        table = self.registry.encoding.get(column, {})
        key = str(value).strip()
        if key in table:
            return float(table[key]), "encoded"
        lowered = key.lower()
        if lowered in table:
            return float(table[lowered]), "encoded"
        # Training coded an unseen category as -1, so serving does too, and says so.
        return ABSENT_CATEGORY_CODE, "unknown"

    def numeric(self, column: str, value: Any) -> Tuple[float, str]:
        """(value, how) for a numeric column. An absent or unusable value becomes
        that column's training median, which is what training did with it."""
        idx = self.index[column]
        if value is None or value == "":
            return float(self.prep.medians[idx]), "imputed_median"
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise PreprocessingValidationError(
                f"field '{column}' expects a number and received {value!r}")
        if np.isnan(num) or np.isinf(num):
            return float(self.prep.medians[idx]), "imputed_median"
        return num, "supplied"

    # -------------------------------------------------------------- preparing

    def prepare(self, transaction: Dict[str, Any]) -> Tuple[np.ndarray, Dict[str, str], Dict[str, float]]:
        """Return (scaled row (1, 32) float32, per-field provenance, raw values).

        Provenance is returned because a score the caller cannot account for is not
        much use to an analyst: it says, field by field, whether the value came from
        the request, was encoded here, was unrecognised, or was filled in.
        """
        if not self.prep.is_initialized:
            raise PreprocessingValidationError("preprocessing is not initialised")

        unknown_keys = [k for k in transaction
                        if k not in self.index and k != "TransactionID"]
        raw = np.empty((1, len(self.columns)), dtype=np.float32)
        provenance: Dict[str, str] = {}
        values: Dict[str, float] = {}

        for i, col in enumerate(self.columns):
            supplied = col in transaction
            value = transaction.get(col)
            if col in CATEGORICAL_COLUMNS:
                code, how = self.encode_category(col, value)
                if not supplied:
                    code, how = ABSENT_CATEGORY_CODE, "absent"
            else:
                if not supplied:
                    code, how = float(self.prep.medians[i]), "imputed_median"
                else:
                    code, how = self.numeric(col, value)
            raw[0, i] = code
            provenance[col] = how
            values[col] = float(code)

        scaled = ((raw - self.prep.means) / self.prep.stds).astype(np.float32)
        if unknown_keys:
            provenance["_ignored_fields"] = ",".join(sorted(unknown_keys))
        return scaled, provenance, values

    @staticmethod
    def summarise(provenance: Dict[str, str]) -> Dict[str, List[str]]:
        """The fields worth telling the caller about, grouped."""
        out: Dict[str, List[str]] = {"absent": [], "unknown_category": [],
                                     "imputed_median": []}
        for field, how in provenance.items():
            if field.startswith("_"):
                continue
            if how == "absent":
                out["absent"].append(field)
            elif how == "unknown":
                out["unknown_category"].append(field)
            elif how == "imputed_median":
                out["imputed_median"].append(field)
        return {k: sorted(v) for k, v in out.items() if v}
