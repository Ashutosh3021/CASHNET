# CASHNET architecture

The API exposes one case-centric data graph. The seeded case detail is assembled from the same complaint, account, transaction, graph, wallet, VASP, risk, prediction, intervention, and audit objects. The UI never manufactures analytical results.

The synthetic provider is deliberately deterministic: timestamps drive playback and conversion visibility; graph edges drive downstream relationships; account and wallet objects reference those edges; hotspot factors are derived from the selected last-known account and synthetic location features.

Provider seams to replace later:

- `BlockchainProvider`: wallet transactions, balances, blocks, and traces.
- `BankProvider`: account/branch resolution and authorized request lifecycle.
- `VASPProvider`: attribution and disclosure-preservation workflows.
- `EventBusProvider`: MockEventBus now; Kafka adapter later.
- `SearchProvider`: local filtering now; Elasticsearch adapter later.

Safety boundary: the intervention API only creates a draft and changes it to APPROVED after an explicit user action. Submission is not automated.