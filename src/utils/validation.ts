import { z } from 'zod';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';
import { ValidationError } from './errors';
import { PositionSide } from '../types';

// Custom Decimal validation
const DecimalSchema = z.union([
  z.instanceof(Decimal),
  z.number(),
  z.string()
]).transform((val) => {
  try {
    return new Decimal(val);
  } catch (error) {
    throw new ValidationError(`Invalid decimal value: ${val}`);
  }
});

// Ethereum address validation
const AddressSchema = z.string().refine(
  (val) => ethers.isAddress(val),
  { message: 'Invalid Ethereum address' }
);

// Trading pair validation
const TradingPairSchema = z.string().regex(
  /^[A-Z0-9]+\/[A-Z0-9]+$/,
  'Invalid trading pair format. Expected format: BASE/QUOTE (e.g., BTC/USD)'
);

// Position side validation
const PositionSideSchema = z.nativeEnum(PositionSide);

// Leverage validation
const LeverageSchema = z.number().min(1).max(100);

// Slippage validation (percentage)
const SlippageSchema = z.number().min(0).max(100).optional();

// Open position params validation
export const OpenPositionParamsSchema = z.object({
  pair: TradingPairSchema,
  side: PositionSideSchema,
  size: DecimalSchema,
  leverage: LeverageSchema,
  stopLoss: DecimalSchema.optional(),
  takeProfit: DecimalSchema.optional(),
  slippage: SlippageSchema,
  referrer: AddressSchema.optional()
});

// Close position params validation
export const ClosePositionParamsSchema = z.object({
  positionId: z.string().uuid(),
  size: DecimalSchema.optional(),
  slippage: SlippageSchema
});

// Update position params validation
export const UpdatePositionParamsSchema = z.object({
  positionId: z.string().uuid(),
  stopLoss: DecimalSchema.nullable().optional(),
  takeProfit: DecimalSchema.nullable().optional()
});

// Network configuration validation
export const NetworkConfigSchema = z.object({
  chainId: z.union([z.literal(8453), z.literal(84531)]),
  name: z.string(),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number()
  }),
  contracts: z.object({
    trading: AddressSchema,
    usdc: AddressSchema,
    priceFeed: AddressSchema,
    vault: AddressSchema,
    router: AddressSchema
  }),
  websocketUrl: z.string().url().optional()
});

// Private key validation
export const PrivateKeySchema = z.string().regex(
  /^0x[a-fA-F0-9]{64}$/,
  'Invalid private key format'
);

// Transaction hash validation
export const TransactionHashSchema = z.string().regex(
  /^0x[a-fA-F0-9]{64}$/,
  'Invalid transaction hash format'
);

/**
 * Validates Ethereum address
 */
export function validateAddress(address: string): void {
  try {
    AddressSchema.parse(address);
  } catch (error) {
    throw new ValidationError(`Invalid address: ${address}`, 'address');
  }
}

/**
 * Validates private key format
 */
export function validatePrivateKey(privateKey: string): void {
  try {
    PrivateKeySchema.parse(privateKey);
  } catch (error) {
    throw new ValidationError('Invalid private key format', 'privateKey');
  }
}

/**
 * Validates trading pair format
 */
export function validateTradingPair(pair: string): void {
  try {
    TradingPairSchema.parse(pair);
  } catch (error) {
    throw new ValidationError(`Invalid trading pair: ${pair}`, 'pair');
  }
}

/**
 * Validates leverage value
 */
export function validateLeverage(leverage: number, maxLeverage: number = 100): void {
  if (leverage < 1 || leverage > maxLeverage) {
    throw new ValidationError(
      `Leverage must be between 1 and ${maxLeverage}, got ${leverage}`,
      'leverage'
    );
  }
}

/**
 * Validates position size
 */
export function validatePositionSize(
  size: Decimal | number | string,
  minSize?: Decimal,
  maxSize?: Decimal
): Decimal {
  const sizeDecimal = new Decimal(size);
  
  if (sizeDecimal.lte(0)) {
    throw new ValidationError('Position size must be greater than 0', 'size');
  }
  
  if (minSize && sizeDecimal.lt(minSize)) {
    throw new ValidationError(
      `Position size must be at least ${minSize.toString()}`,
      'size'
    );
  }
  
  if (maxSize && sizeDecimal.gt(maxSize)) {
    throw new ValidationError(
      `Position size must not exceed ${maxSize.toString()}`,
      'size'
    );
  }
  
  return sizeDecimal;
}

/**
 * Validates slippage percentage
 */
export function validateSlippage(slippage?: number): number | undefined {
  if (slippage === undefined) return undefined;
  
  if (slippage < 0 || slippage > 100) {
    throw new ValidationError(
      'Slippage must be between 0 and 100 percent',
      'slippage'
    );
  }
  
  return slippage;
}

/**
 * Validates stop loss price
 */
export function validateStopLoss(
  stopLoss: Decimal | number | string | undefined,
  entryPrice: Decimal,
  isLong: boolean
): Decimal | undefined {
  if (!stopLoss) return undefined;
  
  const slDecimal = new Decimal(stopLoss);
  
  if (isLong && slDecimal.gte(entryPrice)) {
    throw new ValidationError(
      'Stop loss must be below entry price for long positions',
      'stopLoss'
    );
  }
  
  if (!isLong && slDecimal.lte(entryPrice)) {
    throw new ValidationError(
      'Stop loss must be above entry price for short positions',
      'stopLoss'
    );
  }
  
  return slDecimal;
}

/**
 * Validates take profit price
 */
export function validateTakeProfit(
  takeProfit: Decimal | number | string | undefined,
  entryPrice: Decimal,
  isLong: boolean
): Decimal | undefined {
  if (!takeProfit) return undefined;
  
  const tpDecimal = new Decimal(takeProfit);
  
  if (isLong && tpDecimal.lte(entryPrice)) {
    throw new ValidationError(
      'Take profit must be above entry price for long positions',
      'takeProfit'
    );
  }
  
  if (!isLong && tpDecimal.gte(entryPrice)) {
    throw new ValidationError(
      'Take profit must be below entry price for short positions',
      'takeProfit'
    );
  }
  
  return tpDecimal;
}

/**
 * Generic validation function using Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new ValidationError(`Validation failed: ${issues}`);
    }
    throw error;
  }
}