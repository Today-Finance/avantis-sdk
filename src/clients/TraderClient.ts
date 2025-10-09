import { getContract, parseUnits, decodeEventLog, encodeFunctionData, parseEther } from 'viem';
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
  NetworkConfig,
  UpdateMarginParams,
  MarginUpdateType,
  ExecuteLimitOrderParams,
  LimitOrderType
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
import { TradingContractABI, USDCContractABI, Multicall3ContractABI, TradingStorageContractABI } from '../contracts';
import { FeeManager } from '../fees/FeeManager';
import { MulticallBundler } from '../fees/MulticallBundler';
import type { PlatformFeeConfig, PlatformFeeParams, FeeBreakdown } from '../types/platform-fees';
import { PythClient } from './PythClient';
import { SocketAPIClient } from './SocketAPIClient';

export class TraderClient extends EventEmitter {
  private blockchain: BlockchainProvider;
  private tradingContract?: any;
  private usdcContract!: any;
  private network: NetworkConfig;
  private positions: Map<string, Position> = new Map();
  private feeManager?: FeeManager;
  private multicallBundler?: MulticallBundler;
  private pythClient: PythClient;
  private socketAPI: SocketAPIClient;

  constructor(
    networkName: keyof typeof NETWORKS = 'base',
    customRpcUrl?: string
  ) {
    super();
    this.blockchain = new BlockchainProvider(networkName, customRpcUrl);
    this.network = this.blockchain.getNetwork();

    // Initialize USDC contract (always needed)
    const publicClient = this.blockchain.getProvider();
    this.usdcContract = getContract({
      address: this.network.contracts.usdc as `0x${string}`,
      abi: USDCContractABI,
      client: publicClient as any
    });

    // Initialize Pyth client for price oracle data
    this.pythClient = new PythClient({
      network: networkName === 'base-sepolia' ? 'testnet' : 'mainnet'
    });

    // Initialize Socket API client for dynamic pair data
    this.socketAPI = new SocketAPIClient();

    this.initializeContracts();
  }

