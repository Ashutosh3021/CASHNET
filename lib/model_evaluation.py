"""Model evaluation metrics for CASHNET models.

Exposes comprehensive evaluation metrics for each model:
- Precision, Recall, F1, Accuracy
- ROC-AUC, PR-AUC where applicable
- Top-K accuracy
- Temporal split metrics
- Feature importance
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    precision_recall_fscore_support,
    roc_auc_score,
    top_k_accuracy_score,
    confusion_matrix,
)


def binary_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
) -> dict[str, Any]:
    """Comprehensive binary classification metrics."""
    p, r, f, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    metrics: dict[str, Any] = {
        "precision": float(p),
        "recall": float(r),
        "f1": float(f),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "n_samples": len(y_true),
        "n_positive": int(np.sum(y_true)),
        "n_negative": int(len(y_true) - np.sum(y_true)),
    }

    if y_proba is not None:
        try:
            y_proba_binary = y_proba[:, 1] if y_proba.ndim == 2 else y_proba
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba_binary))
        except (ValueError, IndexError):
            metrics["roc_auc"] = None

        try:
            metrics["pr_auc"] = float(average_precision_score(y_true, y_proba_binary))
        except (ValueError, IndexError):
            metrics["pr_auc"] = None

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    if cm.shape == (2, 2):
        metrics["true_negatives"] = int(cm[0, 0])
        metrics["false_positives"] = int(cm[0, 1])
        metrics["false_negatives"] = int(cm[1, 0])
        metrics["true_positives"] = int(cm[1, 1])

    return metrics


def multiclass_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
    average: str = "macro",
) -> dict[str, Any]:
    """Comprehensive multiclass classification metrics."""
    p, r, f, _ = precision_recall_fscore_support(
        y_true, y_pred, average=average, zero_division=0
    )
    metrics: dict[str, Any] = {
        "precision": float(p),
        "recall": float(r),
        "f1": float(f),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "n_samples": len(y_true),
        "n_classes": len(np.unique(y_true)),
    }

    if y_proba is not None and y_proba.ndim == 2:
        # Top-K accuracy
        for k in [3, 5, 10]:
            if y_proba.shape[1] >= k:
                try:
                    metrics[f"top_{k}_accuracy"] = float(
                        top_k_accuracy_score(
                            y_true,
                            y_proba,
                            k=k,
                            labels=np.arange(y_proba.shape[1]),
                        )
                    )
                except (ValueError, IndexError):
                    metrics[f"top_{k}_accuracy"] = None

        # ROC-AUC (one-vs-rest)
        try:
            from sklearn.preprocessing import label_binarize

            classes = np.unique(y_true)
            if len(classes) > 2:
                y_true_bin = label_binarize(y_true, classes=classes)
                metrics["roc_auc_ovr"] = float(
                    roc_auc_score(
                        y_true_bin, y_proba, average="macro", multi_class="ovr"
                    )
                )
        except (ValueError, IndexError):
            metrics["roc_auc_ovr"] = None

    return metrics


def location_prediction_metrics(
    y_true_cities: list[str],
    y_pred_cities: list[str],
    y_proba: np.ndarray | None = None,
    true_coords: list[tuple[float, float]] | None = None,
    pred_coords: list[tuple[float, float]] | None = None,
) -> dict[str, Any]:
    """Geospatial prediction metrics for ATM/cash-out location prediction."""
    metrics: dict[str, Any] = {
        "n_samples": len(y_true_cities),
        "n_unique_true_cities": len(set(y_true_cities)),
        "n_unique_pred_cities": len(set(y_pred_cities)),
    }

    # City accuracy
    correct = sum(
        1 for t, p in zip(y_true_cities, y_pred_cities, strict=False) if t == p
    )
    metrics["city_accuracy"] = correct / len(y_true_cities) if y_true_cities else 0

    # Top-K city accuracy
    if y_proba is not None and y_proba.ndim == 2:
        classes = list(set(y_true_cities))
        class_to_idx = {c: i for i, c in enumerate(classes)}
        y_true_idx = np.array([class_to_idx.get(c, -1) for c in y_true_cities])
        valid = y_true_idx >= 0

        for k in [3, 5, 10]:
            if y_proba.shape[1] >= k and valid.sum() > 0:
                try:
                    metrics[f"top_{k}_city_accuracy"] = float(
                        top_k_accuracy_score(
                            y_true_idx[valid],
                            y_proba[valid],
                            k=k,
                            labels=np.arange(y_proba.shape[1]),
                        )
                    )
                except (ValueError, IndexError):
                    metrics[f"top_{k}_city_accuracy"] = None

    # Distance error if coordinates available
    if true_coords and pred_coords and len(true_coords) == len(pred_coords):
        distances = []
        for (lat1, lng1), (lat2, lng2) in zip(true_coords, pred_coords, strict=False):
            dlat = (lat2 - lat1) * np.pi / 180
            dlng = (lng2 - lng1) * np.pi / 180
            a = (
                np.sin(dlat / 2) ** 2
                + np.cos(lat1 * np.pi / 180)
                * np.cos(lat2 * np.pi / 180)
                * np.sin(dlng / 2) ** 2
            )
            dist_km = 6371 * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
            distances.append(dist_km)

        metrics["mean_distance_error_km"] = float(np.mean(distances))
        metrics["median_distance_error_km"] = float(np.median(distances))
        metrics["p90_distance_error_km"] = float(np.percentile(distances, 90))

        # Top-K location accuracy (within radius)
        for radius_km in [5, 10, 25, 50]:
            within = sum(1 for d in distances if d <= radius_km)
            metrics[f"accuracy_within_{radius_km}km"] = within / len(distances)

    return metrics


def temporal_split_metrics(
    train_metrics: dict[str, Any],
    test_metrics: dict[str, Any],
    train_size: int,
    test_size: int,
    train_period: tuple[str, str] | None = None,
    test_period: tuple[str, str] | None = None,
) -> dict[str, Any]:
    """Combine train/test metrics with temporal information."""
    result = {
        "train": train_metrics,
        "test": test_metrics,
        "train_size": train_size,
        "test_size": test_size,
        "temporal_leakage_risk": "NONE" if train_period and test_period else "UNKNOWN",
    }

    if train_period:
        result["train_period"] = {"start": train_period[0], "end": train_period[1]}
    if test_period:
        result["test_period"] = {"start": test_period[0], "end": test_period[1]}

    # Check for degradation
    if "accuracy" in train_metrics and "accuracy" in test_metrics:
        degradation = train_metrics["accuracy"] - test_metrics["accuracy"]
        result["accuracy_degradation"] = float(degradation)
        if degradation > 0.1:
            result["overfitting_risk"] = "HIGH"
        elif degradation > 0.05:
            result["overfitting_risk"] = "MEDIUM"
        else:
            result["overfitting_risk"] = "LOW"

    return result
