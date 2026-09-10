/**
 * V1 API Routes - Analytics as a Service
 *
 * External-facing analytics endpoints for institutional consumers.
 * All responses include provenance metadata.
 */

import { Router, type IRouter, Request, Response } from "express";
import { logger } from "../../lib/logger";

type AnyRecord = Record<string, any>;

const router: IRouter = Router();

// Seed data for analytics (mirrors synthetic provider)
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
      { id: "ACC-001", bank: "SBI", risk: 78 },
      { id: "ACC-002", bank: "HDFC", risk: 65 },
    ],
    wallets: [
      { id: "WALLET-001", address: "0x7A4C9D12...92F", chain: "Ethereum" },
    ],
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
      { id: "ACC-003", bank: "ICICI", risk: 72 },
    ],
    wallets: [
      { id: "WALLET-002", address: "bc1q8x...4k2", chain: "Bitcoin" },
    ],
  },
];

const HOTSPOTS_DB: AnyRecord[] = [
  { id: "HS-001", lat: 12.9719, lng: 77.6412, city: "Bengaluru", riskScore: 87, nearbyAtms: 14, historicalIncidents: 23, probability: 0.82, contributingFactors: ["HIGH_VELOCITY", "RAPID_TRANSFERS"] },
  { id: "HS-002", lat: 19.076, lng: 72.8777, city: "Mumbai", riskScore: 74, nearbyAtms: 11, historicalIncidents: 18, probability: 0.71, contributingFactors: ["CROSS_BORDER", "CRYPTO_CONVERSION"] },
  { id: "HS-003", lat: 28.6139, lng: 77.209, city: "Delhi", riskScore: 69, nearbyAtms: 9, historicalIncidents: 15, probability: 0.65, contributingFactors: ["MULTIPLE_MULES", "VELOCITY_SPIKE"] },
  { id: "HS-004", lat: 17.385, lng: 78.4867, city: "Hyderabad", riskScore: 63, nearbyAtms: 7, historicalIncidents: 12, probability: 0.58, contributingFactors: ["ACCOUNT_TAKEOVER"] },
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

    return res.json(
      wrapResponse(
        {
          patterns,
          totalMatches: patterns.length,
        },
        req
      )
    );
  } catch (error) {
    logger.error({ error }, "Failed to get fraud patterns");
    return res.status(500).json({ error: "Failed to get fraud patterns" });
  }
});

/**
 * GET /analytics/hotspots - ATM/location hotspot data
 */