  /**
   * Initializes smart contract instances
   */
  private initializeContracts(): void {
    const publicClient = this.blockchain.getProvider();

    // Initialize trading contract if available
    if (this.network.contracts.trading !== '0x0000000000000000000000000000000000000000') {
      this.tradingContract = getContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        client: publicClient as any
      });
    }
  }

  /**
   * Sets the signer for transactions
   */
  public async setSigner(config: SignerConfig): Promise<void> {
    this.blockchain.setSigner(config);

    const account = this.blockchain.getAccount();

    this.emit('signerSet', account.address);
  }

  /**
   * Gets the current account address
   */
  public async getAddress(): Promise<string> {
    const account = this.blockchain.getAccount();
    return account.address;
  }

  /**
   * Gets the network configuration
   */
  public getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Gets the Pyth client for advanced price oracle operations
   */
  public getPythClient(): PythClient {
    return this.pythClient;
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

      const balance = await this.usdcContract.read.balanceOf([addr as `0x${string}`]);
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

      const allowance = await this.usdcContract.read.allowance([
        addr as `0x${string}`,
        this.network.contracts.trading as `0x${string}`
      ]);

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

      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.usdc as `0x${string}`,
        abi: USDCContractABI,
        functionName: 'approve',
        args: [this.network.contracts.trading as `0x${string}`, amountUnits],
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('usdcApproved', {
        amount: amountDecimal,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
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

      // Get pair index from Socket API (dynamic, accurate)
      const pairIndex = await this.getPairIndexFromAPI(params.pair);
      
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
      const slippageUnits = parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      
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

      // Get Pyth price update data
      const autofetch = params.autofetchPrices !== false; // Default to true
      let priceUpdateData: string[] = params.priceUpdateData || [];

      if (autofetch && priceUpdateData.length === 0) {
        try {
          priceUpdateData = await this.pythClient.getPriceUpdateData(params.pair);
        } catch (error) {
          // Log warning but continue - some contracts may not require price data
          console.warn(`Failed to fetch Pyth price data for ${params.pair}:`, error);
        }
      }

      // Execute transaction with proper execution fee
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'openTrade',
        args: [tradeStruct, orderTypeValue, slippageUnits, priceUpdateData],
        value: executionFee,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Parse events based on order type
      let eventName: string;
      if (orderType === OrderType.MARKET) {
        eventName = 'MarketOrderInitiated';
      } else {
        eventName = 'LimitOrderInitiated';
      }

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      let position: Position | undefined;
      if (event && orderType === OrderType.MARKET) {
        // For market orders, try to get the position immediately
        // The position might not be available immediately for market orders
        // as they go through oracle execution
      }

      this.emit(orderType === OrderType.MARKET ? 'positionOpened' : 'limitOrderPlaced', {
        position,
        transactionHash: receipt.transactionHash,
        orderType
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        position,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
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

      // Get pair name from Socket API for Pyth price data
      const pairName = await this.getPairNameFromAPI(pairIndex);

      // Get Pyth price update data
      const autofetch = params.autofetchPrices !== false; // Default to true
      let priceUpdateData: string[] = params.priceUpdateData || [];

      if (autofetch && priceUpdateData.length === 0) {
        try {
          priceUpdateData = await this.pythClient.getPriceUpdateData(pairName);
        } catch (error) {
          console.warn(`Failed to fetch Pyth price data for ${pairName}:`, error);
        }
      }

      // Execute closeTradeMarket with execution fee
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'closeTradeMarket',
        args: [pairIndex, positionIndex, closeAmount, priceUpdateData],
        value: executionFee,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('positionClosed', {
        positionId: params.positionId,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
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

      const stopLossUnits = params.stopLoss ? toUSDCUnits(params.stopLoss) : BigInt(0);
      const takeProfitUnits = params.takeProfit ? toUSDCUnits(params.takeProfit) : BigInt(0);

      // Get pair name from Socket API for Pyth price data
      const pairName = await this.getPairNameFromAPI(pairIndex);

      // Get Pyth price update data
      const autofetch = params.autofetchPrices !== false; // Default to true
      let priceUpdateData: string[] = params.priceUpdateData || [];

      if (autofetch && priceUpdateData.length === 0) {
        try {
          priceUpdateData = await this.pythClient.getPriceUpdateData(pairName);
        } catch (error) {
          console.warn(`Failed to fetch Pyth price data for ${pairName}:`, error);
        }
      }

      // Execute updateTpAndSl transaction
      // Note: Contract expects (pairIndex, index, _newSl, _newTP, priceUpdateData)
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'updateTpAndSl',
        args: [
          pairIndex,
          positionIndex,
          stopLossUnits,    // Stop loss FIRST
          takeProfitUnits,  // Take profit SECOND
          priceUpdateData   // Pyth price update data
        ],
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('positionUpdated', {
        positionId: params.positionId,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets a specific position from TradingStorage
   */
  public async getPosition(pairIndex: number, positionIndex: number, trader?: string): Promise<Position | null> {
    try {
      const addr = trader || await this.getAddress();

      // Get position data from TradingStorage via storage contract interface
      const publicClient = this.blockchain.getProvider();
      const tradingStorageAddress = this.network.contracts.tradingStorage;

      if (!tradingStorageAddress || tradingStorageAddress === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      const tradingStorageContract: any = getContract({
        address: tradingStorageAddress as `0x${string}`,
        abi: TradingStorageContractABI,
        client: publicClient as any
      });

      // Call openTrades(trader, pairIndex, index)
      const trade = await tradingStorageContract.read.openTrades([addr as `0x${string}`, pairIndex, positionIndex]);

      // Check if trade exists (trader address should not be zero)
      if (!trade || trade.trader === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return await this.parsePositionData(trade, pairIndex, positionIndex);
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
      const addr = address || await this.getAddress();

      // Get all trading pairs from Socket API
      const markets = await this.socketAPI.getAllMarkets();
      const positions: Position[] = [];

      // For each pair, check for open positions (indices 0-2 typically max 3 positions per pair)
      // This is a limitation - ideally we'd have a way to query all positions directly
      for (const market of markets) {
        const pairIndex = market.pairIndex;

        // Check up to 10 potential position indices per pair
        for (let i = 0; i < 10; i++) {
          const position = await this.getPosition(pairIndex, i, addr);
          if (position) {
            positions.push(position);
          }
        }
      }

      return positions;
    } catch (error) {
      // Return empty array for errors
      return [];
    }
  }

  /**
   * Parses position data from contract and enriches with calculations
   */
  private async parsePositionData(trade: any, pairIndex: number, positionIndex: number): Promise<Position> {
    const pairName = await this.getPairNameFromAPI(pairIndex);
    const side = trade.buy ? PositionSide.LONG : PositionSide.SHORT;
    const collateral = new Decimal(formatUSDC(trade.initialPosToken));
    const leverage = Number(trade.leverage);
    const size = new Decimal(formatUSDC(trade.positionSizeUSDC));
    const entryPrice = new Decimal(formatUSDC(trade.openPrice));

    // Calculate liquidation price
    const { calculateLiquidationPrice, calculateUnrealizedPnL } = await import('../utils/calculations');
    const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side);

    // Get current mark price (try to fetch, fallback to entry price)
    let markPrice = entryPrice;
    try {
      // Try to get current price from price aggregator contract if available
      if (this.network.contracts.priceAggregator && this.network.contracts.priceAggregator !== '0x0000000000000000000000000000000000000000') {
        const priceAggregatorContract: any = getContract({
          address: this.network.contracts.priceAggregator as `0x${string}`,
          abi: (await import('../contracts')).PriceAggregatorContractABI,
          client: this.blockchain.getProvider() as any
        });
        const priceData = await priceAggregatorContract.read.getPrice([pairIndex]);
        markPrice = new Decimal(formatUSDC(priceData.price || priceData[0]));
      }
    } catch {
      // Use entry price as fallback
    }

    // Calculate unrealized PnL
    const unrealizedPnl = calculateUnrealizedPnL(entryPrice, markPrice, size, side, leverage);

    // Calculate maintenance margin (typically 0.5% of position size)
    const maintenanceMargin = size.mul(0.005);

    return {
      id: `${pairIndex}-${positionIndex}`,
      owner: trade.trader,
      pair: pairName,
      side,
      size,
      collateral,
      leverage,
      entryPrice,
      markPrice,
      liquidationPrice,
      unrealizedPnl,
      realizedPnl: new Decimal(0), // Not tracked in this version
      stopLoss: trade.sl && Number(trade.sl) > 0 ? new Decimal(formatUSDC(trade.sl)) : undefined,
      takeProfit: trade.tp && Number(trade.tp) > 0 ? new Decimal(formatUSDC(trade.tp)) : undefined,
      margin: collateral,
      maintenanceMargin,
      status: PositionStatus.OPEN,
      openedAt: new Date(Number(trade.timestamp) * 1000),
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
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'cancelOpenLimitOrder',
        args: [params.pairIndex, params.orderIndex],
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      this.emit('limitOrderCanceled', {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
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
      const slippageUnits = parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      const tpUnits = params.takeProfit ? toUSDCUnits(params.takeProfit) : 0;
      const slUnits = params.stopLoss ? toUSDCUnits(params.stopLoss) : 0;

      // Execute updateOpenLimitOrder
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'updateOpenLimitOrder',
        args: [params.pairIndex, params.orderIndex, priceUnits, slippageUnits, tpUnits, slUnits],
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      this.emit('limitOrderUpdated', {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the pair index for a given pair name (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use getPairIndexFromAPI() instead for accurate pair indices
   */
  public getPairIndex(pairName: string): number {
    console.warn('[DEPRECATED] getPairIndex() uses hardcoded pair mappings. Use getPairIndexFromAPI() for accurate indices.');
    return getPairIndex(pairName);
  }

  /**
   * Gets the pair name for a given index (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use getPairNameFromAPI() instead for accurate pair names
   */
  public getPairName(index: number): string {
    console.warn('[DEPRECATED] getPairName() uses hardcoded pair mappings. Use getPairNameFromAPI() for accurate names.');
    return getPairName(index);
  }

  /**
   * Gets all available trading pairs (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use getAllPairsFromAPI() instead for all 89+ pairs
   */
  public getAllPairs(): string[] {
    console.warn('[DEPRECATED] getAllPairs() returns hardcoded pairs. Use getAllPairsFromAPI() for all 89+ pairs.');
    return getAllPairs();
  }

  /**
   * Gets pairs by category (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use Socket API methods via AvantisSDK.getMarketsByType() instead
   */
  public getPairsByCategory(category: 'crypto' | 'forex' | 'commodity' | 'index'): string[] {
    console.warn('[DEPRECATED] getPairsByCategory() uses hardcoded pairs. Use AvantisSDK.getMarketsByType() instead.');
    return getPairsByCategory(category);
  }

  /**
   * Gets the pair index for a given pair name from Socket API (dynamic, accurate)
   * @param pairName - The pair name (e.g., "ETH/USD", "BTC/USD")
   * @returns The pair index or throws error if not found
   */
  public async getPairIndexFromAPI(pairName: string): Promise<number> {
    const markets = await this.socketAPI.getAllMarkets();
    const market = markets.find(m => m.name.toUpperCase() === pairName.toUpperCase());
    if (!market) {
      throw new TradingError(
        ErrorCode.INVALID_PAIR,
        `Trading pair not found: ${pairName}`,
        pairName
      );
    }
    return market.pairIndex;
  }

  /**
   * Gets the pair name for a given index from Socket API (dynamic, accurate)
   * @param index - The pair index
   * @returns The pair name or throws error if not found
   */
  public async getPairNameFromAPI(index: number): Promise<string> {
    const market = await this.socketAPI.getMarket(index);
    if (!market) {
      throw new TradingError(
        ErrorCode.INVALID_PAIR,
        `Pair index not found: ${index}`,
        index.toString()
      );
    }
    return market.name;
  }

  /**
   * Gets all available trading pairs from Socket API (89+ pairs)
   * @returns Array of all pair names
   */
  public async getAllPairsFromAPI(): Promise<string[]> {
    const markets = await this.socketAPI.getAllMarkets();
    return markets.map(m => m.name);
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
      
      // Get pair configuration from Socket API
      const pairIndex = await this.getPairIndexFromAPI(params.pair);
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
      
      const slippageUnits = parseUnits(((params.slippage || 0.5) / 100).toString(), 10);
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)

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
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).sendTransaction({
        to: bundled.to as `0x${string}`,
        data: bundled.data as `0x${string}`,
        value: bundled.value,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('positionOpenedWithFees', {
        transactionHash: receipt.transactionHash,
        feeBreakdown,
        bundledOperations: bundled.description
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
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
      const closeAmount = params.size ? toUSDCUnits(params.size) : BigInt(0);
      
      // Calculate platform fees on the closing size
      // Note: This is simplified - in reality you might want to calculate based on PnL or returned collateral
      const closeSize = params.size || new Decimal(100); // Default placeholder
      const feeBreakdown = this.feeManager.calculateFeeBreakdown(closeSize, params.platformFee);
      
      // Bundle the transaction
      const feeConfig = this.feeManager.getConfig();
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)

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
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).sendTransaction({
        to: bundled.to as `0x${string}`,
        data: bundled.data as `0x${string}`,
        value: bundled.value,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('positionClosedWithFees', {
        positionId: params.positionId,
        transactionHash: receipt.transactionHash,
        feeBreakdown,
        bundledOperations: bundled.description
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Updates margin for an open position (add or remove collateral)
   */
  public async updateMargin(params: UpdateMarginParams): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }

      const amountUnits = toUSDCUnits(params.amount);

      // Get pair name from Socket API for Pyth price data
      const pairName = await this.getPairNameFromAPI(params.pairIndex);

      // Get Pyth price update data
      const autofetch = params.autofetchPrices !== false; // Default to true
      let priceUpdateData: string[] = params.priceUpdateData || [];

      if (autofetch && priceUpdateData.length === 0) {
        try {
          priceUpdateData = await this.pythClient.getPriceUpdateData(pairName);
        } catch (error) {
          console.warn(`Failed to fetch Pyth price data for ${pairName}:`, error);
        }
      }

      // Execute updateMargin transaction
      // Note: This requires an execution fee
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'updateMargin',
        args: [
          params.pairIndex,
          params.positionIndex,
          params.type, // 0 = ADD, 1 = REMOVE
          amountUnits,
          priceUpdateData
        ],
        value: executionFee,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('marginUpdated', {
        pairIndex: params.pairIndex,
        positionIndex: params.positionIndex,
        type: params.type,
        amount: params.amount,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Executes a limit order (for keepers/bots)
   */
  public async executeLimitOrder(params: ExecuteLimitOrderParams): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          'Trading contract not deployed on this network'
        );
      }

      const priceUpdateData = params.priceUpdateData || [];

      // Calculate execution fee (may need to cover Pyth fee)
      const executionFee = parseEther('0.00035'); // 0.00035 ETH execution fee (per Avantis docs)

      // Execute the limit order
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: 'executeLimitOrder',
        args: [
          params.orderType, // LimitOrderType enum
          params.trader as `0x${string}`,
          params.pairIndex,
          params.index,
          priceUpdateData
        ],
        value: executionFee,
        account
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit('limitOrderExecuted', {
        orderType: params.orderType,
        trader: params.trader,
        pairIndex: params.pairIndex,
        index: params.index,
        transactionHash: receipt.transactionHash
      });

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pending limit orders for the current account
   */
  public async getPendingLimitOrders(address?: string): Promise<PendingLimitOrder[]> {
    try {
      const addr = address || await this.getAddress();

      // Use StorageClient to fetch pending orders
      const publicClient = this.blockchain.getProvider();
      const tradingStorageAddress = this.network.contracts.tradingStorage;

      if (!tradingStorageAddress || tradingStorageAddress === '0x0000000000000000000000000000000000000000') {
        return [];
      }

      const tradingStorageContract: any = getContract({
        address: tradingStorageAddress as `0x${string}`,
        abi: TradingStorageContractABI,
        client: publicClient as any
      });

      // Get pending orders from storage
      // Note: This is a simplified implementation
      // In reality, you'd need to iterate through pairs and indices
      const orders: PendingLimitOrder[] = [];

      // For each pair, check for pending limit orders
      const markets = await this.socketAPI.getAllMarkets();
      for (const market of markets) {
        const pairIndex = market.pairIndex;

        // Check up to 3 potential order indices per pair
        for (let i = 0; i < 3; i++) {
          try {
            const order = await tradingStorageContract.read.openLimitOrders([addr as `0x${string}`, pairIndex, i]);

            // Check if order exists
            if (order && order.trader !== '0x0000000000000000000000000000000000000000') {
              orders.push({
                id: `${pairIndex}-${i}`,
                trader: order.trader,
                pairIndex,
                orderIndex: i,
                positionSize: new Decimal(formatUSDC(order.positionSizeUSDC)),
                buy: order.buy,
                leverage: Number(order.leverage),
                openPrice: new Decimal(formatUSDC(order.minPrice || order.maxPrice)),
                tp: order.tp && Number(order.tp) > 0 ? new Decimal(formatUSDC(order.tp)) : undefined,
                sl: order.sl && Number(order.sl) > 0 ? new Decimal(formatUSDC(order.sl)) : undefined,
                timestamp: new Date(),
                orderType: OrderType.LIMIT
              });
            }
          } catch {
            // Skip invalid orders
          }
        }
      }

      return orders;
    } catch (error) {
      return [];
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