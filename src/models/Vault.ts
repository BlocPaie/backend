import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVaultTransaction {
  txHash: string;
  txType: 'deposit' | 'withdraw' | 'register' | 'execute' | 'cancel';
  amount?: string;
  contractorName?: string;
  invoiceId?: string;
  blockNumber: number;
  createdAt: Date;
}

export interface IVault extends Document {
  companyId: Types.ObjectId;
  vaultAddress: string;
  vaultType: 'erc20' | 'confidential';
  tokenAddress: string;
  deployedAtBlock: number;
  transactions: IVaultTransaction[];
  createdAt: Date;
}

const VaultTransactionSchema = new Schema<IVaultTransaction>(
  {
    txHash: { type: String, required: true },
    txType: { type: String, required: true, enum: ['deposit', 'withdraw', 'register', 'execute', 'cancel'] },
    amount: { type: String },
    contractorName: { type: String },
    invoiceId: { type: String },
    blockNumber: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VaultSchema = new Schema<IVault>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    vaultAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    vaultType: {
      type: String,
      required: true,
      enum: ['erc20', 'confidential'],
    },
    tokenAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    deployedAtBlock: {
      type: Number,
      required: true,
    },
    transactions: {
      type: [VaultTransactionSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Vault = mongoose.model<IVault>('Vault', VaultSchema);
