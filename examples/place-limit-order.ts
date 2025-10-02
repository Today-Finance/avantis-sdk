/**
 * Example: Place a Limit Order on Avantis
 * 
 * This example demonstrates how to:
 * 1. Place a limit order
 * 2. Update the limit order
 * 3. Cancel the limit order
 */

import { 
  TraderClient, 
  OrderType, 
  PositionSide,
  formatUSDC,
  formatPrice
} from '../src';
import Decimal from 'decimal.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function placeLimitOrderExample() {
  // Initialize client
  const trader = new TraderClient('base');
  
  // Set up signer with private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }
  
  await trader.setSigner({ 
    type: 'privateKey', 
    privateKey 
  });
  
  console.log('Avantis Limit Order Example');
  console.log('===========================\n');

  try {
    // Get account info
    const address = await trader.getAddress();
    console.log(`Trading Account: ${address}`);
    
    // Check USDC balance
    const usdcBalance = await trader.getUSDCBalance();
    console.log(`USDC Balance: ${formatUSDC(usdcBalance)}\n`);
    
    // Example parameters
    const positionSize = 100; // $100 position
    const leverage = 10; // 10x leverage
    const collateral = positionSize / leverage; // $10 collateral
    
    if (usdcBalance.lt(collateral)) {
      throw new Error(`Insufficient USDC balance. Need ${formatUSDC(collateral)}, have ${formatUSDC(usdcBalance)}`);
    }
    
    // Check and approve USDC if needed
    const allowance = await trader.getTradingAllowance();
    if (allowance.lt(collateral)) {
      console.log('Approving USDC for trading...');
      const approveResult = await trader.approveUSDCForTrading();
      console.log(`Approval TX: ${approveResult.transactionHash}\n`);
    }

    // Get pair index for ETH/USD
    const pairIndex = trader.getPairIndex('ETH/USD');
    console.log(`ETH/USD pair index: ${pairIndex}`);
    
    // Place a LIMIT order below current market price
    // For this example, we'll place a buy limit at $3000 (assuming ETH is above this)
    const limitPrice = new Decimal(3000);
    
    console.log('\n1. PLACING LIMIT ORDER');
    console.log('======================');
    console.log(`- Pair: ETH/USD`);
    console.log(`- Side: LONG`);
    console.log(`- Size: $${positionSize}`);
    console.log(`- Leverage: ${leverage}x`);
    console.log(`- Limit Price: ${formatPrice(limitPrice)}`);
    console.log(`- Stop Loss: ${formatPrice(limitPrice.mul(0.95))}`);
    console.log(`- Take Profit: ${formatPrice(limitPrice.mul(1.1))}\n`);

    const limitOrderResult = await trader.openPosition({
      pair: 'ETH/USD',
      side: PositionSide.LONG,
      size: positionSize,
      leverage: leverage,
      orderType: OrderType.LIMIT,
      openPrice: limitPrice,
      stopLoss: limitPrice.mul(0.95), // 5% stop loss from entry
      takeProfit: limitPrice.mul(1.1), // 10% take profit from entry
      slippage: 0.5 // 0.5% slippage tolerance
    });

    if (limitOrderResult.success) {
      console.log(`✅ Limit order placed successfully!`);
      console.log(`TX Hash: ${limitOrderResult.transactionHash}\n`);
      
      // For demonstration, let's assume the order index is 0
      // In production, you would parse this from the event logs
      const orderIndex = 0;
      
      // Wait a bit before updating
      console.log('Waiting 5 seconds before updating the order...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 2. UPDATE LIMIT ORDER
      console.log('2. UPDATING LIMIT ORDER');
      console.log('=======================');
      const newPrice = new Decimal(2950); // Lower the limit price
      console.log(`- New Price: ${formatPrice(newPrice)}`);
      console.log(`- New Take Profit: ${formatPrice(newPrice.mul(1.15))}\n`);
      
      const updateResult = await trader.updateLimitOrder({
        pairIndex: pairIndex,
        orderIndex: orderIndex,
        price: newPrice,
        takeProfit: newPrice.mul(1.15), // Update TP to 15% from new entry
        slippage: 0.5
      });
      
      if (updateResult.success) {
        console.log(`✅ Limit order updated successfully!`);
        console.log(`TX Hash: ${updateResult.transactionHash}\n`);
      }
      
      // Wait a bit before canceling
      console.log('Waiting 5 seconds before canceling the order...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 3. CANCEL LIMIT ORDER
      console.log('3. CANCELING LIMIT ORDER');
      console.log('========================');
      
      const cancelResult = await trader.cancelLimitOrder({
        pairIndex: pairIndex,
        orderIndex: orderIndex
      });
      
      if (cancelResult.success) {
        console.log(`✅ Limit order canceled successfully!`);
        console.log(`TX Hash: ${cancelResult.transactionHash}`);
        console.log('Collateral has been returned to your account.');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    trader.disconnect();
  }
}

// Run the example
placeLimitOrderExample().catch(console.error);