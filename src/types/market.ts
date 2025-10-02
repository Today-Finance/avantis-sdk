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