# CASHNET OSM ATM pipeline

This folder contains a controlled, cached OpenStreetMap (OSM) ATM-location import and a separate synthetic withdrawal generator. OSM records are reference locations (`REFERENCE_LOCATION`); every generated withdrawal is explicitly marked `SYNTHETIC` and must never be presented as a real financial transaction.

## Commands

```powershell
python scripts/geospatial/import_osm_atms.py import --city Delhi --dry-run
python scripts/geospatial/import_osm_atms.py import --city Delhi
python scripts/geospatial/import_osm_atms.py generate --count 10000
python -m unittest discover -s tests
```

Import the initial five cities before generation: Delhi, Mumbai, Bengaluru, Hyderabad, and Ahmedabad. Gurugram must also be imported if Scenario B is desired.

Reference data is cached under `data/reference/osm-atms/`; synthetic records are written separately to `data/synthetic/ATM.json`. The importer uses Overpass only during explicit import commands—dashboard loads must consume cached files.

## Attribution and licence

Imported location data is © OpenStreetMap contributors and available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Preserve the per-file attribution and provenance fields when redistributing or displaying these records.
