import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { OPERATION_MAX_QUANTITIES } from '../utils/mathUtils.js';

// Validator for required 24-character hex ObjectId
const requiredIdSchema = z
  .string()
  .trim()
  .min(1, 'ID is required and cannot be empty.')
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ID format: must be a 24-character hexadecimal ObjectId.',
  });

// Validator for optional ID fields that transforms "" or whitespace to undefined
const optionalIdSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return undefined;
  })
  .refine((val) => val === undefined || Types.ObjectId.isValid(val), {
    message: 'Invalid ID format: must be a 24-character hexadecimal ObjectId.',
  });

// Helper validator for ISO date string not exceeding 30 days into future
const reasonableDateSchema = z
  .string()
  .refine(
    (val) => {
      if (!val) return true;
      const parsed = new Date(val).getTime();
      if (isNaN(parsed)) return false;
      const maxFuture = Date.now() + 30 * 24 * 60 * 60 * 1000;
      return parsed <= maxFuture;
    },
    { message: 'Date cannot be more than 30 days in the future.' }
  )
  .optional();

export const purchaseBodySchema = z.object({
  itemId: requiredIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.PURCHASE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.PURCHASE.toLocaleString('en-IN')} units per purchase.`),
  supplierName: z.string().max(200, 'Supplier name cannot exceed 200 characters.').optional(),
  invoiceNumber: z.string().max(100, 'Invoice number cannot exceed 100 characters.').optional(),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters.').optional(),
  transactionDate: reasonableDateSchema,
});

export const bulkPurchaseItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.PURCHASE),
  remarks: z.string().max(500).optional(),
});

export const bulkPurchaseBodySchema = z.object({
  items: z.array(bulkPurchaseItemSchema).min(1, 'At least 1 item is required for bulk stock inward.'),
  supplierName: z.string().max(200, 'Supplier name cannot exceed 200 characters.').optional(),
  invoiceNumber: z.string().max(100, 'Invoice number cannot exceed 100 characters.').optional(),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters.').optional(),
  transactionDate: reasonableDateSchema,
});

export const issueBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: requiredIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.ISSUE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.ISSUE.toLocaleString('en-IN')} units per issue.`),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters.').optional(),
  transactionDate: reasonableDateSchema,
});

export const bulkIssueItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.ISSUE),
  remarks: z.string().max(500).optional(),
});

export const bulkIssueBodySchema = z.object({
  technicianId: requiredIdSchema,
  items: z.array(bulkIssueItemSchema).min(1, 'At least 1 item is required for bulk issue.'),
  kitName: z.string().max(200, 'Kit name cannot exceed 200 characters.').optional(),
  kitAmount: z.number().min(0, 'Kit amount cannot be negative.').optional(),
  remarks: z.string().max(500).optional(),
  transactionDate: reasonableDateSchema,
});

export const bulkReturnItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.RETURN),
  reason: z.string().max(500).optional(),
});

export const bulkReturnBodySchema = z.object({
  technicianId: requiredIdSchema,
  items: z.array(bulkReturnItemSchema).min(1, 'At least 1 item is required for bulk return.'),
  remarks: z.string().max(500).optional(),
  transactionDate: reasonableDateSchema,
});

export const usageBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: optionalIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.USAGE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.USAGE.toLocaleString('en-IN')} units per site usage.`),
  caseId: z.string().regex(/^\d{8}$/, 'Case ID must be exactly 8 digits.').optional(),
  siteName: z.string().max(300).optional(),
  jobReference: z.string().max(100, 'Job reference cannot exceed 100 characters.').optional(),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters.').optional(),
  transactionDate: reasonableDateSchema,
});

export const returnRequestBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: optionalIdSchema,
  quantity: z
    .number()
    .int('Quantity must be a positive whole integer.')
    .positive('Quantity must be greater than zero.')
    .max(OPERATION_MAX_QUANTITIES.RETURN, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.RETURN.toLocaleString('en-IN')} units per return request.`),
  reason: z.string().min(2, 'Reason for return is required and must be at least 2 characters.').max(500),
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If quantity is passed as a string representation of an integer (from some form inputs), coerce it
    if (req.body && typeof req.body.quantity === 'string') {
      const num = Number(req.body.quantity);
      if (!isNaN(num)) {
        req.body.quantity = num;
      }
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        error: 'Validation failed: ' + result.error.issues.map((e) => e.message).join(' '),
        details: errors,
      });
    }

    req.body = result.data;
    next();
  };
}
