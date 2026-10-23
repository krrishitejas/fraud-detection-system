"""
Writing each decision down.

The Week 4 database design has a prediction table and an audit_event table, and the
Week 8 review found the service storing neither: it scored a payment, answered, and
forgot. A fraud decision that cannot be retrieved afterwards cannot be appealed,
cannot be used to measure the model in production, and cannot be shown to anyone
asking why a particular payment was held.

SQLite, because the point is to demonstrate the contract honestly on one machine. The
schema mirrors the Week 4 tables and the column names match, so moving to PostgreSQL
or MySQL is a connection change rather than a redesign.

What is stored and what is not: the prepared feature values are kept because they are
what the model actually saw, and without them a prediction cannot be reproduced. The
raw request is not kept. The Week 4 design says not to hold unnecessary raw
transaction data in a proposed production schema, and nothing here needs it.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS prediction (
    prediction_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id            TEXT    NOT NULL UNIQUE,
    scored_at             TEXT    NOT NULL,
    model_version         TEXT    NOT NULL,
    preprocessing_version TEXT    NOT NULL,
    threshold_config_id   INTEGER NOT NULL,
    threshold_value       REAL    NOT NULL,
    score_scale           TEXT    NOT NULL,
    fraud_probability     REAL    NOT NULL,
    raw_score             REAL    NOT NULL,
    decision              TEXT    NOT NULL,
    risk_band             TEXT    NOT NULL,
    highest_rule_risk     TEXT,
    rules_fired           TEXT    NOT NULL,
    feature_values        TEXT    NOT NULL,
    field_provenance      TEXT    NOT NULL,
    latency_ms            REAL    NOT NULL,
    CHECK (fraud_probability >= 0.0 AND fraud_probability <= 1.0),
    CHECK (decision IN ('fraud', 'legitimate'))
);
CREATE INDEX IF NOT EXISTS idx_prediction_scored_at ON prediction (scored_at);
CREATE INDEX IF NOT EXISTS idx_prediction_decision  ON prediction (decision);

CREATE TABLE IF NOT EXISTS audit_event (
    audit_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at    TEXT NOT NULL,
    event_type     TEXT NOT NULL,
    request_id     TEXT,
    detail         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_event (occurred_at);
"""


def utcnow() -> str:
    """An RFC 3339 timestamp in UTC, which is what the contract specifies."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class StoreService:
    """The prediction and audit_event tables, and the only writer to them."""

    _instance: Optional["StoreService"] = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self.enabled = bool(settings.PERSIST_PREDICTIONS)
        self.path: Path = settings.prediction_store_path
        self._conn: Optional[sqlite3.Connection] = None
        self._write_lock = threading.Lock()
        if self.enabled:
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
                self._conn.row_factory = sqlite3.Row
                self._conn.executescript(SCHEMA)
                self._conn.commit()
                logger.info("Prediction store ready at %s", self.path)
            except Exception as exc:                              # noqa: BLE001
                logger.error("Prediction store unavailable: %s", exc)
                self.enabled = False

    @classmethod
    def get_instance(cls) -> "StoreService":
        """The one store, opened once at startup."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # Storage must never be the reason a payment cannot be scored. Every write is
    # best-effort and logged on failure; the caller still gets its answer.
    def record_prediction(self, row: Dict[str, Any]) -> None:
        """Write one decision down. Never raises: see the note above."""
        if not self.enabled or self._conn is None:
            return
        try:
            with self._write_lock:
                self._conn.execute(
                    """INSERT OR REPLACE INTO prediction (
                        request_id, scored_at, model_version, preprocessing_version,
                        threshold_config_id, threshold_value, score_scale,
                        fraud_probability, raw_score, decision, risk_band,
                        highest_rule_risk, rules_fired, feature_values,
                        field_provenance, latency_ms)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (row["request_id"], row["scored_at"], row["model_version"],
                     row["preprocessing_version"], row["threshold_config_id"],
                     row["threshold_value"], row["score_scale"],
                     row["fraud_probability"], row["raw_score"], row["decision"],
                     row["risk_band"], row.get("highest_rule_risk"),
                     json.dumps(row.get("rules_fired", [])),
                     json.dumps(row.get("feature_values", {})),
                     json.dumps(row.get("field_provenance", {})),
                     row["latency_ms"]))
                self._conn.commit()
        except Exception as exc:                                  # noqa: BLE001
            logger.error("Could not store prediction %s: %s",
                         row.get("request_id"), exc)

    def record_event(self, event_type: str, detail: Dict[str, Any],
                     request_id: Optional[str] = None) -> None:
        """Record something that happened which was not itself a prediction."""
        if not self.enabled or self._conn is None:
            return
        try:
            with self._write_lock:
                self._conn.execute(
                    "INSERT INTO audit_event (occurred_at, event_type, request_id, detail)"
                    " VALUES (?,?,?,?)",
                    (utcnow(), event_type, request_id, json.dumps(detail)))
                self._conn.commit()
        except Exception as exc:                                  # noqa: BLE001
            logger.error("Could not store audit event %s: %s", event_type, exc)

    def recent_predictions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """The most recent decisions, newest first, capped at 500."""
        if not self.enabled or self._conn is None:
            return []
        cur = self._conn.execute(
            "SELECT * FROM prediction ORDER BY prediction_id DESC LIMIT ?",
            (max(1, min(int(limit), 500)),))
        out = []
        for r in cur.fetchall():
            d = dict(r)
            for k in ("rules_fired", "feature_values", "field_provenance"):
                d[k] = json.loads(d[k])
            out.append(d)
        return out

    def summary(self) -> Dict[str, Any]:
        """Counts and averages over everything stored, for the governance page."""
        if not self.enabled or self._conn is None:
            return {"enabled": False, "stored_predictions": 0}
        row = self._conn.execute(
            "SELECT COUNT(*) n,"
            " SUM(CASE WHEN decision='fraud' THEN 1 ELSE 0 END) f,"
            " AVG(fraud_probability) p, AVG(latency_ms) l,"
            " MIN(scored_at) a, MAX(scored_at) b FROM prediction").fetchone()
        n = int(row["n"] or 0)
        return {
            "enabled": True,
            "database": self.path.name,
            "stored_predictions": n,
            "flagged": int(row["f"] or 0),
            "flagged_rate_pct": round((row["f"] or 0) / n * 100, 3) if n else 0.0,
            "mean_fraud_probability": round(float(row["p"]), 6) if n else None,
            "mean_latency_ms": round(float(row["l"]), 3) if n else None,
            "first_scored_at": row["a"],
            "last_scored_at": row["b"],
        }
