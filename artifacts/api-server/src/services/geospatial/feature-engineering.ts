/**
 * Geospatial feature engineering — extract ML-ready features from geo data.
 * These features work identically regardless of data provenance.
 */

export interface TransactionFeatures {
  logAmount: number;
  latitude: number;
  longitude: number;
  hourOfDay: number;
  dayOfWeek: number;
  riskScore: number;
  amountToMeanRatio: number;
  distanceToCityCenter: number;
}

export interface LocationFeatures {
  latitude: number;
  longitude: number;
  transactionDensity: number;
  nearbyAtmCount: number;
  nearbyBranchCount: number;
  averageRisk: number;
  hotspotScore: number;
}

/**
 * Extract features from a single transaction for ML consumption.
 */
export function extractTransactionFeatures(tx: {
  amount: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  riskScore: number;
  meanAmount?: number;
  cityLat?: number;
  cityLng?: number;
}): TransactionFeatures {
  const date = new Date(tx.timestamp);
  const meanAmt = tx.meanAmount ?? tx.amount;

  let distToCity = 0;
  if (tx.cityLat !== undefined && tx.cityLng !== undefined) {
    const dLat = (tx.latitude - tx.cityLat) * Math.PI / 180;
    const dLng = (tx.longitude - tx.cityLng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((tx.cityLat * Math.PI) / 180) *
        Math.cos((tx.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    distToCity = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return {
    logAmount: Math.log1p(tx.amount),
    latitude: tx.latitude,
    longitude: tx.longitude,
    hourOfDay: date.getUTCHours(),
    dayOfWeek: date.getUTCDay(),
    riskScore: tx.riskScore,
    amountToMeanRatio: meanAmt > 0 ? tx.amount / meanAmt : 1,
    distanceToCityCenter: distToCity,
  };
}

/**
 * Extract aggregate features for a geographic region.
 */
import { haversineKm } from "./distance";

export function extractLocationFeatures(transactions: Array<{
  latitude: number;
  longitude: number;
  riskScore: number;
  amount: number;
}>, atms: Array<{ latitude: number; longitude: number }>, branches: Array<{ latitude: number; longitude: number }>, referenceLat: number, referenceLng: number, radiusKm: number = 2): LocationFeatures {

  const nearby = transactions.filter(
    (t) => haversineKm(referenceLat, referenceLng, t.latitude, t.longitude) <= radiusKm,
  );

  const nearbyAtmCount = atms.filter(
    (a) => haversineKm(referenceLat, referenceLng, a.latitude, a.longitude) <= radiusKm,
  ).length;

  const nearbyBranchCount = branches.filter(
    (b) => haversineKm(referenceLat, referenceLng, b.latitude, b.longitude) <= radiusKm,
  ).length;

  return {
    latitude: referenceLat,
    longitude: referenceLng,
    transactionDensity: nearby.length,
    nearbyAtmCount,
    nearbyBranchCount,
    averageRisk:
      nearby.length > 0
        ? nearby.reduce((sum, t) => sum + t.riskScore, 0) / nearby.length
        : 0,
    hotspotScore: Math.min(
      100,
      nearby.length * 5 + nearbyAtmCount * 3 + nearbyBranchCount * 2,
    ),
  };
}
