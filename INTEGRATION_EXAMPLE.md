# Privy Wallet API Integration Example

This document shows how to use the new `prepare*` methods with Privy's gasless transaction infrastructure.

## ✅ SDK Changes Complete

The following methods have been added to `TraderClient`:

1. `prepareApproveTransaction(amount)` - Prepare USDC approval
2. `prepareOpenPositionTransaction(params)` - Prepare open position trade
3. `prepareClosePositionTransaction(params)` - Prepare close position trade
4. `prepareUpdatePositionTransaction(params)` - Prepare TP/SL update

All methods return `{ to: string, data: string, value: string }` which can be sent via Privy Wallet API.

---

## Backend Integration Pattern

### 1. Initialize SDK (one-time setup)

```typescript
import { AvantisSDK, PositionSide, OrderType } from '@todayapp/avantis-sdk';

const sdk = new AvantisSDK('base', process.env.BASE_RPC_URL);

// Set signer for reading data (balance checks, etc.)
// NOTE: This signer is NOT used for sending transactions
await sdk.setSigner({
  type: 'viemClient',
  client: someViemClient, // For read operations only
});
```

### 2. Prepare Transaction Using SDK

```typescript
// Example: Open a trading position
const txData = await sdk.trader.prepareOpenPositionTransaction({
  pair: 'BTC/USD',
  side: PositionSide.LONG,
  size: 100, // $100 position
  leverage: 10,
  orderType: OrderType.MARKET,
  slippage: 1,
});

console.log(txData);
// {
//   to: '0x44914408...',  // Trading contract address
//   data: '0x123abc...',  // Encoded function call
//   value: '0'            // No ETH value
// }
```

### 3. Send Via Privy Wallet API (Gasless!)

```typescript
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTH_PRIVATE_KEY,
    },
  }
);

// Get user's wallet
const user = await privyClient.getUser(userId);
const wallet = user.linkedAccounts.find(
  (account) => account.type === 'wallet' && account.walletClientType === 'privy'
);

// Send transaction via Privy (gasless!)
const result = await privyClient.walletApi.ethereum.sendTransaction({
  address: wallet.address,
  chainType: 'ethereum',
  chainId: 8453, // Base mainnet
  transaction: {
    to: txData.to,
    data: txData.data,
    value: txData.value || '0x0',
  },
});

console.log('Transaction sent (gasless):', result.transactionHash);
```

---

## Complete Trading Service Example

