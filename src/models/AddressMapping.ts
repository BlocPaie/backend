import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddressMapping extends Document {
  contractorId: Types.ObjectId;
  vaultId: Types.ObjectId;
  freshAddress: string;
  createdAt: Date;
}

const AddressMappingSchema = new Schema<IAddressMapping>(
  {
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'Contractor',
      required: true,
    },
    vaultId: {
      type: Schema.Types.ObjectId,
      ref: 'Vault',
      required: true,
    },
    freshAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AddressMappingSchema.index({ vaultId: 1, contractorId: 1 }, { unique: true });

export const AddressMapping = mongoose.model<IAddressMapping>('AddressMapping', AddressMappingSchema);
