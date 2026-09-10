/* --- CASHNET Investigation Store (localStorage) --- */
import type {
  InvestigationResult,
  InvestigationHistoryEntry,
  InvestigationConfig,
} from "@/types/investigation";

const KEYS = {
  current: "cashnet_current_investigation",
  history: "cashnet_investigation_history",
  pendingConfig: "cashnet_pending_config",
} as const;

const MAX_HISTORY = 20;

function safeGet<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function saveInvestigation(result: InvestigationResult): void {
  safeSet(KEYS.current, result);
  const history = getHistory();
  const entry: InvestigationHistoryEntry = {
    investigationId: result.investigationId,
    address: result.wallet.address,
    blockchain: result.wallet.blockchain,
    riskLevel: result.risk.level,
    riskScore: result.risk.overallScore,
    completedAt: result.completedAt,
  };
  const filtered = history.filter(
    (h) => h.investigationId !== entry.investigationId,
  );
  filtered.unshift(entry);
  safeSet(KEYS.history, filtered.slice(0, MAX_HISTORY));
}

export function getCurrentInvestigation(): InvestigationResult | null {
  return safeGet<InvestigationResult>(KEYS.current);
}

export function getHistory(): InvestigationHistoryEntry[] {
  return safeGet<InvestigationHistoryEntry[]>(KEYS.history) || [];
}

export function clearCurrentInvestigation(): void {
  try {
    localStorage.removeItem(KEYS.current);
  } catch {
    /* ignore */
  }
}

export function savePendingConfig(config: InvestigationConfig): void {
  safeSet(KEYS.pendingConfig, config);
}

export function getPendingConfig(): InvestigationConfig | null {
  return safeGet<InvestigationConfig>(KEYS.pendingConfig);
}

export function clearPendingConfig(): void {
  try {
    localStorage.removeItem(KEYS.pendingConfig);
  } catch {
    /* ignore */
  }
}
