import mongoose, { Document, Schema } from 'mongoose';

export interface IContractor extends Document {
  name: string;
  portoAccountAddress: string;
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
  },
  {
    timestamps: true,
  }
);

export const Contractor = mongoose.model<IContractor>('Contractor', ContractorSchema);
