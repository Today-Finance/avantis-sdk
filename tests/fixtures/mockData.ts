import Decimal from 'decimal.js';
import { Position, PositionSide, PositionStatus, PriceFeedData, MarketStats, AccountInfo } from '../../src/types';

export const mockPosition: Position = {
  id: '1',
  owner: '0x1234567890123456789012345678901234567890',
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: new Decimal('1000'),
  collateral: new Decimal('100'),
  leverage: 10,
  entryPrice: new Decimal('3000'),
  markPrice: new Decimal('3050'),
  liquidationPrice: new Decimal('2700'),
  unrealizedPnl: new Decimal('50'),
  realizedPnl: new Decimal('0'),
  stopLoss: new Decimal('2850'),
  takeProfit: new Decimal('3300'),
  margin: new Decimal('100'),
  maintenanceMargin: new Decimal('50'),
  status: PositionStatus.OPEN,
  openedAt: new Date('2024-01-01T00:00:00Z'),
  lastUpdated: new Date('2024-01-01T01:00:00Z')
};

export const mockPriceFeed: PriceFeedData = {
  pair: 'BTC/USD',
  price: new Decimal('50000'),
  bid: new Decimal('49990'),
  ask: new Decimal('50010'),
  timestamp: new Date('2024-01-01T00:00:00Z'),
  confidence: 0.99,
  expo: -8
};

export const mockMarketStats: MarketStats = {
  pair: 'BTC/USD',
  price: new Decimal('50000'),
  volume24h: new Decimal('10000000'),
  high24h: new Decimal('51000'),
  low24h: new Decimal('49000'),
  change24h: new Decimal('500'),
  changePercent24h: 1.01,
  openInterest: new Decimal('50000000'),
  fundingRate: new Decimal('0.0001'),
  nextFundingTime: new Date('2024-01-01T08:00:00Z')
};

export const mockAccountInfo: AccountInfo = {
  address: '0x1234567890123456789012345678901234567890',
  balance: new Decimal('1'),
  usdcBalance: new Decimal('10000'),
  tradingAllowance: new Decimal('10000'),
  totalCollateral: new Decimal('1000'),
  freeCollateral: new Decimal('900'),
  marginUsed: new Decimal('100'),
  unrealizedPnl: new Decimal('50'),
  realizedPnl: new Decimal('100'),
  positions: [mockPosition],
  marginLevel: 1000
};

export const mockTransactionResponse = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  blockNumber: 1000,
  blockHash: '0xblockhash',
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  value: BigInt('0'),
  gasUsed: BigInt('100000'),
  gasPrice: BigInt('1000000000'),
  status: 1,
  logs: []
};

export const mockTradeParams = {
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: new Decimal('1000'),
  leverage: 10,
  stopLoss: new Decimal('2850'),
  takeProfit: new Decimal('3300'),
  slippage: 0.5
};

export const mockNetworkConfig = {
  chainId: 8453 as const,
  name: 'Base',
  rpcUrl: 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  contracts: {
    trading: '0x0000000000000000000000000000000000000000',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    priceFeed: '0x0000000000000000000000000000000000000000',
    vault: '0x0000000000000000000000000000000000000000',
    router: '0x0000000000000000000000000000000000000000',
    avnt: '0x696F9436B67233384889472Cd7cD58A6fB5DF4f1'
  },
  websocketUrl: 'wss://base-mainnet.g.alchemy.com/v2/test'
};

export function createMockPosition(overrides?: Partial<Position>): Position {
  return {
    ...mockPosition,
    ...overrides
  };
}

export function createMockPriceFeed(pair: string, price: number): PriceFeedData {
  const priceDecimal = new Decimal(price);
  return {
    pair,
    price: priceDecimal,
    bid: priceDecimal.minus(10),
    ask: priceDecimal.plus(10),
    timestamp: new Date(),
    confidence: 0.99,
    expo: -8
  };
}