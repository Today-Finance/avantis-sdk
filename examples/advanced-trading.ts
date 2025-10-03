/**
 * Advanced Trading Examples
 * Demonstrates sophisticated trading strategies and risk management
 */

import {
  TraderClient,
  FeedClient,
  PositionSide,
  Position,
  formatUSDC,
  formatPrice,
  formatPercentage,
  ErrorCode,
  TradingError,
} from '@todayapp/avantis-sdk';
import Decimal from 'decimal.js';

/**
 * Risk Management Configuration
 */
interface RiskConfig {
  maxPositionSize: Decimal;      // Maximum size per position
  maxTotalExposure: Decimal;     // Maximum total exposure across all positions
  maxLeverage: number;            // Maximum allowed leverage
  stopLossPercent: number;        // Default stop loss percentage
  takeProfitPercent: number;      // Default take profit percentage
  maxDrawdownPercent: number;     // Maximum allowed drawdown
  minMarginLevel: number;         // Minimum margin level to maintain
}

/**
 * Trading Strategy Interface
 */
interface TradingStrategy {
  name: string;
  execute(trader: TraderClient, feed: FeedClient): Promise<void>;
}

/**
 * Advanced Trading Bot
 */
export class AdvancedTradingBot {
  private trader: TraderClient;
  private feed: FeedClient;
  private riskConfig: RiskConfig;
  private isRunning: boolean = false;
  private positions: Map<string, Position> = new Map();

  constructor(
    network: 'base' | 'base-sepolia',
    privateKey: string,
    riskConfig: RiskConfig
  ) {
    this.trader = new TraderClient(network);
    this.feed = new FeedClient({ network });
    this.riskConfig = riskConfig;
    
    // Initialize wallet
    this.trader.setSigner({
      type: 'privateKey',
      privateKey,
    });
  }

  /**
   * Start the trading bot
   */
  async start() {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 Trading bot started');

    // Connect to price feed
    await this.feed.connect();

    // Load existing positions
    await this.loadPositions();

    // Start monitoring
    this.startMonitoring();
    this.startRiskManagement();
  }

  /**
   * Stop the trading bot
   */
  stop() {
    this.isRunning = false;
    this.feed.disconnect();
    this.trader.disconnect();
    console.log('🛑 Trading bot stopped');
  }

  /**
   * Load all open positions
   */
  private async loadPositions() {
    const positions = await this.trader.getPositions();
    this.positions.clear();
    
    for (const position of positions) {
      this.positions.set(position.id, position);
    }
    
    console.log(`Loaded ${positions.length} open positions`);
  }

