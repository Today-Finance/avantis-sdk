/**
 * Contract ABIs and interfaces
 */

// Import all ABIs
import TradingABI from "./abis/Trading.json";
import TradingStorageABI from "./abis/TradingStorage.json";
import TradingCallbacksABI from "./abis/TradingCallbacks.json";
import PairInfosABI from "./abis/PairInfos.json";
import PairStorageABI from "./abis/PairStorage.json";
import PriceAggregatorABI from "./abis/PriceAggregator.json";
import VaultManagerABI from "./abis/VaultManager.json";
import USDCABI from "./abis/USDC.json";
import AVNTABI from "./abis/AVNT.json";
import Multicall3ABI from "./abis/Multicall3.json";
import MulticallABI from "./abis/Multicall.json";

// Export ABIs (handle both artifact format and raw ABI format)
export const ABIS = {
  Trading: (TradingABI as any).abi || TradingABI,
  TradingStorage: (TradingStorageABI as any).abi || TradingStorageABI,
  TradingCallbacks: (TradingCallbacksABI as any).abi || TradingCallbacksABI,
  PairInfos: (PairInfosABI as any).abi || PairInfosABI,
  PairStorage: (PairStorageABI as any).abi || PairStorageABI,
  PriceAggregator: (PriceAggregatorABI as any).abi || PriceAggregatorABI,
  VaultManager: (VaultManagerABI as any).abi || VaultManagerABI,
  USDC: (USDCABI as any).abi || USDCABI,
  AVNT: (AVNTABI as any).abi || AVNTABI,
  Multicall3: (Multicall3ABI as any).abi || Multicall3ABI,
  Multicall: (MulticallABI as any).abi || MulticallABI,
};

// Export individual ABIs for convenience
export const TradingContractABI = (TradingABI as any).abi || TradingABI;
export const TradingStorageContractABI =
  (TradingStorageABI as any).abi || TradingStorageABI;
export const TradingCallbacksContractABI =
  (TradingCallbacksABI as any).abi || TradingCallbacksABI;
export const PairInfosContractABI = (PairInfosABI as any).abi || PairInfosABI;
export const PairStorageContractABI =
  (PairStorageABI as any).abi || PairStorageABI;
export const PriceAggregatorContractABI =
  (PriceAggregatorABI as any).abi || PriceAggregatorABI;
export const VaultManagerContractABI =
  (VaultManagerABI as any).abi || VaultManagerABI;
export const USDCContractABI = (USDCABI as any).abi || USDCABI;
export const AVNTContractABI = (AVNTABI as any).abi || AVNTABI;
export const Multicall3ContractABI =
  (Multicall3ABI as any).abi || Multicall3ABI;
export const MulticallContractABI = (MulticallABI as any).abi || MulticallABI;

// Contract names for reference
export const CONTRACT_NAMES = {
  TRADING: "Trading",
  TRADING_STORAGE: "TradingStorage",
  TRADING_CALLBACKS: "TradingCallbacks",
  PAIR_INFOS: "PairInfos",
  PAIR_STORAGE: "PairStorage",
  PRICE_AGGREGATOR: "PriceAggregator",
  VAULT_MANAGER: "VaultManager",
  USDC: "USDC",
  AVNT: "AVNT",
} as const;

export type ContractName = keyof typeof ABIS;
