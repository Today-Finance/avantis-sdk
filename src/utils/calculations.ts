/**
 * Trading calculation utilities for Avantis SDK
 * Includes liquidation price, PnL, margin requirements, and risk calculations
 */

import Decimal from 'decimal.js';
import { PositionSide } from '../types';

/**
 * Calculates the liquidation price for a position
 * @param entryPrice - Position entry price
 * @param leverage - Position leverage
 * @param side - Position side (LONG or SHORT)
 * @param liquidationThreshold - Liquidation threshold percentage (default 90%)
 * @returns Liquidation price
 */
export function calculateLiquidationPrice(
  entryPrice: Decimal | number | string,
  leverage: number,
  side: PositionSide,
  liquidationThreshold: number = 0.9
): Decimal {
  const entry = new Decimal(entryPrice);
  const liqPercentage = new Decimal(liquidationThreshold).div(leverage);

  if (side === PositionSide.LONG) {
    // For longs: liquidation when price drops by (liquidationThreshold / leverage)%
    return entry.mul(new Decimal(1).minus(liqPercentage));
  } else {
    // For shorts: liquidation when price rises by (liquidationThreshold / leverage)%
    return entry.mul(new Decimal(1).plus(liqPercentage));
  }
}

/**
 * Calculates unrealized PnL for a position
 * @param entryPrice - Position entry price
 * @param currentPrice - Current market price
 * @param size - Position size in USDC
 * @param side - Position side (LONG or SHORT)
 * @param leverage - Position leverage
 * @returns Unrealized PnL in USDC
 */
export function calculateUnrealizedPnL(
  entryPrice: Decimal | number | string,
  currentPrice: Decimal | number | string,
  size: Decimal | number | string,
  side: PositionSide,
  leverage: number
): Decimal {
  const entry = new Decimal(entryPrice);
  const current = new Decimal(currentPrice);
  const posSize = new Decimal(size);

  const priceChange = current.minus(entry);
  const priceChangePercent = priceChange.div(entry);

  if (side === PositionSide.LONG) {
    // PnL = position_size * price_change_percent * leverage
    return posSize.mul(priceChangePercent).mul(leverage);
  } else {
    // For shorts, profit when price goes down
    return posSize.mul(priceChangePercent).mul(leverage).neg();
  }
}

/**
 * Calculates PnL percentage for a position
 * @param entryPrice - Position entry price
 * @param currentPrice - Current market price
 * @param side - Position side (LONG or SHORT)
 * @param leverage - Position leverage
 * @returns PnL percentage (100 = +100%, -50 = -50%)
 */
export function calculatePnLPercentage(
  entryPrice: Decimal | number | string,
  currentPrice: Decimal | number | string,
  side: PositionSide,
  leverage: number
): number {
  const entry = new Decimal(entryPrice);
  const current = new Decimal(currentPrice);

  const priceChange = current.minus(entry);
  const priceChangePercent = priceChange.div(entry).mul(100);

  if (side === PositionSide.LONG) {
    return priceChangePercent.mul(leverage).toNumber();
  } else {
    return priceChangePercent.mul(leverage).neg().toNumber();
  }
}

/**
 * Calculates required collateral for a position
 * @param size - Position size in USDC
 * @param leverage - Desired leverage
 * @returns Required collateral in USDC
 */
export function calculateRequiredCollateral(
  size: Decimal | number | string,
  leverage: number
): Decimal {
  return new Decimal(size).div(leverage);
}

/**
 * Calculates maximum position size given collateral and leverage
 * @param collateral - Available collateral in USDC
 * @param leverage - Desired leverage
 * @returns Maximum position size in USDC
 */
export function calculateMaxPositionSize(
  collateral: Decimal | number | string,
  leverage: number
): Decimal {
  return new Decimal(collateral).mul(leverage);
}

/**
 * Calculates margin level (equity / margin used)
 * @param equity - Total equity (collateral + unrealized PnL)
 * @param marginUsed - Margin used for positions
 * @returns Margin level percentage (150 = 150%)
 */
export function calculateMarginLevel(
  equity: Decimal | number | string,
  marginUsed: Decimal | number | string
): number {
  const eq = new Decimal(equity);
  const margin = new Decimal(marginUsed);

  if (margin.lte(0)) {
    return 100;
  }

  return eq.div(margin).mul(100).toNumber();
}

/**
 * Calculates borrowing/funding fee for a position
 * @param positionSize - Position size in USDC
 * @param borrowFeePerHour - Borrow fee rate per hour (e.g., 0.01 for 0.01%)
 * @param hours - Number of hours position has been open
 * @returns Total borrowing fee in USDC
 */
export function calculateBorrowingFee(
  positionSize: Decimal | number | string,
  borrowFeePerHour: number,
  hours: number
): Decimal {
  const size = new Decimal(positionSize);
  const feeRate = new Decimal(borrowFeePerHour).div(100); // Convert to decimal
  return size.mul(feeRate).mul(hours);
}

/**
 * Calculates distance to liquidation as a percentage
 * @param currentPrice - Current market price
 * @param liquidationPrice - Liquidation price
 * @param side - Position side (LONG or SHORT)
 * @returns Distance to liquidation in percentage (positive means safe)
 */
