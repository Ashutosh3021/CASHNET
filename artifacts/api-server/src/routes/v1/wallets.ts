/**
 * V1 API Routes - Wallet Analysis
 *
 * Real multi-hop fund tracing from case fund-flow graphs.
 * Traverses actual node/edge relationships to trace fund paths.
 */

import { Router, type IRouter, Request, Response } from "express";
import { logger } from "../../lib/logger";

type AnyRecord = Record<string, any>;

const router: IRouter = Router();

// Fund-flow graphs from seeded cases (shared with cashnet.ts)
const FUND_FLOW_GRAPHS: Record<string, AnyRecord> = {
  "CASE-CASHNET-001": {
    nodes: [
      { id: "victim", label: "Priya Sharma · ••••7890", kind: "VICTIM", risk: 15 },
      { id: "mule-a", label: "Deepak Mehta · ••••3456", kind: "MULE_ACCOUNT", risk: 72 },
      { id: "mule-b", label: "Neeraj Patel · ••••8912", kind: "MULE_ACCOUNT", risk: 81 },
      { id: "exchange", label: "WazirX · Mumbai", kind: "VASP", risk: 68 },
      { id: "wallet-a", label: "0x3F8a…7B2", kind: "CRYPTO_WALLET", risk: 85, chain: "Ethereum" },
      { id: "wallet-b", label: "0x9C1d…4E8", kind: "CRYPTO_WALLET", risk: 89, chain: "Ethereum" },
      { id: "foreign", label: "Binance · SG", kind: "FOREIGN_ENTITY", risk: 79 },
      { id: "cashout", label: "Rakesh Gupta · ••••5678", kind: "BANK_ACCOUNT", risk: 92 },
      { id: "atm", label: "Predicted ATM · Andheri West", kind: "CASH_OUT_LOCATION", risk: 88 },
    ],
    edges: [
      { source: "victim", target: "mule-a", amount: 450000, timestamp: "2026-08-18T10:01:00Z", type: "FIAT_TRANSFER", risk: 38 },
      { source: "mule-a", target: "mule-b", amount: 435000, timestamp: "2026-08-18T10:04:00Z", type: "FIAT_TRANSFER", risk: 74 },
      { source: "mule-b", target: "exchange", amount: 420000, timestamp: "2026-08-18T10:08:00Z", type: "EXCHANGE_DEPOSIT", risk: 82 },
      { source: "exchange", target: "wallet-a", amount: 5040, timestamp: "2026-08-18T10:12:00Z", type: "FIAT_TO_CRYPTO", risk: 88, conversion: true },
      { source: "wallet-a", target: "wallet-b", amount: 4800, timestamp: "2026-08-18T10:18:00Z", type: "CRYPTO_TRANSFER", risk: 91 },
      { source: "wallet-b", target: "foreign", amount: 4650, timestamp: "2026-08-18T10:26:00Z", type: "CROSS_BORDER", risk: 93 },
      { source: "foreign", target: "cashout", amount: 380000, timestamp: "2026-08-18T10:35:00Z", type: "CRYPTO_TO_FIAT", risk: 90, conversion: true },
      { source: "cashout", target: "atm", amount: 350000, timestamp: "2026-08-18T10:48:00Z", type: "CASH_OUT", risk: 94 },
    ],
  },
  "CASE-CASHNET-002": {
    nodes: [
      { id: "victim", label: "Lakshmi Iyer · ••••2345", kind: "VICTIM", risk: 18 },
      { id: "mule-a", label: "Suresh Babu · ••••6789", kind: "MULE_ACCOUNT", risk: 65 },
      { id: "mule-b", label: "Anita Reddy · ••••0123", kind: "MULE_ACCOUNT", risk: 78 },
      { id: "exchange", label: "CoinDCX · Hyderabad", kind: "VASP", risk: 62 },
      { id: "wallet-a", label: "0x5E2b…8C1", kind: "CRYPTO_WALLET", risk: 82, chain: "Ethereum" },
      { id: "wallet-b", label: "0xA4f7…2D9", kind: "CRYPTO_WALLET", risk: 86, chain: "Ethereum" },
      { id: "foreign", label: "OKX · HK", kind: "FOREIGN_ENTITY", risk: 76 },
      { id: "cashout", label: "Mohammed Ali · ••••4567", kind: "BANK_ACCOUNT", risk: 91 },
      { id: "atm", label: "Predicted ATM · Banjara Hills", kind: "CASH_OUT_LOCATION", risk: 85 },
    ],
    edges: [
      { source: "victim", target: "mule-a", amount: 180000, timestamp: "2026-08-18T10:02:00Z", type: "FIAT_TRANSFER", risk: 35 },
      { source: "mule-a", target: "mule-b", amount: 175000, timestamp: "2026-08-18T10:05:00Z", type: "FIAT_TRANSFER", risk: 70 },
      { source: "mule-b", target: "exchange", amount: 168000, timestamp: "2026-08-18T10:09:00Z", type: "EXCHANGE_DEPOSIT", risk: 79 },
      { source: "exchange", target: "wallet-a", amount: 2016, timestamp: "2026-08-18T10:13:00Z", type: "FIAT_TO_CRYPTO", risk: 85, conversion: true },
      { source: "wallet-a", target: "wallet-b", amount: 1920, timestamp: "2026-08-18T10:19:00Z", type: "CRYPTO_TRANSFER", risk: 88 },
      { source: "wallet-b", target: "foreign", amount: 1850, timestamp: "2026-08-18T10:28:00Z", type: "CROSS_BORDER", risk: 90 },
      { source: "foreign", target: "cashout", amount: 152000, timestamp: "2026-08-18T10:38:00Z", type: "CRYPTO_TO_FIAT", risk: 87, conversion: true },
      { source: "cashout", target: "atm", amount: 140000, timestamp: "2026-08-18T10:52:00Z", type: "CASH_OUT", risk: 92 },
    ],
  },
};

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
 * BFS multi-hop trace through fund-flow graph from a starting node.
 */
