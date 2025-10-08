/**
 * Test Script: Dynamic Market Fetching
 *
 * This script tests the new dynamic market fetching functionality
 * that pulls all markets directly from the contract instead of hardcoded lists
 */

import { AvantisSDK } from '../src';

async function testDynamicMarkets() {
  console.log('🧪 Testing Dynamic Market Fetching\n');
  console.log('='.repeat(50));

  // Initialize SDK
  const sdk = new AvantisSDK('base');

  try {
    // Test 1: Get all markets from contract
    console.log('\n📊 Test 1: Fetching all markets from contract...');
    console.log('-'.repeat(50));

    const markets = await sdk.getAllMarkets(false, (current, total) => {
      if (current % 10 === 0 || current === total) {
        console.log(`Progress: ${current}/${total} markets fetched`);
      }
    });

    console.log(`\n✅ Successfully fetched ${markets.length} markets\n`);

    // Display first 5 markets
    console.log('First 5 markets:');
    markets.slice(0, 5).forEach((market, index) => {
      console.log(`\n${index + 1}. Market Index: ${market.id}`);
      console.log(`   Name: ${market.name}`);
      console.log(`   From: ${market.from} -> To: ${market.to}`);
      console.log(`   Feed ID: ${market.feed}`);
      console.log(`   Max Leverage: ${market.maxLeverage}x`);
      console.log(`   Spread: ${market.spreadP}%`);
    });

    // Test 2: Get markets with Pyth prices
    console.log('\n\n💰 Test 2: Fetching markets with prices...');
    console.log('-'.repeat(50));

    const marketsWithPrices = await sdk.getAllMarketsWithPrices(true);

    console.log(`\n✅ Successfully fetched prices for ${marketsWithPrices.length} markets\n`);

    // Count how many have valid prices
    const withPrices = marketsWithPrices.filter(m => m.pythPrice !== null);
    const withoutPrices = marketsWithPrices.filter(m => m.pythPrice === null);

    console.log(`Markets with valid prices: ${withPrices.length}`);
    console.log(`Markets without prices: ${withoutPrices.length}`);

    // Display first 5 markets with prices
    console.log('\nFirst 5 markets with prices:');
    withPrices.slice(0, 5).forEach((market, index) => {
      const price = market.pythPrice;
      if (price) {
        const priceValue = (BigInt(price.price) * BigInt(10 ** Math.abs(price.expo))).toString();
        console.log(`\n${index + 1}. ${market.name} (Index: ${market.id})`);
        console.log(`   Price: ${priceValue}`);
        console.log(`   Confidence: ${price.conf}`);
        console.log(`   Published: ${new Date(price.publishTime * 1000).toISOString()}`);
      }
    });

    // Display markets without prices if any
    if (withoutPrices.length > 0) {
      console.log('\n\n⚠️  Markets without prices:');
      withoutPrices.forEach(market => {
        console.log(`   - ${market.name || 'Unknown'} (Index: ${market.id}, Feed: ${market.feed})`);
      });
    }

    // Test 3: Test caching
    console.log('\n\n🗄️  Test 3: Testing cache...');
    console.log('-'.repeat(50));

    const start1 = Date.now();
    await sdk.getAllMarkets(false); // Bypass cache
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await sdk.getAllMarkets(true); // Use cache
    const time2 = Date.now() - start2;

    console.log(`\nTime without cache: ${time1}ms`);
    console.log(`Time with cache: ${time2}ms`);
    console.log(`Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}%`);

    // Test 4: Get raw pair data from StorageClient
    console.log('\n\n🔍 Test 4: Fetching raw pair data from PairStorage...');
    console.log('-'.repeat(50));

    const pairsCount = await sdk.storage.getPairsCount();
    console.log(`\nTotal pairs in PairStorage contract: ${pairsCount}`);

    // Get first pair data
    if (pairsCount > 0) {
      const pairData = await sdk.storage.getPairData(0);
      console.log('\nFirst pair raw data:');
      console.log(JSON.stringify(pairData, null, 2));
    }

    console.log('\n\n✅ All tests completed successfully!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testDynamicMarkets().catch(console.error);
