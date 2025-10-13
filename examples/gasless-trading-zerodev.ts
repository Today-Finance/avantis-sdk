/**
 * Example: Gasless Trading with ZeroDev + Privy
 *
 * This example demonstrates how to enable gasless transactions
 * using ZeroDev paymaster with Privy authentication.
 */

import { AvantisSDK } from "../src";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

// ============================================================================
// STEP 1: Create ZeroDev Kernel Client (Your Implementation)
// ============================================================================

/**
 * This is YOUR implementation using Privy + ZeroDev
 * Replace this with your actual privySessionSignerService implementation
 */
async function getZeroDevKernelClient(userAddress: string) {
  // In your project, this would be something like:
  // const kernelClient = await privySessionSignerService.getViemWalletClient(userAddress);

  // For this example, we'll show the structure:
  console.log(`Getting ZeroDev kernel client for ${userAddress}...`);

  // Your implementation should:
  // 1. Get Privy user by address
  // 2. Ensure embedded wallet exists
  // 3. Create viem account from Privy wallet
  // 4. Create wallet client with ZeroDev RPC

  throw new Error(
    "Replace this with your actual ZeroDev client implementation"
  );
}

// ============================================================================
// STEP 2: Initialize SDK with Gasless Mode
// ============================================================================

async function initializeGaslessTrading(userAddress: string) {
  console.log("=".repeat(60));
  console.log("Initializing Avantis SDK with Gasless Mode");
  console.log("=".repeat(60));

  // Initialize SDK for Base mainnet
  const sdk = new AvantisSDK("base");

  // Get ZeroDev kernel client from your implementation
  const kernelClient = await getZeroDevKernelClient(userAddress);

  // Set signer with gasless mode ENABLED
  await sdk.setSigner({
    type: "viemClient",
    client: kernelClient,
    gasless: true, // 🔥 This enables gasless transactions!
  });

  console.log("✅ Gasless mode enabled!");
  console.log(`Gasless: ${sdk.isGaslessEnabled()}`);

  return sdk;
}

// ============================================================================
// STEP 3: Trade Without Gas Fees
// ============================================================================

async function openGaslessPosition() {
  const userAddress = "0x..."; // Your user's address
  const sdk = await initializeGaslessTrading(userAddress);

  console.log("\n" + "=".repeat(60));
  console.log("Opening Position (Gasless)");
  console.log("=".repeat(60));

  try {
    // Open a position without needing ETH for gas!
    const result = await sdk.openPosition({
      pair: "ETH/USD",
      side: "long",
      size: 1000,
      leverage: 10,
      orderType: "market",
      slippage: 0.5,
    });

    console.log("✅ Position opened successfully!");
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Gas Used: ${result.gasUsed} (sponsored by ZeroDev paymaster)`);

    return result;
  } catch (error) {
    console.error("❌ Failed to open position:", error);
    throw error;
  }
}

async function closeGaslessPosition(positionId: string) {
  const userAddress = "0x...";
  const sdk = await initializeGaslessTrading(userAddress);

  console.log("\n" + "=".repeat(60));
  console.log("Closing Position (Gasless)");
  console.log("=".repeat(60));

  try {
    // Close the position without needing ETH for gas!
    const result = await sdk.closePosition({
      positionId,
    });

    console.log("✅ Position closed successfully!");
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Gas Used: ${result.gasUsed} (sponsored by ZeroDev paymaster)`);

    return result;
  } catch (error) {
    console.error("❌ Failed to close position:", error);
    throw error;
  }
}

// ============================================================================
// STEP 4: Toggle Between Gasless and Regular Mode
// ============================================================================

async function toggleGaslessMode(sdk: AvantisSDK, enableGasless: boolean) {
  console.log("\n" + "=".repeat(60));
  console.log(`Switching to ${enableGasless ? "GASLESS" : "REGULAR"} Mode`);
  console.log("=".repeat(60));

  const userAddress = "0x...";
  const client = await getZeroDevKernelClient(userAddress);

  // Set signer with desired gasless mode
  await sdk.setSigner({
    type: "viemClient",
    client,
    gasless: enableGasless,
  });

  console.log(
    `✅ Mode switched to: ${sdk.isGaslessEnabled() ? "GASLESS" : "REGULAR"}`
  );
}

// ============================================================================
// STEP 5: Complete Trading Service Example
// ============================================================================

export class GaslessTradingService {
  private sdk: AvantisSDK;
  private gaslessEnabled: boolean = false;

