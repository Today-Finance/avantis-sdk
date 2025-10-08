/**
 * AvantisSDK - Main SDK class that provides unified access to all Avantis functionality
 */

import { TraderClient } from './clients/TraderClient';
import { FeedClient } from './clients/FeedClient';
import { StorageClient } from './clients/StorageClient';
import { PriceClient } from './clients/PriceClient';
import { PythClient } from './clients/PythClient';
import { SocketAPIClient } from './clients/SocketAPIClient';
import type { SignerConfig } from './types';
import type { MarketData } from './types/market';
import { NETWORKS } from './constants/networks';

export class AvantisSDK {
  public readonly trader: TraderClient;
  public readonly feed: FeedClient;
  public readonly storage: StorageClient;
  public readonly price: PriceClient;
  public readonly pyth: PythClient;
  public readonly socketAPI: SocketAPIClient;

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
    this.socketAPI = new SocketAPIClient();
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
   * Gets all available markets from the contract dynamically
   * Combines data from PairStorage (feed IDs, leverage) and PairInfos (names)
   * @param useCache - Whether to use cached data (default: true)
   * @param onProgress - Optional callback to track progress
   */
  public async getAllMarkets(
    useCache: boolean = true,
    onProgress?: (current: number, total: number) => void
  ): Promise<MarketData[]> {
    // Get all pair data from PairStorage contract (feed IDs, leverage, spreads)
    const pairsData = await this.storage.getAllPairsData();
    const markets: MarketData[] = [];

    console.log(`Processing ${pairsData.length} valid pairs...`);

    for (let i = 0; i < pairsData.length; i++) {
      const pairData = pairsData[i];

      try {
        // Fetch pair name and metadata from PairInfos contract
        const pairInfo = await this.price.getPairInfosData(pairData.pairIndex);

        // Combine and format data properly
        const market: MarketData = {
          pairIndex: pairData.pairIndex,
          name: pairInfo.name,
          from: pairInfo.from,
          to: pairInfo.to,
          pythFeedId: pairData.feed.feedId, // bytes32 hex string
          spreadPercent: pairData.spreadP / 1e10, // Convert from 10 decimals to percentage
          minLeverage: pairData.leverages.minLeverage / 1e10, // Convert from 10 decimals
          maxLeverage: pairData.leverages.maxLeverage / 1e10, // Convert from 10 decimals
          minPositionSizeUSDC: pairInfo.minPositionSize,
          maxPositionSizeUSDC: pairInfo.maxPositionSize,
          maxOpenInterestLong: pairInfo.maxOpenInterestLong,
          maxOpenInterestShort: pairInfo.maxOpenInterestShort,
          groupIndex: pairData.groupIndex,
          feeIndex: pairData.feeIndex,
          priceImpactMultiplier: pairData.priceImpactMultiplier,
          skewImpactMultiplier: pairData.skewImpactMultiplier,
          isUSDCAligned: pairData.values.isUSDCAligned
        };

        markets.push(market);

        if (onProgress) {
          onProgress(i + 1, pairsData.length);
        }
      } catch (error) {
        console.warn(`Failed to fetch info for pair ${pairData.pairIndex}:`, error instanceof Error ? error.message : error);
        // Continue with next pair
      }
    }

    console.log(`Successfully processed ${markets.length}/${pairsData.length} markets`);
    return markets;
  }

  /**
   * Gets all markets with their current prices from Pyth
   * @param useCache - Whether to use cached pair data (default: true)
   * @param onProgress - Optional callback to track progress
   */
  public async getAllMarketsWithPrices(
    useCache: boolean = true,
    onProgress?: (current: number, total: number) => void
  ): Promise<MarketData[]> {
    // Get all markets with formatted data
    const markets = await this.getAllMarkets(useCache, onProgress);

    // Extract feed IDs from markets
    const feedIds = markets
      .map(market => market.pythFeedId)
      .filter(feedId => feedId && feedId !== '0x0000000000000000000000000000000000000000000000000000000000000000');

    // Fetch prices from Pyth in batch
    console.log(`Fetching prices for ${feedIds.length} markets from Pyth...`);
    const prices = await this.pyth.getLatestPricesByFeedIds(feedIds);

    // Add price data to markets
    return markets.map(market => {
      const pythPrice = prices.get(market.pythFeedId);
      if (pythPrice) {
        return {
          ...market,
          currentPrice: {
            price: pythPrice.price,
            confidence: pythPrice.conf,
            expo: pythPrice.expo,
            publishTime: pythPrice.publishTime
          }
        };
      }
      return market;
    });
  }

