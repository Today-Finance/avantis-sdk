import { EventEmitter } from 'eventemitter3';
import Decimal from 'decimal.js';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { WebSocketProvider } from '../providers/WebSocketProvider';
import {
  PriceFeedData,
  PriceUpdate,
  MarketStats,
  Candle,
  TimeInterval,
  MarketHours,
  FundingRate,
  PriceSubscriptionCallback,
  MarketEventCallback,
  MarketEvent,
  TradingPair
} from '../types';
import { TRADING_PAIRS, NETWORKS } from '../constants/networks';
import { WebSocketError, ErrorCode, handleError } from '../utils/errors';
import { validateTradingPair } from '../utils/validation';

interface PriceFeedConfig {
  apiUrl?: string;
  websocketUrl?: string;
  apiKey?: string;
  network?: keyof typeof NETWORKS;
}

export class FeedClient extends EventEmitter {
  private ws?: WebSocketProvider;
  private http: AxiosInstance;
  private subscriptions: Map<string, Set<PriceSubscriptionCallback>> = new Map();
  private marketEventCallbacks: Set<MarketEventCallback> = new Set();
  private priceCache: Map<string, PriceFeedData> = new Map();
  private config: PriceFeedConfig;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;

  constructor(config: PriceFeedConfig = {}) {
    super();
    
    this.config = {
      apiUrl: config.apiUrl || 'https://api.avantis.finance',
      websocketUrl: config.websocketUrl || NETWORKS[config.network || 'base'].websocketUrl,
      apiKey: config.apiKey,
      network: config.network || 'base'
    };

    // Initialize HTTP client
    this.http = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey })
      },
      timeout: 10000
    });
  }

  /**
   * Connects to the price feed WebSocket
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      if (!this.config.websocketUrl || this.config.websocketUrl.includes('YOUR_API_KEY')) {
        console.warn('WebSocket URL not configured. Real-time price feeds will not be available.');
        return;
      }

      this.ws = new WebSocketProvider({
        url: this.config.websocketUrl,
        reconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
      });

      // Set up event handlers
      this.setupWebSocketHandlers();

      // Connect to WebSocket
      await this.ws.connect();
      this.isConnected = true;
      
      // Subscribe to all active price feeds
      this.subscribeToAllFeeds();
      
      this.emit('connected');
    } catch (error) {
      throw new WebSocketError(
        ErrorCode.WS_CONNECTION_FAILED,
        'Failed to connect to price feed',
        error
      );
    }
  }

  /**
   * Disconnects from the price feed WebSocket
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = undefined;
    }
    
    this.isConnected = false;
    this.subscriptions.clear();
    this.marketEventCallbacks.clear();
    this.priceCache.clear();
    
    this.emit('disconnected');
  }

  /**
   * Subscribes to price updates for a trading pair
   */
  public subscribeToPrice(pair: string, callback: PriceSubscriptionCallback): () => void {
    validateTradingPair(pair);
    
    if (!this.subscriptions.has(pair)) {
      this.subscriptions.set(pair, new Set());
      
      // Subscribe via WebSocket if connected
      if (this.ws && this.isConnected) {
        const pairConfig = TRADING_PAIRS[pair as keyof typeof TRADING_PAIRS];
        if (pairConfig) {
          this.ws.subscribe('price', { feedId: pairConfig.feedId });
        }
      }
    }
    
    this.subscriptions.get(pair)!.add(callback);
    
    // Send cached price if available
    const cachedPrice = this.priceCache.get(pair);
    if (cachedPrice) {
      callback(cachedPrice);
    }
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(pair);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(pair);
          
          // Unsubscribe from WebSocket
          if (this.ws && this.isConnected) {
            const pairConfig = TRADING_PAIRS[pair as keyof typeof TRADING_PAIRS];
            if (pairConfig) {
              this.ws.unsubscribe(`price:${pairConfig.feedId}`);
            }
          }
        }
      }
    };
  }

  /**
   * Gets the latest price for a trading pair
   */
  public async getLatestPrice(pair: string): Promise<PriceFeedData> {
    validateTradingPair(pair);
    
    // Check cache first
    const cached = this.priceCache.get(pair);
    if (cached && (Date.now() - cached.timestamp.getTime()) < 1000) {
      return cached;
    }
    
    try {
      // Fetch from API
      const response = await this.http.get(`/prices/${pair}`);
      const data = response.data;
      
      const priceFeed: PriceFeedData = {
        pair,
        price: new Decimal(data.price),
        bid: new Decimal(data.bid || data.price),
        ask: new Decimal(data.ask || data.price),
        timestamp: new Date(data.timestamp),
        confidence: data.confidence || 1,
        expo: data.expo || -8
      };
      
      // Update cache
      this.priceCache.set(pair, priceFeed);
      
      // Notify subscribers
      this.notifyPriceSubscribers(pair, priceFeed);
      
      return priceFeed;
    } catch (error) {
      // If API fails, return cached price if available
      if (cached) {
        return cached;
      }
      throw handleError(error);
    }
  }

  /**
   * Gets multiple price feeds at once
   */
  public async getMultiplePrices(pairs: string[]): Promise<Map<string, PriceFeedData>> {
    const results = new Map<string, PriceFeedData>();
    
    // Fetch all prices in parallel
    const promises = pairs.map(async (pair) => {
      try {
        const price = await this.getLatestPrice(pair);
        results.set(pair, price);
      } catch (error) {
        console.error(`Failed to get price for ${pair}:`, error);
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Gets market statistics for a trading pair
   */
  public async getMarketStats(pair: string): Promise<MarketStats> {
    validateTradingPair(pair);
    
    try {
      const response = await this.http.get(`/stats/${pair}`);
      const data = response.data;
      
      return {
        pair,
        price: new Decimal(data.price),
        volume24h: new Decimal(data.volume24h || 0),
        high24h: new Decimal(data.high24h || data.price),
        low24h: new Decimal(data.low24h || data.price),
        change24h: new Decimal(data.change24h || 0),
        changePercent24h: data.changePercent24h || 0,
        openInterest: new Decimal(data.openInterest || 0),
        fundingRate: new Decimal(data.fundingRate || 0),
        nextFundingTime: new Date(data.nextFundingTime || Date.now() + 3600000)
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets historical candle data
   */
  public async getCandles(
    pair: string,
    interval: TimeInterval,
    limit: number = 100
  ): Promise<Candle[]> {
    validateTradingPair(pair);
    
    try {
      const response = await this.http.get(`/candles/${pair}`, {
        params: { interval, limit }
      });
      
      return response.data.map((c: any) => ({
        time: new Date(c.time),
        open: new Decimal(c.open),
        high: new Decimal(c.high),
        low: new Decimal(c.low),
        close: new Decimal(c.close),
        volume: new Decimal(c.volume)
      }));
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets market hours for a trading pair
   */
  public async getMarketHours(pair: string): Promise<MarketHours> {
    validateTradingPair(pair);
    
    const pairConfig = TRADING_PAIRS[pair as keyof typeof TRADING_PAIRS];
    if (!pairConfig) {
      throw new Error(`Unknown trading pair: ${pair}`);
    }
    
    // Crypto markets are always open
    if (pairConfig.category === 'crypto') {
      return {
        pair,
        isOpen: true,
        timezone: 'UTC'
      };
    }
    
    // TODO: Implement actual market hours for forex/commodities
    // This is a simplified implementation
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours();
    
    // Forex: Sunday 5PM - Friday 5PM EST (UTC-5)
    if (pairConfig.category === 'forex') {
      const isWeekend = dayOfWeek === 6 || (dayOfWeek === 0 && hour < 22) || (dayOfWeek === 5 && hour >= 22);
      
      return {
        pair,
        isOpen: !isWeekend,
        nextOpen: isWeekend ? this.getNextForexOpen(now) : undefined,
        nextClose: !isWeekend ? this.getNextForexClose(now) : undefined,
        timezone: 'UTC'
      };
    }
    
    // Commodities: Various hours
    return {
      pair,
      isOpen: true, // Simplified - always open
      timezone: 'UTC'
    };
  }

  /**
   * Gets the current funding rate
   */
  public async getFundingRate(pair: string): Promise<FundingRate> {
    validateTradingPair(pair);
    
    try {
      const response = await this.http.get(`/funding/${pair}`);
      const data = response.data;
      
      return {
        pair,
        rate: new Decimal(data.rate || 0),
        nextFundingTime: new Date(data.nextFundingTime || Date.now() + 3600000),
        timestamp: new Date(data.timestamp || Date.now())
      };
    } catch (error) {
      // Return default funding rate if API fails
      return {
        pair,
        rate: new Decimal(0),
        nextFundingTime: new Date(Date.now() + 3600000),
        timestamp: new Date()
      };
    }
  }

  /**
   * Subscribes to market events
   */
  public onMarketEvent(callback: MarketEventCallback): () => void {
    this.marketEventCallbacks.add(callback);
    
    return () => {
      this.marketEventCallbacks.delete(callback);
    };
  }

  /**
   * Sets up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;
    
    this.ws.on('message', (message: any) => {
      this.handleWebSocketMessage(message);
    });
    
    this.ws.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });
    
    this.ws.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });
    
    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
    
    this.ws.on('reconnecting', (data: any) => {
      this.reconnectAttempts = data.attempt;
      this.emit('reconnecting', data);
    });
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    try {
      switch (message.type) {
        case 'price':
          this.handlePriceUpdate(message.data);
          break;
        case 'trade':
          this.handleTradeEvent(message.data);
          break;
        case 'liquidation':
          this.handleLiquidationEvent(message.data);
          break;
        case 'funding':
          this.handleFundingUpdate(message.data);
          break;
        default:
          console.debug('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handles price updates from WebSocket
   */
  private handlePriceUpdate(data: any): void {
    const pair = this.getPairFromFeedId(data.feedId);
    if (!pair) return;
    
    const priceFeed: PriceFeedData = {
      pair,
      price: new Decimal(data.price),
      bid: new Decimal(data.bid || data.price),
      ask: new Decimal(data.ask || data.price),
      timestamp: new Date(data.timestamp),
      confidence: data.confidence || 1,
      expo: data.expo || -8
    };
    
    // Update cache
    this.priceCache.set(pair, priceFeed);
    
    // Notify subscribers
    this.notifyPriceSubscribers(pair, priceFeed);
    
    // Emit price update event
    this.emit('priceUpdate', { pair, data: priceFeed });
  }

  /**
   * Handles trade events from WebSocket
   */
  private handleTradeEvent(data: any): void {
    const event: MarketEvent = {
      type: 'trade',
      pair: data.pair,
      data: {
        price: new Decimal(data.price),
        size: new Decimal(data.size),
        side: data.side,
        timestamp: new Date(data.timestamp)
      },
      timestamp: new Date()
    };
    
    this.notifyMarketEventCallbacks(event);
    this.emit('trade', event);
  }

  /**
   * Handles liquidation events from WebSocket
   */
  private handleLiquidationEvent(data: any): void {
    const event: MarketEvent = {
      type: 'liquidation',
      pair: data.pair,
      data: {
        positionId: data.positionId,
        side: data.side,
        size: new Decimal(data.size),
        price: new Decimal(data.price),
        timestamp: new Date(data.timestamp)
      },
      timestamp: new Date()
    };
    
    this.notifyMarketEventCallbacks(event);
    this.emit('liquidation', event);
  }

  /**
   * Handles funding rate updates
   */
  private handleFundingUpdate(data: any): void {
    const event: MarketEvent = {
      type: 'funding',
      pair: data.pair,
      data: {
        rate: new Decimal(data.rate),
        nextFundingTime: new Date(data.nextFundingTime),
        timestamp: new Date(data.timestamp)
      },
      timestamp: new Date()
    };
    
    this.notifyMarketEventCallbacks(event);
    this.emit('funding', event);
  }

  /**
   * Notifies price subscribers
   */
  private notifyPriceSubscribers(pair: string, data: PriceFeedData): void {
    const subscribers = this.subscriptions.get(pair);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in price subscription callback:', error);
        }
      });
    }
  }

  /**
   * Notifies market event callbacks
   */
  private notifyMarketEventCallbacks(event: MarketEvent): void {
    this.marketEventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in market event callback:', error);
      }
    });
  }

  /**
   * Subscribes to all active price feeds
   */
  private subscribeToAllFeeds(): void {
    if (!this.ws || !this.isConnected) return;
    
    for (const [pair, callbacks] of this.subscriptions.entries()) {
      if (callbacks.size > 0) {
        const pairConfig = TRADING_PAIRS[pair as keyof typeof TRADING_PAIRS];
        if (pairConfig) {
          this.ws.subscribe('price', { feedId: pairConfig.feedId });
        }
      }
    }
  }

  /**
   * Gets trading pair from feed ID
   */
  private getPairFromFeedId(feedId: string): string | null {
    for (const [pair, config] of Object.entries(TRADING_PAIRS)) {
      if (config.feedId === feedId) {
        return pair;
      }
    }
    return null;
  }

  /**
   * Gets next forex market open time
   */
  private getNextForexOpen(now: Date): Date {
    const nextSunday = new Date(now);
    nextSunday.setUTCDate(now.getUTCDate() + (7 - now.getUTCDay()));
    nextSunday.setUTCHours(22, 0, 0, 0); // 5PM EST = 10PM UTC
    return nextSunday;
  }

  /**
   * Gets next forex market close time
   */
  private getNextForexClose(now: Date): Date {
    const nextFriday = new Date(now);
    const daysUntilFriday = (5 - now.getUTCDay() + 7) % 7 || 7;
    nextFriday.setUTCDate(now.getUTCDate() + daysUntilFriday);
    nextFriday.setUTCHours(22, 0, 0, 0); // 5PM EST = 10PM UTC
    return nextFriday;
  }
}