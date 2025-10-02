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