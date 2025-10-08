/**
 * Type definitions for Avantis Socket API responses
 * API Endpoint: https://socket-api.avantisfi.com/v1/data
 */

import Decimal from 'decimal.js';

export interface SocketAPIFeed {
  maxOpenDeviationP: number;
  maxCloseDeviationP: number;
  feedId: string; // bytes32 Pyth feed ID
  attributes: {
    symbol: string;
    asset_type: string;
    is_open: boolean;
    next_open: number;
    next_close: number;
    schedule: string;
  };
}

export interface SocketAPIBackupFeed {
  maxDeviationP: number;
  feedId: string; // address
}

export interface SocketAPILeverages {
  minLeverage: number;
  maxLeverage: number;
  pnlMinLeverage: number;
  pnlMaxLeverage: number;
}

export interface SocketAPIValues {
  maxGainP: number;
  maxSlP: number;
  maxLongOiP: number;
  maxShortOiP: number;
  groupOpenInterestPercentageP: number;
  maxWalletOIP: number;
  isUSDCAligned: boolean;
}

export interface SocketAPIPairTimer {
  numTiers: number;
  positionSizeToThresholdTierMap: Record<string, number>;
  thresholdTierToTimerMap: Record<string, number>;
}

export interface SocketAPIOpenInterest {
  long: number;
  short: number;
  max: number;
}

export interface SocketAPIPairInfo {
  index: number;
  from: string;
  to: string;
  feed: SocketAPIFeed;
  backupFeed: SocketAPIBackupFeed;
  spreadP: number;
  pnlSpreadP: number;
  leverages: SocketAPILeverages;
  priceImpactMultiplier: number;
  skewImpactMultiplier: number;
  groupIndex: number;
  feeIndex: number;
  values: SocketAPIValues;
  timer: SocketAPIPairTimer;
  openFeeP: number;
  closeFeeP: number;
  limitOrderFeeP: number;
  minLevPosUSDC: number;
  isPairListed: boolean;
  openInterest?: SocketAPIOpenInterest;
  pairOI?: SocketAPIOpenInterest;
  marginFee?: number;
  pnlFees?: any;
  pairParams?: any;
  storagePairParams?: any;
  blockOILimit?: any;
  longSkewConfig?: any[];
  shortSkewConfig?: any[];
  skewEqParams?: any;
  lossProtectionMultiplier?: number;
  pairSpreadP?: number;
  pairLimitOrderFeeP?: number;
  pairMinLevPosUSDC?: number;
  pairMinLeverage?: number;
  pairMaxOI?: number;
  maxWalletOI?: number;
}

export interface SocketAPIGroupInfo {
  [key: string]: {
    minLeverage: number;
    maxLeverage: number;
  };
}

export interface SocketAPIData {
  dataVersion: string;
  pairCount: number;
  pairInfos: Record<string, SocketAPIPairInfo>;
  groupInfo: SocketAPIGroupInfo;
  maxOpenInterest: Record<string, number>;
  totalOi: {
    long: number;
    short: number;
  };
  maxTradesPerPair: number;
  overrides?: any;
}

export interface SocketAPIResponse {
  data: SocketAPIData;
}
