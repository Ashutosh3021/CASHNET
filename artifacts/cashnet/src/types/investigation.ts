/* --- CASHNET Crypto Investigation Types --- */

export type BlockchainNetwork =
  | "ETHEREUM"
  | "BITCOIN"
  | "TRON"
  | "BNB"
  | "POLYGON"
  | "SOLANA";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnalysisScope =
  | "TRANSACTION_ANALYSIS"
  | "FUND_FLOW"
  | "WALLET_CLUSTERING"
  | "RISK_ASSESSMENT"
  | "VASP_ATTRIBUTION"
  | "TRANSFER"
  | "CONTRACT"
  | "MIXER"
  | "BRIDGE";

export type NodeType =
  | "TARGET"
  | "LINKED_WALLET"
  | "INTERMEDIARY"
  | "CLUSTER_MEMBER"
  | "VASP"
  | "HIGH_RISK"
  | "UNKNOWN";

export type TransactionDirection = "INCOMING" | "OUTGOING";
export type TransactionStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface WalletProfile {
  address: string;
  blockchain: BlockchainNetwork;
  asset: string;
  walletType: string;
  firstActivity: string;
  lastActivity: string;
  transactionCount: number;
  totalReceived: number;
  totalSent: number;
  estimatedBalance: number;
  activePeriodDays: number;
  clusterId: string;
}

export interface TrackedWallet {
  address: string;
  relationship: string;
  risk: RiskLevel;
  riskScore: number;
  confidence: number;
  hop: number;
  transactionCount: number;
  totalVolume: number;
  nodeType: NodeType;
  profile: WalletProfile;
}

export interface TransactionRecord {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  direction: TransactionDirection;
  risk: RiskLevel;
  riskScore: number;
  blockNumber: number;
  gas: number;
  gasPrice: string;
  gasUsed: number;
  transactionFee: string;
  status: TransactionStatus;
  nonce: number;
  inputData: string;
  methodId: string;
  contractAddress: string | null;
  confirmations: number;
}

export interface GraphNode {
  id: string;
  label: string;
  nodeType: NodeType;
  risk: RiskLevel;
  riskScore: number;
  hop: number;
  transactionCount: number;
  totalVolume: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  asset: string;
  direction: TransactionDirection;
  risk?: RiskLevel;
  transactionCount: number;
}

export interface ClusterAnalysis {
  clusterId: string;
  clusterName?: string;
  walletCount?: number;
  totalVolume?: number;
  asset?: string;
  dominantTypology?: string;
  riskScore?: number;
  confidence?: number;
  firstSeen?: string;
  lastSeen?: string;
  behaviorTags?: string[];
  connectedWallets?: number;
  maxHops?: number;
  evidence?: string | string[];
}

export interface VASPAttribution {
  vaspName?: string;
  candidate?: string;
  category?: string;
  classification?: string;
  vaspCategory?: "EXCHANGE" | "PAYMENT_PROCESSOR" | "MIXER" | "GAMBLING" | "P2P" | "DEFI" | string;
  jurisdiction?: string;
  riskRating?: RiskLevel;
  confidence?: number;
  attributedAddresses?: string[];
  depositCount?: number;
  withdrawalCount?: number;
  evidence?: string | string[];
}

export interface TypologyDetection {
  id?: string;
  name: string;
  description?: string;
  severity: RiskLevel;
  confidence?: number;
  evidence?: string | string[];
  detectedAt?: string;
  affectedHops?: number[];
  involvedAddresses?: string[];
  totalValue?: number;
  asset?: string;
}

export interface EvidenceSource {
  source?: string;
  sourceName?: string;
  sourceType?: "ONCHAIN" | "INTELLIGENCE_DB" | "SANCTION_LIST" | "MEMPOOL" | "GRAPH_ANALYSIS" | string;
  contribution?: any;
  confidence: number;
  reliability?: number;
  lastUpdated?: string;
  recordsAnalyzed?: number;
}

export interface TimelineEvent {
  year?: number | string;
  timestamp?: string;
  title?: string;
  event?: string;
  category?: "TRANSFER" | "CONTRACT_INTERACTION" | "CLUSTER_JOIN" | "SUSPICIOUS_SPIKE" | string;
  severity?: RiskLevel;
  details?: string;
  type?: string;
  description?: string;
}

export interface Recommendation {
  action?: string;
  title?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | "CRITICAL" | "RECOMMENDED" | "OPTIONAL" | string;
  rationale?: string;
  description?: string;
}

export interface RiskIndicator {
  name: string;
  weight: number;
  description: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface RiskAssessment {
  overallScore: number;
  level: RiskLevel;
  confidence?: number;
  indicators?: RiskIndicator[];
  factors?: RiskFactor[];
  findings?: string[];
}

export interface InvestigationConfig {
  address: string;
  blockchain: BlockchainNetwork | "AUTO";
  depth: number;
  scopes: AnalysisScope[];
}

export interface InvestigationResult {
  investigationId: string;
  config: InvestigationConfig;
  status: "COMPLETED";
  analysisDuration: number;
  completedAt: string;
  wallet: WalletProfile;
  risk: RiskAssessment;
  trackedWallets: TrackedWallet[];
  transactions: TransactionRecord[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  cluster: ClusterAnalysis;
  vasp: VASPAttribution;
  typologies: TypologyDetection[];
  evidenceSources: EvidenceSource[];
  timeline: TimelineEvent[];
  recommendations: Recommendation[];
  finalConfidence: number;
}

export interface InvestigationHistoryEntry {
  investigationId: string;
  address: string;
  blockchain: BlockchainNetwork;
  riskLevel: RiskLevel;
  riskScore: number;
  completedAt: string;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL":
      return "#ef4444";
    case "HIGH":
      return "#f59e0b";
    case "MEDIUM":
      return "#3b82f6";
    case "LOW":
      return "#10b981";
    default:
      return "#6b7280";
  }
}
