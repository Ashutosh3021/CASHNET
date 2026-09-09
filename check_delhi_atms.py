"""Find and report invalid OSM ATM coordinates."""
import json
from pathlib import Path

osm_dir = Path('C:/Users/ashut/Downloads/CASHNET/data/reference/osm-atms')

india_lat_range = (8.0, 37.0)
india_lng_range = (68.0, 97.5)

for f in osm_dir.glob('*.json'):
    data = json.loads(f.read_text(encoding='utf-8'))
    invalid = []
    valid = 0
    for i, atm in enumerate(data.get('atms', [])):
        loc = atm.get('location', {})
        coords = loc.get('coordinates', {})
        lat = coords.get('latitude')
        lng = coords.get('longitude')
        if lat is None or lng is None:
            invalid.append((i, 'missing coords', lat, lng))
        elif not (india_lat_range[0] <= lat <= india_lat_range[1]) or \
             not (india_lng_range[0] <= lng <= india_lng_range[1]):
            invalid.append((i, atm.get('bank_name', 'unknown'), lat, lng))
        else:
            valid += 1
    
    if invalid:
        print(f"\n{f.name}: {valid} valid, {len(invalid)} invalid")
        for idx, name, lat, lng in invalid:
            print(f"  Index {idx}: {name} | lat={lat}, lng={lng}")
    else:
        print(f"{f.name}: {valid} valid, 0 invalid")

print("\nDone.")
