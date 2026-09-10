# Spec: analytics-api

## Objective

Add analytics-as-a-service endpoints to the CASHNET Intelligence API. These endpoints let institutional consumers run analytical queries against CASHNET data without building their own ML pipeline. This is the highest-value commercial module.

**Success criteria:**
- External consumers can query fraud pattern analytics via API
- ATM/location hotspot data is available as structured JSON
- Transaction relationship graphs can be queried programmatically
- All analytics responses include model version and confidence scores
- Results are paginated and rate-limited

## Tech Stack

- TypeScript (Express 5, built on `intelligence-api` v1 router)
- Existing Python services (`services/ml/typology.py`, `services/geospatial/`) as analytical backend
- Existing provider system for data access

## Commands

```
Build: pnpm --filter @workspace/api-server run build
Typecheck: pnpm --filter @workspace/api-server run typecheck
Dev: pnpm --filter @workspace/api-server run dev
```

## Project Structure

```
artifacts/api-server/src/
  routes/v1/
    analytics.ts             # MODIFY — add detailed analytics endpoints
  services/
    analytics-engine.ts      # NEW — query orchestration layer
```

## API Endpoints

### Fraud Pattern Analytics
```
GET /api/v1/analytics/fraud-patterns
  Query params: city, state, dateFrom, dateTo, fraudType, minConfidence
  Response: {
    patterns: Array<{
      type: string;
      frequency: number;
      cities: string[];
      averageAmount: number;
      confidence: number;
      modelVersion: string;
    }>;
    totalMatches: number;
    provenance: DataProvenance;
  }
```

### ATM/Location Hotspot Analytics
```
GET /api/v1/analytics/hotspots
  Query params: city, state, radius, minRisk, limit
  Response: {
    hotspots: Array<{
      id: string;
      lat: number;
      lng: number;
      riskScore: number;
      nearbyAtms: number;
      historicalIncidents: number;
      probability: number;
      contributingFactors: string[];
    }>;
    provenance: DataProvenance;
  }
```

### Transaction Relationship Analytics
```
GET /api/v1/analytics/relationships
  Query params: caseId, walletAddress, maxHops, minValue, chain
  Response: {
    nodes: Array<{ id, type, label, risk }>;
    edges: Array<{ source, target, amount, timestamp, type }>;
    metrics: { totalValue, riskScore, entityCount };
    provenance: DataProvenance;
  }
```

### Cross-Case Analytics
```
GET /api/v1/analytics/connected-incidents
  Query params: entityId, caseId, minSimilarity
  Response: {
    linkedCases: Array<{
      caseId: string;
      reference: string;
      sharedEntities: string[];
      similarityScore: number;
      linkType: string;
    }>;
    provenance: DataProvenance;
  }
```

### Corridor Vulnerability Analytics
```
GET /api/v1/analytics/corridors
  Query params: sourceCity, destCity, minVulnerability
  Response: {
    corridors: Array<{
      source: { city, state, coordinates };
      destination: { city, state, coordinates };
      vulnerabilityScore: number;
      transactionCount: number;
      totalExposure: number;
    }>;
    provenance: DataProvenance;
  }
```

## Response Conventions

All analytics responses share:
```typescript
interface AnalyticsResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    modelVersion: string;
    provenance: DataProvenance;
    rateLimit: {
      remaining: number;
      reset: string;
    };
  };
}
```

## Testing Strategy

- Typecheck all new files
- Test each endpoint returns correct response shape
- Test query parameter filtering works
- Test pagination (limit/offset or cursor)
- Test provenance metadata is present in all responses
- Test rate limiting applies to analytics endpoints

## Boundaries

- Always: include provenance, paginate results, rate-limit per API key
- Ask first: adding new analytical models, changing response schemas
- Never: expose raw database queries, return unmasked PII, allow write operations

## Success Criteria

- [ ] All 5 analytics endpoints respond with correct data shapes
- [ ] Query parameter filtering works for each endpoint
- [ ] All responses include `provenance` and `meta` fields
- [ ] Pagination works (limit + offset or cursor)
- [ ] Rate limiting applies per API key tier
- [ ] Typecheck passes

## Open Questions

- Should analytics results be cached? If so, what TTL?
- Should we support webhook push for analytics results, or only polling?
- Should historical analytics (time-series) be in MVP?
