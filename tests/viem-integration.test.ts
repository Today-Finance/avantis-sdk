import { BlockchainProvider } from '../src/providers/BlockchainProvider';
import { TraderClient } from '../src/clients/TraderClient';

describe('Viem Integration Tests', () => {
  describe('BlockchainProvider with Viem', () => {
    let provider: BlockchainProvider;

    beforeEach(() => {
      provider = new BlockchainProvider('base');
    });

    it('should create provider with viem', () => {
      expect(provider).toBeDefined();
      const publicClient = provider.getProvider();
      expect(publicClient).toBeDefined();
    });

    it('should get network configuration', () => {
      const network = provider.getNetwork();
      expect(network.chainId).toBe(8453);
      expect(network.name).toBe('Base');
    });

    it('should return chain ID as bigint', async () => {
      const chainId = await provider.getChainId();
      expect(chainId).toBe(BigInt(8453));
    });

    it('should check connection status', async () => {
      const isConnected = await provider.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should create wallet with private key', () => {
      const testPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      expect(() => {
        provider.setSigner({
          type: 'privateKey',
          privateKey: testPrivateKey
        });
      }).not.toThrow();

      const account = provider.getAccount();
      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
    });

    it('should get balance for an address', async () => {
      const balance = await provider.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8'.toLowerCase());
      expect(typeof balance).toBe('bigint');
    });

    it('should get gas price', async () => {
      const gasPrice = await provider.getGasPrice();
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(BigInt(0));
    });
  });

  describe('TraderClient with Viem', () => {
    let client: TraderClient;

    beforeEach(() => {
      client = new TraderClient('base');
    });

    it('should initialize with viem provider', () => {
      expect(client).toBeDefined();
      const network = client.getNetwork();
      expect(network.chainId).toBe(8453);
    });

    it('should have USDC contract initialized with viem', () => {
      // The client should have the USDC contract ready
      expect(client).toBeDefined();
      const network = client.getNetwork();
      expect(network.contracts.usdc).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    });

    it('should set signer and get address', async () => {
      const testPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      client.setSigner({
        type: 'privateKey',
        privateKey: testPrivateKey
      });

      const address = await client.getAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('0x')).toBe(true);
      expect(address.length).toBe(42);
    });
  });

  describe('Viem Type Compatibility', () => {
    it('should handle bigint values correctly', () => {
      const value = BigInt('1000000000000000000'); // 1 ETH in wei
      expect(typeof value).toBe('bigint');
      expect(value).toBe(BigInt(10) ** BigInt(18));
    });

    it('should work with viem address format', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8' as `0x${string}`;
      expect(address.startsWith('0x')).toBe(true);
      expect(address.length).toBe(42);
    });
  });
});
