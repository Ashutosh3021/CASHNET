# CASHNET

CASHNET turns synthetic scam reports into a connected investigator workflow spanning fund flow, crypto conversion, cash-out prediction, intervention review, audit, and reporting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Synthetic mode is the default and needs no external credentials. See `.env.example` and `README.md` for optional Supabase/provider variables.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cashnet/src/App.tsx` — investigator application and route-level workflow
- `artifacts/api-server/src/routes/cashnet.ts` — case-centric synthetic intelligence API
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `database/schema.sql` — portable Supabase/PostgreSQL starting schema
- `docs/` — architecture and provider replacement guidance

## Architecture decisions

- Synthetic data is deterministic and case-linked so graph, timeline, risk, map, intervention, and report views cannot drift apart.
- Fiat-to-crypto conversion is a first-class timestamped event, not an inferred label in the UI.
- Intervention approval is explicit and does not contact or freeze any account.
- Provider interfaces preserve provenance and leave room for authorized APIs without making them required.

## Product

The app supports complaint ingestion, four demonstration cases, linked account and transaction intelligence, multi-hop fund-flow playback, wallet/VASP analysis, explainable risk, predicted ATM hotspots, actionable recommendations, bank/branch resolution, draft-and-approve interventions, audit trail, and reports.

## User preferences

- Keep scam report ingestion as the starting point and make the fiat-to-crypto conversion time unambiguous.

## Gotchas

- Run API and web workflows together; the web uses `/api` through the shared proxy.
- Generated Zod currently targets a compatibility-safe numeric representation for integer-like fields.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
