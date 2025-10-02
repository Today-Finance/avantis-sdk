import { ethers } from 'ethers';
import type { Contract } from 'ethers';
import Decimal from 'decimal.js';
import { EventEmitter } from 'eventemitter3';
import { BlockchainProvider } from '../providers/BlockchainProvider';
import {
  Position,
  OpenPositionParams,
  ClosePositionParams,
  UpdatePositionParams,
  CancelLimitOrderParams,
  UpdateLimitOrderParams,
  PendingLimitOrder,
  TradeResponse,
  AccountInfo,
  TradingPair,
  PositionSide,
  PositionStatus,
  OrderType,
  OrderTypeValue,
  SignerConfig,
  NetworkConfig
} from '../types';
import {
  validateAddress,
  validateLeverage,
  validatePositionSize,
  validateSlippage,
  validateTradingPair,
  validate,
  OpenPositionParamsSchema,
  ClosePositionParamsSchema,
  UpdatePositionParamsSchema
} from '../utils/validation';
import { getPairIndex, getPairName, getAllPairs, getPairsByCategory } from '../utils/pairs';
import {
  formatUSDC,
  toUSDCUnits,
  formatETH,
  toWei
} from '../utils/formatting';
import {
  TradingError,
  TransactionError,
  ValidationError,
  ErrorCode,
  handleError
} from '../utils/errors';
import { NETWORKS, TRADING_PAIRS, FEES, DEFAULTS } from '../constants/networks';
import { TradingContractABI, USDCContractABI, Multicall3ContractABI } from '../contracts';
import { FeeManager } from '../fees/FeeManager';
import { MulticallBundler } from '../fees/MulticallBundler';
import type { PlatformFeeConfig, PlatformFeeParams, FeeBreakdown } from '../types/platform-fees';

export class TraderClient extends EventEmitter {
  private blockchain: BlockchainProvider;
  private tradingContract?: ethers.Contract;
  private usdcContract!: ethers.Contract;
  private network: NetworkConfig;
  private positions: Map<string, Position> = new Map();
  private feeManager?: FeeManager;
  private multicallBundler?: MulticallBundler;

  constructor(
    networkName: keyof typeof NETWORKS = 'base',
    customRpcUrl?: string
  ) {
    super();
    this.blockchain = new BlockchainProvider(networkName, customRpcUrl);
    this.network = this.blockchain.getNetwork();
    
    // Initialize USDC contract (always needed)
    const provider = this.blockchain.getProvider();
    this.usdcContract = new ethers.Contract(
      this.network.contracts.usdc,
      USDCContractABI,
      provider
    );
    
    this.initializeContracts();
  }

  /**
   * Initializes smart contract instances
   */
  private initializeContracts(): void {
    const provider = this.blockchain.getProvider();
    
    // Initialize trading contract if available
    if (this.network.contracts.trading !== '0x0000000000000000000000000000000000000000') {
      this.tradingContract = new ethers.Contract(
        this.network.contracts.trading,
        TradingContractABI,
        provider
      );
    }
  }

  /**
   * Sets the signer for transactions
   */
  public async setSigner(config: SignerConfig): Promise<void> {
    this.blockchain.setSigner(config);
    
    // Reinitialize contracts with signer
    const signer = this.blockchain.getSigner();
    
    if (this.tradingContract) {
      this.tradingContract = this.tradingContract.connect(signer) as ethers.Contract;
    }
    
    this.usdcContract = this.usdcContract.connect(signer) as ethers.Contract;
    
    this.emit('signerSet', await signer.getAddress());
  }

  /**
   * Gets the current account address
   */
  public async getAddress(): Promise<string> {
    const signer = this.blockchain.getSigner();
    return await signer.getAddress();
  }

  /**
   * Gets the network configuration
   */
  public getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Gets account information
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      const address = await this.getAddress();
      const [balance, usdcBalance] = await Promise.all([
        this.blockchain.getBalance(),
        this.getUSDCBalance()
      ]);

      const positions = await this.getPositions();
      
      let totalCollateral = new Decimal(0);
      let marginUsed = new Decimal(0);
      let unrealizedPnl = new Decimal(0);
      let realizedPnl = new Decimal(0);

      for (const position of positions) {
        totalCollateral = totalCollateral.plus(position.collateral);
        marginUsed = marginUsed.plus(position.margin);
        unrealizedPnl = unrealizedPnl.plus(position.unrealizedPnl);
        realizedPnl = realizedPnl.plus(position.realizedPnl);
      }

