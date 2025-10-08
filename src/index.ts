// Main SDK export
export { AvantisSDK } from './AvantisSDK';

// Individual client exports
export { TraderClient } from './clients/TraderClient';
export { FeedClient } from './clients/FeedClient';
export { StorageClient } from './clients/StorageClient';
export { PriceClient } from './clients/PriceClient';
export { PythClient } from './clients/PythClient';
export { SocketAPIClient } from './clients/SocketAPIClient';

// Fee management exports
export { FeeManager } from './fees/FeeManager';
export { MulticallBundler } from './fees/MulticallBundler';
export * from './fees/constants';

// Provider exports
export { BlockchainProvider } from './providers/BlockchainProvider';
export { WebSocketProvider } from './providers/WebSocketProvider';

// Type exports
export * from './types';
export * from './types/socket-api';

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
export { PYTH_PRICE_FEEDS, getPythFeedId, getPythFeedIds } from './constants/pythFeeds';

// Contract ABIs and utilities
export * from './contracts';

// Version
export const VERSION = '1.0.0';