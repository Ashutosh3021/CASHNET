#!/usr/bin/env python3
"""Generate deterministic, graph-connected, synthetic CASHNET bank records.

No records created by this program are real banking activity or credentials.
The nested ``bank_transaction_data`` object deliberately matches IN/Banks.json.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "data" / "reference"
OUTPUT = ROOT / "data" / "synthetic" / "bank"
BANKS = json.loads((REFERENCE / "banks.json").read_text(encoding="utf-8"))
CITIES = json.loads((REFERENCE / "cities.json").read_text(encoding="utf-8"))
CITY_MAP = {item["city"]: item["state"] for item in CITIES}
CHANNELS = ("UPI", "IMPS", "NEFT", "RTGS")
WEIGHTS = (55, 25, 15, 5)
NAMES = ("Aarav Sharma", "Vivaan Patel", "Aditya Singh", "Ananya Gupta", "Diya Nair", "Ishaan Kumar", "Kavya Iyer", "Rohan Das", "Meera Shah", "Arjun Mehta", "Sana Khan", "Neha Verma")
PROFILES = ("LOW_ACTIVITY", "MEDIUM_ACTIVITY", "HIGH_ACTIVITY", "BUSINESS_ACTIVITY")


def provenance(seed: int) -> dict[str, Any]:
    return {"transaction_source": "SYNTHETIC", "generation_engine": "CASHNET", "generator_version": "1.0.0", "generated_at": "2026-08-29T00:00:00Z", "seed": seed}


class Dataset:
    def __init__(self, seed: int):
        self.rng = random.Random(seed); self.seed = seed; self.accounts: dict[str, dict[str, Any]] = {}; self.records: list[dict[str, Any]] = []; self.links: list[dict[str, Any]] = []

    def account(self, identifier: str | None = None, city: str | None = None, role: str = "CUSTOMER", complaint_id: str | None = None) -> str:
        identifier = identifier or f"ACCOUNT-{len(self.accounts)+1:06d}"
        if identifier in self.accounts: return identifier
        city = city or self.rng.choice(CITIES)["city"]
        bank = self.rng.choice(BANKS); number = f"XXXXXXXXX{1000 + len(self.accounts):04d}"
        self.accounts[identifier] = {"account_id": identifier, "account_number": number, "bank_name": bank, "ifsc_code": f"SYNTHETIC-{''.join(word[0] for word in bank.split()[:2]).upper()}-{len(self.accounts)+1:03d}", "account_holder": self.rng.choice(NAMES), "city": city, "state": CITY_MAP[city], "activity_profile": self.rng.choice(PROFILES), "role": role, "complaint_id": complaint_id}
        return identifier

    def amount(self, suspicious: bool = False) -> int:
        # Intentional normal/suspicious range overlap: fraud is structural, not value-only.
        bands = [(100, 5000), (5001, 10000), (10001, 25000), (25001, 50000), (50001, 100000), (100001, 250000)]
        low, high = self.rng.choice(bands if suspicious else bands[:5])
        return self.rng.randrange(low // 100, high // 100 + 1) * 100

    def transaction(self, source: str, destination: str, timestamp: datetime, amount: int, suspicious: bool = False, scenario_id: str | None = None, scenario_type: str | None = None, reason: str | None = None, hop: int = 0) -> None:
        if source == destination: raise ValueError("source and destination must differ")
        source_row, destination_row = self.accounts[source], self.accounts[destination]
        tx_id = f"BANK-TXN-{len(self.records)+1:08d}"
        bank_data = {"transaction_id": tx_id, "source_account": {key: source_row[key] for key in ("account_number", "bank_name", "ifsc_code", "account_holder", "city", "state")}, "destination_account": {key: destination_row[key] for key in ("account_number", "bank_name", "ifsc_code", "account_holder", "city", "state")}, "transaction_amount": amount, "currency": "INR", "timestamp": timestamp.replace(microsecond=0).isoformat().replace("+00:00", "Z"), "transaction_type": self.rng.choices(CHANNELS, weights=WEIGHTS)[0], "status": "completed"}
        self.records.append({"bank_transaction_data": bank_data, "account_references": {"source_account_id": source, "destination_account_id": destination}, "scenario_metadata": {"is_synthetic": True, "is_suspicious": suspicious, "scenario_id": scenario_id, "scenario_type": scenario_type, "suspicion_reason": reason, "hop_count": hop}})

    def normal(self, count: int, days: int) -> None:
        anchor = datetime(2026, 8, 29, tzinfo=UTC)
        ids = list(self.accounts)
        while len(self.records) < count:
            source, destination = self.rng.sample(ids, 2)
            # daytime-biased, diverse recurring-like normal activity
            timestamp = anchor - timedelta(days=self.rng.randrange(days), hours=self.rng.choices(range(24), weights=[1]*6+[3]*12+[2]*5+[1])[0], minutes=self.rng.randrange(60))
            self.transaction(source, destination, timestamp, self.amount(), False)

    def suspicious(self, target: int, days: int) -> None:
        anchor = datetime(2026, 8, 29, tzinfo=UTC)
        types = ("MULE_ACCOUNT", "MULTI_HOP_FUND_FLOW", "MANY_TO_ONE", "ONE_TO_MANY", "RAPID_TRANSFER", "GEOGRAPHICALLY_UNUSUAL", "STRUCTURED_LAYERING")
        scenario = 0
        while sum(r["scenario_metadata"]["is_suspicious"] for r in self.records) < target:
            kind = types[scenario % len(types)]; scenario += 1; sid = f"{kind}-{scenario:04d}"; base = anchor - timedelta(days=scenario % days, hours=1)
            needed = min(5, target - sum(r["scenario_metadata"]["is_suspicious"] for r in self.records))
            reason = {"MULE_ACCOUNT":"Victim funds received by mule account", "MULTI_HOP_FUND_FLOW":"Rapid movement through linked mule accounts", "MANY_TO_ONE":"Multiple victims paid one destination", "ONE_TO_MANY":"One mule dispersed funds to multiple accounts", "RAPID_TRANSFER":"Successive transfers within minutes", "GEOGRAPHICALLY_UNUSUAL":"Mumbai source followed by Delhi cash-out path", "STRUCTURED_LAYERING":"Layered movement through multiple accounts"}[kind]
            if kind == "MANY_TO_ONE":
                mule = self.account(city="Delhi", role="MULE")
                for i in range(needed): self.transaction(self.account(city="Mumbai", role="VICTIM"), mule, base + timedelta(minutes=i*2), self.amount(True), True, sid, kind, reason, 1)
            elif kind == "ONE_TO_MANY":
                mule = self.account(city="Delhi", role="MULE")
                for i in range(needed): self.transaction(mule, self.account(role="MULE" if i < 3 else "MERCHANT"), base + timedelta(minutes=i*3), self.amount(True), True, sid, kind, reason, 1)
            else:
                cities = ["Mumbai", "Delhi", "Gurugram", "Delhi", "Noida", "Delhi"] if kind == "GEOGRAPHICALLY_UNUSUAL" else [None] * 6
                chain = [self.account(city=cities[i], role="MULE" if i else "VICTIM") for i in range(needed + 1)]
                if kind == "MULE_ACCOUNT":
                    # The supplied masked complaint identifier is represented by a
                    # registry account, never a real credential or bank record.
                    chain[0] = "ACCOUNT-CMP-000001"
                for i in range(needed): self.transaction(chain[i], chain[i+1], base + timedelta(minutes=i*3), self.amount(True), True, sid, kind, reason, i+1)
                if kind in ("RAPID_TRANSFER", "GEOGRAPHICALLY_UNUSUAL"):
                    self.links.append({"scenario_id": sid, "source_account_id": chain[-1], "atm_id": "ATM-DEL-000001", "link_type": "SYNTHETIC_CASH_OUT_REFERENCE"})


def build(transactions: int, fraud_rate: float, days: int, seed: int) -> Dataset:
    if not 0 <= fraud_rate < 1 or transactions < 1 or days < 1: raise ValueError("transactions/days must be positive and fraud rate must be below 1")
    data = Dataset(seed)
    # Registry first: accounts are reused across all later graph edges.
    for _ in range(max(750, transactions // 18)): data.account()
    # Preserve a complaint-compatible synthetic victim link without copying contact data.
    data.account("ACCOUNT-CMP-000001", "Mumbai", "VICTIM", "CMP-2026-08-25-001234")
    data.suspicious(round(transactions * fraud_rate), days)
    data.normal(transactions, days)
    return data


def validate(dataset: dict[str, Any]) -> list[str]:
    errors: list[str] = []; accounts = {a["account_id"]: a for a in dataset["accounts"]}; ids = set()
    for record in dataset["transactions"]:
        row, refs = record["bank_transaction_data"], record["account_references"]
        if row["transaction_id"] in ids: errors.append("duplicate transaction ID")
        ids.add(row["transaction_id"])
        if refs["source_account_id"] not in accounts or refs["destination_account_id"] not in accounts: errors.append("unknown account reference")
        if refs["source_account_id"] == refs["destination_account_id"]: errors.append("self transfer")
        if row["currency"] != "INR" or row["transaction_type"] not in CHANNELS or row["status"] != "completed" or row["transaction_amount"] <= 0: errors.append("invalid transaction fields")
        for side in ("source_account", "destination_account"):
            account = row[side]
            if not account["account_number"].startswith("XXXXXXXXX") or CITY_MAP.get(account["city"]) != account["state"]: errors.append("invalid account fields")
    for link in dataset.get("atm_links", []):
        if link["source_account_id"] not in accounts: errors.append("invalid ATM link")
    return errors


def write(dataset: Dataset, transactions: int, fraud_rate: float, days: int, csv_output: bool) -> Path:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    payload = {"metadata": {"record_count": transactions, "historical_days": days, "fraud_rate": fraud_rate, "data_provenance": provenance(dataset.seed)}, "accounts": list(dataset.accounts.values()), "transactions": dataset.records, "atm_links": dataset.links}
    errors = validate(payload)
    if errors: raise ValueError("; ".join(errors))
    json_path = OUTPUT / "bank_transactions.json"; json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (OUTPUT / "account_registry.json").write_text(json.dumps({"data_provenance": provenance(dataset.seed), "accounts": payload["accounts"]}, indent=2), encoding="utf-8")
    (OUTPUT / "transaction_graph.json").write_text(json.dumps({"nodes": list(dataset.accounts), "edges": [{"transaction_id": r["bank_transaction_data"]["transaction_id"], **r["account_references"]} for r in dataset.records]}, indent=2), encoding="utf-8")
    (OUTPUT / "atm_withdrawal_links.json").write_text(json.dumps({"data_provenance": provenance(dataset.seed), "links": dataset.links}, indent=2), encoding="utf-8")
    complaint_links = [{"complaint_id": a["complaint_id"], "account_id": a["account_id"], "transaction_ids": [r["bank_transaction_data"]["transaction_id"] for r in dataset.records if r["account_references"]["source_account_id"] == a["account_id"]]} for a in payload["accounts"] if a.get("complaint_id")]
    (OUTPUT / "complaint_transaction_links.json").write_text(json.dumps({"data_provenance": provenance(dataset.seed), "links": complaint_links}, indent=2), encoding="utf-8")
    if csv_output:
        with (OUTPUT / "bank_transactions.csv").open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=["transaction_id", "source_account_id", "destination_account_id", "amount", "timestamp", "transaction_type", "is_suspicious", "scenario_id"]); writer.writeheader()
            for r in dataset.records: writer.writerow({"transaction_id": r["bank_transaction_data"]["transaction_id"], "source_account_id": r["account_references"]["source_account_id"], "destination_account_id": r["account_references"]["destination_account_id"], "amount": r["bank_transaction_data"]["transaction_amount"], "timestamp": r["bank_transaction_data"]["timestamp"], "transaction_type": r["bank_transaction_data"]["transaction_type"], "is_suspicious": r["scenario_metadata"]["is_suspicious"], "scenario_id": r["scenario_metadata"]["scenario_id"]})
    return json_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--transactions", type=int, default=10000); parser.add_argument("--fraud-rate", type=float, default=.10); parser.add_argument("--days", type=int, default=90); parser.add_argument("--seed", type=int, default=42); parser.add_argument("--csv", action="store_true"); parser.add_argument("--validate", action="store_true")
    args = parser.parse_args(); path = OUTPUT / "bank_transactions.json"
    if args.validate:
        if not path.exists(): sys.exit(f"No dataset at {path}")
        errors = validate(json.loads(path.read_text(encoding="utf-8")))
        if errors: sys.exit("Validation failed: " + "; ".join(errors))
        print(f"Validated {path}"); return
    dataset = build(args.transactions, args.fraud_rate, args.days, args.seed); output = write(dataset, args.transactions, args.fraud_rate, args.days, args.csv)
    print(f"Generated {args.transactions} synthetic graph-connected bank transactions in {output}")


if __name__ == "__main__": main()
