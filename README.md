# CASHNET

CASHNET is a synthetic-data cybercrime financial intelligence platform for authorized investigators. It starts with a scam report and connects complaint indicators, account analysis, transactions, multi-hop fund flow, crypto tracing, VASP attribution, risk, geospatial prediction, ATM cash-out hotspots, intervention review, audit, and reporting.

## Data Transparency

**What is real vs synthetic vs model inference:**

| Component | Source Type | Description |
|---|---|---|
| Complaint data | `SYNTHETIC` | Seeded scam reports with masked PII |
| Transactions | `SYNTHETIC` | Generated from scenario templates |
| ATM/Branch locations | `SYNTHETIC` | Random points within India bounding box |
| Risk scores | `MODEL_INFERENCE` | Transparent analytical baseline (not production model) |
| Geospatial predictions | `MODEL_INFERENCE` | Time-window + location probability estimates |
| Blockchain (Bitcoin) | `PUBLIC_DATA` | Blockstream API (no key required) |
| Blockchain (Ethereum) | `PUBLIC_DATA` | Etherscan API (key optional, raises limits) |
| Blockchain (Tron) | `PUBLIC_DATA` | Trongrid API (key optional) |
| VASP attribution | `PUBLIC_DATA` | Known labels from blockchain explorers |
| NCRP | `NOT_CONNECTED` | Returns error; requires authorized API access |
| SAHYOG | `NOT_CONNECTED` | Returns error; requires authorized API access |
| UPI / Bank systems | `NOT_CONNECTED` | Never accessed; not implemented |
| Government systems | `NOT_CONNECTED` | Never accessed; not implemented |

All seeded intelligence is clearly marked **SYNTHETIC** or **MODEL_INFERENCE**. Reports distinguish **FACT** (verified data) from **MODEL_INFERENCE** (prediction) from **SYNTHETIC** (generated).

## Project structure

```text
artifacts/cashnet/          React + TypeScript investigator application
artifacts/api-server/       Express API and synthetic analytical provider
lib/ml_pipeline.py          Model registry, artifact storage, temporal split
lib/model_evaluation.py     Binary/multiclass/location metrics
lib/integration_config.py   NCRP/SAHYOG/VASP configuration loader
lib/integration_manager.py  Integration lifecycle (always NOT_CONNECTED)
data/public/                Ingested public datasets (CSV/JSON/GeoJSON)
tests/                      Comprehensive test suite
```

## Architecture

### Provider System

The API server uses a pluggable provider architecture:

```typescript
// artifacts/api-server/src/providers/
provider-types.ts        // Core interfaces (HistoricalTransaction, Provenance, etc.)
provider-factory.ts      // Lifecycle management, mode switching
synthetic-provider.ts    // Default synthetic data (demo mode)
public-provider.ts       // Ingests real CSV/JSON/GeoJSON datasets
```

**Switching modes:**
- `CASHNET_DATA_MODE=synthetic` (default) — uses generated demo data
- `CASHNET_DATA_MODE=public` — ingests from `CASHNET_PUBLIC_DATA_DIR`
- `CASHNET_DATA_MODE=user` — user-provided datasets

### Blockchain Providers

Real blockchain APIs are used for wallet analysis:

```typescript
// artifacts/api-server/src/providers/
blockchain-providers.ts  // Bitcoin (Blockstream), Ethereum (Etherscan), Tron (Trongrid)
vasp-attribution.ts      // Evidence-based VASP attribution, multi-hop graph traversal
```

**Configuration:**
- Bitcoin/Blockstream: No key required (rate-limited)
- Ethereum/Etherscan: Optional `ETHERSCAN_API_KEY`
- Tron/Trongrid: Optional `TRON_API_KEY`

### Geospatial Services

Reusable analytical services extracted from the original synthetic provider:

```typescript
// artifacts/api-server/src/services/geospatial/
distance.ts              // Haversine, bearing, coordinate validation
clustering.ts            // DBSCAN spatial clustering
proximity.ts             // Nearby, nearest, count-within-radius
hotspot-scoring.ts       // Risk-weighted hotspot detection
feature-engineering.ts   // ML feature extraction for location data
```

### Data Ingestion

Public dataset ingestion pipeline:

```typescript
// artifacts/api-server/src/services/data-ingestion/
csv-loader.ts            // CSV parsing with field mapping
json-loader.ts           // JSON array ingestion
geojson-loader.ts        // GeoJSON FeatureCollection ingestion
schema-validator.ts      // Schema validation and type coercion
```

### ML Pipeline

Reproducible model training and evaluation:

```python
# lib/ml_pipeline.py
ModelRegistry            # Save/load model artifacts with metadata
temporal_train_test_split # Time-ordered train/test split

# lib/model_evaluation.py
binary_classification_metrics     # Precision, recall, F1, ROC-AUC
multiclass_classification_metrics # Per-class and weighted metrics
location_prediction_metrics       # Distance error, hit rate, spatial accuracy
```

## Setup and run locally

```bash
# Install dependencies
pnpm install

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (in another terminal)
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/cashnet run dev
```

The Replit workflows already start both services with the correct ports and routing. The UI calls `/api` through the shared route.

## Environment variables

Copy `.env.example` to `.env` when running outside Replit. Synthetic mode needs no API keys. Set `CASHNET_DATA_MODE=synthetic` to make the default explicit.

