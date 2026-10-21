/**
 * Centralized Mathematical & Quantity Precision Utility Module
 * Enforces:
 * - Whole positive integer quantities for water purifier filter spare parts
 * - Max boundary safety limits per operation type
 * - Single point of rounding for all currency / financial amounts
 */

export const OPERATION_MAX_QUANTITIES = {
  PURCHASE: 100000,
  ISSUE: 10000,
  USAGE: 50,
  RETURN: 10000,
  DAMAGE_WRITEOFF: 1000,
} as const;

export const MAX_SANE_QUANTITY = OPERATION_MAX_QUANTITIES.PURCHASE;

export interface QuantityValidationResult {
  valid: boolean;
  value: number;
  error?: string;
}

/**
 * Validates that an input is a positive whole integer (no floats, non-zero, within sane boundaries).
 * Water purifier filter cartridges and GKK spare kits are discrete physical units.
 */
export function validatePositiveWholeQuantity(
  rawQty: unknown,
  fieldName = 'Quantity',
  max: number = MAX_SANE_QUANTITY
): QuantityValidationResult {
  if (rawQty === null || rawQty === undefined || rawQty === '') {
    return { valid: false, value: 0, error: `${fieldName} is required.` };
  }

  const num = Number(rawQty);

  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, error: `${fieldName} must be a valid number.` };
  }

  if (num <= 0) {
    return { valid: false, value: 0, error: `${fieldName} must be greater than zero.` };
  }

  if (!Number.isInteger(num)) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} must be a positive whole number (e.g. 1, 5, 20). Fractions/decimals are not permitted for physical filter spares.`,
    };
  }

  if (num > max) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} exceeds maximum allowable threshold (${max.toLocaleString('en-IN')}).`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Safely sums integer quantities
 */
export function safeAddQuantity(current: number, toAdd: number): number {
  const a = Math.round(Number(current) || 0);
  const b = Math.round(Number(toAdd) || 0);
  return a + b;
}

/**
 * Safely subtracts integer quantities with negative balance guard
 */
export function safeSubtractQuantity(
  current: number,
  toDeduct: number
): { success: boolean; newBalance: number; error?: string } {
  const curr = Math.round(Number(current) || 0);
  const deduct = Math.round(Number(toDeduct) || 0);

  if (deduct > curr) {
    return {
      success: false,
      newBalance: curr,
      error: `Insufficient stock balance. Available: ${curr}, Requested: ${deduct}.`,
    };
  }

  return {
    success: true,
    newBalance: curr - deduct,
  };
}

/**
 * Single function for rounding currency/monetary amounts to two decimal places
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates stock asset valuation (Quantity * MRP unit price), rounded once at the end
 */
export function calculateValuation(quantity: number, unitPrice: number): number {
  const qty = Math.max(0, Math.round(Number(quantity) || 0));
  const price = Math.max(0, Number(unitPrice) || 0);
  return roundMoney(qty * price);
}
