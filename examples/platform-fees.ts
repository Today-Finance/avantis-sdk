/**
 * Platform Fee Trading Examples
 * 
 * This example demonstrates how to use the Avantis SDK with platform fees,
 * including fee configuration, discount application, and referral fee splitting.
 */

import { AvantisSDK, PositionSide, OrderType } from '../src';
import { ethers } from 'ethers';
import Decimal from 'decimal.js';

async function main() {
  // Initialize SDK
  const sdk = new AvantisSDK('base');
  
  // Set up signer (using private key for example)
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY environment variable');
  }
  
  await sdk.setSigner({
    type: 'private-key',
    key: privateKey
  });
  
  const address = await sdk.trader.getAddress();
  console.log('Connected wallet:', address);

  // ============================================
  // 1. Configure Platform Fees
  // ============================================
  
  // Set up platform fee configuration
  sdk.trader.setPlatformFeeConfig({
    platformWallet: '0xYourPlatformWallet', // Replace with your platform wallet
    baseFeePercent: 0.001, // 0.1% platform fee
    referralSplitPercent: 30, // 30% of fees go to referrers
    enabled: true
  });
  
  console.log('\nPlatform fee configuration set:');
  const feeConfig = sdk.trader.getPlatformFeeConfig();
  console.log('- Platform wallet:', feeConfig?.platformWallet);
  console.log('- Base fee:', (feeConfig?.baseFeePercent || 0) * 100, '%');
  console.log('- Referral split:', feeConfig?.referralSplitPercent, '%');
  
  // ============================================
  // 2. Calculate Fee Breakdown
  // ============================================
  
  const tradeSize = new Decimal(1000); // $1000 trade
  
  // Calculate fees without discount
  console.log('\n=== Fee Breakdown (No Discount) ===');
  const standardFees = sdk.trader.calculateFeeBreakdown(tradeSize);
  console.log('Base fee:', standardFees?.baseFee.toFixed(2), 'USDC');
  console.log('Total fee:', standardFees?.totalFee.toFixed(2), 'USDC');
  console.log('Platform receives:', standardFees?.platformReceives.toFixed(2), 'USDC');
  
  // Calculate fees with discount
  console.log('\n=== Fee Breakdown (20% Discount) ===');
  const discountedFees = sdk.trader.calculateFeeBreakdown(tradeSize, {
    enabled: true,
    discountPercent: 20 // 20% discount
  });
  console.log('Base fee:', discountedFees?.baseFee.toFixed(2), 'USDC');
  console.log('Discount:', discountedFees?.discount.toFixed(2), 'USDC');
  console.log('Total fee:', discountedFees?.totalFee.toFixed(2), 'USDC');
  console.log('Platform receives:', discountedFees?.platformReceives.toFixed(2), 'USDC');
  
  // Calculate fees with referral
  console.log('\n=== Fee Breakdown (With Referral) ===');
  const referralFees = sdk.trader.calculateFeeBreakdown(tradeSize, {
    enabled: true,
    referralAddress: '0xReferrerAddress'
  });
  console.log('Base fee:', referralFees?.baseFee.toFixed(2), 'USDC');
  console.log('Platform receives:', referralFees?.platformReceives.toFixed(2), 'USDC');
  console.log('Referral receives:', referralFees?.referralFee.toFixed(2), 'USDC');
  console.log('Total fee:', referralFees?.totalFee.toFixed(2), 'USDC');
  
  // ============================================
  // 3. Open Position with Platform Fees
  // ============================================
  
  console.log('\n=== Opening Position with Platform Fees ===');
  
  // Check balances
  const accountInfo = await sdk.trader.getAccountInfo();
  console.log('USDC Balance:', accountInfo.usdcBalance.toFixed(2));
  
  // Ensure sufficient USDC approval
  console.log('\nApproving USDC for trading...');
  await sdk.trader.approveUSDCForTrading('10000'); // Approve $10,000 USDC
  
  // Open a position with platform fees
  const openPositionParams = {
    pair: 'ETH-USD',
    side: PositionSide.LONG,
    size: 1000, // $1000 position
    leverage: 10,
    orderType: OrderType.MARKET,
    stopLoss: 3000, // SL at $3000
    takeProfit: 4000, // TP at $4000
    slippage: 0.5,
    
    // Platform fee configuration for this trade
    platformFee: {
      enabled: true,
      discountPercent: 10, // 10% discount for this user
      referralAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4' // Example referral address
    }
  };
  
  try {
    console.log('\nExecuting trade with platform fees...');
    console.log('Position size:', openPositionParams.size, 'USDC');
    console.log('Leverage:', openPositionParams.leverage, 'x');
    console.log('Collateral required:', openPositionParams.size / openPositionParams.leverage, 'USDC');
    
    // Calculate and display fees for this trade
    const tradeFees = sdk.trader.calculateFeeBreakdown(
      openPositionParams.size,
      openPositionParams.platformFee
    );
    console.log('\nFees for this trade:');
    console.log('- Platform fee:', tradeFees?.platformReceives.toFixed(4), 'USDC');
    console.log('- Referral fee:', tradeFees?.referralFee.toFixed(4), 'USDC');
    console.log('- Total fee:', tradeFees?.totalFee.toFixed(4), 'USDC');
    console.log('- Total required:', 
      (openPositionParams.size / openPositionParams.leverage + (tradeFees?.totalFee.toNumber() || 0)).toFixed(4), 
      'USDC'
    );
    
    const result = await sdk.trader.openPositionWithFees(openPositionParams);
    
    console.log('\n✅ Position opened successfully!');
    console.log('Transaction hash:', result.transactionHash);
    console.log('Gas used:', result.gasUsed.toString());
    
  } catch (error: any) {
    console.error('\n❌ Failed to open position:', error.message);
  }
  
  // ============================================
  // 4. Close Position with Platform Fees
  // ============================================
  
  console.log('\n=== Closing Position with Platform Fees ===');
  
  // Get open positions
  const positions = await sdk.trader.getPositions();
  if (positions.length > 0) {
    const position = positions[0];
    console.log('\nClosing position:', position.id);
    console.log('Current size:', position.size.toFixed(2), 'USDC');
    console.log('Unrealized PnL:', position.unrealizedPnl.toFixed(2), 'USDC');
    
    const closePositionParams = {
      positionId: position.id,
      // Optional: close partial position
      // size: position.size.div(2), // Close half
      
      // Platform fee configuration for closing
      platformFee: {
        enabled: true,
        discountPercent: 15, // 15% discount
        referralAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
      }
    };
    
    try {
      console.log('\nClosing position with platform fees...');
      
      // Note: Fees on close are typically calculated on PnL or returned collateral
      // This is a simplified example
      const closeFees = sdk.trader.calculateFeeBreakdown(
        position.size,
        closePositionParams.platformFee
      );
      console.log('\nEstimated fees on close:');
      console.log('- Platform fee:', closeFees?.platformReceives.toFixed(4), 'USDC');
      console.log('- Referral fee:', closeFees?.referralFee.toFixed(4), 'USDC');
      console.log('- Total fee:', closeFees?.totalFee.toFixed(4), 'USDC');
      
      const closeResult = await sdk.trader.closePositionWithFees(closePositionParams);
      
      console.log('\n✅ Position closed successfully!');
      console.log('Transaction hash:', closeResult.transactionHash);
      console.log('Gas used:', closeResult.gasUsed.toString());
      
    } catch (error: any) {
      console.error('\n❌ Failed to close position:', error.message);
    }
  } else {
    console.log('No open positions to close');
  }
  
  // ============================================
  // 5. Different Fee Scenarios
  // ============================================
  
  console.log('\n=== Fee Scenarios ===');
  
  // Scenario 1: VIP trader with high discount
  console.log('\n1. VIP Trader (50% discount):');
  const vipFees = sdk.trader.calculateFeeBreakdown(5000, {
    enabled: true,
    discountPercent: 50
  });
  console.log('   Trade size: $5000');
  console.log('   Platform fee: $', vipFees?.totalFee.toFixed(2));
  
  // Scenario 2: Referred trader
  console.log('\n2. Referred Trader:');
  const referredFees = sdk.trader.calculateFeeBreakdown(2000, {
    enabled: true,
    referralAddress: '0xReferrer',
    discountPercent: 10
  });
  console.log('   Trade size: $2000');
  console.log('   Platform gets: $', referredFees?.platformReceives.toFixed(2));
  console.log('   Referrer gets: $', referredFees?.referralFee.toFixed(2));
  
  // Scenario 3: Regular trader
  console.log('\n3. Regular Trader:');
  const regularFees = sdk.trader.calculateFeeBreakdown(1000, {
    enabled: true
  });
  console.log('   Trade size: $1000');
  console.log('   Platform fee: $', regularFees?.totalFee.toFixed(2));
  
  // ============================================
  // 6. Disable Fees for Specific Trades
  // ============================================
  
  console.log('\n=== Trading Without Fees ===');
  
  // Even with global fees configured, you can disable for specific trades
  const noFeeParams = {
    pair: 'BTC-USD',
    side: PositionSide.SHORT,
    size: 500,
    leverage: 5,
    platformFee: {
      enabled: false // Disable fees for this trade
    }
  };
  
  console.log('\nTrade without platform fees:');
  const noFees = sdk.trader.calculateFeeBreakdown(noFeeParams.size, noFeeParams.platformFee);
  console.log('Platform fee:', noFees?.totalFee.toFixed(2), 'USDC (should be 0)');
  
  // ============================================
  // 7. Monitor Fee Events
  // ============================================
  
  console.log('\n=== Monitoring Fee Events ===');
  
  // Listen for fee-related events
  sdk.trader.on('platformFeeConfigSet', (config) => {
    console.log('Platform fee config updated:', config);
  });
  
  sdk.trader.on('positionOpenedWithFees', (event) => {
    console.log('Position opened with fees:');
    console.log('- Transaction:', event.transactionHash);
    console.log('- Platform fee:', event.feeBreakdown.platformReceives.toFixed(4), 'USDC');
    console.log('- Bundled operations:', event.bundledOperations.join(', '));
  });
  
  sdk.trader.on('positionClosedWithFees', (event) => {
    console.log('Position closed with fees:');
    console.log('- Position ID:', event.positionId);
    console.log('- Transaction:', event.transactionHash);
    console.log('- Platform fee:', event.feeBreakdown.platformReceives.toFixed(4), 'USDC');
  });
}

// Run the example
main()
  .then(() => {
    console.log('\n✅ Platform fee examples completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });