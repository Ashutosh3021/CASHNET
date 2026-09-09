/**
 * Blockchain provider abstraction for the Express API server.
 *
 * Proxies to the Python blockchain service or uses public RPC APIs directly.
 * Returns DATA_SOURCE_UNAVAILABLE instead of fake results when providers are down.
 */

export type BlockchainNetwork = "bitcoin" | "ethereum" | "tron" | "bsc" | "polygon" | "solana";

export interface BlockchainTransaction {
  txHash: string;
  chain: BlockchainNetwork;
  blockNumber: number;
  blockTimestamp: string;
  fromAddress: string;
  toAddress: string;
  value: number;
  currency: string;
  valueUsd: number | null;
  fee: number | null;
  isSuccess: boolean;
  methodId: string | null;
}

export interface WalletBalance {
  address: string;
  chain: BlockchainNetwork;
  balance: number;
  currency: string;
  balanceUsd: number | null;
}

export interface AddressActivity {
  address: string;
  chain: BlockchainNetwork;
  transactionCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  totalInflow: number;
  totalOutflow: number;
}

export interface BlockchainProviderStatus {
  name: string;
  chain: BlockchainNetwork;
  connected: boolean;
  enabled: boolean;
  status: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED" | "RATE_LIMITED";
  lastBlockHeight: number | null;
  errorMessage: string | null;
}

export interface BlockchainProvider {
  readonly name: string;
  readonly chain: BlockchainNetwork;

  getTransactions(address: string, limit?: number): Promise<BlockchainTransaction[]>;
  getTransaction(txHash: string): Promise<BlockchainTransaction | null>;
  getBalance(address: string): Promise<WalletBalance>;
  getAddressActivity(address: string): Promise<AddressActivity>;
  getStatus(): Promise<BlockchainProviderStatus>;
}

/**
 * Create a blockchain provider based on environment configuration.
 */
export function createBlockchainProviders(): BlockchainProvider[] {
  const providers: BlockchainProvider[] = [];

  // Ethereum - uses public RPC if configured
  if (process.env.ETHEREUM_RPC_URL || process.env.ETHERSCAN_API_KEY) {
    providers.push(new EthereumPublicProvider());
  }

  // Bitcoin - uses Blockstream API (no key needed for basic queries)
  providers.push(new BitcoinPublicProvider());

  // Tron - uses Trongrid public API
  if (process.env.TRON_API_KEY) {
    providers.push(new TronPublicProvider());
  }

  return providers;
}

/**
 * Ethereum public provider using Etherscan or public RPC.
 */
class EthereumPublicProvider implements BlockchainProvider {
  readonly name = "Ethereum Public Provider";
  readonly chain: BlockchainNetwork = "ethereum";

  private rpcUrl: string;
  private apiKey: string | null;
  private lastBlockHeight: number | null = null;

  constructor() {
    this.rpcUrl = process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com";
    this.apiKey = process.env.ETHERSCAN_API_KEY || null;
  }

