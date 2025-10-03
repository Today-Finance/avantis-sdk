/**
 * Example: Update Stop Loss and Take Profit on Existing Positions
 * Shows how to add or modify TP/SL for open positions
 */

import { 
  TraderClient, 
  FeedClient, 
  Position,
  formatUSDC, 
  formatPrice,
  formatPercentage,
  PositionSide
} from '@todayapp/avantis-sdk';
import Decimal from 'decimal.js';

// Configuration
const config = {
  network: 'base' as const,
  privateKey: process.env.PRIVATE_KEY || '',
};

/**
 * Update TP/SL for a specific position
 */
export async function updatePositionTPSL(
  positionId: string,
  stopLoss?: string,
  takeProfit?: string
) {
  const trader = new TraderClient(config.network);
  const feed = new FeedClient({ network: config.network });

  try {
    // Connect wallet
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    // Get position details
    const position = await trader.getPosition(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    console.log('\n📊 Current Position Details:');
    console.log(`- Pair: ${position.pair}`);
    console.log(`- Side: ${position.side}`);
    console.log(`- Size: ${formatUSDC(position.size)}`);
    console.log(`- Entry Price: ${formatPrice(position.entryPrice)}`);
    console.log(`- Current SL: ${position.stopLoss ? formatPrice(position.stopLoss) : 'None'}`);
    console.log(`- Current TP: ${position.takeProfit ? formatPrice(position.takeProfit) : 'None'}`);

    // Get current market price
    const priceData = await feed.getLatestPrice(position.pair);
    const currentPrice = priceData.price;
    console.log(`\n📈 Current Market Price: ${formatPrice(currentPrice)}`);

    // Calculate current PnL
    const pnl = position.side === PositionSide.LONG
      ? currentPrice.sub(position.entryPrice).mul(position.size).div(position.entryPrice)
      : position.entryPrice.sub(currentPrice).mul(position.size).div(position.entryPrice);
    
    const pnlPercent = pnl.div(position.collateral).mul(100);
    console.log(`💰 Current PnL: ${formatUSDC(pnl)} (${formatPercentage(pnlPercent)})`);

    // Validate new stop loss if provided
    if (stopLoss) {
      const slPrice = new Decimal(stopLoss);
      if (position.side === PositionSide.LONG) {
        if (slPrice.gte(currentPrice)) {
          console.warn('⚠️ Warning: Stop loss is above current price for long position');
        }
      } else {
        if (slPrice.lte(currentPrice)) {
          console.warn('⚠️ Warning: Stop loss is below current price for short position');
        }
      }
    }

    // Validate new take profit if provided
    if (takeProfit) {
      const tpPrice = new Decimal(takeProfit);
      if (position.side === PositionSide.LONG) {
        if (tpPrice.lte(currentPrice)) {
          console.warn('⚠️ Warning: Take profit is below current price for long position');
        }
      } else {
        if (tpPrice.gte(currentPrice)) {
          console.warn('⚠️ Warning: Take profit is above current price for short position');
        }
      }
    }

    // Update position
    console.log('\n🔄 Updating position TP/SL...');
    const result = await trader.updatePosition({
      positionId,
      stopLoss: stopLoss || position.stopLoss?.toString(),
      takeProfit: takeProfit || position.takeProfit?.toString(),
    });

    if (result.success) {
      console.log('✅ Position updated successfully!');
      console.log(`Transaction Hash: ${result.transactionHash}`);
      console.log(`\n📊 New TP/SL Values:`);
      console.log(`- Stop Loss: ${stopLoss ? formatPrice(stopLoss) : (position.stopLoss ? formatPrice(position.stopLoss) : 'None')}`);
      console.log(`- Take Profit: ${takeProfit ? formatPrice(takeProfit) : (position.takeProfit ? formatPrice(position.takeProfit) : 'None')}`);
    } else {
      console.error('❌ Failed to update position:', result.error);
    }

  } catch (error) {
    console.error('Error updating position:', error);
    throw error;
  } finally {
    trader.disconnect();
    feed.disconnect();
  }
}

/**
 * Add trailing stop loss to a position
 */
export async function addTrailingStopLoss(
  positionId: string,
  trailingPercent: number = 5 // 5% trailing stop by default
) {
  const trader = new TraderClient(config.network);
  const feed = new FeedClient({ network: config.network });

  try {
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    const position = await trader.getPosition(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Subscribe to price updates for trailing stop
    let highestPrice = position.entryPrice;
    let lowestPrice = position.entryPrice;

    console.log(`📊 Starting trailing stop for position ${positionId}`);
    console.log(`- Trailing Distance: ${trailingPercent}%`);

    const unsubscribe = feed.subscribeToPrice(position.pair, async (priceData) => {
      const currentPrice = priceData.price;

      if (position.side === PositionSide.LONG) {
        // For long positions, track highest price
        if (currentPrice.gt(highestPrice)) {
          highestPrice = currentPrice;
          const newStopLoss = highestPrice.mul(1 - trailingPercent / 100);
          
          console.log(`📈 Price increased to ${formatPrice(currentPrice)}`);
          console.log(`🔄 Updating stop loss to ${formatPrice(newStopLoss)}`);
          
          await trader.updatePosition({
            positionId,
            stopLoss: newStopLoss,
            takeProfit: position.takeProfit,
          });
        }
      } else {
        // For short positions, track lowest price
        if (currentPrice.lt(lowestPrice)) {
          lowestPrice = currentPrice;
          const newStopLoss = lowestPrice.mul(1 + trailingPercent / 100);
          
          console.log(`📉 Price decreased to ${formatPrice(currentPrice)}`);
          console.log(`🔄 Updating stop loss to ${formatPrice(newStopLoss)}`);
          
          await trader.updatePosition({
            positionId,
            stopLoss: newStopLoss,
            takeProfit: position.takeProfit,
          });
        }
      }

      // Check if stop loss is hit
      if (position.stopLoss) {
        const stopHit = position.side === PositionSide.LONG
          ? currentPrice.lte(position.stopLoss)
          : currentPrice.gte(position.stopLoss);
        
        if (stopHit) {
          console.log('🛑 Stop loss hit! Position will be closed.');
          unsubscribe();
        }
      }
    });

    // Run for specified duration (e.g., 1 hour)
    setTimeout(() => {
      unsubscribe();
      console.log('⏹️ Trailing stop monitoring ended');
    }, 3600000);

  } catch (error) {
    console.error('Error setting trailing stop:', error);
    throw error;
  }
}

/**
 * Batch update multiple positions with TP/SL
 */
export async function batchUpdatePositions(
  updates: Array<{
    positionId: string;
    stopLoss?: string;
    takeProfit?: string;
  }>
) {
  const trader = new TraderClient(config.network);
  
  try {
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    console.log(`\n🔄 Updating ${updates.length} positions...`);
    
    const results = [];
    for (const update of updates) {
      try {
        const result = await trader.updatePosition(update);
        results.push({
          positionId: update.positionId,
          success: result.success,
          error: result.error,
        });
        
        if (result.success) {
          console.log(`✅ Position ${update.positionId} updated`);
        } else {
          console.log(`❌ Position ${update.positionId} failed: ${result.error}`);
        }
      } catch (error: any) {
        results.push({
          positionId: update.positionId,
          success: false,
          error: error.message,
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Batch Update Summary:`);
    console.log(`- Successful: ${successful}`);
    console.log(`- Failed: ${failed}`);
    
    return results;
    
  } catch (error) {
    console.error('Error in batch update:', error);
    throw error;
  } finally {
    trader.disconnect();
  }
}

/**
 * Set TP/SL based on risk/reward ratio
 */
export async function setRiskRewardTPSL(
  positionId: string,
  riskPercent: number = 2,    // Risk 2% of position
  rewardRatio: number = 3      // 1:3 risk/reward ratio
) {
  const trader = new TraderClient(config.network);
  
  try {
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    const position = await trader.getPosition(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const entryPrice = position.entryPrice;
    
    // Calculate stop loss and take profit based on risk/reward
    let stopLoss: Decimal;
    let takeProfit: Decimal;
    
    if (position.side === PositionSide.LONG) {
      stopLoss = entryPrice.mul(1 - riskPercent / 100);
      takeProfit = entryPrice.mul(1 + (riskPercent * rewardRatio) / 100);
    } else {
      stopLoss = entryPrice.mul(1 + riskPercent / 100);
      takeProfit = entryPrice.mul(1 - (riskPercent * rewardRatio) / 100);
    }

    console.log(`\n📊 Setting Risk/Reward TP/SL for Position ${positionId}`);
    console.log(`- Risk: ${riskPercent}%`);
    console.log(`- Reward Ratio: 1:${rewardRatio}`);
    console.log(`- Entry Price: ${formatPrice(entryPrice)}`);
    console.log(`- Stop Loss: ${formatPrice(stopLoss)} (${riskPercent}% risk)`);
    console.log(`- Take Profit: ${formatPrice(takeProfit)} (${riskPercent * rewardRatio}% reward)`);

    const result = await trader.updatePosition({
      positionId,
      stopLoss,
      takeProfit,
    });

    if (result.success) {
      console.log('✅ Risk/Reward TP/SL set successfully!');
      
      // Calculate potential outcomes
      const riskAmount = position.collateral.mul(riskPercent / 100);
      const rewardAmount = position.collateral.mul((riskPercent * rewardRatio) / 100);
      
      console.log(`\n💰 Potential Outcomes:`);
      console.log(`- Max Loss: ${formatUSDC(riskAmount)}`);
      console.log(`- Max Profit: ${formatUSDC(rewardAmount)}`);
    } else {
      console.error('Failed to set TP/SL:', result.error);
    }

  } catch (error) {
    console.error('Error setting risk/reward TP/SL:', error);
    throw error;
  } finally {
    trader.disconnect();
  }
}

/**
 * Remove TP/SL from a position
 */
export async function removeTPSL(
  positionId: string,
  removeSL: boolean = false,
  removeTP: boolean = false
) {
  const trader = new TraderClient(config.network);
  
  try {
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    const position = await trader.getPosition(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    console.log(`\n🔄 Removing TP/SL from Position ${positionId}`);
    
    const result = await trader.updatePosition({
      positionId,
      stopLoss: removeSL ? null : position.stopLoss,
      takeProfit: removeTP ? null : position.takeProfit,
    });

    if (result.success) {
      console.log('✅ TP/SL removed successfully!');
      if (removeSL) console.log('- Stop Loss removed');
      if (removeTP) console.log('- Take Profit removed');
    } else {
      console.error('Failed to remove TP/SL:', result.error);
    }

  } catch (error) {
    console.error('Error removing TP/SL:', error);
    throw error;
  } finally {
    trader.disconnect();
  }
}

// Example usage
if (require.main === module) {
  // Example 1: Update specific position with new TP/SL
  updatePositionTPSL('position-123', '2850', '3300')
    .then(() => console.log('\n✅ Example 1 completed'))
    .catch(console.error);

  // Example 2: Add trailing stop loss
  // addTrailingStopLoss('position-456', 3)
  //   .then(() => console.log('\n✅ Example 2 completed'))
  //   .catch(console.error);

  // Example 3: Set risk/reward based TP/SL
  // setRiskRewardTPSL('position-789', 2, 3)
  //   .then(() => console.log('\n✅ Example 3 completed'))
  //   .catch(console.error);
}