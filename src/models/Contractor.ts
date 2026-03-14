import mongoose, { Document, Schema } from 'mongoose';

export interface IContractor extends Document {
  name: string;
  portoAccountAddress: string;
  payoutAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ContractorSchema = new Schema<IContractor>(
  {
    name: {
      type: String,
      required: true,
    },
    portoAccountAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    payoutAddress: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Contractor = mongoose.model<IContractor>('Contractor', ContractorSchema);
