import type {
  PublicClient,
  WalletClient,
  Account,
  Transport,
  Chain,
  Hash,
  TransactionReceipt as ViemTransactionReceipt,
  TransactionRequest as ViemTransactionRequest,
  Log,
} from "viem";

export type ChainId = 8453 | 84531; // Base mainnet and testnet

export interface NetworkConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    trading: string;
    tradingStorage?: string;
    tradingCallbacks?: string;
    pairInfos?: string;
    pairStorage?: string;
    priceAggregator?: string;
    vaultManager?: string;
    usdc: string;
    priceFeed: string;
    vault: string;
    router: string;
    avnt?: string;
    multicall?: string;
    referral?: string;
  };
  websocketUrl?: string;
}

export interface SignerConfig {
  type: "privateKey" | "mnemonic" | "jsonRpc" | "injected" | "viemClient";
  privateKey?: string;
  mnemonic?: string;
  path?: string;
  provider?: any; // For injected providers (MetaMask, etc.)
  client?: WalletClient; // For viem WalletClient (like kernel client)
  gasless?: boolean; // Flag to enable gasless transactions (e.g., via ZeroDev paymaster)
}

export interface TransactionConfig {
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  value?: bigint;
}

export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  blockHash?: string;
  timestamp?: number;
  from: string;
  to: string;
  value: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: "success" | "failed" | "pending";
  logs?: any[];
}

export interface ContractCall {
  contract: string;
  method: string;
  args: any[];
  value?: bigint;
  gasLimit?: bigint;
}

export interface EventFilter {
  address?: string | string[];
  topics?: (string | string[] | null)[];
  fromBlock?: number | string;
  toBlock?: number | string;
}

export interface BlockchainEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

// viem types (re-exports for convenience)
export type ProviderType = PublicClient;
export type SignerType = WalletClient;
export type AccountType = Account;
export type TransportType = Transport;
export type ChainType = Chain;
export type TransactionRequestType = ViemTransactionRequest;
export type TransactionResponseType = Hash;
export type TransactionReceiptType = ViemTransactionReceipt;
export type LogType = Log;
