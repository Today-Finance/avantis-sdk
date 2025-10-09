# Avantis SDK Tests

This directory contains test suites for the Avantis SDK.

## Test Files

### Unit Tests
- **`basic.test.ts`** - Basic SDK functionality tests
- **`unit/calculations.test.ts`** - Trading calculation utilities
- **`unit/pythClient.test.ts`** - Pyth Network integration tests

### Integration Tests
- **`openPosition.test.ts`** - Comprehensive openPosition functionality tests ⭐
- **`viem-integration.test.ts`** - Viem blockchain library integration tests
- **`integration/traderClient.test.ts`** - TraderClient integration tests
- **`integration/feedClient.test.ts`** - FeedClient integration tests

### E2E Tests
- **`e2e/trading.e2e.test.ts`** - End-to-end trading tests (requires testnet setup)

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/openPosition.test.ts

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests (requires setup)
RUN_E2E_TESTS=true npm run test:e2e
```

## OpenPosition Tests ⭐

The `openPosition.test.ts` file contains comprehensive tests for the position opening functionality after the viem migration. It verifies:

- ✅ SDK initialization
- ✅ Viem integration (bigint types, accounts, clients)
- ✅ Signer configuration (private key, mnemonic)
- ✅ Parameter validation
- ✅ Contract addresses
- ✅ Account info retrieval
- ✅ USDC operations
- ✅ Network support (Base mainnet & Sepolia)

**23 tests** covering all critical openPosition functionality.

## Example Scripts

See `examples/test-open-position.js` for a runnable demonstration of the openPosition flow:

```bash
node examples/test-open-position.js
```

This script provides:
- Visual test output
- Viem integration verification
- Parameter validation examples
- Usage instructions for production

## Test Structure

```
tests/
├── README.md                          # This file
├── basic.test.ts                      # Basic SDK tests
├── openPosition.test.ts               # OpenPosition functionality ⭐
├── viem-integration.test.ts           # Viem integration tests
├── unit/
│   ├── calculations.test.ts           # Math utilities
│   └── pythClient.test.ts             # Pyth Network
├── integration/
│   ├── feedClient.test.ts             # Price feeds
│   └── traderClient.test.ts           # Trading client
├── e2e/
│   └── trading.e2e.test.ts            # End-to-end tests
└── fixtures/
    └── mockData.ts                     # Test data
```

## Viem Migration

After migrating from ethers.js to viem, the following changes apply to tests:

### Type Changes
- `BigNumber` → `bigint`
- `ethers.Provider` → `PublicClient`
- `ethers.Signer` → `WalletClient`

### Import Changes
```typescript
// Old (ethers)
import { ethers } from 'ethers';

// New (viem)
import { createPublicClient, createWalletClient } from 'viem';
```

### Test Assertions
```typescript
// Old
expect(typeof chainId).toBe('number');

// New
expect(typeof chainId).toBe('bigint');
```

## CI/CD

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Pre-publish

## Contributing

When adding new tests:
1. Place unit tests in `unit/`
2. Place integration tests in `integration/`
3. Place E2E tests in `e2e/`
4. Update this README if adding new test categories
5. Ensure all tests pass: `npm test`
