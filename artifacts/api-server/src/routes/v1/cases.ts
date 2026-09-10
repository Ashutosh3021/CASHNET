/**
 * V1 API Routes - Cases (Read-Only for external consumers)
 */

import { Router, type IRouter, Request, Response } from "express";
import { logger } from "../../lib/logger";

type AnyRecord = Record<string, any>;

const router: IRouter = Router();

// Same seed data as analytics (shared source)
const CASES_DB: AnyRecord[] = [
  {
    id: "CASE-CASHNET-001",
    reference: "NCRP-SYN-260818-001",
    title: "Suspicious ATM withdrawal pattern",
    fraudType: "UPI scam",
    amount: 420000,
    city: "Bengaluru",
    state: "Karnataka",
    status: "OPEN",
    priority: "HIGH",
    riskScore: 92,
    riskCategory: "CRITICAL",
    createdAt: new Date(2026, 7, 18, 9, 30).toISOString(),
    updatedAt: new Date(2026, 7, 18, 10, 44).toISOString(),
    accounts: [
      { id: "ACC-001", masked: "XXXXXX4821", bank: "Synthetic National Bank", branch: "Indiranagar Branch", ifsc: "SYNB0004821", inflow: 420000, outflow: 385000, risk: 78 },
    ],
    wallets: [
      { id: "WALLET-001", address: "0x7A4C9D12...92F", chain: "Ethereum", inflow: 340000, outflow: 310000, risk: 88 },
    ],
    transactions: [
      { id: "TXN-001", source: "ACC-001", destination: "ACC-002", amount: 186500, currency: "INR", type: "TRANSFER", timestamp: new Date(2026, 7, 18, 10, 1).toISOString(), risk: 72 },
      { id: "TXN-002", source: "ACC-002", destination: "WALLET-001", amount: 186500, currency: "INR", type: "CRYPTO_CONVERSION", timestamp: new Date(2026, 7, 18, 10, 11).toISOString(), risk: 91, isConversion: true },
    ],
    risk: { score: 92, category: "CRITICAL", confidence: 0.87, features: ["HIGH_VELOCITY", "RAPID_TRANSFERS", "CRYPTO_CONVERSION"], modelVersion: "184-v2" },
    provenance: { dataSource: "SYNTHETIC", sourceName: "cashnet-seeded", sourceReference: "CASE-CASHNET-001", retrievedAt: new Date().toISOString(), confidence: 0.91 },
  },
  {
    id: "CASE-CASHNET-002",
    reference: "NCRP-SYN-260818-002",
    title: "Cross-border crypto conversion ring",
    fraudType: "Investment fraud",
    amount: 198000,
    city: "Mumbai",
    state: "Maharashtra",
    status: "OPEN",
    priority: "MEDIUM",
    riskScore: 78,
    riskCategory: "HIGH",
    createdAt: new Date(2026, 7, 18, 10, 0).toISOString(),
    updatedAt: new Date(2026, 7, 18, 10, 22).toISOString(),
    accounts: [
      { id: "ACC-003", masked: "XXXXXX7890", bank: "ICICI Bank", branch: "Bandra Branch", ifsc: "ICIC0007890", inflow: 198000, outflow: 175000, risk: 72 },
    ],
    wallets: [
      { id: "WALLET-002", address: "bc1q8x...4k2", chain: "Bitcoin", inflow: 160000, outflow: 145000, risk: 74 },
    ],
    transactions: [],
    risk: { score: 78, category: "HIGH", confidence: 0.78, features: ["CROSS_BORDER", "CRYPTO_CONVERSION"], modelVersion: "184-v2" },
    provenance: { dataSource: "SYNTHETIC", sourceName: "cashnet-seeded", sourceReference: "CASE-CASHNET-002", retrievedAt: new Date().toISOString(), confidence: 0.78 },
  },
];

