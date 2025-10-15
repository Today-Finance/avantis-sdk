import type { NetworkConfig } from "../types";

export const NETWORKS: Record<"base" | "base-sepolia", NetworkConfig> = {
  base: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    contracts: {
      trading: "0x44914408af82bC9983bbb330e3578E1105e11d4e", // Trading contract
      tradingStorage: "0x8a311D7048c35985aa31C131B9A13e03a5f7422d", // TradingStorage contract
      tradingCallbacks: "0x0000000000000000000000000000000000000000", // TODO: Get TradingCallbacks address
      pairInfos: "0x81F22d0Cc22977c91bEfE648C9fddff1f2bd977e", // PairInfos contract
      pairStorage: "0x5db3772136e5557EFE028Db05EE95C84D76faEC4", // PairStorage contract
      priceAggregator: "0x64e2625621970F8cfA17B294670d61CB883dA511", // PriceAggregator contract
      vaultManager: "0x0000000000000000000000000000000000000000", // TODO: Get VaultManager address
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC (Native)
      priceFeed: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a", // Pyth Network on Base
      vault: "0x0000000000000000000000000000000000000000", // TODO: Get USDC Vault address
      router: "0x0000000000000000000000000000000000000000", // TODO: Get Trading Router address
      avnt: "0x696F9436B67233384889472Cd7cD58A6fB5DF4f1", // AVNT Token
      multicall: "0xb7125506Ff25211c4C51DFD8DdED0DedED0BEE6Fa8Cbf7", // Multicall contract
      referral: "0x1A110bBA13A1f16cCa4b79758BD39290f29De82D", // Referral contract
    },
    websocketUrl:
      process.env.BASE_WS_URL || process.env.ALCHEMY_API_KEY
        ? `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "wss://mainnet.base.org", // Public WebSocket endpoint as fallback
  },
  "base-sepolia": {
    chainId: 84531,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    contracts: {
      trading: "0x0000000000000000000000000000000000000000", // TODO: Get testnet Trading contract
      tradingStorage: "0x0000000000000000000000000000000000000000", // TODO: Get testnet TradingStorage
      tradingCallbacks: "0x0000000000000000000000000000000000000000", // TODO: Get testnet TradingCallbacks
      pairInfos: "0x0000000000000000000000000000000000000000", // TODO: Get testnet PairInfos
      pairStorage: "0x0000000000000000000000000000000000000000", // TODO: Get testnet PairStorage
      priceAggregator: "0x0000000000000000000000000000000000000000", // TODO: Get testnet PriceAggregator
      vaultManager: "0x0000000000000000000000000000000000000000", // TODO: Get testnet VaultManager
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
      priceFeed: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Pyth Network on Base Sepolia
      vault: "0x0000000000000000000000000000000000000000", // TODO: Get testnet Vault address
      router: "0x0000000000000000000000000000000000000000", // TODO: Get testnet Router address
    },
    websocketUrl:
      process.env.BASE_SEPOLIA_WS_URL || process.env.ALCHEMY_API_KEY
        ? `wss://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "wss://sepolia.base.org", // Public WebSocket endpoint as fallback
  },
};

export const DEFAULT_NETWORK = "base";

// Trading pairs configuration (matches on-chain pair indices)
export const TRADING_PAIRS = {
  // Crypto pairs (indices 0-24)
  "BTC/USD": {
    feedId: "btc-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 8,
    category: "crypto" as const,
  },
  "ETH/USD": {
    feedId: "eth-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 8,
    category: "crypto" as const,
  },
  "LINK/USD": {
    feedId: "link-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "MATIC/USD": {
    feedId: "matic-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "DOGE/USD": {
    feedId: "doge-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "SOL/USD": {
    feedId: "sol-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ADA/USD": {
    feedId: "ada-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "AVAX/USD": {
    feedId: "avax-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ATOM/USD": {
    feedId: "atom-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "DOT/USD": {
    feedId: "dot-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "FTM/USD": {
    feedId: "ftm-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "NEAR/USD": {
    feedId: "near-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ALGO/USD": {
    feedId: "algo-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "XRP/USD": {
    feedId: "xrp-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "LTC/USD": {
    feedId: "ltc-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "BCH/USD": {
    feedId: "bch-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ICP/USD": {
    feedId: "icp-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ETC/USD": {
    feedId: "etc-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "XLM/USD": {
    feedId: "xlm-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "FIL/USD": {
    feedId: "fil-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "UNI/USD": {
    feedId: "uni-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "APE/USD": {
    feedId: "ape-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "SHIB/USD": {
    feedId: "shib-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "ARB/USD": {
    feedId: "arb-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },
  "OP/USD": {
    feedId: "op-usd",
    minSize: 10,
    maxSize: 500000,
    maxLeverage: 50,
    decimals: 8,
    category: "crypto" as const,
  },

  // Forex pairs (indices 25-34)
  "EUR/USD": {
    feedId: "eur-usd",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "GBP/USD": {
    feedId: "gbp-usd",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "USD/JPY": {
    feedId: "usd-jpy",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 3,
    category: "forex" as const,
  },
  "USD/CHF": {
    feedId: "usd-chf",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "AUD/USD": {
    feedId: "aud-usd",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "USD/CAD": {
    feedId: "usd-cad",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "NZD/USD": {
    feedId: "nzd-usd",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "EUR/GBP": {
    feedId: "eur-gbp",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 5,
    category: "forex" as const,
  },
  "EUR/JPY": {
    feedId: "eur-jpy",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 3,
    category: "forex" as const,
  },
  "GBP/JPY": {
    feedId: "gbp-jpy",
    minSize: 100,
    maxSize: 10000000,
    maxLeverage: 500,
    decimals: 3,
    category: "forex" as const,
  },

  // Commodities (indices 35-38)
  "XAU/USD": {
    feedId: "xau-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 50,
    decimals: 2,
    category: "commodity" as const,
  },
  "XAG/USD": {
    feedId: "xag-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 50,
    decimals: 3,
    category: "commodity" as const,
  },
  "WTI/USD": {
    feedId: "wti-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 50,
    decimals: 2,
    category: "commodity" as const,
  },
  "BRENT/USD": {
    feedId: "brent-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 50,
    decimals: 2,
    category: "commodity" as const,
  },

  // Indices (indices 39-41)
  "SPX500/USD": {
    feedId: "spx500-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 2,
    category: "index" as const,
  },
  "NAS100/USD": {
    feedId: "nas100-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 2,
    category: "index" as const,
  },
  "US30/USD": {
    feedId: "us30-usd",
    minSize: 10,
    maxSize: 1000000,
    maxLeverage: 100,
    decimals: 2,
    category: "index" as const,
  },
};

// Fee configuration (in basis points)
export const FEES = {
  openPositionFee: 10, // 0.1%
  closePositionFee: 10, // 0.1%
  borrowFeePerHour: 1, // 0.01% per hour
  fundingFeeMax: 100, // 1% max
  liquidationFee: 50, // 0.5%
};

// Default configuration values
export const DEFAULTS = {
  slippage: 0.5, // 0.5%
  gasLimit: 500000n,
  confirmations: 1,
  timeout: 180000, // 120 seconds (2 minutes)
  maxRetries: 3,
};