**Key variables:**

| Variable | Default | Description |
|---|---|---|
| `CASHNET_DATA_MODE` | `synthetic` | Data provider mode: synthetic, public, user |
| `CASHNET_PUBLIC_DATA_DIR` | `./data/public` | Directory for ingested datasets |
| `ETHERSCAN_API_KEY` | (empty) | Etherscan API key for Ethereum transactions |
| `TRON_API_KEY` | (empty) | Trongrid API key for Tron transactions |
| `NCRP_ENABLED` | `false` | NCRP integration (requires authorized access) |
| `SAHYOG_ENABLED` | `false` | SAHYOG integration (requires authorized access) |

## Supabase setup

The MVP uses an in-memory synthetic provider so it remains functional without Supabase. For a deployment that needs persistence, create a Supabase project, enable Auth and Storage, apply `database/schema.sql` to its PostgreSQL database, configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the server, and keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Add RLS policies before importing any real data. Do not mix user-provided/API records with synthetic records without retaining `source_type`.

## Synthetic demo access

The default demo is intentionally open in synthetic mode so reviewers can run the workflow without credentials:

- Investigator: `demo.investigator`
- Role: `INVESTIGATOR`
- Case: `CASE-CASHNET-001`
- Report reference: `NCRP-SYN-260818-001`

## Main workflow

Open a case from the Cases screen, inspect the complaint, run analysis, open Fund flow, press Play to follow timestamp order, and select the `FIAT → CRYPTO CONVERSION` event. The seeded event is **18 Aug 2026 · 10:11 UTC** at VASP Alpha. Continue to Geo & prediction for ranked predicted ATM locations, then prepare and explicitly approve the intervention. Reports include the same case results and the disclaimer: "Analytical prediction — requires investigator validation."

## Major modules

- **Complaint / Cases:** report ingestion with indicators and masked identifiers.
- **Financial intelligence:** linked account inflow/outflow, velocity, fan-in/fan-out, and explainable risk indicators.
- **Fund flow:** relationship graph and synchronized timestamp timeline, including fiat-to-crypto and crypto-to-bank conversion edges.
- **Crypto / VASP:** wallet balances, chains, counterparties, VASP candidates, confidence, classification, and evidence. Uses real blockchain APIs (Blockstream, Etherscan, Trongrid) when configured.
- **Risk:** transparent analytical baseline with score, category, confidence, features, and model version.
- **Geo & prediction:** geospatial data from synthetic or ingested public datasets, ATM/branch proximity, historical behavior features, ranked hotspots, probability, time window, and contributing factors.
- **Action / intervention:** latest credited account, synthetic bank/IFSC/branch resolution, draft → review → explicit approval. No automatic freeze, debit, seizure, contact, or submission is performed.
- **Audit / reports:** user actions and evidence-backed report sections with provenance labels.

## Provenance tracking

Every record carries a `DataProvenance` object:

```typescript
{
  dataSource: "PUBLIC_DATA" | "AUTHORIZED_API" | "USER_PROVIDED_DATA" | "SYNTHETIC" | "MODEL_INFERENCE",
  sourceName: "blockstream" | "etherscan" | "synthetic-seeded" | "user-csv" | ...,
  sourceReference: "txid..." | "file://..." | "generated",
  retrievedAt: "2026-08-26T10:00:00Z",
  confidence: 0.0-1.0
}
```

Reports distinguish sections as:
- **FACT** — verified data from authorized sources
- **MODEL_INFERENCE** — prediction from ML model
- **SYNTHETIC** — generated demo data

## Known limitations

- The default server store is process-local and resets on restart.
- The map is rendered as a synthetic analytical surface rather than live map tiles.
- Kafka, Elasticsearch/Kibana, Supabase, banking APIs are interfaces/configuration points only.
- Predictions are a transparent baseline, not a validated operational model.
- Synthetic identifiers are not real accounts or ownership claims.
- Blockchain APIs have rate limits without API keys.
- NCRP and SAHYOG integrations require authorized government API access (not implemented).

## Replacing synthetic providers

Implement an adapter behind the existing API boundary for each authorized source:

1. Persist raw source reference and `source_type=API`
2. Map provider errors to `DATA_SOURCE_UNAVAILABLE`
3. Preserve unknown entities instead of guessing
4. Require credentials only through server environment/secrets
5. Add contract tests with recorded authorized fixtures
6. Apply RLS and role checks
7. Retain model provenance
8. Require investigator review before any intervention request is submitted

## Testing

```bash
# Run Python tests
python -m pytest tests/ -v

# Run TypeScript typecheck
pnpm --filter @workspace/api-server run typecheck

# Build API server
pnpm --filter @workspace/api-server run build

# Build frontend
pnpm --filter @workspace/cashnet run build
```

Test coverage includes:
- Geospatial distance calculations (haversine, symmetry, anti-meridian)
- Coordinate validation (bounds, null safety)
- Data provenance types and fields
- Integration status (NCRP/SAHYOG always NOT_CONNECTED)
- Schema validation (empty, valid, invalid contracts)
- Temporal train/test split
- Synthetic data generation and provenance
- VASP attribution (known/unknown entities)
- Blockchain provider status structure
- Data ingestion (CSV parsing, field mapping)
- Model existence and schema validation
