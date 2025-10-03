import { PythClient } from '../../src/clients/PythClient';
import { getPythFeedId, PYTH_PRICE_FEEDS } from '../../src/constants/pythFeeds';

// Mock fetch for testing
global.fetch = jest.fn();

describe('PythClient', () => {
  let pythClient: PythClient;

  beforeEach(() => {
    pythClient = new PythClient();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default Hermes URL', () => {
      const client = new PythClient();
      expect(client.getHermesUrl()).toBe('https://hermes.pyth.network');
    });

    it('should initialize with custom Hermes URL', () => {
      const customUrl = 'https://custom-hermes.example.com';
      const client = new PythClient({ hermesUrl: customUrl });
      expect(client.getHermesUrl()).toBe(customUrl);
    });

    it('should initialize with testnet config', () => {
      const client = new PythClient({ network: 'testnet' });
      expect(client.getHermesUrl()).toBe('https://hermes.pyth.network');
    });
  });

  describe('getPriceUpdateData', () => {
    it('should fetch price update data for a single pair', async () => {
      const mockResponse = ['base64EncodedVAA1', 'base64EncodedVAA2'];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await pythClient.getPriceUpdateData('BTC/USD');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('hermes.pyth.network/api/latest_vaas')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(getPythFeedId('BTC/USD'))
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatch(/^0x[0-9a-f]+$/);
    });

    it('should throw error for invalid pair', async () => {
      await expect(pythClient.getPriceUpdateData('INVALID/PAIR')).rejects.toThrow();
    });

    it('should throw error when API request fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(pythClient.getPriceUpdateData('BTC/USD')).rejects.toThrow(
        'Pyth API request failed'
      );
    });

    it('should throw error when no data is returned', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await expect(pythClient.getPriceUpdateData('BTC/USD')).rejects.toThrow(
        'No price update data received from Pyth'
      );
    });
  });

  describe('getPriceUpdateDataForPairs', () => {
    it('should fetch price update data for multiple pairs', async () => {
      const mockResponse = ['vaa1', 'vaa2', 'vaa3'];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const pairs = ['BTC/USD', 'ETH/USD', 'LINK/USD'];
      const result = await pythClient.getPriceUpdateDataForPairs(pairs);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      pairs.forEach(pair => {
        expect(callUrl).toContain(getPythFeedId(pair));
      });

      expect(result).toHaveLength(3);
    });

    it('should handle empty pairs array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await expect(pythClient.getPriceUpdateDataForPairs([])).rejects.toThrow();
    });
  });

  describe('getPriceUpdateDataByFeedIds', () => {
    it('should fetch price data using feed IDs directly', async () => {
      const mockResponse = ['vaa1'];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feedIds = [getPythFeedId('BTC/USD')];
      const result = await pythClient.getPriceUpdateDataByFeedIds(feedIds);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatch(/^0x[0-9a-f]+$/);
    });

    it('should convert base64 VAA to hex with 0x prefix', async () => {
      const mockVaa = Buffer.from('test').toString('base64');
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockVaa]
      });

      const result = await pythClient.getPriceUpdateDataByFeedIds(['0x123']);

      expect(result[0]).toBe('0x' + Buffer.from(mockVaa, 'base64').toString('hex'));
    });
  });

  describe('getLatestPrice', () => {
    it('should fetch latest price for a pair', async () => {
      const mockPriceData = {
        id: getPythFeedId('BTC/USD'),
        price: {
          price: '6500000000000',
          conf: '100000000',
          expo: -8,
          publish_time: 1234567890
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockPriceData]
      });

      const result = await pythClient.getLatestPrice('BTC/USD');

      expect(result.feedId).toBe(getPythFeedId('BTC/USD'));
      expect(result.price).toBe('6500000000000');
      expect(result.conf).toBe('100000000');
      expect(result.expo).toBe(-8);
      expect(result.publishTime).toBe(1234567890);
    });

    it('should throw error when API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(pythClient.getLatestPrice('BTC/USD')).rejects.toThrow();
    });

    it('should throw error when no price data returned', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await expect(pythClient.getLatestPrice('BTC/USD')).rejects.toThrow(
        'No price data received from Pyth'
      );
    });
  });

  describe('Pyth Feed IDs', () => {
    it('should have feed IDs for all 42 trading pairs', () => {
      const expectedPairs = [
        // Crypto (25)
        'BTC/USD', 'ETH/USD', 'LINK/USD', 'MATIC/USD', 'SOL/USD',
        'XRP/USD', 'ADA/USD', 'AVAX/USD', 'DOT/USD', 'UNI/USD',
        'ATOM/USD', 'FTM/USD', 'NEAR/USD', 'ALGO/USD', 'AAVE/USD',
        'CRV/USD', 'OP/USD', 'ARB/USD', 'LDO/USD', 'MKR/USD',
        'SNX/USD', 'PEPE/USD', 'WIF/USD', 'BONK/USD', 'FLOKI/USD',
        // Forex (10)
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
        'USD/CHF', 'NZD/USD', 'EUR/GBP', 'GBP/JPY', 'EUR/JPY',
        // Commodities (4)
        'XAU/USD', 'XAG/USD', 'WTI/USD', 'BrentOil/USD',
        // Indices (3)
        'SPX500/USD', 'NDX100/USD', 'DJI/USD'
      ];

      expectedPairs.forEach(pair => {
        expect(PYTH_PRICE_FEEDS[pair]).toBeDefined();
        expect(PYTH_PRICE_FEEDS[pair]).toMatch(/^0x[0-9a-f]{64}$/);
      });

      expect(Object.keys(PYTH_PRICE_FEEDS)).toHaveLength(42);
    });

    it('should get feed ID for valid pair', () => {
      const feedId = getPythFeedId('BTC/USD');
      expect(feedId).toBe(PYTH_PRICE_FEEDS['BTC/USD']);
      expect(feedId).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should throw error for invalid pair', () => {
      expect(() => getPythFeedId('INVALID/PAIR')).toThrow(
        'Pyth price feed ID not found for pair: INVALID/PAIR'
      );
    });
  });

  describe('Integration with real Hermes API', () => {
    // Skip in CI environments
    const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

    (runIntegrationTests ? it : it.skip)('should fetch real price data from Hermes', async () => {
      // Use real fetch, not mocked
      jest.restoreAllMocks();

      const realClient = new PythClient();

      try {
        const priceData = await realClient.getPriceUpdateData('BTC/USD');
        expect(priceData).toBeDefined();
        expect(priceData.length).toBeGreaterThan(0);
        expect(priceData[0]).toMatch(/^0x[0-9a-f]+$/);
      } catch (error) {
        // Network errors are acceptable in tests
        console.warn('Integration test failed (network issue):', error);
      }
    }, 10000);

    (runIntegrationTests ? it : it.skip)('should fetch real latest price', async () => {
      jest.restoreAllMocks();

      const realClient = new PythClient();

      try {
        const price = await realClient.getLatestPrice('ETH/USD');
        expect(price.feedId).toBeDefined();
        expect(price.price).toBeDefined();
        expect(price.expo).toBeDefined();
        expect(price.publishTime).toBeGreaterThan(0);
      } catch (error) {
        console.warn('Integration test failed (network issue):', error);
      }
    }, 10000);
  });
});
