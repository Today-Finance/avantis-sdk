/**
 * Client for interacting with PriceAggregator and PairInfos contracts
 * Provides access to price feeds and pair configuration
 */

import { ethers } from 'ethers';
import type { Contract } from 'ethers';
import Decimal from 'decimal.js';
import { BlockchainProvider } from '../providers/BlockchainProvider';
import { NetworkConfig } from '../types';
import { PriceAggregatorContractABI, PairInfosContractABI } from '../contracts';
import { formatUSDC } from '../utils/formatting';
import { handleError } from '../utils/errors';
import { NETWORKS } from '../constants/networks';

export interface PairInfo {
  id: number;
  name: string;
  from: string;
  to: string;
  feed: string;
  spreadP: number;
  groupIndex: number;
  feeIndex: number;
  minLeverage: number;
  maxLeverage: number;
  minPositionSize: Decimal;
  maxPositionSize: Decimal;
  maxOpenInterestLong: Decimal;
  maxOpenInterestShort: Decimal;
}

export interface PriceData {
  price: Decimal;
  timestamp: Date;
  confidence: number;
}

export class PriceClient {
  private blockchain: BlockchainProvider;
  private priceAggregatorContract?: Contract;
  private pairInfosContract?: Contract;
  private network: NetworkConfig;
  private pairInfoCache: Map<number, PairInfo> = new Map();
  private allPairsCache: PairInfo[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    networkName: keyof typeof NETWORKS = 'base',
    customRpcUrl?: string
  ) {
    this.blockchain = new BlockchainProvider(networkName, customRpcUrl);
    this.network = this.blockchain.getNetwork();
    this.initializeContracts();
  }

  /**
   * Initializes smart contract instances
   */
  private initializeContracts(): void {
    const provider = this.blockchain.getProvider();
    
    // Initialize PriceAggregator contract
    if (this.network.contracts.priceAggregator) {
      this.priceAggregatorContract = new ethers.Contract(
        this.network.contracts.priceAggregator,
        PriceAggregatorContractABI,
        provider
      );
    }
    
    // Initialize PairInfos contract
    if (this.network.contracts.pairInfos) {
      this.pairInfosContract = new ethers.Contract(
        this.network.contracts.pairInfos,
        PairInfosContractABI,
        provider
      );
    }
  }

