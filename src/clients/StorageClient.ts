/**
 * Client for interacting with TradingStorage and PairStorage contracts
 * Provides read-only access to trading data and pair information
 */

import { ethers } from 'ethers';
import type { Contract } from 'ethers';
import Decimal from 'decimal.js';
import { BlockchainProvider } from '../providers/BlockchainProvider';
import { NetworkConfig, Position, PendingLimitOrder, TradingPair } from '../types';
import { TradingStorageContractABI, PairStorageContractABI } from '../contracts';
import { formatUSDC } from '../utils/formatting';
import { handleError } from '../utils/errors';
import { NETWORKS } from '../constants/networks';
import type { PairStorageData, MarketData } from '../types/market';

export class StorageClient {
  private blockchain: BlockchainProvider;
  private tradingStorageContract?: Contract;
  private pairStorageContract?: Contract;
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
    
    // Initialize TradingStorage contract
    if (this.network.contracts.tradingStorage) {
      this.tradingStorageContract = new ethers.Contract(
        this.network.contracts.tradingStorage,
        TradingStorageContractABI,
        provider
      );
    }
    
    // Initialize PairStorage contract
    if (this.network.contracts.pairStorage) {
      this.pairStorageContract = new ethers.Contract(
        this.network.contracts.pairStorage,
        PairStorageContractABI,
        provider
      );
    }
  }

  /**
   * Gets all trades for a specific trader
   */
  public async getTrades(trader: string): Promise<any[]> {
    try {
      if (!this.tradingStorageContract) {
        return [];
      }
      
      const trades = await this.tradingStorageContract.getTrades(trader);
      return trades;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pending limit orders for a trader
   */
  public async getPendingLimitOrders(trader: string): Promise<PendingLimitOrder[]> {
    try {
      if (!this.tradingStorageContract) {
        return [];
      }
      
      const orders = await this.tradingStorageContract.getPendingLimitOrders(trader);
      
      return orders.map((order: any) => ({
        id: `${order.pairIndex}-${order.index}`,
        trader: order.trader,
        pairIndex: Number(order.pairIndex),
        orderIndex: Number(order.index),
        positionSize: new Decimal(formatUSDC(order.positionSize)),
        buy: order.buy,
        leverage: Number(order.leverage),
        openPrice: new Decimal(formatUSDC(order.openPrice)),
        tp: order.tp ? new Decimal(formatUSDC(order.tp)) : undefined,
        sl: order.sl ? new Decimal(formatUSDC(order.sl)) : undefined,
        timestamp: new Date(Number(order.timestamp) * 1000),
        orderType: order.orderType
      }));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets maximum open interest for a pair
   */
  public async getMaxOpenInterest(pairIndex: number): Promise<Decimal> {
    try {
      if (!this.pairStorageContract) {
        return new Decimal(0);
      }
      
      const maxOI = await this.pairStorageContract.getMaxOpenInterest(pairIndex);
      return new Decimal(formatUSDC(maxOI));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets current open interest for a pair
   */
  public async getOpenInterest(pairIndex: number, isLong: boolean): Promise<Decimal> {
    try {
      if (!this.pairStorageContract) {
        return new Decimal(0);
      }
      
      const oi = await this.pairStorageContract.getOpenInterest(pairIndex, isLong);
      return new Decimal(formatUSDC(oi));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets borrowing fees for a pair
   */
  public async getBorrowingFees(pairIndex: number, isLong: boolean): Promise<Decimal> {
    try {
      if (!this.pairStorageContract) {
        return new Decimal(0);
      }
      
      const fees = await this.pairStorageContract.getBorrowingFees(pairIndex, isLong);
      return new Decimal(formatUSDC(fees));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets pair spread
   */
  public async getPairSpread(pairIndex: number): Promise<number> {
    try {
      if (!this.pairStorageContract) {
        return 0;
      }
      
      const spread = await this.pairStorageContract.getPairSpread(pairIndex);
      return Number(spread) / 1e10; // Convert from basis points
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Checks if a pair is listed
   */
  public async isPairListed(pairIndex: number): Promise<boolean> {
    try {
      if (!this.pairStorageContract) {
        return false;
      }

      return await this.pairStorageContract.isPairListed(pairIndex);
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the total number of pairs available
   */
  public async getPairsCount(): Promise<number> {
    try {
      if (!this.pairStorageContract) {
        return 0;
      }

      const count = await this.pairStorageContract.pairsCount();
      return Number(count);
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets full pair data from the PairStorage contract
   * This includes feed IDs, leverage limits, spreads, etc.
   */
  public async getPairData(pairIndex: number): Promise<PairStorageData> {
    try {
      if (!this.pairStorageContract) {
        throw new Error('PairStorage contract not available');
      }

      const pairData = await this.pairStorageContract.pairs(pairIndex);

      return {
        pairIndex,
        feed: {
          maxOpenDeviationP: Number(pairData.feed.maxOpenDeviationP),
          maxCloseDeviationP: Number(pairData.feed.maxCloseDeviationP),
          feedId: pairData.feed.feedId // bytes32 Pyth feed ID
        },
        backupFeed: {
          maxDeviationP: Number(pairData.backupFeed.maxDeviationP),
          feedId: pairData.backupFeed.feedId // address
        },
        spreadP: Number(pairData.spreadP),
        pnlSpreadP: Number(pairData.pnlSpreadP),
        leverages: {
          minLeverage: Number(pairData.leverages.minLeverage),
          maxLeverage: Number(pairData.leverages.maxLeverage),
          pnlMinLeverage: Number(pairData.leverages.pnlMinLeverage),
          pnlMaxLeverage: Number(pairData.leverages.pnlMaxLeverage)
        },
        priceImpactMultiplier: Number(pairData.priceImpactMultiplier),
        skewImpactMultiplier: Number(pairData.skewImpactMultiplier),
        groupIndex: Number(pairData.groupIndex),
        feeIndex: Number(pairData.feeIndex),
        values: {
          maxGainP: Number(pairData.values.maxGainP),
          maxSlP: Number(pairData.values.maxSlP),
          maxLongOiP: Number(pairData.values.maxLongOiP),
          maxShortOiP: Number(pairData.values.maxShortOiP),
          groupOpenInterestPecentage: Number(pairData.values.groupOpenInterestPecentage),
          maxWalletOI: Number(pairData.values.maxWalletOI),
          isUSDCAligned: pairData.values.isUSDCAligned
        }
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pair data from the contract dynamically
   * Only returns pairs with valid Pyth feed IDs
   */
  public async getAllPairsData(): Promise<PairStorageData[]> {
    try {
      if (!this.pairStorageContract) {
        return [];
      }

      const count = await this.getPairsCount();
      const pairsData: PairStorageData[] = [];

      console.log(`Fetching ${count} pairs from PairStorage contract...`);

      for (let i = 0; i < count; i++) {
        try {
          const pairData = await this.getPairData(i);
          // Only add pairs with valid feed IDs
          if (pairData.feed.feedId && pairData.feed.feedId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            pairsData.push(pairData);
          }
        } catch (error) {
          // Silently skip pairs that fail (likely don't exist yet)
          // This is expected for indices that haven't been initialized
        }
      }

      console.log(`Successfully fetched ${pairsData.length} valid pairs out of ${count} total`);
      return pairsData;
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