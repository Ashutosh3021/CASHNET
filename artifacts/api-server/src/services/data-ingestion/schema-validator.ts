/**
 * Data ingestion pipeline — CSV, JSON, GeoJSON loaders with normalization.
 * All ingested data carries explicit provenance.
 */

import type { DataProvenance, DataSourceType } from "../../providers/provider-types";

export interface IngestedRecord {
  [key: string]: unknown;
  _provenance: DataProvenance;
}

export interface IngestionResult {
  records: IngestedRecord[];
  errors: string[];
  recordCount: number;
  sourceType: DataSourceType;
  sourceName: string;
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "coordinates";
  required?: boolean;
  sourceFields?: string[];
}

export interface SchemaDefinition {
  name: string;
  fields: SchemaField[];
}

/**
 * Map a raw field name to the canonical field name using the schema's sourceFields mapping.
 */
function mapFieldName(rawKey: string, fields: SchemaField[]): string | undefined {
  for (const field of fields) {
    if (field.name === rawKey) return field.name;
    if (field.sourceFields?.some((sf) => sf.toLowerCase() === rawKey.toLowerCase())) {
      return field.name;
    }
  }
  return undefined;
}

/**
 * Validate and coerce a value according to the field schema.
 */
function validateField(value: unknown, field: SchemaField): unknown {
  if (value === undefined || value === null || value === "") {
    if (field.required) throw new Error(`Required field "${field.name}" is missing`);
    return null;
  }

  switch (field.type) {
    case "number": {
      const num = Number(value);
      if (Number.isNaN(num)) throw new Error(`Field "${field.name}" is not a valid number: ${value}`);
      return num;
    }
    case "boolean":
      return value === true || value === "true" || value === "1";
    case "date": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) throw new Error(`Field "${field.name}" is not a valid date: ${value}`);
      return date.toISOString();
    }
    case "coordinates": {
      const num = Number(value);
      if (Number.isNaN(num)) throw new Error(`Field "${field.name}" is not valid coordinates: ${value}`);
      return num;
    }
    case "string":
    default:
      return String(value);
  }
}

/**
 * Normalize a raw record against a schema definition.
 */
export function normalizeRecord(
  raw: Record<string, unknown>,
  schema: SchemaDefinition,
  provenance: DataProvenance,
): IngestedRecord {
  const normalized: IngestedRecord = { _provenance: provenance };

  for (const field of schema.fields) {
    let value: unknown = undefined;

    // Try direct field name match first
    if (raw[field.name] !== undefined) {
      value = raw[field.name];
    }
    // Try source field aliases
    else if (field.sourceFields) {
      for (const sf of field.sourceFields) {
        if (raw[sf] !== undefined) {
          value = raw[sf];
          break;
        }
      }
    }

    try {
      normalized[field.name] = validateField(value, field);
    } catch (e) {
      if (field.required) throw e;
      normalized[field.name] = null;
    }
  }

  return normalized;
}

/**
 * Normalize a batch of raw records against a schema.
 */
export function normalizeBatch(
  rawRecords: Record<string, unknown>[],
  schema: SchemaDefinition,
  provenance: DataProvenance,
): IngestionResult {
  const records: IngestedRecord[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawRecords.length; i++) {
    try {
      const normalized = normalizeRecord(rawRecords[i]!, schema, provenance);
      records.push(normalized);
    } catch (e) {
      errors.push(`Record ${i}: ${(e as Error).message}`);
    }
  }

  return {
    records,
    errors,
    recordCount: records.length,
    sourceType: provenance.dataSource,
    sourceName: provenance.sourceName,
  };
}