  /**
   * Gets all markets from the Avantis Socket API (recommended)
   * This method fetches all 91 trading pairs with complete metadata
   * @param useCache - Whether to use cached data (default: true)
   */
  public async getAllMarketsFromAPI(useCache: boolean = true): Promise<MarketData[]> {
    return await this.socketAPI.getAllMarkets(useCache);
  }

  /**
   * Gets all markets from the Socket API with current Pyth prices
   * @param useCache - Whether to use cached market data (default: true)
   */
  public async getAllMarketsFromAPIWithPrices(useCache: boolean = true): Promise<MarketData[]> {
    // Get all markets from Socket API
    const markets = await this.socketAPI.getAllMarkets(useCache);

    // Extract feed IDs
    const feedIds = markets
      .map(market => market.pythFeedId)
      .filter(feedId => feedId && feedId !== '0x0000000000000000000000000000000000000000000000000000000000000000');

    // Fetch prices from Pyth in batch
    console.log(`Fetching prices for ${feedIds.length} markets from Pyth...`);
    const prices = await this.pyth.getLatestPricesByFeedIds(feedIds);

    // Add price data to markets
    return markets.map(market => {
      const pythPrice = prices.get(market.pythFeedId);
      if (pythPrice) {
        return {
          ...market,
          currentPrice: {
            price: pythPrice.price,
            confidence: pythPrice.conf,
            expo: pythPrice.expo,
            publishTime: pythPrice.publishTime
          }
        };
      }
      return market;
    });
  }

  /**
   * Gets markets by asset type (crypto, forex, stocks, etc.)
   * @param assetType - The asset type to filter by (e.g., 'Crypto', 'Forex', 'Stocks')
   */
  public async getMarketsByType(assetType: string): Promise<MarketData[]> {
    return await this.socketAPI.getMarketsByType(assetType);
  }

  /**
   * Gets all available asset types
   */
  public async getAssetTypes(): Promise<string[]> {
    return await this.socketAPI.getAssetTypes();
  }

  /**
   * Gets a specific market by pair index from the Socket API
   * @param pairIndex - The pair index
   * @param useCache - Whether to use cached data (default: true)
   */
  public async getMarketByIndex(pairIndex: number, useCache: boolean = true): Promise<MarketData | null> {
    return await this.socketAPI.getMarket(pairIndex, useCache);
  }

  /**
   * Gets the total open interest across all markets
   */
  public async getTotalOpenInterest(): Promise<{ long: number; short: number }> {
    return await this.socketAPI.getTotalOpenInterest();
  }

  /**
   * Refreshes market data from the contract (bypasses cache)
   */
  public async refreshMarkets(onProgress?: (current: number, total: number) => void) {
    return await this.price.refreshPairInfos(onProgress);
  }

  /**
   * Clears all cached market data (both on-chain and API)
   */
  public clearMarketCache(): void {
    this.price.clearCache();
    this.socketAPI.clearCache();
  }

  /**
   * Gets the SDK version
   */
  public getVersion(): string {
    return '1.0.0';
  }

  /**
   * Gets the pair index for a given pair name from the Socket API
   * @param pairName - The pair name (e.g., "ETH/USD", "BTC/USD")
   * @param useCache - Whether to use cached data (default: true)
   * @returns The pair index or null if not found
   */
  public async getPairIndexByName(pairName: string, useCache: boolean = true): Promise<number | null> {
    const markets = await this.getAllMarketsFromAPI(useCache);
    const market = markets.find(m => m.name.toUpperCase() === pairName.toUpperCase());
    return market ? market.pairIndex : null;
  }

  /**
   * Gets the pair name for a given index from the Socket API
   * @param pairIndex - The pair index
   * @param useCache - Whether to use cached data (default: true)
   * @returns The pair name or null if not found
   */
  public async getPairNameByIndex(pairIndex: number, useCache: boolean = true): Promise<string | null> {
    const market = await this.getMarketByIndex(pairIndex, useCache);
    return market ? market.name : null;
  }

  /**
   * Gets all pair names from the Socket API
   * @param useCache - Whether to use cached data (default: true)
   * @returns Array of all pair names
   */
  public async getAllPairNames(useCache: boolean = true): Promise<string[]> {
    const markets = await this.getAllMarketsFromAPI(useCache);
    return markets.map(m => m.name);
  }
}