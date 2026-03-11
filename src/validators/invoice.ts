import { z } from 'zod';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const mongoObjectIdRegex = /^[0-9a-fA-F]{24}$/;
const txHashRegex = /^0x[0-9a-fA-F]{64}$/;
const numericRegex = /^\d+(\.\d+)?$/;

const ethereumAddress = z
  .string()
  .regex(ethereumAddressRegex, 'Must be a valid Ethereum address (0x followed by 40 hex chars)');

const mongoObjectId = z
  .string()
  .regex(mongoObjectIdRegex, 'Must be a valid MongoDB ObjectId (24 hex chars)');

const txHash = z
  .string()
  .length(66, 'Transaction hash must be 66 characters')
  .regex(txHashRegex, 'Must be a valid transaction hash (0x followed by 64 hex chars)');

export const CreateInvoiceSchema = z.object({
  contractorId: mongoObjectId,
  vaultId: mongoObjectId,
  amount: z
    .string()
    .regex(numericRegex, 'Amount must be a numeric string')
    .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  currency: z.string().min(1, 'Currency is required').max(10, 'Currency must not exceed 10 characters'),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional(),
  issuedAt: z.string().datetime('issuedAt must be a valid ISO datetime string'),
});

export const ConfirmRegistrationSchema = z.object({
  txHash,
  blockNumber: z.number().positive('blockNumber must be a positive number'),
  chequeId: z.string().min(1, 'chequeId is required'),
  vaultAddress: ethereumAddress,
});

export const ConfirmPaymentSchema = z.object({
  txHash,
  blockNumber: z.number().positive('blockNumber must be a positive number'),
  chequeId: z.string().min(1, 'chequeId is required'),
  vaultAddress: ethereumAddress,
});

export const ConfirmCancellationSchema = z.object({
  txHash,
  blockNumber: z.number().positive('blockNumber must be a positive number'),
  vaultAddress: ethereumAddress,
});

export const InvoiceQuerySchema = z.object({
  companyId: z.string().optional(),
  contractorId: z.string().optional(),
  vaultId: z.string().optional(),
  status: z.enum(['pending', 'executed', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type ConfirmRegistrationInput = z.infer<typeof ConfirmRegistrationSchema>;
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;
export type ConfirmCancellationInput = z.infer<typeof ConfirmCancellationSchema>;
export type InvoiceQueryInput = z.infer<typeof InvoiceQuerySchema>;
