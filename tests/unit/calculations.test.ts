import Decimal from 'decimal.js';
import {
  calculateLiquidationPrice,
  calculateUnrealizedPnL,
  calculatePnLPercentage,
  calculateRequiredCollateral,
  calculateMaxPositionSize,
  calculateMarginLevel,
  calculateBorrowingFee,
  calculateDistanceToLiquidation,
  calculateEffectiveLeverage,
  isPositionAtRisk,
  calculateBreakEvenPrice,
  simulateTrade,
  TradeSimulationParams
} from '../../src/utils/calculations';
import { PositionSide } from '../../src/types';

describe('Trading Calculations', () => {
  describe('calculateLiquidationPrice', () => {
    it('should calculate liquidation price for LONG position', () => {
      const entryPrice = 3000;
      const leverage = 10;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, PositionSide.LONG);

      // For 10x leverage with 90% threshold: 3000 * (1 - 0.9/10) = 3000 * 0.91 = 2730
      expect(liqPrice.toNumber()).toBeCloseTo(2730, 2);
    });

    it('should calculate liquidation price for SHORT position', () => {
      const entryPrice = 3000;
      const leverage = 10;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, PositionSide.SHORT);

      // For 10x leverage with 90% threshold: 3000 * (1 + 0.9/10) = 3000 * 1.09 = 3270
      expect(liqPrice.toNumber()).toBeCloseTo(3270, 2);
    });

    it('should calculate liquidation price with custom threshold', () => {
      const entryPrice = 3000;
      const leverage = 5;
      const threshold = 0.8; // 80% threshold
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, PositionSide.LONG, threshold);

      // 3000 * (1 - 0.8/5) = 3000 * 0.84 = 2520
      expect(liqPrice.toNumber()).toBeCloseTo(2520, 2);
    });

    it('should accept Decimal input', () => {
      const entryPrice = new Decimal(3000);
      const liqPrice = calculateLiquidationPrice(entryPrice, 10, PositionSide.LONG);
      expect(liqPrice).toBeInstanceOf(Decimal);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('should calculate profit for LONG position when price increases', () => {
      const entryPrice = 3000;
      const currentPrice = 3300; // +10% price increase
      const size = 1000; // $1000 position
      const leverage = 10;

      const pnl = calculateUnrealizedPnL(entryPrice, currentPrice, size, PositionSide.LONG, leverage);

      // 10% price change * 10x leverage * $1000 = $1000 profit
      expect(pnl.toNumber()).toBeCloseTo(1000, 2);
    });

    it('should calculate loss for LONG position when price decreases', () => {
      const entryPrice = 3000;
      const currentPrice = 2700; // -10% price decrease
      const size = 1000;
      const leverage = 10;

      const pnl = calculateUnrealizedPnL(entryPrice, currentPrice, size, PositionSide.LONG, leverage);

      // -10% price change * 10x leverage * $1000 = -$1000 loss
      expect(pnl.toNumber()).toBeCloseTo(-1000, 2);
    });

    it('should calculate profit for SHORT position when price decreases', () => {
      const entryPrice = 3000;
      const currentPrice = 2700; // -10% price decrease
      const size = 1000;
      const leverage = 10;

      const pnl = calculateUnrealizedPnL(entryPrice, currentPrice, size, PositionSide.SHORT, leverage);

      // -10% price change * 10x leverage * $1000 = $1000 profit for SHORT
      expect(pnl.toNumber()).toBeCloseTo(1000, 2);
    });

    it('should calculate zero PnL when price unchanged', () => {
      const pnl = calculateUnrealizedPnL(3000, 3000, 1000, PositionSide.LONG, 10);
      expect(pnl.toNumber()).toBe(0);
    });
  });

  describe('calculatePnLPercentage', () => {
    it('should calculate percentage for LONG position', () => {
      const entryPrice = 3000;
      const currentPrice = 3300; // +10%
      const leverage = 10;

      const pnlPercent = calculatePnLPercentage(entryPrice, currentPrice, PositionSide.LONG, leverage);

      // 10% * 10x = 100%
      expect(pnlPercent).toBeCloseTo(100, 2);
    });

    it('should calculate percentage for SHORT position', () => {
      const entryPrice = 3000;
      const currentPrice = 3150; // +5%
      const leverage = 10;

      const pnlPercent = calculatePnLPercentage(entryPrice, currentPrice, PositionSide.SHORT, leverage);

      // +5% price = -50% for SHORT with 10x
      expect(pnlPercent).toBeCloseTo(-50, 2);
    });
  });

  describe('calculateRequiredCollateral', () => {
    it('should calculate required collateral', () => {
      const size = 1000;
      const leverage = 10;

      const collateral = calculateRequiredCollateral(size, leverage);

      expect(collateral.toNumber()).toBe(100); // 1000 / 10 = 100
    });

    it('should work with high leverage', () => {
      const collateral = calculateRequiredCollateral(10000, 100);
      expect(collateral.toNumber()).toBe(100); // 10000 / 100 = 100
    });
  });

  describe('calculateMaxPositionSize', () => {
    it('should calculate max position size', () => {
      const collateral = 100;
      const leverage = 10;

      const maxSize = calculateMaxPositionSize(collateral, leverage);

      expect(maxSize.toNumber()).toBe(1000); // 100 * 10 = 1000
    });
  });

  describe('calculateMarginLevel', () => {
    it('should calculate margin level when healthy', () => {
      const equity = 150; // $150 equity
      const marginUsed = 100; // $100 margin

      const marginLevel = calculateMarginLevel(equity, marginUsed);

      expect(marginLevel).toBe(150); // 150%
    });

    it('should return 100 when no margin used', () => {
      const marginLevel = calculateMarginLevel(100, 0);
      expect(marginLevel).toBe(100);
    });

    it('should calculate low margin level', () => {
      const marginLevel = calculateMarginLevel(110, 100);
      expect(marginLevel).toBe(110); // 110% (at risk)
    });
  });

  describe('calculateBorrowingFee', () => {
    it('should calculate borrowing fee', () => {
      const positionSize = 1000;
      const borrowFeePerHour = 0.01; // 0.01% per hour
      const hours = 24;

      const fee = calculateBorrowingFee(positionSize, borrowFeePerHour, hours);

      // 1000 * 0.0001 * 24 = 2.4
      expect(fee.toNumber()).toBeCloseTo(2.4, 2);
    });
  });

  describe('calculateDistanceToLiquidation', () => {
    it('should calculate distance for LONG position', () => {
      const currentPrice = 2850;
      const liquidationPrice = 2700;

      const distance = calculateDistanceToLiquidation(currentPrice, liquidationPrice, PositionSide.LONG);

      // (2850 - 2700) / 2850 * 100 = 5.26%
      expect(distance).toBeCloseTo(5.26, 1);
    });

    it('should calculate distance for SHORT position', () => {
      const currentPrice = 3150;
      const liquidationPrice = 3300;

      const distance = calculateDistanceToLiquidation(currentPrice, liquidationPrice, PositionSide.SHORT);

      // (3300 - 3150) / 3150 * 100 = 4.76%
      expect(distance).toBeCloseTo(4.76, 1);
    });

    it('should return negative when at risk', () => {
      const distance = calculateDistanceToLiquidation(2650, 2700, PositionSide.LONG);
      expect(distance).toBeLessThan(0);
    });
  });

  describe('calculateEffectiveLeverage', () => {
    it('should calculate increased leverage after loss', () => {
      const entryCollateral = 100;
      const unrealizedPnL = -20; // $20 loss
      const positionSize = 1000;

      const effectiveLeverage = calculateEffectiveLeverage(entryCollateral, unrealizedPnL, positionSize);

      // 1000 / (100 - 20) = 12.5x
      expect(effectiveLeverage).toBeCloseTo(12.5, 2);
    });

    it('should calculate decreased leverage after profit', () => {
      const entryCollateral = 100;
      const unrealizedPnL = 50; // $50 profit
      const positionSize = 1000;

      const effectiveLeverage = calculateEffectiveLeverage(entryCollateral, unrealizedPnL, positionSize);

      // 1000 / (100 + 50) = 6.67x
      expect(effectiveLeverage).toBeCloseTo(6.67, 2);
    });

    it('should return Infinity when liquidated', () => {
      const effectiveLeverage = calculateEffectiveLeverage(100, -100, 1000);
      expect(effectiveLeverage).toBe(Infinity);
    });
  });

  describe('isPositionAtRisk', () => {
    it('should identify risky position', () => {
      const currentPrice = 2750;
      const entryPrice = 3000;
      const leverage = 10;

      const atRisk = isPositionAtRisk(currentPrice, entryPrice, leverage, PositionSide.LONG, 20);

      expect(atRisk).toBe(true); // Too close to liquidation
    });

    it('should identify safe position', () => {
      const currentPrice = 3100;
      const entryPrice = 3000;
      const leverage = 10;

      const atRisk = isPositionAtRisk(currentPrice, entryPrice, leverage, PositionSide.LONG, 20);

      expect(atRisk).toBe(false); // Safe distance from liquidation
    });
  });

  describe('calculateBreakEvenPrice', () => {
    it('should calculate break-even for LONG including fees', () => {
      const entryPrice = 3000;
      const openFee = 0.1; // 0.1%
      const closeFee = 0.1; // 0.1%
      const leverage = 10;

      const breakEven = calculateBreakEvenPrice(entryPrice, openFee, closeFee, leverage, PositionSide.LONG);

      // Need 0.2% * 10x = 2% price increase
      // 3000 * 1.02 = 3060
      expect(breakEven.toNumber()).toBeCloseTo(3060, 2);
    });

    it('should calculate break-even for SHORT including fees', () => {
      const entryPrice = 3000;
      const openFee = 0.1;
      const closeFee = 0.1;
      const leverage = 10;

      const breakEven = calculateBreakEvenPrice(entryPrice, openFee, closeFee, leverage, PositionSide.SHORT);

      // Need 2% price decrease for SHORT
      // 3000 * 0.98 = 2940
      expect(breakEven.toNumber()).toBeCloseTo(2940, 2);
    });
  });

  describe('simulateTrade', () => {
    it('should simulate complete trade with scenarios', () => {
      const params: TradeSimulationParams = {
        pair: 'ETH/USD',
        entryPrice: 3000,
        size: 1000,
        leverage: 10,
        side: PositionSide.LONG,
        openFeePercent: 0.1,
        closeFeePercent: 0.1,
        targetPrices: [2700, 3000, 3300, 3600]
      };

      const simulation = simulateTrade(params);

      expect(simulation.pair).toBe('ETH/USD');
      expect(simulation.collateralRequired.toNumber()).toBe(100);
      expect(simulation.liquidationPrice.toNumber()).toBeCloseTo(2730, 2);
      expect(simulation.breakEvenPrice.toNumber()).toBeCloseTo(3060, 2);
      expect(simulation.maxLoss.toNumber()).toBeCloseTo(95, 2);
      expect(simulation.scenarios).toHaveLength(4);

      // Check first scenario (price drop to 2700 = -10%)
      const scenario1 = simulation.scenarios[0];
      expect(scenario1.price.toNumber()).toBe(2700);
      expect(scenario1.pnlPercent).toBeCloseTo(-100, 2); // -10% * 10x = -100%
      expect(scenario1.distanceToLiquidation).toBeCloseTo(-1.11, 1); // Negative, at risk
    });

    it('should simulate SHORT position correctly', () => {
      const params: TradeSimulationParams = {
        pair: 'BTC/USD',
        entryPrice: 50000,
        size: 10000,
        leverage: 20,
        side: PositionSide.SHORT,
        targetPrices: [45000, 50000, 55000]
      };

      const simulation = simulateTrade(params);

      expect(simulation.collateralRequired.toNumber()).toBe(500);

      // Check profit scenario (price drops to 45000 = -10%)
      const profitScenario = simulation.scenarios[0];
      expect(profitScenario.pnlPercent).toBeCloseTo(200, 2); // -10% * 20x = +200% for SHORT
    });
  });

  describe('Edge Cases', () => {
    it('should handle string inputs', () => {
      const liqPrice = calculateLiquidationPrice('3000', 10, PositionSide.LONG);
      expect(liqPrice.toNumber()).toBeCloseTo(2730, 2);
    });

    it('should handle very high leverage', () => {
      const liqPrice = calculateLiquidationPrice(3000, 500, PositionSide.LONG);
      expect(liqPrice.toNumber()).toBeCloseTo(2994.6, 1);
    });

    it('should handle low leverage', () => {
      const liqPrice = calculateLiquidationPrice(3000, 2, PositionSide.LONG);
      expect(liqPrice.toNumber()).toBeCloseTo(1650, 2);
    });

    it('should handle zero PnL scenarios', () => {
      const pnl = calculateUnrealizedPnL(3000, 3000, 1000, PositionSide.LONG, 10);
      expect(pnl.toNumber()).toBe(0);
    });
  });
});
