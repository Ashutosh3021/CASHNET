export type ProviderSource = "SYNTHETIC" | "USER_PROVIDED" | "API" | "DATABASE" | "MODEL_INFERENCE";

export interface BlockchainProvider {
  getTransactions(address: string, chain: string): Promise<unknown>;
  getBalance(address: string, chain: string): Promise<unknown>;
  traceWallet(address: string, chain: string): Promise<unknown>;
}

export interface BankProvider {
  resolveAccount(accountId: string): Promise<unknown>;
  resolveBranch(ifsc: string): Promise<unknown>;
  prepareRequest(input: unknown): Promise<unknown>;
}

export interface VASPProvider {
  attributeWallet(address: string, chain: string): Promise<unknown>;
}

export interface EventBusProvider {
  publish(topic: string, event: unknown): Promise<void>;
}

export class MockEventBus implements EventBusProvider {
  async publish(_topic: string, _event: unknown): Promise<void> {}
}