  /**
   * Gets the current price for a pair
   */
  public async getPrice(pairIndex: number): Promise<PriceData> {
    try {
      if (!this.priceAggregatorContract) {
        throw new Error('PriceAggregator contract not available');
      }
      
      const priceData = await this.priceAggregatorContract.getPrice(pairIndex);
      
      return {
        price: new Decimal(formatUSDC(priceData.price)),
        timestamp: new Date(Number(priceData.timestamp) * 1000),
        confidence: Number(priceData.confidence)
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets prices for multiple pairs
   */
  public async getMultiplePrices(pairIndices: number[]): Promise<Map<number, PriceData>> {
    try {
      if (!this.priceAggregatorContract) {
        throw new Error('PriceAggregator contract not available');
      }
      
      const prices = await this.priceAggregatorContract.getMultiplePrices(pairIndices);
      const priceMap = new Map<number, PriceData>();
      
      prices.forEach((priceData: any, index: number) => {
        priceMap.set(pairIndices[index], {
          price: new Decimal(formatUSDC(priceData.price)),
          timestamp: new Date(Number(priceData.timestamp) * 1000),
          confidence: Number(priceData.confidence)
        });
      });
      
      return priceMap;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets pair information
   */
  public async getPairInfo(pairIndex: number, useCache: boolean = true): Promise<PairInfo> {
    try {
      // Check cache first
      if (useCache && this.pairInfoCache.has(pairIndex)) {
        const cached = this.pairInfoCache.get(pairIndex)!;
        if (Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
          return cached;
        }
      }

      if (!this.pairInfosContract) {
        throw new Error('PairInfos contract not available');
      }

      const info = await this.pairInfosContract.pairInfo(pairIndex);

      const pairInfo: PairInfo = {
        id: pairIndex,
        name: info.name || `Pair ${pairIndex}`,
        from: info.from,
        to: info.to,
        feed: info.feed,
        spreadP: Number(info.spreadP) / 1e10,
        groupIndex: Number(info.groupIndex),
        feeIndex: Number(info.feeIndex),
        minLeverage: Number(info.minLeverage),
        maxLeverage: Number(info.maxLeverage),
        minPositionSize: new Decimal(formatUSDC(info.minPositionSize)),
        maxPositionSize: new Decimal(formatUSDC(info.maxPositionSize)),
        maxOpenInterestLong: new Decimal(formatUSDC(info.maxOpenInterestLong)),
        maxOpenInterestShort: new Decimal(formatUSDC(info.maxOpenInterestShort))
      };

      // Update cache
      this.pairInfoCache.set(pairIndex, pairInfo);

      return pairInfo;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pair infos dynamically from the contract
   * Note: This uses the blockchain provider to access PairStorage for the count
   * @param useCache - Whether to use cached data (default: true)
   * @param onProgress - Optional callback to track progress
   */
  public async getAllPairInfos(
    useCache: boolean = true,
    onProgress?: (current: number, total: number) => void
  ): Promise<PairInfo[]> {
    try {
      // Check cache first
      if (useCache && this.allPairsCache && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
        return this.allPairsCache;
      }

      if (!this.pairInfosContract) {
        throw new Error('PairInfos contract not available');
      }

      // Get pairs count from PairStorage contract
      const provider = this.blockchain.getProvider();
      const pairStorageAddress = this.network.contracts.pairStorage;
      if (!pairStorageAddress) {
        throw new Error('PairStorage contract address not configured');
      }

      // Normalize address to proper checksum format
      const normalizedAddress = ethers.getAddress(pairStorageAddress);

      // Simple ABI for pairsCount function
      const pairStorageAbi = ['function pairsCount() external view returns (uint256)'];
      const pairStorageContract = new ethers.Contract(normalizedAddress, pairStorageAbi, provider);

      const count = await pairStorageContract.pairsCount();
      const totalPairs = Number(count);
      const pairInfos: PairInfo[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      console.log(`Fetching ${totalPairs} pairs from PairInfos contract...`);

      for (let i = 0; i < totalPairs; i++) {
        try {
          const info = await this.getPairInfo(i, false); // Don't use cache during bulk fetch
          pairInfos.push(info);

          if (onProgress) {
            onProgress(i + 1, totalPairs);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ index: i, error: errorMsg });
          console.warn(`Failed to fetch pair ${i}: ${errorMsg}`);
          // Continue with next pair
        }
      }

      console.log(`Successfully fetched ${pairInfos.length}/${totalPairs} pairs`);
      if (errors.length > 0) {
        console.warn(`Failed to fetch ${errors.length} pairs:`, errors);
      }

      // Update cache
      this.allPairsCache = pairInfos;
      this.cacheTimestamp = Date.now();

      return pairInfos;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Clears the pair info cache and forces a refresh on next request
   */
  public clearCache(): void {
    this.pairInfoCache.clear();
    this.allPairsCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Refreshes all pair info from the contract
   */
  public async refreshPairInfos(onProgress?: (current: number, total: number) => void): Promise<PairInfo[]> {
    this.clearCache();
    return await this.getAllPairInfos(false, onProgress);
  }

  /**
   * Gets pair info from PairInfos contract by index
   * Note: PairInfos contract on Avantis stores fee/rollover data, not pair names
   * Pair names are derived from pair index
   */
  public async getPairInfosData(pairIndex: number): Promise<any> {
    try {
      // PairInfos doesn't have pair metadata like names - it only has fee/rollover info
      // We return basic structure with default values
      // Actual pair names could be fetched from a subgraph or off-chain source
      return {
        name: `Pair ${pairIndex}`,
        from: '',
        to: '',
        feed: '',
        spreadP: 0,
        groupIndex: 0,
        feeIndex: 0,
        minLeverage: 0,
        maxLeverage: 0,
        minPositionSize: new Decimal(0),
        maxPositionSize: new Decimal(0),
        maxOpenInterestLong: new Decimal(0),
        maxOpenInterestShort: new Decimal(0)
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets trading fees for a pair
   */
  public async getTradingFees(pairIndex: number): Promise<{
    openFee: number;
    closeFee: number;
    oracleFee: number;
    triggerOrderFee: number;
  }> {
    try {
      if (!this.pairInfosContract) {
        throw new Error('PairInfos contract not available');
      }
      
      const fees = await this.pairInfosContract.getTradingFees(pairIndex);
      
      return {
        openFee: Number(fees.openFee) / 1e10,
        closeFee: Number(fees.closeFee) / 1e10,
        oracleFee: Number(fees.oracleFee) / 1e10,
        triggerOrderFee: Number(fees.triggerOrderFee) / 1e10
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Checks if oracle prices are valid
   */
  public async isPriceValid(pairIndex: number): Promise<boolean> {
    try {
      if (!this.priceAggregatorContract) {
        return false;
      }
      
      return await this.priceAggregatorContract.isPriceValid(pairIndex);
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the network configuration
   */
  public getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Disconnects from the blockchain
   */
  public disconnect(): void {
    this.blockchain.disconnect();
  }
}