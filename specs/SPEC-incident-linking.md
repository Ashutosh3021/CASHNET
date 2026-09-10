# Spec: incident-linking

## Objective

Add automated cross-case entity linking and complaint similarity discovery to CASHNET Intelligence. Currently, `cases-extended.ts` has an entity registry with a `relatedCases` field, but the links are hardcoded in seed data. This module adds:

1. **Entity-based incident linking** — when two cases share accounts, wallets, or identifiers, automatically flag them as related
2. **Complaint similarity** — match incoming complaints against existing cases using text similarity and shared indicator extraction

**Success criteria:**
- When a new case is added with an account already linked to another case, the system auto-creates a cross-case link
- Complaint narratives can be compared against existing cases and ranked by similarity
- The entity registry endpoint returns auto-discovered relationships alongside seeded ones
- Existing seed data continues to work unchanged

## Tech Stack

- TypeScript (Express route additions)
- Existing `cases-extended.ts` entity registry as the data layer
- No new dependencies — use string similarity (Levenshtein or Jaccard on extracted indicators)

## Commands

```
Build: pnpm --filter @workspace/api-server run build
Test: pnpm --filter @workspace/api-server run typecheck
Dev: pnpm --filter @workspace/api-server run dev
```

## Project Structure

```
artifacts/api-server/src/
  services/
    incident-linking.ts     # NEW — entity overlap + complaint similarity engine
  routes/
    cases-extended.ts       # MODIFY — wire auto-linking into entity registry
```

## Code Style

Follow existing patterns in `artifacts/api-server/src/services/`:

```typescript
// services/incident-linking.ts
import type { CaseDetail } from "@workspace/api-zod";

export interface LinkedIncident {
  caseId: string;
  reference: string;
  sharedEntities: string[];
  similarityScore: number;
  linkType: "entity_overlap" | "complaint_similarity";
}

export function findLinkedIncidents(
  targetCase: CaseDetail,
  allCases: CaseDetail[]
): LinkedIncident[] {
  // 1. Entity overlap: check accounts, wallets, identifiers
  // 2. Complaint similarity: extract indicators, compute overlap
  // 3. Merge and dedupe results
}
```

## Testing Strategy

- Add test cases in `tests/test_incident_linking.py` or a new TypeScript test file
- Verify: two cases sharing an account produce a link with `linkType: "entity_overlap"`
- Verify: similar complaint narratives produce a link with `linkType: "complaint_similarity"`
- Verify: unrelated cases produce no links
- Verify: seed data relationships are preserved

## Boundaries

- Always: preserve existing seeded relationships, don't break `/cases-extended` endpoints
- Ask first: changing the entity registry schema
- Never: auto-merge cases, auto-delete relationships, modify complaint narratives

## Success Criteria

- [ ] `findLinkedIncidents()` returns entity-overlap links when cases share accounts/wallets
- [ ] `findLinkedIncidents()` returns complaint-similarity links for related narratives
- [ ] Entity registry endpoint includes auto-discovered links in response
- [ ] No regressions in existing case workspace or entity registry
- [ ] Typecheck passes

## Open Questions

- Should similarity threshold be configurable or hardcoded at 0.7?
- Should linked incidents be persisted or computed on-the-fly?
