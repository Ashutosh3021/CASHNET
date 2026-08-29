#!/usr/bin/env python3
"""Controlled OpenStreetMap ATM reference-data import for CASHNET.

This program imports *reference locations only*.  It never claims that the
synthetic withdrawals it can generate are bank records or OSM transactions.
Run with ``--dry-run`` to inspect an Overpass result without writing files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REFERENCE_DIR = ROOT / "data" / "reference" / "osm-atms"
SYNTHETIC_DIR = ROOT / "data" / "synthetic"
OVERPASS_URLS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")
CITIES = {
    "delhi": ("Delhi", "Delhi", "DEL"),
    "mumbai": ("Mumbai", "Maharashtra", "MUM"),
    "bengaluru": ("Bengaluru", "Karnataka", "BLR"),
    "hyderabad": ("Hyderabad", "Telangana", "HYD"),
    "ahmedabad": ("Ahmedabad", "Gujarat", "AMD"),
    "chennai": ("Chennai", "Tamil Nadu", "MAA"),
    "pune": ("Pune", "Maharashtra", "PUN"),
    "gurugram": ("Gurugram", "Haryana", "GUR"),
    "noida": ("Noida", "Uttar Pradesh", "NOI"),
    "kolkata": ("Kolkata", "West Bengal", "CCU"),
}


def iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_city(value: str) -> str:
    key = value.strip().casefold().replace("new delhi", "delhi").replace("bangalore", "bengaluru")
    if key not in CITIES:
        raise ValueError(f"Unsupported city {value!r}. Choose one of: {', '.join(c[0] for c in CITIES.values())}")
    return key


def overpass_query(city_name: str) -> str:
    # Administrative area prevents broad city-name geocoding and includes nodes,
    # ways, and relations. `out center` supplies coordinates for non-nodes.
    return f'''[out:json][timeout:120];
area["boundary"="administrative"]["name"="{city_name}"]->.city;
(
  nwr["amenity"="atm"](area.city);
  nwr["amenity"="bank"]["atm"](area.city);
);
out center tags;'''


def request_overpass(query: str) -> dict[str, Any]:
    # Explicit ingestion can occasionally meet public endpoint rate limits. Retry
    # slowly, then use a documented public mirror; dashboard code never calls this.
    last_error: Exception | None = None
    for attempt in range(4):
        url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
        request = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "CASHNET-ATM-reference-import/1.0 (controlled offline cache)"})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Overpass import failed after controlled retries: {last_error}")


def coordinate(element: dict[str, Any]) -> tuple[float, float] | None:
    point = element if element.get("type") == "node" else element.get("center", {})
    lat, lon = point.get("lat"), point.get("lon")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return float(lat), float(lon)


def address(tags: dict[str, str]) -> str | None:
    parts = [tags.get(k) for k in ("addr:housenumber", "addr:street", "addr:suburb") if tags.get(k)]
    return ", ".join(parts) or tags.get("addr:full") or None


def normalize_elements(elements: list[dict[str, Any]], city_key: str, retrieved_at: str) -> list[dict[str, Any]]:
    city, state, prefix = CITIES[city_key]
    candidates: list[dict[str, Any]] = []
    for element in elements:
        tags = element.get("tags", {})
        if tags.get("amenity") != "atm" and not (tags.get("amenity") == "bank" and tags.get("atm")):
            continue
        point = coordinate(element)
        if point is None or not isinstance(element.get("id"), int):
            continue
        lat, lon = point
        osm_type, osm_id = element.get("type", "unknown"), str(element["id"])
        candidates.append({
            "_osm_key": f"{osm_type}/{osm_id}", "_lat": lat, "_lon": lon,
            "_tags": tags,
            "location": {"address": address(tags), "city": tags.get("addr:city") or city,
                         "state": tags.get("addr:state") or state, "pincode": tags.get("addr:postcode"),
                         "coordinates": {"latitude": round(lat, 7), "longitude": round(lon, 7)}},
            "bank_name": tags.get("operator") or tags.get("brand") or None,
            "source": {"provider": "OpenStreetMap", "osm_type": osm_type, "osm_id": osm_id,
                       "retrieved_at": retrieved_at, "data_status": "REFERENCE_LOCATION",
                       "osm_metadata": {k: tags[k] for k in ("name", "operator", "brand", "ref", "amenity", "addr:full") if k in tags}},
        })
    return deduplicate(candidates, prefix)


def distance_metres(a: dict[str, Any], b: dict[str, Any]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a["_lat"], a["_lon"], b["_lat"], b["_lon"]))
    return 6371000 * 2 * math.asin(math.sqrt(math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2))


def deduplicate(candidates: list[dict[str, Any]], prefix: str, proximity_metres: float = 20) -> list[dict[str, Any]]:
    """Prefer distinct OSM objects; collapse obvious duplicate POIs within 20m."""
    seen_osm, output = set(), []
    for row in sorted(candidates, key=lambda r: r["_osm_key"]):
        if row["_osm_key"] in seen_osm:
            continue
        seen_osm.add(row["_osm_key"])
        if any(distance_metres(row, existing) <= proximity_metres for existing in output):
            continue
        output.append(row)
    for number, row in enumerate(output, 1):
        row["atm_id"] = f"ATM-{prefix}-{number:06d}"
        row.pop("_osm_key", None); row.pop("_lat", None); row.pop("_lon", None); row.pop("_tags", None)
    return output


def import_city(city_key: str, dry_run: bool = False) -> list[dict[str, Any]]:
    retrieved_at = iso_now()
    payload = request_overpass(overpass_query(CITIES[city_key][0]))
    rows = normalize_elements(payload.get("elements", []), city_key, retrieved_at)
    if dry_run:
        print(json.dumps({"city": CITIES[city_key][0], "would_import": len(rows), "sample": rows[:2]}, indent=2))
        return rows
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    output = REFERENCE_DIR / f"{city_key}.json"
    output.write_text(json.dumps({"metadata": {"provider": "OpenStreetMap", "license": "ODbL 1.0", "attribution": "© OpenStreetMap contributors", "retrieved_at": retrieved_at, "data_status": "REFERENCE_LOCATION"}, "atms": rows}, indent=2), encoding="utf-8")
    print(f"Imported {len(rows)} reference ATMs into {output}")
    return rows


def load_reference(city_keys: list[str]) -> list[dict[str, Any]]:
    rows = []
    for city in city_keys:
        path = REFERENCE_DIR / f"{city}.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing {path}. Import the city first.")
        rows.extend(json.loads(path.read_text(encoding="utf-8"))["atms"])
    if not rows:
        raise ValueError("No ATM reference locations available")
    return rows


def token(value: str, length: int = 4) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[-length:].upper()


def withdrawal(index: int, atm: dict[str, Any], timestamp: datetime, amount: int, suspicious: bool, scenario: str | None, reason: str | None) -> dict[str, Any]:
    account = f"XXXXXXXXX{1000 + index % 9000:04d}"
    payload = {"atm_withdrawal_data": {"withdrawal_id": f"SYN-ATM-{index:06d}", "atm_details": {"atm_id": atm["atm_id"], "bank_name": atm["bank_name"], "location": atm["location"]}, "card_details": {"card_number": f"XXXX-XXXX-XXXX-{token(str(index))}", "card_type": "Debit Card", "issuing_bank": atm["bank_name"] or "Unknown issuing bank", "account_number": account}, "withdrawal_details": {"amount": amount, "currency": "INR", "timestamp": timestamp.isoformat().replace("+00:00", "Z"), "status": "successful", "cash_dispensed": True}}, "data_provenance": {"atm_location_source": "OpenStreetMap", "transaction_source": "SYNTHETIC", "generation_engine": "CASHNET", "generated_at": iso_now()}, "ground_truth": {"is_synthetic": True, "is_suspicious": suspicious, "scenario_id": scenario, "suspicion_reason": reason}}
    return payload


def generate_withdrawals(city_keys: list[str], count: int = 10000, seed: int = 184) -> Path:
    atms = load_reference(city_keys)
    by_city: dict[str, list[dict[str, Any]]] = {}
    for atm in atms: by_city.setdefault(atm["location"]["city"].casefold(), []).append(atm)
    rng, now, rows = random.Random(seed), datetime.now(UTC), []
    scenarios = [("A", "mumbai", "delhi", "Mumbai victim → Delhi mule account → Delhi ATM"), ("B", "mumbai", "gurugram", "Mumbai victim → Gurugram mule → Gurugram ATM"), ("C", "mumbai", "delhi", "Multiple victims → same mule account → multiple Delhi ATMs"), ("D", "delhi", "delhi", "Multiple mule accounts → same ATM cluster")]
    available_scenarios = [s for s in scenarios if s[2] in by_city]
    for i in range(1, count + 1):
        suspicious = i <= min(2000, count // 4) and bool(available_scenarios)
        scenario = reason = None
        if suspicious:
            code, _, target, reason = available_scenarios[(i - 1) % len(available_scenarios)]
            pool = by_city[target]
            # A tight cluster rather than uniform random placement creates meaningful heatmap hotspots.
            atm = pool[(i // 7) % min(len(pool), 12)]
            scenario = f"ATM-FRAUD-{code}"
            timestamp = now - timedelta(days=i % 30, minutes=(i % 5) * 3)
            amount = rng.choice([40000, 50000, 75000, 100000])
        else:
            atm = rng.choice(atms); timestamp = now - timedelta(days=rng.randrange(180), minutes=rng.randrange(1440)); amount = rng.choice([500, 1000, 2000, 5000, 10000, 20000])
        rows.append(withdrawal(i, atm, timestamp, amount, suspicious, scenario, reason))
    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
    output = SYNTHETIC_DIR / "ATM.json"
    output.write_text(json.dumps({"metadata": {"data_status": "SYNTHETIC_WITHDRAWALS", "record_count": count, "seed": seed, "reference_data": "OpenStreetMap cached import"}, "withdrawals": rows}, indent=2), encoding="utf-8")
    print(f"Generated {count} synthetic withdrawals in {output}")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    importer = sub.add_parser("import", help="Fetch and cache OSM ATM reference locations")
    importer.add_argument("--city", required=True); importer.add_argument("--dry-run", action="store_true")
    generator = sub.add_parser("generate", help="Generate synthetic withdrawals from cached reference locations")
    generator.add_argument("--cities", nargs="+", default=["delhi", "mumbai", "bengaluru", "hyderabad", "ahmedabad"]); generator.add_argument("--count", type=int, default=10000)
    args = parser.parse_args()
    if args.command == "import": import_city(canonical_city(args.city), args.dry_run)
    else: generate_withdrawals([canonical_city(c) for c in args.cities], args.count)


if __name__ == "__main__":
    main()