  constructor(networkName: "base" | "base-sepolia" = "base") {
    this.sdk = new AvantisSDK(networkName);
  }

  /**
   * Set up the SDK with a user's wallet client
   * @param userAddress - User's wallet address
   * @param enableGasless - Whether to enable gasless transactions
   */
  async setSigner(
    userAddress: string,
    enableGasless: boolean = true
  ): Promise<boolean> {
    try {
      console.log(
        `[GaslessTradingService] Setting up ${enableGasless ? "gasless" : "regular"} transactions...`
      );

      // Get ZeroDev kernel client from your Privy implementation
      const kernelClient = await getZeroDevKernelClient(userAddress);

      // Pass the kernel client to SDK
      await this.sdk.setSigner({
        type: "viemClient",
        client: kernelClient,
        gasless: enableGasless, // 🔥 Control gasless mode
      });

      this.gaslessEnabled = enableGasless;

      console.log(
        `[GaslessTradingService] ✅ Signer set (gasless: ${this.sdk.isGaslessEnabled()})`
      );

      return true;
    } catch (error) {
      console.error("[GaslessTradingService] Failed to set signer:", error);
      return false;
    }
  }

  /**
   * Open a trading position (automatically gasless if enabled)
   */
  async openPosition(params: {
    pair: string;
    side: "long" | "short";
    size: number;
    leverage: number;
    orderType?: "market" | "limit";
    openPrice?: number;
    takeProfit?: number;
    stopLoss?: number;
    slippage?: number;
  }) {
    console.log(
      `[GaslessTradingService] Opening position (gasless: ${this.sdk.isGaslessEnabled()})...`
    );

    return await this.sdk.openPosition({
      pair: params.pair,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      orderType: params.orderType || "market",
      openPrice: params.openPrice,
      takeProfit: params.takeProfit,
      stopLoss: params.stopLoss,
      slippage: params.slippage || 0.5,
    });
  }

  /**
   * Close a trading position (automatically gasless if enabled)
   */
  async closePosition(positionId: string, partialSize?: number) {
    console.log(
      `[GaslessTradingService] Closing position (gasless: ${this.sdk.isGaslessEnabled()})...`
    );

    return await this.sdk.closePosition({
      positionId,
      size: partialSize,
    });
  }

  /**
   * Update position TP/SL (automatically gasless if enabled)
   */
  async updatePosition(
    positionId: string,
    takeProfit?: number,
    stopLoss?: number
  ) {
    console.log(
      `[GaslessTradingService] Updating position (gasless: ${this.sdk.isGaslessEnabled()})...`
    );

    return await this.sdk.updatePosition({
      positionId,
      takeProfit,
      stopLoss,
    });
  }

  /**
   * Get all open positions
   */
  async getPositions() {
    return await this.sdk.getPositions();
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    return await this.sdk.getAccountInfo();
  }

  /**
   * Check if gasless mode is enabled
   */
  isGaslessEnabled(): boolean {
    return this.sdk.isGaslessEnabled();
  }

  /**
   * Toggle gasless mode on/off
   */
  async toggleGaslessMode(userAddress: string, enableGasless: boolean) {
    await this.setSigner(userAddress, enableGasless);
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

async function main() {
  const userAddress = "0xYourUserAddress";
  const service = new GaslessTradingService("base");

  // Step 1: Initialize with gasless mode
  await service.setSigner(userAddress, true);

  console.log(`\nGasless mode enabled: ${service.isGaslessEnabled()}`);

  // Step 2: Open position (no gas fees!)
  const openResult = await service.openPosition({
    pair: "ETH/USD",
    side: "long",
    size: 1000,
    leverage: 10,
  });

  console.log(`\nPosition opened: ${openResult.transactionHash}`);

  // Step 3: Get positions
  const positions = await service.getPositions();
  console.log(`\nOpen positions: ${positions.length}`);

  // Step 4: Update position (no gas fees!)
  if (positions.length > 0) {
    await service.updatePosition(positions[0].id, 2500, 1800);
    console.log("\nPosition updated with TP/SL");
  }

  // Step 5: Close position (no gas fees!)
  if (positions.length > 0) {
    const closeResult = await service.closePosition(positions[0].id);
    console.log(`\nPosition closed: ${closeResult.transactionHash}`);
  }

  // Step 6: Switch to regular mode (if needed)
  await service.toggleGaslessMode(userAddress, false);
  console.log(`\nGasless mode enabled: ${service.isGaslessEnabled()}`);
}

// Run example (uncomment to test with your implementation)
// main().catch(console.error);

export default GaslessTradingService;
