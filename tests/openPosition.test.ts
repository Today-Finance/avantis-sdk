/**
 * Simple Open Position Test
 *
 * A minimal test script to open a position on Avantis
 * Usage: node examples/simple-open-position-test.js
 */

const { AvantisSDK, PositionSide } = require("../dist/index.js");

async function testOpenPosition() {
  try {
    console.log("=".repeat(70));
    console.log("Simple Open Position Test");
    console.log("=".repeat(70));

    // Initialize SDK
    console.log("\n📦 Initializing SDK...");
    const sdk = new AvantisSDK("base");
    console.log("✅ SDK initialized on", sdk.trader.getNetwork().name);

    // Set signer with private key
    console.log("\n🔑 Setting up signer...");
    const privateKey =
      "0x28cdc26e37b02a6d2dc7ba0b8e62550903ca9d93fd1e1c38b1a97cc317a852ed";
    sdk.setSigner({
      type: "privateKey",
      privateKey: privateKey,
    });

    const address = await sdk.trader.getAddress();
    console.log("✅ Wallet address:", address);

    // Check balances
    console.log("\n💰 Checking balances...");
    try {
      const usdcBalance = await sdk.trader.getUSDCBalance();
      console.log("USDC Balance:", usdcBalance.toString(), "USDC");

      const allowance = await sdk.trader.getTradingAllowance();
      console.log("Trading Allowance:", allowance.toString(), "USDC");
    } catch (error) {
      console.log("⚠️  Could not fetch balances:", error.message);
    }

    // Add this before opening position:
    console.log("\n✅ Approving USDC for trading...");
    const approveTx = await sdk.trader.approveUSDCForTrading("1000"); // Approve 1000 USDC
    console.log("Approval transaction:", approveTx.transactionHash);

    // Define position parameters
    const positionParams = {
      pair: "ETH/USD",
      side: PositionSide.LONG,
      size: "10", // 10 USDC position size
      leverage: 1, // 1x leverage
      slippage: 0.5, // 0.5% slippage tolerance
    };

    console.log("\n📊 Position Parameters:");
    console.log(JSON.stringify(positionParams, null, 2));

    // Open position
    console.log("\n🚀 Opening position...");
    const result = await sdk.trader.openPosition(positionParams);

    console.log("\n✅ Position opened successfully!");
    console.log("Transaction Hash:", result.transactionHash);
    console.log("Block Number:", result.blockNumber);
    console.log("Gas Used:", result.gasUsed?.toString());

    console.log("\n" + "=".repeat(70));
    console.log("✅ TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70));
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error("Error:", error.message);
    console.error("\nStack trace:");
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testOpenPosition()
  .then(() => {
    console.log("\n✅ Script completed!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });