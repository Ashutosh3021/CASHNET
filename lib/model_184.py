"""Model 184 — Banking / ATM / Geospatial (predictive withdrawal intelligence).

Two heads:
  * risk_clf   : supervised on 184's own synthetic `is_suspicious` flag from
                 bank_transactions (transaction-graph + amount + route features).
  * city_clf   : predicted withdrawal-city head, supervised on the
                 atm_withdrawal_links (scenario -> ATM -> city) join. The
                 external `synthetic_financial_fraud` corpus is empty in this
                 checkout, so 184's own labeled synthetic links are the signal
                 (data.md §3.3 gap), augmented by live OSM ATM counts.

predict() normalises a bank-transaction record to the canonical contract.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_fscore_support
from sklearn.tree import DecisionTreeClassifier

import lib.io_utils as io
from lib.schema import empty_contract

CITY_MAP = {
    "DEL": "Delhi", "MUM": "Mumbai", "BLR": "Bengaluru",
    "AHM": "Ahmedabad", "HYD": "Hyderabad", "GUR": "Gurugram",
}


def _atm_city(atm_id: str) -> Optional[str]:
    if not atm_id or "-" not in atm_id:
        return None
    code = atm_id.split("-")[1]
    return CITY_MAP.get(code)


def _tx_features(tx: Dict[str, Any]) -> Dict[str, Any]:
    b = tx.get("bank_transaction_data", {}) or {}
    amt = b.get("transaction_amount", 0) or 0
    src = (b.get("source_account", {}) or {}).get("city", "")
    dst = (b.get("destination_account", {}) or {}).get("city", "")
    return {
        "amount": float(np.log1p(amt)),
        "transaction_type": str(b.get("transaction_type", "")),
        "src_city": str(src),
        "dst_city": str(dst),
    }


def _vectorize(rows: List[Dict[str, Any]], cols: Optional[List[str]] = None) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    cat = ["transaction_type", "src_city", "dst_city"]
    X = pd.get_dummies(df, columns=cat)
    if cols is not None:
        for c in cols:
            if c not in X.columns:
                X[c] = 0
        X = X[cols]
    return X


class Model184:
    def __init__(self):
        self.risk_clf = DecisionTreeClassifier(max_depth=8, random_state=42,
                                                class_weight="balanced")
        self.city_clf = DecisionTreeClassifier(max_depth=6, random_state=42)
        self._risk_cols: List[str] = []
        self._city_cols: List[str] = []
        self._city_classes: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self.trained = False
        self.atm_counts: Dict[str, int] = {}

    def fit(self) -> "Model184":
        syn = io.load_184_synthetic()
        txns = (syn.get("bank_transactions") or {}).get("transactions", [])
        links = (syn.get("atm_withdrawal_links") or {}).get("links", [])

        # geospatial enrichment — live OSM ATM counts per city
        osm = io.load_184_external_osm()
        for city_file, content in osm.items():
            atms = content.get("atms") if isinstance(content, dict) else None
            if isinstance(atms, list):
                self.atm_counts[city_file.replace("atm_", "")] = len(atms)

        if not txns:
            self.trained = True
            return self

        feats = [_tx_features(t) for t in txns]
        y_risk = [1 if (t.get("scenario_metadata", {}) or {}).get("is_suspicious") else 0
                  for t in txns]
        X = _vectorize(feats)
        self._risk_cols = list(X.columns)
        if len(set(y_risk)) > 1:
            self.risk_clf.fit(X.values, y_risk)
            pred = self.risk_clf.predict(X.values)
            p, r, f, _ = precision_recall_fscore_support(y_risk, pred, average="binary", zero_division=0)
            self.metrics["risk"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                    "n": int(len(y_risk))}

        # withdrawal-city head — join scenario_id -> atm -> city
        scen2city: Dict[str, str] = {}
        for link in links:
            c = _atm_city(link.get("atm_id", ""))
            if c:
                scen2city[link.get("scenario_id")] = c
        city_rows, city_y = [], []
        for t in txns:
            sm = t.get("scenario_metadata", {}) or {}
            sid = sm.get("scenario_id")
            if sid in scen2city:
                city_rows.append(_tx_features(t))
                city_y.append(scen2city[sid])
        if len(city_rows) >= 5 and len(set(city_y)) > 1:
            Xc = _vectorize(city_rows)
            self._city_cols = list(Xc.columns)
            self.city_clf.fit(Xc.values, city_y)
            self._city_classes = list(self.city_clf.classes_)
            pred = self.city_clf.predict(Xc.values)
            p, r, f, _ = precision_recall_fscore_support(city_y, pred, average="macro", zero_division=0)
            # hit-rate@k — top-1 substituted (small labeled set)
            top1 = float(np.mean(np.array(city_y) == pred))
            self.metrics["withdrawal_city"] = {"precision": float(p), "recall": float(r),
                                               "f1": float(f), "hit_rate@1": top1,
                                               "n": int(len(city_y)),
                                               "note": "hit-rate@k; top-1 reported"}
        self.trained = True
        return self

    def predict(self, record: Dict[str, Any], threshold: float = 0.7) -> Dict[str, Any]:
        f = _tx_features(record)
        Xr = _vectorize([f], self._risk_cols if self._risk_cols else None)
        Xc = _vectorize([f], self._city_cols if self._city_cols else None)

        is_susp = False
        risk_conf = 0.5
        if self._risk_cols:
            proba = self.risk_clf.predict_proba(Xr.values)[0]
            is_susp = bool(np.argmax(proba))
            risk_conf = float(proba[int(is_susp)])

        pred_city = "unknown"
        city_conf = 0.5
        if self._city_classes:
            proba = self.city_clf.predict_proba(Xc.values)[0]
            idx = int(np.argmax(proba))
            pred_city = self._city_classes[idx]
            city_conf = float(proba[idx])

        risk_score = float(risk_conf) if is_susp else float(0.3 * risk_conf)
        confidence = float(min(risk_conf, city_conf))
        needs_review = confidence < threshold

        payload = empty_contract(confidence=confidence, needs_review=needs_review)
        payload["risk_object"] = {
            "risk_score": risk_score,
            "risk_label": "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low",
            "entities": [{"type": "account",
                          "id": (record.get("bank_transaction_data", {}) or {})
                                   .get("source_account", {}).get("account_number")}],
        }
        payload["dashboard"] = {
            "title": "Model 184 — Banking / ATM / Geospatial",
            "metrics": {
                "is_suspicious": is_susp,
                "predicted_withdrawal_city": pred_city,
                "atms_in_city": self.atm_counts.get(pred_city.lower(), 0),
            },
        }
        actions = []
        if is_susp:
            actions.append({"action": "FREEZE_ACCOUNTS", "target": "source", "priority": "URGENT",
                            "confidence": risk_conf})
        if pred_city != "unknown":
            actions.append({"action": "DEPLOY_TO_CITY", "target": pred_city,
                            "priority": "HIGH", "confidence": city_conf})
        payload["routing_action_list"] = actions
        payload["metadata"] = {"model": "184", "predicted_withdrawal_city": pred_city}
        return payload
