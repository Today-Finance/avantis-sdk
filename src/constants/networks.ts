import type { NetworkConfig } from '../types';

export const NETWORKS: Record<'base' | 'base-sepolia', NetworkConfig> = {
  'base': {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      trading: '0x44914408af82bC9983bbb330e3578E1105e11d4e', // Trading contract
      tradingStorage: '0x8a311D7048c35985aa31C131B9A13e03a5f7422d', // TradingStorage contract
      tradingCallbacks: '0x0000000000000000000000000000000000000000', // TODO: Get TradingCallbacks address
      pairInfos: '0x81F22d0Cc22977c91bEfE648C9fddff1f2bd977e5', // PairInfos contract
      pairStorage: '0x5db3772136e5557EFF028Db05EE95C84D76faEC4', // PairStorage contract
      priceAggregator: '0x64e2625621970F8cfA17B294670d61CB883dA511', // PriceAggregator contract
      vaultManager: '0x0000000000000000000000000000000000000000', // TODO: Get VaultManager address
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC (Native)
      priceFeed: '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a', // Pyth Network on Base
      vault: '0x0000000000000000000000000000000000000000', // TODO: Get USDC Vault address
      router: '0x0000000000000000000000000000000000000000', // TODO: Get Trading Router address
      avnt: '0x696F9436B67233384889472Cd7cD58A6fB5DF4f1' // AVNT Token
    },
    websocketUrl: process.env.BASE_WS_URL || process.env.ALCHEMY_API_KEY
      ? `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : 'wss://mainnet.base.org' // Public WebSocket endpoint as fallback
  },
  'base-sepolia': {
    chainId: 84531,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      trading: '0x0000000000000000000000000000000000000000', // TODO: Get testnet Trading contract
      tradingStorage: '0x0000000000000000000000000000000000000000', // TODO: Get testnet TradingStorage
      tradingCallbacks: '0x0000000000000000000000000000000000000000', // TODO: Get testnet TradingCallbacks
      pairInfos: '0x0000000000000000000000000000000000000000', // TODO: Get testnet PairInfos
      pairStorage: '0x0000000000000000000000000000000000000000', // TODO: Get testnet PairStorage
      priceAggregator: '0x0000000000000000000000000000000000000000', // TODO: Get testnet PriceAggregator
      vaultManager: '0x0000000000000000000000000000000000000000', // TODO: Get testnet VaultManager
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
      priceFeed: '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729', // Pyth Network on Base Sepolia
      vault: '0x0000000000000000000000000000000000000000', // TODO: Get testnet Vault address
      router: '0x0000000000000000000000000000000000000000' // TODO: Get testnet Router address
    },
    websocketUrl: process.env.BASE_SEPOLIA_WS_URL || process.env.ALCHEMY_API_KEY
      ? `wss://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : 'wss://sepolia.base.org' // Public WebSocket endpoint as fallback
  }
};

export const DEFAULT_NETWORK = 'base';

// Trading pairs configuration
export const TRADING_PAIRS = {
  // Crypto pairs
  'BTC/USD': {
    feedId: 'btc-usd',
    minSize: 0.0001,
    maxSize: 100,
    maxLeverage: 100,
    decimals: 8,
    category: 'crypto' as const
  },
  'ETH/USD': {
    feedId: 'eth-usd',
    minSize: 0.001,
    maxSize: 1000,
    maxLeverage: 100,
    decimals: 8,
    category: 'crypto' as const
  },
  'SOL/USD': {
    feedId: 'sol-usd',
    minSize: 0.1,
    maxSize: 10000,
    maxLeverage: 50,
    decimals: 8,
    category: 'crypto' as const
  },
  
  // Forex pairs
  'EUR/USD': {
    feedId: 'eur-usd',
    minSize: 100,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 5,
    category: 'forex' as const
  },
  'GBP/USD': {
    feedId: 'gbp-usd',
    minSize: 100,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 5,
    category: 'forex' as const
  },
  'USD/JPY': {
    feedId: 'usd-jpy',
    minSize: 100,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 3,
    category: 'forex' as const
  },
  
  // Commodities
  'XAU/USD': {
    feedId: 'xau-usd',
    minSize: 0.1,
    maxSize: 1000,
    maxLeverage: 50,
    decimals: 2,
    category: 'commodity' as const
  },
  'XAG/USD': {
    feedId: 'xag-usd',
    minSize: 1,
    maxSize: 10000,
    maxLeverage: 50,
    decimals: 3,
    category: 'commodity' as const
  }
};

// Fee configuration (in basis points)
export const FEES = {
  openPositionFee: 10, // 0.1%
  closePositionFee: 10, // 0.1%
  borrowFeePerHour: 1, // 0.01% per hour
  fundingFeeMax: 100, // 1% max
  liquidationFee: 50 // 0.5%
};

// Default configuration values
export const DEFAULTS = {
  slippage: 0.5, // 0.5%
  gasLimit: 500000n,
  confirmations: 1,
  timeout: 30000, // 30 seconds
  maxRetries: 3
};