router.get("/analytics/hotspots", (req: Request, res: Response) => {
  try {
    const { city, minRisk, limit } = req.query;
    let hotspots = [...HOTSPOTS_DB];

    if (city) {
      hotspots = hotspots.filter(
        (h) => h.city.toLowerCase() === String(city).toLowerCase()
      );
    }
    if (minRisk) {
      const min = parseInt(minRisk as string);
      hotspots = hotspots.filter((h) => h.riskScore >= min);
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
 * GET /analytics/relationships - Transaction relationship graph
 */
router.get("/analytics/relationships", (req: Request, res: Response) => {
  try {
    const { caseId, maxHops } = req.query;
    const hops = maxHops ? parseInt(maxHops as string) : 3;

    // Use first case if not specified
    const targetCase = caseId
      ? CASES_DB.find((c) => c.id === caseId)
      : CASES_DB[0];

    if (!targetCase) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Build a sample relationship graph from case data
    const nodes = [
      { id: targetCase.id, type: "CASE", label: targetCase.reference, risk: targetCase.riskScore },
      ...(targetCase.accounts || []).map((a: AnyRecord) => ({
        id: a.id,
        type: "ACCOUNT",
        label: `${a.bank} ${a.id}`,
        risk: a.risk,
      })),
      ...(targetCase.wallets || []).map((w: AnyRecord) => ({
        id: w.id,
        type: "WALLET",
        label: w.address,
        risk: 75,
      })),
    ];

    const edges = [];
    if (targetCase.accounts?.length) {
      edges.push({
        source: targetCase.id,
        target: targetCase.accounts[0].id,
        amount: targetCase.amount,
        timestamp: new Date(2026, 7, 18, 10, 1).toISOString(),
        type: "FiatTransfer",
      });
    }
    if (targetCase.wallets?.length && targetCase.accounts?.length) {
      edges.push({
        source: targetCase.accounts[0].id,
        target: targetCase.wallets[0].id,
        amount: targetCase.amount * 0.8,
        timestamp: new Date(2026, 7, 18, 10, 11).toISOString(),
        type: "CryptoConversion",
      });
    }

    const metrics = {
      totalValue: edges.reduce((sum: number, e: AnyRecord) => sum + (e.amount || 0), 0),
      riskScore: targetCase.riskScore,
      entityCount: nodes.length,
    };

    return res.json(wrapResponse({ nodes, edges, metrics }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get relationships");
    return res.status(500).json({ error: "Failed to get relationships" });
  }
});

/**
 * GET /analytics/connected-incidents - Cross-case similarity
 */
router.get("/analytics/connected-incidents", (req: Request, res: Response) => {
  try {
    const { caseId } = req.query;
    const targetId = (caseId as string) || CASES_DB[0]?.id;

    if (!targetId) {
      return res.json(wrapResponse({ linkedCases: [] }, req));
    }

    // Simple similarity based on shared fraudType and city
    const target = CASES_DB.find((c) => c.id === targetId);
    if (!target) {
      return res.status(404).json({ error: "Case not found" });
    }

    const linked = CASES_DB.filter((c) => c.id !== targetId).map((c) => {
      let score = 0;
      const shared: string[] = [];
      if (c.fraudType === target.fraudType) { score += 0.5; shared.push("fraudType"); }
      if (c.city === target.city) { score += 0.3; shared.push("city"); }
      if (Math.abs(c.amount - target.amount) < 100000) { score += 0.2; shared.push("amountRange"); }
      return {
        caseId: c.id,
        reference: c.reference,
        sharedEntities: shared,
        similarityScore: Math.round(score * 100) / 100,
        linkType: score > 0.5 ? "entity_overlap" : "complaint_similarity",
      };
    }).filter((l) => l.similarityScore > 0)
      .sort((a: AnyRecord, b: AnyRecord) => b.similarityScore - a.similarityScore);

    return res.json(wrapResponse({ linkedCases: linked }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get connected incidents");
    return res.status(500).json({ error: "Failed to get connected incidents" });
  }
});

/**
 * GET /analytics/corridors - Corridor vulnerability data
 */
router.get("/analytics/corridors", (req: Request, res: Response) => {
  try {
    const corridors = [
      { source: { city: "Bengaluru", state: "Karnataka", coordinates: { lat: 12.9716, lng: 77.5946 } }, destination: { city: "Mumbai", state: "Maharashtra", coordinates: { lat: 19.076, lng: 72.8777 } }, vulnerabilityScore: 82, transactionCount: 47, totalExposure: 2100000 },
      { source: { city: "Delhi", state: "NCR", coordinates: { lat: 28.6139, lng: 77.209 } }, destination: { city: "Bengaluru", state: "Karnataka", coordinates: { lat: 12.9716, lng: 77.5946 } }, vulnerabilityScore: 76, transactionCount: 31, totalExposure: 1500000 },
      { source: { city: "Mumbai", state: "Maharashtra", coordinates: { lat: 19.076, lng: 72.8777 } }, destination: { city: "Hyderabad", state: "Telangana", coordinates: { lat: 17.385, lng: 78.4867 } }, vulnerabilityScore: 68, transactionCount: 22, totalExposure: 890000 },
    ];

    return res.json(wrapResponse({ corridors, totalMatches: corridors.length }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get corridors");
    return res.status(500).json({ error: "Failed to get corridors" });
  }
});

export default router;