function traceFromNode(
  graph: AnyRecord,
  startNodeId: string,
  maxHops: number,
  minValue: number,
): { nodes: AnyRecord[]; edges: AnyRecord[]; paths: AnyRecord[][] } {
  const nodeMap = new Map<string, AnyRecord>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  const visited = new Set<string>();
  const resultNodes: AnyRecord[] = [];
  const resultEdges: AnyRecord[] = [];
  const paths: AnyRecord[][] = [];

  // BFS queue: [currentNodeId, pathSoFar, totalAmount]
  const queue: Array<[string, AnyRecord[], number]> = [[startNodeId, [], 0]];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const [currentId, pathSoFar, totalAmount] = queue.shift()!;
    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    // Add node if not already in results
    if (!resultNodes.find((n) => n.id === currentId)) {
      resultNodes.push({ ...currentNode, depth: pathSoFar.length });
    }

    // If path has edges, record it
    if (pathSoFar.length > 0) {
      paths.push(pathSoFar);
    }

    // Stop if max hops reached
    if (pathSoFar.length >= maxHops) continue;

    // Find outgoing edges
    for (const edge of graph.edges) {
      if (edge.source !== currentId) continue;
      if (visited.has(edge.target)) continue;

      const edgeAmount = edge.amount || 0;
      if (edgeAmount < minValue) continue;

      visited.add(edge.target);

      // Add edge
      const edgeRecord = {
        ...edge,
        depth: pathSoFar.length,
        cumulativeAmount: totalAmount + edgeAmount,
      };
      resultEdges.push(edgeRecord);

      const newPath = [...pathSoFar, edgeRecord];
      queue.push([edge.target, newPath, totalAmount + edgeAmount]);
    }
  }

  return { nodes: resultNodes, edges: resultEdges, paths };
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

    // Enrich with fund-flow context from case graph
    const caseId = wallet.caseId;
    const graph = FUND_FLOW_GRAPHS[caseId];
    let enrichedWallet = { ...wallet };

    if (graph) {
      // Find this wallet in the graph
      const graphNode = graph.nodes.find(
        (n: AnyRecord) => n.label?.includes(wallet.address.split("...")[0]) || n.id === wallet.id,
      );
      if (graphNode) {
        const incomingEdges = graph.edges.filter((e: AnyRecord) => e.target === graphNode.id);
        const outgoingEdges = graph.edges.filter((e: AnyRecord) => e.source === graphNode.id);
        enrichedWallet = {
          ...wallet,
          graphPosition: graphNode.kind,
          incomingFlows: incomingEdges.map((e: AnyRecord) => ({
            from: e.source,
            amount: e.amount,
            type: e.type,
            timestamp: e.timestamp,
            risk: e.risk,
          })),
          outgoingFlows: outgoingEdges.map((e: AnyRecord) => ({
            to: e.target,
            amount: e.amount,
            type: e.type,
            timestamp: e.timestamp,
            risk: e.risk,
          })),
          conversionEvents: [...incomingEdges, ...outgoingEdges].filter((e: AnyRecord) => e.conversion),
        };
      }
    }

    return res.json(wrapResponse(enrichedWallet, req));
  } catch (error) {
    logger.error({ error }, "Failed to get wallet");
    return res.status(500).json({ error: "Failed to get wallet" });
  }
});

