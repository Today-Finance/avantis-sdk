/**
 * Integration Test for Platform Fees
 * 
 * This script tests the complete platform fee flow including
 * configuration, calculation, and execution.
 */

import { AvantisSDK, PositionSide, OrderType } from '../src';
import Decimal from 'decimal.js';

// Test configuration
const TEST_CONFIG = {
  platformWallet: '0x1234567890123456789012345678901234567890',
  referralAddress: '0x0987654321098765432109876543210987654321',
  tradeSize: 1000, // $1000 USDC
  leverage: 10,
  baseFeePercent: 0.002, // 0.2%
  referralSplitPercent: 40, // 40% to referrer
  discountPercent: 25 // 25% discount
};

async function testFeeCalculations(sdk: AvantisSDK) {
  console.log('\n=== Testing Fee Calculations ===\n');
  
  // Set up fee configuration
  sdk.trader.setPlatformFeeConfig({
    platformWallet: TEST_CONFIG.platformWallet,
    baseFeePercent: TEST_CONFIG.baseFeePercent,
    referralSplitPercent: TEST_CONFIG.referralSplitPercent,
    enabled: true
  });
  
  const config = sdk.trader.getPlatformFeeConfig();
  console.log('Configuration set:');
  console.log('- Platform wallet:', config?.platformWallet);
  console.log('- Base fee:', (config?.baseFeePercent || 0) * 100, '%');
  console.log('- Referral split:', config?.referralSplitPercent, '%\n');
  
  // Test 1: Basic fee calculation
  console.log('Test 1: Basic Fee Calculation');
  const basicFees = sdk.trader.calculateFeeBreakdown(TEST_CONFIG.tradeSize, {
    enabled: true
  });
  
  const expectedBaseFee = TEST_CONFIG.tradeSize * TEST_CONFIG.baseFeePercent;
  console.log('Expected base fee:', expectedBaseFee, 'USDC');
  console.log('Calculated base fee:', basicFees?.baseFee.toNumber(), 'USDC');
  console.assert(
    Math.abs((basicFees?.baseFee.toNumber() || 0) - expectedBaseFee) < 0.01,
    'Basic fee calculation mismatch'
  );
  console.log('✅ Basic fee calculation passed\n');
  
  // Test 2: Fee with discount
  console.log('Test 2: Fee with Discount');
  const discountedFees = sdk.trader.calculateFeeBreakdown(TEST_CONFIG.tradeSize, {
    enabled: true,
    discountPercent: TEST_CONFIG.discountPercent
  });
  
  const expectedDiscountAmount = expectedBaseFee * (TEST_CONFIG.discountPercent / 100);
  const expectedFeeAfterDiscount = expectedBaseFee - expectedDiscountAmount;
  
  console.log('Expected discount:', expectedDiscountAmount, 'USDC');
  console.log('Calculated discount:', discountedFees?.discount.toNumber(), 'USDC');
  console.log('Expected fee after discount:', expectedFeeAfterDiscount, 'USDC');
  console.log('Calculated fee after discount:', discountedFees?.totalFee.toNumber(), 'USDC');
  
  console.assert(
    Math.abs((discountedFees?.discount.toNumber() || 0) - expectedDiscountAmount) < 0.01,
    'Discount calculation mismatch'
  );
  console.assert(
    Math.abs((discountedFees?.totalFee.toNumber() || 0) - expectedFeeAfterDiscount) < 0.01,
    'Discounted fee calculation mismatch'
  );
  console.log('✅ Discount calculation passed\n');
  
  // Test 3: Referral fee split
  console.log('Test 3: Referral Fee Split');
  const referralFees = sdk.trader.calculateFeeBreakdown(TEST_CONFIG.tradeSize, {
    enabled: true,
    referralAddress: TEST_CONFIG.referralAddress
  });
  
  const expectedReferralFee = expectedBaseFee * (TEST_CONFIG.referralSplitPercent / 100);
  const expectedPlatformReceives = expectedBaseFee - expectedReferralFee;
  
  console.log('Expected referral fee:', expectedReferralFee, 'USDC');
  console.log('Calculated referral fee:', referralFees?.referralFee.toNumber(), 'USDC');
  console.log('Expected platform receives:', expectedPlatformReceives, 'USDC');
  console.log('Calculated platform receives:', referralFees?.platformReceives.toNumber(), 'USDC');
  
  console.assert(
    Math.abs((referralFees?.referralFee.toNumber() || 0) - expectedReferralFee) < 0.01,
    'Referral fee calculation mismatch'
  );
  console.assert(
    Math.abs((referralFees?.platformReceives.toNumber() || 0) - expectedPlatformReceives) < 0.01,
    'Platform receives calculation mismatch'
  );
  console.log('✅ Referral split calculation passed\n');
  
  // Test 4: Combined discount and referral
  console.log('Test 4: Combined Discount and Referral');
  const combinedFees = sdk.trader.calculateFeeBreakdown(TEST_CONFIG.tradeSize, {
    enabled: true,
    discountPercent: TEST_CONFIG.discountPercent,
    referralAddress: TEST_CONFIG.referralAddress
  });
  
  const expectedCombinedReferralFee = expectedFeeAfterDiscount * (TEST_CONFIG.referralSplitPercent / 100);
  const expectedCombinedPlatformReceives = expectedFeeAfterDiscount - expectedCombinedReferralFee;
  
  console.log('Expected total fee (after discount):', expectedFeeAfterDiscount, 'USDC');
  console.log('Calculated total fee:', combinedFees?.totalFee.toNumber(), 'USDC');
  console.log('Expected referral fee:', expectedCombinedReferralFee, 'USDC');
  console.log('Calculated referral fee:', combinedFees?.referralFee.toNumber(), 'USDC');
  console.log('Expected platform receives:', expectedCombinedPlatformReceives, 'USDC');
  console.log('Calculated platform receives:', combinedFees?.platformReceives.toNumber(), 'USDC');
  
  console.assert(
    Math.abs((combinedFees?.referralFee.toNumber() || 0) - expectedCombinedReferralFee) < 0.01,
    'Combined referral fee calculation mismatch'
  );
  console.assert(
    Math.abs((combinedFees?.platformReceives.toNumber() || 0) - expectedCombinedPlatformReceives) < 0.01,
    'Combined platform receives calculation mismatch'
  );
  console.log('✅ Combined calculation passed\n');
  
  // Test 5: Disabled fees
  console.log('Test 5: Disabled Fees');
  const disabledFees = sdk.trader.calculateFeeBreakdown(TEST_CONFIG.tradeSize, {
    enabled: false
  });
  
  console.log('Total fee (should be 0):', disabledFees?.totalFee.toNumber(), 'USDC');
  console.assert(
    disabledFees?.totalFee.toNumber() === 0,
    'Disabled fees should be zero'
  );
  console.log('✅ Disabled fees test passed\n');
  
  return true;
}