function wrapResponse<T>(data: T, req: Request) {
  return {
    data,
    meta: {
      requestId: (req as any).id || `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      provenance: { dataSource: "SYNTHETIC" as const, sourceName: "cashnet-seeded", sourceReference: "api-v1", retrievedAt: new Date().toISOString(), confidence: 0.9 },
    },
  };
}

/**
 * GET /cases - List cases with filtering
 */
router.get("/cases", (req: Request, res: Response) => {
  try {
    const { city, fraudType, status, riskMinimum, limit, offset } = req.query;
    let cases = [...CASES_DB];

    if (city) cases = cases.filter((c) => c.city.toLowerCase() === String(city).toLowerCase());
    if (fraudType) cases = cases.filter((c) => c.fraudType === fraudType);
    if (status) cases = cases.filter((c) => c.status === status);
    if (riskMinimum) cases = cases.filter((c) => c.riskScore >= parseInt(riskMinimum as string));

    const total = cases.length;
    const start = offset ? parseInt(offset as string) : 0;
    const lim = limit ? parseInt(limit as string) : 50;
    cases = cases.slice(start, start + lim);

    return res.json(
      wrapResponse(
        { cases, total, offset: start, limit: lim },
        req
      )
    );
  } catch (error) {
    logger.error({ error }, "Failed to list cases");
    return res.status(500).json({ error: "Failed to list cases" });
  }
});

/**
 * GET /cases/:caseId - Case detail
 */
router.get("/cases/:caseId", (req: Request, res: Response) => {
  try {
    const caseId = String(req.params.caseId);
    const caseData = CASES_DB.find((c) => c.id === caseId);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    return res.json(wrapResponse(caseData, req));
  } catch (error) {
    logger.error({ error }, "Failed to get case");
    return res.status(500).json({ error: "Failed to get case" });
  }
});

/**
 * GET /cases/:caseId/fund-flow - Fund-flow graph
 */
router.get("/cases/:caseId/fund-flow", (req: Request, res: Response) => {
  try {
    const caseId = String(req.params.caseId);
    const caseData = CASES_DB.find((c) => c.id === caseId);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const nodes = [
      { id: "VICTIM", kind: "VICTIM", label: `Victim (${caseData.city})`, risk: 0, lat: 28.6139, lng: 77.209 },
      ...(caseData.accounts || []).map((a: AnyRecord) => ({
        id: a.id, kind: "BANK_ACCOUNT", label: `${a.bank} ${a.masked}`, risk: a.risk,
      })),
      ...(caseData.wallets || []).map((w: AnyRecord) => ({
        id: w.id, kind: "CRYPTO_WALLET", label: w.address, risk: w.risk,
      })),
      { id: "VASP-ALPHA", kind: "VASP", label: "VASP Alpha", risk: 72 },
      { id: "ATM-PREDICTED", kind: "CASH_OUT_LOCATION", label: "Predicted ATM", risk: 94 },
    ];

    const edges = [
      { id: "E1", source: "VICTIM", target: caseData.accounts?.[0]?.id || "ACC-001", amount: caseData.amount, timestamp: new Date(2026, 7, 18, 10, 1).toISOString(), type: "FIAT_TRANSFER", risk: 72 },
      { id: "E2", source: caseData.accounts?.[0]?.id || "ACC-001", target: "VASP-ALPHA", amount: caseData.amount * 0.85, timestamp: new Date(2026, 7, 18, 10, 11).toISOString(), type: "CRYPTO_CONVERSION", risk: 91, isConversion: true },
      { id: "E3", source: "VASP-ALPHA", target: caseData.wallets?.[0]?.id || "WALLET-001", amount: caseData.amount * 0.8, timestamp: new Date(2026, 7, 18, 10, 15).toISOString(), type: "CRYPTO_TRANSFER", risk: 85 },
    ];

    return res.json(wrapResponse({ nodes, edges, metrics: { risk: caseData.riskScore, totalValue: caseData.amount } }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get fund flow");
    return res.status(500).json({ error: "Failed to get fund flow" });
  }
});

/**
 * GET /cases/:caseId/transactions - Transaction timeline
 */
router.get("/cases/:caseId/transactions", (req: Request, res: Response) => {
  try {
    const caseId = String(req.params.caseId);
    const caseData = CASES_DB.find((c) => c.id === caseId);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    return res.json(wrapResponse({ transactions: caseData.transactions || [] }, req));
  } catch (error) {
    logger.error({ error }, "Failed to get transactions");
    return res.status(500).json({ error: "Failed to get transactions" });
  }
});

/**
 * GET /cases/:caseId/report - Investigation report
 */
router.get("/cases/:caseId/report", (req: Request, res: Response) => {
  try {
    const caseId = String(req.params.caseId);
    const caseData = CASES_DB.find((c) => c.id === caseId);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    const report = {
      caseId: caseData.id,
      reference: caseData.reference,
      title: caseData.title,
      generatedAt: new Date().toISOString(),
      disclaimer: "Analytical prediction — requires investigator validation.",
      sections: [
        { type: "CASE_SUMMARY", title: "Case Summary", content: `${caseData.title} — ${caseData.fraudType} — ${caseData.city}, ${caseData.state}`, provenance: { dataSource: "SYNTHETIC" } },
        { type: "RISK_ANALYSIS", title: "Risk Assessment", content: `Risk score: ${caseData.riskScore} (${caseData.riskCategory})`, provenance: { dataSource: "MODEL_INFERENCE" } },
        { type: "ACCOUNT_ANALYSIS", title: "Account Analysis", content: `${caseData.accounts?.length || 0} linked accounts`, provenance: { dataSource: "SYNTHETIC" } },
        { type: "CRYPTO_ANALYSIS", title: "Crypto Analysis", content: `${caseData.wallets?.length || 0} tracked wallets`, provenance: { dataSource: "SYNTHETIC" } },
      ],
    };

    return res.json(wrapResponse(report, req));
  } catch (error) {
    logger.error({ error }, "Failed to get report");
    return res.status(500).json({ error: "Failed to get report" });
  }
});

export default router;
