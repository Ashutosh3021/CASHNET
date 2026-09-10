/* â”€â”€â”€ CASHNET Deterministic Investigation Scenario Engine â”€â”€â”€ */
import type {
  BlockchainNetwork,
  InvestigationConfig,
  InvestigationResult,
  WalletProfile,
  TrackedWallet,
  TransactionRecord,
  GraphNode,
  GraphEdge,
  ClusterAnalysis,
  VASPAttribution,
  TypologyDetection,
  EvidenceSource,
  RiskAssessment,
  TimelineEvent,
  Recommendation,
  RiskLevel,
  NodeType,
  TransactionDirection,
  TransactionStatus,
} from "@/types/investigation";
import { getRiskLevel } from "@/types/investigation";

/* â”€â”€â”€ Seeded PRNG â”€â”€â”€ */
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(rng: () => number, arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function rangeInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function rangeFloat(
  rng: () => number,
  min: number,
  max: number,
  decimals = 2,
): number {
  return Number((rng() * (max - min) + min).toFixed(decimals));
}

/* â”€â”€â”€ Address Generation â”€â”€â”€ */
function genHex(rng: () => number, len: number): string {
  const chars = "0123456789abcdef";
  let r = "";
  for (let i = 0; i < len; i++) r += chars[Math.floor(rng() * 16)];
  return r;
}

function genAddress(rng: () => number, chain: BlockchainNetwork): string {
  switch (chain) {
    case "ETHEREUM":
      return "0x" + genHex(rng, 40);
    case "BITCOIN":
      return "bc1q" + genHex(rng, 38);
    case "TRON":
      return "T" + genHex(rng, 33).replace(/[^a-zA-Z0-9]/g, "A");
    case "BNB":
      return "0x" + genHex(rng, 40);
    case "POLYGON":
      return "0x" + genHex(rng, 40);
    case "SOLANA": {
      const chars =
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      let a = "";
      for (let i = 0; i < 44; i++) a += chars[Math.floor(rng() * chars.length)];
      return a;
    }
  }
}

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/* â”€â”€â”€ Validation â”€â”€â”€ */
export function detectChain(address: string): BlockchainNetwork | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "ETHEREUM";
  if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) return "BITCOIN";
  if (/^T[a-zA-Z0-9]{33}$/.test(address)) return "TRON";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "SOLANA";
  return null;
}

export function validateAddress(
  address: string,
  chain?: BlockchainNetwork | "AUTO",
): { valid: boolean; detectedChain: BlockchainNetwork | null; error?: string } {
  if (!address || address.trim().length === 0)
    return {
      valid: false,
      detectedChain: null,
      error: "Wallet address required",
    };
  const detected = detectChain(address.trim());
  if (!detected)
    return {
      valid: false,
      detectedChain: null,
      error: "Invalid wallet address format",
    };
  if (chain && chain !== "AUTO" && detected !== chain)
    return {
      valid: false,
      detectedChain: detected,
      error: `Address format matches ${detected}, not ${chain}`,
    };
  return { valid: true, detectedChain: detected };
}

/* â”€â”€â”€ Asset by chain â”€â”€â”€ */
function getAsset(chain: BlockchainNetwork): string {
  const map: Record<BlockchainNetwork, string> = {
    ETHEREUM: "ETH",
    BITCOIN: "BTC",
    TRON: "TRX",
    BNB: "BNB",
    POLYGON: "MATIC",
    SOLANA: "SOL",
  };
  return map[chain];
}