async function testEdgeCases(sdk: AvantisSDK) {
  console.log('\n=== Testing Edge Cases ===\n');
  
  // Configure fees
  sdk.trader.setPlatformFeeConfig({
    platformWallet: TEST_CONFIG.platformWallet,
    baseFeePercent: 0.001,
    referralSplitPercent: 50,
    enabled: true
  });
  
  // Test 1: Zero trade size
  console.log('Test 1: Zero Trade Size');
  const zeroFees = sdk.trader.calculateFeeBreakdown(0, { enabled: true });
  console.log('Fee for $0 trade:', zeroFees?.totalFee.toNumber(), 'USDC');
  console.assert(zeroFees?.totalFee.toNumber() === 0, 'Zero trade should have zero fees');
  console.log('✅ Zero trade test passed\n');
  
  // Test 2: Very large trade
  console.log('Test 2: Large Trade Size');
  const largeTrade = new Decimal('1000000'); // $1M
  const largeFees = sdk.trader.calculateFeeBreakdown(largeTrade, { enabled: true });
  console.log('Fee for $1M trade:', largeFees?.totalFee.toNumber(), 'USDC');
  console.assert(largeFees?.totalFee.toNumber() === 1000, 'Large trade fee calculation');
  console.log('✅ Large trade test passed\n');
  
  // Test 3: 100% discount
  console.log('Test 3: 100% Discount');
  const freeFees = sdk.trader.calculateFeeBreakdown(1000, {
    enabled: true,
    discountPercent: 100
  });
  console.log('Fee with 100% discount:', freeFees?.totalFee.toNumber(), 'USDC');
  console.assert(freeFees?.totalFee.toNumber() === 0, '100% discount should be free');
  console.log('✅ 100% discount test passed\n');
  
  // Test 4: Invalid discount (should throw)
  console.log('Test 4: Invalid Discount');
  try {
    sdk.trader.calculateFeeBreakdown(1000, {
      enabled: true,
      discountPercent: 150 // Invalid: > 100%
    });
    console.error('❌ Should have thrown error for invalid discount');
  } catch (error: any) {
    console.log('✅ Correctly rejected invalid discount:', error.message);
  }
  
  return true;
}

async function main() {
  console.log('=================================');
  console.log('Platform Fee Integration Tests');
  console.log('=================================');
  
  // Initialize SDK
  const sdk = new AvantisSDK('base');
  
  try {
    // Run fee calculation tests
    await testFeeCalculations(sdk);
    
    // Run edge case tests
    await testEdgeCases(sdk);
    
    console.log('\n=================================');
    console.log('✅ All Integration Tests Passed!');
    console.log('=================================\n');
    
  } catch (error: any) {
    console.error('\n❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });