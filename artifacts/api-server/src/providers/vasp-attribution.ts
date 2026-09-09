/**
 * Evidence-based VASP attribution engine.
 *
 * Uses only legitimately available public labels and blockchain data.
 * No fake SAHYOG integration. No fabricated wallet ownership.
 */

export type AttributionType = "KNOWN_LABEL" | "PUBLIC_LABEL" | "UNLABELED_ADDRESS" | "INFERENCE" | "UNKNOWN";

export interface AttributionEvidence {
  type: string;
  description: string;
  confidence: number;
  source: string;
}

export interface WalletAttribution {
  address: string;
  chain: string;
  entity: string | null;
  attributionType: AttributionType;
  confidence: number;
  evidence: AttributionEvidence[];
  hopDistance: number;
  transactionFrequency: number;
  lastSeen: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  value: number;
  currency: string;
  timestamp: string;
  txHash: string;
}

export interface GraphNode {
  address: string;
  chain: string;
  label: string | null;
  attributionType: AttributionType;
  transactionCount: number;
  totalInflow: number;
  totalOutflow: number;
}

/**
 * Known public labels from legitimate blockchain explorers.
 * These are well-known, publicly documented exchange addresses.
 */
const KNOWN_LABELS: Record<string, { entity: string; confidence: number; source: string }> = {
  // Well-known exchange deposit addresses (publicly documented on blockchain explorers)
  "0x28c6c06298d514db089934071355e5743bf21d60": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0x9696f59e4d72e237be84ffd425dcad154bf96976": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0xf977814e90da44bfa03b6295a0616a897441acec": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0xab5c66752a9e8167967685f1450532fb96d5d24f": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0xdc24316b9ae028f1497c275eb9192a3ea0f67022": { entity: "Lido Finance", confidence: 0.9, source: "Blockchain Explorer Public Label" },
  "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
  "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503": { entity: "Binance", confidence: 0.95, source: "Blockchain Explorer Public Label" },
};

/**
 * Known mixer/tumbler addresses.
 */
const KNOWN_MIXERS: Record<string, { entity: string; confidence: number }> = {
  "0x722122df58353c2018b1dd998d6f4c6c8c4d5e4e": { entity: "Tornado Cash", confidence: 0.9 },
  "0xba214c1c1928a32bea1580688d344ae683c59814": { entity: "Tornado Cash", confidence: 0.9 },
};

/**
 * Attribute a wallet address using only public, legitimate data sources.
 */
export function attributeWallet(
  address: string,
  chain: string,
  transactionHistory?: GraphEdge[],
): WalletAttribution {
  const normalizedAddress = address.toLowerCase();
  const evidence: AttributionEvidence[] = [];
  let entity: string | null = null;
  let attributionType: AttributionType = "UNKNOWN";
  let confidence = 0;

  // Check known labels
  const knownLabel = KNOWN_LABELS[normalizedAddress];
  if (knownLabel) {
    entity = knownLabel.entity;
    attributionType = "KNOWN_LABEL";
    confidence = knownLabel.confidence;
    evidence.push({
      type: "KNOWN_ADDRESS",
      description: `Address is publicly labeled as ${knownLabel.entity} by blockchain explorers`,
      confidence: knownLabel.confidence,
      source: knownLabel.source,
    });
  }

  // Check known mixers
  const knownMixer = KNOWN_MIXERS[normalizedAddress];
  if (knownMixer && !entity) {
    entity = knownMixer.entity;
    attributionType = "PUBLIC_LABEL";
    confidence = knownMixer.confidence;
    evidence.push({
      type: "KNOWN_MIXER",
      description: `Address is associated with ${knownMixer.entity}`,
      confidence: knownMixer.confidence,
      source: "Public blockchain analysis",
    });
  }

  // Analyze transaction patterns if history available
  if (transactionHistory && transactionHistory.length > 0) {
    const outgoingToKnown: Record<string, { count: number; total: number }> = {};
    for (const tx of transactionHistory) {
      if (tx.from.toLowerCase() === normalizedAddress) {
        const targetLabel = KNOWN_LABELS[tx.to.toLowerCase()];
        if (targetLabel) {
          const key = targetLabel.entity;
          outgoingToKnown[key] = outgoingToKnown[key] || { count: 0, total: 0 };
          outgoingToKnown[key].count++;
          outgoingToKnown[key].total += tx.value;
        }
      }
    }

    // If most transactions go to a known exchange, it's likely a user of that exchange
    const sorted = Object.entries(outgoingToKnown).sort((a, b) => b[1].count - a[1].count);
    if (sorted.length > 0 && !entity) {
      const [topEntity, stats] = sorted[0]!;
      const ratio = stats.count / transactionHistory.length;
      if (ratio > 0.5) {
        entity = topEntity;
        attributionType = "INFERENCE";
        confidence = Math.min(0.7, ratio * 0.8);
        evidence.push({
          type: "TRANSACTION_PATTERN",
          description: `${Math.round(ratio * 100)}% of outgoing transactions go to known ${topEntity} addresses`,
          confidence,
          source: "Transaction pattern analysis",
        });
      }
    }
  }

  return {
    address,
    chain,
    entity,
    attributionType,
    confidence,
    evidence,
    hopDistance: 0,
    transactionFrequency: transactionHistory?.length || 0,
    lastSeen: transactionHistory?.length
      ? transactionHistory.reduce((latest, tx) =>
          tx.timestamp > latest ? tx.timestamp : latest, transactionHistory[0]!.timestamp)
      : null,
  };
}

/**
 * Multi-hop graph traversal from a seed address.
 */
export function traverseGraph(
  seedAddress: string,
  transactions: GraphEdge[],
  maxHops: number = 3,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const visited = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const queue: { address: string; hop: number }[] = [{ address: seedAddress, hop: 0 }];

  while (queue.length > 0) {
    const { address, hop } = queue.shift()!;
    const normalized = address.toLowerCase();

    if (visited.has(normalized) || hop > maxHops) continue;
    visited.add(normalized);

    // Find all transactions involving this address
    const relatedTxs = transactions.filter(
      (tx) => tx.from.toLowerCase() === normalized || tx.to.toLowerCase() === normalized,
    );

    // Compute node metrics
    const inflow = relatedTxs
      .filter((tx) => tx.to.toLowerCase() === normalized)
      .reduce((sum, tx) => sum + tx.value, 0);
    const outflow = relatedTxs
      .filter((tx) => tx.from.toLowerCase() === normalized)
      .reduce((sum, tx) => sum + tx.value, 0);

    // Attribute the wallet
    const attribution = attributeWallet(address, "unknown", relatedTxs);

    nodes.push({
      address,
      chain: "unknown",
      label: attribution.entity,
      attributionType: attribution.attributionType,
      transactionCount: relatedTxs.length,
      totalInflow: inflow,
      totalOutflow: outflow,
    });

    // Add edges and queue counterparty addresses
    for (const tx of relatedTxs) {
      edges.push(tx);
      const nextAddress = tx.from.toLowerCase() === normalized ? tx.to : tx.from;
      if (!visited.has(nextAddress.toLowerCase())) {
        queue.push({ address: nextAddress, hop: hop + 1 });
      }
    }
  }

  return { nodes, edges: [...new Map(edges.map((e) => [e.txHash, e])).values()] };
}