/* â”€â”€â”€ Pool data for scenario generation â”€â”€â”€ */
const VASP_NAMES = [
  "Binance",
  "Coinbase",
  "Kraken",
  "OKX",
  "WazirX",
  "Bybit",
  "KuCoin",
  "Huobi",
];
const UNKNOWN_ENTITIES = [
  "Unknown Entity",
  "Possible Exchange Cluster",
  "Unidentified Offshore Cluster",
  "Suspected Mixing Service",
];
const TYPOLOGY_POOL = [
  {
    name: "Layering",
    evidence:
      "Funds moved through multiple intermediary wallets within a short activity window.",
  },
  {
    name: "Structuring",
    evidence:
      "Transaction amounts structured below reporting thresholds across multiple transfers.",
  },
  {
    name: "Rapid Movement",
    evidence:
      "High-velocity fund transfers with minimal holding time between hops.",
  },
  {
    name: "Peel Chain",
    evidence:
      "Sequential decreasing transactions suggesting systematic extraction pattern.",
  },
  {
    name: "Exchange Hopping",
    evidence:
      "Funds routed through multiple exchange wallets to obscure origin.",
  },
  {
    name: "Fan-In",
    evidence:
      "Multiple source wallets consolidating funds into a single destination.",
  },
  {
    name: "Fan-Out",
    evidence:
      "Single source distributing funds across multiple destination wallets.",
  },
  {
    name: "High-Risk Exposure",
    evidence:
      "Direct or near-direct interaction with wallets flagged by intelligence providers.",
  },
  {
    name: "Concentration",
    evidence:
      "Significant fund concentration from diverse sources into controlled wallets.",
  },
];
const RELATIONSHIP_TYPES = [
  "Direct Transfer",
  "Cluster Member",
  "Intermediary",
  "Exchange Deposit",
  "Exchange Withdrawal",
  "Contract Interaction",
];
const WALLET_TYPES = [
  "EOA",
  "Contract",
  "Multi-Sig",
  "Exchange Hot Wallet",
  "Exchange Cold Wallet",
  "DeFi Protocol",
];
const VASP_EVIDENCE_POOL = [
  "Direct address intelligence match",
  "Transaction proximity to known exchange wallets",
  "Cluster association with identified VASP infrastructure",
  "Counterparty behaviour consistent with exchange operations",
  "Exchange deposit pattern detected",
  "Cross-border USDT transfer pattern",
  "Off-ramp behaviour detected",
  "Known exchange address database match",
];
const CLUSTER_EVIDENCE_POOL = [
  "Shared transaction counterparties",
  "Repeated fund movement patterns",
  "Temporal correlation in transaction timing",
  "Common exchange interaction endpoints",
  "Transaction graph proximity within 2 hops",
  "Coordinated transaction volume spikes",
];
const FINDING_POOL = [
  "Rapid fund movement detected across multiple wallets",
  "Multi-wallet transaction pattern identified suggesting coordination",
  "High-risk cluster exposure detected through graph analysis",
  "Exchange interaction observed with multiple VASPs",
  "Repeated counterparty behaviour consistent with structured transfers",
  "Significant volume anomaly detected in recent activity window",
  "Cross-chain bridge interaction observed",
  "Unusual transaction timing pattern suggests automated behaviour",
];

/* â”€â”€â”€ Demo Scenarios â”€â”€â”€ */
export const DEMO_ADDRESSES: Array<{
  address: string;
  chain: BlockchainNetwork;
  label: string;
}> = [
  {
    address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    chain: "SOLANA",
    label: "DEMO 01 — Solana Contract (CL-SOL-3247)",
  },
  {
    address: "0x8f3Cb29A5E1d2F7a8B4c0D6e9F1a3B5c7D9E2F4a",
    chain: "ETHEREUM",
    label: "DEMO 02 — Ethereum Multi-Hop",
  },
  {
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    chain: "BITCOIN",
    label: "DEMO 03 — Bitcoin Mixer Cluster",
  },
  {
    address: "TN2Y8vFcab1W2kR6Lq9PjGaTe4sXbJz5dA",
    chain: "TRON",
    label: "DEMO 04 — Tron High-Risk Corridor",
  },
];

