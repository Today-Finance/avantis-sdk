# Avantis SDK Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Network Configuration](#network-configuration)
- [Contract Integration](#contract-integration)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Monitoring](#monitoring)

## Prerequisites

### Required Tools
- Node.js v18+ and npm v9+
- TypeScript 5.0+
- Git

### API Keys Required
1. **RPC Provider** (choose one):
   - [Alchemy](https://www.alchemy.com/) - Recommended
   - [Infura](https://infura.io/)
   - [QuickNode](https://www.quicknode.com/)

2. **Price Feed Access**:
   - Pyth Network Oracle integration
   - Chainlink as fallback

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/avantis-sdk.git
cd avantis-sdk
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Network Configuration
DEFAULT_NETWORK=base
BASE_RPC_URL=https://mainnet.base.org

# API Keys (Required for production)
ALCHEMY_API_KEY=your_alchemy_api_key_here
BASE_WS_URL=wss://base-mainnet.g.alchemy.com/v2/your_alchemy_api_key_here

# Optional: Test Configuration
TEST_PRIVATE_KEY=0x... # Only for testing, never use real funds
TEST_RPC_URL=https://sepolia.base.org
```

### 3. Build the SDK

```bash
npm run build
```

## Network Configuration

### Base Mainnet (Production)

```typescript
const config = {
  network: 'base',
  rpcUrl: process.env.BASE_RPC_URL,
  websocketUrl: process.env.BASE_WS_URL,
  contracts: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    avnt: '0x696F9436B67233384889472Cd7cD58A6fB5DF4f1',
    // Trading contracts will be added once extracted from Python SDK
  }
};
```

### Base Sepolia (Testnet)

```typescript
const config = {
  network: 'base-sepolia',
  rpcUrl: 'https://sepolia.base.org',
  contracts: {
    // Testnet addresses to be added
  }
};
```

## Contract Integration

### Current Contract Addresses

| Contract | Base Mainnet | Base Sepolia |
|----------|--------------|--------------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | TBD |
| AVNT Token | `0x696F9436B67233384889472Cd7cD58A6fB5DF4f1` | N/A |
| Trading | TBD (Extract from Python SDK) | TBD |
| Vault | TBD | TBD |
| Price Feed | TBD (Pyth Network) | TBD |

### Adding New Contract ABIs

1. Place ABI JSON files in `src/contracts/abis/`
2. Update contract addresses in `src/constants/networks.ts`
3. Rebuild the SDK: `npm run build`

### Extracting ABIs from Python SDK

The official Python SDK contains the complete contract interfaces. To extract:

1. Clone the Python SDK:
```bash
git clone https://github.com/Avantis-Labs/avantis_trader_sdk.git
```

2. Locate contract definitions in the Python source
3. Convert to TypeScript ABI format
4. Validate against on-chain contracts using BaseScan

## Testing

### Unit Tests

Run unit tests:
```bash
npm test
```

### Integration Tests

Run integration tests with mocked contracts:
```bash
npm run test:integration
```

### E2E Tests (Testnet)

Configure testnet environment:
```bash
export RUN_E2E_TESTS=true
export TEST_PRIVATE_KEY=0x... # Test wallet private key
export TEST_RPC_URL=https://sepolia.base.org
```

Run E2E tests:
```bash
npm run test:e2e
```

### Test Coverage

Generate coverage report:
```bash
npm run test:coverage
```

## Production Deployment

### 1. Security Checklist

- [ ] Never commit private keys or sensitive data
- [ ] Use environment variables for all configuration
- [ ] Implement rate limiting for API calls
- [ ] Add transaction retry logic with exponential backoff
- [ ] Validate all user inputs
- [ ] Use secure key management (AWS KMS, HashiCorp Vault, etc.)

### 2. Performance Optimization

```typescript
// Use connection pooling for RPC
const provider = new ethers.JsonRpcProvider({
  url: RPC_URL,
  throttleLimit: 10, // Limit concurrent requests
  timeout: 30000
});

// Implement caching for frequently accessed data
const priceCache = new Map();
const CACHE_TTL = 1000; // 1 second
```

### 3. Error Handling

```typescript
import { AvantisSDKError, ErrorCode } from '@avantis/sdk';

try {
  await trader.openPosition(params);
} catch (error) {
  if (error instanceof AvantisSDKError) {
    // Handle specific errors
    switch (error.code) {
      case ErrorCode.INSUFFICIENT_FUNDS:
        // Handle insufficient funds
        break;
      case ErrorCode.NETWORK_ERROR:
        // Retry with backoff
        break;
    }
  }
  // Log to monitoring service
  logger.error('Trade failed', { error, params });
}
```

### 4. Deployment Steps

#### NPM Package Publication

1. Update version in `package.json`
2. Build and test: `npm run build && npm test`
3. Publish to NPM:
```bash
npm login
npm publish --access public
```

#### CDN Distribution

For browser usage:
```html
<script src="https://unpkg.com/@avantis/sdk@latest/dist/index.min.js"></script>
```

#### Docker Container

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## Monitoring

### 1. Logging

Implement structured logging:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'avantis-sdk.log' })
  ]
});
```

### 2. Metrics

Track key metrics:
- Transaction success/failure rates
- API response times
- WebSocket connection stability
- Gas usage statistics

### 3. Alerts

Set up alerts for:
- Failed transactions
- Network connectivity issues
- Abnormal gas prices
- Contract interaction failures

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Fails
```
Error: WebSocket connection timeout
```
**Solution**: Ensure WebSocket URL includes valid API key and network supports WebSocket connections.

#### 2. Transaction Reverts
```
Error: Transaction reverted
```
**Solution**: Check:
- Sufficient USDC balance
- USDC approval for trading contract
- Position parameters within limits

#### 3. Network Timeout
```
Error: Network timeout
```
**Solution**: 
- Increase timeout in configuration
- Use fallback RPC providers
- Implement retry logic

### Debug Mode

Enable debug logging:
```typescript
const client = new TraderClient('base', {
  logging: {
    level: 'debug',
    enabled: true
  }
});
```

## Migration from Python SDK

### Key Differences

| Feature | Python SDK | TypeScript SDK |
|---------|------------|----------------|
| Async | `async/await` | Native `Promise` |
| Decimals | `decimal.Decimal` | `Decimal.js` |
| Web3 | `web3.py` | `ethers.js` |
| Types | Runtime | Compile-time |

### Migration Example

Python:
```python
from avantis_trader_sdk import TraderClient

client = TraderClient(network="base")
await client.open_position(
    pair="ETH/USD",
    is_long=True,
    size=1000,
    leverage=10
)
```

TypeScript:
```typescript
import { TraderClient, PositionSide } from '@avantis/sdk';

const client = new TraderClient('base');
await client.openPosition({
  pair: 'ETH/USD',
  side: PositionSide.LONG,
  size: '1000',
  leverage: 10
});
```

## Support

### Resources
- [GitHub Issues](https://github.com/your-org/avantis-sdk/issues)
- [Discord Community](https://discord.gg/avantis)
- [Documentation](https://docs.avantis.finance)

### Contact
- Technical Support: support@avantis.finance
- Security Issues: security@avantis.finance (PGP key available)

## License

MIT - See [LICENSE](../LICENSE) file for details.