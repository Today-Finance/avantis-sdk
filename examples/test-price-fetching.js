/**
 * Test script to demonstrate price fetching functionality
 * Shows how to get real-time prices for all Avantis markets
 */

const { AvantisSDK } = require('../dist/index.js');

async function testPriceFetching() {
  try {
    console.log('🧪 Testing Price Fetching with Avantis SDK\n');
    console.log('='.repeat(70));

    const sdk = new AvantisSDK('base');

    // Test 1: Get markets (without prices first to avoid timeout)
    console.log('\n📊 Test 1: Fetching all markets from Socket API...');
    console.log('-'.repeat(70));

    const allMarkets = await sdk.getAllMarketsFromAPI();

    console.log(`\n✅ Successfully fetched ${allMarkets.length} markets\n`);

    // Fetch prices for first 10 markets
    console.log('Fetching prices for first 10 markets:');
    const firstTen = allMarkets.slice(0, 10);
    const feedIds = firstTen.map(m => m.pythFeedId);

    const prices = await sdk.pyth.getLatestPricesByFeedIds(feedIds);
    let priceCount = 0;

    firstTen.forEach((market, index) => {
      const priceData = prices.get(market.pythFeedId);

      if (priceData) {
        priceCount++;
        const expo = priceData.expo;
        const price = expo < 0
          ? (parseFloat(priceData.price) / Math.pow(10, Math.abs(expo))).toFixed(Math.abs(expo))
          : parseFloat(priceData.price) * Math.pow(10, expo);

        const confidence = expo < 0
          ? (parseFloat(priceData.conf) / Math.pow(10, Math.abs(expo))).toFixed(Math.abs(expo))
          : parseFloat(priceData.conf) * Math.pow(10, expo);

        console.log(`\n${index + 1}. ${market.name} (Index: ${market.pairIndex})`);
        console.log(`   Price: $${price}`);
        console.log(`   Confidence: ±$${confidence}`);
        console.log(`   Max Leverage: ${market.maxLeverage}x`);
      } else {
        console.log(`\n${index + 1}. ${market.name} (Index: ${market.pairIndex})`);
        console.log(`   ⚠️  No price available`);
      }
    });

    console.log(`\n📈 Markets with valid prices: ${priceCount}/10 shown`);

    // Test 2: Get specific markets and their prices
    console.log('\n\n📊 Test 2: Fetching specific market prices...');
    console.log('-'.repeat(70));

    const specificPairs = [
      { index: 0, name: 'ETH/USD' },
      { index: 1, name: 'BTC/USD' },
      { index: 2, name: 'SOL/USD' },
      { index: 11, name: 'EUR/USD' },
      { index: 21, name: 'XAU/USD (Gold)' }
    ];

    for (const pair of specificPairs) {
      const market = await sdk.getMarketByIndex(pair.index);
      if (market) {
        try {
          const priceData = await sdk.pyth.getLatestPriceByFeedId(market.pythFeedId);
          const expo = priceData.expo;
          const price = expo < 0
            ? (parseFloat(priceData.price) / Math.pow(10, Math.abs(expo))).toFixed(Math.abs(expo))
            : parseFloat(priceData.price) * Math.pow(10, expo);

          console.log(`\n${market.name}:`);
          console.log(`  Price: $${price}`);
          console.log(`  Feed ID: ${market.pythFeedId.substring(0, 20)}...`);
          console.log(`  Max Leverage: ${market.maxLeverage}x`);
        } catch (error) {
          console.log(`\n${market.name}:`);
          console.log(`  ⚠️  Price fetch failed: ${error.message}`);
        }
      }
    }

    // Test 3: Get crypto markets with prices
    console.log('\n\n📊 Test 3: Fetching crypto markets with prices...');
    console.log('-'.repeat(70));

    const cryptoMarkets = await sdk.getMarketsByType('Crypto');
    console.log(`\nFound ${cryptoMarkets.length} crypto markets`);

    // Get prices for first 5 crypto markets
    const cryptoPrices = [];
    for (let i = 0; i < Math.min(5, cryptoMarkets.length); i++) {
      const market = cryptoMarkets[i];
      try {
        const priceData = await sdk.pyth.getLatestPriceByFeedId(market.pythFeedId);
        const expo = priceData.expo;
        const price = expo < 0
          ? parseFloat(priceData.price) / Math.pow(10, Math.abs(expo))
          : parseFloat(priceData.price) * Math.pow(10, expo);

        cryptoPrices.push({ name: market.name, price });
      } catch (error) {
        // Skip if price not available
      }
    }

    if (cryptoPrices.length > 0) {
      console.log('\nSample crypto prices:');
      cryptoPrices.forEach(({ name, price }) => {
        console.log(`  ${name}: $${price.toLocaleString()}`);
      });
    }

    // Test 4: Performance test - batch price fetching
    console.log('\n\n📊 Test 4: Testing batch price fetching performance...');
    console.log('-'.repeat(70));

    const testMarkets = allMarkets.slice(0, 20);
    const testFeedIds = testMarkets.map(m => m.pythFeedId).filter(id => id);

    console.log(`\nFetching prices for ${testFeedIds.length} markets in batch...`);

    const start = Date.now();
    const batchPrices = await sdk.pyth.getLatestPricesByFeedIds(testFeedIds);
    const elapsed = Date.now() - start;

    console.log(`✅ Fetched ${batchPrices.size} prices in ${elapsed}ms`);
    console.log(`Average: ${(elapsed / batchPrices.size).toFixed(2)}ms per price`);

    // Test 5: Price statistics
    console.log('\n\n📊 Test 5: Price statistics across all markets...');
    console.log('-'.repeat(70));

    const allMarketFeedIds = allMarkets
      .map(m => m.pythFeedId)
      .filter(id => id && id !== '0x0000000000000000000000000000000000000000000000000000000000000000');

    console.log(`\nAttempting to fetch prices for ${allMarketFeedIds.length} markets...`);

    try {
      const allPrices = await sdk.pyth.getLatestPricesByFeedIds(allMarketFeedIds);
      console.log(`\n✅ Successfully fetched ${allPrices.size} prices`);
      console.log(`❌ Failed to fetch ${allMarketFeedIds.length - allPrices.size} prices`);
      console.log(`📊 Success rate: ${((allPrices.size / allMarketFeedIds.length) * 100).toFixed(1)}%`);
    } catch (error) {
      console.log(`\n⚠️  Batch fetch error: ${error.message}`);
    }

    console.log('\n\n✅ All price fetching tests completed!');
    console.log('='.repeat(70));
    console.log('\n💡 Key Takeaways:');
    console.log('   1. Use sdk.getAllMarketsFromAPIWithPrices() for complete data');
    console.log('   2. Use sdk.pyth.getLatestPriceByFeedId() for single prices');
    console.log('   3. Use sdk.pyth.getLatestPricesByFeedIds() for batch fetching');
    console.log('   4. Prices come from Pyth Network oracle');
    console.log('   5. Feed IDs are provided by the Socket API');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
  }
}

testPriceFetching();
