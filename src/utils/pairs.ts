import Decimal from 'decimal.js';

// Pair index mapping for Avantis protocol
// These indices correspond to the on-chain pair IDs
export const PAIR_INDICES: Record<string, number> = {
  // Crypto pairs
  'BTC/USD': 0,
  'ETH/USD': 1,
  'LINK/USD': 2,
  'MATIC/USD': 3,
  'DOGE/USD': 4,
  'SOL/USD': 5,
  'ADA/USD': 6,
  'AVAX/USD': 7,
  'ATOM/USD': 8,
  'DOT/USD': 9,
  'FTM/USD': 10,
  'NEAR/USD': 11,
  'ALGO/USD': 12,
  'XRP/USD': 13,
  'LTC/USD': 14,
  'BCH/USD': 15,
  'ICP/USD': 16,
  'ETC/USD': 17,
  'XLM/USD': 18,
  'FIL/USD': 19,
  'UNI/USD': 20,
  'APE/USD': 21,
  'SHIB/USD': 22,
  'ARB/USD': 23,
  'OP/USD': 24,
  
  // Forex pairs
  'EUR/USD': 25,
  'GBP/USD': 26,
  'USD/JPY': 27,
  'USD/CHF': 28,
  'AUD/USD': 29,
  'USD/CAD': 30,
  'NZD/USD': 31,
  'EUR/GBP': 32,
  'EUR/JPY': 33,
  'GBP/JPY': 34,
  
  // Commodities
  'XAU/USD': 35,  // Gold
  'XAG/USD': 36,  // Silver
  'WTI/USD': 37,  // Oil
  'BRENT/USD': 38, // Brent Oil
  
  // Indices
  'SPX500/USD': 39,  // S&P 500
  'NAS100/USD': 40,  // Nasdaq 100
  'US30/USD': 41,    // Dow Jones
};

// Reverse mapping for getting pair name from index
export const PAIR_NAMES: Record<number, string> = Object.entries(PAIR_INDICES).reduce(
  (acc, [name, index]) => {
    acc[index] = name;
    return acc;
  },
  {} as Record<number, string>
);

/**
 * Gets the pair index for a given pair name
 */
export function getPairIndex(pairName: string): number {
  const index = PAIR_INDICES[pairName.toUpperCase()];
  if (index === undefined) {
    throw new Error(`Unknown pair: ${pairName}`);
  }
  return index;
}

/**
 * Gets the pair name for a given index
 */
export function getPairName(index: number): string {
  const name = PAIR_NAMES[index];
  if (!name) {
    throw new Error(`Unknown pair index: ${index}`);
  }
  return name;
}

/**
 * Validates if a pair exists
 */
export function isPairValid(pairName: string): boolean {
  return PAIR_INDICES[pairName.toUpperCase()] !== undefined;
}

/**
 * Gets all available pairs
 */
export function getAllPairs(): string[] {
  return Object.keys(PAIR_INDICES);
}

/**
 * Gets pairs by category
 */
export function getPairsByCategory(category: 'crypto' | 'forex' | 'commodity' | 'index'): string[] {
  const categoryRanges = {
    crypto: [0, 24],
    forex: [25, 34],
    commodity: [35, 38],
    index: [39, 41]
  };
  
  const [start, end] = categoryRanges[category];
  const pairs: string[] = [];
  
  for (let i = start; i <= end; i++) {
    const pairName = PAIR_NAMES[i];
    if (pairName) {
      pairs.push(pairName);
    }
  }
  
  return pairs;
}

/**
 * Pair configuration with trading parameters
 */
export interface PairConfig {
  index: number;
  name: string;
  category: 'crypto' | 'forex' | 'commodity' | 'index';
  feedId?: string;
  minSize: Decimal;
  maxSize: Decimal;
  maxLeverage: number;
  decimals: number;
}

/**
 * Gets the configuration for a specific pair
 */
export function getPairConfig(pairName: string): PairConfig | null {
  const index = PAIR_INDICES[pairName.toUpperCase()];
  if (index === undefined) return null;
  
  // Determine category based on index
  let category: 'crypto' | 'forex' | 'commodity' | 'index';
  if (index <= 24) category = 'crypto';
  else if (index <= 34) category = 'forex';
  else if (index <= 38) category = 'commodity';
  else category = 'index';
  
  // Default configurations (these should be fetched from chain in production)
  const configs: Record<string, Partial<PairConfig>> = {
    'crypto': {
      minSize: new Decimal(0.001),
      maxSize: new Decimal(1000000),
      maxLeverage: 100,
      decimals: 8
    },
    'forex': {
      minSize: new Decimal(100),
      maxSize: new Decimal(10000000),
      maxLeverage: 500,
      decimals: 5
    },
    'commodity': {
      minSize: new Decimal(0.1),
      maxSize: new Decimal(100000),
      maxLeverage: 50,
      decimals: 3
    },
    'index': {
      minSize: new Decimal(0.01),
      maxSize: new Decimal(100000),
      maxLeverage: 100,
      decimals: 2
    }
  };
  
  return {
    index,
    name: pairName.toUpperCase(),
    category,
    ...configs[category]
  } as PairConfig;
}