/**
 * Test script for new transaction preparation methods
 * Tests that the SDK can prepare transactions without executing them
 */

import { AvantisSDK, PositionSide, OrderType } from './dist/index.mjs';

async function testPrepareApprove() {
  console.log('\n=== Testing prepareApproveTransaction ===');

  try {
    const sdk = new AvantisSDK('base'); // Use mainnet (has deployed contracts)

    // Set a dummy signer (just for testing - we won't actually send)
    await sdk.setSigner({
      type: 'privateKey',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001', // Dummy key
    });

    const txData = await sdk.trader.prepareApproveTransaction(1000);

    console.log('✅ Approve transaction prepared:');
    console.log('  To:', txData.to);
    console.log('  Data:', txData.data.substring(0, 66) + '...');
    console.log('  Value:', txData.value);
    console.log('  Data length:', txData.data.length, 'characters');

    // Validate structure
    if (!txData.to || !txData.data || txData.value !== '0') {
      throw new Error('Invalid transaction data structure');
    }

    // Check that data is encoded function call
    if (!txData.data.startsWith('0x095ea7b3')) { // approve function selector
      throw new Error('Invalid approve function selector');
    }

    console.log('✅ All validations passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testPrepareOpenPosition() {
  console.log('\n=== Testing prepareOpenPositionTransaction ===');

  try {
    const sdk = new AvantisSDK('base'); // Use mainnet (has deployed contracts)

    // Set a dummy signer
    await sdk.setSigner({
      type: 'privateKey',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });

    console.log('Preparing open position transaction...');
    const txData = await sdk.trader.prepareOpenPositionTransaction({
      pair: 'ETH/USD',
      side: PositionSide.LONG,
      size: 100, // $100 position
      leverage: 10,
      orderType: OrderType.MARKET,
      slippage: 1,
    });

    console.log('✅ Open position transaction prepared:');
    console.log('  To:', txData.to);
    console.log('  Data:', txData.data.substring(0, 66) + '...');
    console.log('  Value:', txData.value);
    console.log('  Data length:', txData.data.length, 'characters');

    // Validate structure
    if (!txData.to || !txData.data || txData.value !== '0') {
      throw new Error('Invalid transaction data structure');
    }

    // Check that data is encoded function call
    if (!txData.data.startsWith('0x')) {
      throw new Error('Invalid function data encoding');
    }

    console.log('✅ All validations passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function testPrepareClosePosition() {
  console.log('\n=== Testing prepareClosePositionTransaction ===');

  try {
    const sdk = new AvantisSDK('base-sepolia');

    await sdk.setSigner({
      type: 'privateKey',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });

    const txData = await sdk.trader.prepareClosePositionTransaction({
      positionId: '0-0', // pairIndex-positionIndex
    });

    console.log('✅ Close position transaction prepared:');
    console.log('  To:', txData.to);
    console.log('  Data:', txData.data.substring(0, 66) + '...');
    console.log('  Value:', txData.value);
    console.log('  Data length:', txData.data.length, 'characters');

    // Validate structure
    if (!txData.to || !txData.data || txData.value !== '0') {
      throw new Error('Invalid transaction data structure');
    }

    console.log('✅ All validations passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testPrepareUpdatePosition() {
  console.log('\n=== Testing prepareUpdatePositionTransaction ===');

  try {
    const sdk = new AvantisSDK('base-sepolia');

    await sdk.setSigner({
      type: 'privateKey',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });

    const txData = await sdk.trader.prepareUpdatePositionTransaction({
      positionId: '0-0',
      takeProfit: 2000,
      stopLoss: 1500,
      autofetchPrices: false, // Skip price fetching for test
      priceUpdateData: [], // Empty array for test
    });

    console.log('✅ Update position transaction prepared:');
    console.log('  To:', txData.to);
    console.log('  Data:', txData.data.substring(0, 66) + '...');
    console.log('  Value:', txData.value);
    console.log('  Data length:', txData.data.length, 'characters');

    // Validate structure
    if (!txData.to || !txData.data || txData.value !== '0') {
      throw new Error('Invalid transaction data structure');
    }

    console.log('✅ All validations passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Avantis SDK Transaction Preparation Tests');
  console.log('==================================================');

  const results = {
    approve: false,
    openPosition: false,
    closePosition: false,
    updatePosition: false,
  };

  // Run tests
  results.approve = await testPrepareApprove();
  results.openPosition = await testPrepareOpenPosition();
  results.closePosition = await testPrepareClosePosition();
  results.updatePosition = await testPrepareUpdatePosition();

  // Summary
  console.log('\n==================================================');
  console.log('📊 Test Summary:');
  console.log('==================================================');
  console.log(`  prepareApproveTransaction:         ${results.approve ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  prepareOpenPositionTransaction:    ${results.openPosition ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  prepareClosePositionTransaction:   ${results.closePosition ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  prepareUpdatePositionTransaction:  ${results.updatePosition ? '✅ PASS' : '❌ FAIL'}`);
  console.log('==================================================\n');

  const allPassed = Object.values(results).every(result => result === true);

  if (allPassed) {
    console.log('🎉 All tests passed! SDK is ready for Privy integration.\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
