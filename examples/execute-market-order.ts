/**
 * Example: Executing a Market Order Trade on ETH Market
 * This example shows how to use the Avantis SDK in a React Native/Expo app
 */

import { TraderClient, FeedClient, PositionSide, formatUSDC, formatPrice } from '@todayapp/avantis-sdk';
import { Wallet } from 'ethers';
import Decimal from 'decimal.js';

// Configuration
const config = {
  network: 'base' as const, // or 'base-sepolia' for testnet
  privateKey: process.env.PRIVATE_KEY || '', // Store securely in env vars
  rpcUrl: process.env.RPC_URL, // Optional: custom RPC URL
};

/**
 * Execute a market order trade on ETH/USD
 */
export async function executeMarketOrder() {
  // Initialize clients
  const trader = new TraderClient(config.network, config.rpcUrl);
  const feed = new FeedClient({ network: config.network });

  try {
    // Connect wallet
    await trader.setSigner({
      type: 'privateKey',
      privateKey: config.privateKey,
    });

    const address = await trader.getAddress();
    console.log(`Connected wallet: ${address}`);

    // Check account balances
    const usdcBalance = await trader.getUSDCBalance();
    console.log(`USDC Balance: ${formatUSDC(usdcBalance)}`);

    // Get current ETH price
    const priceData = await feed.getLatestPrice('ETH/USD');
    console.log(`Current ETH Price: ${formatPrice(priceData.price)}`);

    // Calculate position parameters
    const positionSize = new Decimal('100'); // $100 position
    const leverage = 10; // 10x leverage
    const collateral = positionSize.div(leverage); // $10 collateral needed

    // Check if we have enough balance
    if (usdcBalance.lt(collateral)) {
      throw new Error(`Insufficient USDC balance. Need ${formatUSDC(collateral)}, have ${formatUSDC(usdcBalance)}`);
    }

    // Check and approve USDC if needed
    const allowance = await trader.getTradingAllowance();
    if (allowance.lt(collateral)) {
      console.log('Approving USDC for trading...');
      const approveResult = await trader.approveUSDCForTrading();
      console.log(`Approval TX: ${approveResult.transactionHash}`);
    }

    // Get pair index (useful for direct contract interactions)
    const ethPairIndex = trader.getPairIndex('ETH/USD');
    console.log(`\nETH/USD pair index: ${ethPairIndex}`);
    
    // Open a long position on ETH
    console.log('\nOpening ETH/USD Long Position:');
    console.log(`- Size: $${positionSize}`);
    console.log(`- Leverage: ${leverage}x`);
    console.log(`- Collateral: $${collateral}`);
    console.log(`- Entry Price: ${formatPrice(priceData.price)}`);

    const result = await trader.openPosition({
      pair: 'ETH/USD',
      side: PositionSide.LONG,
      size: positionSize,
      leverage: leverage,
      stopLoss: priceData.price.mul(0.95), // 5% stop loss
      takeProfit: priceData.price.mul(1.1), // 10% take profit
      slippage: 0.5, // 0.5% slippage tolerance
    });

    if (result.success) {
      console.log(`\n✅ Position opened successfully!`);
      console.log(`Transaction Hash: ${result.transactionHash}`);
      console.log(`Gas Used: ${result.gasUsed.toString()}`);

      if (result.position) {
        console.log(`\nPosition Details:`);
        console.log(`- Position ID: ${result.position.id}`);
        console.log(`- Entry Price: ${formatPrice(result.position.entryPrice)}`);
        console.log(`- Size: ${formatUSDC(result.position.size)}`);
        console.log(`- Collateral: ${formatUSDC(result.position.collateral)}`);
        console.log(`- Liquidation Price: ${formatPrice(result.position.liquidationPrice)}`);
        console.log(`- Stop Loss: ${formatPrice(result.position.stopLoss || 0)}`);
        console.log(`- Take Profit: ${formatPrice(result.position.takeProfit || 0)}`);
      }
    } else {
      console.error('Failed to open position:', result.error);
    }

    // Get all positions for the account
    const positions = await trader.getPositions();
    console.log(`\nTotal Open Positions: ${positions.length}`);

    // Disconnect when done
    trader.disconnect();
    feed.disconnect();
  } catch (error) {
    console.error('Error executing market order:', error);
    throw error;
  }
}

/**
 * Example: Monitor position with real-time price updates
 */
export async function monitorPosition(positionId: string) {
  const trader = new TraderClient(config.network);
  const feed = new FeedClient({ network: config.network });

  await trader.setSigner({
    type: 'privateKey',
    privateKey: config.privateKey,
  });

  // Get position details
  const position = await trader.getPosition(positionId);
  if (!position) {
    throw new Error('Position not found');
  }

  console.log(`Monitoring position ${positionId} on ${position.pair}`);

  // Subscribe to price updates
  const unsubscribe = feed.subscribeToPrice(position.pair, (priceData) => {
    const pnl = position.side === PositionSide.LONG
      ? priceData.price.sub(position.entryPrice).mul(position.size).div(position.entryPrice)
      : position.entryPrice.sub(priceData.price).mul(position.size).div(position.entryPrice);

    console.log(`Price: ${formatPrice(priceData.price)} | PnL: ${formatUSDC(pnl)}`);

    // Check if we should close the position
    if (position.stopLoss && priceData.price.lte(position.stopLoss)) {
      console.log('Stop loss hit! Consider closing position.');
    }
    if (position.takeProfit && priceData.price.gte(position.takeProfit)) {
      console.log('Take profit hit! Consider closing position.');
    }
  });

  // Monitor for 60 seconds then cleanup
  setTimeout(() => {
    unsubscribe();
    trader.disconnect();
    feed.disconnect();
    console.log('Monitoring stopped');
  }, 60000);
}

/**
 * Example: Close a position
 */
export async function closePosition(positionId: string, partialSize?: string) {
  const trader = new TraderClient(config.network);

  await trader.setSigner({
    type: 'privateKey',
    privateKey: config.privateKey,
  });

  console.log(`Closing position ${positionId}...`);

  const result = await trader.closePosition({
    positionId,
    size: partialSize, // Optional: close partial position
    slippage: 0.5,
  });

  if (result.success) {
    console.log(`✅ Position closed successfully!`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Gas Used: ${result.gasUsed.toString()}`);
  } else {
    console.error('Failed to close position:', result.error);
  }

  trader.disconnect();
}

// Run the example
if (require.main === module) {
  executeMarketOrder()
    .then(() => console.log('Example completed'))
    .catch(console.error);
}