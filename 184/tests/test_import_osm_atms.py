import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "scripts" / "geospatial" / "import_osm_atms.py"
spec = importlib.util.spec_from_file_location("osm", MODULE)
osm = importlib.util.module_from_spec(spec); spec.loader.exec_module(osm)


class OSMImportTests(unittest.TestCase):
    def test_missing_bank_and_coordinate_validation(self):
        elements = [{"type": "node", "id": 2, "lat": 28.6, "lon": 77.2, "tags": {"amenity": "atm"}}, {"type": "node", "id": 3, "lat": 99, "lon": 77.2, "tags": {"amenity": "atm"}}]
        rows = osm.normalize_elements(elements, "delhi", "2026-01-01T00:00:00Z")
        self.assertEqual(len(rows), 1); self.assertIsNone(rows[0]["bank_name"]); self.assertEqual(rows[0]["atm_id"], "ATM-DEL-000001")

    def test_osm_and_proximity_duplicates(self):
        elements = [{"type": "node", "id": 1, "lat": 28.600000, "lon": 77.200000, "tags": {"amenity": "atm", "operator": "Bank"}}, {"type": "node", "id": 2, "lat": 28.600010, "lon": 77.200010, "tags": {"amenity": "atm", "operator": "Bank"}}]
        self.assertEqual(len(osm.normalize_elements(elements, "delhi", "now")), 1)

    def test_city_alias(self):
        self.assertEqual(osm.canonical_city("Bangalore"), "bengaluru")

    def test_synthetic_schema_and_cluster_ground_truth(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            reference, synthetic = root / "reference", root / "synthetic"
            reference.mkdir()
            for city, state, prefix, lat, lon in [("delhi", "Delhi", "DEL", 28.6, 77.2), ("mumbai", "Maharashtra", "MUM", 19.0, 72.8)]:
                atms = [{"atm_id": f"ATM-{prefix}-{i:06d}", "bank_name": None, "location": {"address": None, "city": city.title(), "state": state, "pincode": None, "coordinates": {"latitude": lat + i / 1000, "longitude": lon}}, "source": {"provider": "OpenStreetMap"}} for i in range(1, 15)]
                (reference / f"{city}.json").write_text(json.dumps({"atms": atms}))
            old_reference, old_synthetic = osm.REFERENCE_DIR, osm.SYNTHETIC_DIR
            try:
                osm.REFERENCE_DIR, osm.SYNTHETIC_DIR = reference, synthetic
                output = osm.generate_withdrawals(["delhi", "mumbai"], count=40)
            finally:
                osm.REFERENCE_DIR, osm.SYNTHETIC_DIR = old_reference, old_synthetic
            rows = json.loads(output.read_text())["withdrawals"]
            self.assertEqual(len(rows), 40)
            first = rows[0]
            self.assertIn("atm_withdrawal_data", first)
            self.assertIn("data_provenance", first)
            self.assertTrue(first["ground_truth"]["is_synthetic"])
            suspicious = [r for r in rows if r["ground_truth"]["is_suspicious"]]
            self.assertGreater(len(suspicious), 0)
            self.assertLessEqual(len({r["atm_withdrawal_data"]["atm_details"]["atm_id"] for r in suspicious}), 12)


if __name__ == "__main__": unittest.main()