/* â”€â”€â”€ Main Generation â”€â”€â”€ */
export function generateScenario(
  config: InvestigationConfig,
): InvestigationResult {
  const seedStr = `${config.address}-${config.blockchain}-${config.depth}-${config.scopes.join("-")}`;
  const seed = hashString(seedStr);
  const rng = createRng(seed);

  const chain: BlockchainNetwork =
    config.blockchain === "AUTO"
      ? detectChain(config.address) || "ETHEREUM"
      : config.blockchain;
  const asset = getAsset(chain);
  const investigationId = `INV-2026-${genHex(rng, 4).toUpperCase()}`;

    // Risk score: demo addresses get specific scores, others are seeded
  let baseRisk: number;
  const demoIdx = DEMO_ADDRESSES.findIndex((d) => d.address === config.address);
  const isSolanaDemo =
    config.address.includes("1A1zP1") ||
    config.address === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" ||
    (demoIdx === 0 && config.blockchain === "SOLANA");

  if (isSolanaDemo) {
    baseRisk = 85;
  } else if (demoIdx === 1) baseRisk = 82;
  else if (demoIdx === 2) baseRisk = 61;
  else if (demoIdx === 3) baseRisk = 94;
  else baseRisk = rangeInt(rng, 15, 98);

  const riskLevel = getRiskLevel(baseRisk);
  const txCount = isSolanaDemo ? 648 : rangeInt(rng, 120 + baseRisk * 5, 300 + baseRisk * 12);
  const walletCount = Math.max(16, rangeInt(rng, 10 + config.depth * 2, 16 + config.depth * 4));

  // Wallet Profile
  const firstYear = rangeInt(rng, 2019, 2023);
  const totalReceived = isSolanaDemo ? 497.78 : rangeFloat(rng, 50 + baseRisk * 3, 200 + baseRisk * 10);
  const totalSent = isSolanaDemo ? 412.29 : rangeFloat(rng, totalReceived * 0.7, totalReceived * 0.98);
  const clusterId = isSolanaDemo ? "CL-SOL-3247" : `CL-${chain.slice(0, 3)}-${rangeInt(rng, 1000, 9999)}`;

  const wallet: WalletProfile = {
    address: isSolanaDemo ? "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" : config.address,
    blockchain: isSolanaDemo ? "SOLANA" : chain,
    asset: isSolanaDemo ? "SOL" : asset,
    walletType: isSolanaDemo ? "Contract" : pick(rng, WALLET_TYPES.slice(0, 3)),
    firstActivity: isSolanaDemo ? "2020-10-11" : `${firstYear}-${String(rangeInt(rng, 1, 12)).padStart(2, "0")}-${String(rangeInt(rng, 1, 28)).padStart(2, "0")}`,
    lastActivity: "2026-09-09",
    transactionCount: txCount,
    totalReceived,
    totalSent,
    estimatedBalance: isSolanaDemo ? 85.49 : Number((totalReceived - totalSent).toFixed(4)),
    activePeriodDays: isSolanaDemo ? 2159 : (2026 - firstYear) * 365 + rangeInt(rng, 10, 200),
    clusterId,
  };

  // Risk Assessment
  const numIndicators = rangeInt(rng, 3, 6);
  const indicatorPool = [
    {
      name: "Rapid Movement",
      weight: 20,
      description: "High-velocity fund transfers detected",
    },
    {
      name: "High-Risk Exposure",
      weight: 30,
      description: "Interaction with flagged entities",
    },
    {
      name: "Layering",
      weight: 15,
      description: "Multi-hop obfuscation pattern",
    },
    {
      name: "Exchange Hopping",
      weight: 10,
      description: "Multiple exchange interactions",
    },
    {
      name: "Cluster Risk",
      weight: 15,
      description: "Association with high-risk cluster",
    },
    {
      name: "Large Volume",
      weight: 10,
      description: "Transaction volume exceeds monitoring threshold",
    },
    {
      name: "Temporal Anomaly",
      weight: 12,
      description: "Unusual transaction timing pattern",
    },
    {
      name: "Cross-Chain Activity",
      weight: 8,
      description: "Bridge interactions detected",
    },
  ];
  const indicators = pickN(rng, indicatorPool, numIndicators);
  const findings = pickN(rng, FINDING_POOL, rangeInt(rng, 3, 6));

  const risk: RiskAssessment = {
    overallScore: baseRisk,
    level: riskLevel,
    indicators,
    findings,
  };

  // Tracked Wallets
  const trackedWallets: TrackedWallet[] = [
    {
      address: config.address,
      relationship: "Target",
      risk: riskLevel,
      riskScore: baseRisk,
      confidence: 100,
      hop: 0,
      transactionCount: txCount,
      totalVolume: totalReceived,
      nodeType: "TARGET",
      profile: wallet,
    },
  ];
  for (let i = 0; i < walletCount; i++) {
    const hop = Math.min(config.depth, rangeInt(rng, 1, config.depth));
    const wRisk = Math.max(0, baseRisk - hop * rangeInt(rng, 5, 20));
    const wLevel = getRiskLevel(wRisk);
    const nt: NodeType =
      rng() > 0.7
        ? "CLUSTER_MEMBER"
        : rng() > 0.5
          ? "INTERMEDIARY"
          : "LINKED_WALLET";
    const wAddr = genAddress(rng, chain);
    const wTxCount = rangeInt(rng, 5, 200);
    const wVolume = rangeFloat(rng, 1, totalReceived * 0.4);
    const wSent = rangeFloat(rng, wVolume * 0.5, wVolume * 0.95);
    const wFirstYear = rangeInt(rng, 2019, 2024);
    trackedWallets.push({
      address: wAddr,
      relationship: pick(rng, RELATIONSHIP_TYPES),
      risk: wLevel,
      riskScore: wRisk,
      confidence: rangeInt(rng, 60 + (config.depth - hop) * 5, 98),
      hop,
      transactionCount: wTxCount,
      totalVolume: wVolume,
      nodeType: nt,
      profile: {
        address: wAddr,
        blockchain: chain,
        asset,
        walletType: pick(rng, WALLET_TYPES),
        firstActivity: `${wFirstYear}-${String(rangeInt(rng, 1, 12)).padStart(2, "0")}-${String(rangeInt(rng, 1, 28)).padStart(2, "0")}`,
        lastActivity: `2026-09-${String(rangeInt(rng, 1, 9)).padStart(2, "0")}`,
        transactionCount: wTxCount,
        totalReceived: wVolume,
        totalSent: wSent,
        estimatedBalance: Number((wVolume - wSent).toFixed(4)),
        activePeriodDays: (2026 - wFirstYear) * 365 + rangeInt(rng, 10, 200),
        clusterId: rng() > 0.6 ? clusterId : `CL-${chain.slice(0, 3)}-${rangeInt(rng, 1000, 9999)}`,
      },
    });
  }

  // Add VASP node
  const isKnownVasp = rng() > 0.3;
  const vaspName = isKnownVasp
    ? pick(rng, VASP_NAMES)
    : pick(rng, UNKNOWN_ENTITIES);
  const vaspAddr = genAddress(rng, chain);
  const vaspTxCount = rangeInt(rng, 10, 80);
  const vaspVol = rangeFloat(rng, 10, totalReceived * 0.3);
  trackedWallets.push({
    address: vaspAddr,
    relationship: "Exchange Deposit",
    risk: "MEDIUM" as RiskLevel,
    riskScore: 35,
    confidence: rangeInt(rng, 70, 95),
    hop: rangeInt(rng, 1, config.depth),
    transactionCount: vaspTxCount,
    totalVolume: vaspVol,
    nodeType: "VASP",
    profile: {
      address: vaspAddr,
      blockchain: chain,
      asset,
      walletType: "Exchange Hot Wallet",
      firstActivity: `${rangeInt(rng, 2018, 2022)}-01-01`,
      lastActivity: "2026-09-09",
      transactionCount: vaspTxCount * rangeInt(rng, 10, 50),
      totalReceived: vaspVol * rangeInt(rng, 5, 20),
      totalSent: vaspVol * rangeInt(rng, 4, 19),
      estimatedBalance: rangeFloat(rng, 100, 5000),
      activePeriodDays: rangeInt(rng, 1000, 2500),
      clusterId: `CL-VASP-${rangeInt(rng, 100, 999)}`,
    },
  });

  // Transactions
  const transactions: TransactionRecord[] = [];
  const shownTxCount = Math.min(txCount, 50); // generate up to 50 for display
  for (let i = 0; i < shownTxCount; i++) {
    const dir: TransactionDirection = rng() > 0.45 ? "OUTGOING" : "INCOMING";
    const tRisk = rangeInt(rng, 0, 100);
    const month = String(rangeInt(rng, 1, 9)).padStart(2, "0");
    const day = String(rangeInt(rng, 1, 28)).padStart(2, "0");
    const hour = String(rangeInt(rng, 0, 23)).padStart(2, "0");
    const min = String(rangeInt(rng, 0, 59)).padStart(2, "0");
    const counterparty =
      trackedWallets[rangeInt(rng, 1, trackedWallets.length - 1)]?.address ||
      genAddress(rng, chain);
    const gasVal = rangeInt(rng, 21000, 250000);
    const gasPriceGwei = rangeFloat(rng, 5, 120, 2);
    const gasUsedVal = rangeInt(rng, 21000, gasVal);
    const txFee = Number((gasUsedVal * gasPriceGwei * 1e-9).toFixed(8));
    const statusRoll = rng();
    const txStatus: TransactionStatus = statusRoll > 0.08 ? "SUCCESS" : statusRoll > 0.02 ? "FAILED" : "PENDING";
    const nonceVal = rangeInt(rng, 0, 5000);
    const methodIds = ["0xa9059cbb", "0x095ea7b3", "0x23b872dd", "0xd0e30db0", "0x2e1a7d4d", "0x", "0x38ed1739", "0x18cbafe5"];
    const methodId = pick(rng, methodIds);
    const hasContract = rng() > 0.4;
    transactions.push({
      hash: "0x" + genHex(rng, 64),
      timestamp: `2026-${month}-${day}T${hour}:${min}:00Z`,
      from: dir === "OUTGOING" ? config.address : counterparty,
      to: dir === "OUTGOING" ? counterparty : config.address,
      amount: rangeFloat(rng, 0.01, totalReceived * 0.05),
      asset,
      direction: dir,
      risk: getRiskLevel(tRisk),
      riskScore: tRisk,
      blockNumber: rangeInt(rng, 18000000, 20500000),
      gas: gasVal,
      gasPrice: `${gasPriceGwei} Gwei`,
      gasUsed: gasUsedVal,
      transactionFee: `${txFee} ${asset}`,
      status: txStatus,
      nonce: nonceVal,
      inputData: methodId === "0x" ? "0x" : `${methodId}${genHex(rng, 64)}`,
      methodId,
      contractAddress: hasContract ? genAddress(rng, chain) : null,
      confirmations: rangeInt(rng, 12, 500000),
    });
  }
  transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  // Graph Nodes
  const graphNodes: GraphNode[] = trackedWallets.map((w, i) => ({
    id: w.address,
    label:
      i === 0
        ? "Target"
        : w.nodeType === "VASP"
          ? vaspName
          : truncAddr(w.address),
    nodeType: w.nodeType,
    risk: w.risk,
    riskScore: w.riskScore,
    hop: w.hop,
    transactionCount: w.transactionCount,
    totalVolume: w.totalVolume,
    x: 0,
    y: 0, // will be laid out by graph
  }));

    // Layout inspired by ReconVault Cyber Command (Image 2):
  // 1. Core Cluster Matrix: 8-12 nodes arranged in a central matrix at (X: 470-550, Y: 200-320)
  // 2. Radiating Fan-Out Arcs: Remaining nodes placed along wide sweeping arcs radiating to the left, bottom-left, top-left (angles 110 to 280 deg)
  const coreMatrixNodes = Math.min(10, Math.floor(graphNodes.length * 0.42));
  const coreCols = 3;
  const coreStartX = 470;
  const coreStartY = 210;
  const coreSpacingX = 44;
  const coreSpacingY = 40;

  graphNodes.forEach((n, i) => {
    if (i === 0) {
      n.x = coreStartX;
      n.y = coreStartY;
      return;
    }
    if (i < coreMatrixNodes) {
      const col = i % coreCols;
      const row = Math.floor(i / coreCols);
      n.x = coreStartX + col * coreSpacingX;
      n.y = coreStartY + row * coreSpacingY;
    } else {
      const outerIndex = i - coreMatrixNodes;
      const totalOuter = graphNodes.length - coreMatrixNodes;
      const angle = (Math.PI * 0.65) + ((outerIndex / Math.max(1, totalOuter - 1)) * Math.PI * 0.95);
      const tier = outerIndex % 3;
      const radius = 175 + tier * 85 + (n.hop * 35);
      n.x = Math.round(510 + Math.cos(angle) * radius);
      n.y = Math.round(270 + Math.sin(angle) * radius);
    }
  });

  // Graph Edges: dense core cross-links plus curved fan-out arcs to perimeter nodes
  const graphEdges: GraphEdge[] = [];
  for (let i = 0; i < coreMatrixNodes - 1; i++) {
    const nextIdx = i + 1;
    const dir: TransactionDirection = rng() > 0.5 ? "OUTGOING" : "INCOMING";
    graphEdges.push({
      source: dir === "OUTGOING" ? graphNodes[i].id : graphNodes[nextIdx].id,
      target: dir === "OUTGOING" ? graphNodes[nextIdx].id : graphNodes[i].id,
      amount: rangeFloat(rng, 1, totalReceived * 0.05),
      asset,
      transactionCount: rangeInt(rng, 5, 45),
      direction: dir,
    });
    if (i + coreCols < coreMatrixNodes) {
      const vDir: TransactionDirection = rng() > 0.5 ? "OUTGOING" : "INCOMING";
      graphEdges.push({
        source: vDir === "OUTGOING" ? graphNodes[i].id : graphNodes[i + coreCols].id,
        target: vDir === "OUTGOING" ? graphNodes[i + coreCols].id : graphNodes[i].id,
        amount: rangeFloat(rng, 0.5, totalReceived * 0.04),
        asset,
        transactionCount: rangeInt(rng, 2, 20),
        direction: vDir,
      });
    }
  }
  for (let i = coreMatrixNodes; i < graphNodes.length; i++) {
    const w = graphNodes[i];
    const coreParent = graphNodes[rangeInt(rng, 0, coreMatrixNodes - 1)];
    const dir: TransactionDirection = rng() > 0.5 ? "OUTGOING" : "INCOMING";
    graphEdges.push({
      source: dir === "OUTGOING" ? coreParent.id : w.id,
      target: dir === "OUTGOING" ? w.id : coreParent.id,
      amount: rangeFloat(rng, 0.2, totalReceived * 0.06),
      asset,
      transactionCount: rangeInt(rng, 1, 15),
      direction: dir,
    });
  }

  // Cluster
  const cluster: ClusterAnalysis = {
    clusterId,
    connectedWallets: walletCount + 1,
    confidence: rangeInt(rng, 75, 96),
    maxHops: config.depth,
    evidence: pickN(rng, CLUSTER_EVIDENCE_POOL, rangeInt(rng, 3, 5)),
  };

  // VASP
  const vasp: VASPAttribution = {
    candidate: vaspName,
    classification: isKnownVasp
      ? rng() > 0.5
        ? "DIRECT"
        : "INFERRED"
      : "POSSIBLE",
    confidence: rangeFloat(rng, 0.65, 0.97),
    evidence: pickN(rng, VASP_EVIDENCE_POOL, rangeInt(rng, 3, 5)),
  };

  // Typologies
  const numTypologies =
    demoIdx === 0
      ? 3
      : demoIdx === 1
        ? 2
        : demoIdx === 2
          ? 4
          : rangeInt(rng, 2, 5);
  const selectedTypologies = pickN(rng, TYPOLOGY_POOL, numTypologies);
  const typologies: TypologyDetection[] = selectedTypologies.map((t) => ({
    name: t.name,
    severity: getRiskLevel(rangeInt(rng, baseRisk - 20, baseRisk + 5)),
    confidence: rangeInt(rng, 70, 96),
    evidence: t.evidence,
  }));

  // Evidence sources
  const evidenceSources: EvidenceSource[] = [
    {
      source: "Transaction Analysis",
      contribution: getRiskLevel(rangeInt(rng, 70, 98)),
      confidence: rangeInt(rng, 85, 98),
    },
    {
      source: "Graph Proximity",
      contribution: getRiskLevel(rangeInt(rng, 60, 95)),
      confidence: rangeInt(rng, 78, 95),
    },
    {
      source: "Wallet Clustering",
      contribution: getRiskLevel(rangeInt(rng, 65, 95)),
      confidence: rangeInt(rng, 80, 96),
    },
    {
      source: "Entity Intelligence",
      contribution: getRiskLevel(rangeInt(rng, 50, 85)),
      confidence: rangeInt(rng, 68, 88),
    },
    {
      source: "Behavioural Analysis",
      contribution: getRiskLevel(rangeInt(rng, 60, 90)),
      confidence: rangeInt(rng, 75, 92),
    },
    {
      source: "Risk Indicators",
      contribution: getRiskLevel(rangeInt(rng, 70, 98)),
      confidence: rangeInt(rng, 82, 97),
    },
  ];

  // Final confidence = weighted average
  const finalConfidence = Math.round(
    evidenceSources[0].confidence * 0.22 +
      evidenceSources[1].confidence * 0.18 +
      evidenceSources[2].confidence * 0.2 +
      evidenceSources[3].confidence * 0.15 +
      evidenceSources[4].confidence * 0.15 +
      evidenceSources[5].confidence * 0.1,
  );

  // Timeline
  const timeline: TimelineEvent[] = [];
  for (let y = firstYear; y <= 2026; y++) {
    const titles = [
      `Wallet first observed on ${chain}`,
      "Initial transaction activity recorded",
      "Transaction volume increased significantly",
      "Cluster formation detected via graph analysis",
      "VASP interaction observed",
      "Suspicious behaviour pattern detected",
      "Cross-exchange activity identified",
      "Risk threshold exceeded",
    ];
    timeline.push({
      year: y,
      title: titles[Math.min(y - firstYear, titles.length - 1)],
      description: pick(rng, [
        "Activity detected through automated blockchain monitoring.",
        "Pattern identified by multi-source intelligence correlation.",
        "Event flagged by risk scoring engine.",
        "Cluster analysis triggered by transaction graph proximity.",
      ]),
    });
  }

  // Recommendations
  const recPool: Recommendation[] = [
    {
      priority: "HIGH",
      title: "Preserve transaction evidence",
      description:
        "Secure blockchain transaction records and associated metadata for evidentiary chain.",
    },
    {
      priority: "HIGH",
      title: "Prepare information disclosure request",
      description:
        "Draft VASP information request through SAHYOG portal for identified exchange.",
    },
    {
      priority: "RECOMMENDED",
      title: "Investigate linked wallet cluster",
      description: `Expand investigation to ${walletCount} connected wallets in cluster ${clusterId}.`,
    },
    {
      priority: "RECOMMENDED",
      title: "Review VASP exposure",
      description: `Analyze ${vaspName} attribution evidence and cross-reference with known intelligence.`,
    },
    {
      priority: "RECOMMENDED",
      title: "Monitor ongoing transactions",
      description:
        "Set up real-time monitoring for target wallet and immediate counterparties.",
    },
    {
      priority: "OPTIONAL",
      title: "Extend tracing depth",
      description: `Current depth is ${config.depth} hops. Consider extending to ${config.depth + 1} for broader exposure mapping.`,
    },
    {
      priority: "OPTIONAL",
      title: "Cross-chain analysis",
      description:
        "Check for bridge transactions that may indicate cross-chain fund movement.",
    },
  ];
  const recommendations =
    baseRisk >= 80
      ? recPool.slice(0, 6)
      : baseRisk >= 50
        ? recPool
            .filter((r) => r.priority !== "HIGH")
            .concat(recPool.filter((r) => r.priority === "HIGH").slice(0, 1))
        : recPool.filter((r) => r.priority !== "HIGH").slice(0, 4);

  return {
    investigationId,
    config: { ...config, blockchain: chain },
    status: "COMPLETED",
    analysisDuration: rangeFloat(rng, 14.2, 22.8, 1),
    completedAt: new Date().toISOString(),
    wallet,
    risk,
    trackedWallets,
    transactions,
    graphNodes,
    graphEdges,
    cluster,
    vasp,
    typologies,
    evidenceSources,
    timeline,
    recommendations,
    finalConfidence,
  };
}
