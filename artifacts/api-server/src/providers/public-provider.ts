/**
 * Public data geospatial provider.
 *
 * Ingests legitimate public datasets (CSV, JSON, GeoJSON) and normalizes
 * them into CASHNET's internal schemas. When no public data is loaded,
 * reports status as UNAVAILABLE (never falls back to fake data).
 *
 * Data provenance: PUBLIC_DATA
 */

import * as fs from "fs";
import * as path from "path";
import type { GeoDataProvider, ProviderStatus, DataProvenance, GeoFilters, HistoricalTransaction, PointOfInterest } from "./provider-types";
import { haversineKm } from "../services/geospatial/distance";

const DATA_DIR = process.env.CASHNET_PUBLIC_DATA_DIR || path.join(process.cwd(), "data", "public");

interface RawRecord {
  [key: string]: unknown;
}

function makeProvenance(sourceName: string, sourceReference: string | null = null): DataProvenance {
  return {
    dataSource: "PUBLIC_DATA",
    sourceName,
    sourceReference,
    retrievedAt: new Date().toISOString(),
    confidence: 0.85,
  };
}

function normalizeTransaction(raw: RawRecord, provenance: DataProvenance): HistoricalTransaction | null {
  const lat = parseFloat(String(raw.latitude ?? raw.lat ?? raw["Latitude"]));
  const lng = parseFloat(String(raw.longitude ?? raw.lng ?? raw["Longitude"]));
  const amount = parseFloat(String(raw.amount ?? raw.value ?? raw.transaction_amount ?? "0"));

  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    id: String(raw.id ?? raw.record_id ?? `PUB-${Math.random().toString(36).slice(2, 10)}`),
    caseId: String(raw.case_id ?? raw.caseId ?? ""),
    transactionId: String(raw.transaction_id ?? raw.txn_id ?? raw.id ?? ""),
    transactionType: String(raw.transaction_type ?? raw.type ?? "UNKNOWN"),
    amount: Math.max(0, amount),
    currency: "INR",
    timestamp: String(raw.timestamp ?? raw.date ?? raw.transaction_date ?? new Date().toISOString()),
    sourceEntityId: String(raw.source_entity ?? raw.sender ?? ""),
    destinationEntityId: String(raw.destination_entity ?? raw.receiver ?? ""),
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    state: String(raw.state ?? ""),
    district: String(raw.district ?? ""),
    city: String(raw.city ?? ""),
    pincode: String(raw.pincode ?? raw.pin ?? ""),
    locationType: "UNKNOWN",
    riskScore: Math.min(100, Math.max(0, parseInt(String(raw.risk_score ?? "50"), 10))),
    riskCategory: "MEDIUM",
    fraudType: String(raw.fraud_type ?? raw.category ?? "UNKNOWN"),
    dataSource: "PUBLIC_DATA",
    createdAt: String(raw.timestamp ?? raw.date ?? new Date().toISOString()),
    provenance,
  };
}

function normalizeATM(raw: RawRecord, provenance: DataProvenance): PointOfInterest | null {
  const lat = parseFloat(String(raw.latitude ?? raw.lat));
  const lng = parseFloat(String(raw.longitude ?? raw.lng));

  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    id: String(raw.id ?? raw.atm_id ?? `ATM-${Math.random().toString(36).slice(2, 10)}`),
    name: String(raw.name ?? raw.atm_name ?? "Public ATM"),
    bankName: String(raw.bank_name ?? raw.bank ?? "Unknown Bank"),
    ifsc: raw.ifsc ? String(raw.ifsc) : undefined,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    city: String(raw.city ?? ""),
    district: String(raw.district ?? ""),
    state: String(raw.state ?? ""),
    pincode: String(raw.pincode ?? raw.pin ?? ""),
    status: String(raw.status ?? "UNKNOWN"),
    dataSource: "PUBLIC_DATA",
    provenance,
  };
}

function normalizeBranch(raw: RawRecord, provenance: DataProvenance): PointOfInterest | null {
  const lat = parseFloat(String(raw.latitude ?? raw.lat));
  const lng = parseFloat(String(raw.longitude ?? raw.lng));

  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    id: String(raw.id ?? raw.branch_id ?? `BR-${Math.random().toString(36).slice(2, 10)}`),
    name: String(raw.name ?? raw.branch_name ?? "Public Branch"),
    bankName: String(raw.bank_name ?? raw.bank ?? "Unknown Bank"),
    ifsc: raw.ifsc ? String(raw.ifsc) : undefined,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    city: String(raw.city ?? ""),
    district: String(raw.district ?? ""),
    state: String(raw.state ?? ""),
    pincode: String(raw.pincode ?? raw.pin ?? ""),
    dataSource: "PUBLIC_DATA",
    provenance,
  };
}

function loadJSONFile(filePath: string): RawRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      if (Array.isArray(data.features)) {
        return data.features.map((f: any) => ({
          ...(f.properties || {}),
          latitude: f.geometry?.coordinates?.[1],
          longitude: f.geometry?.coordinates?.[0],
        }));
      }
      if (Array.isArray(data.records)) return data.records;
      if (Array.isArray(data.data)) return data.data;
    }
    return [];
  } catch {
    return [];
  }
}

