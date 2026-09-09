/**
 * Provider architecture with explicit data provenance.
 *
 * Every record in the system must carry provenance metadata
 * so the frontend can display the source and confidence of data.
 */

// --- Data Source Provenance ---

export type DataSourceType =
  | "PUBLIC_DATA"
  | "AUTHORIZED_API"
  | "USER_PROVIDED_DATA"
  | "SYNTHETIC"
  | "MODEL_INFERENCE";

export interface DataProvenance {
  dataSource: DataSourceType;
  sourceName: string;
  sourceReference: string | null;
  retrievedAt: string;
  confidence: number; // 0.0 to 1.0
}

// --- Transaction Types ---

export type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LocationType = "ATM" | "BANK_BRANCH" | "MERCHANT" | "UPI_MERCHANT" | "UNKNOWN" | "OTHER";

export interface HistoricalTransaction {
  id: string;
  caseId: string;
  transactionId: string;
  transactionType: string;
  amount: number;
  currency: "INR";
  timestamp: string;
  sourceEntityId: string;
  destinationEntityId: string;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  city: string;
  pincode: string;
  locationType: LocationType;
  riskScore: number;
  riskCategory: RiskCategory;
  fraudType: string;
  dataSource: DataSourceType;
  createdAt: string;
  provenance: DataProvenance;
}

export interface PointOfInterest {
  id: string;
  name: string;
  bankName: string;
  ifsc?: string;
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  state: string;
  pincode: string;
  status?: string;
  dataSource: DataSourceType;
  provenance: DataProvenance;
}

export interface HistoricalHotspot {
  clusterId: string;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  maximumAmount: number;
  riskAverage: number;
  riskMax: number;
  firstTransaction: string;
  lastTransaction: string;
  centroidLatitude: number;
  centroidLongitude: number;
  radiusKm: number;
  fraudTypeDistribution: Record<string, number>;
  primaryFraudType: string;
  historicalScore: number;
  city: string;
  nearbyAtmCount: number;
  nearbyBranchCount: number;
  provenance: DataProvenance;
}

// --- Filter Types ---

export interface GeoFilters {
  startDate?: string;
  endDate?: string;
  city?: string;
  state?: string;
  district?: string;
  fraudType?: string;
  riskCategory?: string;
  minAmount?: number;
  maxAmount?: number;
  locationType?: string;
  minRiskScore?: number;
  caseId?: string;
}

// --- Provider Interface ---

export interface GeoDataProvider {
  readonly name: string;
  readonly sourceType: DataSourceType;

  getTransactions(filters?: GeoFilters): HistoricalTransaction[];
  getAtms(filters?: { city?: string; state?: string }): PointOfInterest[];
  getBranches(filters?: { city?: string; state?: string }): PointOfInterest[];
  getStatus(): ProviderStatus;
}

export interface ProviderStatus {
  name: string;
  sourceType: DataSourceType;
  connected: boolean;
  enabled: boolean;
  status: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED" | "SYNTHETIC_FALLBACK" | "DEMO_MODE";
  recordCount: {
    transactions: number;
    atms: number;
    branches: number;
  };
  lastUpdated: string | null;
}
