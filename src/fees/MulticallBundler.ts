/**
 * MulticallBundler - Handles bundling multiple transactions into a single Multicall3 transaction
 */

import { ethers } from 'ethers';
import type { 
  CallData, 
  BundledTransaction 
} from '../types/platform-fees';
import { Multicall3ContractABI } from '../contracts';
import { MULTICALL3_ADDRESS } from './constants';
import { TradingError, ErrorCode } from '../utils/errors';

export class MulticallBundler {
  private multicallAddress: string;
  private multicallInterface: ethers.Interface;

  constructor(multicallAddress?: string) {
    this.multicallAddress = multicallAddress || MULTICALL3_ADDRESS;
    this.multicallInterface = new ethers.Interface(Multicall3ContractABI);
  }

  /**
   * Creates a USDC approval call
   */
  public createApprovalCall(
    usdcAddress: string,
    spender: string,
    amount: bigint
  ): CallData {
    const usdcInterface = new ethers.Interface([
      'function approve(address spender, uint256 amount) returns (bool)'
    ]);
    
    return {
      target: usdcAddress,
      allowFailure: false,
      callData: usdcInterface.encodeFunctionData('approve', [spender, amount])
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
    const usdcInterface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    
    return {
      target: usdcAddress,
      allowFailure: false,
      callData: usdcInterface.encodeFunctionData('transfer', [recipient, amount])
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
    const tradingInterface = new ethers.Interface([
      'function openTrade(tuple(address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeUSDC, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl, uint256 timestamp) t, uint8 _type, uint256 _slippageP) payable'
    ]);
    
    return {
      target: tradingAddress,
      allowFailure: false,
      callData: tradingInterface.encodeFunctionData('openTrade', [
        tradeStruct,
        orderTypeValue,
        slippageUnits
      ]),
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
    const tradingInterface = new ethers.Interface([
      'function closeTradeMarket(uint256 _pairIndex, uint256 _index, uint256 _amount) payable'
    ]);
    
    return {
      target: tradingAddress,
      allowFailure: false,
      callData: tradingInterface.encodeFunctionData('closeTradeMarket', [
        pairIndex,
        positionIndex,
        amount
      ]),
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
    
    // Encode the multicall
    const multicallData = this.multicallInterface.encodeFunctionData('aggregate3', [
      calls.map(call => ({
        target: call.target,
        allowFailure: call.allowFailure,
        callData: call.callData,
        value: call.value || 0n
      }))
    ]);
    
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
   */
  public decodeMulticallResult(data: string): {
    success: boolean;
    results: Array<{
      success: boolean;
      returnData: string;
    }>;
  } {
    try {
      const decoded = this.multicallInterface.decodeFunctionResult('aggregate3', data);
      return {
        success: decoded[0].every((r: any) => r.success),
        results: decoded[0].map((r: any) => ({
          success: r.success,
          returnData: r.returnData
        }))
      };
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