/**
 * POST /wallets/:address/trace - Real multi-hop fund trace
 *
 * Traverses the case fund-flow graph using BFS from the matching wallet node.
 * Returns all reachable nodes, edges, and complete paths up to maxHops depth.
 */
router.post("/wallets/:address/trace", (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const { maxHops = 3, minValue = 0, chain } = req.body;

    const wallet = WALLETS_DB.find(
      (w) => w.address === address || w.id === address
    );

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const caseId = wallet.caseId;
    const graph = FUND_FLOW_GRAPHS[caseId];

    if (!graph) {
      return res.status(404).json({ error: "Fund-flow graph not found for this wallet's case" });
    }

    // Find the matching graph node for this wallet
    const graphNode = graph.nodes.find(
      (n: AnyRecord) =>
        n.label?.includes(wallet.address.split("...")[0]) ||
        n.id === wallet.id ||
        n.kind === "CRYPTO_WALLET",
    );

    if (!graphNode) {
      return res.status(404).json({ error: "Wallet not found in fund-flow graph" });
    }

    // Real BFS multi-hop trace
    const trace = traceFromNode(graph, graphNode.id, maxHops, minValue);

    // Compute trace metrics
    const totalValue = trace.edges.reduce((sum, e) => sum + (e.amount || 0), 0);
    const maxRisk = Math.max(...trace.nodes.map((n) => n.risk || 0), 0);
    const avgRisk = trace.nodes.length > 0
      ? Math.round(trace.nodes.reduce((sum, n) => sum + (n.risk || 0), 0) / trace.nodes.length)
      : 0;
    const conversionEdges = trace.edges.filter((e) => e.conversion);
    const chains = [...new Set(trace.nodes.filter((n) => n.chain).map((n) => n.chain))];

    const result = {
      origin: { address: wallet.address, chain: wallet.chain, graphNodeId: graphNode.id },
      hops: maxHops,
      nodes: trace.nodes,
      edges: trace.edges,
      paths: trace.paths.map((path) => ({
        length: path.length,
        totalAmount: path[path.length - 1]?.cumulativeAmount || 0,
        riskPath: path.map((e) => e.risk),
        conversionCount: path.filter((e) => e.conversion).length,
      })),
      metrics: {
        totalValue,
        maxRisk,
        avgRisk,
        nodeCount: trace.nodes.length,
        edgeCount: trace.edges.length,
        pathCount: trace.paths.length,
        conversionEvents: conversionEdges.length,
        chains,
      },
    };

    return res.json(wrapResponse(result, req));
  } catch (error) {
    logger.error({ error }, "Failed to trace wallet");
    return res.status(500).json({ error: "Failed to trace wallet" });
  }
});

export default router;
