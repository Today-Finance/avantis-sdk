import { TraderClient } from '../../src/clients/TraderClient';
import Decimal from 'decimal.js';
import { PositionSide, ErrorCode } from '../../src/types';
import { TradingError } from '../../src/utils/errors';

describe('TraderClient Integration Tests', () => {
  let client: TraderClient;
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>;
  let mockContract: jest.Mocked<ethers.Contract>;
  let mockSigner: jest.Mocked<ethers.Wallet>;

  beforeEach(() => {
    // Setup mock provider
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 8453n }),
      getBlockNumber: jest.fn().mockResolvedValue(1000),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000'),
        maxFeePerGas: BigInt('2000000000'),
        maxPriorityFeePerGas: BigInt('1000000000')
      }),
      waitForTransaction: jest.fn().mockResolvedValue({
        status: 1,
        blockNumber: 1001,
        blockHash: '0xhash',
        from: '0xfrom',
        to: '0xto',
        gasUsed: BigInt('21000'),
        gasPrice: BigInt('1000000000'),
        logs: []
      })
    } as any;

    // Setup mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890' as string),
      connect: jest.fn().mockReturnThis(),
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0xtxhash',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 1001,
          gasUsed: BigInt('21000'),
          gasPrice: BigInt('1000000000')
        })
      })
    } as any;

    // Setup mock contract
    mockContract = {
      connect: jest.fn().mockReturnThis(),
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000')), // 1000 USDC
      allowance: jest.fn().mockResolvedValue(BigInt('100000000')), // 100 USDC
      approve: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          hash: '0xapprove',
          gasUsed: BigInt('50000'),
          gasPrice: BigInt('1000000000')
        })
      }),
      openPosition: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          hash: '0xopen',
          logs: [{
            topics: [ethers.id('PositionOpened(uint256,address,address,bool,uint256,uint256)'), '0x0000000000000000000000000000000000000000000000000000000000000001']
          }],
          gasUsed: BigInt('150000'),
          gasPrice: BigInt('1000000000')
        })
      }),
      closePosition: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          hash: '0xclose',
          gasUsed: BigInt('100000'),
          gasPrice: BigInt('1000000000')
        })
      }),
      getPosition: jest.fn().mockResolvedValue({
        id: BigInt(1),
        owner: '0x1234567890123456789012345678901234567890',
        pair: '0xpair',
        isLong: true,
        size: BigInt('100000000'), // 100 USDC
        collateral: BigInt('10000000'), // 10 USDC
        leverage: BigInt(10),
        entryPrice: BigInt('3000000000'), // $3000
        stopLoss: BigInt('2850000000'), // $2850
        takeProfit: BigInt('3300000000'), // $3300
        openTime: BigInt(Math.floor(Date.now() / 1000)),
        status: 1
      }),
      getPositions: jest.fn().mockResolvedValue([BigInt(1)])
    } as any;

    // Mock ethers constructors
    (ethers.JsonRpcProvider as jest.Mock).mockReturnValue(mockProvider);
    (ethers.Wallet as any).mockReturnValue(mockSigner);
    (ethers.Contract as jest.Mock).mockReturnValue(mockContract);

    client = new TraderClient('base');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct network', () => {
      const network = client.getNetwork();
      expect(network.chainId).toBe(8453);
      expect(network.name).toBe('Base');
    });

    it('should create USDC contract on initialization', () => {
      expect(ethers.Contract).toHaveBeenCalledWith(
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('Signer Management', () => {
    it('should set signer with private key', async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });

      expect(ethers.Wallet).toHaveBeenCalled();
      expect(mockContract.connect).toHaveBeenCalledWith(mockSigner);
    });

    it('should get account address', async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });

      const address = await client.getAddress();
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
    });

    it('should get USDC balance', async () => {
      const balance = await client.getUSDCBalance();
      expect(balance.toString()).toBe('1000');
      expect(mockContract.balanceOf).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should get trading allowance', async () => {
      const allowance = await client.getTradingAllowance();
      expect(allowance.toString()).toBe('100');
    });

    it('should approve USDC for trading', async () => {
      const result = await client.approveUSDCForTrading('10000');
      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('0xapprove');
      expect(mockContract.approve).toHaveBeenCalled();
    });
  });

  describe('Trading Operations', () => {
    beforeEach(async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
    });

    it('should open a long position', async () => {
      const result = await client.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '100',
        leverage: 10,
        stopLoss: '2850',
        takeProfit: '3300',
        slippage: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('0xopen');
      expect(mockContract.openPosition).toHaveBeenCalled();
    });

    it('should validate position size', async () => {
      await expect(client.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '0',
        leverage: 10
      })).rejects.toThrow('Position size must be greater than 0');
    });

    it('should validate leverage', async () => {
      await expect(client.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '100',
        leverage: 150
      })).rejects.toThrow();
    });

    it('should check sufficient balance before opening position', async () => {
      mockContract.balanceOf.mockResolvedValueOnce(BigInt('5000000')); // 5 USDC

      await expect(client.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '100',
        leverage: 10
      })).rejects.toThrow(TradingError);
    });

    it('should close a position', async () => {
      const result = await client.closePosition({
        positionId: '0-123', // Format: "pairIndex-positionIndex"
        slippage: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('0xclose');
      expect(mockContract.closePosition).toHaveBeenCalled();
    });

    it('should get position details', async () => {
      const position = await client.getPosition('1');
      expect(position).toBeDefined();
      expect(position?.size.toString()).toBe('100');
      expect(position?.leverage).toBe(10);
    });

    it('should get all positions for account', async () => {
      const positions = await client.getPositions();
      expect(positions).toHaveLength(1);
      expect(mockContract.getPositions).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });
  });

  describe('Account Info', () => {
    beforeEach(async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
    });

    it('should get comprehensive account info', async () => {
      const info = await client.getAccountInfo();
      
      expect(info.address).toBe('0x1234567890123456789012345678901234567890');
      expect(info.usdcBalance.toString()).toBe('1000');
      expect(info.positions).toHaveLength(1);
      expect(info.marginLevel).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.setSigner({
        type: 'privateKey',
        privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
    });

    it('should handle transaction failures', async () => {
      mockContract.openPosition.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(client.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '100',
        leverage: 10
      })).rejects.toThrow();
    });

    it('should handle invalid trading pairs', async () => {
      await expect(client.openPosition({
        pair: 'INVALID/PAIR',
        side: PositionSide.LONG,
        size: '100',
        leverage: 10
      })).rejects.toThrow('Trading pair not supported');
    });

    it('should handle network errors', async () => {
      mockProvider.getBalance.mockRejectedValueOnce(new Error('Network error'));

      const infoPromise = client.getAccountInfo();
      await expect(infoPromise).rejects.toThrow();
    });
  });
});