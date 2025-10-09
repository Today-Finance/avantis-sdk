/**
 * Client for interacting with Avantis Socket API
 * Provides access to complete market data including all 91 trading pairs
 */

import Decimal from 'decimal.js';
import { handleError } from '../utils/errors';
import type { MarketData } from '../types/market';
import type {
  SocketAPIResponse,
  SocketAPIPairInfo
} from '../types/socket-api';

export class SocketAPIClient {
  private readonly apiUrl: string;
  private cache: Map<number, any> = new Map();
  private allMarketsCache: MarketData[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(apiUrl: string = 'https://socket-api.avantisfi.com/v1/data') {
    this.apiUrl = apiUrl;
  }

  /**
   * Fetches raw data from Avantis Socket API
   */
  private async fetchSocketData(): Promise<SocketAPIResponse> {
    try {
      const response = await fetch(this.apiUrl);

      if (!response.ok) {
        throw new Error(`Socket API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as SocketAPIResponse;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Converts Socket API pair info to MarketData format
   */
  private convertToMarketData(pairInfo: SocketAPIPairInfo): MarketData {
    return {
      pairIndex: pairInfo.index,
      name: `${pairInfo.from}/${pairInfo.to}`,
      from: pairInfo.from,
      to: pairInfo.to,
      pythFeedId: pairInfo.feed.feedId,
      spreadPercent: pairInfo.spreadP, // API returns already as decimal percentage
      minLeverage: pairInfo.leverages.minLeverage, // API returns as actual leverage value
      maxLeverage: pairInfo.leverages.maxLeverage, // API returns as actual leverage value
      minPositionSizeUSDC: new Decimal(pairInfo.minLevPosUSDC || 0), // API already in USDC
      maxPositionSizeUSDC: new Decimal(0), // Not provided by API
      maxOpenInterestLong: new Decimal(pairInfo.openInterest?.long || pairInfo.pairOI?.long || 0),
      maxOpenInterestShort: new Decimal(pairInfo.openInterest?.short || pairInfo.pairOI?.short || 0),
      groupIndex: pairInfo.groupIndex,
      feeIndex: pairInfo.feeIndex,
      priceImpactMultiplier: pairInfo.priceImpactMultiplier,
      skewImpactMultiplier: pairInfo.skewImpactMultiplier,
      isUSDCAligned: pairInfo.values.isUSDCAligned
    };
  }

  /**
   * Gets all available markets from the Socket API
   * @param useCache - Whether to use cached data (default: true)
   */
  public async getAllMarkets(useCache: boolean = true): Promise<MarketData[]> {
    try {
      // Check cache
      if (useCache && this.allMarketsCache && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
        return this.allMarketsCache;
      }

      console.log('Fetching markets from Avantis Socket API...');
      const response = await this.fetchSocketData();

      const pairInfos = response.data.pairInfos;
      const markets: any[] = [];

      // Convert all pairs to MarketData
      for (const [index, pairInfo] of Object.entries(pairInfos)) {
        if (pairInfo && pairInfo.from && pairInfo.to) {
          const market = this.convertToMarketData(pairInfo);
          markets.push(market);
          this.cache.set(parseInt(index), market);
        }
      }

      // Sort by pair index
      markets.sort((a, b) => a.pairIndex - b.pairIndex);

      console.log(`Successfully fetched ${markets.length} markets from Socket API`);

      // Update cache
      this.allMarketsCache = markets;
      this.cacheTimestamp = Date.now();

      return markets;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets a specific market by pair index
   * @param pairIndex - The pair index to fetch
   * @param useCache - Whether to use cached data (default: true)
   */
  public async getMarket(pairIndex: number, useCache: boolean = true): Promise<MarketData | null> {
    try {
      // Check cache
      if (useCache && this.cache.has(pairIndex)) {
        const cached = this.cache.get(pairIndex)!;
        if (Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
          return cached;
        }
      }

      // Fetch all markets and return the specific one
      const markets = await this.getAllMarkets(useCache);
      return markets.find(m => m.pairIndex === pairIndex) || null;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets markets by asset type (crypto, forex, stocks, etc.)
   * @param assetType - The asset type to filter by
   */
  public async getMarketsByType(assetType: string): Promise<MarketData[]> {
    try {
      const response = await this.fetchSocketData();
      const pairInfos = response.data.pairInfos;
      const markets: MarketData[] = [];

      for (const [index, pairInfo] of Object.entries(pairInfos)) {
        if (pairInfo?.feed?.attributes?.asset_type?.toLowerCase() === assetType.toLowerCase()) {
          markets.push(this.convertToMarketData(pairInfo));
        }
      }

      return markets.sort((a, b) => a.pairIndex - b.pairIndex);
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all available asset types
   */
  public async getAssetTypes(): Promise<string[]> {
    try {
      const response = await this.fetchSocketData();
      const pairInfos = response.data.pairInfos;
      const types = new Set<string>();

      for (const pairInfo of Object.values(pairInfos)) {
        if (pairInfo?.feed?.attributes?.asset_type) {
          types.add(pairInfo.feed.attributes.asset_type);
        }
      }

      return Array.from(types).sort();
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Clears the cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.allMarketsCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Gets the total open interest across all markets
   */
  public async getTotalOpenInterest(): Promise<{ long: number; short: number }> {
    try {
      const response = await this.fetchSocketData();
      return response.data.totalOi;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the data version from the API
   */
  public async getDataVersion(): Promise<string> {
    try {
      const response = await this.fetchSocketData();
      return response.data.dataVersion;
    } catch (error) {
      throw handleError(error);
    }
  }
}
