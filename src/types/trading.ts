import Decimal from "decimal.js";
import type { PlatformFeeParams } from "./platform-fees";

export enum PositionSide {
  LONG = "long",
  SHORT = "short",
}

export enum OrderType {
  MARKET = "market",
  STOP_LIMIT = "stop_limit",
  LIMIT = "limit",
  MARKET_ZERO_FEE = "market_zero_fee",
}

// Numeric values for contract interaction (matches Avantis Python SDK and smart contract)
export enum OrderTypeValue {
  MARKET = 0,
  STOP_LIMIT = 1,
  LIMIT = 2,
  MARKET_ZERO_FEE = 3,
}

export enum PositionStatus {
  OPEN = "open",
  CLOSED = "closed",
  LIQUIDATED = "liquidated",
  PENDING = "pending",
}

export interface TradingPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  feedId: string;
  minSize: Decimal;
  maxSize: Decimal;
  maxLeverage: number;
  decimals: number;
  isActive: boolean;
  category: "crypto" | "forex" | "commodity" | "index";
}

export interface OpenPositionParams {
  pair: string;
  side: PositionSide;
  size: Decimal | number | string;
  leverage: number;
  orderType?: OrderType; // Defaults to MARKET if not specified
  openPrice?: Decimal | number | string; // Required for LIMIT orders
  stopLoss?: Decimal | number | string;
  takeProfit?: Decimal | number | string;
  slippage?: number;
  referrer?: string;
  platformFee?: PlatformFeeParams; // Platform fee configuration
}

export interface ClosePositionParams {
  positionId: string;
  size?: Decimal | number | string; // DEPRECATED: Use collateralAmount instead
  collateralAmount?: Decimal | number | string; // Amount of collateral to close (omit to close full position)
  slippage?: number;
  platformFee?: PlatformFeeParams; // Platform fee configuration
}

export interface UpdatePositionParams {
  positionId: string;
  stopLoss?: Decimal | number | string | null;
  takeProfit?: Decimal | number | string | null;
  autofetchPrices?: boolean; // Auto-fetch Pyth price data (default: true)
  priceUpdateData?: string[]; // Manually provided Pyth price update data
}

export interface CancelLimitOrderParams {
  pairIndex: number;
  orderIndex: number;
}

export interface UpdateLimitOrderParams {
  pairIndex: number;
  orderIndex: number;
  price: Decimal | number | string;
  slippage?: number;
  takeProfit?: Decimal | number | string;
  stopLoss?: Decimal | number | string;
}

export interface PendingLimitOrder {
  id: string;
  trader: string;
  pairIndex: number;
  orderIndex: number;
  positionSize: Decimal;
  buy: boolean;
  leverage: number;
  openPrice: Decimal;
  tp?: Decimal;
  sl?: Decimal;
  timestamp: Date;
  orderType: OrderType;
}

export interface Position {
  id: string;
  owner: string;
  pair: string;
  side: PositionSide;
  size: Decimal;
  collateral: Decimal;
  leverage: number;
  entryPrice: Decimal;
  markPrice: Decimal;
  liquidationPrice: Decimal;
  unrealizedPnl: Decimal;
  realizedPnl: Decimal;
  stopLoss?: Decimal;
  takeProfit?: Decimal;
  margin: Decimal;
  maintenanceMargin: Decimal;
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
  lastUpdated: Date;
}

export interface TradeResponse {
  receipt?: any;
  success: boolean;
  transactionHash: string;
  position?: Position;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  error?: string;
}

export interface PendingTrade {
  id: string;
  type: "open" | "close" | "update";
  params: OpenPositionParams | ClosePositionParams | UpdatePositionParams;
  status: "pending" | "submitted" | "confirmed" | "failed";
  transactionHash?: string;
  createdAt: Date;
  error?: string;
}

export interface TradingFees {
  openFee: Decimal;
  closeFee: Decimal;
  borrowFee: Decimal;
  fundingFee: Decimal;
}

export interface AccountInfo {
  address: string;
  balance: Decimal;
  usdcBalance: Decimal;
  tradingAllowance: Decimal;
  totalCollateral: Decimal;
  freeCollateral: Decimal;
  marginUsed: Decimal;
  unrealizedPnl: Decimal;
  realizedPnl: Decimal;
  positions: Position[];
  marginLevel: number;
}

export interface MarketStats {
  pair: string;
  price: Decimal;
  volume24h: Decimal;
  high24h: Decimal;
  low24h: Decimal;
  change24h: Decimal;
  changePercent24h: number;
  openInterest: Decimal;
  fundingRate: Decimal;
  nextFundingTime: Date;
}

// Margin update types
export enum MarginUpdateType {
  ADD = 0,
  REMOVE = 1,
}

export interface UpdateMarginParams {
  pairIndex: number;
  positionIndex: number;
  type: MarginUpdateType;
  amount: Decimal | number | string;
  autofetchPrices?: boolean; // Auto-fetch Pyth price data (default: true)
  priceUpdateData?: string[]; // Manually provided Pyth price update data
}

// Limit order execution types
export enum LimitOrderType {
  TP = 0, // Take Profit
  SL = 1, // Stop Loss
  LIQ = 2, // Liquidation
  OPEN = 3, // Open Limit Order
}

export interface ExecuteLimitOrderParams {
  orderType: LimitOrderType;
  trader: string;
  pairIndex: number;
  index: number;
  priceUpdateData?: string[]; // Pyth price update data
}
