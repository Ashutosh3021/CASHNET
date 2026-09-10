/**
 * V1 API Routes - Analytics as a Service
 *
 * External-facing analytics endpoints for institutional consumers.
 * Uses real algorithms (DBSCAN clustering, Jaccard similarity, corridor scoring)
 * operating on synthetic data. All responses include provenance metadata.
 */

import { Router, type IRouter, Request, Response } from "express";
import { logger } from "../../lib/logger";
import {
  detectHotspots,
  haversineKm,
  syntheticGeoData,
} from "../../providers/synthetic-geospatial";
import { findLinkedIncidents } from "../../services/incident-linking";

type AnyRecord = Record<string, any>;

const router: IRouter = Router();

const CASES_DB: AnyRecord[] = [
  {
    id: "CASE-CASHNET-001",
    reference: "NCRP-SYN-260818-001",
    title: "Suspicious ATM withdrawal pattern",
    fraudType: "UPI scam",
    amount: 420000,
    city: "Bengaluru",
    state: "Karnataka",
    riskScore: 92,
    accounts: [
      { id: "ACC-001", bank: "SBI", masked: "XXXXXX1234", risk: 78, indicators: ["HIGH_VELOCITY", "MULTIPLE_MULES"] },
      { id: "ACC-002", bank: "HDFC", masked: "XXXXXX5678", risk: 65, indicators: ["RAPID_TRANSFERS"] },
    ],
    wallets: [
      { id: "WALLET-001", address: "0x7A4C9D12...92F", chain: "Ethereum" },
    ],
    complaint: {
      indicators: ["ATM_WITHDRAWAL_PATTERN", "CROSS_CITY", "HIGH_VELOCITY"],
      description: "Victim reports unauthorized ATM withdrawals across multiple cities",
    },
  },
  {
    id: "CASE-CASHNET-002",
    reference: "NCRP-SYN-260818-002",
    title: "Cross-border crypto conversion ring",
    fraudType: "Investment fraud",
    amount: 198000,
    city: "Mumbai",
    state: "Maharashtra",
    riskScore: 78,
    accounts: [
      { id: "ACC-003", bank: "ICICI", masked: "XXXXXX9012", risk: 72, indicators: ["CRYPTO_CONVERSION"] },
    ],
    wallets: [
      { id: "WALLET-002", address: "bc1q8x...4k2", chain: "Bitcoin" },
    ],
    complaint: {
      indicators: ["CRYPTO_CONVERSION", "INVESTMENT_PROMISE", "CROSS_BORDER"],
      description: "Victim lured into investment scheme, funds converted to crypto",
    },
  },
];

const FRAUD_PATTERNS_DB: AnyRecord[] = [
  { type: "UPI_FRAUD", frequency: 353, cities: ["Bengaluru", "Delhi", "Mumbai"], averageAmount: 142000, confidence: 0.89, modelVersion: "184-v2" },
  { type: "INVESTMENT_SCAM", frequency: 108, cities: ["Mumbai", "Pune"], averageAmount: 285000, confidence: 0.82, modelVersion: "184-v2" },
  { type: "ACCOUNT_TAKEOVER", frequency: 87, cities: ["Hyderabad", "Chennai"], averageAmount: 95000, confidence: 0.76, modelVersion: "184-v2" },
  { type: "CRYPTO_MULE", frequency: 64, cities: ["Bengaluru", "Delhi"], averageAmount: 198000, confidence: 0.71, modelVersion: "183-v1" },
];

const PROVENANCE = {
  dataSource: "SYNTHETIC" as const,
  sourceName: "cashnet-synthetic-provider",
  sourceReference: "seeded-analytics",
  retrievedAt: new Date().toISOString(),
  confidence: 0.85,
};

