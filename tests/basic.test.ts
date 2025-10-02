import { TraderClient, FeedClient, BlockchainProvider } from '../src';
import { NETWORKS, TRADING_PAIRS } from '../src/constants/networks';
import { ValidationError } from '../src/utils/errors';
import { validateAddress, validateTradingPair } from '../src/utils/validation';

describe('Avantis SDK', () => {
  describe('TraderClient', () => {
    it('should create a TraderClient instance', () => {
      const client = new TraderClient('base');
      expect(client).toBeDefined();
      expect(client.getNetwork().chainId).toBe(8453);
    });

    it('should get correct network configuration', () => {
      const client = new TraderClient('base');
      const network = client.getNetwork();
      expect(network.name).toBe('Base');
      expect(network.chainId).toBe(8453);
    });
  });

  describe('FeedClient', () => {
    it('should create a FeedClient instance', () => {
      const client = new FeedClient();
      expect(client).toBeDefined();
    });
  });

  describe('BlockchainProvider', () => {
    it('should create a BlockchainProvider instance', () => {
      const provider = new BlockchainProvider('base');
      expect(provider).toBeDefined();
    });

    it('should get network configuration', () => {
      const provider = new BlockchainProvider('base');
      const network = provider.getNetwork();
      expect(network.chainId).toBe(8453);
    });
  });

  describe('Validation', () => {
    it('should validate correct Ethereum address', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8'.toLowerCase();
      expect(() => validateAddress(validAddress)).not.toThrow();
    });

    it('should reject invalid Ethereum address', () => {
      const invalidAddress = 'invalid-address';
      expect(() => validateAddress(invalidAddress)).toThrow(ValidationError);
    });

    it('should validate correct trading pair format', () => {
      expect(() => validateTradingPair('BTC/USD')).not.toThrow();
      expect(() => validateTradingPair('ETH/USD')).not.toThrow();
    });

    it('should reject invalid trading pair format', () => {
      expect(() => validateTradingPair('BTCUSD')).toThrow(ValidationError);
      expect(() => validateTradingPair('btc/usd')).toThrow(ValidationError);
    });
  });

  describe('Constants', () => {
    it('should have correct network configurations', () => {
      expect(NETWORKS.base).toBeDefined();
      expect(NETWORKS.base.chainId).toBe(8453);
      expect(NETWORKS['base-sepolia']).toBeDefined();
      expect(NETWORKS['base-sepolia'].chainId).toBe(84531);
    });

    it('should have trading pairs configured', () => {
      expect(TRADING_PAIRS['BTC/USD']).toBeDefined();
      expect(TRADING_PAIRS['BTC/USD'].category).toBe('crypto');
      expect(TRADING_PAIRS['EUR/USD']).toBeDefined();
      expect(TRADING_PAIRS['EUR/USD'].category).toBe('forex');
      expect(TRADING_PAIRS['XAU/USD']).toBeDefined();
      expect(TRADING_PAIRS['XAU/USD'].category).toBe('commodity');
    });
  });
});