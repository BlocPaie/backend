import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanyContractor extends Document {
  companyId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CompanyContractorSchema = new Schema<ICompanyContractor>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    contractorId: { type: Schema.Types.ObjectId, ref: 'Contractor', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate active links between the same company and contractor
CompanyContractorSchema.index({ companyId: 1, contractorId: 1 }, { unique: true });

export const CompanyContractor = mongoose.model<ICompanyContractor>(
  'CompanyContractor',
  CompanyContractorSchema
);
