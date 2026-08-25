# Provider replacement

Use the synthetic API as the contract fixture. A future provider must:

1. Authenticate through server-side environment/secrets.
2. Return a normalized object plus `source_type`, `source_reference`, confidence, and timestamps.
3. Return `PROVIDER_UNAVAILABLE` when a chain or service is unsupported.
4. Preserve unknown entities and mark cross-chain links as possible unless verified.
5. Add tests for authorization failures, rate limits, partial responses, and stale data.
6. Keep Supabase RLS and role checks in front of sensitive records.

Never present an inferred VASP attribution, risk score, or cash-out hotspot as a confirmed fact.