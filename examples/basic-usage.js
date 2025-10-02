/**
 * Basic Usage Example
 * 
 * This example demonstrates how to use the Avantis SDK in Node.js
 */

const { TraderClient, FeedClient } = require('../dist/index.js');

async function main() {
  try {
    // Initialize the trading client
    console.log('🚀 Initializing Avantis SDK...');
    const trader = new TraderClient('base');
    
    // Initialize the price feed client
    const feed = new FeedClient();
    
    console.log('✅ SDK initialized successfully');
    
    // Get network information
    const network = trader.getNetwork();
    console.log(`📡 Connected to: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Example: Subscribe to price updates (if WebSocket is configured)
    console.log('\n📊 Setting up price subscription for BTC/USD...');
    
    try {
      await feed.connect();
      
      const unsubscribe = feed.subscribeToPrice('BTC/USD', (priceData) => {
        console.log(`BTC/USD Price Update:`);
        console.log(`  - Price: $${priceData.price.toFixed(2)}`);
        console.log(`  - Bid: $${priceData.bid.toFixed(2)}`);
        console.log(`  - Ask: $${priceData.ask.toFixed(2)}`);
        console.log(`  - Timestamp: ${priceData.timestamp}`);
      });
      
      // Keep the subscription active for 10 seconds
      setTimeout(() => {
        unsubscribe();
        feed.disconnect();
        console.log('\n✅ Example completed successfully');
        process.exit(0);
      }, 10000);
      
    } catch (wsError) {
      console.log('⚠️  WebSocket not configured - skipping real-time price feeds');
      console.log('    To enable WebSocket, configure the websocketUrl in the network settings');
      
      // Try to get latest price via HTTP
      console.log('\n📈 Fetching latest price via HTTP...');
      try {
        const latestPrice = await feed.getLatestPrice('BTC/USD');
        console.log(`BTC/USD Latest Price: $${latestPrice.price.toFixed(2)}`);
      } catch (httpError) {
        console.log('⚠️  Price API not available in this example');
      }
      
      console.log('\n✅ Example completed');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);