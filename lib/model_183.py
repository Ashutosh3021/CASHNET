"""Model 183 — Complaints / Support / Transactions.

Multi-head model:
  * intent_clf  : supervised on Banking77 (77 intents) over TF-IDF text.
  * product_clf : supervised on CFPB product classification (narrative text).
  * risk_clf    : supervised on the creditcard fraud `Class` (PCA features).

183's own JSON complaints are synthetic/LLM-generated (data.md §2.3) — they are
used only as augmentation/domain text, never as the primary label source.
predict() normalises a complaint record to the canonical contract.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_fscore_support
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import lib.io_utils as io
from lib.schema import empty_contract


def _complaint_text(rec: Dict[str, Any]) -> str:
    parts: List[str] = []
    if isinstance(rec, dict):
        fd = rec.get("fraud_details") or {}
        parts.append(str(fd.get("type", "")))
        parts.append(str(fd.get("sub_type", "")))
        parts.append(str(fd.get("description", "")))
        parts.append(str(fd.get("platform_used", "")))
        victim = rec.get("victim_details") or {}
        parts.append(str(victim.get("city", "")))
    return " ".join(p for p in parts if p)


class Model183:
    def __init__(self):
        self.intent = Pipeline([("tfidf", TfidfVectorizer(max_features=20000, ngram_range=(1, 2))),
                                ("scale", StandardScaler(with_mean=False)),
                                ("clf", LogisticRegression(max_iter=1000))])
        self.product = Pipeline([("tfidf", TfidfVectorizer(max_features=20000, ngram_range=(1, 2))),
                                 ("scale", StandardScaler(with_mean=False)),
                                 ("clf", LogisticRegression(max_iter=1000))])
        self.risk_clf = Pipeline([("scale", StandardScaler()),
                                  ("clf", LogisticRegression(max_iter=1000))])
        self.risk_cols: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self.trained = False

    def fit(self) -> "Model183":
        # intent head — Banking77
        texts, labels = io.load_banking77()
        if texts:
            self.intent.fit(texts, labels)
            pred = self.intent.predict(texts)
            p, r, f, _ = precision_recall_fscore_support(labels, pred, average="macro", zero_division=0)
            self.metrics["intent"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                      "n": int(len(labels)), "classes": int(len(set(labels)))}

        # product head — CFPB (sampled; the file is ~9 GB)
        cfpb = io.load_cfpb_sample(n=100_000)
        if len(cfpb):
            txt = cfpb["Consumer complaint narrative"].fillna("").astype(str)
            y = cfpb["Product"].astype(str)
            self.product.fit(txt, y)
            pred = self.product.predict(txt)
            p, r, f, _ = precision_recall_fscore_support(y, pred, average="macro", zero_division=0)
            self.metrics["product"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                       "n": int(len(y)), "classes": int(y.nunique())}

        # risk/alert head — creditcard fraud
        X, y = io.load_creditcard()
        if len(X):
            self.risk_cols = list(X.columns)
            self.risk_clf.fit(X.values, y.values)
            pred = self.risk_clf.predict(X.values)
            p, r, f, _ = precision_recall_fscore_support(y.values, pred, average="binary", zero_division=0)
            self.metrics["risk"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                    "n": int(len(y))}
        self.trained = True
        return self

    def predict(self, record: Dict[str, Any], threshold: float = 0.7) -> Dict[str, Any]:
        text = _complaint_text(record)
        intent = str(self.intent.predict([text])[0]) if self.metrics.get("intent") else "unknown"
        intent_conf = float(np.max(self.intent.predict_proba([text])[0])) if self.metrics.get("intent") else 0.5
        product = str(self.product.predict([text])[0]) if self.metrics.get("product") else "unknown"
        prod_conf = float(np.max(self.product.predict_proba([text])[0])) if self.metrics.get("product") else 0.5

        # risk heuristic from complaint severity flags when no PCA features present
        fd = (record.get("fraud_details") or {}) if isinstance(record, dict) else {}
        severity = 1.0 if fd.get("type") in ("investment_scam", "sextortion", "ransomware") else 0.5
        risk_score = float(min(1.0, 0.5 * severity + 0.3 * intent_conf))
        confidence = float(min(intent_conf, prod_conf))
        needs_review = confidence < threshold

        payload = empty_contract(confidence=confidence, needs_review=needs_review)
        payload["risk_object"] = {
            "risk_score": risk_score,
            "risk_label": "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low",
            "entities": [{"type": "complaint",
                          "id": record.get("complaint_id") if isinstance(record, dict) else None}],
        }
        payload["dashboard"] = {
            "title": "Model 183 — Complaints / Support / Transactions",
            "metrics": {"intent": intent, "product": product, "severity": severity},
        }
        actions = [
            {"action": "CLASSIFY_COMPLAINT", "target": intent, "confidence": intent_conf},
            {"action": "ROUTE_TO_QUEUE", "target": product, "confidence": prod_conf},
        ]
        if risk_score >= threshold:
            actions.append({"action": "GENERATE_ALERT", "target": "investigator",
                            "priority": "HIGH", "confidence": risk_score})
        payload["routing_action_list"] = actions
        payload["metadata"] = {"model": "183", "intent": intent, "product": product}
        return payload

    def predict_risk(self, X: np.ndarray) -> np.ndarray:
        return self.risk_clf.predict(X)
