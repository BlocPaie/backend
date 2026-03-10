import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVault extends Document {
  companyId: Types.ObjectId;
  vaultAddress: string;
  vaultType: 'erc20' | 'confidential';
  tokenAddress: string;
  deployedAtBlock: number;
  createdAt: Date;
}

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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Vault = mongoose.model<IVault>('Vault', VaultSchema);
