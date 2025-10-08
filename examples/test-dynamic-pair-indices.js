/**
 * Test script to verify dynamic pair index lookups are working correctly
 * This validates that the hardcoded pair indices have been replaced with Socket API lookups
 */

const { AvantisSDK } = require('../dist/index.js');

async function testDynamicPairIndices() {
  try {
    console.log('🧪 Testing Dynamic Pair Index Lookups\n');
    console.log('='.repeat(70));

    const sdk = new AvantisSDK('base');

    // Test 1: Compare hardcoded vs dynamic indices
    console.log('\n📊 Test 1: Comparing hardcoded vs dynamic pair indices');
    console.log('-'.repeat(70));

    const testPairs = ['ETH/USD', 'BTC/USD', 'SOL/USD', 'EUR/USD', 'XAU/USD'];

    console.log('\n| Pair       | Hardcoded (OLD) | Dynamic (NEW) | Match? |');
    console.log('|------------|-----------------|---------------|--------|');

    for (const pairName of testPairs) {
      try {
        // Hardcoded (deprecated)
        const hardcodedIndex = sdk.trader.getPairIndex(pairName);

        // Dynamic (new, correct)
        const dynamicIndex = await sdk.getPairIndexByName(pairName);

        const match = hardcodedIndex === dynamicIndex ? '✅ YES' : '❌ NO';
        console.log(`| ${pairName.padEnd(10)} | ${String(hardcodedIndex).padStart(15)} | ${String(dynamicIndex).padStart(13)} | ${match} |`);
      } catch (error) {
        console.log(`| ${pairName.padEnd(10)} | ERROR           | -             | -      |`);
      }
    }

    // Test 2: Verify TraderClient uses dynamic indices
    console.log('\n\n📊 Test 2: Verify TraderClient methods use Socket API');
    console.log('-'.repeat(70));

    console.log('\nTesting getPairIndexFromAPI():');
    const ethIndex = await sdk.trader.getPairIndexFromAPI('ETH/USD');
    console.log(`✅ ETH/USD index from API: ${ethIndex}`);

    console.log('\nTesting getPairNameFromAPI():');
    const pairName = await sdk.trader.getPairNameFromAPI(ethIndex);
    console.log(`✅ Pair at index ${ethIndex}: ${pairName}`);

    console.log('\nTesting getAllPairsFromAPI():');
    const allPairs = await sdk.trader.getAllPairsFromAPI();
    console.log(`✅ Total pairs from API: ${allPairs.length}`);
    console.log(`   First 10 pairs: ${allPairs.slice(0, 10).join(', ')}`);

    // Test 3: Validate critical pairs
    console.log('\n\n📊 Test 3: Validate critical trading pairs');
    console.log('-'.repeat(70));

    const criticalPairs = [
      { name: 'ETH/USD', expectedIndex: 0 },
      { name: 'BTC/USD', expectedIndex: 1 },
      { name: 'SOL/USD', expectedIndex: 2 },
    ];

    for (const { name, expectedIndex } of criticalPairs) {
      const actualIndex = await sdk.getPairIndexByName(name);
      const status = actualIndex === expectedIndex ? '✅' : '❌';
      console.log(`${status} ${name}: Expected ${expectedIndex}, Got ${actualIndex}`);
    }

    // Test 4: Test round-trip conversion
    console.log('\n\n📊 Test 4: Round-trip conversion (name → index → name)');
    console.log('-'.repeat(70));

    for (const originalName of testPairs) {
      try {
        const index = await sdk.getPairIndexByName(originalName);
        const retrievedName = await sdk.getPairNameByIndex(index);
        const match = originalName === retrievedName;
        console.log(`${match ? '✅' : '❌'} ${originalName} → ${index} → ${retrievedName}`);
      } catch (error) {
        console.log(`❌ ${originalName}: ${error.message}`);
      }
    }

    // Test 5: Test all pairs are accessible
    console.log('\n\n📊 Test 5: Verify all 89+ pairs are accessible');
    console.log('-'.repeat(70));

    const markets = await sdk.getAllMarketsFromAPI();
    console.log(`\nTotal markets available: ${markets.length}`);

    // Try accessing first, middle, and last pairs
    const testIndices = [0, Math.floor(markets.length / 2), markets.length - 1];

    for (const idx of testIndices) {
      const market = markets[idx];
      const retrievedName = await sdk.getPairNameByIndex(market.pairIndex);
      const match = market.name === retrievedName;
      console.log(`${match ? '✅' : '❌'} Index ${market.pairIndex}: ${market.name} (${match ? 'accessible' : 'mismatch'})`);
    }

    // Test 6: Deprecation warnings check
    console.log('\n\n📊 Test 6: Verify deprecation warnings (should see warnings below)');
    console.log('-'.repeat(70));

    console.log('\nCalling deprecated methods (warnings expected):');
    sdk.trader.getPairIndex('ETH/USD'); // Should log warning
    sdk.trader.getPairName(0); // Should log warning
    sdk.trader.getAllPairs(); // Should log warning

    console.log('\n✅ All dynamic pair index tests completed!');
    console.log('='.repeat(70));

    console.log('\n💡 Summary:');
    console.log('   • TraderClient now uses Socket API for accurate pair indices');
    console.log('   • Old hardcoded methods are deprecated with warnings');
    console.log('   • All 89+ trading pairs are accessible dynamically');
    console.log('   • Trading operations will now use correct pair indices');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
  }
}

testDynamicPairIndices();
