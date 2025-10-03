/**
 * PythClient - Client for interacting with Pyth Network price oracles
 *
 * Pyth Network provides real-time price feeds for various assets.
 * This client fetches price update data from the Pyth Hermes API,
 * which is required by Avantis trading contracts.
 *
 * Hermes API: https://hermes.pyth.network
 */

import { getPythFeedId, getPythFeedIds } from '../constants/pythFeeds';

export interface PythPriceUpdate {
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
}

export interface PythClientConfig {
  hermesUrl?: string;
  network?: 'mainnet' | 'testnet';
}

export class PythClient {
  private readonly hermesUrl: string;

  /**
   * Creates a new PythClient instance
   * @param config - Configuration options
   */
  constructor(config: PythClientConfig = {}) {
    // Use mainnet Hermes by default
    this.hermesUrl = config.hermesUrl || 'https://hermes.pyth.network';
  }

  /**
   * Fetches price update data for a single trading pair
   * @param pair - The trading pair name (e.g., 'BTC/USD')
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateData(pair: string): Promise<string[]> {
    const feedId = getPythFeedId(pair);
    return await this.getPriceUpdateDataByFeedIds([feedId]);
  }

  /**
   * Fetches price update data for multiple trading pairs
   * @param pairs - Array of trading pair names
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateDataForPairs(pairs: string[]): Promise<string[]> {
    const feedIds = getPythFeedIds(pairs);
    return await this.getPriceUpdateDataByFeedIds(feedIds);
  }

  /**
   * Fetches price update data by feed IDs
   * @param feedIds - Array of Pyth price feed IDs
   * @returns Price update data as bytes array
   */
  public async getPriceUpdateDataByFeedIds(feedIds: string[]): Promise<string[]> {
    try {
      // Construct the API URL with feed IDs as query parameters
      const params = new URLSearchParams();
      feedIds.forEach(id => params.append('ids[]', id));

      const url = `${this.hermesUrl}/api/latest_vaas?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Pyth API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // The Hermes API returns an array of base64-encoded VAA (Verifiable Action Approval) data
      // These are the price update bytes that need to be passed to Avantis contracts
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No price update data received from Pyth');
      }

      // Convert base64 strings to hex strings with 0x prefix
      return data.map((vaa: string) => `0x${Buffer.from(vaa, 'base64').toString('hex')}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Pyth price data: ${error.message}`);
      }
      throw new Error('Failed to fetch Pyth price data: Unknown error');
    }
  }

  /**
   * Gets the latest price for a trading pair (for display/informational purposes)
   * Note: This does NOT return update data needed for transactions
   * @param pair - The trading pair name
   * @returns Price information
   */
  public async getLatestPrice(pair: string): Promise<PythPriceUpdate> {
    const feedId = getPythFeedId(pair);

    try {
      const url = `${this.hermesUrl}/api/latest_price_feeds?ids[]=${feedId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Pyth API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No price data received from Pyth');
      }

      const priceData = data[0];
      const price = priceData.price;

      return {
        feedId: priceData.id,
        price: price.price,
        conf: price.conf,
        expo: price.expo,
        publishTime: price.publish_time
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Pyth price: ${error.message}`);
      }
      throw new Error('Failed to fetch Pyth price: Unknown error');
    }
  }

  /**
   * Gets the configured Hermes URL
   */
  public getHermesUrl(): string {
    return this.hermesUrl;
  }
}
