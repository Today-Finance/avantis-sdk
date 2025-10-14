/**
 * Simple example: Get Gross PnL from positions
 */

const { AvantisSDK } = require("../dist/index.js");

async function getPnL() {
  const sdk = new AvantisSDK("base");

  // Replace with your wallet address
  const walletAddress = "0x2bc1d13BC4C326375eC0e01aE35a4836C9e7Db80";

  // Get all open positions
  const position = await sdk.trader.getPosition(0, 2, walletAddress);

  console.log(`position === `, position);
  console.log(`  Entry: $${position.entryPrice.toFixed(2)}`);
  console.log(`  Current: $${position.markPrice.toFixed(2)}`);

  // 💰 GROSS PnL - This is what you're looking for!
  console.log(`  Gross PnL: $${position.unrealizedPnl.toFixed(2)}`);

  // Calculate PnL percentage
  const pnlPercent = position.unrealizedPnl.div(position.collateral).mul(100);
  console.log(`  PnL %: ${pnlPercent.toFixed(2)}%\n`);
}

getPnL().catch(console.error);
