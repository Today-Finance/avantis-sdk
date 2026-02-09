/**
 * Gelato Gasless Transaction Executor
 *
 * Provides gasless transaction execution via Gelato's relay infrastructure.
 * Uses EIP-7702 smart accounts so the user's EOA address stays the same.
 */

import {
  encodeAbiParameters,
  type Account,
  type Hash,
  type Hex,
  type WalletClient,
} from "viem";
import {
  toGelatoSmartAccount,
  createGelatoEvmRelayerClient,
} from "@gelatocloud/gasless";

/**
 * Encode nonce for Gelato transactions
 * @param key - Up to 192 bits for key
 * @param seq - Up to 64 bits for sequence
 */
export function encodeNonce(key: bigint, seq: bigint): bigint {
  return (key << 64n) | seq;
}

/**
 * Gets the data suffix for Avantis builder code using ERC-8021 encoding.
 * Format: ABI-encoded string[] of codes + 0x8021 magic suffix
 * @param builderCode - The builder code string (e.g., 'bc_scxiima9')
 * @returns Hex-encoded data suffix
 */
export function getBuilderCodeSuffix(builderCode: string): Hex {
  // ERC-8021 Attribution: ABI-encode the codes array and append magic bytes
  const encoded = encodeAbiParameters(
    [{ type: "string[]", name: "codes" }],
    [[builderCode]]
  );
  // Append ERC-8021 magic suffix (0x8021)
  return (encoded + "8021") as Hex;
}

export interface GelatoConfig {
  /** Gelato API key for relay access */
  apiKey: string;
  /** The viem Account (LocalAccount) that owns the smart account */
  account: Account;
  /** A viem WalletClient for the account (used by Gelato smart account) */
  walletClient: WalletClient;
  /** Optional Avantis builder code for attribution tracking */
  builderCode?: string;
}

export interface GelatoTransactionParams {
  /** Target contract address */
  to: string;
  /** Encoded calldata */
  data: Hex;
  /** ETH value to send (default: 0) */
  value?: bigint;
}

export interface GelatoTransactionResult {
  /** Transaction hash */
  hash: Hash;
  /** Whether the transaction was included successfully */
  success: boolean;
}

/**
 * GelatoExecutor handles gasless transaction execution via Gelato relay.
 *
 * It wraps the user's EOA into an EIP-7702 smart account (same address)
 * and routes transactions through Gelato's sponsored relay.
 */
export class GelatoExecutor {
  private config: GelatoConfig;
  private walletClient: WalletClient;
  private gelatoAccount: any; // Gelato SmartAccount type
  private builderCodeSuffix?: Hex;
  private initialized: boolean = false;

  constructor(config: GelatoConfig) {
    this.config = config;

    // Use the provided wallet client directly (avoids TypeScript recursion issues)
    this.walletClient = config.walletClient;

    // Pre-compute builder code suffix if provided
    if (config.builderCode) {
      this.builderCodeSuffix = getBuilderCodeSuffix(config.builderCode);
    }
  }

  /**
   * Initialize the Gelato smart account (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Type assertion needed due to viem generic type conflicts with Gelato SDK types
    this.gelatoAccount = (toGelatoSmartAccount as any)({
      client: this.walletClient,
      owner: this.config.account,
    });

    this.initialized = true;
  }

  /**
   * Execute a transaction via Gelato relay (gasless)
   *
   * @param params - Transaction parameters (to, data, value)
   * @returns Transaction result with hash and success status
   * @throws Error if Gelato relay fails
   */
  async execute(
    params: GelatoTransactionParams
  ): Promise<GelatoTransactionResult> {
    await this.ensureInitialized();

    const deployed = await this.gelatoAccount.isDeployed();

    const calls = [
      {
        to: params.to,
        data: params.data,
        value: params.value ?? BigInt(0),
      },
    ];

    const authorization = deployed
      ? undefined
      : await this.gelatoAccount.signAuthorization();
    const authorizationList = authorization ? [authorization] : undefined;

    const data = await this.gelatoAccount.encodeCallData({
      calls,
      nonce: encodeNonce(BigInt(Date.now()), 0n),
    });

    // Append builder code suffix if configured
    const dataWithSuffix = this.builderCodeSuffix
      ? ((data + this.builderCodeSuffix.slice(2)) as Hex)
      : data;

    // Create Gelato relayer client with API key (sponsoring configured at dashboard level)
    const relayerClient = createGelatoEvmRelayerClient({
      apiKey: this.config.apiKey,
    });

    // sendTransactionSync waits for inclusion and returns a TransactionReceipt
    const receipt = await relayerClient.sendTransactionSync({
      authorizationList: authorizationList as any,
      chainId: this.gelatoAccount.chain.id,
      data: dataWithSuffix,
      to: this.gelatoAccount.address,
    });

    if (!receipt || !receipt.transactionHash) {
      throw new Error("Gelato relay returned no receipt");
    }

    return {
      hash: receipt.transactionHash as Hash,
      success: receipt.status === "success",
    };
  }

  /**
   * Get the Gelato smart account address
   * With EIP-7702, this is the same as the EOA address
   */
  async getSmartAccountAddress(): Promise<string> {
    await this.ensureInitialized();
    return this.gelatoAccount.address;
  }
}
