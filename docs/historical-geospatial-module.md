# Historical suspicious activity module

This module visualises **historical concentration of synthetic suspicious
transactions**. It is deliberately separate from CASHNET's future predictive
cash-out model. It does not identify where criminals operate or assert that an
ATM will be used.

## Prototype data boundary

`synthetic-geospatial.ts` creates a deterministic 520-record dataset, 210
synthetic ATMs, and 60 synthetic branches. Every returned record has
`dataSource: "SYNTHETIC"`. No banking, NCRP, I4C, SAHYOG, UPI, ATM, or law
enforcement source is queried. The service can be replaced by an authorised
PostgreSQL/PostGIS or FastAPI/GeoPandas provider without changing the frontend
route contract.

## API

- `GET /api/geospatial/historical-transactions`
- `GET /api/geospatial/historical-hotspots`
- `GET /api/geospatial/atms`
- `GET /api/geospatial/branches`
- `GET /api/geospatial/historical-summary`
- `GET /api/geospatial/location-history`
- `POST /api/geospatial/proximity-analysis`
- `GET /api/geospatial/case-context/:caseId`

List endpoints accept filters including `days`, `startDate`, `endDate`, `city`,
`state`, `district`, `fraudType`, `riskCategory`, `minAmount`, `maxAmount`,
`locationType`, and `minRiskScore`.

## Analytical method

Hotspots are calculated dynamically from the filtered records using a
DBSCAN-style geodesic neighbourhood (1.75 km / at least 5 transactions).
Cluster score is normalised from transaction density, average risk, total
value, and relative recency. Proximity uses the Haversine formula in kilometres;
production GeoPandas/PostGIS implementations should use a projected CRS or
geodesic operations as appropriate.
