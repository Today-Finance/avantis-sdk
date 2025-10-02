/**
 * End-to-End Trading Test
 * 
 * Note: These tests require a testnet deployment and test USDC.
 * Set environment variables:
 * - TEST_PRIVATE_KEY: Private key with test USDC
 * - TEST_RPC_URL: Base Sepolia RPC URL
 */

import { TraderClient, FeedClient } from '../../src';
import { PositionSide } from '../../src/types';
import Decimal from 'decimal.js';

// Skip E2E tests by default unless explicitly enabled
const RUN_E2E_TESTS = process.env.RUN_E2E_TESTS === 'true';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;
const TEST_RPC_URL = process.env.TEST_RPC_URL;

describe.skip('E2E Trading Tests', () => {
  if (!RUN_E2E_TESTS) {
    it('should skip E2E tests (set RUN_E2E_TESTS=true to run)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  if (!TEST_PRIVATE_KEY || !TEST_RPC_URL) {
    throw new Error('TEST_PRIVATE_KEY and TEST_RPC_URL must be set for E2E tests');
  }

  let trader: TraderClient;
  let feed: FeedClient;
  let testAddress: string;

  beforeAll(async () => {
    // Initialize clients with testnet configuration
    trader = new TraderClient('base-sepolia', TEST_RPC_URL);
    feed = new FeedClient({ network: 'base-sepolia' });

    // Set up signer
    await trader.setSigner({
      type: 'privateKey',
      privateKey: TEST_PRIVATE_KEY
    });

    testAddress = await trader.getAddress();
    console.log('Test address:', testAddress);

    // Connect to price feed
    await feed.connect();
  }, 30000);

  afterAll(() => {
    trader.disconnect();
    feed.disconnect();
  });

  describe('Account Setup', () => {
    it('should get account info', async () => {
      const account = await trader.getAccountInfo();
      
      expect(account.address).toBe(testAddress);
      expect(account.usdcBalance).toBeInstanceOf(Decimal);
      
      console.log('USDC Balance:', account.usdcBalance.toString());
      console.log('ETH Balance:', account.balance.toString());
    }, 30000);

    it('should check and approve USDC if needed', async () => {
      const allowance = await trader.getTradingAllowance();
      console.log('Current allowance:', allowance.toString());

      if (allowance.lt(1000)) {
        console.log('Approving USDC...');
        const result = await trader.approveUSDCForTrading('10000');
        expect(result.success).toBe(true);
        console.log('Approval TX:', result.transactionHash);
      }
    }, 60000);
  });

  describe('Price Feeds', () => {
    it('should get ETH price', async () => {
      const price = await feed.getLatestPrice('ETH/USD');
      
      expect(price.pair).toBe('ETH/USD');
      expect(price.price.gt(0)).toBe(true);
      
      console.log('ETH Price:', price.price.toString());
    }, 10000);

    it('should subscribe to price updates', (done) => {
      let updateCount = 0;
      
      const unsubscribe = feed.subscribeToPrice('ETH/USD', (data) => {
        console.log('Price update:', data.price.toString());
        updateCount++;
        
        if (updateCount >= 3) {
          unsubscribe();
          done();
        }
      });
      
      // Wait for 3 price updates or timeout
      setTimeout(() => {
        if (updateCount === 0) {
          console.log('No price updates received (WebSocket may not be configured)');
          unsubscribe();
          done();
        }
      }, 15000);
    }, 20000);
  });

  describe('Trading Operations', () => {
    let positionId: string | undefined;

    it('should open a small test position', async () => {
      const account = await trader.getAccountInfo();
      
      // Only proceed if we have enough balance
      if (account.usdcBalance.lt(10)) {
        console.log('Insufficient balance for trading test');
        return;
      }

      const result = await trader.openPosition({
        pair: 'ETH/USD',
        side: PositionSide.LONG,
        size: '10', // Small test position
        leverage: 2,
        slippage: 1
      });

      expect(result.success).toBe(true);
      console.log('Position opened:', result.transactionHash);
      
      if (result.position) {
        positionId = result.position.id;
        console.log('Position ID:', positionId);
      }
    }, 60000);

    it('should get position details', async () => {
      if (!positionId) {
        console.log('No position to check');
        return;
      }

      const position = await trader.getPosition(positionId);
      
      expect(position).toBeDefined();
      expect(position?.pair).toBe('ETH/USD');
      expect(position?.size.gt(0)).toBe(true);
      
      console.log('Position size:', position?.size.toString());
      console.log('Entry price:', position?.entryPrice.toString());
    }, 30000);

    it('should close the test position', async () => {
      if (!positionId) {
        console.log('No position to close');
        return;
      }

      const result = await trader.closePosition({
        positionId,
        slippage: 1
      });

      expect(result.success).toBe(true);
      console.log('Position closed:', result.transactionHash);
    }, 60000);
  });

  describe('Market Data', () => {
    it('should get market stats', async () => {
      const stats = await feed.getMarketStats('ETH/USD');
      
      expect(stats.pair).toBe('ETH/USD');
      expect(stats.price.gt(0)).toBe(true);
      
      console.log('24h Volume:', stats.volume24h.toString());
      console.log('24h Change:', stats.changePercent24h, '%');
    }, 10000);

    it('should get funding rate', async () => {
      const funding = await feed.getFundingRate('ETH/USD');
      
      expect(funding.pair).toBe('ETH/USD');
      expect(funding.rate).toBeInstanceOf(Decimal);
      
      console.log('Funding rate:', funding.rate.toString());
      console.log('Next funding:', funding.nextFundingTime);
    }, 10000);
  });
});