export function calculateDistanceToLiquidation(
  currentPrice: Decimal | number | string,
  liquidationPrice: Decimal | number | string,
  side: PositionSide
): number {
  const current = new Decimal(currentPrice);
  const liq = new Decimal(liquidationPrice);

  if (side === PositionSide.LONG) {
    // For longs: safe when current > liquidation
    // Distance = (current - liq) / current * 100
    return current.minus(liq).div(current).mul(100).toNumber();
  } else {
    // For shorts: safe when current < liquidation
    // Distance = (liq - current) / current * 100
    return liq.minus(current).div(current).mul(100).toNumber();
  }
}

/**
 * Calculates effective leverage based on current PnL
 * @param entryCollateral - Initial collateral
 * @param unrealizedPnL - Unrealized PnL
 * @param positionSize - Position size
 * @returns Current effective leverage
 */
export function calculateEffectiveLeverage(
  entryCollateral: Decimal | number | string,
  unrealizedPnL: Decimal | number | string,
  positionSize: Decimal | number | string
): number {
  const collateral = new Decimal(entryCollateral);
  const pnl = new Decimal(unrealizedPnL);
  const size = new Decimal(positionSize);

  const currentEquity = collateral.plus(pnl);

  if (currentEquity.lte(0)) {
    return Infinity; // Position would be liquidated
  }

  return size.div(currentEquity).toNumber();
}

/**
 * Validates if a position would be at risk of liquidation
 * @param currentPrice - Current market price
 * @param entryPrice - Position entry price
 * @param leverage - Position leverage
 * @param side - Position side
 * @param minSafetyMargin - Minimum safety margin percentage (default 20%)
 * @returns True if position is at risk
 */
export function isPositionAtRisk(
  currentPrice: Decimal | number | string,
  entryPrice: Decimal | number | string,
  leverage: number,
  side: PositionSide,
  minSafetyMargin: number = 20
): boolean {
  const liqPrice = calculateLiquidationPrice(entryPrice, leverage, side);
  const distance = calculateDistanceToLiquidation(currentPrice, liqPrice, side);

  return distance < minSafetyMargin;
}

/**
 * Calculates the break-even price including fees
 * @param entryPrice - Position entry price
 * @param openFeePercent - Opening fee percentage (e.g., 0.1 for 0.1%)
 * @param closeFeePercent - Closing fee percentage (e.g., 0.1 for 0.1%)
 * @param leverage - Position leverage
 * @param side - Position side
 * @returns Break-even price
 */
export function calculateBreakEvenPrice(
  entryPrice: Decimal | number | string,
  openFeePercent: number,
  closeFeePercent: number,
  leverage: number,
  side: PositionSide
): Decimal {
  const entry = new Decimal(entryPrice);
  const totalFeePercent = new Decimal(openFeePercent + closeFeePercent).div(100);

  // Fee impact on price = (total_fee_percent * leverage)
  const feeImpact = totalFeePercent.mul(leverage);

  if (side === PositionSide.LONG) {
    // For longs, need price to rise to cover fees
    return entry.mul(new Decimal(1).plus(feeImpact));
  } else {
    // For shorts, need price to fall to cover fees
    return entry.mul(new Decimal(1).minus(feeImpact));
  }
}

/**
 * Simulates a trade and returns expected outcomes
 * @param params Trade simulation parameters
 * @returns Simulation results
 */
export interface TradeSimulationParams {
  pair: string;
  entryPrice: Decimal | number | string;
  size: Decimal | number | string;
  leverage: number;
  side: PositionSide;
  openFeePercent?: number;
  closeFeePercent?: number;
  targetPrices?: (Decimal | number | string)[];
}

export interface TradeSimulationResult {
  pair: string;
  collateralRequired: Decimal;
  liquidationPrice: Decimal;
  breakEvenPrice: Decimal;
  maxLoss: Decimal; // Max loss at liquidation
  scenarios: Array<{
    price: Decimal;
    pnl: Decimal;
    pnlPercent: number;
    distanceToLiquidation: number;
    effectiveLeverage: number;
  }>;
}

export function simulateTrade(params: TradeSimulationParams): TradeSimulationResult {
  const {
    pair,
    entryPrice,
    size,
    leverage,
    side,
    openFeePercent = 0.1,
    closeFeePercent = 0.1,
    targetPrices = []
  } = params;

  const collateralRequired = calculateRequiredCollateral(size, leverage);
  const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side);
  const breakEvenPrice = calculateBreakEvenPrice(entryPrice, openFeePercent, closeFeePercent, leverage, side);

  // Max loss is collateral (minus fees already paid)
  const maxLoss = collateralRequired.mul(0.95); // Assuming 5% remaining after liquidation

  // Generate scenarios for target prices
  const scenarios = targetPrices.map(targetPrice => {
    const pnl = calculateUnrealizedPnL(entryPrice, targetPrice, size, side, leverage);
    const pnlPercent = calculatePnLPercentage(entryPrice, targetPrice, side, leverage);
    const distanceToLiquidation = calculateDistanceToLiquidation(targetPrice, liquidationPrice, side);
    const effectiveLeverage = calculateEffectiveLeverage(collateralRequired, pnl, size);

    return {
      price: new Decimal(targetPrice),
      pnl,
      pnlPercent,
      distanceToLiquidation,
      effectiveLeverage
    };
  });

  return {
    pair,
    collateralRequired,
    liquidationPrice,
    breakEvenPrice,
    maxLoss,
    scenarios
  };
}
