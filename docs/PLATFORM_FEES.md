# Platform Fee Management System

The Avantis SDK now includes a comprehensive platform fee management system that allows platforms to charge fees on trades while providing discounts and referral rewards.

## Overview

The platform fee system enables:
- **Platform fees**: Charge a percentage fee on all trades
- **Discounts**: Offer percentage-based discounts to specific users
- **Referral rewards**: Split fees with referrers who bring in traders
- **Transaction bundling**: Use Multicall3 for gas-efficient operations

## Architecture

### Core Components

1. **FeeManager** (`src/fees/FeeManager.ts`)
   - Handles all fee calculations
   - Validates fee configurations
   - Manages discount application
   - Handles referral fee splitting

2. **MulticallBundler** (`src/fees/MulticallBundler.ts`)
   - Bundles multiple transactions using Multicall3
   - Combines USDC approvals, fee transfers, and trade execution
   - Reduces gas costs through batching

3. **Enhanced TraderClient** (`src/clients/TraderClient.ts`)
   - `setPlatformFeeConfig()`: Configure platform fees
   - `openPositionWithFees()`: Open positions with fee collection
   - `closePositionWithFees()`: Close positions with fee collection
   - `calculateFeeBreakdown()`: Preview fees before trading

## Configuration

```typescript
// Configure platform fees globally
sdk.trader.setPlatformFeeConfig({
  platformWallet: '0xYourPlatformWallet',  // Where fees are sent
  baseFeePercent: 0.001,                   // 0.1% fee
  referralSplitPercent: 30,                // 30% to referrers
  enabled: true                            // Enable fees
});
```

## Usage Examples

### Opening a Position with Fees

```typescript
const result = await sdk.trader.openPositionWithFees({
  pair: 'ETH-USD',
  side: PositionSide.LONG,
  size: 1000,
  leverage: 10,
  platformFee: {
    enabled: true,
    discountPercent: 20,              // 20% discount
    referralAddress: '0xReferrer'     // Referrer gets split
  }
});
```

### Calculating Fees Before Trading

```typescript
const feeBreakdown = sdk.trader.calculateFeeBreakdown(
  tradeSize,
  {
    enabled: true,
    discountPercent: 10,
    referralAddress: '0xReferrer'
  }
);

console.log('Platform receives:', feeBreakdown.platformReceives);
console.log('Referrer receives:', feeBreakdown.referralFee);
console.log('Total fee:', feeBreakdown.totalFee);
```

## Fee Structure

### Base Fee
- Configurable percentage of trade size (0.01% - 5%)
- Applied to all trades when enabled

### Discounts
- Per-trade discount percentage (0% - 100%)
- Reduces the base fee for specific users
- Can be used for VIP tiers or promotions

### Referral Split
- Configurable percentage of fees goes to referrers
- Default: 50% split
- Only applied when referralAddress is provided

## Transaction Flow

When `openPositionWithFees()` is called:

1. **Calculate fees**: Determine platform and referral fees
2. **Bundle transactions** using Multicall3:
   - Approve USDC for total amount (collateral + fees)
   - Transfer platform fee to platform wallet
   - Transfer referral fee (if applicable)
   - Execute trade on Avantis
3. **Execute bundle**: Single transaction for all operations

## Gas Optimization

The system uses Multicall3 for transaction bundling:
- **Single transaction** instead of 3-4 separate ones
- **Atomic execution**: All operations succeed or fail together
- **Reduced gas costs**: ~30-40% savings vs separate transactions

## Fee Constants

Default limits (configurable in `src/fees/constants.ts`):
- **MIN_PLATFORM_FEE_PERCENT**: 0.01%
- **MAX_PLATFORM_FEE_PERCENT**: 5%
- **DEFAULT_PLATFORM_FEE_PERCENT**: 0.1%
- **DEFAULT_REFERRAL_SPLIT_PERCENT**: 50%
- **MAX_DISCOUNT_PERCENT**: 100%

## Events

The system emits events for monitoring:
- `platformFeeConfigSet`: When configuration is updated
- `positionOpenedWithFees`: When trade with fees is executed
- `positionClosedWithFees`: When position is closed with fees

## Testing

Run the integration tests:

```bash
# Run fee calculation tests
npx ts-node examples/integration-test.ts

# Run full trading example with fees
npx ts-node examples/platform-fees.ts
```

## Best Practices

1. **Test on testnet first**: Always verify fee calculations before mainnet
2. **Monitor events**: Track fee collection through emitted events
3. **Validate addresses**: Ensure platform and referral addresses are correct
4. **Handle failures**: Bundled transactions are atomic - handle accordingly
5. **Set reasonable fees**: Keep fees competitive (typically 0.05% - 0.5%)

## Security Considerations

- Platform wallet must be secure (consider multi-sig)
- Fee configuration should be protected
- Validate all addresses before production
- Monitor for unusual fee patterns
- Regular audits of fee collection

## Future Enhancements

Potential improvements for consideration:
- Tiered fee structures based on volume
- Time-based discount campaigns
- Fee rebates for losses
- Analytics dashboard for fee tracking
- On-chain fee configuration