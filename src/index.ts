// Main SDK export
export { AvantisSDK } from './AvantisSDK';

// Individual client exports
export { TraderClient } from './clients/TraderClient';
export { FeedClient } from './clients/FeedClient';
export { StorageClient } from './clients/StorageClient';
export { PriceClient } from './clients/PriceClient';

// Fee management exports
export { FeeManager } from './fees/FeeManager';
export { MulticallBundler } from './fees/MulticallBundler';
export * from './fees/constants';

// Provider exports
export { BlockchainProvider } from './providers/BlockchainProvider';
export { WebSocketProvider } from './providers/WebSocketProvider';

// Type exports
export * from './types';

// Utility exports
export * from './utils';

// Export pairs utilities
export {
  PAIR_INDICES,
  PAIR_NAMES,
  getPairIndex,
  getPairName,
  isPairValid,
  getAllPairs,
  getPairsByCategory,
  getPairConfig
} from './utils/pairs';

// Constants exports
export { NETWORKS, TRADING_PAIRS, FEES, DEFAULTS } from './constants/networks';

// Contract ABIs and utilities
export * from './contracts';

// Version
export const VERSION = '1.0.0';