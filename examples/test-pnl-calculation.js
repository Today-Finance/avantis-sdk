/**
 * Test PNL Calculation
 *
 * Verifies that the PNL calculation matches the expected formula:
 * Gross PNL = (Current price - Entry price) * Position Size in Base Currency
 * Gross PNL % = [(Current price - Entry price) / Entry price] * 100
 *
 * Example from user:
 * SOL/USD (Long 1x)
 * Position Size: 14.99 USDC (0.074979 SOL)
 * Entry Price: 199.96
 * Current Price: 200.43
 * Expected PNL = (200.43 - 199.96) × 0.074979 = +0.03 USDC
 * Expected PNL % = (200.43 - 199.96) / 199.96 × 100 = +0.23%
 */

const {
  calculateUnrealizedPnL,
  calculatePnLPercentage,
} = require("../dist/index.js");
const { PositionSide } = require("../dist/index.js");
const Decimal = require("decimal.js");

console.log("=".repeat(70));
console.log("PNL Calculation Test");
console.log("=".repeat(70));

// Test case from user
const entryPrice = 199.96;
const currentPrice = 200.43;
const positionSizeUSDC = 14.99;
const side = PositionSide.LONG;

console.log("\n📊 Test Case: SOL/USD Long Position");
console.log("-".repeat(70));
console.log(`Position Size: ${positionSizeUSDC} USDC`);
console.log(`Entry Price: $${entryPrice}`);
console.log(`Current Price: $${currentPrice}`);
console.log(`Position Side: ${side}`);

// Calculate position size in base currency (SOL)
const positionSizeBase = positionSizeUSDC / entryPrice;
console.log(`Position Size in Base: ${positionSizeBase.toFixed(6)} SOL`);

// Calculate PNL
const pnl = calculateUnrealizedPnL(
  entryPrice,
  currentPrice,
  positionSizeUSDC,
  side
);
const pnlPercent = calculatePnLPercentage(entryPrice, currentPrice, side);

console.log("\n💰 Calculated Results:");
console.log("-".repeat(70));
console.log(`Unrealized PNL: ${pnl.toFixed(2)} USDC`);
console.log(`Unrealized PNL %: ${pnlPercent.toFixed(2)}%`);

// Expected results
const expectedPnl = 0.03;
const expectedPnlPercent = 0.23;

console.log("\n✅ Expected Results:");
console.log("-".repeat(70));
console.log(`Expected PNL: ${expectedPnl.toFixed(2)} USDC`);
console.log(`Expected PNL %: ${expectedPnlPercent.toFixed(2)}%`);

// Verify results (allow small floating point differences)
const pnlMatch = Math.abs(pnl.toNumber() - expectedPnl) < 0.01;
const pnlPercentMatch = Math.abs(pnlPercent - expectedPnlPercent) < 0.01;

console.log("\n🔍 Verification:");
console.log("-".repeat(70));
console.log(`PNL Match: ${pnlMatch ? "✅ PASS" : "❌ FAIL"}`);
console.log(`PNL % Match: ${pnlPercentMatch ? "✅ PASS" : "❌ FAIL"}`);

// Test SHORT position
console.log("\n\n📊 Test Case 2: ETH/USD Short Position");
console.log("-".repeat(70));
const entryPrice2 = 3000;
const currentPrice2 = 2950;
const positionSizeUSDC2 = 100;
const side2 = PositionSide.SHORT;

console.log(`Position Size: ${positionSizeUSDC2} USDC`);
console.log(`Entry Price: $${entryPrice2}`);
console.log(`Current Price: $${currentPrice2}`);
console.log(`Position Side: ${side2}`);

const positionSizeBase2 = positionSizeUSDC2 / entryPrice2;
console.log(`Position Size in Base: ${positionSizeBase2.toFixed(6)} ETH`);

const pnl2 = calculateUnrealizedPnL(
  entryPrice2,
  currentPrice2,
  positionSizeUSDC2,
  side2
);
const pnlPercent2 = calculatePnLPercentage(entryPrice2, currentPrice2, side2);

console.log("\n💰 Calculated Results:");
console.log("-".repeat(70));
console.log(`Unrealized PNL: ${pnl2.toFixed(2)} USDC`);
console.log(`Unrealized PNL %: ${pnlPercent2.toFixed(2)}%`);

// Manual calculation for verification
// For SHORT: PNL = (Entry - Current) * Position Size in Base
// PNL = (3000 - 2950) * (100 / 3000) = 50 * 0.033333 = 1.67 USDC
// PNL % = (3000 - 2950) / 3000 * 100 = 1.67%
const expectedPnl2 = (entryPrice2 - currentPrice2) * positionSizeBase2;
const expectedPnlPercent2 = ((entryPrice2 - currentPrice2) / entryPrice2) * 100;

console.log("\n✅ Expected Results:");
console.log("-".repeat(70));
console.log(`Expected PNL: ${expectedPnl2.toFixed(2)} USDC`);
console.log(`Expected PNL %: ${expectedPnlPercent2.toFixed(2)}%`);

const pnlMatch2 = Math.abs(pnl2.toNumber() - expectedPnl2) < 0.01;
const pnlPercentMatch2 = Math.abs(pnlPercent2 - expectedPnlPercent2) < 0.01;

console.log("\n🔍 Verification:");
console.log("-".repeat(70));
console.log(`PNL Match: ${pnlMatch2 ? "✅ PASS" : "❌ FAIL"}`);
console.log(`PNL % Match: ${pnlPercentMatch2 ? "✅ PASS" : "❌ FAIL"}`);

console.log("\n" + "=".repeat(70));
const allTestsPass =
  pnlMatch && pnlPercentMatch && pnlMatch2 && pnlPercentMatch2;
console.log(allTestsPass ? "✅ ALL TESTS PASSED!" : "❌ SOME TESTS FAILED!");
console.log("=".repeat(70) + "\n");

process.exit(allTestsPass ? 0 : 1);
