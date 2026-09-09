"""Verify geospatial engine: hotspot detection, proximity, edge cases."""
import sys
sys.path.insert(0, 'C:/Users/ashut/Downloads/CASHNET')

# Test the TypeScript-side engine via the synthetic data module
# (we verify the Python hotspot logic from services/geospatial/app.py)
from services.geospatial.app import hotspots, filtered

# Simulate load_data behavior using the synthetic data records
import json
from pathlib import Path

# Check if synthetic geo data file exists
geo_data_file = Path('C:/Users/ashut/Downloads/CASHNET/services/geospatial/data/synthetic-geospatial.json')
print(f"Synthetic geo data file exists: {geo_data_file.exists()}")

# Check OSM ATM data
osm_dir = Path('C:/Users/ashut/Downloads/CASHNET/data/reference/osm-atms')
osm_files = list(osm_dir.glob('*.json'))
print(f"\nOSM ATM files found: {len(osm_files)}")

total_osm_atms = 0
for f in osm_files:
    data = json.loads(f.read_text(encoding='utf-8'))
    atm_count = len(data.get('atms', []))
    total_osm_atms += atm_count
    # Verify coordinates
    for atm in data.get('atms', [])[:2]:
        loc = atm.get('location', {})
        coords = loc.get('coordinates', {})
        lat = coords.get('latitude')
        lng = coords.get('longitude')
        provider = data.get('metadata', {}).get('provider', 'unknown')
        print(f"  {f.name}: {atm_count} ATMs | sample lat={lat}, lng={lng} | provider={provider}")
        break

print(f"\nTotal real OSM ATMs: {total_osm_atms}")

# Verify coordinate ranges are valid India coordinates
print("\n=== Coordinate Validation ===")
india_lat_range = (8.0, 37.0)
india_lng_range = (68.0, 97.5)

errors = 0
for f in osm_files:
    data = json.loads(f.read_text(encoding='utf-8'))
    for atm in data.get('atms', []):
        loc = atm.get('location', {})
        coords = loc.get('coordinates', {})
        lat = coords.get('latitude')
        lng = coords.get('longitude')
        if lat is not None and lng is not None:
            if not (india_lat_range[0] <= lat <= india_lat_range[1]):
                errors += 1
                print(f"  INVALID LAT in {f.name}: {lat}")
            if not (india_lng_range[0] <= lng <= india_lng_range[1]):
                errors += 1
                print(f"  INVALID LNG in {f.name}: {lng}")

print(f"Coordinate validation errors: {errors}")
if errors == 0:
    print("All OSM ATM coordinates are valid India coordinates")

# Test edge cases for hotspot detection
print("\n=== Hotspot Edge Cases ===")

# Zero records
result = hotspots([])
print(f"Empty records: {result} (expected [])")

# One record (less than min_samples=5)
single = [{"latitude": 12.97, "longitude": 77.59, "fraud_type": "UPI",
           "risk_score": 80, "amount": 100000, "timestamp": "2026-08-18T10:00:00Z",
           "city": "Bengaluru"}]
result = hotspots(single)
print(f"Single record: {result} (expected [])")

# Four records (still below min_samples=5)
four_records = [
    {"latitude": 12.97 + i*0.001, "longitude": 77.59, "fraud_type": "UPI",
     "risk_score": 80, "amount": 100000, "timestamp": "2026-08-18T10:00:00Z", "city": "Bengaluru"}
    for i in range(4)
]
result = hotspots(four_records)
print(f"Four records: {result} (expected [])")

# Five clustered records (should detect hotspot)
five_clustered = [
    {"latitude": 12.9716 + i*0.001, "longitude": 77.5946, "fraud_type": "UPI",
     "risk_score": 85, "amount": 150000, "timestamp": "2026-08-18T10:00:00Z", "city": "Bengaluru"}
    for i in range(5)
]
result = hotspots(five_clustered)
print(f"Five clustered records: {len(result)} hotspot(s) found")
if result:
    h = result[0]
    print(f"  cluster_id: {h['cluster_id']}")
    print(f"  historical_score: {h['historical_score']}")
    print(f"  centroid: ({h['centroid_latitude']:.4f}, {h['centroid_longitude']:.4f})")
    print(f"  data_source: {h['data_source']}")

# Invalid coordinates
invalid_coords = [
    {"latitude": 999, "longitude": 77.59, "fraud_type": "UPI",
     "risk_score": 80, "amount": 100000, "timestamp": "2026-08-18T10:00:00Z", "city": "Bengaluru"}
]
try:
    result = hotspots(invalid_coords)
    print(f"Invalid coords: handled gracefully ({result})")
except Exception as e:
    print(f"Invalid coords: EXCEPTION {e}")

print("\nDone.")
