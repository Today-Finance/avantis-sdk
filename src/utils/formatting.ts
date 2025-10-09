import Decimal from 'decimal.js';
import { formatUnits, parseUnits, formatEther, parseEther, isAddress, getAddress } from 'viem';

/**
 * Formats a Decimal value to a string with specified decimal places
 */
export function formatDecimal(value: Decimal, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Formats a price value with appropriate decimal places
 */
export function formatPrice(price: Decimal | number | string, decimals: number = 2): string {
  const priceDecimal = new Decimal(price);

  // For very small values, use more decimal places
  if (priceDecimal.lt(0.01) && priceDecimal.gt(0)) {
    return priceDecimal.toFixed(6);
  }

  return priceDecimal.toFixed(decimals);
}

/**
 * Formats a percentage value
 */
export function formatPercentage(value: Decimal | number, decimals: number = 2): string {
  const percentage = new Decimal(value).mul(100);
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Formats a leverage value
 */
export function formatLeverage(leverage: number): string {
  return `${leverage}x`;
}

/**
 * Formats USDC amount (6 decimals)
 */
export function formatUSDC(amount: Decimal | bigint | string): string {
  if (typeof amount === 'bigint') {
    return formatUnits(amount, 6);
  }
  const amountDecimal = new Decimal(amount.toString());
  return amountDecimal.div(1e6).toFixed(2);
}

/**
 * Converts USDC amount to raw units (6 decimals)
 */
export function toUSDCUnits(amount: Decimal | number | string): bigint {
  const amountDecimal = new Decimal(amount);
  const units = amountDecimal.mul(1e6).toFixed(0);
  return BigInt(units);
}

/**
 * Formats ETH amount (18 decimals)
 */
export function formatETH(amount: bigint | string): string {
  if (typeof amount === 'string') {
    amount = BigInt(amount);
  }
  return formatEther(amount);
}

/**
 * Converts ETH amount to Wei
 */
export function toWei(amount: Decimal | number | string): bigint {
  const amountString = new Decimal(amount).toFixed();
  return parseEther(amountString);
}

/**
 * Truncates an Ethereum address for display
 */
export function truncateAddress(address: string, start: number = 6, end: number = 4): string {
  if (!isAddress(address)) {
    return address;
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Formats a transaction hash for display
 */
export function truncateHash(hash: string, length: number = 10): string {
  if (hash.length <= length * 2) {
    return hash;
  }
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

/**
 * Formats a date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Formats a timestamp to readable date
 */
export function formatTimestamp(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : timestamp;
  return date.toLocaleString();
}

/**
 * Formats PnL value with color indicators
 */
export function formatPnL(pnl: Decimal | number): { value: string; isProfit: boolean } {
  const pnlDecimal = new Decimal(pnl);
  const isProfit = pnlDecimal.gte(0);
  const prefix = isProfit ? '+' : '';

  return {
    value: `${prefix}${pnlDecimal.toFixed(2)}`,
    isProfit
  };
}

/**
 * Formats trading pair
 */
export function formatTradingPair(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/**
 * Parses trading pair string
 */
export function parseTradingPair(pair: string): { base: string; quote: string } {
  const [base, quote] = pair.split('/');
  if (!base || !quote) {
    throw new Error(`Invalid trading pair format: ${pair}`);
  }
  return { base: base.trim(), quote: quote.trim() };
}

/**
 * Formats large numbers with abbreviations (K, M, B)
 */
export function formatCompactNumber(value: Decimal | number): string {
  const num = new Decimal(value);

  if (num.gte(1e9)) {
    return `${num.div(1e9).toFixed(2)}B`;
  } else if (num.gte(1e6)) {
    return `${num.div(1e6).toFixed(2)}M`;
  } else if (num.gte(1e3)) {
    return `${num.div(1e3).toFixed(2)}K`;
  }

  return num.toFixed(2);
}

/**
 * Calculates and formats margin level percentage
 */
export function formatMarginLevel(equity: Decimal, marginUsed: Decimal): string {
  if (marginUsed.eq(0)) {
    return '∞';
  }

  const marginLevel = equity.div(marginUsed).mul(100);
  return `${marginLevel.toFixed(2)}%`;
}

/**
 * Converts basis points to percentage
 */
export function bpsToPercentage(bps: number): number {
  return bps / 100;
}

/**
 * Converts percentage to basis points
 */
export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 100);
}
