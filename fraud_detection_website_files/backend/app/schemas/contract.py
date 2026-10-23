"""
Request and response shapes for POST /api/model/predict.

These mirror the Week 4 interface contract field for field. Where the contract and
the service disagreed, the Week 8 review recommended changing the service, not the
contract, and that is what happened here.

The envelope is deliberately explicit about one thing: whether the caller is sending
a payment or a prepared feature vector. The Week 4 contract calls these the raw path
and the processed path and insists the API say which it expects, because an API that
silently accepts either is an API where training/serving skew goes unnoticed. A
processed payload must declare the preprocessing version it was built with, and a
declaration that does not match the active model's binding is a 409, never a
best-effort score.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class PayloadType(str, Enum):
    """Which of the two doors the caller is coming through."""

    raw_transaction = "raw_transaction"
    processed_features = "processed_features"


class Classification(str, Enum):
    """The three outcomes. REVIEW is a PROPOSED EXTENSION beyond the assignment."""

    FRAUD = "FRAUD"
    REVIEW = "REVIEW"
    LEGITIMATE = "LEGITIMATE"


class PredictRequest(BaseModel):
    payload_type: PayloadType = Field(
        ..., description="Whether `transaction` or `features` carries the payload.")
    transaction_id: int = Field(..., gt=0, description="Caller's identifier, echoed back.")
    transaction_dt: int = Field(
        ..., ge=0,
        description="IEEE-CIS TransactionDT: seconds from the dataset reference point. "
                    "A timedelta, not a timestamp.")
    preprocessing_version: Optional[str] = Field(
        None, description="Required on the processed path. A mismatch is a 409.")
    model_version: Optional[str] = Field(
        None, description="Pin a model. Defaults to the active one.")
    return_explanation: bool = Field(
        False, description="Return TreeSHAP contributions. PROPOSED EXTENSION.")
    transaction: Optional[Dict[str, Any]] = Field(
        None, description="Raw payment, IEEE-CIS field names, text categories allowed.")
    features: Optional[Dict[str, float]] = Field(
        None, description="Prepared feature map matching preprocessing_version.")

    @model_validator(mode="after")
    def check_envelope(self):
        """Validation rules V2, V3 and the isFraud ban, checked before anything else."""
        # V2, V3: the payload must match the declared path, both ways round.
        if self.payload_type is PayloadType.raw_transaction:
            if self.transaction is None:
                raise ValueError("payload_type 'raw_transaction' requires `transaction`")
            if self.features is not None:
                raise ValueError("`features` must be absent on the raw path")
        else:
            if self.features is None:
                raise ValueError("payload_type 'processed_features' requires `features`")
            if self.transaction is not None:
                raise ValueError("`transaction` must be absent on the processed path")
            if not self.preprocessing_version:
                raise ValueError(
                    "payload_type 'processed_features' requires `preprocessing_version`")
        # The label must never arrive with the question. A client sending the answer
        # is a wiring error, and ignoring it quietly would hide it.
        body = self.transaction or self.features or {}
        if "isFraud" in body:
            raise ValueError(
                "`isFraud` is the label and must never appear in a request")
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "payload_type": "raw_transaction",
                "transaction_id": 2987000,
                "transaction_dt": 86400,
                "return_explanation": True,
                "transaction": {
                    "TransactionAmt": 68.5, "ProductCD": "W",
                    "card1": 13926, "card2": None, "card3": 150,
                    "card4": "discover", "card5": 142, "card6": "credit",
                    "addr1": 315, "addr2": 87, "dist1": 19, "dist2": None,
                    "P_emaildomain": "gmail.com", "R_emaildomain": None,
                    "C1": 1, "C2": 1, "C3": 0, "C4": 0, "C5": 0, "C6": 1,
                    "C7": 0, "C8": 0, "C9": 1, "C10": 0, "C11": 1, "C12": 0,
                    "C13": 1, "C14": 1, "D1": 14, "D2": None, "D3": 13
                },
            }
        }
    }


class DecisionBlock(BaseModel):
    threshold_config_id: int
    score_scale: str = Field(..., description="Which scale the threshold was chosen on.")
    calibration: str
    applies_to_model_version: str
    selection_method: str
    selected_on_split: str
    cost_false_negative: float
    cost_false_positive: float
    cost_assumption_note: str
    review_low: float
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None


class FiredRule(BaseModel):
    """One rule that fired, with the measurement that justifies it."""

    rule_id: int
    rule_name: str
    field: str
    operator: str
    threshold: Optional[float] = None
    risk_level: str
    version: int = 1
    observed_fraud_rate_pct: Optional[float] = None
    lift_over_base_rate: Optional[float] = None
    rule_source: Optional[str] = None


class RuleBlock(BaseModel):
    """What the rule engine did, including the case where it did nothing."""

    rules_evaluated: int
    rules_fired: List[FiredRule]
    highest_rule_risk: Optional[str] = None


class GroupContribution(BaseModel):
    group: str = Field(..., description="Documented feature group, not a single column.")
    contribution: float = Field(..., description="Summed TreeSHAP log-odds contribution.")
    direction: str


class Explanation(BaseModel):
    """TreeSHAP contributions, summed to the level Vesta documented."""

    method: str = "TreeSHAP, summed within documented feature groups"
    base_value: float
    groups: List[GroupContribution]
    note: str = (
        "Vesta deliberately masked the meaning of the individual C, D and V columns, "
        "so contributions are reported per documented group. Naming a real-world "
        "meaning for an individual masked column would be fabrication."
    )


class InputReport(BaseModel):
    """What the server did with each field, so the score can be accounted for."""

    fields_supplied: int
    fields_expected: int
    absent: List[str] = []
    unknown_category: List[str] = []
    imputed_median: List[str] = []
    note: str = (
        "An absent category is coded -1, which is what training meant by absent, and "
        "never the column's median code. An unrecognised category is coded -1 too and "
        "named here rather than rejected."
    )


class PredictResponse(BaseModel):
    request_id: str
    transaction_id: int
    fraud_probability: float = Field(..., ge=0.0, le=1.0)
    raw_score: float = Field(..., description="Before calibration, for traceability.")
    threshold: float
    classification: Classification
    decision: DecisionBlock
    rules: RuleBlock
    input_report: InputReport
    model_version: str
    preprocessing_version: str
    scored_at: str
    latency_ms: float
    stored: bool
    explanation: Optional[Explanation] = None


class ErrorDetail(BaseModel):
    """One thing wrong with the request, named by the field it is wrong in."""

    field: Optional[str] = None
    issue: str


class ErrorBody(BaseModel):
    """The error envelope every failure shares, as the contract specifies."""

    code: str
    message: str
    details: List[ErrorDetail] = []
    request_id: str


class ErrorResponse(BaseModel):
    """An error is always wrapped, so a client can tell it from a decision."""

    error: ErrorBody
