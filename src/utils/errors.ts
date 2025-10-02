export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  
  // Trading errors
  INVALID_PAIR = 'INVALID_PAIR',
  INVALID_SIZE = 'INVALID_SIZE',
  INVALID_LEVERAGE = 'INVALID_LEVERAGE',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  MARKET_CLOSED = 'MARKET_CLOSED',
  INSUFFICIENT_COLLATERAL = 'INSUFFICIENT_COLLATERAL',
  MAX_LEVERAGE_EXCEEDED = 'MAX_LEVERAGE_EXCEEDED',
  MIN_SIZE_NOT_MET = 'MIN_SIZE_NOT_MET',
  MAX_SIZE_EXCEEDED = 'MAX_SIZE_EXCEEDED',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  
  // Authentication errors
  INVALID_SIGNER = 'INVALID_SIGNER',
  SIGNER_NOT_SET = 'SIGNER_NOT_SET',
  INVALID_PRIVATE_KEY = 'INVALID_PRIVATE_KEY',
  
  // Contract errors
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  INVALID_CONTRACT_ADDRESS = 'INVALID_CONTRACT_ADDRESS',
  
  // WebSocket errors
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  WS_MESSAGE_ERROR = 'WS_MESSAGE_ERROR',
  WS_SUBSCRIPTION_FAILED = 'WS_SUBSCRIPTION_FAILED',
  
  // Validation errors
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT'
}

export class AvantisSDKError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'AvantisSDKError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AvantisSDKError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

export class NetworkError extends AvantisSDKError {
  constructor(message: string, details?: any) {
    super(ErrorCode.NETWORK_ERROR, message, details);
    this.name = 'NetworkError';
  }
}

export class TransactionError extends AvantisSDKError {
  public readonly transactionHash?: string;
  
  constructor(code: ErrorCode, message: string, transactionHash?: string, details?: any) {
    super(code, message, { ...details, transactionHash });
    this.name = 'TransactionError';
    this.transactionHash = transactionHash;
  }
}

export class TradingError extends AvantisSDKError {
  public readonly pair?: string;
  public readonly positionId?: string;
  
  constructor(code: ErrorCode, message: string, pair?: string, positionId?: string, details?: any) {
    super(code, message, { ...details, pair, positionId });
    this.name = 'TradingError';
    this.pair = pair;
    this.positionId = positionId;
  }
}

export class ValidationError extends AvantisSDKError {
  public readonly field?: string;
  
  constructor(message: string, field?: string, details?: any) {
    super(ErrorCode.VALIDATION_FAILED, message, { ...details, field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class WebSocketError extends AvantisSDKError {
  constructor(code: ErrorCode, message: string, details?: any) {
    super(code, message, details);
    this.name = 'WebSocketError';
  }
}

export function isAvantisSDKError(error: any): error is AvantisSDKError {
  return error instanceof AvantisSDKError;
}

export function handleError(error: any): AvantisSDKError {
  if (isAvantisSDKError(error)) {
    return error;
  }
  
  // Handle ethers.js errors
  if (error?.code && typeof error.code === 'string') {
    const ethersCode = error.code;
    
    switch (ethersCode) {
      case 'INSUFFICIENT_FUNDS':
        return new TransactionError(
          ErrorCode.INSUFFICIENT_FUNDS,
          'Insufficient funds for transaction',
          undefined,
          error
        );
      case 'NETWORK_ERROR':
        return new NetworkError('Network connection failed', error);
      case 'TIMEOUT':
        return new AvantisSDKError(
          ErrorCode.OPERATION_TIMEOUT,
          'Operation timed out',
          error
        );
      case 'UNPREDICTABLE_GAS_LIMIT':
        return new TransactionError(
          ErrorCode.GAS_ESTIMATION_FAILED,
          'Failed to estimate gas for transaction',
          undefined,
          error
        );
      default:
        break;
    }
  }
  
  // Handle generic errors
  if (error instanceof Error) {
    return new AvantisSDKError(
      ErrorCode.UNKNOWN_ERROR,
      error.message,
      { originalError: error }
    );
  }
  
  return new AvantisSDKError(
    ErrorCode.UNKNOWN_ERROR,
    'An unknown error occurred',
    error
  );
}