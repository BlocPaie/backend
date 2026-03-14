import { z } from 'zod';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const mongoObjectIdRegex = /^[0-9a-fA-F]{24}$/;

const ethereumAddress = z
  .string()
  .regex(ethereumAddressRegex, 'Must be a valid Ethereum address (0x followed by 40 hex chars)');

const mongoObjectId = z
  .string()
  .regex(mongoObjectIdRegex, 'Must be a valid MongoDB ObjectId (24 hex chars)');

export const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must not exceed 255 characters'),
  portoAccountAddress: ethereumAddress,
});

export const CreateContractorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must not exceed 255 characters'),
  portoAccountAddress: ethereumAddress,
});

export const CreateVaultSchema = z.object({
  companyId: mongoObjectId,
  vaultAddress: ethereumAddress,
  vaultType: z.enum(['erc20', 'confidential']),
  tokenAddress: ethereumAddress,
  deployedAtBlock: z
    .number()
    .int('deployedAtBlock must be an integer')
    .positive('deployedAtBlock must be a positive integer'),
});

export const CreateAddressMappingSchema = z.object({
  contractorId: mongoObjectId,
  vaultId: mongoObjectId,
  freshAddress: ethereumAddress,
});

export const AddressMappingQuerySchema = z.object({
  vaultId: z.string(),
  contractorId: z.string(),
});

export const SetPayoutAddressSchema = z.object({
  payoutAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address'),
});

export const CreateVaultTransactionSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a valid tx hash'),
  txType: z.enum(['deposit', 'withdraw']),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a valid amount'),
  blockNumber: z.number().int().nonnegative(),
});

export type SetPayoutAddressInput = z.infer<typeof SetPayoutAddressSchema>;
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type CreateContractorInput = z.infer<typeof CreateContractorSchema>;
export type CreateVaultInput = z.infer<typeof CreateVaultSchema>;
export type CreateAddressMappingInput = z.infer<typeof CreateAddressMappingSchema>;
export type AddressMappingQueryInput = z.infer<typeof AddressMappingQuerySchema>;
export type CreateVaultTransactionInput = z.infer<typeof CreateVaultTransactionSchema>;
