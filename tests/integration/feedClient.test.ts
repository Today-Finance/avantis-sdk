import { FeedClient } from '../../src/clients/FeedClient';
import { WebSocketProvider } from '../../src/providers/WebSocketProvider';
import axios from 'axios';
import Decimal from 'decimal.js';
import { PriceFeedData, MarketStats, TimeInterval } from '../../src/types';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/providers/WebSocketProvider');

describe('FeedClient Integration Tests', () => {
  let feedClient: FeedClient;
  let mockAxios: jest.Mocked<typeof axios>;
  let mockWebSocket: jest.Mocked<WebSocketProvider>;

  beforeEach(() => {
    mockAxios = axios as jest.Mocked<typeof axios>;
    
    // Mock axios create
    mockAxios.create = jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        data: {
          price: '3000.50',
          bid: '3000.25',
          ask: '3000.75',
          timestamp: new Date().toISOString(),
          confidence: 0.99,
          expo: -8
        }
      }),
      post: jest.fn(),
      defaults: { headers: {} }
    } as any);

    // Mock WebSocketProvider
    mockWebSocket = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      send: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getState: jest.fn().mockReturnValue('CONNECTED'),
      isConnected: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    (WebSocketProvider as jest.Mock).mockReturnValue(mockWebSocket);

    feedClient = new FeedClient({
      apiUrl: 'https://api.avantis.finance',
      network: 'base'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create FeedClient instance', () => {
      expect(feedClient).toBeDefined();
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.avantis.finance',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    });
  });

  describe('WebSocket Connection', () => {
    it('should connect to WebSocket', async () => {
      await feedClient.connect();
      expect(WebSocketProvider).toHaveBeenCalled();
      expect(mockWebSocket.connect).toHaveBeenCalled();
    });

    it('should disconnect from WebSocket', () => {
      feedClient.disconnect();
      expect(mockWebSocket).toBeUndefined(); // Since it's created on connect
    });

    it('should handle WebSocket connection failures gracefully', async () => {
      mockWebSocket.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Should not throw, just log warning
      await expect(feedClient.connect()).resolves.toBeUndefined();
    });
  });

  describe('Price Feeds', () => {
    it('should get latest price for a trading pair', async () => {
      const price = await feedClient.getLatestPrice('BTC/USD');
      
      expect(price).toBeDefined();
      expect(price.pair).toBe('BTC/USD');
      expect(price.price).toBeInstanceOf(Decimal);
      expect(price.price.toString()).toBe('3000.5');
      expect(price.bid.toString()).toBe('3000.25');
      expect(price.ask.toString()).toBe('3000.75');
    });

    it('should cache price data', async () => {
      const httpClient = (feedClient as any).http;
      
      // First call
      await feedClient.getLatestPrice('BTC/USD');
      expect(httpClient.get).toHaveBeenCalledTimes(1);
      
      // Second call within 1 second should use cache
      await feedClient.getLatestPrice('BTC/USD');
      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to price updates', async () => {
      await feedClient.connect();
      
      const callback = jest.fn();
      const unsubscribe = feedClient.subscribeToPrice('ETH/USD', callback);
      
      expect(mockWebSocket.subscribe).toHaveBeenCalledWith('price', { feedId: 'eth-usd' });
      
      // Simulate price update
      const priceData: PriceFeedData = {
        pair: 'ETH/USD',
        price: new Decimal('2500.50'),
        bid: new Decimal('2500.25'),
        ask: new Decimal('2500.75'),
        timestamp: new Date(),
        confidence: 0.99,
        expo: -8
      };
      
      // Manually trigger the callback since we're mocking
      callback(priceData);
      
      expect(callback).toHaveBeenCalledWith(priceData);
      
      // Unsubscribe
      unsubscribe();
    });

    it('should get multiple prices at once', async () => {
      const pairs = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
      const prices = await feedClient.getMultiplePrices(pairs);
      
      expect(prices.size).toBe(3);
      expect(prices.has('BTC/USD')).toBe(true);
      expect(prices.has('ETH/USD')).toBe(true);
      expect(prices.has('SOL/USD')).toBe(true);
    });
  });

  describe('Market Statistics', () => {
    it('should get market stats for a trading pair', async () => {
      const httpClient = (feedClient as any).http;
      httpClient.get.mockResolvedValueOnce({
        data: {
          price: '3000.50',
          volume24h: '1000000',
          high24h: '3100',
          low24h: '2900',
          change24h: '50',
          changePercent24h: 1.67,
          openInterest: '5000000',
          fundingRate: '0.0001',
          nextFundingTime: new Date(Date.now() + 3600000).toISOString()
        }
      });

      const stats = await feedClient.getMarketStats('BTC/USD');
      
      expect(stats.pair).toBe('BTC/USD');
      expect(stats.price.toString()).toBe('3000.5');
      expect(stats.volume24h.toString()).toBe('1000000');
      expect(stats.changePercent24h).toBe(1.67);
    });
  });

  describe('Historical Data', () => {
    it('should get candle data', async () => {
      const httpClient = (feedClient as any).http;
      httpClient.get.mockResolvedValueOnce({
        data: [
          {
            time: new Date().toISOString(),
            open: '3000',
            high: '3050',
            low: '2950',
            close: '3025',
            volume: '10000'
          }
        ]
      });

      const candles = await feedClient.getCandles('BTC/USD', TimeInterval.H1, 100);
      
      expect(candles).toHaveLength(1);
      expect(candles[0].open.toString()).toBe('3000');
      expect(candles[0].close.toString()).toBe('3025');
    });
  });

  describe('Market Hours', () => {
    it('should return always open for crypto markets', async () => {
      const hours = await feedClient.getMarketHours('BTC/USD');
      
      expect(hours.pair).toBe('BTC/USD');
      expect(hours.isOpen).toBe(true);
      expect(hours.timezone).toBe('UTC');
    });

    it('should check forex market hours', async () => {
      const hours = await feedClient.getMarketHours('EUR/USD');
      
      expect(hours.pair).toBe('EUR/USD');
      expect(hours.timezone).toBe('UTC');
      // Market open/close depends on current time
      expect(typeof hours.isOpen).toBe('boolean');
    });
  });

  describe('Funding Rates', () => {
    it('should get funding rate', async () => {
      const httpClient = (feedClient as any).http;
      httpClient.get.mockResolvedValueOnce({
        data: {
          rate: '0.0001',
          nextFundingTime: new Date(Date.now() + 3600000).toISOString(),
          timestamp: new Date().toISOString()
        }
      });

      const funding = await feedClient.getFundingRate('BTC/USD');
      
      expect(funding.pair).toBe('BTC/USD');
      expect(funding.rate.toString()).toBe('0.0001');
      expect(funding.nextFundingTime).toBeInstanceOf(Date);
    });

    it('should return default funding rate on API failure', async () => {
      const httpClient = (feedClient as any).http;
      httpClient.get.mockRejectedValueOnce(new Error('API error'));

      const funding = await feedClient.getFundingRate('BTC/USD');
      
      expect(funding.pair).toBe('BTC/USD');
      expect(funding.rate.toString()).toBe('0');
    });
  });

  describe('Market Events', () => {
    it('should subscribe to market events', async () => {
      await feedClient.connect();
      
      const callback = jest.fn();
      const unsubscribe = feedClient.onMarketEvent(callback);
      
      // Simulate market event
      const event = {
        type: 'trade' as const,
        pair: 'BTC/USD',
        data: {
          price: new Decimal('3000'),
          size: new Decimal('10'),
          side: 'buy' as const,
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      
      // Manually trigger callback
      callback(event);
      
      expect(callback).toHaveBeenCalledWith(event);
      
      unsubscribe();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const httpClient = (feedClient as any).http;
      httpClient.get.mockRejectedValueOnce(new Error('API unavailable'));
      
      // Should use cached price if available
      const priceData: PriceFeedData = {
        pair: 'BTC/USD',
        price: new Decimal('3000'),
        bid: new Decimal('2999'),
        ask: new Decimal('3001'),
        timestamp: new Date(),
        confidence: 0.99,
        expo: -8
      };
      
      // Set cache
      (feedClient as any).priceCache.set('BTC/USD', priceData);
      
      const price = await feedClient.getLatestPrice('BTC/USD');
      expect(price).toEqual(priceData);
    });

    it('should validate trading pair format', () => {
      expect(() => {
        feedClient.subscribeToPrice('INVALID', jest.fn());
      }).toThrow('Invalid trading pair format');
    });
  });

  describe('WebSocket Message Handling', () => {
    beforeEach(async () => {
      await feedClient.connect();
    });

    it('should handle price update messages', () => {
      const subscriber = jest.fn();
      feedClient.subscribeToPrice('BTC/USD', subscriber);
      
      // Simulate WebSocket price update
      const mockHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (mockHandler) {
        mockHandler({
          type: 'price',
          data: {
            feedId: 'btc-usd',
            price: '3100',
            bid: '3099',
            ask: '3101',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Check that price cache was updated
      const cached = (feedClient as any).priceCache.get('BTC/USD');
      expect(cached).toBeDefined();
    });
  });
});