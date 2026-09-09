/**
 * Data ingestion pipeline — public entry point.
 */

export { loadCSV, parseCSVString } from "./csv-loader";
export { loadJSON, parseJSONString } from "./json-loader";
export { loadGeoJSON, parseGeoJSONString } from "./geojson-loader";
export { normalizeRecord, normalizeBatch, type IngestedRecord, type IngestionResult, type SchemaField, type SchemaDefinition } from "./schema-validator";
