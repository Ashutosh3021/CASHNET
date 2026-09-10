/**
 * V1 API Routes - Wallet Analysis
 */

import { Router, type IRouter, Request, Response } from "express";
import { logger } from "../../lib/logger";

type AnyRecord = Record<string, any>;

const router: IRouter = Router();

const WALLETS_DB: AnyRecord[] = [
  { id: "WALLET-001", address: "0x7A4C9D12...92F", chain: "Ethereum", inflow: 340000, outflow: 310000, transactions: 12, firstSeen: new Date(2026, 7, 18, 10, 11).toISOString(), lastActive: new Date(2026, 7, 18, 10, 22).toISOString(), vasp: "VASP Alpha", risk: 88, confidence: "HIGH", caseId: "CASE-CASHNET-001" },
  { id: "WALLET-002", address: "bc1q8x...4k2", chain: "Bitcoin", inflow: 160000, outflow: 145000, transactions: 8, firstSeen: new Date(2026, 7, 18, 10, 5).toISOString(), lastActive: new Date(2026, 7, 18, 10, 18).toISOString(), vasp: "Unknown", risk: 74, confidence: "MEDIUM", caseId: "CASE-CASHNET-002" },
];

function wrapResponse<T>(data: T, req: Request) {
  return {
    data,
    meta: {
      requestId: (req as any).id || `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      provenance: { dataSource: "SYNTHETIC" as const, sourceName: "cashnet-seeded", sourceReference: "api-v1-wallets", retrievedAt: new Date().toISOString(), confidence: 0.85 },
    },
  };
}

/**
 * GET /wallets - List tracked wallets
 */
router.get("/wallets", (req: Request, res: Response) => {
  try {
    const { chain, minRisk, limit } = req.query;
    let wallets = [...WALLETS_DB];

    if (chain) wallets = wallets.filter((w) => w.chain === chain);
    if (minRisk) wallets = wallets.filter((w) => w.risk >= parseInt(minRisk as string));
    if (limit) wallets = wallets.slice(0, parseInt(limit as string));

    return res.json(wrapResponse({ wallets, total: wallets.length }, req));
  } catch (error) {
    logger.error({ error }, "Failed to list wallets");
    return res.status(500).json({ error: "Failed to list wallets" });
  }
});

/**
 * GET /wallets/:address - Wallet analysis
 */
router.get("/wallets/:address", (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const wallet = WALLETS_DB.find(
      (w) => w.address === address || w.id === address
    );

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    return res.json(wrapResponse(wallet, req));
  } catch (error) {
    logger.error({ error }, "Failed to get wallet");
    return res.status(500).json({ error: "Failed to get wallet" });
  }
});

/**
 * POST /wallets/:address/trace - Multi-hop fund trace
 */
router.post("/wallets/:address/trace", (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const { maxHops, minValue, chain } = req.body;

    const wallet = WALLETS_DB.find(
      (w) => w.address === address || w.id === address
    );

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Build a sample trace graph
    const trace = {
      origin: { address: wallet.address, chain: wallet.chain },
      hops: maxHops || 3,
      nodes: [
        { id: wallet.id, type: "WALLET", label: wallet.address, risk: wallet.risk },
        { id: "VASP-ALPHA", type: "VASP", label: "VASP Alpha", risk: 72 },
        { id: "ACCOUNT-001", type: "BANK_ACCOUNT", label: "XXXXXX4821", risk: 78 },
      ],
      edges: [
        { source: "ACCOUNT-001", target: "VASP-ALPHA", amount: 186500, type: "FIAT_TO_CRYPTO", timestamp: new Date(2026, 7, 18, 10, 11).toISOString() },
        { source: "VASP-ALPHA", target: wallet.id, amount: 170000, type: "CRYPTO_TRANSFER", timestamp: new Date(2026, 7, 18, 10, 15).toISOString() },
      ],
      totalValue: 170000,
      riskScore: wallet.risk,
    };

    return res.json(wrapResponse(trace, req));
  } catch (error) {
    logger.error({ error }, "Failed to trace wallet");
    return res.status(500).json({ error: "Failed to trace wallet" });
  }
});

export default router;
