import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITransaction {
  txHash: string;
  txType: 'register' | 'execute' | 'cancel';
  blockNumber: number;
  chequeId?: string;
  vaultAddress: string;
  createdAt: Date;
}

export interface IInvoice extends Document {
  companyId: Types.ObjectId;
  contractorId: Types.ObjectId;
  vaultId: Types.ObjectId;
  amount: string;
  currency: string;
  description?: string;
  status: 'pending' | 'executed' | 'cancelled';
  invoiceHash: string;
  chequeId?: string;
  issuedAt: Date;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    txHash: {
      type: String,
      required: true,
    },
    txType: {
      type: String,
      required: true,
      enum: ['register', 'execute', 'cancel'],
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    chequeId: {
      type: String,
    },
    vaultAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'Contractor',
      required: true,
      index: true,
    },
    vaultId: {
      type: Schema.Types.ObjectId,
      ref: 'Vault',
      required: true,
      index: true,
    },
    amount: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'executed', 'cancelled'],
      default: 'pending',
    },
    invoiceHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chequeId: {
      type: String,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    transactions: {
      type: [TransactionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ 'transactions.txHash': 1 }, { unique: true, sparse: true });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
