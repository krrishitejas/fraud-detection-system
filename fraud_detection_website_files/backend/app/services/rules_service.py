"""
The rule engine that runs beside the model.

A boosted tree cannot be argued with. A rule can: it is one readable condition over
one named field, with a measured hit rate attached, and an analyst who disagrees with
it can say so. The Week 4 architecture puts the two side by side deliberately -- the
model produces the score, the rules raise flags, and neither overrides the other.

Every rule carries rule_id, rule_name, threshold, risk_level and a rule source, which
is the versioning scheme the Week 5 coding standards set out. Rules are read from the
serving bundle, never written here, so changing one is a configuration change with a
version number rather than a code edit.

One rule in the table is switched off. RULE_VELOCITY_CARD24H was built, measured, and
found to fire on 39.9% of training rows at a lift of 1.04 -- which is to say it does
not separate fraud at all on this data. It stays in the table, inactive, with its
measurement attached, because a rule a reader can see was tried and rejected is worth
more than one that quietly disappeared.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

RISK_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


def _is_absent(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and np.isnan(value):
        return True
    return isinstance(value, str) and not value.strip()


class RuleEngine:
    """Evaluates the active rules against one payment."""

    def __init__(self, rules: List[Dict[str, Any]]):
        self.rules = list(rules)

    def _value(self, transaction: Dict[str, Any], field: str,
               derived: Dict[str, Any]) -> Any:
        if field in derived:
            return derived[field]
        return transaction.get(field)

    def _fires(self, rule: Dict[str, Any], value: Any) -> bool:
        op = rule["operator"]
        if op == "IS NULL":
            return _is_absent(value)
        if _is_absent(value):
            # A rule whose field is absent does not fire, unless absence is exactly
            # what it is looking for. Treating absence as zero would make every
            # "<=" rule fire on every incomplete payment.
            return False
        try:
            left = float(value)
        except (TypeError, ValueError):
            return False
        right = float(rule["threshold"])
        if op == ">=":
            return left >= right
        if op == "<=":
            return left <= right
        if op == "==":
            return left == right
        raise ValueError(f"rule {rule['rule_id']} uses unknown operator {op!r}")

    def evaluate(self, transaction: Dict[str, Any],
                 derived: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """The rules that fired, in the order the registry lists them."""
        derived = derived or {}
        fired = []
        for rule in self.rules:
            if self._fires(rule, self._value(transaction, rule["field"], derived)):
                fired.append({
                    "rule_id": rule["rule_id"],
                    "rule_name": rule["rule_name"],
                    "field": rule["field"],
                    "operator": rule["operator"],
                    "threshold": rule["threshold"],
                    "risk_level": rule["risk_level"],
                    "version": rule.get("version", 1),
                    "observed_fraud_rate_pct": rule.get("train_fraud_rate_pct"),
                    "lift_over_base_rate": rule.get("train_lift"),
                    "rule_source": rule.get("rule_source"),
                })
        return fired

    @staticmethod
    def highest_risk(fired: List[Dict[str, Any]]) -> Optional[str]:
        """The worst risk level among the rules that fired, or None if none did."""
        if not fired:
            return None
        return max(fired, key=lambda r: RISK_ORDER.get(r["risk_level"], 0))["risk_level"]


class RulesService:
    """Holds the engine over the active rules and answers questions about them."""

    _instance: Optional["RulesService"] = None

    def __init__(self, registry):
        self.registry = registry
        self.engine = RuleEngine(registry.rules)

    @classmethod
    def get_instance(cls) -> "RulesService":
        """The one rules service, built over the registry's active rules."""
        if cls._instance is None:
            from app.services.registry_service import ServingRegistry
            cls._instance = cls(ServingRegistry.get_instance())
        return cls._instance

    def evaluate(self, transaction: Dict[str, Any],
                 derived: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Run every active rule against one payment and summarise the result."""
        fired = self.engine.evaluate(transaction, derived)
        return {
            "rules_evaluated": len(self.engine.rules),
            "rules_fired": fired,
            "highest_rule_risk": RuleEngine.highest_risk(fired),
        }

    def catalogue(self) -> List[Dict[str, Any]]:
        """Every rule, active or not, with its measurement and its reason."""
        return self.registry.all_rules
