/**
 * Test script to check PairStorage contract methods
 */

const { AvantisSDK } = require('../dist/index.js');

async function testPairsCount() {
  try {
    console.log('🔍 Testing PairStorage Contract Methods\n');
    console.log('='.repeat(60));

    const sdk = new AvantisSDK('base');

    // Test 1: Check pairsCount
    console.log('\n📊 Test 1: Getting pairs count...');
    try {
      const count = await sdk.storage.getPairsCount();
      console.log(`✅ Pairs count: ${count}`);
    } catch (error) {
      console.log(`❌ Error getting pairs count: ${error.message}`);
    }

    // Test 2: Try to get raw pair data for first few indices
    console.log('\n📊 Test 2: Testing first 10 pair indices...');
    for (let i = 0; i < 10; i++) {
      try {
        const pairData = await sdk.storage.getPairData(i);
        console.log(`✅ Pair ${i}: Feed ID = ${pairData.feed.feedId.substring(0, 20)}...`);
      } catch (error) {
        console.log(`❌ Pair ${i}: ${error.message}`);
      }
    }

    // Test 3: Check isPairListed method
    console.log('\n📊 Test 3: Checking isPairListed for first 10 pairs...');
    for (let i = 0; i < 10; i++) {
      try {
        const isListed = await sdk.storage.isPairListed(i);
        console.log(`Pair ${i}: ${isListed ? '✅ Listed' : '❌ Not listed'}`);
      } catch (error) {
        console.log(`Pair ${i}: ⚠️  Error checking: ${error.message}`);
      }
    }

    sdk.storage.disconnect();

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPairsCount();
