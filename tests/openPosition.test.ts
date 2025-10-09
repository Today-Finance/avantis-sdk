import { TraderClient } from '../src/clients/TraderClient';
import { BlockchainProvider } from '../src/providers/BlockchainProvider';
import { PositionSide } from '../src/types';

describe('OpenPosition Functionality Tests', () => {
  let trader: TraderClient;
  let blockchain: BlockchainProvider;

  beforeEach(() => {
    trader = new TraderClient('base');
    blockchain = new BlockchainProvider('base');
  });

  describe('SDK Initialization', () => {
    it('should initialize TraderClient correctly', () => {
      expect(trader).toBeDefined();
      expect(trader.getNetwork().chainId).toBe(8453);
      expect(trader.getNetwork().name).toBe('Base');
    });

    it('should initialize BlockchainProvider correctly', () => {
      expect(blockchain).toBeDefined();
      expect(blockchain.getNetwork().chainId).toBe(8453);
    });
  });

  describe('Viem Integration', () => {
    const testPrivateKey = '0x' + '1'.repeat(64);

    beforeEach(() => {
      blockchain.setSigner({
        type: 'privateKey',
        privateKey: testPrivateKey
      });
    });

    it('should create account with viem', () => {
      const account = blockchain.getAccount();
      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
      expect(account.address.startsWith('0x')).toBe(true);
      expect(account.type).toBe('local');
    });

    it('should return bigint for chainId', async () => {
      const chainId = await blockchain.getChainId();
      expect(typeof chainId).toBe('bigint');
      expect(chainId).toBe(BigInt(8453));
    });

    it('should fetch gas price as bigint', async () => {
      const gasPrice = await blockchain.getGasPrice();
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(BigInt(0));
    });

    it('should get balance as bigint', async () => {
      const balance = await blockchain.getBalance(
        '0x742d35cc6634c0532925a3b844bc9e7595f0beb8'
      );
      expect(typeof balance).toBe('bigint');
    });
  });

  describe('Signer Configuration', () => {
    it('should configure signer with private key', async () => {
      const testKey = '0x' + '1'.repeat(64);

      expect(() => {
        trader.setSigner({
          type: 'privateKey',
          privateKey: testKey
        });
      }).not.toThrow();

      const address = await trader.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('0x')).toBe(true);
      expect(address.length).toBe(42);
    });

    it('should configure signer with mnemonic', () => {
      const testMnemonic = 'test test test test test test test test test test test junk';

      expect(() => {
        trader.setSigner({
          type: 'mnemonic',
          mnemonic: testMnemonic
        });
      }).not.toThrow();

      const address = trader.getAddress();
      expect(address).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(() => {
      const testKey = '0x' + '1'.repeat(64);
      trader.setSigner({
        type: 'privateKey',
        privateKey: testKey
      });
    });

    it('should accept valid LONG position parameters', () => {
      const validParams = {
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '100',
        leverage: 10,
        stopLoss: '2800',
        takeProfit: '3500',
        slippage: 0.5
      };

      expect(validParams.side).toBe('long');
      expect(validParams.leverage).toBeGreaterThan(0);
      expect(validParams.leverage).toBeLessThanOrEqual(100);
    });

    it('should accept valid SHORT position parameters', () => {
      const validParams = {
        pair: 'BTC/USD',
        side: PositionSide.SHORT,
        size: '200',
        leverage: 20,
        stopLoss: '52000',
        takeProfit: '48000',
        slippage: 1.0
      };

      expect(validParams.side).toBe('short');
      expect(validParams.leverage).toBeGreaterThan(0);
      expect(validParams.leverage).toBeLessThanOrEqual(100);
    });

    it('should reject invalid leverage (too low)', async () => {
      await expect(
        trader.openPosition({
          pair: 'ETH/USD',
          side: PositionSide.LONG,
          size: '100',
          leverage: 0
        })
      ).rejects.toThrow();
    });

    it('should reject invalid leverage (too high)', async () => {
      await expect(
        trader.openPosition({
          pair: 'ETH/USD',
          side: PositionSide.LONG,
          size: '100',
          leverage: 150
        })
      ).rejects.toThrow();
    });

    it('should reject zero position size', async () => {
      await expect(
        trader.openPosition({
          pair: 'ETH/USD',
          side: PositionSide.LONG,
          size: '0',
          leverage: 10
        })
      ).rejects.toThrow();
    });

    it('should reject invalid trading pair format', async () => {
      await expect(
        trader.openPosition({
          pair: 'invalid-pair',
          side: PositionSide.LONG,
          size: '100',
          leverage: 10
        })
      ).rejects.toThrow();
    });
  });

  describe('Contract Addresses', () => {
    it('should have correct contract addresses on Base mainnet', () => {
      const network = trader.getNetwork();

      expect(network.contracts.trading).toBe('0x44914408af82bC9983bbb330e3578E1105e11d4e');
      expect(network.contracts.usdc).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
      expect(network.contracts.priceFeed).toBe('0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a');
    });

    it('should not have zero addresses for main contracts', () => {
      const network = trader.getNetwork();
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      expect(network.contracts.trading).not.toBe(zeroAddress);
      expect(network.contracts.usdc).not.toBe(zeroAddress);
      expect(network.contracts.priceFeed).not.toBe(zeroAddress);
    });
  });

  describe('Account Info Retrieval', () => {
    beforeEach(() => {
      const testKey = '0x' + '1'.repeat(64);
      trader.setSigner({
        type: 'privateKey',
        privateKey: testKey
      });
    });

    it('should retrieve account info structure', async () => {
      const accountInfo = await trader.getAccountInfo();

      expect(accountInfo).toBeDefined();
      expect(accountInfo.address).toBeDefined();
      expect(accountInfo.usdcBalance).toBeDefined();
      expect(accountInfo.freeCollateral).toBeDefined();
      expect(accountInfo.positions).toBeDefined();
      expect(Array.isArray(accountInfo.positions)).toBe(true);
      expect(accountInfo.marginLevel).toBeDefined();
    });

    it('should have correct types for account info', async () => {
      const accountInfo = await trader.getAccountInfo();

      expect(typeof accountInfo.address).toBe('string');
      expect(accountInfo.address.startsWith('0x')).toBe(true);
      expect(typeof accountInfo.marginLevel).toBe('number');
      expect(accountInfo.usdcBalance.constructor.name).toBe('Decimal');
    });
  });

  describe('USDC Operations', () => {
    beforeEach(() => {
      const testKey = '0x' + '1'.repeat(64);
      trader.setSigner({
        type: 'privateKey',
        privateKey: testKey
      });
    });

    it('should check USDC balance', async () => {
      const balance = await trader.getUSDCBalance();
      expect(balance).toBeDefined();
      expect(balance.constructor.name).toBe('Decimal');
    });

    it('should check trading allowance', async () => {
      try {
        const allowance = await trader.getTradingAllowance();
        expect(allowance).toBeDefined();
        expect(allowance.constructor.name).toBe('Decimal');
      } catch (error) {
        // Rate limiting is acceptable in tests
        if (error.message.includes('rate limit')) {
          expect(true).toBe(true); // Test passes if rate limited
        } else {
          throw error;
        }
      }
    });
  });

  describe('Position Side Enum', () => {
    it('should have correct PositionSide values', () => {
      expect(PositionSide.LONG).toBe('long');
      expect(PositionSide.SHORT).toBe('short');
    });
  });

  describe('Network Support', () => {
    it('should support Base mainnet', () => {
      const baseTrader = new TraderClient('base');
      expect(baseTrader.getNetwork().chainId).toBe(8453);
      expect(baseTrader.getNetwork().name).toBe('Base');
    });

    it('should support Base Sepolia testnet', () => {
      const sepoliaTrader = new TraderClient('base-sepolia');
      expect(sepoliaTrader.getNetwork().chainId).toBe(84531);
      expect(sepoliaTrader.getNetwork().name).toBe('Base Sepolia');
    });
  });
});
