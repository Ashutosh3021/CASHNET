/**
 * Hotspot scoring — assign historical risk scores to spatial clusters.
 * Pure algorithm — works on any transaction data with risk/amount/time fields.
 */

import { haversineKm } from "./distance";
import type { SpatialCluster } from "./clustering";

export interface Scoreable {
  latitude: number;
  longitude: number;
  riskScore: number;
  amount: number;
  timestamp: string;
  fraudType: string;
  [key: string]: unknown;
}

export interface ScoredHotspot {
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
}

export function scoreHotspot(
  cluster: SpatialCluster<Scoreable>,
  index: number,
  atms: Array<{ latitude: number; longitude: number }>,
  branches: Array<{ latitude: number; longitude: number }>,
  allScores: { density: number; riskAverage: number; totalAmount: number; recency: number }[],
): ScoredHotspot {
  const members = cluster.members;
  const count = members.length;
  const totalAmount = members.reduce((sum, m) => sum + m.amount, 0);
  const riskAverage = members.reduce((sum, m) => sum + m.riskScore, 0) / count;

  const fraudTypeDistribution = members.reduce<Record<string, number>>((map, m) => {
    map[m.fraudType] = (map[m.fraudType] ?? 0) + 1;
    return map;
  }, {});
  const primaryFraudType =
    Object.entries(fraudTypeDistribution)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "OTHER";

  const timestamps = members.map((m) => m.timestamp).sort();
  const recencies = members.map((m) => Date.parse(m.timestamp));

  const area = Math.PI * Math.max(0.25, cluster.radiusKm ** 2);
  const density = count / Math.max(0.25, area);
  const recency = Math.max(...recencies);

  const nearbyAtmCount = atms.filter(
    (a) =>
      haversineKm(
        cluster.centroidLatitude,
        cluster.centroidLongitude,
        a.latitude,
        a.longitude,
      ) <= 2,
  ).length;

  const nearbyBranchCount = branches.filter(
    (b) =>
      haversineKm(
        cluster.centroidLatitude,
        cluster.centroidLongitude,
        b.latitude,
        b.longitude,
      ) <= 2,
  ).length;

  return {
    clusterId: `HSP-${String(index + 1).padStart(2, "0")}`,
    transactionCount: count,
    totalAmount,
    averageAmount: Math.round(totalAmount / count),
    maximumAmount: Math.max(...members.map((m) => m.amount)),
    riskAverage: Math.round(riskAverage),
    riskMax: Math.max(...members.map((m) => m.riskScore)),
    firstTransaction: timestamps[0]!,
    lastTransaction: timestamps.at(-1)!,
    centroidLatitude: cluster.centroidLatitude,
    centroidLongitude: cluster.centroidLongitude,
    radiusKm: cluster.radiusKm,
    fraudTypeDistribution,
    primaryFraudType,
    historicalScore: 0, // computed below
    city: members[0]!.city as string ?? "unknown",
    nearbyAtmCount,
    nearbyBranchCount,
  };
}

/**
 * Compute composite historical score for a set of scored hotspots.
 * Uses density, risk, amount, and recency as signals.
 */
export function computeHistoricalScores(
  hotspots: ScoredHotspot[],
  rawSignals: { density: number; riskAverage: number; totalAmount: number; recency: number }[],
): ScoredHotspot[] {
  if (hotspots.length === 0) return hotspots;

  const maximumDensity = Math.max(...rawSignals.map((s) => s.density), 1);
  const maximumAmount = Math.max(...rawSignals.map((s) => s.totalAmount), 1);
  const newest = Math.max(...rawSignals.map((s) => s.recency), 1);
  const oldest = Math.min(...rawSignals.map((s) => s.recency), newest);

  return hotspots.map((h, i) => {
    const s = rawSignals[i]!;
    const score = Math.round(
      Math.min(
        100,
        100 *
          (0.4 * s.density / maximumDensity +
            0.25 * s.riskAverage / 100 +
            0.2 * s.totalAmount / maximumAmount +
            0.15 *
              (newest === oldest
                ? 1
                : (s.recency - oldest) / (newest - oldest))),
      ),
    );
    return { ...h, historicalScore: score };
  });
}
