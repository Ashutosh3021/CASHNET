import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[2] / "scripts" / "banking" / "generate_bank_transactions.py"
spec = importlib.util.spec_from_file_location("bank", MODULE); bank = importlib.util.module_from_spec(spec); spec.loader.exec_module(bank)

class BankGeneratorTests(unittest.TestCase):
    def test_graph_schema_and_integrity(self):
        dataset = bank.build(200, .15, 90, 42)
        payload = {"accounts": list(dataset.accounts.values()), "transactions": dataset.records, "atm_links": dataset.links}
        self.assertEqual(len(dataset.records), 200); self.assertEqual(bank.validate(payload), [])
        self.assertTrue(any(r["scenario_metadata"]["is_suspicious"] for r in dataset.records))
        self.assertTrue(any(link["source_account_id"] in dataset.accounts for link in dataset.links))

    def test_deterministic_and_city_state(self):
        a, b = bank.build(80, .1, 30, 7), bank.build(80, .1, 30, 7)
        self.assertEqual(a.records, b.records)
        self.assertTrue(all(bank.CITY_MAP[a["city"]] == a["state"] for a in a.accounts.values()))

if __name__ == "__main__": unittest.main()
