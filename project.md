# CASHNET — Comprehensive Project Documentation

> **C**omputer **A**ided **S**uspicious **H**awala **Net**work Detection Platform
> An end-to-end fraud investigation system combining ML prediction, geospatial intelligence, blockchain analysis, and law-enforcement integration.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Complete Project Flow](#3-complete-project-flow)
4. [Model Implementation & Reliability](#4-model-implementation--reliability)
5. [Data Flow](#5-data-flow)
6. [Security Implementation](#6-security-implementation)
7. [Deployment](#7-deployment)

---

## 1. System Overview

CASHNET is a monorepo containing three primary services and a shared Python library:

| Service | Stack | Port | Role |
|---------|-------|------|------|
| **Frontend** | React 19 + Vite + TailwindCSS | 80 | Investigation dashboard, maps, alerts |
| **API Server** | Express.js 5 (TypeScript) | 3000 | Route handling, synthetic data, orchestration |
| **Model Server** | Flask (Python) | 5000 | ML inference (Models 182, 183, 184) |
| **Python API** | FastAPI | — | Service layer (blockchain, ML, integrations) |

All data in the demo environment is **synthetic** and explicitly marked with `dataSource: "SYNTHETIC"`.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React 19)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Dashboard │ │Cases &   │ │Geospatial│ │Fund Flow │ │Corridor      │ │
│  │          │ │Predictive│ │Heatmap   │ │Graph     │ │Prediction    │ │
│  │          │ │Engine    │ │(Leaflet) │ │          │ │(Leaflet)     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │             │            │             │              │         │
│       └─────────────┴────────────┴─────────────┴──────────────┘         │
│                              │ raw fetch() + API client                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                    API SERVER (Express.js 5)                           │
│                              │                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PII Masking Middleware  →  CORS  →  JSON Parser  →  Routes    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │cashnet   │ │geospatial│ │corridor  │ │legal-hold│ │evidence  │  │   │
│  │(cases,   │ │(ATMs,    │ │(ATM      │ │(SAR,     │ │(SHA-256  │  │   │
│  │predict,  │ │hotspots, │ │corridor  │ │retention,│ │integrity,│  │   │
│  │fund-flow)│ │proximity)│ │ranking)  │ │deletion) │ │chain)    │  │   │
│  └─────┬────┘ └─────┬────┘ └────┬─────┘ └──────────┘ └──────────┘  │   │
│        │            │           │                                    │   │
│  ┌─────┴────────────┴───────────┴────────────────────────────────┐   │   │
│  │         Synthetic Data Provider (seeded PRNG)                  │   │   │
│  │  520 transactions · 210 ATMs · 60 branches · 15 cities        │   │   │
│  └───────────────────────────────────────────────────────────────┘   │   │
│                                                                      │   │
│  ┌──────────────────── Integration Manager ──────────────────────┐   │   │
│  │  NCRP (National Crime Records)                                │   │   │
│  │  SAHYOG (Inter-agency cooperation)                            │   │   │
│  │  VASP (Virtual Asset Service Providers)                       │   │   │
│  └───────────────────────────────────────────────────────────────┘   │   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP POST /models/predict/184
┌──────────────────────────────┼──────────────────────────────────────────┐
│                    MODEL SERVER (Flask)                                │
│                               │                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  /models/predict/182  →  LogisticRegression (crypto/VASP)     │   │
│  │  /models/predict/183  →  RandomForest (AML detection)         │   │
│  │  /models/predict/184  →  DecisionTree + RandomForest (banking)│   │
│  │  /models/batch-predict →  Batch inference                      │   │
│  │  /models/reload       →  Hot-reload models                    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌───────────────────── Model Manager ────────────────────────────┐   │
│  │  Load from disk → Cache in memory → Train if missing           │   │
│  │  Model artifacts stored in /models/*.pkl                       │   │
│  └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Project Flow

### 3.1 High-Level Workflow

```
COMPLAINT        CASE            MODEL           PREDICTION      INTERVENTION
INTAKE      →   CREATED     →   ANALYZE     →   GENERATED   →   INITIATED
    │               │               │               │               │
    │               │               │               │               │
    ▼               ▼               ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│Submit   │   │Store case│   │Feature   │   │Hotspot   │   │Approve   │
│fraud    │   │with meta-│   │extract + │   │ranking + │   │evidence  │
│report   │   │data      │   │ML infer  │   │city pred │   │package   │
└─────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                           │
                                                           ▼
                                                     ┌──────────┐
                                                     │SUBMIT TO │
                                                     │NCRP /    │
                                                     │SAHYOG    │
                                                     └──────────┘
```

### 3.2 Detailed Step-by-Step Flow

```
STEP 1: COMPLAINT INTAKE
══════════════════════════
    User fills complaint form on frontend
                │
                ▼
    POST /api/cases
    Body: {
        title: "Suspicious ATM withdrawal pattern",
        fraudType: "UPI_FRAUD",
        amount: 150000,
        victimState: "Delhi",
        victimCity: "New Delhi"
    }
                │
                ▼
    Case created: CASE-CASHNET-005
    Status: NEW | Priority: HIGH
    Audit entry: CASE_CREATED
```

```
STEP 2: MODEL ANALYSIS (Model 184)
════════════════════════════════════
    User clicks "Run Analysis" on case page
                │
                ▼
    POST /api/cases/:caseId/analyze
                │
                ▼
    ┌─────────────────────────────────────────────┐
    │  Node Server builds feature record:         │
    │  {                                           │
    │    risk_score: 0.85,                        │
    │    transaction_count: 3,                    │
    │    amount: 150000,                          │
    │    age_days: 2,                             │
    │    case_id: "CASE-CASHNET-005",             │
    │    city: "New Delhi",                       │
    │    fraud_type: "UPI_FRAUD"                  │
    │  }                                           │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    POST http://localhost:5000/models/predict/184
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │  MODEL 184 INFERENCE:                       │
    │                                             │
    │  1. Extract features:                       │
    │     - log1p(150000) = 11.918               │
    │     - One-hot: UPI_FRAUD=1                 │
    │     - One-hot: New_Delhi=1                 │
    │                                             │
    │  2. Risk Head (DecisionTree):              │
    │     risk_clf.predict_proba(X)              │
    │     → is_suspicious: True                  │
    │     → risk_confidence: 0.92                │
    │                                             │
    │  3. City Head (RandomForest):              │
    │     city_clf.predict_proba(X)              │
    │     → predicted_city: "Mumbai"             │
    │     → city_confidence: 0.87                │
    │                                             │
    │  4. Combined confidence:                   │
    │     min(0.92, 0.87) = 0.87                │
    │                                             │
    │  5. Risk score:                             │
    │     is_suspicious → score = 0.92           │
    │     (else: 0.3 × confidence)               │
    │                                             │
    │  6. Coordinates:                            │
    │     Mumbai → lat: 19.076, lng: 72.8777     │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    Node maps response to case:
    - risk.score = 92
    - risk.category = "CRITICAL" (≥80)
    - predictions.hotspots[0] = { city: "Mumbai", lat: 19.076, lng: 72.8777 }
    - Audit: CASE_ANALYSIS_EXECUTED
```

```
STEP 3: CORRIDOR ANALYSIS (ATM Ranking)
═════════════════════════════════════════
    Frontend auto-navigates to /corridor/CASE-CASHNET-005
    Source coordinates pulled from case (complaint origin)
    Destination coordinates from model prediction (Mumbai)
                │
                ▼
    POST /api/geospatial/corridor
    Body: {
        sourceLat: 28.6139,    ← Source (Delhi)
        sourceLng: 77.209,
        destLat: 19.076,       ← Dest (Mumbai, from model)
        destLng: 72.8777,
        corridorWidthKm: 5
    }
                │
                ▼
    ┌─────────────────────────────────────────────┐
    │  CORRIDOR ALGORITHM:                        │
    │                                             │
    │  For each ATM (210 total):                 │
    │    1. Project ATM onto source→dest line    │
    │    2. Calculate distance from line (km)    │
    │    3. If distance > 5km → skip             │
    │    4. Score vulnerability (0-100):         │
    │       - Proximity to line:     /40 points  │
    │       - Hotspot density:       /35 points  │
    │       - Distance to dest:      /25 points  │
    │                                             │
    │  Sort by score descending                  │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    Response: {
        corridorAtms: [
            { name: "SBI ATM Andheri", score: 87, dist: 0.3km, hotspots: 2 },
            { name: "HDFC ATM Bandra", score: 79, dist: 0.8km, hotspots: 1 },
            ...
        ],
        totalLineKm: 1407,
        corridorWidthKm: 5
    }
```

```
STEP 4: INTERVENTION & EVIDENCE
════════════════════════════════
    Investigator reviews corridor results
                │
                ▼
    POST /api/interventions/:caseId
    Body: { requestType: "TRANSACTION_RECORD_PRESERVATION" }
                │
                ▼
    Status: DRAFT → awaiting approval
                │
                ▼
    POST /api/interventions/:caseId/approve
    Status: APPROVED
    Audit: INTERVENTION_APPROVED
                │
                ▼
    POST /api/evidence-packages
    Body: { caseId, title, items: [...] }
                │
                ▼
    Evidence package created with:
    - SHA-256 integrity hash
    - Chain of custody record
    - Timestamp + actor tracking
                │
                ▼
    POST /api/evidence-packages/:id/finalize
    Package locked — cannot be modified
                │
                ▼
    POST /api/integrations/ncrp/cases
    Case submitted to National Crime Records Portal
```

### 3.3 Navigation Flow

```
LANDING PAGE (/)
    │
    ├──→ LOGIN (/login) ──→ FACE AUTH (/face-auth)
    │
    └──→ PROTECTED SHELL
         │
         ├── DASHBOARD (/dashboard)
         │     └── Overview metrics, risk distribution, alerts
         │
         ├── I4C DELIVERABLES
         │     ├── a. Predictive Engine (/predictive-engine)
         │     │     └── Model 184 feature exploration
         │     ├── b. Risk Heatmap (/historical-activity)
         │     │     └── Leaflet map with heat layer, hotspots, ATMs
         │     ├── b.2 ATM Corridor (/corridor or /corridor/:caseId)
         │     │     └── Source→dest corridor with ranked ATMs
         │     ├── c. Law Enforcement (/cases)
         │     │     └── Case CRUD, analysis trigger
         │     └── d. Alerts (/alerts)
         │           └── Real-time alert feed
         │
         ├── INVESTIGATOR WORKBENCH
         │     ├── Fund Flow (/fund-flow/:caseId)
         │     │     └── SVG entity graph (victim → mule → ATM)
         │     ├── Crypto Wallets (/crypto)
         │     │     └── Wallet registry + risk scores
         │     ├── VASP (/vasp)
         │     │     └── Exchange attribution
         │     └── Geo (/geo)
         │           └── Case-scoped geographic view
         │
         └── ACTIONS & AUDIT
               ├── Interventions (/interventions)
               ├── Reports (/reports)
               └── Audit Trail (/audit)
```

---

## 4. Model Implementation & Reliability

### 4.1 Model 184 — Banking / ATM / Geospatial Predictor

Model 184 is the **primary predictive model** in CASHNET. It answers two questions:
1. **Is this transaction suspicious?** (Risk Classification)
2. **Where will the cash be withdrawn?** (City Prediction)

#### Architecture

```
                    ┌──────────────────────────┐
                    │    Input Feature Record   │
                    │  { amount, type, cities } │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Feature Extraction      │
                    │                           │
                    │  log1p(amount)            │
                    │  One-hot(transaction_type)│
                    │  One-hot(source_city)     │
                    │  One-hot(dest_city)       │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                           │
         ┌──────────▼──────────┐    ┌──────────▼──────────┐
         │   RISK HEAD         │    │   CITY HEAD          │
         │                     │    │                      │
         │  DecisionTree       │    │  RandomForest        │
         │  max_depth=8        │    │  n_estimators=300    │
         │  class_weight=      │    │  max_depth=12        │
         │    balanced         │    │  class_weight=       │
         │                     │    │    balanced           │
         │  Output:            │    │  n_jobs=-1           │
         │  is_suspicious      │    │                      │
         │  risk_confidence    │    │  Output:             │
         └──────────┬──────────┘    │  predicted_city      │
                    │               │  city_confidence     │
                    │               └──────────┬───────────┘
                    │                          │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │   COMBINE                 │
                    │                           │
                    │  confidence =             │
                    │    min(risk_conf,         │
                    │         city_conf)        │
                    │                           │
                    │  risk_score =             │
                    │    suspicious ? conf :    │
                    │    0.3 × conf             │
                    │                           │
                    │  needs_review =           │
                    │    confidence < 0.7       │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │   COORDINATE LOOKUP      │
                    │                           │
                    │  predicted_city → lat/lng │
                    │  via CITY_COORDINATES{}   │
                    └──────────────────────────┘
```

#### Feature Engineering

| Feature | Transformation | Rationale |
|---------|---------------|-----------|
| `transaction_amount` | `log1p(amount)` | Compresses skewed distribution (8K–268K INR) |
| `transaction_type` | One-hot encoding | Captures fraud patterns per channel |
| `source_city` | One-hot encoding | Geographic fraud clustering |
| `destination_city` | One-hot encoding | Cash-out location patterns |

#### Training Data

- **Source:** Synthetic bank transactions + ATM withdrawal links
- **Dataset:** Generated via `scripts/bank/generate_bank_transactions.py`
- **ATM Links:** `scripts/generate_synthetic_geo_data.py` provides cash-out locations
- **Labels:** `is_suspicious` flag from scenario metadata

#### Output Contract (Canonical Schema)

All models in CASHNET must produce this standardized output (`lib/schema.py`):

```python
{
    "risk_object": {
        "risk_score": 0.92,          # 0.0 – 1.0
        "risk_label": "high",        # high / medium / low
        "entities": [...]            # flagged entities
    },
    "dashboard": {
        "title": "CASHNET Model 184",
        "metrics": {
            "is_suspicious": True,
            "predicted_withdrawal_city": "Mumbai",
            "atm_count_in_city": 14,
            "predicted_coordinates": { "lat": 19.076, "lng": 72.8777 }
        }
    },
    "routing_action_list": [
        { "action": "FREEZE_ACCOUNTS", "target": "destination", "priority": "high" },
        { "action": "DEPLOY_TO_CITY",  "target": "Mumbai",      "priority": "medium" }
    ],
    "confidence": 0.87,
    "needs_review": False,           # True if confidence < 0.7
    "metadata": { "model_id": 184, "timestamp": "..." }
}
```

### 4.2 Model 182 — Crypto / VASP / Cross-Border

| Property | Value |
|----------|-------|
| Algorithm | LogisticRegression (Pipeline with StandardScaler) |
| Training Data | Elliptic Bitcoin dataset |
| Features | `[risk_score, transaction_count, amount, age_days]` |
| Use Case | Cryptocurrency VASP attribution and cross-border flow detection |
| Fallback | Synthetic 4-feature model if Elliptic data unavailable |

### 4.3 Model 183 — AML Detection

| Property | Value |
|----------|-------|
| Algorithm | RandomForestClassifier (n_estimators=100) with StandardScaler |
| Training Data | Elliptic Bitcoin dataset |
| Features | `[risk_score, transaction_count, amount, age_days]` |
| Use Case | Anti-money laundering pattern detection |

### 4.4 Reliability Mechanisms

| Mechanism | Implementation |
|-----------|---------------|
| **Model Caching** | In-memory cache after first load; no disk I/O on subsequent predictions |
| **Graceful Fallback** | If trained model unavailable, trains new one from synthetic data on first request |
| **Timeout Protection** | 5-second prediction timeout (configurable in production.py) |
| **Confidence Threshold** | `needs_review: true` flag when confidence < 0.7 — routes to human analyst |
| **Conservative Scoring** | Combined confidence = `min(risk_conf, city_conf)` — never overstates certainty |
| **Sigmoid Risk Mapping** | Non-suspicious transactions scored at 30% of confidence (not zero) |
| **Hot Reload** | `POST /models/reload` clears cache and reloads from disk |
| **Batch Fallback** | `POST /models/batch-predict` for bulk inference with error isolation |
| **Schema Validation** | All outputs validated against canonical contract (`lib/schema.py:validate()`) |
| **Artifacts Provenance** | Model save/load includes metadata: train date, feature count, accuracy metrics |

### 4.5 Model Manager Lifecycle

```
PREDICTION REQUEST
        │
        ▼
┌───────────────────┐     ┌───────────────────┐
│  Check Memory     │─Yes─▶│  Use Cached Model │
│  Cache            │      └───────────────────┘
└───────┬───────────┘
        │ No
        ▼
┌───────────────────┐     ┌───────────────────┐
│  Load from Disk   │─Yes─▶│  Cache + Predict  │
│  (/models/*.pkl)  │      └───────────────────┘
└───────┬───────────┘
        │ No
        ▼
┌───────────────────┐     ┌───────────────────┐
│  Train New Model  │─────▶│  Save + Cache +   │
│  from Synthetic   │      │  Predict          │
│  Data             │      └───────────────────┘
└───────────────────┘
```

---

## 5. Data Flow

### 5.1 End-to-End Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA GENERATION LAYER                       │
│                                                                 │
│  scripts/generate_synthetic_geo_data.py                         │
│  scripts/bank/generate_bank_transactions.py                     │
│  scripts/complaints/generate_complaints.py                      │
│                                                                 │
│  Output: 520 transactions, 210 ATMs, 60 branches, 15 cities   │
│  All marked dataSource: "SYNTHETIC"                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYNTHETIC DATA PROVIDER                      │
│                                                                 │
│  TypeScript: src/providers/synthetic-geospatial.ts              │
│  - Seeded PRNG (seed=20260818) → deterministic                 │
│  - Gaussian-distributed coordinates around city centers         │
│  - Risk scores 35-99, 10 fraud types, 6 location types        │
│  - DBSCAN-like hotspot detection (ε=1.75km, minPoints=5)      │
│                                                                 │
│  Python: lib/io_utils.py                                       │
│  - load_184_synthetic() → bank transactions + ATM links        │
│  - load_184_external_osm() → OSM-based ATM locations           │
│  - load_elliptic() → Bitcoin blockchain dataset                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTE HANDLERS                              │
│                                                                 │
│  /api/dashboard         → Aggregate metrics from synthetic data │
│  /api/cases             → CRUD on 4 static cases                │
│  /api/cases/:id/analyze → Triggers Model 184 inference         │
│  /api/geospatial/*      → Filtered geospatial queries          │
│  /api/geospatial/corridor → ATM corridor vulnerability scoring  │
│  /api/fund-flow/:id     → Static fund flow graph (9 nodes)     │
│  /api/predictions/:id   → Model prediction results              │
│  /api/reports/:id       → Generated investigation brief        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MODEL INFERENCE                              │
│                                                                 │
│  Node → Flask (POST /models/predict/184)                        │
│                                                                 │
│  Input: { risk_score, transaction_count, amount, age_days,     │
│           case_id, city, fraud_type }                           │
│                                                                 │
│  Processing:                                                    │
│  1. Feature extraction (log1p, one-hot)                        │
│  2. DecisionTree risk classification                            │
│  3. RandomForest city prediction                                │
│  4. Confidence combination (conservative min)                  │
│  5. Coordinate lookup for predicted city                        │
│                                                                 │
│  Output: { risk_object, dashboard, routing_action_list,         │
│            confidence, needs_review, coordinates }              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE ENRICHMENT                          │
│                                                                 │
│  Node server maps model output → CaseDetail:                   │
│  - risk.score = confidence × 100                                │
│  - risk.category = CRITICAL/HIGH/MEDIUM/LOW                    │
│  - predictions.hotspots = [{ city, lat, lng, probability }]    │
│  - predictions.source_coordinates = complaint origin            │
│  - Audit entry: CASE_ANALYSIS_EXECUTED                          │
│                                                                 │
│  PII Masking applied (if ENABLE_PII_MASKING=true)              │
│  Response serialized as JSON                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│                                                                 │
│  React Frontend:                                                │
│  - Dashboard: Metric cards, charts (Recharts)                  │
│  - Predictive Engine: Model 184 feature table                  │
│  - Geospatial: Leaflet map with heat layer + CircleMarkers     │
│  - Corridor: Polyline source→dest + ranked ATM sidebar         │
│  - Fund Flow: SVG entity graph (9 nodes, 8 edges)             │
│  - Cases: Table with status, risk badge, actions               │
│  - Reports: Generated brief with 13 sections                  │
│  - All synthetic data marked with "SYNTHETIC" pill badge       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Geospatial Data Flow

```
                    ┌────────────────────┐
                    │  City Coordinates  │
                    │  (15 cities)       │
                    └────────┬───────────┘
                             │
                    ┌────────▼───────────┐
                    │  Gaussian Offset   │
                    │  (seeded PRNG)     │
                    └────────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌──────▼──────┐ ┌─────▼─────┐
     │ Transactions│ │   ATMs      │ │ Branches  │
     │ (520)       │ │ (210)       │ │ (60)      │
     └────────┬────┘ └──────┬──────┘ └─────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌──────▼──────┐ ┌─────▼─────┐
     │ DBSCAN      │ │ Haversine   │ │ Proximity │
     │ Clustering  │ │ Distance    │ │ Analysis  │
     │ (ε=1.75km)  │ │ (point→line)│ │ (radius)  │
     └────────┬────┘ └──────┬──────┘ └─────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼───────────┐
                    │  Corridor Score    │
                    │  proximity /40     │
                    │  hotspots /35      │
                    │  dest /25          │
                    └────────┬───────────┘
                             │
                    ┌────────▼───────────┐
                    │  Ranked ATMs       │
                    │  (sorted desc)     │
                    └────────────────────┘
```

### 5.3 Fund Flow Graph Structure

```
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ Victim  │────▶│ Mule A  │────▶│ Mule B  │
    │ (₹4.2L) │     │ Account │     │ Account │
    └─────────┘     └─────────┘     └────┬────┘
                                          │
                                          ▼
                                    ┌───────────┐
                                    │   VASP    │
                                    │ (WazirX)  │
                                    └─────┬─────┘
                                          │
                              ┌───────────┼───────────┐
                              ▼                       ▼
                        ┌───────────┐          ┌───────────┐
                        │ Wallet A  │          │ Wallet B  │
                        │ (0x7a3b)  │          │ (bc1q8x)  │
                        └─────┬─────┘          └─────┬─────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────┐          ┌───────────┐
                        │  Foreign  │          │ Account C │
                        │  VASP     │─────────▶│ (Mule)    │
                        └───────────┘          └─────┬─────┘
                                                     │
                                                     ▼
                                               ┌───────────┐
                                               │  ATM      │
                                               │ (Predicted)│
                                               └───────────┘
```

---

## 6. Security Implementation

### 6.1 Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 1: AUTHENTICATION                                │   │
│  │  - JWT tokens (HS256, 30min access + 7d refresh)       │   │
│  │  - bcrypt password hashing                              │   │
│  │  - TOTP MFA (pyotp) + 8 backup codes                   │   │
│  │  - Token revocation via JTI tracking                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 2: AUTHORIZATION (RBAC + ABAC)                   │   │
│  │  - 5 roles: ADMIN > SUPERVISOR > INVESTIGATOR >         │   │
│  │             ANALYST > VIEWER                            │   │
│  │  - 29 granular permissions                              │   │
│  │  - Policy engine with priority-ordered rules            │   │
│  │  - Deny overrides for non-admin delete/approve          │   │
│  │  - Default deny if no policy matches                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 3: ENCRYPTION                                    │   │
│  │  - AES-128-CBC + HMAC-SHA256 (Fernet)                  │   │
│  │  - PBKDF2 key derivation (100K iterations)             │   │
│  │  - Field-level encryption for sensitive data            │   │
│  │  - SHA-256 integrity hashing for evidence packages      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 4: SECRETS MANAGEMENT                            │   │
│  │  - Local: Fernet-encrypted files (.secrets/)            │   │
│  │  - Vault: HashiCorp Vault KV v2                         │   │
│  │  - AWS: Secrets Manager                                 │   │
│  │  - Auto-rotation support (90-day default)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 5: PII MASKING                                   │   │
│  │  - Middleware intercepts res.json()                     │   │
│  │  - Dashboard routes: aggressive masking                 │   │
│  │  - Report routes: strict masking                        │   │
│  │  - Health routes: no masking                            │   │
│  │  - Role-based masking (configurable per role)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 6: AUDIT LOGGING                                 │   │
│  │  - Hash-chained immutable log (SHA-256 chain)          │   │
│  │  - 30+ audit actions tracked                            │   │
│  │  - Actor + IP + User-Agent + Request context            │   │
│  │  - Integrity verification (chain walk)                  │   │
│  │  - Export + statistics aggregation                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Authentication Flow

```
    USER                      FRONTEND                  API SERVER              AUTH SERVICE
     │                           │                          │                       │
     │  Enter credentials        │                          │                       │
     │──────────────────────────▶│                          │                       │
     │                           │  POST /auth/login        │                       │
     │                           │─────────────────────────▶│                       │
     │                           │                          │  verify_password()    │
     │                           │                          │──────────────────────▶│
     │                           │                          │                       │
     │                           │                          │  bcrypt.checkpw()     │
     │                           │                          │                       │
     │                           │                          │◀──────────────────────│
     │                           │                          │                       │
     │                           │                          │  generate_tokens()    │
     │                           │                          │──────────────────────▶│
     │                           │                          │                       │
     │                           │                          │  JWT (HS256):         │
     │                           │                          │  { sub, email, role,  │
     │                           │                          │    permissions, exp,  │
     │                           │                          │    jti }              │
     │                           │                          │                       │
     │                           │                          │◀──────────────────────│
     │                           │  { access_token,         │                       │
     │                           │    refresh_token }       │                       │
     │                           │◀─────────────────────────│                       │
     │                           │                          │                       │
     │  MFA required?            │                          │                       │
     │◀──────────────────────────│                          │                       │
     │                           │                          │                       │
     │  Enter TOTP code          │                          │                       │
     │──────────────────────────▶│                          │                       │
     │                           │  POST /auth/mfa/verify   │                       │
     │                           │─────────────────────────▶│                       │
     │                           │                          │  pyotp.TOTP.verify()  │
     │                           │                          │──────────────────────▶│
     │                           │                          │                       │
     │                           │                          │◀──────────────────────│
     │                           │  { session_token }       │                       │
     │                           │◀─────────────────────────│                       │
     │                           │                          │                       │
     │  Access protected routes  │                          │                       │
     │──────────────────────────▶│                          │                       │
     │                           │  Authorization: Bearer   │                       │
     │                           │─────────────────────────▶│                       │
     │                           │                          │  verify_jwt()         │
     │                           │                          │  check_revocation()   │
     │                           │                          │  check_permissions()  │
     │                           │                          │──────────────────────▶│
     │                           │                          │                       │
     │                           │                          │◀──────────────────────│
     │                           │  200 OK + data           │                       │
     │                           │◀─────────────────────────│                       │
     │  Response                 │                          │                       │
     │◀──────────────────────────│                          │                       │
```

### 6.3 Authorization Role Hierarchy

```
ADMIN (Full Access)
  │
  ├── All case CRUD + delete
  ├── All user management
  ├── System configuration
  │
  ▼
SUPERVISOR
  │
  ├── Case CRUD + assign (no delete)
  ├── Findings adjudication
  ├── Action request approve/send
  ├── Entity CRUD
  │
  ▼
INVESTIGATOR
  │
  ├── Case create/read/update (own only)
  ├── Findings create/update
  ├── Evidence create/read
  ├── Action request create
  │
  ▼
ANALYST
  │
  ├── Read-only: cases, findings, evidence, entities
  │
  ▼
VIEWER
  │
  └── Read-only: cases, findings, evidence
```

### 6.4 Tamper-Evident Audit Chain

```
  Entry 1                Entry 2                Entry 3
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ id: 001      │      │ id: 002      │      │ id: 003      │
  │ action:      │      │ action:      │      │ action:      │
  │  CASE_CREATE │      │  CASE_ANALYZE│      │  INTERVENTION│
  │ actor: agent │      │ actor: agent │      │  _APPROVE    │
  │ timestamp:   │      │ timestamp:   │      │ actor: supv  │
  │  2026-09-09  │      │  2026-09-09  │      │ timestamp:   │
  │              │      │              │      │  2026-09-09  │
  │ prev_hash:   │      │ prev_hash:   │      │ prev_hash:   │
  │  0000...     │      │  a3f2...     │      │  7b1c...     │
  │ current_hash:│      │ current_hash:│      │ current_hash:│
  │  a3f2...     │      │  7b1c...     │      │  e9d4...     │
  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                          SHA-256 chain

  Integrity Verification:
  For each entry i:
    hash(entries[i-1]) == entries[i].prev_hash ?
    hash(entries[i].data + entries[i].prev_hash) == entries[i].current_hash ?
```

### 6.5 Evidence Package Integrity

```
    CREATE                      VERIFY                      FINALIZE
      │                           │                           │
      ▼                           ▼                           ▼
  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
  │ Collect items│          │ Load package │          │ Lock package │
  │ Compute      │          │ Recompute    │          │ Set status:  │
  │ SHA-256 hash │          │ SHA-256 hash │          │ FINALIZED    │
  │ of all items │          │ Compare with │          │ Immutable    │
  │              │          │ stored hash  │          │ from here    │
  │ Store with   │          │              │          │              │
  │ chain of     │          │ Match?       │          │ Export:      │
  │ custody      │          │ → VALID      │          │ JSON/HTML/CSV│
  │ metadata     │          │ → TAMPERED   │          │              │
  └──────────────┘          └──────────────┘          └──────────────┘
```

### 6.6 PII Masking Strategy

| Route Pattern | Masking Level | Fields Masked |
|---------------|---------------|---------------|
| `/api/dashboard` | Aggressive | Account numbers, phones, emails, names, wallets, Aadhaar, PAN, DOB |
| `/api/cases` | Aggressive | Same as dashboard |
| `/api/reports` | Strict | Addresses, names |
| `/api/wallets` | Strict | Wallet addresses (partial) |
| `/api/interventions` | Strict | Names, addresses |
| `/api/health` | None | — |
| `/api/geospatial` | None | Coordinates are synthetic |
| `/api/legal-holds` | Strict | Subject names |

### 6.7 Secrets Management Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION CODE                       │
│                                                         │
│    secrets_manager.get_secret("DB_PASSWORD")            │
│                        │                                │
└────────────────────────┼────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  SecretsManager     │
              │  (Singleton)        │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────────────────────┐
              │  SECRETS_BACKEND env var             │
              │                                     │
              │  ┌─────────┐ ┌─────────┐ ┌───────┐ │
              │  │ local   │ │ vault   │ │  aws  │ │
              │  └────┬────┘ └────┬────┘ └───┬───┘ │
              └───────┼──────────┼──────────┼──────┘
                      │          │          │
                      ▼          ▼          ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ .secrets/ │ │ HashiCorp│ │  AWS     │
              │ Fernet-   │ │ Vault    │ │ Secrets  │
              │ encrypted │ │ KV v2    │ │ Manager  │
              │ files     │ │          │ │          │
              └──────────┘ └──────────┘ └──────────┘

    Encryption: AES-128-CBC + HMAC-SHA256 (Fernet)
    Key Derivation: PBKDF2-HMAC-SHA256 (100K iterations)
    Rotation: 90-day default interval
```

---

## 7. Deployment

### 7.1 Docker Compose (Local Development)

```
┌─────────────────────────────────────────────────┐
│  docker-compose.yml                             │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ frontend │  │   api    │  │  models  │     │
│  │ (React)  │  │ (Express)│  │  (Flask) │     │
│  │  :80     │  │  :3000   │  │  :5000   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                       │              │          │
│                       ▼              ▼          │
│                ┌──────────────────────────┐    │
│                │      PostgreSQL 15       │    │
│                │         :5432            │    │
│                └──────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 7.2 Kubernetes (Production)

```
┌─────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Ingress (nginx + TLS via Let's Encrypt)        │   │
│  │  Host: cashnet.example.com                      │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                              │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │  Deployment: cashnet-api (3 replicas, HPA 3-10) │   │
│  │  CPU: 70% threshold | Memory: 80% threshold    │   │
│  │  Liveness: /health | Readiness: /ready          │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                              │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │  Deployment: cashnet-models (3 replicas)        │   │
│  │  PVC: 10Gi gp3 for model artifacts              │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                              │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │  Secrets: database-url, redis-url, auth-key,    │   │
│  │           encryption-key, vault-token            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────┐    │
│  │  Prometheus          │  │  Alert Rules          │    │
│  │  /metrics            │  │  - High error rate    │    │
│  │  Port: 9090          │  │  - Latency P99 > 2s   │    │
│  └─────────────────────┘  │  - Model failures      │    │
│                            └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Production Configuration Highlights

| Setting | Value | Source |
|---------|-------|--------|
| DB Pool | 5–20 connections | `config/production.py` |
| DB Timeout | 30s statement timeout | `config/production.py` |
| Redis TTL | 1 hour | `config/production.py` |
| Model Retrain | 5% performance drop threshold | `config/production.py` |
| Prediction Timeout | 5 seconds | `config/production.py` |
| Rate Limiting | 200 req/60s window | `config/production.py` |
| API Workers | 4 (Gunicorn) | `config/production.py` |
| API Timeout | 60s | `config/production.py` |
| Monitoring | Prometheus + JSON logging | `config/production.py` |
| Tracing | 10% sample rate (optional) | `config/production.py` |

---

*Generated for CASHNET — Synthetic fraud investigation platform for demonstration purposes only.*
