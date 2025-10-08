import Decimal from 'decimal.js';

export interface PriceFeedData {
  pair: string;
  price: Decimal;
  bid: Decimal;
  ask: Decimal;
  timestamp: Date;
  confidence: number;
  expo: number;
}

export interface PriceUpdate {
  feedId: string;
  price: Decimal;
  publishTime: Date;
  prevPrice?: Decimal;
  emaPrice?: Decimal;
}

export interface OrderBook {
  pair: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Date;
}

export interface OrderBookEntry {
  price: Decimal;
  size: Decimal;
}

export interface Candle {
  time: Date;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
}

export interface MarketHours {
  pair: string;
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
  timezone: string;
}

export type PriceSubscriptionCallback = (data: PriceFeedData) => void;
export type MarketEventCallback = (event: MarketEvent) => void;

export interface MarketEvent {
  type: 'trade' | 'liquidation' | 'funding' | 'orderbook_update';
  pair: string;
  data: any;
  timestamp: Date;
}

export interface FundingRate {
  pair: string;
  rate: Decimal;
  nextFundingTime: Date;
  timestamp: Date;
}

export interface LiquidationEvent {
  positionId: string;
  pair: string;
  side: 'long' | 'short';
  size: Decimal;
  price: Decimal;
  timestamp: Date;
}

export interface TradeEvent {
  pair: string;
  price: Decimal;
  size: Decimal;
  side: 'buy' | 'sell';
  timestamp: Date;
}

export enum TimeInterval {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
  W1 = '1w'
}

// Contract data structures from PairStorage
export interface PairStorageData {
  pairIndex: number;
  feed: {
    maxOpenDeviationP: number;
    maxCloseDeviationP: number;
    feedId: string; // bytes32 Pyth feed ID
  };
  backupFeed: {
    maxDeviationP: number;
    feedId: string; // address
  };
  spreadP: number;
  pnlSpreadP: number;
  leverages: {
    minLeverage: number;
    maxLeverage: number;
    pnlMinLeverage: number;
    pnlMaxLeverage: number;
  };
  priceImpactMultiplier: number;
  skewImpactMultiplier: number;
  groupIndex: number;
  feeIndex: number;
  values: {
    maxGainP: number;
    maxSlP: number;
    maxLongOiP: number;
    maxShortOiP: number;
    groupOpenInterestPecentage: number;
    maxWalletOI: number;
    isUSDCAligned: boolean;
  };
}

// Contract data structures from PairInfos
export interface PairInfosData {
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

// Combined market data with proper formatting
export interface MarketData {
  pairIndex: number;
  name: string;
  from: string;
  to: string;
  pythFeedId: string; // Formatted bytes32 hex string
  spreadPercent: number; // Formatted as percentage
  minLeverage: number; // Formatted from 10 decimals
  maxLeverage: number; // Formatted from 10 decimals
  minPositionSizeUSDC: Decimal; // In USDC with 6 decimals
  maxPositionSizeUSDC: Decimal; // In USDC with 6 decimals
  maxOpenInterestLong: Decimal;
  maxOpenInterestShort: Decimal;
  groupIndex: number;
  feeIndex: number;
  priceImpactMultiplier: number;
  skewImpactMultiplier: number;
  isUSDCAligned: boolean;
  // Optional price data from Pyth
  currentPrice?: {
    price: string;
    confidence: string;
    expo: number;
    publishTime: number;
  };
}