  /**
   * Monitor positions and market conditions
   */
  private startMonitoring() {
    // Monitor each position
    for (const [id, position] of this.positions) {
      this.monitorPosition(position);
    }

    // Monitor market conditions every 30 seconds
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.checkMarketConditions();
    }, 30000);
  }

  /**
   * Monitor individual position
   */
  private monitorPosition(position: Position) {
    const unsubscribe = this.feed.subscribeToPrice(position.pair, async (priceData) => {
      if (!this.isRunning) {
        unsubscribe();
        return;
      }

      // Calculate current PnL
      const pnl = this.calculatePnL(position, priceData.price);
      const pnlPercent = pnl.div(position.collateral).mul(100);

      // Check if we should close the position
      if (await this.shouldClosePosition(position, priceData.price, pnlPercent)) {
        await this.closePositionWithRetry(position.id);
        unsubscribe();
      }
    });
  }

  /**
   * Calculate position PnL
   */
  private calculatePnL(position: Position, currentPrice: Decimal): Decimal {
    const priceDiff = position.side === PositionSide.LONG
      ? currentPrice.sub(position.entryPrice)
      : position.entryPrice.sub(currentPrice);
    
    return priceDiff.mul(position.size).div(position.entryPrice);
  }

  /**
   * Determine if position should be closed
   */
  private async shouldClosePosition(
    position: Position,
    currentPrice: Decimal,
    pnlPercent: Decimal
  ): Promise<boolean> {
    // Check stop loss
    if (position.stopLoss && currentPrice.lte(position.stopLoss)) {
      console.log(`⛔ Stop loss triggered for position ${position.id}`);
      return true;
    }

    // Check take profit
    if (position.takeProfit && currentPrice.gte(position.takeProfit)) {
      console.log(`✅ Take profit triggered for position ${position.id}`);
      return true;
    }

    // Check max drawdown
    if (pnlPercent.lt(-this.riskConfig.maxDrawdownPercent)) {
      console.log(`📉 Max drawdown exceeded for position ${position.id}`);
      return true;
    }

    // Check margin level
    const accountInfo = await this.trader.getAccountInfo();
    if (accountInfo.marginLevel < this.riskConfig.minMarginLevel) {
      console.log(`⚠️ Margin level too low, closing position ${position.id}`);
      return true;
    }

    return false;
  }

  /**
   * Close position with retry logic
   */
  private async closePositionWithRetry(positionId: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.trader.closePosition({
          positionId,
          slippage: 1, // Allow higher slippage for emergency closes
        });

        if (result.success) {
          console.log(`Position ${positionId} closed successfully`);
          this.positions.delete(positionId);
          return;
        }
      } catch (error) {
        console.error(`Failed to close position (attempt ${i + 1}):`, error);
        if (i === retries - 1) throw error;
        await this.sleep(2000); // Wait 2 seconds before retry
      }
    }
  }

  /**
   * Risk management checks
   */
  private async startRiskManagement() {
    setInterval(async () => {
      if (!this.isRunning) return;

      const accountInfo = await this.trader.getAccountInfo();
      
      // Check total exposure
      const totalExposure = accountInfo.positions.reduce(
        (sum, pos) => sum.add(pos.size),
        new Decimal(0)
      );

      if (totalExposure.gt(this.riskConfig.maxTotalExposure)) {
        console.log('⚠️ Total exposure limit exceeded, reducing positions');
        await this.reduceExposure();
      }

      // Check margin level
      if (accountInfo.marginLevel < this.riskConfig.minMarginLevel * 1.2) {
        console.log('⚠️ Margin level getting low:', accountInfo.marginLevel);
      }
    }, 60000); // Check every minute
  }

  /**
   * Reduce exposure by closing profitable positions
   */
  private async reduceExposure() {
    const positions = Array.from(this.positions.values());
    
    // Sort by PnL (highest first)
    positions.sort((a, b) => {
      const aPnL = a.unrealizedPnl || new Decimal(0);
      const bPnL = b.unrealizedPnl || new Decimal(0);
      return bPnL.sub(aPnL).toNumber();
    });

    // Close most profitable position
    if (positions.length > 0 && positions[0].unrealizedPnl?.gt(0)) {
      await this.closePositionWithRetry(positions[0].id);
    }
  }

  /**
   * Check market conditions for trading opportunities
   */
  private async checkMarketConditions() {
    try {
      // Get market data for all pairs
      const pairs = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
      const marketData = await Promise.all(
        pairs.map(pair => this.feed.getMarketStats(pair))
      );

      // Analyze each market
      for (const data of marketData) {
        await this.analyzeMarket(data);
      }
    } catch (error) {
      console.error('Error checking market conditions:', error);
    }
  }

  /**
   * Analyze market for trading signals
   */
  private async analyzeMarket(marketStats: any) {
    // Example: Look for momentum
    if (marketStats.changePercent24h > 5) {
      console.log(`📈 Strong upward momentum in ${marketStats.pair}`);
      // Could trigger a momentum strategy here
    } else if (marketStats.changePercent24h < -5) {
      console.log(`📉 Strong downward momentum in ${marketStats.pair}`);
      // Could trigger a contrarian strategy here
    }

    // Check volume
    if (marketStats.volume24h.gt(1000000)) {
      console.log(`High volume in ${marketStats.pair}: ${formatUSDC(marketStats.volume24h)}`);
    }
  }

  /**
   * Execute a grid trading strategy
   */
  async executeGridStrategy(
    pair: string,
    gridLevels: number,
    gridSpacing: number,
    positionSize: Decimal
  ) {
    console.log(`Starting grid strategy for ${pair}`);
    
    const currentPrice = await this.feed.getLatestPrice(pair);
    const basePrice = currentPrice.price;

    // Create grid levels
    const orders = [];
    
    for (let i = 1; i <= gridLevels / 2; i++) {
      // Buy orders below current price
      const buyPrice = basePrice.mul(1 - (gridSpacing * i) / 100);
      orders.push({
        side: PositionSide.LONG,
        price: buyPrice,
        size: positionSize,
      });

      // Sell orders above current price
      const sellPrice = basePrice.mul(1 + (gridSpacing * i) / 100);
      orders.push({
        side: PositionSide.SHORT,
        price: sellPrice,
        size: positionSize,
      });
    }

    console.log(`Created ${orders.length} grid orders`);
    // In a real implementation, you would place limit orders here
  }

  /**
   * Execute a DCA (Dollar Cost Averaging) strategy
   */
  async executeDCAStrategy(
    pair: string,
    amount: Decimal,
    interval: number // in milliseconds
  ) {
    console.log(`Starting DCA strategy for ${pair}`);
    
    const buyInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(buyInterval);
        return;
      }

      try {
        await this.trader.openPosition({
          pair,
          side: PositionSide.LONG,
          size: amount,
          leverage: 1, // No leverage for DCA
          slippage: 0.5,
        });
        
        console.log(`DCA: Bought ${formatUSDC(amount)} of ${pair}`);
      } catch (error) {
        console.error('DCA purchase failed:', error);
      }
    }, interval);
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Example usage
 */
export async function runAdvancedTrading() {
  // Configure risk parameters
  const riskConfig: RiskConfig = {
    maxPositionSize: new Decimal('1000'),    // Max $1000 per position
    maxTotalExposure: new Decimal('5000'),   // Max $5000 total exposure
    maxLeverage: 20,                         // Max 20x leverage
    stopLossPercent: 5,                      // 5% stop loss
    takeProfitPercent: 10,                   // 10% take profit
    maxDrawdownPercent: 10,                  // Max 10% drawdown
    minMarginLevel: 150,                     // Min 150% margin level
  };

  // Initialize bot
  const bot = new AdvancedTradingBot(
    'base',
    process.env.PRIVATE_KEY!,
    riskConfig
  );

  // Start trading
  await bot.start();

  // Execute strategies
  await bot.executeGridStrategy('ETH/USD', 10, 1, new Decimal('50'));
  await bot.executeDCAStrategy('BTC/USD', new Decimal('100'), 3600000); // Every hour

  // Run for 24 hours then stop
  setTimeout(() => {
    bot.stop();
    console.log('Trading session completed');
  }, 24 * 60 * 60 * 1000);
}

// Run if executed directly
if (require.main === module) {
  runAdvancedTrading().catch(console.error);
}