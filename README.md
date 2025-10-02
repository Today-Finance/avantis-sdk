# Avantis TypeScript SDK (Unofficial)

[![npm version](https://img.shields.io/npm/v/avantis-sdk-io.svg)](https://www.npmjs.com/package/avantis-sdk-io)
[![Beta](https://img.shields.io/badge/Status-Beta-yellow)](https://github.com/Today-Finance/avantis-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Base Network](https://img.shields.io/badge/Base-Network-0052FF)](https://base.org)

**⚠️ BETA SOFTWARE - This is an unofficial, community-developed SDK for Avantis. Use at your own risk.**

An unofficial TypeScript SDK for interacting with [Avantis](https://avantis.finance) - the decentralized perpetual futures DEX on Base network. Trade crypto, forex, commodities, and indices with up to 100x leverage.

> **Note**: This SDK is currently in beta and is not officially endorsed by Avantis. While it has been thoroughly tested, users should exercise caution when using it in production environments.

## ✨ Features

- 🚀 **Full Trading Suite**: Market orders, limit orders, stop orders, and position management
- 💰 **Platform Fee System**: Built-in fee management with referral support and transaction bundling
- 📊 **Real-time Data**: WebSocket-based live price feeds and market data
- 💱 **40+ Trading Pairs**: Crypto, forex, commodities, and indices
- 🔐 **Type-Safe**: Full TypeScript with runtime validation using Zod
- 📱 **Cross-Platform**: Works with Node.js, browsers, and React Native
- ⚡ **Gas Optimized**: Multicall3 transaction bundling for 30-40% gas savings
- 🛡️ **Production Ready**: Comprehensive error handling and recovery

## 📦 Installation

```bash
npm install avantis-sdk-io
# or
yarn add avantis-sdk-io
# or
pnpm add avantis-sdk-io
```

## 🚀 Quick Start

### Basic Trading

```typescript
import { AvantisSDK, PositionSide, OrderType } from 'avantis-sdk-io';

// Initialize SDK
const sdk = new AvantisSDK('base'); // 'base' for mainnet, 'base-sepolia' for testnet

// Set up signer
await sdk.setSigner({
  type: 'privateKey',
  privateKey: process.env.PRIVATE_KEY
});

// Open a position
const result = await sdk.trader.openPosition({
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: 1000, // $1000 position size
  leverage: 10, // 10x leverage
  orderType: OrderType.MARKET,
  stopLoss: 2800, // Optional SL at $2800
  takeProfit: 3500, // Optional TP at $3500
  slippage: 0.5 // 0.5% slippage tolerance
});

console.log('Position opened:', result.transactionHash);
```

### With Platform Fees

```typescript
// Configure platform fees (for platforms/integrators)
sdk.trader.setPlatformFeeConfig({
  platformWallet: '0xYourPlatformWallet',
  baseFeePercent: 0.001, // 0.1% platform fee
  referralSplitPercent: 30, // 30% goes to referrers
  enabled: true
});

// Open position with fees
const result = await sdk.trader.openPositionWithFees({
  pair: 'BTC/USD',
  side: PositionSide.SHORT,
  size: 5000,
  leverage: 25,
  platformFee: {
    enabled: true,
    discountPercent: 20, // 20% fee discount for this user
    referralAddress: '0xReferrerWallet' // Optional referrer
  }
});
```

### Real-time Price Feeds

```typescript
// Initialize feed client
await sdk.feed.connect();

// Subscribe to price updates
const unsubscribe = sdk.feed.subscribeToPrice('BTC/USD', (priceData) => {
  console.log(`BTC Price: $${priceData.price.toFixed(2)}`);
  console.log(`24h Change: ${priceData.change24h}%`);
});

// Get latest price once
const price = await sdk.feed.getLatestPrice('ETH/USD');
console.log(`ETH: $${price.price}`);

// Cleanup
unsubscribe();
await sdk.feed.disconnect();
```

## 📱 React Native Setup

For React Native/Expo apps, install polyfills:

```bash
npm install react-native-get-random-values @ethersproject/shims
```

Add to your app's entry point:

```javascript
// index.js or App.tsx
import 'react-native-get-random-values';
import '@ethersproject/shims';

// Your app code
import App from './App';
```

## 📖 Core Concepts

### Trading Pairs

The SDK supports 40+ trading pairs across different categories:

```typescript
// Get all available pairs
const allPairs = sdk.trader.getAllPairs();

// Get pairs by category
const cryptoPairs = sdk.trader.getPairsByCategory('crypto');
// Returns: ['BTC/USD', 'ETH/USD', 'SOL/USD', ...]

const forexPairs = sdk.trader.getPairsByCategory('forex');
// Returns: ['EUR/USD', 'GBP/USD', 'USD/JPY', ...]
```

### Position Management

```typescript
// Get all open positions
const positions = await sdk.trader.getPositions();

// Update stop loss and take profit
await sdk.trader.updatePosition({
  positionId: '0-123', // Format: "pairIndex-positionIndex"
  stopLoss: 2900,
  takeProfit: 3200
});

// Close position (partial or full)
await sdk.trader.closePosition({
  positionId: '0-123',
  size: 500 // Optional: close only $500 (partial close)
});
```

### Account Information

```typescript
const account = await sdk.trader.getAccountInfo();

console.log('Address:', account.address);
console.log('USDC Balance:', account.usdcBalance.toFixed(2));
console.log('Free Collateral:', account.freeCollateral.toFixed(2));
console.log('Active Positions:', account.positions.length);
console.log('Unrealized PnL:', account.unrealizedPnl.toFixed(2));
console.log('Margin Level:', account.marginLevel, '%');
```

### Limit Orders

```typescript
// Place a limit order
const limitOrder = await sdk.trader.openPosition({
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: 2000,
  leverage: 15,
  orderType: OrderType.LIMIT,
  openPrice: 2950, // Will execute when ETH reaches $2950
  stopLoss: 2800,
  takeProfit: 3200
});

// Update limit order
await sdk.trader.updateLimitOrder({
  pairIndex: 1,
  orderIndex: 0,
  price: 2940, // New limit price
  takeProfit: 3250,
  stopLoss: 2750
});

// Cancel limit order
await sdk.trader.cancelLimitOrder({
  pairIndex: 1,
  orderIndex: 0
});
```

## 💰 Platform Fee System

The SDK includes a comprehensive fee management system for platforms and integrators:

### Features
- **Transaction Bundling**: Uses Multicall3 for gas-efficient atomic transactions
- **Flexible Discounts**: Per-user percentage discounts (0-100%)
- **Referral Support**: Automatic fee splitting with referrers
- **Gas Optimized**: ~30-40% gas savings through bundling

### Implementation

```typescript
// Configure global platform fees
sdk.trader.setPlatformFeeConfig({
  platformWallet: '0xYourPlatformWallet',
  baseFeePercent: 0.002, // 0.2% fee
  referralSplitPercent: 40, // 40% to referrers
  enabled: true
});

// Calculate fees before trading
const feeBreakdown = sdk.trader.calculateFeeBreakdown(
  1000, // Trade size
  {
    enabled: true,
    discountPercent: 25, // VIP discount
    referralAddress: '0xReferrer'
  }
);

console.log('Platform receives:', feeBreakdown.platformReceives);
console.log('Referrer receives:', feeBreakdown.referralFee);
console.log('Total fee:', feeBreakdown.totalFee);

// Execute trade with fees (bundled in single transaction)
await sdk.trader.openPositionWithFees({
  // ... position params
  platformFee: {
    enabled: true,
    discountPercent: 25,
    referralAddress: '0xReferrer'
  }
});
```

## 🛡️ Error Handling

The SDK provides detailed error types for robust error handling:

```typescript
import { 
  TradingError, 
  ValidationError, 
  NetworkError,
  ErrorCode 
} from '@avantis/sdk';

try {
  await sdk.trader.openPosition(params);
} catch (error) {
  if (error instanceof TradingError) {
    switch (error.code) {
      case ErrorCode.INSUFFICIENT_COLLATERAL:
        console.error('Not enough USDC balance');
        break;
      case ErrorCode.POSITION_SIZE_TOO_SMALL:
        console.error('Position size below minimum');
        break;
      case ErrorCode.MAX_LEVERAGE_EXCEEDED:
        console.error('Leverage too high for this pair');
        break;
      default:
        console.error('Trading error:', error.message);
    }
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field, error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
  }
}
```

## 📊 Advanced Examples

### Portfolio Monitoring

```typescript
// Monitor all positions with real-time PnL
const positions = await sdk.trader.getPositions();

for (const position of positions) {
  sdk.feed.subscribeToPrice(position.pair, (priceData) => {
    const currentPrice = priceData.price;
    const entryPrice = position.entryPrice;
    
    const pnlPercent = position.side === PositionSide.LONG
      ? ((currentPrice - entryPrice) / entryPrice) * 100 * position.leverage
      : ((entryPrice - currentPrice) / entryPrice) * 100 * position.leverage;
    
    console.log(`${position.pair}: ${pnlPercent.toFixed(2)}% PnL`);
    
    // Auto-close if profit target reached
    if (pnlPercent >= 50) {
      await sdk.trader.closePosition({ positionId: position.id });
      console.log('Profit target reached, position closed!');
    }
  });
}
```

### Risk Management System

```typescript
class RiskManager {
  constructor(private sdk: AvantisSDK, private maxDrawdown: number = 10) {}
  
  async monitorRisk() {
    const account = await this.sdk.trader.getAccountInfo();
    const initialBalance = account.usdcBalance;
    
    setInterval(async () => {
      const current = await this.sdk.trader.getAccountInfo();
      const drawdown = ((initialBalance - current.usdcBalance) / initialBalance) * 100;
      
      if (drawdown >= this.maxDrawdown) {
        console.warn(`Max drawdown reached: ${drawdown.toFixed(2)}%`);
        
        // Close all positions
        for (const position of current.positions) {
          await this.sdk.trader.closePosition({ positionId: position.id });
        }
        console.log('All positions closed due to max drawdown');
      }
      
      // Check margin level
      if (current.marginLevel < 150) {
        console.warn(`Low margin level: ${current.marginLevel}%`);
      }
    }, 5000); // Check every 5 seconds
  }
}
```

## 🔧 Configuration

### Network Configuration

```typescript
// Mainnet (Base)
const sdk = new AvantisSDK('base');

// Testnet (Base Sepolia)
const sdk = new AvantisSDK('base-sepolia');

// Custom RPC
const sdk = new AvantisSDK('base', 'https://your-rpc-url.com');

// Get network info
const network = sdk.trader.getNetwork();
console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
```

### Signer Options

```typescript
// Private key (Node.js)
await sdk.setSigner({
  type: 'privateKey',
  privateKey: '0x...'
});

// Mnemonic phrase
await sdk.setSigner({
  type: 'mnemonic',
  mnemonic: 'your twelve word phrase...',
  path: "m/44'/60'/0'/0/0" // Optional HD path
});

// Injected provider (Browser)
await sdk.setSigner({
  type: 'injected'
});
```

## 📝 API Reference

### Main Classes

- **`AvantisSDK`**: Main SDK wrapper class
- **`TraderClient`**: Trading operations and position management
- **`FeedClient`**: Real-time price feeds and market data
- **`StorageClient`**: On-chain storage interactions
- **`PriceClient`**: Price aggregation and oracles
- **`FeeManager`**: Platform fee calculations
- **`MulticallBundler`**: Transaction bundling

### Key Types

- **`Position`**: Open position data
- **`OpenPositionParams`**: Parameters for opening positions
- **`ClosePositionParams`**: Parameters for closing positions
- **`PlatformFeeConfig`**: Platform fee configuration
- **`MarketStats`**: 24-hour market statistics
- **`AccountInfo`**: Complete account information

## 🧪 Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/Today-Finance/avantis-sdk
cd avantis-sdk

# Install dependencies
npm install

# Build SDK
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 Resources

- **Documentation**: [docs.avantisfi.com](https://docs.avantisfi.com)
- **Discord**: [discord.gg/avantis](https://discord.gg/avantis)
- **Twitter**: [@AvantisFinance](https://twitter.com/AvantisFinance)
- **GitHub**: [github.com/avantisfi](https://github.com/avantisfi)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## ⚠️ Important Disclaimers

### Beta Software Notice
This SDK is currently in **BETA** and is an **UNOFFICIAL** implementation. It has not been audited or officially endorsed by Avantis. While extensive testing has been performed, users should:
- Test thoroughly in testnet before mainnet use
- Start with small amounts when using in production
- Monitor all transactions carefully
- Report any issues to the GitHub repository

### Trading Risk Disclaimer
Trading perpetual futures involves significant risk of loss. This software is provided "as is" without warranty of any kind. Always do your own research, trade responsibly, and never invest more than you can afford to lose. Past performance is not indicative of future results.

### No Warranty
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

*This is an unofficial, community-developed SDK. Not affiliated with or endorsed by Avantis.*