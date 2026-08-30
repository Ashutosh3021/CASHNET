"""Model 182 — Crypto / VASP / Cross-Border investigation.

Three heads:
  * illicit_clf  : genuinely supervised on the Elliptic AML labeled subset
                  (the only real fraud labels in this workstream).
  * vasp_clf     : weak-label head — predicts the exchange/jurisdiction to
                  route a legal request to, derived from vasp_responses
                  KYC/freeze outcomes (flagged as weak in metadata).
  * routing_clf  : cross-border routing head — INTERPOL vs MLAT vs domestic
                  freeze, learned from international_coordination fields.

predict() normalises any 182 case record to the canonical contract.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import precision_recall_fscore_support

import lib.io_utils as io
from lib.schema import empty_contract


def _case_features(rec: Dict[str, Any]) -> Dict[str, float]:
    tw = rec.get("target_wallets") or []
    intl = rec.get("international_coordination") or {}
    countries = intl.get("countries_involved") or []
    return {
        "num_wallets": float(len(tw)),
        "num_countries": float(len(countries)),
        "has_interpol": 1.0 if intl.get("interpol_case_id") else 0.0,
        "mlar_submitted": 1.0 if intl.get("mutual_legal_assistance_request") == "submitted" else 0.0,
        "priority_critical": 1.0 if any(w.get("priority") == "CRITICAL" for w in tw) else 0.0,
        "priority_high": 1.0 if any(w.get("priority") == "HIGH" for w in tw) else 0.0,
    }


class Model182:
    def __init__(self):
        self.illicit_clf = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000)),
        ])
        self.vasp_clf = DecisionTreeClassifier(max_depth=6, random_state=42)
        self.routing_clf = DecisionTreeClassifier(max_depth=5, random_state=42)
        self._vasp_classes: List[str] = []
        self._routing_classes: List[str] = []
        self.feature_cols: List[str] = [
            "num_wallets", "num_countries", "has_interpol",
            "mlar_submitted", "priority_critical", "priority_high",
        ]
        self.metrics: Dict[str, Any] = {}
        self.trained = False
        self.data_hash = ""

    # -- training ----------------------------------------------------------
    def fit(self) -> "Model182":
        cases = io.load_182_cases()
        self.data_hash = str(len(cases))

        # 1) Illicit-wallet detection (Elliptic, supervised)
        feat, classes, _ = io.load_elliptic(labeled_only=True)
        if len(feat) and len(classes):
            merged = feat.merge(classes, on="txId", how="inner")
            merged = merged[merged["class"].isin(["1", "2"])]
            y = (merged["class"] == "1").astype(int).values
            X = merged.drop(columns=["txId", "class"]).astype(float).values
            if len(np.unique(y)) > 1:
                self.illicit_clf.fit(X, y)
                pred = self.illicit_clf.predict(X)
                p, r, f, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
                self.metrics["illicit"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                           "n": int(len(y))}
        # 2) VASP-attribution weak labels (from vasp_responses)
        vasp_map: Dict[str, str] = {}
        for rec in cases.get("vasp_responses", []):
            vr = rec.get("vasp_responses", rec)
            cid = vr.get("sahyog_case_id")
            if cid:
                vasp_map[cid] = vr.get("vasp_name", "UNKNOWN")

        rows, targets = [], []
        for fam in ("cross_border_cases", "crypto_investigation_cases",
                    "ransomware_cases", "legal_requests"):
            for rec in cases.get(fam, []):
                cid = rec.get("sahyog_case_id")
                if cid in vasp_map:
                    f = _case_features(rec)
                    rows.append(f)
                    targets.append(vasp_map[cid])
        if len(rows) >= 5 and len(set(targets)) > 1:
            X = pd.DataFrame(rows)[self.feature_cols].fillna(0.0)
            self.vasp_clf.fit(X.values, targets)
            self._vasp_classes = list(self.vasp_clf.classes_)
            pred = self.vasp_clf.predict(X.values)
            p, r, f, _ = precision_recall_fscore_support(targets, pred, average="macro", zero_division=0)
            self.metrics["vasp_weak"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                         "n": int(len(targets)), "note": "weak-label from vasp_responses"}
        # 3) Cross-border routing
        rrows, rtargets = [], []
        for rec in cases.get("cross_border_cases", []):
            intl = rec.get("international_coordination") or {}
            if intl.get("interpol_case_id"):
                action = "INTERPOL"
            elif intl.get("mutual_legal_assistance_request") == "submitted":
                action = "MLAT"
            else:
                action = "DOMESTIC_FREEZE"
            rrows.append(_case_features(rec))
            rtargets.append(action)
        if len(rrows) >= 5 and len(set(rtargets)) > 1:
            X = pd.DataFrame(rrows)[self.feature_cols].fillna(0.0)
            self.routing_clf.fit(X.values, rtargets)
            self._routing_classes = list(self.routing_clf.classes_)
            pred = self.routing_clf.predict(X.values)
            p, r, f, _ = precision_recall_fscore_support(rtargets, pred, average="macro", zero_division=0)
            self.metrics["routing"] = {"precision": float(p), "recall": float(r), "f1": float(f),
                                       "n": int(len(rtargets))}
        self.trained = True
        return self

    # -- inference ----------------------------------------------------------
    def predict(self, record: Dict[str, Any], threshold: float = 0.7) -> Dict[str, Any]:
        f = _case_features(record)
        X = pd.DataFrame([f])[self.feature_cols].fillna(0.0).values

        attributed_vasp, vasp_conf = "UNKNOWN", 0.5
        if len(self._vasp_classes) > 1:
            proba = self.vasp_clf.predict_proba(X)[0]
            idx = int(np.argmax(proba))
            attributed_vasp = self._vasp_classes[idx]
            vasp_conf = float(proba[idx])

        action, route_conf = "DOMESTIC_FREEZE", 0.5
        if len(self._routing_classes) > 1:
            proba = self.routing_clf.predict_proba(X)[0]
            idx = int(np.argmax(proba))
            action = self._routing_classes[idx]
            route_conf = float(proba[idx])

        priority = max(f["priority_critical"], f["priority_high"])
        risk_score = float(min(1.0, 0.4 * priority + 0.3 * vasp_conf + 0.3 * route_conf))
        confidence = float(min(vasp_conf, route_conf))
        needs_review = confidence < threshold

        payload = empty_contract(confidence=confidence, needs_review=needs_review)
        payload["risk_object"] = {
            "risk_score": risk_score,
            "risk_label": "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low",
            "entities": [
                {"type": "wallet", "id": w.get("wallet_address"),
                 "blockchain": w.get("blockchain"), "priority": w.get("priority")}
                for w in (record.get("target_wallets") or [])
            ],
        }
        payload["dashboard"] = {
            "title": "Model 182 — Crypto / VASP / Cross-border",
            "metrics": {
                "num_target_wallets": f["num_wallets"],
                "num_countries": f["num_countries"],
                "attributed_vasp": attributed_vasp,
                "routing_action": action,
            },
        }
        payload["routing_action_list"] = [
            {"action": "VASP_ATTRIBUTION", "target": attributed_vasp,
             "priority": "CRITICAL" if priority else "HIGH", "confidence": vasp_conf},
            {"action": action, "target": "INTERPOL" if action == "INTERPOL" else "Jurisdiction",
             "confidence": route_conf},
        ]
        payload["metadata"] = {"model": "182", "weak_label": True,
                               "attributed_vasp": attributed_vasp}
        return payload

    # -- illicit head direct API ------------------------------------------
    def predict_illicit(self, X: np.ndarray) -> np.ndarray:
        return self.illicit_clf.predict(X)
