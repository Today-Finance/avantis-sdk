# Avantis SDK Examples

## Quick Start Guide

### Installation

```bash
npm install @todayapp/avantis-sdk
# or
yarn add @todayapp/avantis-sdk
```

### Basic Usage

```typescript
import { TraderClient, PositionSide } from '@todayapp/avantis-sdk';

// Initialize the SDK
const trader = new TraderClient('base'); // or 'base-sepolia' for testnet

// Connect your wallet
await trader.setSigner({
  type: 'privateKey',
  privateKey: 'YOUR_PRIVATE_KEY'
});

// Execute a market order
const result = await trader.openPosition({
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: '100',     // $100 position
  leverage: 10,     // 10x leverage
  slippage: 0.5    // 0.5% slippage tolerance
});
```

## Examples

### 1. Execute Market Order (`execute-market-order.ts`)

Complete example showing how to:
- Connect wallet
- Check balances
- Get current prices
- Open a leveraged position
- Monitor position PnL
- Close positions

```bash
npx ts-node examples/execute-market-order.ts
```

### 2. React Native Integration (`react-native-integration.tsx`)

Full React Native/Expo app example with:
- Secure wallet storage
- Real-time price updates
- Order form UI
- Position management
- PnL tracking

### 3. Update Position TP/SL (`update-position-tpsl.ts`)

Complete examples for managing stop-loss and take-profit:
- Update TP/SL on existing positions
- Add trailing stop-loss
- Set risk/reward based TP/SL
- Batch update multiple positions
- Remove TP/SL from positions

```bash
npx ts-node examples/update-position-tpsl.ts
```

### 4. Advanced Trading (`advanced-trading.ts`)

Advanced features including:
- Multiple position management
- Risk management strategies
- Automated stop-loss/take-profit
- Market data analysis
- WebSocket price feeds

## Supported Trading Pairs

### Cryptocurrencies
- BTC/USD (up to 100x leverage)
- ETH/USD (up to 100x leverage)
- SOL/USD (up to 50x leverage)

### Forex
- EUR/USD (up to 100x leverage)
- GBP/USD (up to 100x leverage)
- USD/JPY (up to 100x leverage)

### Commodities
- XAU/USD (Gold, up to 50x leverage)
- XAG/USD (Silver, up to 50x leverage)

## Environment Setup

### Required Environment Variables

```bash
# .env
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_rpc_endpoint (optional)
ALCHEMY_API_KEY=your_alchemy_key (optional)
INFURA_API_KEY=your_infura_key (optional)
```

### Network Configuration

#### Base Mainnet
- Chain ID: 8453
- RPC: https://mainnet.base.org
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

#### Base Sepolia (Testnet)
- Chain ID: 84531
- RPC: https://sepolia.base.org
- Testnet USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- Faucet: https://www.alchemy.com/faucets/base-sepolia

## Key Features

### Position Management
```typescript
// Open position with stop-loss and take-profit
const position = await trader.openPosition({
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: '100',
  leverage: 10,
  stopLoss: '2850',   // Stop at $2,850
  takeProfit: '3300'  // Take profit at $3,300
});

// Get position details
const myPosition = await trader.getPosition(position.id);

// Update stop-loss and take-profit
await trader.updatePosition({
  positionId: position.id,
  stopLoss: '2900',   // Update stop loss
  takeProfit: '3400'  // Update take profit
});

// Close position (partial or full)
await trader.closePosition({
  positionId: position.id,
  size: '50'  // Close 50% of position
});
```

### Real-time Price Feeds
```typescript
const feed = new FeedClient();

// Subscribe to price updates
feed.subscribeToPrice('ETH/USD', (data) => {
  console.log(`ETH Price: ${data.price}`);
});

// Get market stats
const stats = await feed.getMarketStats('ETH/USD');
console.log(`24h Volume: ${stats.volume24h}`);
console.log(`24h Change: ${stats.changePercent24h}%`);
```

### Update TP/SL on Existing Positions
```typescript
// Update both TP and SL
await trader.updatePosition({
  positionId: 'position-123',
  stopLoss: '2850',    // New stop loss price
  takeProfit: '3300'   // New take profit price
});

// Remove stop loss (set to null)
await trader.updatePosition({
  positionId: 'position-123',
  stopLoss: null,      // Remove SL
  takeProfit: '3300'   // Keep TP
});

// Trailing stop loss example
import { addTrailingStopLoss } from './examples/update-position-tpsl';

// Add 5% trailing stop
await addTrailingStopLoss('position-123', 5);

// Risk/reward based TP/SL (2% risk, 1:3 ratio)
import { setRiskRewardTPSL } from './examples/update-position-tpsl';

await setRiskRewardTPSL('position-123', 2, 3);
```

### Account Management
```typescript
// Get account info
const account = await trader.getAccountInfo();
console.log(`Balance: ${account.usdcBalance}`);
console.log(`Margin Level: ${account.marginLevel}%`);
console.log(`Open Positions: ${account.positions.length}`);

// Approve USDC for trading
await trader.approveUSDCForTrading('1000'); // Approve $1,000
```

## Error Handling

```typescript
import { TradingError, ErrorCode } from '@todayapp/avantis-sdk';

try {
  await trader.openPosition(params);
} catch (error) {
  if (error instanceof TradingError) {
    switch (error.code) {
      case ErrorCode.INSUFFICIENT_FUNDS:
        console.log('Not enough USDC');
        break;
      case ErrorCode.MAX_LEVERAGE_EXCEEDED:
        console.log('Leverage too high');
        break;
      case ErrorCode.MARKET_CLOSED:
        console.log('Market is closed');
        break;
    }
  }
}
```

## Best Practices

1. **Always check balances** before opening positions
2. **Use stop-loss orders** to manage risk
3. **Monitor margin levels** to avoid liquidation
4. **Handle network errors** with retries
5. **Secure private keys** using environment variables or secure storage
6. **Test on testnet first** before mainnet trading

## Support

- Documentation: https://docs.avantisfi.com
- GitHub: https://github.com/avantis-labs/avantis-sdk
- Discord: https://discord.gg/avantis

## License

MIT