      const freeCollateral = totalCollateral.minus(marginUsed);
      const equity = totalCollateral.plus(unrealizedPnl);
      const marginLevel = marginUsed.gt(0) 
        ? equity.div(marginUsed).mul(100).toNumber()
        : 100;

      return {
        address,
        balance: new Decimal(formatETH(balance)),
        usdcBalance,
        tradingAllowance: await this.getTradingAllowance(),
        totalCollateral,
        freeCollateral,
        marginUsed,
        unrealizedPnl,
        realizedPnl,
        positions,
        marginLevel
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets USDC balance
   */
  public async getUSDCBalance(address?: string): Promise<Decimal> {
    try {
      const addr = address || await this.getAddress();
      validateAddress(addr);
      
      const balance = await this.usdcContract.balanceOf(addr);
      return new Decimal(formatUSDC(balance));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets USDC allowance for trading
   */
  public async getTradingAllowance(address?: string): Promise<Decimal> {
    try {
      const addr = address || await this.getAddress();
      validateAddress(addr);
      
      if (!this.tradingContract) {
        return new Decimal(0);
      }
      
      const allowance = await this.usdcContract.allowance(
        addr,
        this.network.contracts.trading
      );
      
      return new Decimal(formatUSDC(allowance));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Approves USDC for trading
   */
  public async approveUSDCForTrading(
    amount: Decimal | number | string = '1000000'
  ): Promise<TradeResponse> {
    try {
      const amountDecimal = new Decimal(amount);
      const amountUnits = toUSDCUnits(amountDecimal);
      
      const tx = await this.usdcContract.approve(
        this.network.contracts.trading,
        amountUnits
      );
      
      const receipt = await tx.wait();
      
      this.emit('usdcApproved', {
        amount: amountDecimal,
        transactionHash: receipt.hash
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Opens a new trading position (market or limit order)
   */
  public async openPosition(params: OpenPositionParams): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(OpenPositionParamsSchema, params);
      
      // Check if trading contract is available
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Get pair index using our pair mapping
      const pairIndex = getPairIndex(params.pair);
      
      // Get pair configuration
      const pairConfig = TRADING_PAIRS[params.pair as keyof typeof TRADING_PAIRS];
      if (!pairConfig) {
        throw new TradingError(
          ErrorCode.INVALID_PAIR,
          `Trading pair not supported: ${params.pair}`,
          params.pair
        );
      }
      
      // Determine order type
      const orderType = params.orderType || OrderType.MARKET;
      let orderTypeValue: number;
      switch (orderType) {
        case OrderType.MARKET:
          orderTypeValue = OrderTypeValue.MARKET;
          break;
        case OrderType.LIMIT:
          orderTypeValue = OrderTypeValue.LIMIT;
          if (!params.openPrice) {
            throw new ValidationError('Open price is required for limit orders', 'openPrice');
          }
          break;
        case OrderType.STOP:
          orderTypeValue = OrderTypeValue.STOP;
          if (!params.openPrice) {
            throw new ValidationError('Stop price is required for stop orders', 'openPrice');
          }
          break;
        case OrderType.STOP_LIMIT:
          orderTypeValue = OrderTypeValue.STOP_LIMIT;
          if (!params.openPrice) {
            throw new ValidationError('Open price is required for stop-limit orders', 'openPrice');
          }
          break;
        default:
          orderTypeValue = OrderTypeValue.MARKET;
      }
      
      // Validate position size
      const size = validatePositionSize(
        params.size,
        new Decimal(pairConfig.minSize),
        new Decimal(pairConfig.maxSize)
      );
      
      // Validate leverage
      validateLeverage(params.leverage, pairConfig.maxLeverage);
      
      // Calculate collateral required
      const collateral = size.div(params.leverage);
      
      // Check USDC balance
      const balance = await this.getUSDCBalance();
      if (balance.lt(collateral)) {
        throw new TradingError(
          ErrorCode.INSUFFICIENT_COLLATERAL,
          `Insufficient USDC balance. Required: ${collateral.toFixed(2)}, Available: ${balance.toFixed(2)}`,
          params.pair
        );
      }
      
      // Check allowance
      const allowance = await this.getTradingAllowance();
      if (allowance.lt(collateral)) {
        throw new TradingError(
          ErrorCode.INSUFFICIENT_COLLATERAL,
          `Insufficient USDC allowance. Please approve USDC for trading.`,
          params.pair
        );
      }
      
      // Get signer address
      const address = await this.getAddress();
      
      // Prepare trade struct for contract
      const isLong = params.side === PositionSide.LONG;
      const collateralUnits = toUSDCUnits(collateral);
      const positionSizeUnits = toUSDCUnits(size);
      const openPriceUnits = params.openPrice ? toUSDCUnits(params.openPrice) : 0;
      const stopLossUnits = params.stopLoss ? toUSDCUnits(params.stopLoss) : 0;
      const takeProfitUnits = params.takeProfit ? toUSDCUnits(params.takeProfit) : 0;
      const slippageUnits = ethers.parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      
      const tradeStruct = {
        trader: address,
        pairIndex: pairIndex,
        index: 0, // This will be assigned by the contract
        initialPosToken: collateralUnits,
        positionSizeUSDC: positionSizeUnits,
        openPrice: openPriceUnits,
        buy: isLong,
        leverage: params.leverage,
        tp: takeProfitUnits,
        sl: stopLossUnits,
        timestamp: 0 // Current timestamp
      };
      
      // Execute transaction with proper execution fee
      const executionFee = ethers.parseEther('0.001'); // 0.001 ETH execution fee
      const tx = await this.tradingContract.openTrade(
        tradeStruct,
        orderTypeValue,
        slippageUnits,
        { value: executionFee }
      );
      
      const receipt = await tx.wait();
      
      // Parse events based on order type
      let eventName: string;
      if (orderType === OrderType.MARKET) {
        eventName = 'MarketOrderInitiated';
      } else {
        eventName = 'LimitOrderInitiated';
      }
      
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = this.tradingContract?.interface.parseLog(log);
          return parsedLog?.name === eventName;
        } catch {
          return false;
        }
      });
      
      let position: Position | undefined;
      if (event && orderType === OrderType.MARKET) {
        // For market orders, try to get the position immediately
        const parsedEvent = this.tradingContract?.interface.parseLog(event);
        if (parsedEvent?.args) {
          // The position might not be available immediately for market orders
          // as they go through oracle execution
        }
      }
      
      this.emit(orderType === OrderType.MARKET ? 'positionOpened' : 'limitOrderPlaced', {
        position,
        transactionHash: receipt.hash,
        orderType
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        position,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice || receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Closes an existing position
   */
  public async closePosition(params: ClosePositionParams): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(ClosePositionParamsSchema, params);
      
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Parse position ID to get pair index and position index
      // Position ID format should be "pairIndex-positionIndex"
      const [pairIndexStr, positionIndexStr] = params.positionId.split('-');
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          'positionId'
        );
      }
      
      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);
      
      // Determine close amount (0 means close full position)
      const closeAmount = params.size ? toUSDCUnits(params.size) : 0;
      
      // Execute closeTradeMarket with execution fee
      const executionFee = ethers.parseEther('0.001');
      const tx = await this.tradingContract.closeTradeMarket(
        pairIndex,
        positionIndex,
        closeAmount,
        { value: executionFee }
      );
      
      const receipt = await tx.wait();
      
      this.emit('positionClosed', {
        positionId: params.positionId,
        transactionHash: receipt.hash
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice || receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Updates position stop loss and take profit
   */
  public async updatePosition(params: UpdatePositionParams): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(UpdatePositionParamsSchema, params);
      
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Parse position ID to get pair index and position index
      const [pairIndexStr, positionIndexStr] = params.positionId.split('-');
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          'positionId'
        );
      }
      
      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);
      
      const stopLossUnits = params.stopLoss ? toUSDCUnits(params.stopLoss) : 0n;
      const takeProfitUnits = params.takeProfit ? toUSDCUnits(params.takeProfit) : 0n;
      
      // Execute updateTpAndSl transaction
      // Note: Contract expects (pairIndex, index, _newSl, _newTP, priceUpdateData)
      const tx = await this.tradingContract.updateTpAndSl(
        pairIndex,
        positionIndex,
        stopLossUnits,    // Stop loss FIRST
        takeProfitUnits,  // Take profit SECOND
        []                // Empty priceUpdateData array (required parameter)
      );
      
      const receipt = await tx.wait();
      
      this.emit('positionUpdated', {
        positionId: params.positionId,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        transactionHash: receipt.hash
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice || receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets a specific position
   */
  public async getPosition(positionId: string): Promise<Position | null> {
    try {
      if (!this.tradingContract) {
        return null;
      }
      
      const data = await this.tradingContract.getPosition(positionId);
      
      if (!data || data.status === 0) {
        return null;
      }
      
      return this.parsePositionData(data);
    } catch (error) {
      // Silently return null for missing positions
      return null;
    }
  }

  /**
   * Gets all positions for the current account
   */
  public async getPositions(address?: string): Promise<Position[]> {
    try {
      if (!this.tradingContract) {
        return [];
      }
      
      const addr = address || await this.getAddress();
      const positionIds = await this.tradingContract.getPositions(addr);
      
      const positions = await Promise.all(
        positionIds.map((id: string) => this.getPosition(id))
      );
      
      return positions.filter((p): p is Position => p !== null);
    } catch (error) {
      // Return empty array for errors
      return [];
    }
  }

  /**
   * Parses position data from contract
   */
  private parsePositionData(data: any): Position {
    // TODO: Implement actual parsing based on contract response
    // This is a placeholder implementation
    return {
      id: data.id.toString(),
      owner: data.owner,
      pair: data.pair,
      side: data.isLong ? PositionSide.LONG : PositionSide.SHORT,
      size: new Decimal(formatUSDC(data.size)),
      collateral: new Decimal(formatUSDC(data.collateral)),
      leverage: Number(data.leverage),
      entryPrice: new Decimal(formatUSDC(data.entryPrice)),
      markPrice: new Decimal(0), // TODO: Get from price feed
      liquidationPrice: new Decimal(0), // TODO: Calculate
      unrealizedPnl: new Decimal(0), // TODO: Calculate
      realizedPnl: new Decimal(0),
      stopLoss: data.stopLoss ? new Decimal(formatUSDC(data.stopLoss)) : undefined,
      takeProfit: data.takeProfit ? new Decimal(formatUSDC(data.takeProfit)) : undefined,
      margin: new Decimal(formatUSDC(data.collateral)),
      maintenanceMargin: new Decimal(0), // TODO: Calculate
      status: PositionStatus.OPEN,
      openedAt: new Date(Number(data.openTime) * 1000),
      lastUpdated: new Date()
    };
  }

  /**
   * Cancels a pending limit order
   */
  public async cancelLimitOrder(params: CancelLimitOrderParams): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Execute cancelOpenLimitOrder
      const tx = await this.tradingContract.cancelOpenLimitOrder(
        params.pairIndex,
        params.orderIndex
      );
      
      const receipt = await tx.wait();
      
      // Parse the cancellation event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = this.tradingContract?.interface.parseLog(log);
          return parsedLog?.name === 'OpenLimitCanceled';
        } catch {
          return false;
        }
      });
      
      this.emit('limitOrderCanceled', {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.hash
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice || receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Updates a pending limit order
   */
  public async updateLimitOrder(params: UpdateLimitOrderParams): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      const priceUnits = toUSDCUnits(params.price);
      const slippageUnits = ethers.parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      const tpUnits = params.takeProfit ? toUSDCUnits(params.takeProfit) : 0;
      const slUnits = params.stopLoss ? toUSDCUnits(params.stopLoss) : 0;
      
      // Execute updateOpenLimitOrder
      const tx = await this.tradingContract.updateOpenLimitOrder(
        params.pairIndex,
        params.orderIndex,
        priceUnits,
        slippageUnits,
        tpUnits,
        slUnits
      );
      
      const receipt = await tx.wait();
      
      // Parse the update event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = this.tradingContract?.interface.parseLog(log);
          return parsedLog?.name === 'OpenLimitUpdated';
        } catch {
          return false;
        }
      });
      
      this.emit('limitOrderUpdated', {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.hash
      });
      
      return {
        success: receipt.status === 1,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice || receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the pair index for a given pair name
   */
  public getPairIndex(pairName: string): number {
    return getPairIndex(pairName);
  }
  
  /**
   * Gets the pair name for a given index
   */
  public getPairName(index: number): string {
    return getPairName(index);
  }
  
  /**
   * Gets all available trading pairs
   */
  public getAllPairs(): string[] {
    return getAllPairs();
  }
  
  /**
   * Gets pairs by category
   */
  public getPairsByCategory(category: 'crypto' | 'forex' | 'commodity' | 'index'): string[] {
    return getPairsByCategory(category);
  }

  /**
   * Sets platform fee configuration
   */
  public setPlatformFeeConfig(config: Partial<PlatformFeeConfig>): void {
    if (!this.feeManager) {
      this.feeManager = new FeeManager(config);
    } else {
      this.feeManager.updateConfig(config);
    }
    
    // Initialize multicall bundler if not already done
    if (!this.multicallBundler) {
      // Use the multicall address from the config or default
      const multicallAddress = this.network.chainId === 8453 
        ? '0x7A829c5C97A2Bf8BeFB4b01d96A282E4763848d8' // Base mainnet
        : undefined; // Will use default from constants
      this.multicallBundler = new MulticallBundler(multicallAddress);
    }
    
    this.emit('platformFeeConfigSet', config);
  }

  /**
   * Gets current platform fee configuration
   */
  public getPlatformFeeConfig(): PlatformFeeConfig | null {
    return this.feeManager ? this.feeManager.getConfig() : null;
  }

  /**
   * Calculates fee breakdown for a trade
   */
  public calculateFeeBreakdown(
    tradeSize: Decimal | number | string,
    params?: PlatformFeeParams
  ): FeeBreakdown | null {
    if (!this.feeManager) {
      return null;
    }
    
    return this.feeManager.calculateFeeBreakdown(tradeSize, params);
  }

  /**
   * Opens a position with platform fees (bundled transaction)
   */
  public async openPositionWithFees(params: OpenPositionParams): Promise<TradeResponse> {
    try {
      // Check if fees are enabled
      if (!this.feeManager || !this.feeManager.isEnabled() || !params.platformFee?.enabled) {
        // Fall back to regular openPosition if fees not enabled
        return await this.openPosition(params);
      }
      
      if (!this.multicallBundler) {
        throw new TradingError(
          ErrorCode.NOT_IMPLEMENTED,
          'Multicall bundler not initialized'
        );
      }
      
      // Validate parameters
      const validated = validate(OpenPositionParamsSchema, params);
      
      // Check contracts
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Get pair configuration
      const pairIndex = getPairIndex(params.pair);
      const pairConfig = TRADING_PAIRS[params.pair as keyof typeof TRADING_PAIRS];
      if (!pairConfig) {
        throw new TradingError(
          ErrorCode.INVALID_PAIR,
          `Trading pair not supported: ${params.pair}`,
          params.pair
        );
      }
      
      // Validate position size and leverage
      const size = validatePositionSize(
        params.size,
        new Decimal(pairConfig.minSize),
        new Decimal(pairConfig.maxSize)
      );
      validateLeverage(params.leverage, pairConfig.maxLeverage);
      
      // Calculate collateral
      const collateral = size.div(params.leverage);
      
      // Calculate platform fees
      const feeBreakdown = this.feeManager.calculateFeeBreakdown(size, params.platformFee);
      const totalRequired = collateral.plus(feeBreakdown.totalFee);
      
      // Check balances
      const balance = await this.getUSDCBalance();
      if (balance.lt(totalRequired)) {
        throw new TradingError(
          ErrorCode.INSUFFICIENT_COLLATERAL,
          `Insufficient USDC. Required: ${totalRequired.toFixed(2)} (including fees), Available: ${balance.toFixed(2)}`,
          params.pair
        );
      }
      
      // Build trade struct
      const address = await this.getAddress();
      const isLong = params.side === PositionSide.LONG;
      const orderType = params.orderType || OrderType.MARKET;
      let orderTypeValue: number;
      switch (orderType) {
        case OrderType.MARKET: orderTypeValue = OrderTypeValue.MARKET; break;
        case OrderType.LIMIT: orderTypeValue = OrderTypeValue.LIMIT; break;
        case OrderType.STOP: orderTypeValue = OrderTypeValue.STOP; break;
        case OrderType.STOP_LIMIT: orderTypeValue = OrderTypeValue.STOP_LIMIT; break;
        default: orderTypeValue = OrderTypeValue.MARKET;
      }
      
      const tradeStruct = {
        trader: address,
        pairIndex: pairIndex,
        index: 0,
        initialPosToken: toUSDCUnits(collateral),
        positionSizeUSDC: toUSDCUnits(size),
        openPrice: params.openPrice ? toUSDCUnits(params.openPrice) : 0,
        buy: isLong,
        leverage: params.leverage,
        tp: params.takeProfit ? toUSDCUnits(params.takeProfit) : 0,
        sl: params.stopLoss ? toUSDCUnits(params.stopLoss) : 0,
        timestamp: 0
      };
      
      const slippageUnits = ethers.parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      const executionFee = ethers.parseEther('0.001');
      
      // Bundle the transaction
      const feeConfig = this.feeManager.getConfig();
      const bundled = this.multicallBundler.bundleTradeWithFees({
        usdcAddress: this.network.contracts.usdc,
        tradingAddress: this.network.contracts.trading,
        platformWallet: feeConfig.platformWallet,
        referralAddress: params.platformFee.referralAddress,
        totalAmount: toUSDCUnits(totalRequired),
        platformFeeAmount: toUSDCUnits(feeBreakdown.platformReceives),
        referralFeeAmount: params.platformFee.referralAddress ? toUSDCUnits(feeBreakdown.referralFee) : undefined,
        tradeStruct,
        orderTypeValue,
        slippageUnits,
        executionFee
      });
      
      // Execute bundled transaction
      const signer = this.blockchain.getSigner();
      const tx = await signer.sendTransaction({
        to: bundled.to,
        data: bundled.data,
        value: bundled.value
      });
      
      const receipt = await tx.wait();
      
      this.emit('positionOpenedWithFees', {
        transactionHash: receipt!.hash,
        feeBreakdown,
        bundledOperations: bundled.description
      });
      
      return {
        success: receipt!.status === 1,
        transactionHash: receipt!.hash,
        gasUsed: receipt!.gasUsed,
        effectiveGasPrice: receipt!.gasPrice || receipt!.gasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Closes a position with platform fees (bundled transaction)
   */
  public async closePositionWithFees(params: ClosePositionParams): Promise<TradeResponse> {
    try {
      // Check if fees are enabled
      if (!this.feeManager || !this.feeManager.isEnabled() || !params.platformFee?.enabled) {
        // Fall back to regular closePosition if fees not enabled
        return await this.closePosition(params);
      }
      
      if (!this.multicallBundler) {
        throw new TradingError(
          ErrorCode.NOT_IMPLEMENTED,
          'Multicall bundler not initialized'
        );
      }
      
      // Validate parameters
      const validated = validate(ClosePositionParamsSchema, params);
      
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }
      
      // Parse position ID
      const [pairIndexStr, positionIndexStr] = params.positionId.split('-');
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          'positionId'
        );
      }
      
      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);
      const closeAmount = params.size ? toUSDCUnits(params.size) : 0n;
      
      // Calculate platform fees on the closing size
      // Note: This is simplified - in reality you might want to calculate based on PnL or returned collateral
      const closeSize = params.size || new Decimal(100); // Default placeholder
      const feeBreakdown = this.feeManager.calculateFeeBreakdown(closeSize, params.platformFee);
      
      // Bundle the transaction
      const feeConfig = this.feeManager.getConfig();
      const executionFee = ethers.parseEther('0.001');
      
      const bundled = this.multicallBundler.bundleCloseWithFees({
        usdcAddress: this.network.contracts.usdc,
        tradingAddress: this.network.contracts.trading,
        platformWallet: feeConfig.platformWallet,
        referralAddress: params.platformFee.referralAddress,
        platformFeeAmount: toUSDCUnits(feeBreakdown.platformReceives),
        referralFeeAmount: params.platformFee.referralAddress ? toUSDCUnits(feeBreakdown.referralFee) : undefined,
        pairIndex,
        positionIndex,
        closeAmount,
        executionFee
      });
      
      // Execute bundled transaction
      const signer = this.blockchain.getSigner();
      const tx = await signer.sendTransaction({
        to: bundled.to,
        data: bundled.data,
        value: bundled.value
      });
      
      const receipt = await tx.wait();
      
      this.emit('positionClosedWithFees', {
        positionId: params.positionId,
        transactionHash: receipt!.hash,
        feeBreakdown,
        bundledOperations: bundled.description
      });
      
      return {
        success: receipt!.status === 1,
        transactionHash: receipt!.hash,
        gasUsed: receipt!.gasUsed,
        effectiveGasPrice: receipt!.gasPrice || receipt!.gasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Disconnects from the blockchain
   */
  public disconnect(): void {
    this.blockchain.disconnect();
    this.removeAllListeners();
  }
}