```typescript
import { AvantisSDK, PositionSide, OrderType } from '@todayapp/avantis-sdk';
import { PrivyClient } from '@privy-io/server-auth';

export class AvantisTradingService {
  private sdk: AvantisSDK;
  private privyClient: PrivyClient;

  constructor() {
    // Initialize SDK
    this.sdk = new AvantisSDK('base', process.env.BASE_RPC_URL);

    // Initialize Privy
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET,
      {
        walletApi: {
          authorizationPrivateKey: process.env.PRIVY_AUTH_PRIVATE_KEY,
        },
      }
    );
  }

  /**
   * Open a trading position (gasless!)
   */
  async openPosition(params: {
    userId: string;
    userAddress: string;
    pair: string;
    side: 'long' | 'short';
    size: number;
    leverage: number;
    orderType: 'market' | 'limit';
  }) {
    try {
      // 1. Check USDC allowance
      const allowance = await this.checkAllowance(params.userAddress);
      const collateralNeeded = params.size / params.leverage;

      if (allowance < collateralNeeded) {
        console.log('Approving USDC (gasless)...');

        // Prepare approval transaction
        const approveData = await this.sdk.trader.prepareApproveTransaction(
          collateralNeeded * 10 // Approve extra for future trades
        );

        // Send via Privy (gasless)
        await this.sendGaslessTransaction(params.userId, approveData);

        // Wait for approval to be mined
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 2. Prepare open position transaction
      const txData = await this.sdk.trader.prepareOpenPositionTransaction({
        pair: params.pair,
        side: params.side === 'long' ? PositionSide.LONG : PositionSide.SHORT,
        size: params.size,
        leverage: params.leverage,
        orderType: params.orderType === 'market' ? OrderType.MARKET : OrderType.LIMIT,
        slippage: 1,
      });

      // 3. Send via Privy (gasless!)
      const result = await this.sendGaslessTransaction(params.userId, txData);

      console.log(`✅ Position opened (gasless): ${result.transactionHash}`);

      return {
        success: true,
        txHash: result.transactionHash,
      };
    } catch (error: any) {
      console.error('Error opening position:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Close a trading position (gasless!)
   */
  async closePosition(params: {
    userId: string;
    positionId: string;
  }) {
    try {
      // Prepare close transaction
      const txData = await this.sdk.trader.prepareClosePositionTransaction({
        positionId: params.positionId,
      });

      // Send via Privy (gasless!)
      const result = await this.sendGaslessTransaction(params.userId, txData);

      console.log(`✅ Position closed (gasless): ${result.transactionHash}`);

      return {
        success: true,
        txHash: result.transactionHash,
      };
    } catch (error: any) {
      console.error('Error closing position:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update position TP/SL (gasless!)
   */
  async updatePositionTpSl(params: {
    userId: string;
    positionId: string;
    takeProfit?: number;
    stopLoss?: number;
  }) {
    try {
      // Prepare update transaction
      const txData = await this.sdk.trader.prepareUpdatePositionTransaction({
        positionId: params.positionId,
        takeProfit: params.takeProfit,
        stopLoss: params.stopLoss,
      });

      // Send via Privy (gasless!)
      const result = await this.sendGaslessTransaction(params.userId, txData);

      console.log(`✅ Position updated (gasless): ${result.transactionHash}`);

      return {
        success: true,
        txHash: result.transactionHash,
      };
    } catch (error: any) {
      console.error('Error updating position:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper: Send transaction via Privy Wallet API (gasless!)
   */
  private async sendGaslessTransaction(
    userId: string,
    txData: { to: string; data: string; value: string }
  ) {
    // Get user's embedded wallet
    const user = await this.privyClient.getUser(userId);
    const wallet = user.linkedAccounts.find(
      (account) =>
        account.type === 'wallet' && account.walletClientType === 'privy'
    ) as any;

    if (!wallet) {
      throw new Error('User does not have an embedded wallet');
    }

    // Send transaction via Privy Wallet API
    // This routes through TEE infrastructure where gas sponsorship happens!
    const result = await this.privyClient.walletApi.ethereum.sendTransaction({
      address: wallet.address,
      chainType: 'ethereum',
      chainId: 8453, // Base mainnet
      transaction: {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0x0',
      },
    });

    return result;
  }

  /**
   * Helper: Check USDC allowance
   */
  private async checkAllowance(userAddress: string): Promise<number> {
    const allowance = await this.sdk.trader.getTradingAllowance(userAddress);
    return allowance.toNumber();
  }
}
```

---

## Benefits

✅ **Gasless transactions** - Privy sponsors all gas fees
✅ **No UI signatures** - Server-side session signers handle everything
✅ **Simple EOA** - No smart account complexity
✅ **SDK validation** - All trade validation happens before encoding
✅ **Type safety** - Full TypeScript support

---

## Testing

Run the test suite:

```bash
cd /Users/atif/Projects/TodayFinance/avantis/avantis-sdk
npm run build
node test-prepare-simple.mjs
```

Expected output:
```
✅ All transaction preparation methods exist
✅ Methods return correct { to, data, value } structure
✅ Transaction encoding works without execution
🎉 SDK is ready for Privy Wallet API integration!
```

---

## Privy Dashboard Configuration

Ensure you have:

1. ✅ **TEE Execution** - Enabled
2. ✅ **Gas Sponsorship** - Enabled for Base chain
3. ✅ **Server-side only** - "Allow transactions from client" disabled
4. ✅ **Authorization key** - Generated and stored securely

---

## Next Steps

1. Update backend `AvantisTradingService` to use new prepare methods
2. Replace all direct SDK execution calls with Privy Wallet API
3. Test on Base testnet first
4. Monitor gas sponsorship usage in Privy dashboard
5. Deploy to production

---

## Questions?

- SDK methods: Check `TraderClient.ts` lines 270, 308, 676, 798
- Integration pattern: See example above
- Privy docs: https://docs.privy.io/wallets/gas-and-asset-management/gas/setup
