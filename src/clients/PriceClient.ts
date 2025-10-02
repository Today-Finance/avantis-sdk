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
  public async getPairInfo(pairIndex: number): Promise<PairInfo> {
    try {
      if (!this.pairInfosContract) {
        throw new Error('PairInfos contract not available');
      }
      
      const info = await this.pairInfosContract.pairInfo(pairIndex);
      
      return {
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
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pair infos
   */
  public async getAllPairInfos(): Promise<PairInfo[]> {
    try {
      if (!this.pairInfosContract) {
        throw new Error('PairInfos contract not available');
      }
      
      const count = await this.pairInfosContract.pairsCount();
      const pairInfos: PairInfo[] = [];
      
      for (let i = 0; i < Number(count); i++) {
        try {
          const info = await this.getPairInfo(i);
          pairInfos.push(info);
        } catch {
          // Skip invalid pairs
        }
      }
      
      return pairInfos;
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