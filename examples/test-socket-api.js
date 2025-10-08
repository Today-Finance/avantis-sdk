/**
 * Test script for Avantis Socket API integration
 * Demonstrates fetching all 91 markets from the Avantis Socket API
 */

const { AvantisSDK } = require('../dist/index.js');

async function testSocketAPI() {
  try {
    console.log('🧪 Testing Avantis Socket API Integration\n');
    console.log('='.repeat(60));

    const sdk = new AvantisSDK('base');

    // Test 1: Fetch all markets from Socket API
    console.log('\n📊 Test 1: Fetching all markets from Socket API...');
    console.log('-'.repeat(60));

    const markets = await sdk.getAllMarketsFromAPI();

    console.log(`\n✅ Successfully fetched ${markets.length} markets from Socket API\n`);

    // Display first 10 markets
    console.log('First 10 markets:');
    markets.slice(0, 10).forEach((market, index) => {
      console.log(`\n${index + 1}. ${market.name} (Index: ${market.pairIndex})`);
      console.log(`   Feed ID: ${market.pythFeedId.substring(0, 20)}...`);
      console.log(`   Max Leverage: ${market.maxLeverage}x`);
      console.log(`   Spread: ${market.spreadPercent}%`);
    });

    // Test 2: Get markets by asset type
    console.log('\n\n📊 Test 2: Fetching asset types...');
    console.log('-'.repeat(60));

    const assetTypes = await sdk.getAssetTypes();
    console.log(`\nAvailable asset types: ${assetTypes.join(', ')}\n`);

    // Get crypto markets
    const cryptoMarkets = await sdk.getMarketsByType('Crypto');
    console.log(`Crypto markets: ${cryptoMarkets.length}`);
    console.log('Sample crypto pairs:', cryptoMarkets.slice(0, 5).map(m => m.name).join(', '));

    // Test 3: Get total open interest
    console.log('\n\n📊 Test 3: Fetching total open interest...');
    console.log('-'.repeat(60));

    const totalOI = await sdk.getTotalOpenInterest();
    console.log(`\nTotal Open Interest:`);
    console.log(`  Long: $${(totalOI?.long || 0).toLocaleString()}`);
    console.log(`  Short: $${(totalOI?.short || 0).toLocaleString()}`);

    // Test 4: Get specific market by index
    console.log('\n\n📊 Test 4: Fetching specific markets...');
    console.log('-'.repeat(60));

    const btc = await sdk.getMarketByIndex(1); // BTC/USD
    if (btc) {
      console.log(`\n${btc.name}:`);
      console.log(`  Max Leverage: ${btc.maxLeverage}x`);
      console.log(`  Spread: ${btc.spreadPercent}%`);
      console.log(`  Feed ID: ${btc.pythFeedId}`);
    }

    // Test 5: Display all market names
    console.log('\n\n📊 Test 5: All available markets:');
    console.log('-'.repeat(60));
    console.log('\nAll 91 trading pairs:');

    // Group by tens
    for (let i = 0; i < markets.length; i += 10) {
      const batch = markets.slice(i, i + 10);
      console.log(`\n${i}-${i + 9}:`, batch.map(m => m.name).join(', '));
    }

    // Test 6: Cache performance
    console.log('\n\n📊 Test 6: Testing cache performance...');
    console.log('-'.repeat(60));

    const start1 = Date.now();
    await sdk.getAllMarketsFromAPI(false); // No cache
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await sdk.getAllMarketsFromAPI(true); // Use cache
    const time2 = Date.now() - start2;

    console.log(`\nTime without cache: ${time1}ms`);
    console.log(`Time with cache: ${time2}ms`);
    console.log(`Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}%`);

    console.log('\n\n✅ All Socket API tests completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
  }
}

testSocketAPI();
