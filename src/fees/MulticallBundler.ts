/**
 * MulticallBundler - Handles bundling multiple transactions into a single Multicall3 transaction
 */

import { encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import type {
  CallData,
  BundledTransaction
} from '../types/platform-fees';
import { Multicall3ContractABI } from '../contracts';
import { MULTICALL3_ADDRESS } from './constants';
import { TradingError, ErrorCode } from '../utils/errors';

export class MulticallBundler {
  private multicallAddress: string;

  constructor(multicallAddress?: string) {
    this.multicallAddress = multicallAddress || MULTICALL3_ADDRESS;
  }

  /**
   * Creates a USDC approval call
   */
  public createApprovalCall(
    usdcAddress: string,
    spender: string,
    amount: bigint
  ): CallData {
    const approveAbi = [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      }
    ] as const;

    return {
      target: usdcAddress,
      allowFailure: false,
      callData: encodeFunctionData({
        abi: approveAbi,
        functionName: 'approve',
        args: [spender as `0x${string}`, amount]
      })
    };
  }

  /**
   * Creates a USDC transfer call
   */
  public createTransferCall(
    usdcAddress: string,
    recipient: string,
    amount: bigint
  ): CallData {
    const transferAbi = [
      {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      }
    ] as const;

    return {
      target: usdcAddress,
      allowFailure: false,
      callData: encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amount]
      })
    };
  }

  /**
   * Creates an openTrade call
   */
  public createOpenTradeCall(
    tradingAddress: string,
    tradeStruct: any,
    orderTypeValue: number,
    slippageUnits: bigint,
    executionFee: bigint
  ): CallData {
    const openTradeAbi = [
      {
        name: 'openTrade',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: 't',
            type: 'tuple',
            components: [
              { name: 'trader', type: 'address' },
              { name: 'pairIndex', type: 'uint256' },
              { name: 'index', type: 'uint256' },
              { name: 'initialPosToken', type: 'uint256' },
              { name: 'positionSizeUSDC', type: 'uint256' },
              { name: 'openPrice', type: 'uint256' },
              { name: 'buy', type: 'bool' },
              { name: 'leverage', type: 'uint256' },
              { name: 'tp', type: 'uint256' },
              { name: 'sl', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          },
          { name: '_type', type: 'uint8' },
          { name: '_slippageP', type: 'uint256' }
        ],
        outputs: []
      }
    ] as const;

    return {
      target: tradingAddress,
      allowFailure: false,
      callData: encodeFunctionData({
        abi: openTradeAbi,
        functionName: 'openTrade',
        args: [tradeStruct, orderTypeValue, slippageUnits]
      }),
      value: executionFee
    };
  }

  /**
   * Creates a closeTradeMarket call
   */
  public createCloseTradeCall(
    tradingAddress: string,
    pairIndex: number,
    positionIndex: number,
    amount: bigint,
    executionFee: bigint
  ): CallData {
    const closeTradeAbi = [
      {
        name: 'closeTradeMarket',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: '_pairIndex', type: 'uint256' },
          { name: '_index', type: 'uint256' },
          { name: '_amount', type: 'uint256' }
        ],
        outputs: []
      }
    ] as const;

    return {
      target: tradingAddress,
      allowFailure: false,
      callData: encodeFunctionData({
        abi: closeTradeAbi,
        functionName: 'closeTradeMarket',
        args: [BigInt(pairIndex), BigInt(positionIndex), amount]
      }),
      value: executionFee
    };
  }

  /**
   * Bundles multiple calls into a single Multicall3 transaction
   */
  public bundleCalls(
    calls: CallData[],
    description?: string[]
  ): BundledTransaction {
    if (calls.length === 0) {
      throw new TradingError(
        ErrorCode.INVALID_PARAMETER,
        'At least one call is required for bundling'
      );
    }

    // Calculate total ETH value needed
    const totalValue = calls.reduce(
      (sum, call) => sum + (call.value || 0n),
      0n
    );

    // Encode the multicall using viem
    const aggregate3Abi = [
      {
        name: 'aggregate3',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'allowFailure', type: 'bool' },
              { name: 'callData', type: 'bytes' },
              { name: 'value', type: 'uint256' }
            ]
          }
        ],
        outputs: [
          {
            name: 'returnData',
            type: 'tuple[]',
            components: [
              { name: 'success', type: 'bool' },
              { name: 'returnData', type: 'bytes' }
            ]
          }
        ]
      }
    ] as const;

    const multicallData = encodeFunctionData({
      abi: aggregate3Abi,
      functionName: 'aggregate3',
      args: [
        calls.map(call => ({
          target: call.target as `0x${string}`,
          allowFailure: call.allowFailure,
          callData: call.callData as `0x${string}`,
          value: call.value || 0n
        }))
      ]
    });

    return {
      to: this.multicallAddress,
      data: multicallData,
      value: totalValue,
      description: description || this.generateDefaultDescriptions(calls)
    };
  }

  /**
   * Bundles a trade with platform fees
   */
  public bundleTradeWithFees(params: {
    usdcAddress: string;
    tradingAddress: string;
    platformWallet: string;
    referralAddress?: string;
    totalAmount: bigint; // collateral + fees
    platformFeeAmount: bigint;
    referralFeeAmount?: bigint;
    tradeStruct: any;
    orderTypeValue: number;
    slippageUnits: bigint;
    executionFee: bigint;
  }): BundledTransaction {
    const calls: CallData[] = [];
    const descriptions: string[] = [];

    // 1. Approve USDC for total amount (collateral + fees)
    calls.push(this.createApprovalCall(
      params.usdcAddress,
      params.tradingAddress, // Trading contract needs approval for collateral
      params.totalAmount
    ));
    descriptions.push(`Approve ${params.totalAmount} USDC`);

    // 2. Transfer platform fee
    if (params.platformFeeAmount > 0n) {
      calls.push(this.createTransferCall(
        params.usdcAddress,
        params.platformWallet,
        params.platformFeeAmount
      ));
      descriptions.push(`Transfer platform fee: ${params.platformFeeAmount} USDC`);
    }

    // 3. Transfer referral fee (if applicable)
    if (params.referralAddress && params.referralFeeAmount && params.referralFeeAmount > 0n) {
      calls.push(this.createTransferCall(
        params.usdcAddress,
        params.referralAddress,
        params.referralFeeAmount
      ));
      descriptions.push(`Transfer referral fee: ${params.referralFeeAmount} USDC`);
    }

    // 4. Execute trade
    calls.push(this.createOpenTradeCall(
      params.tradingAddress,
      params.tradeStruct,
      params.orderTypeValue,
      params.slippageUnits,
      params.executionFee
    ));
    descriptions.push('Execute trade on Avantis');

    return this.bundleCalls(calls, descriptions);
  }

  /**
   * Bundles a close position with platform fees
   */
  public bundleCloseWithFees(params: {
    usdcAddress: string;
    tradingAddress: string;
    platformWallet: string;
    referralAddress?: string;
    platformFeeAmount: bigint;
    referralFeeAmount?: bigint;
    pairIndex: number;
    positionIndex: number;
    closeAmount: bigint;
    executionFee: bigint;
  }): BundledTransaction {
    const calls: CallData[] = [];
    const descriptions: string[] = [];

    // 1. Transfer platform fee (from returned collateral)
    if (params.platformFeeAmount > 0n) {
      calls.push(this.createTransferCall(
        params.usdcAddress,
        params.platformWallet,
        params.platformFeeAmount
      ));
      descriptions.push(`Transfer platform fee: ${params.platformFeeAmount} USDC`);
    }

    // 2. Transfer referral fee (if applicable)
    if (params.referralAddress && params.referralFeeAmount && params.referralFeeAmount > 0n) {
      calls.push(this.createTransferCall(
        params.usdcAddress,
        params.referralAddress,
        params.referralFeeAmount
      ));
      descriptions.push(`Transfer referral fee: ${params.referralFeeAmount} USDC`);
    }

    // 3. Close position
    calls.push(this.createCloseTradeCall(
      params.tradingAddress,
      params.pairIndex,
      params.positionIndex,
      params.closeAmount,
      params.executionFee
    ));
    descriptions.push('Close position on Avantis');

    return this.bundleCalls(calls, descriptions);
  }

  /**
   * Decodes the result of a multicall transaction
   * Note: viem provides better utilities for this, but keeping for compatibility
   */
  public decodeMulticallResult(data: string): {
    success: boolean;
    results: Array<{
      success: boolean;
      returnData: string;
    }>;
  } {
    try {
      // This would need proper ABI decoding with viem
      // For now, returning a placeholder
      throw new TradingError(
        ErrorCode.NOT_IMPLEMENTED,
        'decodeMulticallResult needs implementation with viem decodeFunctionResult'
      );
    } catch (error) {
      throw new TradingError(
        ErrorCode.CONTRACT_CALL_FAILED,
        'Failed to decode multicall result',
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Generates default descriptions for calls
   */
  private generateDefaultDescriptions(calls: CallData[]): string[] {
    return calls.map((call, index) => `Call ${index + 1} to ${call.target}`);
  }
}