function wrapResponse<T>(data: T, req: Request) {
  return {
    data,
    meta: {
      requestId: (req as any).id || `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      modelVersion: "184-v2",
      provenance: PROVENANCE,
    },
  };
}

// Pre-compute DBSCAN hotspots from 520 synthetic transactions
const computedHotspots = detectHotspots(
  syntheticGeoData.records,
  syntheticGeoData.atms,
  syntheticGeoData.branches,
);

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /analytics/overview - Dashboard metrics
 */
router.get("/analytics/overview", (req: Request, res: Response) => {
  try {
    const overview = {
      totalCases: CASES_DB.length,
      totalExposure: CASES_DB.reduce((sum, c) => sum + (c.amount || 0), 0),
      totalTransactions: syntheticGeoData.records.length,
      totalAtms: syntheticGeoData.atms.length,
      totalBranches: syntheticGeoData.branches.length,
      hotspotClusters: computedHotspots.length,
      riskDistribution: {
        critical: CASES_DB.filter((c) => c.riskScore >= 80).length,
        high: CASES_DB.filter((c) => c.riskScore >= 60 && c.riskScore < 80).length,
        medium: CASES_DB.filter((c) => c.riskScore >= 40 && c.riskScore < 60).length,
        low: CASES_DB.filter((c) => c.riskScore < 40).length,
      },
      topFraudTypes: FRAUD_PATTERNS_DB.slice(0, 5).map((p) => ({
        type: p.type,
        count: p.frequency,
      })),
    };
    return res.json(wrapResponse(overview, req));
  } catch (error) {
    logger.error({ error }, "Failed to get analytics overview");
    return res.status(500).json({ error: "Failed to get analytics overview" });
  }
});

/**
 * GET /analytics/fraud-patterns - Fraud pattern analysis
 */
router.get("/analytics/fraud-patterns", (req: Request, res: Response) => {
  try {
    const { city, fraudType, minConfidence } = req.query;
    let patterns = [...FRAUD_PATTERNS_DB];

    if (city) {
      patterns = patterns.filter((p) =>
        p.cities.some((c: string) => c.toLowerCase() === String(city).toLowerCase())
      );
    }
    if (fraudType) {
      patterns = patterns.filter((p) => p.type === fraudType);
    }
    if (minConfidence) {
      const min = parseFloat(minConfidence as string);
      patterns = patterns.filter((p) => p.confidence >= min);
    }

    return res.json(wrapResponse({ patterns, totalMatches: patterns.length }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get fraud patterns");
    return res.status(500).json({ error: "Failed to get fraud patterns" });
  }
});

/**
 * GET /analytics/hotspots - Real DBSCAN clustering from 520 transactions
 */
router.get("/analytics/hotspots", (req: Request, res: Response) => {
  try {
    const { city, minRisk, limit } = req.query;
    let hotspots = [...computedHotspots];

    if (city) {
      hotspots = hotspots.filter(
        (h) => h.city.toLowerCase() === String(city).toLowerCase()
      );
    }
    if (minRisk) {
      const min = parseInt(minRisk as string);
      hotspots = hotspots.filter((h) => h.historicalScore >= min);
    }
    if (limit) {
      hotspots = hotspots.slice(0, parseInt(limit as string));
    }

    return res.json(wrapResponse({ hotspots, totalMatches: hotspots.length }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get hotspots");
    return res.status(500).json({ error: "Failed to get hotspots" });
  }
});

/**
 * GET /analytics/relationships - Real relationship graph from case entities
 */
router.get("/analytics/relationships", (req: Request, res: Response) => {
  try {
    const { caseId, maxHops } = req.query;
    const hops = maxHops ? parseInt(maxHops as string) : 3;

    const targetCase = caseId
      ? CASES_DB.find((c) => c.id === caseId)
      : CASES_DB[0];

    if (!targetCase) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Build real graph from entity data
    const nodes: AnyRecord[] = [];
    const edges: AnyRecord[] = [];

    // Add case node
    nodes.push({
      id: targetCase.id,
      type: "CASE",
      label: targetCase.reference,
      risk: targetCase.riskScore,
      amount: targetCase.amount,
      fraudType: targetCase.fraudType,
    });

    // Add account nodes and edges from case
    for (const account of targetCase.accounts || []) {
      nodes.push({
        id: account.id,
        type: "ACCOUNT",
        label: `${account.bank} ${account.masked}`,
        risk: account.risk,
        bank: account.bank,
      });
      edges.push({
        source: targetCase.id,
        target: account.id,
        amount: targetCase.amount,
        type: "FiatTransfer",
        timestamp: new Date(2026, 7, 18, 10, 1).toISOString(),
      });
    }

    // Add wallet nodes and edges from accounts
    for (const wallet of targetCase.wallets || []) {
      nodes.push({
        id: wallet.id,
        type: "WALLET",
        label: wallet.address,
        risk: 75,
        chain: wallet.chain,
      });
      // Connect wallet to first account (crypto conversion)
      if (targetCase.accounts?.length) {
        edges.push({
          source: targetCase.accounts[0].id,
          target: wallet.id,
          amount: Math.round(targetCase.amount * 0.8),
          type: "CryptoConversion",
          timestamp: new Date(2026, 7, 18, 10, 11).toISOString(),
        });
      }
    }

    // Add cross-case links via shared entities
    if (hops > 1) {
      for (const otherCase of CASES_DB) {
        if (otherCase.id === targetCase.id) continue;

        // Check for shared accounts
        const sharedAccounts = (targetCase.accounts || []).filter((ta: AnyRecord) =>
          (otherCase.accounts || []).some((oa: AnyRecord) => oa.id === ta.id)
        );
        // Check for shared wallets
        const sharedWallets = (targetCase.wallets || []).filter((tw: AnyRecord) =>
          (otherCase.wallets || []).some((ow: AnyRecord) => ow.id === tw.id)
        );

        if (sharedAccounts.length > 0 || sharedWallets.length > 0) {
          edges.push({
            source: targetCase.id,
            target: otherCase.id,
            type: "RelatedCase",
            sharedEntities: [
              ...sharedAccounts.map((a: AnyRecord) => a.id),
              ...sharedWallets.map((w: AnyRecord) => w.id),
            ],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const metrics = {
      totalValue: edges
        .filter((e: AnyRecord) => e.amount)
        .reduce((sum: number, e: AnyRecord) => sum + (e.amount || 0), 0),
      riskScore: targetCase.riskScore,
      entityCount: nodes.length,
      edgeCount: edges.length,
      accountCount: (targetCase.accounts || []).length,
      walletCount: (targetCase.wallets || []).length,
    };

    return res.json(wrapResponse({ nodes, edges, metrics }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get relationships");
    return res.status(500).json({ error: "Failed to get relationships" });
  }
});

/**
 * GET /analytics/connected-incidents - Real Jaccard similarity
 */
router.get("/analytics/connected-incidents", (req: Request, res: Response) => {
  try {
    const { caseId, threshold } = req.query;
    const targetId = (caseId as string) || CASES_DB[0]?.id;

    if (!targetId) {
      return res.json(wrapResponse({ linkedCases: [] }, req));
    }

    const target = CASES_DB.find((c) => c.id === targetId);
    if (!target) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Use real Jaccard similarity from incident-linking service
    const toCaseLike = (c: AnyRecord) => ({
      id: c.id,
      reference: c.reference,
      accounts: c.accounts,
      wallets: c.wallets,
      complaint: c.complaint,
      amount: c.amount,
      fraudType: c.fraudType,
      city: c.city,
    });
    const linked = findLinkedIncidents(toCaseLike(target), CASES_DB.map(toCaseLike), {
      similarityThreshold: threshold ? parseFloat(threshold as string) : 0.3,
    });

    return res.json(wrapResponse({ linkedCases: linked, targetCaseId: targetId }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get connected incidents");
    return res.status(500).json({ error: "Failed to get connected incidents" });
  }
});

/**
 * GET /analytics/corridors - Real corridor vulnerability scoring
 *
 * Computes corridors between major city pairs using point-to-line distance,
 * hotspot density, and destination proximity scoring.
 */
router.get("/analytics/corridors", (req: Request, res: Response) => {
  try {
    const toRad = (d: number) => (d * Math.PI) / 180;

    function pointToSegmentKm(
      pLat: number, pLng: number,
      aLat: number, aLng: number,
      bLat: number, bLng: number,
    ): number {
      const R = 6371;
      const ax = R * toRad(aLng) * Math.cos(toRad(aLat));
      const ay = R * toRad(aLat);
      const bx = R * toRad(bLng) * Math.cos(toRad(bLat));
      const by = R * toRad(bLat);
      const px = R * toRad(pLng) * Math.cos(toRad(pLat));
      const py = R * toRad(pLat);
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const ab2 = abx * abx + aby * aby;
      if (ab2 === 0) return haversineKm(pLat, pLng, aLat, aLng);
      let t = (apx * abx + apy * aby) / ab2;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * abx;
      const cy = ay + t * aby;
      const projLng = cx / (R * Math.cos(toRad(aLat + t * (bLat - aLat))));
      const projLat = cy / R;
      return haversineKm(pLat, pLng, projLat * (180 / Math.PI), projLng * (180 / Math.PI));
    }

    function vulnerabilityScore(
      distFromLineKm: number,
      distFromDestKm: number,
      hotspotDensity: number,
      corridorWidthKm: number,
    ): number {
      const proximity = Math.max(0, 1 - distFromLineKm / corridorWidthKm) * 40;
      const density = Math.min(1, hotspotDensity / 3) * 35;
      const dest = Math.max(0, 1 - distFromDestKm / 500) * 25;
      return Math.round(Math.min(100, Math.max(0, proximity + density + dest)));
    }

    // Major city pairs for corridor analysis
    const cityPairs = [
      { source: "Bengaluru", sLat: 12.9716, sLng: 77.5946, dest: "Mumbai", dLat: 19.076, dLng: 72.8777, state: "Karnataka" },
      { source: "Delhi", sLat: 28.6139, sLng: 77.209, dest: "Bengaluru", dLat: 12.9716, dLng: 77.5946, state: "NCR" },
      { source: "Mumbai", sLat: 19.076, sLng: 72.8777, dest: "Hyderabad", dLat: 17.385, dLng: 78.4867, state: "Maharashtra" },
      { source: "Delhi", sLat: 28.6139, sLng: 77.209, dest: "Kolkata", dLat: 22.5726, dLng: 88.3639, state: "NCR" },
      { source: "Chennai", sLat: 13.0827, sLng: 80.2707, dest: "Bengaluru", dLat: 12.9716, dLng: 77.5946, state: "Tamil Nadu" },
    ];

    const corridors = cityPairs.map((pair) => {
      const corridorWidthKm = 5;
      const totalLineKm = haversineKm(pair.sLat, pair.sLng, pair.dLat, pair.dLng);

      // Score ATMs within corridor
      let corridorAtmCount = 0;
      let totalVulnerability = 0;
      let totalExposure = 0;

      for (const atm of syntheticGeoData.atms) {
        const distLine = pointToSegmentKm(
          atm.latitude, atm.longitude,
          pair.sLat, pair.sLng,
          pair.dLat, pair.dLng,
        );
        if (distLine > corridorWidthKm) continue;

        corridorAtmCount++;
        const distDest = haversineKm(atm.latitude, atm.longitude, pair.dLat, pair.dLng);

        // Count nearby hotspots
        const nearbyHotspots = computedHotspots.filter(
          (h) => haversineKm(atm.latitude, atm.longitude, h.centroidLatitude, h.centroidLongitude) <= 3,
        ).length;

        const score = vulnerabilityScore(distLine, distDest, nearbyHotspots, corridorWidthKm);
        totalVulnerability += score;

        // Sum transaction amounts near this ATM
        const nearbyTxns = syntheticGeoData.records.filter(
          (r) => haversineKm(r.latitude, r.longitude, atm.latitude, atm.longitude) <= 2,
        );
        totalExposure += nearbyTxns.reduce((sum, t) => sum + t.amount, 0);
      }

      const avgVulnerability = corridorAtmCount > 0
        ? Math.round(totalVulnerability / corridorAtmCount)
        : 0;

      return {
        source: { city: pair.source, state: pair.state, coordinates: { lat: pair.sLat, lng: pair.sLng } },
        destination: { city: pair.dest, state: pair.dest, coordinates: { lat: pair.dLat, lng: pair.dLng } },
        vulnerabilityScore: avgVulnerability,
        transactionCount: corridorAtmCount,
        totalExposure,
        totalLineKm: Number(totalLineKm.toFixed(2)),
        corridorWidthKm,
      };
    });

    // Sort by vulnerability descending
    corridors.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);

    return res.json(wrapResponse({ corridors, totalMatches: corridors.length }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get corridors");
    return res.status(500).json({ error: "Failed to get corridors" });
  }
});

export default router;
