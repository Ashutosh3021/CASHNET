"""Reproducible ML pipeline for CASHNET models.

Each model must have:
- feature schema
- preprocessing pipeline
- training script
- evaluation script
- saved model artifact
- model version
- metrics
- inference function
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"

MODEL_REGISTRY: dict[str, dict[str, Any]] = {}


def register_model(
    model_id: str,
    name: str,
    version: str,
    description: str,
    feature_schema: list[dict[str, Any]],
    metrics: dict[str, Any] | None = None,
):
    """Register a model in the global registry."""
    MODEL_REGISTRY[model_id] = {
        "model_id": model_id,
        "name": name,
        "version": version,
        "description": description,
        "feature_schema": feature_schema,
        "metrics": metrics or {},
        "registered_at": datetime.now(UTC).isoformat(),
    }


def get_model_info(model_id: str) -> dict[str, Any] | None:
    """Get registered model info."""
    return MODEL_REGISTRY.get(model_id)


def get_all_models() -> dict[str, dict[str, Any]]:
    """Get all registered models."""
    return dict(MODEL_REGISTRY)


def save_model_artifact(
    model: Any,
    model_id: str,
    version: str,
    metrics: dict[str, Any],
    feature_schema: list[dict[str, Any]],
    metadata: dict[str, Any] | None = None,
) -> Path:
    """Save a model with full metadata."""
    import pickle

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    artifact = {
        "model_id": model_id,
        "version": version,
        "created_at": datetime.now(UTC).isoformat(),
        "metrics": metrics,
        "feature_schema": feature_schema,
        "metadata": metadata or {},
        "model": model,
    }

    path = MODELS_DIR / f"{model_id}_model_v{version.replace('.', '_')}.pkl"
    with open(path, "wb") as f:
        pickle.dump(artifact, f)

    logger.info(f"Saved model artifact: {path}")
    return path


def load_model_artifact(model_id: str, version: str | None = None) -> dict[str, Any] | None:
    """Load a model artifact by ID and optional version."""
    import pickle

    if version:
        path = MODELS_DIR / f"{model_id}_model_v{version.replace('.', '_')}.pkl"
        if path.exists():
            with open(path, "rb") as f:
                return pickle.load(f)

    # Load latest version
    pattern = f"{model_id}_model_v*.pkl"
    candidates = sorted(MODELS_DIR.glob(pattern))
    if candidates:
        with open(candidates[-1], "rb") as f:
            return pickle.load(f)

    # Fall back to old format
    old_path = MODELS_DIR / f"{model_id}_model.pkl"
    if old_path.exists():
        with open(old_path, "rb") as f:
            return pickle.load(f)

    return None


def temporal_train_test_split(
    timestamps: list[str],
    test_ratio: float = 0.2,
) -> tuple[list[int], list[int]]:
    """Chronologically split data to prevent temporal leakage.

    Returns (train_indices, test_indices).
    """
    sorted_indices = sorted(range(len(timestamps)), key=lambda i: timestamps[i])
    split_point = int(len(sorted_indices) * (1 - test_ratio))
    train_indices = sorted_indices[:split_point]
    test_indices = sorted_indices[split_point:]
    return train_indices, test_indices
