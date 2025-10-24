/**
 * Get Pending Limit Orders Example
 *
 * This example demonstrates how to fetch all pending limit orders for a trader
 * using the efficient Multicall contract method
 */

const { TraderClient } = require("../dist/index.js");

async function main() {
  try {
    // Initialize the trading client
    console.log("🚀 Initializing Avantis SDK...");
    const trader = new TraderClient("base");

    console.log("✅ SDK initialized successfully");

    // Example trader address (replace with actual address)
    const traderAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"; // Example address

    console.log(`\n🔍 Fetching pending limit orders for: ${traderAddress}...`);

    // Get all pending limit orders for the trader
    const pendingOrders = await trader.getPendingLimitOrders(traderAddress);

    if (pendingOrders.length === 0) {
      console.log("\n📋 No pending limit orders found");
    } else {
      console.log(
        `\n📋 Found ${pendingOrders.length} pending limit order(s):\n`
      );

      pendingOrders.forEach((order, index) => {
        console.log(`Order #${index + 1}:`);
        console.log(`  ID: ${order.id}`);
        console.log(`  Pair: ${order.pair || `Pair Index ${order.pairIndex}`}`);
        console.log(`  Type: ${order.buy ? "LONG" : "SHORT"}`);
        console.log(`  Position Size: $${order.positionSize.toFixed(2)} USDC`);
        console.log(`  Leverage: ${order.leverage}x`);
        console.log(`  Open Price: $${order.openPrice.toFixed(2)}`);
        if (order.tp) {
          console.log(`  Take Profit: $${order.tp.toFixed(2)}`);
        }
        if (order.sl) {
          console.log(`  Stop Loss: $${order.sl.toFixed(2)}`);
        }
        if (order.slippageP) {
          console.log(`  Slippage: ${order.slippageP}%`);
        }
        if (order.block) {
          console.log(`  Created at Block: ${order.block}`);
        }
        console.log("");
      });
    }

    console.log("✅ Example completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
