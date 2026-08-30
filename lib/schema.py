"""Canonical output contract shared by models 182 / 183 / 184.

Every model's prediction is normalised to this shape before being written to
its <model_id>/OUT folder, and the consolidated `pipeline.ipynb` merges the
three payloads into a single dashboard/alert feed.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parent.parent

CONTRACT_KEYS = (
    "risk_object",
    "dashboard",
    "routing_action_list",
    "confidence",
    "needs_review",
)

OPTIONAL_KEYS = ("metadata",)


def empty_contract(confidence: float = 0.0, needs_review: bool = True) -> Dict[str, Any]:
    return {
        "risk_object": {
            "risk_score": 0.0,
            "risk_label": "unknown",
            "entities": [],
        },
        "dashboard": {
            "title": "CASHNET risk summary",
            "metrics": {},
        },
        "routing_action_list": [],
        "confidence": confidence,
        "needs_review": needs_review,
    }


def validate(payload: Dict[str, Any]) -> None:
    """Raise ValueError if *payload* does not satisfy the contract."""
    if not isinstance(payload, dict):
        raise ValueError("payload must be a dict")
    missing = [k for k in CONTRACT_KEYS if k not in payload]
    if missing:
        raise ValueError(f"payload missing required keys: {missing}")
    if not isinstance(payload["confidence"], (int, float, float)):
        raise ValueError("confidence must be numeric")
    if not isinstance(payload["needs_review"], bool):
        raise ValueError("needs_review must be a bool")
    if not isinstance(payload["routing_action_list"], list):
        raise ValueError("routing_action_list must be a list")


def is_valid(payload: Dict[str, Any]) -> bool:
    try:
        validate(payload)
        return True
    except Exception:
        return False


def example_payload() -> Dict[str, Any]:
    """A sample contract payload mirroring the hand-authored OUT examples."""
    return {
        "risk_object": {
            "risk_score": 0.89,
            "risk_label": "high",
            "entities": [
                {"type": "wallet", "id": "0xABC...", "attributed_vasp": "Binance"},
            ],
        },
        "dashboard": {
            "title": "CASHNET consolidated risk",
            "metrics": {"illicit_prob": 0.89, "cases": 1},
        },
        "routing_action_list": [
            {"action": "FREEZE_REQUEST", "target": "Binance", "priority": "CRITICAL"},
        ],
        "confidence": 0.89,
        "needs_review": False,
        "metadata": {"model": "example", "version": 1},
    }


if __name__ == "__main__":
    validate(example_payload())
    print("schema OK; contract keys:", CONTRACT_KEYS)
