/**
 * Example: Get Position PnL (Profit and Loss)
 *
 * This example demonstrates how to:
 * 1. Fetch open positions
 * 2. Access unrealized PnL (gross PnL before fees)
 * 3. Calculate PnL percentage
 * 4. Calculate net PnL (after estimated closing fees)
 */

import { AvantisSDK, Position, calculatePnLPercentage } from "../dist/index.js";
import Decimal from "decimal.js";

async function getPositionPnL() {
  // Initialize SDK
  const sdk = new AvantisSDK("base");

  // Your wallet address
  const walletAddress = "0xYourWalletAddress";

  try {
    // Get all open positions
    console.log("📊 Fetching open positions...\n");
    const positions = await sdk.trader.getPositions(walletAddress);

    if (positions.length === 0) {
      console.log("No open positions found.");
      return;
    }

    console.log(`Found ${positions.length} open position(s)\n`);

    // Display PnL for each position
    for (const position of positions) {
      console.log("=".repeat(60));
      console.log(`Position: ${position.pair} ${position.side}`);
      console.log("=".repeat(60));

      // Basic position info
      console.log(`ID: ${position.id}`);
      console.log(`Size: $${position.size.toFixed(2)} USDC`);
      console.log(`Collateral: $${position.collateral.toFixed(2)} USDC`);
      console.log(`Leverage: ${position.leverage}x`);
      console.log();

      // Price information
      console.log(`Entry Price: $${position.entryPrice.toFixed(2)}`);
      console.log(`Current Price: $${position.markPrice.toFixed(2)}`);
      console.log(
        `Liquidation Price: $${position.liquidationPrice.toFixed(2)}`
      );
      console.log();

      // ===== GROSS PnL (Unrealized PnL) =====
      // This is PnL BEFORE closing fees
      const grossPnl = position.unrealizedPnl;
      const grossPnlPercent = calculatePnLPercentage(
        position.entryPrice,
        position.markPrice,
        position.side,
        position.leverage
      );

      console.log("💰 GROSS PnL (before fees):");
      console.log(`   Amount: ${formatPnL(grossPnl)}`);
      console.log(`   Percentage: ${grossPnlPercent.toFixed(2)}%`);
      console.log();

      // ===== NET PnL (After estimated closing fees) =====
      // Estimate closing fees (typically ~0.06% of position size)
      const estimatedClosingFee = position.size.mul(0.0006); // 0.06%
      const netPnl = grossPnl.minus(estimatedClosingFee);
      const netPnlPercent = netPnl.div(position.collateral).mul(100);

      console.log("💵 NET PnL (after estimated closing fees):");
      console.log(`   Amount: ${formatPnL(netPnl)}`);
      console.log(`   Percentage: ${netPnlPercent.toFixed(2)}%`);
      console.log(
        `   Estimated closing fee: $${estimatedClosingFee.toFixed(2)}`
      );
      console.log();

      // ===== ROI (Return on Investment) =====
      const roi = grossPnl.div(position.collateral).mul(100);
      console.log(`📈 ROI (on collateral): ${roi.toFixed(2)}%`);
      console.log();

      // ===== Current Equity =====
      const equity = position.collateral.plus(grossPnl);
      console.log(`💼 Current Equity: $${equity.toFixed(2)} USDC`);
      console.log();

      // ===== Realized PnL =====
      // This would be PnL from previously closed positions
      console.log(
        `✅ Realized PnL (closed positions): $${position.realizedPnl.toFixed(2)}`
      );
      console.log();
    }

    // ===== PORTFOLIO SUMMARY =====
    console.log("=".repeat(60));
    console.log("PORTFOLIO SUMMARY");
    console.log("=".repeat(60));

    const totalCollateral = positions.reduce(
      (sum, p) => sum.plus(p.collateral),
      new Decimal(0)
    );
    const totalUnrealizedPnl = positions.reduce(
      (sum, p) => sum.plus(p.unrealizedPnl),
      new Decimal(0)
    );
    const totalEquity = totalCollateral.plus(totalUnrealizedPnl);
    const portfolioROI = totalUnrealizedPnl.div(totalCollateral).mul(100);

    console.log(`Total Collateral: $${totalCollateral.toFixed(2)} USDC`);
    console.log(`Total Unrealized PnL: ${formatPnL(totalUnrealizedPnl)}`);
    console.log(`Total Equity: $${totalEquity.toFixed(2)} USDC`);
    console.log(`Portfolio ROI: ${portfolioROI.toFixed(2)}%`);
    console.log();
  } catch (error) {
    console.error("Error fetching PnL:", error);
  }
}

/**
 * Helper function to format PnL with color
 */
function formatPnL(pnl: Decimal): string {
  const isProfit = pnl.gte(0);
  const symbol = isProfit ? "+" : "";
  const indicator = isProfit ? "📈" : "📉";
  return `${indicator} ${symbol}$${pnl.toFixed(2)} USDC`;
}

// Run the example
getPositionPnL()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
