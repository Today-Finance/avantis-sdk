import {
  getContract,
  parseUnits,
  decodeEventLog,
  encodeFunctionData,
  parseEther,
} from "viem";
import Decimal from "decimal.js";
import { EventEmitter } from "eventemitter3";
import { BlockchainProvider } from "../providers/BlockchainProvider";
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
  LimitOrderType,
} from "../types";
import {
  validateAddress,
  validateLeverage,
  validatePositionSize,
  validateSlippage,
  validateTradingPair,
  validate,
  OpenPositionParamsSchema,
  ClosePositionParamsSchema,
  UpdatePositionParamsSchema,
} from "../utils/validation";
import {
  getPairIndex,
  getPairName,
  getAllPairs,
  getPairsByCategory,
} from "../utils/pairs";
import {
  formatUSDC,
  toUSDCUnits,
  toLeverageUnits,
  toPriceUnits,
  formatETH,
  toWei,
} from "../utils/formatting";
import {
  TradingError,
  TransactionError,
  ValidationError,
  ErrorCode,
  handleError,
} from "../utils/errors";
import { NETWORKS, TRADING_PAIRS, FEES, DEFAULTS } from "../constants/networks";
import {
  TradingContractABI,
  USDCContractABI,
  Multicall3ContractABI,
  TradingStorageContractABI,
} from "../contracts";
import { FeeManager } from "../fees/FeeManager";
import { MulticallBundler } from "../fees/MulticallBundler";
import type {
  PlatformFeeConfig,
  PlatformFeeParams,
  FeeBreakdown,
} from "../types/platform-fees";
import { PythClient } from "./PythClient";
import { SocketAPIClient } from "./SocketAPIClient";

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
  private marketConfigCache?: Map<string, any>; // Cache for market configs
  private marketCacheTimestamp: number = 0;
  private readonly MARKET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    networkName: keyof typeof NETWORKS = "base",
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
      client: publicClient as any,
    });

    // Initialize Pyth client for price oracle data
    this.pythClient = new PythClient({
      network: networkName === "base-sepolia" ? "testnet" : "mainnet",
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
    if (
      this.network.contracts.trading !==
      "0x0000000000000000000000000000000000000000"
    ) {
      this.tradingContract = getContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        client: publicClient as any,
      });
    }
  }

  /**
   * Sets the signer for transactions
   */
  public async setSigner(config: SignerConfig): Promise<void> {
    this.blockchain.setSigner(config);

    const account = this.blockchain.getAccount();

    this.emit("signerSet", account.address);
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
        this.getUSDCBalance(),
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
        marginLevel,
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
      const addr = address || (await this.getAddress());
      validateAddress(addr);

      const balance = await this.usdcContract.read.balanceOf([
        addr as `0x${string}`,
      ]);
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
      const addr = address || (await this.getAddress());
      validateAddress(addr);

      if (!this.tradingContract) {
        return new Decimal(0);
      }

      const allowance = await this.usdcContract.read.allowance([
        addr as `0x${string}`,
        this.network.contracts.trading as `0x${string}`,
      ]);

      return new Decimal(formatUSDC(allowance));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Prepares a USDC approval transaction WITHOUT executing it
   * Returns transaction data that can be sent via custom infrastructure (e.g., Privy Wallet API)
   * @param amount - Amount to approve (default: 1000000 USDC)
   * @returns Transaction data { to, data, value }
   */
  public async prepareApproveTransaction(
    amount: Decimal | number | string = "1000000"
  ): Promise<{ to: string; data: string; value: string }> {
    const amountDecimal = new Decimal(amount);
    const amountUnits = toUSDCUnits(amountDecimal);

    // Encode function call data
    const data = encodeFunctionData({
      abi: USDCContractABI,
      functionName: "approve",
      args: [this.network.contracts.trading as `0x${string}`, amountUnits],
    });

    return {
      to: this.network.contracts.usdc,
      data: data as string,
      value: "0",
    };
  }

  /**
   * Approves USDC for trading
   */
  public async approveUSDCForTrading(
    amount: Decimal | number | string = "1000000"
  ): Promise<TradeResponse> {
    try {
      const amountDecimal = new Decimal(amount);
      const amountUnits = toUSDCUnits(amountDecimal);

      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.usdc as `0x${string}`,
        abi: USDCContractABI,
        functionName: "approve",
        args: [this.network.contracts.trading as `0x${string}`, amountUnits],
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("usdcApproved", {
        amount: amountDecimal,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Prepares an open position transaction WITHOUT executing it
   * Returns transaction data that can be sent via custom infrastructure (e.g., Privy Wallet API)
   * @param params - Same params as openPosition()
   * @returns Transaction data { to, data, value }
   */
  public async prepareOpenPositionTransaction(
    params: OpenPositionParams
  ): Promise<{ to: string; data: string; value: string }> {
    // Validate parameters
    const validated = validate(OpenPositionParamsSchema, params);

    if (!this.tradingContract) {
      throw new TradingError(
        ErrorCode.CONTRACT_NOT_FOUND,
        "Trading contract not deployed on this network"
      );
    }

    // Get market configuration
    const marketConfig = await this.getMarketConfig(params.pair);
    const pairIndex = marketConfig.pairIndex;

    // Determine order type
    const orderType = params.orderType || OrderType.MARKET;
    let orderTypeValue: number;
    switch (orderType) {
      case OrderType.MARKET:
        orderTypeValue = OrderTypeValue.MARKET;
        break;
      case OrderType.STOP_LIMIT:
        orderTypeValue = OrderTypeValue.STOP_LIMIT;
        break;
      case OrderType.LIMIT:
        orderTypeValue = OrderTypeValue.LIMIT;
        break;
      case OrderType.MARKET_ZERO_FEE:
        orderTypeValue = OrderTypeValue.MARKET_ZERO_FEE;
        break;
      default:
        orderTypeValue = OrderTypeValue.MARKET;
    }

    // Validate openPrice requirements
    if (
      (orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT) &&
      !params.openPrice
    ) {
      throw new ValidationError(
        `Open price is required for ${orderType === OrderType.LIMIT ? "limit" : "stop-limit"} orders`,
        "openPrice"
      );
    }

    // Validate position size
    const size = validatePositionSize(
      params.size,
      marketConfig.minPositionSizeUSDC,
      marketConfig.maxPositionSizeUSDC.gt(0)
        ? marketConfig.maxPositionSizeUSDC
        : new Decimal(1000000)
    );

    // Validate leverage
    validateLeverage(params.leverage, marketConfig.maxLeverage);

    // Calculate collateral
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

    // Prepare trade struct
    const isLong = params.side === PositionSide.LONG;
    const collateralUnits = toUSDCUnits(collateral);
    const positionSizeUnits = toUSDCUnits(size);
    const stopLossUnits = params.stopLoss
      ? toPriceUnits(params.stopLoss)
      : BigInt(0);
    const takeProfitUnits = params.takeProfit
      ? toPriceUnits(params.takeProfit)
      : BigInt(0);
    const slippageUnits = parseUnits(
      ((params.slippage || 0.5) / 100).toString(),
      10
    );

    // Get or fetch open price
    let openPriceUnits: bigint;
    if (params.openPrice) {
      const providedPrice = new Decimal(params.openPrice);
      openPriceUnits = BigInt(
        providedPrice.mul(new Decimal(10).pow(10)).toFixed(0)
      );
    } else {
      const priceData = await this.pythClient.getLatestPrice(params.pair);
      const expo = priceData.expo;
      const pythPrice = new Decimal(priceData.price.toString());
      const exponentAdjustment = 10 + expo;
      openPriceUnits = BigInt(
        pythPrice.mul(new Decimal(10).pow(exponentAdjustment)).toFixed(0)
      );
    }

    const isZeroFeeOrder = orderType === OrderType.MARKET_ZERO_FEE;
    const positionSizeValue = isZeroFeeOrder
      ? collateralUnits
      : positionSizeUnits;

    const tradeStruct = {
      trader: address,
      pairIndex: pairIndex,
      index: 0,
      initialPosToken: 0,
      positionSizeUSDC: positionSizeValue,
      openPrice: openPriceUnits,
      buy: isLong,
      leverage: toLeverageUnits(params.leverage),
      tp: takeProfitUnits,
      sl: stopLossUnits,
      timestamp: 0,
    };

    // Encode function call data
    const data = encodeFunctionData({
      abi: TradingContractABI,
      functionName: "openTrade",
      args: [tradeStruct, orderTypeValue, slippageUnits],
    });

    return {
      to: this.network.contracts.trading,
      data: data as string,
      value: "0",
    };
  }

  /**
   * Opens a new trading position (market or limit order)
   */
  public async openPosition(
    params: OpenPositionParams
  ): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(OpenPositionParamsSchema, params);

      // Check if trading contract is available
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Get market configuration from Socket API (dynamic, always up-to-date)
      const marketConfig = await this.getMarketConfig(params.pair);
      const pairIndex = marketConfig.pairIndex;

      // Determine order type
      const orderType = params.orderType || OrderType.MARKET;
      let orderTypeValue: number;
      switch (orderType) {
        case OrderType.MARKET:
          orderTypeValue = OrderTypeValue.MARKET;
          break;
        case OrderType.STOP_LIMIT:
          orderTypeValue = OrderTypeValue.STOP_LIMIT;
          break;
        case OrderType.LIMIT:
          orderTypeValue = OrderTypeValue.LIMIT;
          break;
        case OrderType.MARKET_ZERO_FEE:
          orderTypeValue = OrderTypeValue.MARKET_ZERO_FEE;
          break;
        default:
          orderTypeValue = OrderTypeValue.MARKET;
      }

      // Validate openPrice requirements based on order type
      // LIMIT and STOP_LIMIT orders REQUIRE openPrice to be explicitly provided
      if (
        (orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT) &&
        !params.openPrice
      ) {
        throw new ValidationError(
          `Open price is required for ${orderType === OrderType.LIMIT ? "limit" : "stop-limit"} orders`,
          "openPrice"
        );
      }

      // Validate position size using dynamic minimums from Socket API
      const size = validatePositionSize(
        params.size,
        marketConfig.minPositionSizeUSDC,
        marketConfig.maxPositionSizeUSDC.gt(0)
          ? marketConfig.maxPositionSizeUSDC
          : new Decimal(1000000)
      );

      // Validate leverage using dynamic maximums from Socket API
      validateLeverage(params.leverage, marketConfig.maxLeverage);

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
      const stopLossUnits = params.stopLoss
        ? toPriceUnits(params.stopLoss)
        : BigInt(0);
      const takeProfitUnits = params.takeProfit
        ? toPriceUnits(params.takeProfit)
        : BigInt(0);
      const slippageUnits = parseUnits(
        ((params.slippage || 0.5) / 100).toString(),
        10
      );

      // Get or fetch open price based on order type
      let openPriceUnits: bigint;
      if (params.openPrice) {
        // Use provided price (required for LIMIT/STOP_LIMIT, optional for MARKET)
        // Convert to 10 decimals format expected by contract
        const providedPrice = new Decimal(params.openPrice);
        openPriceUnits = BigInt(
          providedPrice.mul(new Decimal(10).pow(10)).toFixed(0)
        );
      } else {
        // Auto-fetch current price for MARKET and MARKET_ZERO_FEE orders
        // This only executes for market orders since we validated above
        const priceData = await this.pythClient.getLatestPrice(params.pair);
        // Convert Pyth price directly to 10 decimals
        // Pyth format: price * 10^expo, Contract expects: price * 10^10
        // So we multiply by 10^(10 + expo)
        const expo = priceData.expo;
        const pythPrice = new Decimal(priceData.price.toString());
        const exponentAdjustment = 10 + expo; // e.g., 10 + (-8) = 2
        openPriceUnits = BigInt(
          pythPrice.mul(new Decimal(10).pow(exponentAdjustment)).toFixed(0)
        );
      }

      // For MARKET_ZERO_FEE orders, positionSizeUSDC should contain collateral amount (not position size)
      // For other order types, it contains the full position size
      const isZeroFeeOrder = orderType === OrderType.MARKET_ZERO_FEE;
      const positionSizeValue = isZeroFeeOrder
        ? collateralUnits
        : positionSizeUnits;

      const tradeStruct = {
        trader: address,
        pairIndex: pairIndex,
        index: 0, // This will be assigned by the contract
        initialPosToken: 0, // Always 0 for new positions
        positionSizeUSDC: positionSizeValue,
        openPrice: openPriceUnits,
        buy: isLong,
        leverage: toLeverageUnits(params.leverage),
        tp: takeProfitUnits,
        sl: stopLossUnits,
        timestamp: 0, // Must be 0 for new positions (contract will set timestamp)
      };

      console.log("tradeStruct === ", tradeStruct);
      console.log("slippageUnits === ", slippageUnits);

      // Execute transaction with proper execution fee
      // NOTE: Execution fee (0.00035 ETH) is ALWAYS required, even in gasless mode
      // - In gasless mode: Paymaster sponsors GAS fees, but smart account pays execution fee
      // - In regular mode: User pays both GAS fees and execution fee
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "openTrade",
        args: [tradeStruct, orderTypeValue, slippageUnits],
        value: BigInt(0), // Always include execution fee
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Parse events based on order type
      let eventName: string;
      const isMarketOrder =
        orderType === OrderType.MARKET ||
        orderType === OrderType.MARKET_ZERO_FEE;
      if (isMarketOrder) {
        eventName = "MarketOrderInitiated";
      } else {
        eventName = "LimitOrderInitiated";
      }

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      let position: Position | undefined;
      if (event && isMarketOrder) {
        // For market orders, try to get the position immediately
        // The position might not be available immediately for market orders
        // as they go through oracle execution
      }

      this.emit(isMarketOrder ? "positionOpened" : "limitOrderPlaced", {
        position,
        transactionHash: receipt.transactionHash,
        orderType,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        position,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Prepares a close position transaction WITHOUT executing it
   * Returns transaction data that can be sent via custom infrastructure (e.g., Privy Wallet API)
   * @param params - Same params as closePosition()
   * @returns Transaction data { to, data, value }
   */
  public async prepareClosePositionTransaction(
    params: ClosePositionParams
  ): Promise<{ to: string; data: string; value: string }> {
    // Validate parameters
    const validated = validate(ClosePositionParamsSchema, params);

    if (!this.tradingContract) {
      throw new TradingError(
        ErrorCode.CONTRACT_NOT_FOUND,
        "Trading contract not deployed on this network"
      );
    }

    // Parse position ID
    const [pairIndexStr, positionIndexStr] = params.positionId.split("-");
    if (!pairIndexStr || !positionIndexStr) {
      throw new ValidationError(
        'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
        "positionId"
      );
    }

    const pairIndex = parseInt(pairIndexStr);
    const positionIndex = parseInt(positionIndexStr);

    // Determine close amount
    const collateralToClose = params.collateralAmount || params.size;
    const closeAmount = collateralToClose
      ? toUSDCUnits(collateralToClose)
      : BigInt(0);

    // Encode function call data
    const data = encodeFunctionData({
      abi: TradingContractABI,
      functionName: "closeTradeMarket",
      args: [pairIndex, positionIndex, closeAmount],
    });

    return {
      to: this.network.contracts.trading,
      data: data as string,
      value: "0",
    };
  }

  /**
   * Closes an existing position
   */
  public async closePosition(
    params: ClosePositionParams
  ): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(ClosePositionParamsSchema, params);

      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Parse position ID to get pair index and position index
      // Position ID format should be "pairIndex-positionIndex"
      const [pairIndexStr, positionIndexStr] = params.positionId.split("-");
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          "positionId"
        );
      }

      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);

      // Determine close amount (0 means close full position)
      // collateralAmount takes priority over size for clarity
      // Both represent the amount of COLLATERAL to close (not position size)
      const collateralToClose = params.collateralAmount || params.size;
      const closeAmount = collateralToClose
        ? toUSDCUnits(collateralToClose)
        : BigInt(0);

      // Execute closeTradeMarket with execution fee
      // NOTE: Execution fee (0.00035 ETH) is ALWAYS required, even in gasless mode
      // - In gasless mode: Paymaster sponsors GAS fees, but smart account pays execution fee
      // - In regular mode: User pays both GAS fees and execution fee
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "closeTradeMarket",
        args: [pairIndex, positionIndex, closeAmount],
        value: BigInt(0), // Always include execution fee
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("positionClosed", {
        positionId: params.positionId,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Prepares an update position (TP/SL) transaction WITHOUT executing it
   * Returns transaction data that can be sent via custom infrastructure (e.g., Privy Wallet API)
   * @param params - Same params as updatePosition()
   * @returns Transaction data { to, data, value }
   */
  public async prepareUpdatePositionTransaction(
    params: UpdatePositionParams
  ): Promise<{ to: string; data: string; value: string }> {
    // Validate parameters
    const validated = validate(UpdatePositionParamsSchema, params);

    if (!this.tradingContract) {
      throw new TradingError(
        ErrorCode.CONTRACT_NOT_FOUND,
        "Trading contract not deployed on this network"
      );
    }

    // Parse position ID
    const [pairIndexStr, positionIndexStr] = params.positionId.split("-");
    if (!pairIndexStr || !positionIndexStr) {
      throw new ValidationError(
        'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
        "positionId"
      );
    }

    const pairIndex = parseInt(pairIndexStr);
    const positionIndex = parseInt(positionIndexStr);

    const stopLossUnits = params.stopLoss
      ? toPriceUnits(params.stopLoss)
      : BigInt(0);
    const takeProfitUnits = params.takeProfit
      ? toPriceUnits(params.takeProfit)
      : BigInt(0);

    // Get pair name from Socket API for Pyth price data
    const pairName = await this.getPairNameFromAPI(pairIndex);

    // Get Pyth price update data
    const autofetch = params.autofetchPrices !== false;
    let priceUpdateData: string[] = params.priceUpdateData || [];

    if (autofetch && priceUpdateData.length === 0) {
      try {
        priceUpdateData = await this.pythClient.getPriceUpdateData(pairName);
      } catch (error) {
        console.warn(
          `Failed to fetch Pyth price data for ${pairName}:`,
          error
        );
      }
    }

    // Encode function call data
    const data = encodeFunctionData({
      abi: TradingContractABI,
      functionName: "updateTpAndSl",
      args: [
        pairIndex,
        positionIndex,
        stopLossUnits,
        takeProfitUnits,
        priceUpdateData,
      ],
    });

    return {
      to: this.network.contracts.trading,
      data: data as string,
      value: "0",
    };
  }

  /**
   * Updates position stop loss and take profit
   */
  public async updatePosition(
    params: UpdatePositionParams
  ): Promise<TradeResponse> {
    try {
      // Validate parameters
      const validated = validate(UpdatePositionParamsSchema, params);

      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Parse position ID to get pair index and position index
      const [pairIndexStr, positionIndexStr] = params.positionId.split("-");
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          "positionId"
        );
      }

      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);

      const stopLossUnits = params.stopLoss
        ? toPriceUnits(params.stopLoss)
        : BigInt(0);
      const takeProfitUnits = params.takeProfit
        ? toPriceUnits(params.takeProfit)
        : BigInt(0);

      // Get pair name from Socket API for Pyth price data
      const pairName = await this.getPairNameFromAPI(pairIndex);

      // Get Pyth price update data
      const autofetch = params.autofetchPrices !== false; // Default to true
      let priceUpdateData: string[] = params.priceUpdateData || [];

      if (autofetch && priceUpdateData.length === 0) {
        try {
          priceUpdateData = await this.pythClient.getPriceUpdateData(pairName);
        } catch (error) {
          console.warn(
            `Failed to fetch Pyth price data for ${pairName}:`,
            error
          );
        }
      }

      console.log("priceUpdateData === ", priceUpdateData);

      // Execute updateTpAndSl transaction
      // Note: Contract expects (pairIndex, index, _newSl, _newTP, priceUpdateData)
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "updateTpAndSl",
        args: [
          pairIndex,
          positionIndex,
          stopLossUnits, // Stop loss FIRST
          takeProfitUnits, // Take profit SECOND
          priceUpdateData, // Pyth price update data
        ],
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("positionUpdated", {
        positionId: params.positionId,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets a specific position from TradingStorage
   */
  public async getPosition(
    pairIndex: number,
    positionIndex: number,
    trader?: string
  ): Promise<Position | null> {
    try {
      const addr = trader || (await this.getAddress());

      // Get position data from TradingStorage via storage contract interface
      const publicClient = this.blockchain.getProvider();
      const tradingStorageAddress = this.network.contracts.tradingStorage;

      if (
        !tradingStorageAddress ||
        tradingStorageAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return null;
      }

      const tradingStorageContract: any = getContract({
        address: tradingStorageAddress as `0x${string}`,
        abi: TradingStorageContractABI,
        client: publicClient as any,
      });

      // Call openTrades(trader, pairIndex, index)
      const trade = await tradingStorageContract.read.openTrades([
        addr as `0x${string}`,
        pairIndex,
        positionIndex,
      ]);

      // Check if trade exists (trader address should not be zero)
      if (
        !trade ||
        trade.trader === "0x0000000000000000000000000000000000000000"
      ) {
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
      const addr = address || (await this.getAddress());

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
  private async parsePositionData(
    trade: any,
    pairIndex: number,
    positionIndex: number
  ): Promise<Position> {
    const pairName = await this.getPairNameFromAPI(pairIndex);
    const side = trade.buy ? PositionSide.LONG : PositionSide.SHORT;

    // Collateral (initialPosToken) uses 6 decimals (actual USDC amount)
    const collateral = new Decimal(formatUSDC(trade.initialPosToken));

    // Leverage uses 10 decimals in the contract
    const leverage = Number(trade.leverage) / 1e10;

    // Calculate position size from collateral and leverage
    // Size = Collateral × Leverage (this is the USD value of the position)
    const size = collateral.mul(leverage);

    // Prices use 10 decimals in the contract
    const entryPrice = new Decimal(trade.openPrice.toString()).div(1e10);

    // Calculate liquidation price
    const {
      calculateLiquidationPrice,
      calculateUnrealizedPnL,
      calculatePnLPercentage,
    } = await import("../utils/calculations");
    const liquidationPrice = calculateLiquidationPrice(
      entryPrice,
      leverage,
      side
    );

    // Get current mark price (try multiple sources)
    let markPrice = entryPrice;
    try {
      // First, try to get current price from Pyth via Socket API
      try {
        const marketConfig = await this.getMarketConfigByPairIndex(pairIndex);
        if (marketConfig && marketConfig.pythFeedId) {
          const pythPrice = await this.pythClient.getFormattedPriceByFeedId(
            marketConfig.pythFeedId
          );
          markPrice = new Decimal(pythPrice.price);
        }
      } catch (pythError) {
        // If Pyth fails, try price aggregator contract
        if (
          this.network.contracts.priceAggregator &&
          this.network.contracts.priceAggregator !==
            "0x0000000000000000000000000000000000000000"
        ) {
          const priceAggregatorContract: any = getContract({
            address: this.network.contracts.priceAggregator as `0x${string}`,
            abi: (await import("../contracts")).PriceAggregatorContractABI,
            client: this.blockchain.getProvider() as any,
          });
          const priceData = await priceAggregatorContract.read.getPrice([
            pairIndex,
          ]);
          // Price from aggregator also uses 10 decimals
          const priceValue = priceData.price || priceData[0];
          markPrice = new Decimal(priceValue.toString()).div(1e10);
        }
      }
    } catch {
      // Use entry price as fallback
    }

    // Calculate unrealized PnL using correct spot formula
    // Formula: Gross PNL = (Current price - Entry price) * Position Size in Base Currency
    const unrealizedPnl = calculateUnrealizedPnL(
      entryPrice,
      markPrice,
      size,
      side
    );

    // Calculate unrealized PnL percentage
    // Formula: Gross PNL % = [(Current price - Entry price) / Entry price] * 100
    const unrealizedPnlPercent = calculatePnLPercentage(
      entryPrice,
      markPrice,
      side
    );

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
      unrealizedPnlPercent,
      realizedPnl: new Decimal(0), // Not tracked in this version
      stopLoss:
        trade.sl && Number(trade.sl) > 0
          ? new Decimal(trade.sl.toString()).div(1e10)
          : undefined,
      takeProfit:
        trade.tp && Number(trade.tp) > 0
          ? new Decimal(trade.tp.toString()).div(1e10)
          : undefined,
      margin: collateral,
      maintenanceMargin,
      status: PositionStatus.OPEN,
      openedAt: new Date(Number(trade.timestamp) * 1000),
      lastUpdated: new Date(),
    };
  }

  /**
   * Cancels a pending limit order
   */
  public async cancelLimitOrder(
    params: CancelLimitOrderParams
  ): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Execute cancelOpenLimitOrder
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "cancelOpenLimitOrder",
        args: [params.pairIndex, params.orderIndex],
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      this.emit("limitOrderCanceled", {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Updates a pending limit order
   */
  public async updateLimitOrder(
    params: UpdateLimitOrderParams
  ): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      const priceUnits = toPriceUnits(params.price);
      const slippageUnits = parseUnits(
        ((params.slippage || 0.5) / 100).toString(),
        10
      );
      const tpUnits = params.takeProfit
        ? toPriceUnits(params.takeProfit)
        : BigInt(0);
      const slUnits = params.stopLoss
        ? toPriceUnits(params.stopLoss)
        : BigInt(0);

      // Execute updateOpenLimitOrder
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "updateOpenLimitOrder",
        args: [
          params.pairIndex,
          params.orderIndex,
          priceUnits,
          slippageUnits,
          tpUnits,
          slUnits,
        ],
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      // Note: Event parsing simplified - events will be emitted from contract
      const event = receipt.logs[0]; // First log typically contains the event

      this.emit("limitOrderUpdated", {
        pairIndex: params.pairIndex,
        orderIndex: params.orderIndex,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
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
    console.warn(
      "[DEPRECATED] getPairIndex() uses hardcoded pair mappings. Use getPairIndexFromAPI() for accurate indices."
    );
    return getPairIndex(pairName);
  }

  /**
   * Gets the pair name for a given index (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use getPairNameFromAPI() instead for accurate pair names
   */
  public getPairName(index: number): string {
    console.warn(
      "[DEPRECATED] getPairName() uses hardcoded pair mappings. Use getPairNameFromAPI() for accurate names."
    );
    return getPairName(index);
  }

  /**
   * Gets all available trading pairs (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use getAllPairsFromAPI() instead for all 89+ pairs
   */
  public getAllPairs(): string[] {
    console.warn(
      "[DEPRECATED] getAllPairs() returns hardcoded pairs. Use getAllPairsFromAPI() for all 89+ pairs."
    );
    return getAllPairs();
  }

  /**
   * Gets pairs by category (DEPRECATED - uses hardcoded mapping)
   * @deprecated Use Socket API methods via AvantisSDK.getMarketsByType() instead
   */
  public getPairsByCategory(
    category: "crypto" | "forex" | "commodity" | "index"
  ): string[] {
    console.warn(
      "[DEPRECATED] getPairsByCategory() uses hardcoded pairs. Use AvantisSDK.getMarketsByType() instead."
    );
    return getPairsByCategory(category);
  }

  /**
   * Gets the pair index for a given pair name from Socket API (dynamic, accurate)
   * @param pairName - The pair name (e.g., "ETH/USD", "BTC/USD")
   * @returns The pair index or throws error if not found
   */
  public async getPairIndexFromAPI(pairName: string): Promise<number> {
    const markets = await this.socketAPI.getAllMarkets();
    const market = markets.find(
      (m) => m.name.toUpperCase() === pairName.toUpperCase()
    );
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
   * Gets market configuration by pair index from Socket API with caching
   * @param pairIndex - The pair index
   * @returns Market configuration with dynamic limits
   */
  private async getMarketConfigByPairIndex(pairIndex: number): Promise<any> {
    // Ensure cache is populated
    if (
      !this.marketConfigCache ||
      Date.now() - this.marketCacheTimestamp > this.MARKET_CACHE_TTL_MS
    ) {
      await this.refreshMarketCache();
    }

    // Find market by pairIndex
    for (const [, config] of this.marketConfigCache!) {
      if (config.pairIndex === pairIndex) {
        return config;
      }
    }

    // If not found in cache, refresh and try again
    await this.refreshMarketCache();
    for (const [, config] of this.marketConfigCache!) {
      if (config.pairIndex === pairIndex) {
        return config;
      }
    }

    return null;
  }

  /**
   * Refreshes the market cache from Socket API
   */
  private async refreshMarketCache(): Promise<void> {
    const markets = await this.socketAPI.getAllMarkets();
    this.marketConfigCache = new Map();

    markets.forEach((market) => {
      this.marketConfigCache!.set(market.name.toUpperCase(), {
        pairIndex: market.pairIndex,
        name: market.name,
        minPositionSizeUSDC: market.minPositionSizeUSDC,
        maxPositionSizeUSDC: market.maxPositionSizeUSDC,
        minLeverage: market.minLeverage,
        maxLeverage: market.maxLeverage,
        spreadPercent: market.spreadPercent,
        pythFeedId: market.pythFeedId,
      });
    });

    this.marketCacheTimestamp = Date.now();
  }

  /**
   * Gets market configuration from Socket API with caching (dynamic, accurate)
   * Provides real-time min/max position sizes, leverage limits, and spread
   * @param pairName - The pair name (e.g., "ETH/USD", "BTC/USD")
   * @returns Market configuration with dynamic limits
   */
  public async getMarketConfig(pairName: string): Promise<any> {
    // Check cache freshness
    if (
      !this.marketConfigCache ||
      Date.now() - this.marketCacheTimestamp > this.MARKET_CACHE_TTL_MS
    ) {
      await this.refreshMarketCache();
      console.log(
        `Refreshed market config cache: ${this.marketConfigCache.size} markets available`
      );
    }

    const config = this.marketConfigCache.get(pairName.toUpperCase());
    if (!config) {
      // Fallback to hardcoded TRADING_PAIRS for backward compatibility
      const hardcodedConfig =
        TRADING_PAIRS[pairName as keyof typeof TRADING_PAIRS];
      if (hardcodedConfig) {
        console.warn(
          `Using hardcoded config for ${pairName} - Socket API data not available`
        );
        return {
          pairIndex: getPairIndex(pairName),
          name: pairName,
          minPositionSizeUSDC: new Decimal(hardcodedConfig.minSize),
          maxPositionSizeUSDC: new Decimal(hardcodedConfig.maxSize),
          minLeverage: 1,
          maxLeverage: hardcodedConfig.maxLeverage,
          spreadPercent: 0,
          pythFeedId: "",
        };
      }

      throw new TradingError(
        ErrorCode.INVALID_PAIR,
        `Trading pair not found: ${pairName}`,
        pairName
      );
    }

    return config;
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
    return markets.map((m) => m.name);
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
      const multicallAddress =
        this.network.chainId === 8453
          ? "0x7A829c5C97A2Bf8BeFB4b01d96A282E4763848d8" // Base mainnet
          : undefined; // Will use default from constants
      this.multicallBundler = new MulticallBundler(multicallAddress);
    }

    this.emit("platformFeeConfigSet", config);
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
  public async openPositionWithFees(
    params: OpenPositionParams
  ): Promise<TradeResponse> {
    try {
      // Check if fees are enabled
      if (
        !this.feeManager ||
        !this.feeManager.isEnabled() ||
        !params.platformFee?.enabled
      ) {
        // Fall back to regular openPosition if fees not enabled
        return await this.openPosition(params);
      }

      if (!this.multicallBundler) {
        throw new TradingError(
          ErrorCode.NOT_IMPLEMENTED,
          "Multicall bundler not initialized"
        );
      }

      // Validate parameters
      const validated = validate(OpenPositionParamsSchema, params);

      // Check contracts
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Get market configuration from Socket API (dynamic, always up-to-date)
      const marketConfig = await this.getMarketConfig(params.pair);
      const pairIndex = marketConfig.pairIndex;

      // Validate position size and leverage using dynamic limits from Socket API
      const size = validatePositionSize(
        params.size,
        marketConfig.minPositionSizeUSDC,
        marketConfig.maxPositionSizeUSDC.gt(0)
          ? marketConfig.maxPositionSizeUSDC
          : new Decimal(1000000)
      );
      validateLeverage(params.leverage, marketConfig.maxLeverage);

      // Calculate collateral
      const collateral = size.div(params.leverage);

      // Calculate platform fees
      const feeBreakdown = this.feeManager.calculateFeeBreakdown(
        size,
        params.platformFee
      );
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
        case OrderType.MARKET:
          orderTypeValue = OrderTypeValue.MARKET;
          break;
        case OrderType.STOP_LIMIT:
          orderTypeValue = OrderTypeValue.STOP_LIMIT;
          break;
        case OrderType.LIMIT:
          orderTypeValue = OrderTypeValue.LIMIT;
          break;
        case OrderType.MARKET_ZERO_FEE:
          orderTypeValue = OrderTypeValue.MARKET_ZERO_FEE;
          break;
        default:
          orderTypeValue = OrderTypeValue.MARKET;
      }

      // Validate openPrice requirements based on order type
      // LIMIT and STOP_LIMIT orders REQUIRE openPrice to be explicitly provided
      if (
        (orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT) &&
        !params.openPrice
      ) {
        throw new ValidationError(
          `Open price is required for ${orderType === OrderType.LIMIT ? "limit" : "stop-limit"} orders`,
          "openPrice"
        );
      }

      // Get or fetch open price based on order type (same as openPosition method)
      let openPriceUnits: bigint;
      if (params.openPrice) {
        // Use provided price (required for LIMIT/STOP_LIMIT, optional for MARKET)
        // Convert to 10 decimals format expected by contract
        const providedPrice = new Decimal(params.openPrice);
        openPriceUnits = BigInt(
          providedPrice.mul(new Decimal(10).pow(10)).toFixed(0)
        );
      } else {
        // Auto-fetch current price for MARKET and MARKET_ZERO_FEE orders
        // This only executes for market orders since we validated above
        const priceData = await this.pythClient.getLatestPrice(params.pair);
        // Convert Pyth price directly to 10 decimals
        const expo = priceData.expo;
        const pythPrice = new Decimal(priceData.price.toString());
        const exponentAdjustment = 10 + expo; // e.g., 10 + (-8) = 2
        openPriceUnits = BigInt(
          pythPrice.mul(new Decimal(10).pow(exponentAdjustment)).toFixed(0)
        );
      }

      const collateralUnits = toUSDCUnits(collateral);
      const positionSizeUnits = toUSDCUnits(size);
      const stopLossUnits = params.stopLoss
        ? toPriceUnits(params.stopLoss)
        : BigInt(0);
      const takeProfitUnits = params.takeProfit
        ? toPriceUnits(params.takeProfit)
        : BigInt(0);

      // For MARKET_ZERO_FEE orders, positionSizeUSDC should contain collateral amount (not position size)
      const isZeroFeeOrder = orderType === OrderType.MARKET_ZERO_FEE;
      const positionSizeValue = isZeroFeeOrder
        ? collateralUnits
        : positionSizeUnits;

      const tradeStruct = {
        trader: address,
        pairIndex: pairIndex,
        index: 0,
        initialPosToken: 0, // Always 0 for new positions
        positionSizeUSDC: positionSizeValue,
        openPrice: openPriceUnits,
        buy: isLong,
        leverage: toLeverageUnits(params.leverage),
        tp: takeProfitUnits,
        sl: stopLossUnits,
        timestamp: 0, // Must be 0 for new positions
      };

      console.log("openPositionWithFees trade struct === ", tradeStruct);

      const slippageUnits = parseUnits(
        ((params.slippage || 0.5) / 100).toString(),
        10
      );
      const executionFee = parseEther("0.00035"); // 0.00035 ETH execution fee (per Avantis docs)

      // Bundle the transaction
      const feeConfig = this.feeManager.getConfig();
      const bundled = this.multicallBundler.bundleTradeWithFees({
        usdcAddress: this.network.contracts.usdc,
        tradingAddress: this.network.contracts.trading,
        platformWallet: feeConfig.platformWallet,
        referralAddress: params.platformFee.referralAddress,
        totalAmount: toUSDCUnits(totalRequired),
        platformFeeAmount: toUSDCUnits(feeBreakdown.platformReceives),
        referralFeeAmount: params.platformFee.referralAddress
          ? toUSDCUnits(feeBreakdown.referralFee)
          : undefined,
        tradeStruct,
        orderTypeValue,
        slippageUnits,
        executionFee,
      });

      console.log("openPositionWithFees bundled === ", bundled);

      // Execute fee transfers and trade separately (Multicall3 won't work for transfers)
      // Step 1: Transfer platform fee directly from user wallet
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const publicClient = this.blockchain.getProvider();

      // Fetch the current nonce to avoid nonce conflicts
      let currentNonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });

      if (feeBreakdown.platformReceives.gt(0)) {
        console.log(
          `Transferring platform fee: ${feeBreakdown.platformReceives.toFixed(6)} USDC (nonce: ${currentNonce})`
        );
        const platformFeeHash = await (walletClient as any).writeContract({
          address: this.network.contracts.usdc as `0x${string}`,
          abi: USDCContractABI,
          functionName: "transfer",
          args: [
            feeConfig.platformWallet as `0x${string}`,
            toUSDCUnits(feeBreakdown.platformReceives),
          ],
          account,
          nonce: currentNonce,
        });
        await this.blockchain.waitForTransaction(platformFeeHash);
        currentNonce++; // Increment nonce for next transaction
      }

      // Step 2: Transfer referral fee (if applicable)
      if (
        params.platformFee.referralAddress &&
        feeBreakdown.referralFee.gt(0)
      ) {
        console.log(
          `Transferring referral fee: ${feeBreakdown.referralFee.toFixed(6)} USDC (nonce: ${currentNonce})`
        );
        const referralFeeHash = await (walletClient as any).writeContract({
          address: this.network.contracts.usdc as `0x${string}`,
          abi: USDCContractABI,
          functionName: "transfer",
          args: [
            params.platformFee.referralAddress as `0x${string}`,
            toUSDCUnits(feeBreakdown.referralFee),
          ],
          account,
          nonce: currentNonce,
        });
        await this.blockchain.waitForTransaction(referralFeeHash);
        currentNonce++; // Increment nonce for next transaction
      }

      // Step 3: Execute the trade
      console.log(`Executing trade on Avantis... (nonce: ${currentNonce})`);
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "openTrade",
        args: [tradeStruct, orderTypeValue, slippageUnits],
        value: 0, // Execution fee in ETH (0.00035 ETH - REQUIRED)
        account,
        nonce: currentNonce,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("positionOpenedWithFees", {
        transactionHash: receipt.transactionHash,
        feeBreakdown,
        bundledOperations: bundled.description,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Closes a position with platform fees (bundled transaction)
   */
  public async closePositionWithFees(
    params: ClosePositionParams
  ): Promise<TradeResponse> {
    try {
      // Check if fees are enabled
      if (
        !this.feeManager ||
        !this.feeManager.isEnabled() ||
        !params.platformFee?.enabled
      ) {
        // Fall back to regular closePosition if fees not enabled
        return await this.closePosition(params);
      }

      if (!this.multicallBundler) {
        throw new TradingError(
          ErrorCode.NOT_IMPLEMENTED,
          "Multicall bundler not initialized"
        );
      }

      // Validate parameters
      const validated = validate(ClosePositionParamsSchema, params);

      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      // Parse position ID
      const [pairIndexStr, positionIndexStr] = params.positionId.split("-");
      if (!pairIndexStr || !positionIndexStr) {
        throw new ValidationError(
          'Invalid position ID format. Expected format: "pairIndex-positionIndex"',
          "positionId"
        );
      }

      const pairIndex = parseInt(pairIndexStr);
      const positionIndex = parseInt(positionIndexStr);

      // Determine close amount (collateralAmount takes priority over size)
      const collateralToClose = params.collateralAmount || params.size;
      const closeAmount = collateralToClose
        ? toUSDCUnits(collateralToClose)
        : BigInt(0);

      // Calculate platform fees on the closing size
      // Note: This is simplified - in reality you might want to calculate based on PnL or returned collateral
      const closeSize = collateralToClose || new Decimal(100); // Default placeholder
      const feeBreakdown = this.feeManager.calculateFeeBreakdown(
        closeSize,
        params.platformFee
      );

      // Bundle the transaction
      const feeConfig = this.feeManager.getConfig();
      const executionFee = parseEther("0.00035"); // 0.00035 ETH execution fee (per Avantis docs)

      const bundled = this.multicallBundler.bundleCloseWithFees({
        usdcAddress: this.network.contracts.usdc,
        tradingAddress: this.network.contracts.trading,
        platformWallet: feeConfig.platformWallet,
        referralAddress: params.platformFee.referralAddress,
        platformFeeAmount: toUSDCUnits(feeBreakdown.platformReceives),
        referralFeeAmount: params.platformFee.referralAddress
          ? toUSDCUnits(feeBreakdown.referralFee)
          : undefined,
        pairIndex,
        positionIndex,
        closeAmount,
        executionFee,
      });

      // Execute bundled transaction
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const publicClient = this.blockchain.getProvider();

      // Fetch the current nonce to avoid nonce conflicts
      const currentNonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });

      console.log(
        `Executing bundled close transaction (nonce: ${currentNonce})...`
      );
      const hash = await (walletClient as any).sendTransaction({
        to: bundled.to as `0x${string}`,
        data: bundled.data as `0x${string}`,
        value: 0, // Execution fee (0.00035 ETH)
        account,
        nonce: currentNonce,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("positionClosedWithFees", {
        positionId: params.positionId,
        transactionHash: receipt.transactionHash,
        feeBreakdown,
        bundledOperations: bundled.description,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Updates margin for an open position (add or remove collateral)
   */
  public async updateMargin(
    params: UpdateMarginParams
  ): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
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
          console.warn(
            `Failed to fetch Pyth price data for ${pairName}:`,
            error
          );
        }
      }

      // Execute updateMargin transaction
      // NOTE: Execution fee (0.00035 ETH) is ALWAYS required, even in gasless mode
      // - In gasless mode: Paymaster sponsors GAS fees, but smart account pays execution fee
      // - In regular mode: User pays both GAS fees and execution fee
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "updateMargin",
        args: [
          params.pairIndex,
          params.positionIndex,
          params.type, // 0 = ADD, 1 = REMOVE
          amountUnits,
          priceUpdateData,
        ],
        value: BigInt(0), // Always include execution fee
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("marginUpdated", {
        pairIndex: params.pairIndex,
        positionIndex: params.positionIndex,
        type: params.type,
        amount: params.amount,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Executes a limit order (for keepers/bots)
   */
  public async executeLimitOrder(
    params: ExecuteLimitOrderParams
  ): Promise<TradeResponse> {
    try {
      if (!this.tradingContract) {
        throw new TradingError(
          ErrorCode.CONTRACT_NOT_FOUND,
          "Trading contract not deployed on this network"
        );
      }

      const priceUpdateData = params.priceUpdateData || [];

      // Calculate execution fee (may need to cover Pyth fee)
      // NOTE: Execution fee (0.00035 ETH) is ALWAYS required, even in gasless mode
      // - In gasless mode: Paymaster sponsors GAS fees, but smart account pays execution fee
      // - In regular mode: User pays both GAS fees and execution fee

      // Execute the limit order
      const walletClient = this.blockchain.getSigner();
      const account = this.blockchain.getAccount();
      const hash = await (walletClient as any).writeContract({
        address: this.network.contracts.trading as `0x${string}`,
        abi: TradingContractABI,
        functionName: "executeLimitOrder",
        args: [
          params.orderType, // LimitOrderType enum
          params.trader as `0x${string}`,
          params.pairIndex,
          params.index,
          priceUpdateData,
        ],
        value: BigInt(0), // Always include execution fee
        account,
      });

      const receipt = await this.blockchain.waitForTransaction(hash);

      this.emit("limitOrderExecuted", {
        orderType: params.orderType,
        trader: params.trader,
        pairIndex: params.pairIndex,
        index: params.index,
        transactionHash: receipt.transactionHash,
      });

      return {
        success: receipt.status === "success",
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets all pending limit orders for the current account
   */
  public async getPendingLimitOrders(
    address?: string
  ): Promise<PendingLimitOrder[]> {
    try {
      const addr = address || (await this.getAddress());

      // Use StorageClient to fetch pending orders
      const publicClient = this.blockchain.getProvider();
      const tradingStorageAddress = this.network.contracts.tradingStorage;

      if (
        !tradingStorageAddress ||
        tradingStorageAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return [];
      }

      const tradingStorageContract: any = getContract({
        address: tradingStorageAddress as `0x${string}`,
        abi: TradingStorageContractABI,
        client: publicClient as any,
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
            const order = await tradingStorageContract.read.openLimitOrders([
              addr as `0x${string}`,
              pairIndex,
              i,
            ]);

            // Check if order exists
            if (
              order &&
              order.trader !== "0x0000000000000000000000000000000000000000"
            ) {
              orders.push({
                id: `${pairIndex}-${i}`,
                trader: order.trader,
                pairIndex,
                orderIndex: i,
                positionSize: new Decimal(formatUSDC(order.positionSizeUSDC)),
                buy: order.buy,
                leverage: Number(order.leverage),
                openPrice: new Decimal(
                  formatUSDC(order.minPrice || order.maxPrice)
                ),
                tp:
                  order.tp && Number(order.tp) > 0
                    ? new Decimal(formatUSDC(order.tp))
                    : undefined,
                sl:
                  order.sl && Number(order.sl) > 0
                    ? new Decimal(formatUSDC(order.sl))
                    : undefined,
                timestamp: new Date(),
                orderType: OrderType.LIMIT,
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
