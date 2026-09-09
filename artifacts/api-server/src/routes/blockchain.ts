/**
 * Blockchain intelligence routes.
 *
 * Provides wallet analysis, transaction retrieval, and graph traversal
 * using real public blockchain APIs (Blockstream, Etherscan, Trongrid).
 */

import { Router } from "express";
import {
  createBlockchainProviders,
  type BlockchainProvider,
} from "../providers/blockchain-providers";
import { attributeWallet, traverseGraph, type GraphEdge } from "../providers/vasp-attribution";
import { logger } from "../lib/logger";

const router = Router();

let providers: BlockchainProvider[] = [];
try {
  providers = createBlockchainProviders();
} catch (e) {
  logger.warn({ error: (e as Error).message }, "Failed to initialize blockchain providers");
}

function getProvider(chain: string): BlockchainProvider | undefined {
  return providers.find((p) => p.chain === chain);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

// GET /blockchain/status - Status of all blockchain providers
router.get("/status", async (_req, res) => {
  const statuses = await Promise.all(providers.map((p) => p.getStatus()));
  res.json({
    providers: statuses,
    timestamp: new Date().toISOString(),
  });
});

// GET /blockchain/wallet/:address/transactions - Get wallet transactions
router.get("/wallet/:address/transactions", async (req, res) => {
  const address = req.params.address;
  const chain = asString(req.query.chain) || "bitcoin";
  const limit = parseInt(asString(req.query.limit)) || 100;

  const provider = getProvider(chain);
  if (!provider) {
    res.status(404).json({
      error: "Blockchain provider not available",
      message: `No provider configured for chain: ${chain}`,
      status: "DATA_SOURCE_UNAVAILABLE",
    });
    return;
  }

  try {
    const transactions = await provider.getTransactions(address, limit);
    res.json({
      address,
      chain,
      transactions,
      count: transactions.length,
      dataSource: "PUBLIC_DATA",
      providerStatus: provider.name,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, address, chain }, "Failed to get transactions");
    res.status(502).json({
      error: "Failed to retrieve transactions",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
  }
});

// GET /blockchain/wallet/:address - Get wallet balance and activity
router.get("/wallet/:address", async (req, res) => {
  const address = req.params.address;
  const chain = asString(req.query.chain) || "bitcoin";

  const provider = getProvider(chain);
  if (!provider) {
    res.status(404).json({
      error: "Blockchain provider not available",
      message: `No provider configured for chain: ${chain}`,
      status: "DATA_SOURCE_UNAVAILABLE",
    });
    return;
  }

  try {
    const [balance, activity] = await Promise.all([
      provider.getBalance(address),
      provider.getAddressActivity(address),
    ]);

    const transactions = await provider.getTransactions(address, 50);
    const graphEdges: GraphEdge[] = transactions.map((tx) => ({
      from: tx.fromAddress,
      to: tx.toAddress,
      value: tx.value,
      currency: tx.currency,
      timestamp: tx.blockTimestamp,
      txHash: tx.txHash,
    }));

    const attribution = attributeWallet(address, chain, graphEdges);

    res.json({
      address,
      chain,
      balance,
      activity,
      attribution,
      dataSource: "PUBLIC_DATA",
      providerStatus: provider.name,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, address, chain }, "Failed to get wallet info");
    res.status(502).json({
      error: "Failed to retrieve wallet information",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
  }
});

// GET /blockchain/transaction/:txHash - Get single transaction
router.get("/transaction/:txHash", async (req, res) => {
  const txHash = req.params.txHash;
  const chain = asString(req.query.chain) || "bitcoin";

  const provider = getProvider(chain);
  if (!provider) {
    res.status(404).json({
      error: "Blockchain provider not available",
      message: `No provider configured for chain: ${chain}`,
      status: "DATA_SOURCE_UNAVAILABLE",
    });
    return;
  }

  try {
    const transaction = await provider.getTransaction(txHash);
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json({ transaction, dataSource: "PUBLIC_DATA" });
  } catch (error) {
    logger.error({ error: (error as Error).message, txHash }, "Failed to get transaction");
    res.status(502).json({
      error: "Failed to retrieve transaction",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
  }
});

// POST /blockchain/graph - Multi-hop graph traversal
router.post("/graph", async (req, res) => {
  const { address, chain = "bitcoin", maxHops = 3 } = req.body;

  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const provider = getProvider(chain);
  if (!provider) {
    res.status(404).json({
      error: "Blockchain provider not available",
      message: `No provider configured for chain: ${chain}`,
      status: "DATA_SOURCE_UNAVAILABLE",
    });
    return;
  }

  try {
    const transactions = await provider.getTransactions(address, 200);
    const graphEdges: GraphEdge[] = transactions.map((tx) => ({
      from: tx.fromAddress,
      to: tx.toAddress,
      value: tx.value,
      currency: tx.currency,
      timestamp: tx.blockTimestamp,
      txHash: tx.txHash,
    }));

    const graph = traverseGraph(address, graphEdges, maxHops);

    res.json({
      seedAddress: address,
      chain,
      maxHops,
      graph,
      dataSource: "PUBLIC_DATA",
      providerStatus: provider.name,
    });
  } catch (error) {
    logger.error({ error: (error as Error).message, address, chain }, "Failed to build graph");
    res.status(502).json({
      error: "Failed to build transaction graph",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
  }
});

// POST /blockchain/attribute - Attribute a wallet address
router.post("/attribute", async (req, res) => {
  const { address, chain = "bitcoin" } = req.body;

  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const provider = getProvider(chain);
  if (!provider) {
    res.status(404).json({
      error: "Blockchain provider not available",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
    return;
  }

  try {
    const transactions = await provider.getTransactions(address, 100);
    const graphEdges: GraphEdge[] = transactions.map((tx) => ({
      from: tx.fromAddress,
      to: tx.toAddress,
      value: tx.value,
      currency: tx.currency,
      timestamp: tx.blockTimestamp,
      txHash: tx.txHash,
    }));

    const attribution = attributeWallet(address, chain, graphEdges);
    res.json({ attribution, dataSource: "PUBLIC_DATA" });
  } catch (error) {
    logger.error({ error: (error as Error).message, address }, "Failed to attribute wallet");
    res.status(502).json({
      error: "Failed to attribute wallet",
      status: "DATA_SOURCE_UNAVAILABLE",
    });
  }
});

export default router;