function loadCSVFile(filePath: string): RawRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const record: RawRecord = {};
      headers.forEach((h, i) => { record[h] = values[i]; });
      return record;
    });
  } catch {
    return [];
  }
}

function loadGeoJSONFile(filePath: string): RawRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data.features.map((f: any) => ({
        ...(f.properties || {}),
        latitude: f.geometry?.coordinates?.[1],
        longitude: f.geometry?.coordinates?.[0],
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function loadFromDirectory(dir: string): { transactions: RawRecord[]; atms: RawRecord[]; branches: RawRecord[] } {
  const transactions: RawRecord[] = [];
  const atms: RawRecord[] = [];
  const branches: RawRecord[] = [];

  if (!fs.existsSync(dir)) return { transactions, atms, branches };

  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, ext).toLowerCase();

    let records: RawRecord[] = [];
    if (ext === ".json") records = loadJSONFile(filePath);
    else if (ext === ".csv") records = loadCSVFile(filePath);
    else if (ext === ".geojson") records = loadGeoJSONFile(filePath);

    if (name.includes("transaction") || name.includes("fraud") || name.includes("complaint")) {
      transactions.push(...records);
    } else if (name.includes("atm")) {
      atms.push(...records);
    } else if (name.includes("branch")) {
      branches.push(...records);
    }
  }

  return { transactions, atms, branches };
}

export class PublicGeoProvider implements GeoDataProvider {
  readonly name = "Public Geospatial Dataset";
  readonly sourceType = "PUBLIC_DATA" as const;

  private transactions: HistoricalTransaction[] = [];
  private atms: PointOfInterest[] = [];
  private branches: PointOfInterest[] = [];
  private loaded = false;
  private lastUpdated: string | null = null;

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;

    const raw = loadFromDirectory(DATA_DIR);
    const txProvenance = makeProvenance("Public Transaction Dataset");
    const atmProvenance = makeProvenance("Public ATM Dataset");
    const branchProvenance = makeProvenance("Public Bank Branch Dataset");

    this.transactions = raw.transactions
      .map((r) => normalizeTransaction(r, txProvenance))
      .filter((r): r is HistoricalTransaction => r !== null);

    this.atms = raw.atms
      .map((r) => normalizeATM(r, atmProvenance))
      .filter((r): r is PointOfInterest => r !== null);

    this.branches = raw.branches
      .map((r) => normalizeBranch(r, branchProvenance))
      .filter((r): r is PointOfInterest => r !== null);

    if (this.transactions.length + this.atms.length + this.branches.length > 0) {
      this.lastUpdated = new Date().toISOString();
    }
  }

  getTransactions(filters?: GeoFilters): HistoricalTransaction[] {
    this.ensureLoaded();
    if (!filters) return [...this.transactions];

    return this.transactions.filter((item) =>
      (!filters.startDate || item.timestamp >= filters.startDate) &&
      (!filters.endDate || item.timestamp <= `${filters.endDate}T23:59:59.999Z`) &&
      (!filters.city || item.city === filters.city) &&
      (!filters.state || item.state === filters.state) &&
      (!filters.district || item.district === filters.district) &&
      (!filters.fraudType || item.fraudType === filters.fraudType) &&
      (!filters.riskCategory || item.riskCategory === filters.riskCategory) &&
      (!filters.locationType || item.locationType === filters.locationType) &&
      (!filters.caseId || item.caseId === filters.caseId) &&
      (filters.minAmount === undefined || item.amount >= filters.minAmount) &&
      (filters.maxAmount === undefined || item.amount <= filters.maxAmount) &&
      (filters.minRiskScore === undefined || item.riskScore >= filters.minRiskScore)
    );
  }

  getAtms(filters?: { city?: string; state?: string }): PointOfInterest[] {
    this.ensureLoaded();
    return this.atms.filter(
      (item) =>
        (!filters?.city || item.city === filters.city) &&
        (!filters?.state || item.state === filters.state),
    );
  }

  getBranches(filters?: { city?: string; state?: string }): PointOfInterest[] {
    this.ensureLoaded();
    return this.branches.filter(
      (item) =>
        (!filters?.city || item.city === filters.city) &&
        (!filters?.state || item.state === filters.state),
    );
  }

  getStatus(): ProviderStatus {
    this.ensureLoaded();
    return {
      name: this.name,
      sourceType: this.sourceType,
      connected: this.transactions.length + this.atms.length + this.branches.length > 0,
      enabled: true,
      status: this.transactions.length + this.atms.length + this.branches.length > 0
        ? "AVAILABLE"
        : "UNAVAILABLE",
      recordCount: {
        transactions: this.transactions.length,
        atms: this.atms.length,
        branches: this.branches.length,
      },
      lastUpdated: this.lastUpdated,
    };
  }
}
