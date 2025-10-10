/**
 * Example: Managing Multiple Order Types on Avantis
 *
 * This example demonstrates:
 * 1. Placing different order types (MARKET, LIMIT, STOP)
 * 2. Managing multiple positions
 * 3. Working with pair indices
 */

import {
  TraderClient,
  FeedClient,
  OrderType,
  PositionSide,
  formatUSDC,
  formatPrice,
  getPairIndex,
} from "../src";
import Decimal from "decimal.js";
import * as dotenv from "dotenv";

dotenv.config();

async function manageOrdersExample() {
  // Initialize clients
  const trader = new TraderClient("base");
  const feedClient = new FeedClient();

  // Set up signer
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  await trader.setSigner({
    type: "privateKey",
    privateKey,
  });

  // Connect to price feed
  await feedClient.connect();

  console.log("Avantis Order Management Example");
  console.log("================================\n");

  try {
    const address = await trader.getAddress();
    console.log(`Trading Account: ${address}`);

    // Get current ETH price
    const ethPrice = await feedClient.getLatestPrice("ETH/USD");
    console.log(`Current ETH/USD Price: ${formatPrice(ethPrice.price)}\n`);

    // Check balance
    const usdcBalance = await trader.getUSDCBalance();
    console.log(`USDC Balance: ${formatUSDC(usdcBalance)}\n`);

    // Ensure sufficient balance
    const totalCollateralNeeded = 30; // $10 per order x 3
    if (usdcBalance.lt(totalCollateralNeeded)) {
      throw new Error(`Need at least $${totalCollateralNeeded} USDC`);
    }

    // Approve USDC if needed
    const allowance = await trader.getTradingAllowance();
    if (allowance.lt(totalCollateralNeeded)) {
      console.log("Approving USDC...");
      await trader.approveUSDCForTrading(totalCollateralNeeded);
    }

    console.log("PLACING MULTIPLE ORDER TYPES");
    console.log("============================\n");

    // 1. MARKET ORDER - Execute immediately at current price
    console.log("1. Market Order (Execute Immediately)");
    console.log("--------------------------------------");
    const marketOrder = await trader.openPosition({
      pair: "ETH/USD",
      side: PositionSide.LONG,
      size: 100,
      leverage: 10,
      orderType: OrderType.MARKET, // Will execute immediately
      stopLoss: ethPrice.price.mul(0.95),
      takeProfit: ethPrice.price.mul(1.05),
      slippage: 0.5,
    });
    console.log(`Market Order TX: ${marketOrder.transactionHash}`);
    console.log(
      `Status: ${marketOrder.success ? "✅ Executed" : "❌ Failed"}\n`
    );

    // 2. LIMIT ORDER - Buy below current price
    console.log("2. Limit Order (Buy Lower)");
    console.log("--------------------------");
    const limitPrice = ethPrice.price.mul(0.98); // 2% below current
    const limitOrder = await trader.openPosition({
      pair: "ETH/USD",
      side: PositionSide.LONG,
      size: 100,
      leverage: 10,
      orderType: OrderType.LIMIT,
      openPrice: limitPrice, // Will execute when price reaches this level
      stopLoss: limitPrice.mul(0.95),
      takeProfit: limitPrice.mul(1.1),
      slippage: 0.3,
    });
    console.log(`Limit Order TX: ${limitOrder.transactionHash}`);
    console.log(`Limit Price: ${formatPrice(limitPrice)}`);
    console.log(`Status: ${limitOrder.success ? "✅ Placed" : "❌ Failed"}\n`);

    // 3. STOP-LIMIT ORDER - Sell if price drops (stop loss order)
    console.log("3. Stop-Limit Order (Stop Loss)");
    console.log("--------------------------------");
    const stopPrice = ethPrice.price.mul(0.97); // 3% below current
    const stopOrder = await trader.openPosition({
      pair: "ETH/USD",
      side: PositionSide.SHORT, // Short to protect against downside
      size: 100,
      leverage: 10,
      orderType: OrderType.STOP_LIMIT,
      openPrice: stopPrice, // Will trigger when price drops to this level
      stopLoss: stopPrice.mul(1.05), // Stop loss for the short position
      takeProfit: stopPrice.mul(0.9), // Take profit for the short
      slippage: 0.5,
    });
    console.log(`Stop-Limit Order TX: ${stopOrder.transactionHash}`);
    console.log(`Stop Price: ${formatPrice(stopPrice)}`);
    console.log(`Status: ${stopOrder.success ? "✅ Placed" : "❌ Failed"}\n`);

    // Display order summary
    console.log("ORDER SUMMARY");
    console.log("=============");
    console.log("1. Market Order: EXECUTED - Long ETH at market price");
    console.log(
      "2. Limit Order: PENDING - Will buy ETH at",
      formatPrice(limitPrice)
    );
    console.log(
      "3. Stop-Limit Order: PENDING - Will short ETH at",
      formatPrice(stopPrice)
    );
    console.log(
      "\nNote: Pending orders will execute when market conditions are met."
    );

    // Working with different trading pairs
    console.log("\n\nWORKING WITH DIFFERENT PAIRS");
    console.log("=============================");

    const pairs = ["BTC/USD", "SOL/USD", "EUR/USD", "XAU/USD"];
    for (const pair of pairs) {
      const index = getPairIndex(pair);
      console.log(`${pair.padEnd(10)} - Pair Index: ${index}`);
    }

    // Get trading pairs by category
    console.log("\nTRADING PAIRS BY CATEGORY");
    console.log("==========================");

    const cryptoPairs = trader.getPairsByCategory("crypto");
    console.log(
      `Crypto (${cryptoPairs.length} pairs):`,
      cryptoPairs.slice(0, 5).join(", "),
      "..."
    );

    const forexPairs = trader.getPairsByCategory("forex");
    console.log(`Forex (${forexPairs.length} pairs):`, forexPairs.join(", "));

    const commodityPairs = trader.getPairsByCategory("commodity");
    console.log(
      `Commodities (${commodityPairs.length} pairs):`,
      commodityPairs.join(", ")
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    feedClient.disconnect();
    trader.disconnect();
  }
}

// Run the example
manageOrdersExample().catch(console.error);
