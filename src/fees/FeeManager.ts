/**
 * FeeManager - Handles platform fee calculations and distributions
 */

import Decimal from 'decimal.js';
import type { 
  PlatformFeeConfig, 
  PlatformFeeParams, 
  FeeBreakdown 
} from '../types/platform-fees';
import {
  MIN_PLATFORM_FEE_PERCENT,
  MAX_PLATFORM_FEE_PERCENT,
  DEFAULT_REFERRAL_SPLIT_PERCENT,
  MAX_DISCOUNT_PERCENT
} from './constants';
import { ValidationError } from '../utils/errors';

export class FeeManager {
  private config: PlatformFeeConfig;

  constructor(config?: Partial<PlatformFeeConfig>) {
    this.config = {
      platformWallet: config?.platformWallet || '',
      baseFeePercent: config?.baseFeePercent || 0,
      referralSplitPercent: config?.referralSplitPercent || DEFAULT_REFERRAL_SPLIT_PERCENT,
      enabled: config?.enabled || false
    };
    
    if (this.config.enabled) {
      this.validateConfig();
    }
  }

  /**
   * Validates the fee configuration
   */
  private validateConfig(): void {
    if (!this.config.platformWallet || this.config.platformWallet === '') {
      throw new ValidationError('Platform wallet address is required when fees are enabled', 'platformWallet');
    }
    
    if (this.config.baseFeePercent < MIN_PLATFORM_FEE_PERCENT) {
      throw new ValidationError(
        `Base fee percent must be at least ${MIN_PLATFORM_FEE_PERCENT * 100}%`,
        'baseFeePercent'
      );
    }
    
    if (this.config.baseFeePercent > MAX_PLATFORM_FEE_PERCENT) {
      throw new ValidationError(
        `Base fee percent cannot exceed ${MAX_PLATFORM_FEE_PERCENT * 100}%`,
        'baseFeePercent'
      );
    }
    
    if (this.config.referralSplitPercent! < 0 || this.config.referralSplitPercent! > 100) {
      throw new ValidationError(
        'Referral split percent must be between 0 and 100',
        'referralSplitPercent'
      );
    }
  }

  /**
   * Updates the fee configuration
   */
  public updateConfig(config: Partial<PlatformFeeConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.enabled) {
      this.validateConfig();
    }
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): PlatformFeeConfig {
    return { ...this.config };
  }

  /**
   * Checks if fees are enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Calculates platform fee for a trade
   */
  public calculatePlatformFee(
    tradeSize: Decimal | number | string,
    discountPercent: number = 0
  ): Decimal {
    const size = new Decimal(tradeSize);
    
    // Calculate base fee
    const baseFee = size.mul(this.config.baseFeePercent);
    
    // Apply discount if provided
    if (discountPercent > 0) {
      return this.applyDiscount(baseFee, discountPercent);
    }
    
    return baseFee;
  }

  /**
   * Applies a discount to a fee amount
   */
  public applyDiscount(fee: Decimal, discountPercent: number): Decimal {
    if (discountPercent < 0 || discountPercent > MAX_DISCOUNT_PERCENT) {
      throw new ValidationError(
        `Discount percent must be between 0 and ${MAX_DISCOUNT_PERCENT}`,
        'discountPercent'
      );
    }
    
    const discountMultiplier = new Decimal(1).minus(new Decimal(discountPercent).div(100));
    return fee.mul(discountMultiplier);
  }

  /**
   * Calculates the fee split between platform and referrer
   */
  public splitFeeForReferral(totalFee: Decimal): {
    platform: Decimal;
    referral: Decimal;
  } {
    if (!this.config.referralSplitPercent || this.config.referralSplitPercent === 0) {
      return {
        platform: totalFee,
        referral: new Decimal(0)
      };
    }
    
    const referralAmount = totalFee.mul(this.config.referralSplitPercent).div(100);
    const platformAmount = totalFee.minus(referralAmount);
    
    return {
      platform: platformAmount,
      referral: referralAmount
    };
  }

  /**
   * Calculates complete fee breakdown for a trade
   */
  public calculateFeeBreakdown(
    tradeSize: Decimal | number | string,
    params?: PlatformFeeParams
  ): FeeBreakdown {
    const size = new Decimal(tradeSize);
    
    // If fees are disabled globally or for this trade, return zeros
    if (!this.config.enabled || !params?.enabled) {
      return {
        baseFee: new Decimal(0),
        discount: new Decimal(0),
        platformFee: new Decimal(0),
        referralFee: new Decimal(0),
        platformReceives: new Decimal(0),
        totalFee: new Decimal(0)
      };
    }
    
    // Calculate base fee
    const baseFee = size.mul(this.config.baseFeePercent);
    
    // Calculate discount
    const discountPercent = params.discountPercent || 0;
    const discount = baseFee.mul(discountPercent).div(100);
    
    // Calculate platform fee after discount
    const platformFee = baseFee.minus(discount);
    
    // Calculate referral split if referrer is provided
    let referralFee = new Decimal(0);
    let platformReceives = platformFee;
    
    if (params.referralAddress && this.config.referralSplitPercent) {
      const split = this.splitFeeForReferral(platformFee);
      platformReceives = split.platform;
      referralFee = split.referral;
    }
    
    return {
      baseFee,
      discount,
      platformFee,
      referralFee,
      platformReceives,
      totalFee: platformFee
    };
  }

  /**
   * Validates fee parameters for a trade
   */
  public validateFeeParams(params: PlatformFeeParams): void {
    if (params.discountPercent !== undefined) {
      if (params.discountPercent < 0 || params.discountPercent > MAX_DISCOUNT_PERCENT) {
        throw new ValidationError(
          `Discount percent must be between 0 and ${MAX_DISCOUNT_PERCENT}`,
          'discountPercent'
        );
      }
    }
    
    if (params.referralAddress) {
      // Basic address validation (could be enhanced)
      if (!params.referralAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError('Invalid referral address format', 'referralAddress');
      }
    }
  }

  /**
   * Formats fee breakdown for display
   */
  public formatFeeBreakdown(breakdown: FeeBreakdown): string[] {
    const lines: string[] = [];
    
    lines.push(`Base Fee: $${breakdown.baseFee.toFixed(6)}`);
    
    if (breakdown.discount.gt(0)) {
      lines.push(`Discount: -$${breakdown.discount.toFixed(6)}`);
    }
    
    lines.push(`Platform Fee: $${breakdown.platformFee.toFixed(6)}`);
    
    if (breakdown.referralFee.gt(0)) {
      lines.push(`  → Platform: $${breakdown.platformReceives.toFixed(6)}`);
      lines.push(`  → Referral: $${breakdown.referralFee.toFixed(6)}`);
    }
    
    lines.push(`Total Fee: $${breakdown.totalFee.toFixed(6)}`);
    
    return lines;
  }
}