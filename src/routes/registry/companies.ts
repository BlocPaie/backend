import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { Company } from '../../models/Company';
import { Contractor } from '../../models/Contractor';
import { CompanyContractor } from '../../models/CompanyContractor';
import { Vault } from '../../models/Vault';
import { CreateCompanySchema } from '../../validators/registry';

const ethereumAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address');

const LinkContractorSchema = z.object({
  portoAccountAddress: ethereumAddress,
});

const router = Router();

// POST / — Create a new company (platform only)
router.post(
  '/',
  authenticate,
  requireRole('platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateCompanySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const { name, portoAccountAddress } = parseResult.data;

      const existing = await Company.findOne({
        portoAccountAddress: portoAccountAddress.toLowerCase(),
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A company with this portoAccountAddress already exists',
          },
        });
        return;
      }

      const company = new Company({ name, portoAccountAddress });
      await company.save();

      res.status(201).json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id — Get a company by ID
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Company not found',
          },
        });
        return;
      }

      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Company not found',
          },
        });
        return;
      }

      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this company',
            },
          });
          return;
        }
      }

      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/vaults — Get all vaults for a company
router.get(
  '/:id/vaults',
  authenticate,
  requireRole('company', 'platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Company not found',
          },
        });
        return;
      }

      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Company not found',
          },
        });
        return;
      }

      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this company',
            },
          });
          return;
        }
      }

      const vaults = await Vault.find({ companyId: company._id });

      res.json({ success: true, data: vaults });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/contractors — Link an existing contractor to a company
router.post(
  '/:id/contractors',
  authenticate,
  requireRole('company', 'platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company not found' },
        });
        return;
      }

      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company not found' },
        });
        return;
      }

      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this company' },
          });
          return;
        }
      }

      const parseResult = LinkContractorSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          },
        });
        return;
      }

      const contractor = await Contractor.findOne({
        portoAccountAddress: parseResult.data.portoAccountAddress.toLowerCase(),
      });
      if (!contractor) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Contractor not found. They must be registered on the platform first.',
          },
        });
        return;
      }

      const existingLink = await CompanyContractor.findOne({
        companyId: company._id,
        contractorId: contractor._id,
      });
      if (existingLink) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: 'Contractor is already registered with this company' },
        });
        return;
      }

      const link = new CompanyContractor({ companyId: company._id, contractorId: contractor._id });
      await link.save();

      res.status(201).json({ success: true, data: contractor });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/contractors — List all contractors linked to a company
router.get(
  '/:id/contractors',
  authenticate,
  requireRole('company', 'platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company not found' },
        });
        return;
      }

      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company not found' },
        });
        return;
      }

      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this company' },
          });
          return;
        }
      }

      const links = await CompanyContractor.find({ companyId: company._id }).populate('contractorId');
      const contractors = links.map((l) => l.contractorId);

      res.json({ success: true, data: contractors });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id/contractors/:contractorId — Deregister a contractor from a company
router.delete(
  '/:id/contractors/:contractorId',
  authenticate,
  requireRole('company', 'platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !mongoose.Types.ObjectId.isValid(req.params.contractorId)
      ) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company or contractor not found' },
        });
        return;
      }

      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Company not found' },
        });
        return;
      }

      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this company' },
          });
          return;
        }
      }

      const result = await CompanyContractor.findOneAndDelete({
        companyId: company._id,
        contractorId: req.params.contractorId,
      });

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contractor is not registered with this company' },
        });
        return;
      }

      res.json({ success: true, data: { message: 'Contractor deregistered successfully' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
