/**
 * PythClient - Client for interacting with Pyth Network price oracles
 *
 * Pyth Network provides real-time price feeds for various assets.
 * This client fetches price update data from the Pyth Hermes API,
 * which is required by Avantis trading contracts.
 *
 * Hermes API: https://hermes.pyth.network
 */

import { getPythFeedId, getPythFeedIds } from "../constants/pythFeeds";

export interface PythPriceUpdate {
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
}

export interface FormattedPythPrice {
  feedId: string;
  price: number; // Formatted price with exponent applied
  rawPrice: string; // Raw price from Pyth
  confidence: number; // Formatted confidence interval
  expo: number;
  publishTime: number;
}

export interface PythClientConfig {
  hermesUrl?: string;
  network?: "mainnet" | "testnet";
  socketApiUrl?: string;
}

export class PythClient {
  private readonly hermesUrl: string;
  private readonly socketApiUrl: string;
  private marketCache?: Map<string, string>; // pair name -> feed ID
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cacheRefreshPromise?: Promise<void>; // Prevent concurrent cache refreshes

  /**
   * Creates a new PythClient instance
   * @param config - Configuration options
   */
  constructor(config: PythClientConfig = {}) {
    // Use mainnet Hermes by default
    this.hermesUrl = config.hermesUrl || "https://hermes.pyth.network";
    this.socketApiUrl =
      config.socketApiUrl || "https://socket-api.avantisfi.com/v1/data";
  }

