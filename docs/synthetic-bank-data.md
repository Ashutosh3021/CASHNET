# Synthetic bank transaction data

The bank pipeline reads `data/synthetic/complaints/complaint_account_registry.json` as its only account registry and converts every complaint transaction into the existing `bank_transaction_data` schema. It never creates a second account identity set. Join details and provenance are stored in `bank_transaction_metadata.json`.

Generate with `python scripts/bank/generate_bank_transactions.py`, then validate with `python scripts/bank/validate_bank_transactions.py --validate`. All generated records are synthetic, use masked account numbers, and are for development, testing, demonstration, and model evaluation only.
