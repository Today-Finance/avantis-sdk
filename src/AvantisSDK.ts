/**
 * AvantisSDK - Main SDK class that provides unified access to all Avantis functionality
 */

import { TraderClient } from './clients/TraderClient';
import { FeedClient } from './clients/FeedClient';
import { StorageClient } from './clients/StorageClient';
import { PriceClient } from './clients/PriceClient';
import { PythClient } from './clients/PythClient';
import type { SignerConfig } from './types';
import { NETWORKS } from './constants/networks';

export class AvantisSDK {
  public readonly trader: TraderClient;
  public readonly feed: FeedClient;
  public readonly storage: StorageClient;
  public readonly price: PriceClient;
  public readonly pyth: PythClient;

  private readonly networkName: keyof typeof NETWORKS;
  
  /**
   * Creates a new instance of the Avantis SDK
   * @param networkName - The network to connect to ('base', 'base-sepolia', etc.)
   * @param customRpcUrl - Optional custom RPC URL
   */
  constructor(
    networkName: keyof typeof NETWORKS = 'base',
    customRpcUrl?: string
  ) {
    this.networkName = networkName;

    // Initialize all clients
    this.trader = new TraderClient(networkName, customRpcUrl);
    this.feed = new FeedClient({ network: networkName }); // FeedClient uses different config
    this.storage = new StorageClient(networkName, customRpcUrl);
    this.price = new PriceClient(networkName, customRpcUrl);
    this.pyth = new PythClient({
      network: networkName === 'base-sepolia' ? 'testnet' : 'mainnet'
    });
  }
  
  /**
   * Sets the signer for all clients
   * @param config - The signer configuration
   */
  public async setSigner(config: SignerConfig): Promise<void> {
    // Set signer for all clients
    await Promise.all([
      this.trader.setSigner(config),
      // Feed, Storage, and Price clients may also need signers for certain operations
      // Add them here if they have setSigner methods
    ]);
  }
  
  /**
   * Gets the current network name
   */
  public getNetwork(): string {
    return this.networkName;
  }
  
  /**
   * Gets the current account address from the trader client
   */
  public async getAddress(): Promise<string> {
    return await this.trader.getAddress();
  }
  
  /**
   * Disconnects all clients
   */
  public disconnect(): void {
    this.trader.disconnect();
    // Add disconnect for other clients if they have this method
  }
  
  /**
   * Gets all pending limit orders for the current account
   */
  public async getPendingLimitOrders(): Promise<any[]> {
    return await this.trader.getPendingLimitOrders();
  }

  /**
   * Gets the SDK version
   */
  public getVersion(): string {
    return '1.0.0';
  }
}