  /**
   * Fetches price update data for a single trading pair
   * Dynamically fetches the feed ID from Socket API
   * @param pair - The trading pair name (e.g., 'BTC/USD', 'TRUMP/USD')
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateData(pair: string): Promise<string[]> {
    try {
      const feedId = await this.getFeedIdForPair(pair);
      return await this.getPriceUpdateDataByFeedIds([feedId]);
    } catch (error) {
      throw new Error(
        `Failed to get price update data for ${pair}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Fetches price update data for multiple trading pairs
   * Dynamically fetches feed IDs from Socket API
   * @param pairs - Array of trading pair names
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateDataForPairs(pairs: string[]): Promise<string[]> {
    const feedIds = await Promise.all(
      pairs.map((pair) => this.getFeedIdForPair(pair))
    );
    return await this.getPriceUpdateDataByFeedIds(feedIds);
  }

  /**
   * Fetches price update data by feed IDs
   * @param feedIds - Array of Pyth price feed IDs
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateDataByFeedIds(
    feedIds: string[]
  ): Promise<string[]> {
    try {
      // Construct the API URL with feed IDs as query parameters
      const params = new URLSearchParams();
      feedIds.forEach((id) => params.append("ids[]", id));

      const url = `${this.hermesUrl}/api/latest_vaas?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Pyth API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // The Hermes API returns an array of base64-encoded VAA (Verifiable Action Approval) data
      // These are the price update bytes that need to be passed to Avantis contracts
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No price update data received from Pyth");
      }

      // Convert base64 strings to hex strings with 0x prefix
      return data.map(
        (vaa: string) => `0x${Buffer.from(vaa, "base64").toString("hex")}`
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Pyth price data: ${error.message}`);
      }
      throw new Error("Failed to fetch Pyth price data: Unknown error");
    }
  }

  /**
   * Gets the latest price for a trading pair (for display/informational purposes)
   * Note: This does NOT return update data needed for transactions
   * This method dynamically fetches the feed ID from Socket API
   * @param pair - The trading pair name (e.g., 'BTC/USD', 'TRUMP/USD')
   * @returns Price information
   */
  public async getLatestPrice(pair: string): Promise<PythPriceUpdate> {
    try {
      const feedId = await this.getFeedIdForPair(pair);
      return await this.getLatestPriceByFeedId(feedId);
    } catch (error) {
      throw new Error(
        `Failed to get latest price for ${pair}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Dynamically fetches the Pyth feed ID for a trading pair from Socket API
   * Uses caching to minimize API calls
   * @param pair - The trading pair name (e.g., 'BTC/USD')
   * @returns The Pyth feed ID
   */
  private async getFeedIdForPair(pair: string): Promise<string> {
    // Check if cache needs refresh
    if (
      !this.marketCache ||
      Date.now() - this.cacheTimestamp > this.CACHE_TTL_MS
    ) {
      // If a refresh is already in progress, wait for it
      if (this.cacheRefreshPromise) {
        await this.cacheRefreshPromise;
      } else {
        await this.refreshMarketCache();
      }
    }

    const feedId = this.marketCache?.get(pair);
    if (!feedId) {
      // Try the legacy hardcoded map as fallback
      try {
        return getPythFeedId(pair);
      } catch {
        throw new Error(
          `Market not found: ${pair}\n` +
            `Available markets: ${Array.from(this.marketCache?.keys() || []).join(", ")}`
        );
      }
    }
    return feedId;
  }

  /**
   * Refreshes the market cache from Socket API
   * @private
   */
  private async refreshMarketCache(): Promise<void> {
    // Prevent concurrent refreshes
    if (this.cacheRefreshPromise) {
      return this.cacheRefreshPromise;
    }

    this.cacheRefreshPromise = (async () => {
      try {
        const response = await fetch(this.socketApiUrl);
        if (!response.ok) {
          throw new Error(
            `Socket API request failed: ${response.status} ${response.statusText}`
          );
        }

        const data: any = await response.json();
        const pairInfos = data.data.pairInfos;

        this.marketCache = new Map();

        // Build map of pair name -> feed ID
        for (const [index, pairInfo] of Object.entries(pairInfos)) {
          if (pairInfo && (pairInfo as any).from && (pairInfo as any).to) {
            const pair = pairInfo as any;
            const pairName = `${pair.from}/${pair.to}`;
            const feedId = pair.feed.feedId;
            this.marketCache.set(pairName, feedId);
          }
        }

        this.cacheTimestamp = Date.now();
        console.log(
          `Refreshed market cache: ${this.marketCache.size} markets available`
        );
      } catch (error) {
        console.warn(
          "Failed to refresh market cache from Socket API:",
          error instanceof Error ? error.message : error
        );
        // If cache refresh fails, keep using old cache if available
        if (!this.marketCache) {
          throw new Error(
            "Failed to initialize market cache and no fallback available"
          );
        }
      } finally {
        this.cacheRefreshPromise = undefined;
      }
    })();

    return this.cacheRefreshPromise;
  }

  /**
   * Formats a raw Pyth price by applying the exponent
   * @param priceUpdate - Raw price update from Pyth
   * @returns Formatted price with exponent applied
   */
  public formatPythPrice(priceUpdate: PythPriceUpdate): FormattedPythPrice {
    const rawPrice = BigInt(priceUpdate.price);
    const rawConf = BigInt(priceUpdate.conf);
    const expo = priceUpdate.expo;

    // Calculate the actual price: rawPrice * 10^expo
    // For negative exponents (most common), this divides the price
    const formattedPrice = Number(rawPrice) * Math.pow(10, expo);
    const formattedConf = Number(rawConf) * Math.pow(10, expo);

    return {
      feedId: priceUpdate.feedId,
      price: formattedPrice,
      rawPrice: priceUpdate.price,
      confidence: formattedConf,
      expo: expo,
      publishTime: priceUpdate.publishTime,
    };
  }

  /**
   * Gets the latest price by Pyth feed ID (for display/informational purposes)
   * This method accepts feed IDs directly from contracts
   * @param feedId - The Pyth feed ID (bytes32 hex string)
   * @returns Price information
   */
  public async getLatestPriceByFeedId(
    feedId: string
  ): Promise<PythPriceUpdate> {
    try {
      // Remove 0x prefix if present for Pyth API
      const cleanFeedId = feedId.startsWith("0x") ? feedId.slice(2) : feedId;
      const url = `${this.hermesUrl}/api/latest_price_feeds?ids[]=${cleanFeedId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Pyth API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No price data received from Pyth");
      }

      const priceData = data[0];
      const price = priceData.price;

      // Restore 0x prefix for consistency with feed IDs from contracts
      const feedIdWithPrefix = priceData.id.startsWith("0x")
        ? priceData.id
        : `0x${priceData.id}`;

      return {
        feedId: feedIdWithPrefix,
        price: price.price,
        conf: price.conf,
        expo: price.expo,
        publishTime: price.publish_time,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Pyth price: ${error.message}`);
      }
      throw new Error("Failed to fetch Pyth price: Unknown error");
    }
  }

  /**
   * Gets the latest formatted price by Pyth feed ID
   * Returns the price with exponent already applied for easy display
   * @param feedId - The Pyth feed ID (bytes32 hex string)
   * @returns Formatted price information
   */
  public async getFormattedPriceByFeedId(
    feedId: string
  ): Promise<FormattedPythPrice> {
    const rawPrice = await this.getLatestPriceByFeedId(feedId);
    return this.formatPythPrice(rawPrice);
  }

  /**
   * Gets latest prices for multiple feed IDs
   * Useful for batch fetching prices from contract-provided feed IDs
   * @param feedIds - Array of Pyth feed IDs (bytes32 hex strings)
   * @returns Map of feed ID to price data
   */
  public async getLatestPricesByFeedIds(
    feedIds: string[]
  ): Promise<Map<string, PythPriceUpdate>> {
    try {
      const params = new URLSearchParams();
      // Remove 0x prefix if present for Pyth API
      feedIds.forEach((id) => {
        const cleanId = id.startsWith("0x") ? id.slice(2) : id;
        params.append("ids[]", cleanId);
      });

      const url = `${this.hermesUrl}/api/latest_price_feeds?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Pyth API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid response from Pyth");
      }

      const priceMap = new Map<string, PythPriceUpdate>();
      for (const priceData of data) {
        const price = priceData.price;
        // Restore 0x prefix for consistency with feed IDs from contracts
        const feedIdWithPrefix = priceData.id.startsWith("0x")
          ? priceData.id
          : `0x${priceData.id}`;
        priceMap.set(feedIdWithPrefix, {
          feedId: feedIdWithPrefix,
          price: price.price,
          conf: price.conf,
          expo: price.expo,
          publishTime: price.publish_time,
        });
      }

      return priceMap;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Pyth prices: ${error.message}`);
      }
      throw new Error("Failed to fetch Pyth prices: Unknown error");
    }
  }

  /**
   * Gets the configured Hermes URL
   */
  public getHermesUrl(): string {
    return this.hermesUrl;
  }
}
