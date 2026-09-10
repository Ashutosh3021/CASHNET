# Spec: intelligence-api

## Objective

Build the CASHNET Intelligence API — an external-facing REST API that lets institutions (banks, law enforcement, fintechs) query CASHNET analytical capabilities without using the dashboard. This is the primary commercial component.

**Architecture:**
```
Bank's existing system → CASHNET Intelligence API → analytical result → Bank's existing workflow
```

**Success criteria:**
- External consumers can authenticate with API keys (not user JWT)
- All analytical endpoints are available via versioned API (`/api/v1/...`)
- Rate limiting prevents abuse
- API keys can be generated, rotated, and revoked
- All responses include provenance metadata
- OpenAPI spec is auto-generated and published

## Tech Stack

- TypeScript (Express 5)
- Existing provider system (`provider-factory.ts`) as the data layer
- `express-rate-limit` for rate limiting (add to package.json)
- API key store: in-memory (MVP), with interface for DB-backed storage later

## Commands

```
Build: pnpm --filter @workspace/api-server run build
Typecheck: pnpm --filter @workspace/api-server run typecheck
Dev: pnpm --filter @workspace/api-server run dev
```

## Project Structure

```
artifacts/api-server/src/
  middlewares/
    api-key-auth.ts          # NEW — API key validation middleware
    rate-limiter.ts          # NEW — rate limiting middleware
    api-versioning.ts        # NEW — /api/v1 prefix routing
  routes/
    v1/
      analytics.ts           # NEW — analytics-as-a-service endpoints
      cases.ts               # NEW — case data access (read-only)
      wallets.ts             # NEW — wallet analysis endpoints
      health.ts              # NEW — API health + usage stats
      index.ts               # NEW — v1 router aggregator
  lib/
    api-key-store.ts         # NEW — key generation, validation, rotation
    api-key-types.ts         # NEW — key interfaces
  app.ts                     # MODIFY — mount v1 routes, apply global middleware
```

## Code Style

Follow existing Express patterns. Example API key middleware:

```typescript
// middlewares/api-key-auth.ts
import type { Request, Response, NextFunction } from "express";
import { validateApiKey } from "../lib/api-key-store";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key) {
    return res.status(401).json({
      error: "MISSING_API_KEY",
      message: "X-Api-Key header required",
    });
  }
  const record = validateApiKey(key);
  if (!record) {
    return res.status(403).json({
      error: "INVALID_API_KEY",
      message: "API key not recognized or revoked",
    });
  }
  req.apiConsumer = record;
  next();
}
```

## API Endpoints (v1)

### Authentication
- `POST /api/v1/auth/keys` — generate new API key (admin only)
- `GET /api/v1/auth/keys` — list active keys
- `DELETE /api/v1/auth/keys/:keyId` — revoke key
- `POST /api/v1/auth/keys/:keyId/rotate` — rotate key

### Analytics
- `GET /api/v1/analytics/overview` — dashboard metrics (case counts, exposure, risk distribution)
- `GET /api/v1/analytics/fraud-patterns` — recurring fraud pattern analysis
- `GET /api/v1/analytics/hotspots` — ATM/location concentration data
- `GET /api/v1/analytics/corridors` — corridor vulnerability scores

### Cases (Read-Only)
- `GET /api/v1/cases` — list cases with filtering
- `GET /api/v1/cases/:caseId` — case detail
- `GET /api/v1/cases/:caseId/fund-flow` — fund-flow graph
- `GET /api/v1/cases/:caseId/transactions` — transaction timeline
- `GET /api/v1/cases/:caseId/report` — investigation report

### Wallets
- `GET /api/v1/wallets` — list tracked wallets
- `GET /api/v1/wallets/:address` — wallet analysis
- `POST /api/v1/wallets/:address/trace` — multi-hop fund trace

### Webhooks
- `POST /api/v1/webhooks` — subscribe to events (new_case, risk_alert, intervention)
- `GET /api/v1/webhooks` — list subscriptions
- `DELETE /api/v1/webhooks/:id` — unsubscribe

## Rate Limiting

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 10 | 20 |
| Standard | 100 | 200 |
| Enterprise | 1000 | 2000 |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Testing Strategy

- Typecheck all new files
- Integration tests: verify API key auth blocks unauthenticated requests
- Integration tests: verify rate limiter returns 429 when exceeded
- Integration tests: verify v1 endpoints return correct data shapes
- Integration tests: verify provenance metadata in all responses

## Boundaries

- Always: all responses include `provenance` field, versioned API paths, rate limit headers
- Ask first: database schema changes for API key persistence, webhook delivery infrastructure
- Never: expose write operations (create/delete cases) via external API, expose internal JWT auth, return unmasked PII

## Success Criteria

- [ ] API key middleware validates `X-Api-Key` header
- [ ] Rate limiting returns 429 with standard headers
- [ ] All v1 endpoints return data with provenance metadata
- [ ] OpenAPI spec auto-generated from route definitions
- [ ] Key generation, rotation, and revocation work
- [ ] Existing internal `/api/*` routes are unaffected
- [ ] Typecheck passes

## Open Questions

- Should webhooks be in MVP or deferred?
- Should the API key store be in-memory only (MVP) or backed by the existing DB?
- Should we publish an OpenAPI spec file, or just auto-generate from code?
