/**
 * Platform Fee Management Types
 * 
 * These types enable platforms to collect fees on trades,
 * offer discounts, and share revenue with referrers.
 */

import type { Decimal } from 'decimal.js';

/**
 * Platform fee configuration for the SDK
 */
export interface PlatformFeeConfig {
  /** Platform wallet address to receive fees */
  platformWallet: string;
  
  /** Base fee percentage (e.g., 0.001 = 0.1%) */
  baseFeePercent: number;
  
  /** Percentage of platform fee that goes to referrer (0-100) */
  referralSplitPercent?: number;
  
  /** Whether platform fees are enabled */
  enabled: boolean;
}

/**
 * Fee parameters for a specific trade
 */
export interface PlatformFeeParams {
  /** Whether to collect platform fee on this trade */
  enabled: boolean;
  
  /** Discount percentage on platform fee (0-100) */
  discountPercent?: number;
  
  /** Referral address to receive fee split */
  referralAddress?: string;
}

/**
 * Calculated fee breakdown
 */
export interface FeeBreakdown {
  /** Base platform fee before discount */
  baseFee: Decimal;
  
  /** Discount amount */
  discount: Decimal;
  
  /** Final platform fee after discount */
  platformFee: Decimal;
  
  /** Amount going to referrer */
  referralFee: Decimal;
  
  /** Amount going to platform */
  platformReceives: Decimal;
  
  /** Total amount user pays in fees */
  totalFee: Decimal;
}

/**
 * Transaction call data for Multicall bundling
 */
export interface CallData {
  /** Target contract address */
  target: string;
  
  /** Whether to allow this call to fail */
  allowFailure: boolean;
  
  /** Encoded function call data */
  callData: string;
  
  /** ETH value to send (if any) */
  value?: bigint;
}

/**
 * Bundled transaction for Multicall3
 */
export interface BundledTransaction {
  /** Multicall3 contract address */
  to: string;
  
  /** Encoded multicall data */
  data: string;
  
  /** Total ETH value (if any) */
  value: bigint;
  
  /** Estimated gas limit */
  gasLimit?: bigint;
  
  /** Human-readable description of operations */
  description: string[];
}

/**
 * Result of a bundled transaction
 */
export interface BundledTransactionResult {
  /** Transaction hash */
  hash: string;
  
  /** Whether all calls succeeded */
  success: boolean;
  
  /** Individual call results */
  results: {
    success: boolean;
    returnData: string;
  }[];
  
  /** Gas used */
  gasUsed: bigint;
  
  /** Effective gas price */
  effectiveGasPrice: bigint;
}