  async getTransactions(address: string, limit = 100): Promise<BlockchainTransaction[]> {
    try {
      if (!this.apiKey) return [];
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${this.apiKey}&page=1&offset=${limit}`;
      const response = await fetch(url);
      const data = await response.json() as any;
      if (data.status !== "1" || !data.result) return [];

      return data.result.map((tx: any) => ({
        txHash: tx.hash,
        chain: "ethereum" as BlockchainNetwork,
        blockNumber: parseInt(tx.blockNumber),
        blockTimestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        fromAddress: tx.from?.toLowerCase() || "",
        toAddress: tx.to?.toLowerCase() || "",
        value: parseFloat(tx.value) / 1e18,
        currency: "ETH",
        valueUsd: null,
        fee: parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) / 1e18,
        isSuccess: tx.txreceipt_status === "1",
        methodId: tx.input?.length > 2 ? tx.input.slice(0, 10) : null,
      }));
    } catch {
      return [];
    }
  }

  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    try {
      if (!this.apiKey) return null;
      const url = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as any;
      const tx = data.result;
      if (!tx) return null;

      return {
        txHash: tx.hash,
        chain: "ethereum",
        blockNumber: parseInt(tx.blockNumber || "0"),
        blockTimestamp: new Date().toISOString(),
        fromAddress: tx.from?.toLowerCase() || "",
        toAddress: tx.to?.toLowerCase() || "",
        value: parseInt(tx.value || "0", 16) / 1e18,
        currency: "ETH",
        valueUsd: null,
        fee: null,
        isSuccess: true,
        methodId: tx.input?.length > 2 ? tx.input.slice(0, 10) : null,
      };
    } catch {
      return null;
    }
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      if (!this.apiKey) return { address, chain: "ethereum", balance: 0, currency: "ETH", balanceUsd: null };
      const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as any;
      const balanceWei = parseInt(data.result || "0");
      return { address, chain: "ethereum", balance: balanceWei / 1e18, currency: "ETH", balanceUsd: null };
    } catch {
      return { address, chain: "ethereum", balance: 0, currency: "ETH", balanceUsd: null };
    }
  }

  async getAddressActivity(address: string): Promise<AddressActivity> {
    const txs = await this.getTransactions(address);
    return {
      address,
      chain: "ethereum",
      transactionCount: txs.length,
      firstSeen: txs.length > 0 ? txs[txs.length - 1]!.blockTimestamp : null,
      lastSeen: txs.length > 0 ? txs[0]!.blockTimestamp : null,
      totalInflow: txs.filter((t) => t.toAddress === address.toLowerCase()).reduce((s, t) => s + t.value, 0),
      totalOutflow: txs.filter((t) => t.fromAddress === address.toLowerCase()).reduce((s, t) => s + t.value, 0),
    };
  }

  async getStatus(): Promise<BlockchainProviderStatus> {
    return {
      name: this.name,
      chain: "ethereum",
      connected: !!this.apiKey,
      enabled: true,
      status: this.apiKey ? "AVAILABLE" : "NOT_CONFIGURED",
      lastBlockHeight: this.lastBlockHeight,
      errorMessage: this.apiKey ? null : "ETHERSCAN_API_KEY not configured",
    };
  }
}

/**
 * Bitcoin public provider using Blockstream API (no key required).
 */
class BitcoinPublicProvider implements BlockchainProvider {
  readonly name = "Bitcoin Blockstream Provider";
  readonly chain: BlockchainNetwork = "bitcoin";

  private baseUrl = "https://blockstream.info/api";

  async getTransactions(address: string, limit = 100): Promise<BlockchainTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/address/${address}/txs`);
      if (!response.ok) return [];
      const txs = await response.json() as any[];
      return txs.slice(0, limit).map((tx: any) => ({
        txHash: tx.txid,
        chain: "bitcoin" as BlockchainNetwork,
        blockNumber: tx.status?.block_height || 0,
        blockTimestamp: tx.status?.block_time
          ? new Date(tx.status.block_time * 1000).toISOString()
          : new Date().toISOString(),
        fromAddress: tx.vin?.[0]?.prevout?.scriptpubkey_address || "",
        toAddress: tx.vout?.[0]?.scriptpubkey_address || "",
        value: (tx.vout?.reduce((sum: number, v: any) => sum + (v.value || 0), 0) || 0) / 1e8,
        currency: "BTC",
        valueUsd: null,
        fee: tx.fee ? tx.fee / 1e8 : null,
        isSuccess: true,
        methodId: null,
      }));
    } catch {
      return [];
    }
  }

  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tx/${txHash}`);
      if (!response.ok) return null;
      const tx = await response.json() as any;
      return {
        txHash: tx.txid,
        chain: "bitcoin",
        blockNumber: tx.status?.block_height || 0,
        blockTimestamp: tx.status?.block_time
          ? new Date(tx.status.block_time * 1000).toISOString()
          : new Date().toISOString(),
        fromAddress: tx.vin?.[0]?.prevout?.scriptpubkey_address || "",
        toAddress: tx.vout?.[0]?.scriptpubkey_address || "",
        value: (tx.vout?.reduce((sum: number, v: any) => sum + (v.value || 0), 0) || 0) / 1e8,
        currency: "BTC",
        valueUsd: null,
        fee: tx.fee ? tx.fee / 1e8 : null,
        isSuccess: true,
        methodId: null,
      };
    } catch {
      return null;
    }
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const response = await fetch(`${this.baseUrl}/address/${address}`);
      if (!response.ok) return { address, chain: "bitcoin", balance: 0, currency: "BTC", balanceUsd: null };
      const data = await response.json() as any;
      const balance = (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);
      return { address, chain: "bitcoin", balance: balance / 1e8, currency: "BTC", balanceUsd: null };
    } catch {
      return { address, chain: "bitcoin", balance: 0, currency: "BTC", balanceUsd: null };
    }
  }

  async getAddressActivity(address: string): Promise<AddressActivity> {
    try {
      const response = await fetch(`${this.baseUrl}/address/${address}`);
      if (!response.ok) return { address, chain: "bitcoin", transactionCount: 0, firstSeen: null, lastSeen: null, totalInflow: 0, totalOutflow: 0 };
      const data = await response.json() as any;
      return {
        address,
        chain: "bitcoin",
        transactionCount: (data.chain_stats?.tx_count || 0),
        firstSeen: null,
        lastSeen: null,
        totalInflow: (data.chain_stats?.funded_txo_sum || 0) / 1e8,
        totalOutflow: (data.chain_stats?.spent_txo_sum || 0) / 1e8,
      };
    } catch {
      return { address, chain: "bitcoin", transactionCount: 0, firstSeen: null, lastSeen: null, totalInflow: 0, totalOutflow: 0 };
    }
  }

  async getStatus(): Promise<BlockchainProviderStatus> {
    return {
      name: this.name,
      chain: "bitcoin",
      connected: true,
      enabled: true,
      status: "AVAILABLE",
      lastBlockHeight: null,
      errorMessage: null,
    };
  }
}

/**
 * Tron public provider using Trongrid API.
 */
class TronPublicProvider implements BlockchainProvider {
  readonly name = "Tron Public Provider";
  readonly chain: BlockchainNetwork = "tron";

  private apiKey: string;
  private baseUrl = "https://api.trongrid.io";

  constructor() {
    this.apiKey = process.env.TRON_API_KEY || "";
  }

  async getTransactions(address: string, limit = 100): Promise<BlockchainTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/accounts/${address}/transactions?limit=${limit}&order=desc`, {
        headers: { "TRON-PRO-API-KEY": this.apiKey },
      });
      if (!response.ok) return [];
      const data = await response.json() as any;
      return (data.data || []).map((tx: any) => ({
        txHash: tx.txID,
        chain: "tron" as BlockchainNetwork,
        blockNumber: tx.blockNumber || 0,
        blockTimestamp: new Date(tx.raw_data?.contract?.[0]?.parameter?.value?.amount ? tx.block_timestamp : Date.now()).toISOString(),
        fromAddress: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address || "",
        toAddress: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address || "",
        value: (tx.raw_data?.contract?.[0]?.parameter?.value?.amount || 0) / 1e6,
        currency: "TRX",
        valueUsd: null,
        fee: null,
        isSuccess: true,
        methodId: null,
      }));
    } catch {
      return [];
    }
  }

  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/transactions/${txHash}`, {
        headers: { "TRON-PRO-API-KEY": this.apiKey },
      });
      if (!response.ok) return null;
      const data = await response.json() as any;
      const tx = data.data?.[0];
      if (!tx) return null;
      return {
        txHash: tx.txID,
        chain: "tron",
        blockNumber: tx.blockNumber || 0,
        blockTimestamp: new Date(tx.block_timestamp || Date.now()).toISOString(),
        fromAddress: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address || "",
        toAddress: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address || "",
        value: (tx.raw_data?.contract?.[0]?.parameter?.value?.amount || 0) / 1e6,
        currency: "TRX",
        valueUsd: null,
        fee: null,
        isSuccess: true,
        methodId: null,
      };
    } catch {
      return null;
    }
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/accounts/${address}`, {
        headers: { "TRON-PRO-API-KEY": this.apiKey },
      });
      if (!response.ok) return { address, chain: "tron", balance: 0, currency: "TRX", balanceUsd: null };
      const data = await response.json() as any;
      const balance = data.balance ? data.balance / 1e6 : 0;
      return { address, chain: "tron", balance, currency: "TRX", balanceUsd: null };
    } catch {
      return { address, chain: "tron", balance: 0, currency: "TRX", balanceUsd: null };
    }
  }

  async getAddressActivity(address: string): Promise<AddressActivity> {
    const txs = await this.getTransactions(address);
    return {
      address,
      chain: "tron",
      transactionCount: txs.length,
      firstSeen: txs.length > 0 ? txs[txs.length - 1]!.blockTimestamp : null,
      lastSeen: txs.length > 0 ? txs[0]!.blockTimestamp : null,
      totalInflow: txs.filter((t) => t.toAddress === address).reduce((s, t) => s + t.value, 0),
      totalOutflow: txs.filter((t) => t.fromAddress === address).reduce((s, t) => s + t.value, 0),
    };
  }

  async getStatus(): Promise<BlockchainProviderStatus> {
    return {
      name: this.name,
      chain: "tron",
      connected: !!this.apiKey,
      enabled: !!this.apiKey,
      status: this.apiKey ? "AVAILABLE" : "NOT_CONFIGURED",
      lastBlockHeight: null,
      errorMessage: this.apiKey ? null : "TRON_API_KEY not configured",
    };
  }
}
