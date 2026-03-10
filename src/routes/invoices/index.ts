import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../../middleware/auth';
import { Company } from '../../models/Company';
import { Contractor } from '../../models/Contractor';
import { Vault } from '../../models/Vault';
import { Invoice } from '../../models/Invoice';
import { computeInvoiceHash } from '../../utils/hash';
import {
  CreateInvoiceSchema,
  ConfirmRegistrationSchema,
  ConfirmPaymentSchema,
  ConfirmCancellationSchema,
  InvoiceQuerySchema,
} from '../../validators/invoice';

const router = Router();

// POST / — Create a new invoice (contractor only)
router.post(
  '/',
  authenticate,
  requireRole('contractor'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateInvoiceSchema.safeParse(req.body);
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

      const { companyId, vaultId, amount, currency, description, issuedAt } = parseResult.data;

      // Resolve contractor from JWT sub (portoAccountAddress)
      const contractor = await Contractor.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!contractor) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Contractor not found for the authenticated address',
          },
        });
        return;
      }

      // Check company exists
      const company = await Company.findById(companyId);
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

      // Check vault exists and belongs to the company
      const vault = await Vault.findById(vaultId);
      if (!vault) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Vault not found',
          },
        });
        return;
      }

      if (vault.companyId.toString() !== company._id.toString()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_VAULT',
            message: 'Vault does not belong to the specified company',
          },
        });
        return;
      }

      // Generate invoice _id
      const invoiceId = new mongoose.Types.ObjectId();

      // Compute invoice hash
      const issuedAtDate = new Date(issuedAt);
      const invoiceHash = computeInvoiceHash(
        invoiceId.toString(),
        company._id.toString(),
        contractor._id.toString(),
        amount,
        currency,
        issuedAtDate
      );

      const invoice = new Invoice({
        _id: invoiceId,
        companyId: company._id,
        contractorId: contractor._id,
        vaultId: vault._id,
        amount,
        currency,
        description,
        status: 'draft',
        invoiceHash,
        issuedAt: issuedAtDate,
      });

      await invoice.save();

      res.status(201).json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// GET / — List invoices with filtering and pagination
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = InvoiceQuerySchema.safeParse(req.query);
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

      const { companyId, contractorId, vaultId, status, page, limit } = parseResult.data;

      // Build base filter from provided query params
      const filter: Record<string, unknown> = {};

      if (companyId) filter.companyId = companyId;
      if (contractorId) filter.contractorId = contractorId;
      if (vaultId) filter.vaultId = vaultId;
      if (status) filter.status = status;

      // Enforce role-based filtering
      if (req.user.role === 'company') {
        const company = await Company.findOne({
          portoAccountAddress: req.user.sub.toLowerCase(),
        });
        if (!company) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Company not found for the authenticated address',
            },
          });
          return;
        }
        // Override any provided companyId — company can only see their own invoices
        filter.companyId = company._id;
      } else if (req.user.role === 'contractor') {
        const contractor = await Contractor.findOne({
          portoAccountAddress: req.user.sub.toLowerCase(),
        });
        if (!contractor) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Contractor not found for the authenticated address',
            },
          });
          return;
        }
        // Override any provided contractorId — contractor can only see their own invoices
        filter.contractorId = contractor._id;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        Invoice.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
        Invoice.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          invoices,
          total,
          page,
          limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id — Get an invoice by ID
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
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check access based on role
      if (req.user.role === 'company') {
        const company = await Company.findOne({
          portoAccountAddress: req.user.sub.toLowerCase(),
        });
        if (!company || company._id.toString() !== invoice.companyId.toString()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this invoice',
            },
          });
          return;
        }
      } else if (req.user.role === 'contractor') {
        const contractor = await Contractor.findOne({
          portoAccountAddress: req.user.sub.toLowerCase(),
        });
        if (!contractor || contractor._id.toString() !== invoice.contractorId.toString()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this invoice',
            },
          });
          return;
        }
      }

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/approve — Approve a draft invoice (company only)
router.post(
  '/:id/approve',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check company access
      const company = await Company.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!company || company._id.toString() !== invoice.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this invoice',
          },
        });
        return;
      }

      if (invoice.status !== 'draft') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot approve invoice with status '${invoice.status}'. Invoice must be in 'draft' status.`,
          },
        });
        return;
      }

      invoice.status = 'approved';
      await invoice.save();

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/reject — Reject a draft invoice (company only)
router.post(
  '/:id/reject',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check company access
      const company = await Company.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!company || company._id.toString() !== invoice.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this invoice',
          },
        });
        return;
      }

      if (invoice.status !== 'draft') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot reject invoice with status '${invoice.status}'. Invoice must be in 'draft' status.`,
          },
        });
        return;
      }

      invoice.status = 'rejected';
      await invoice.save();

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/hash — Get invoice hash
router.get(
  '/:id/hash',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          invoiceId: invoice._id,
          invoiceHash: invoice.invoiceHash,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/confirm-registration — Confirm invoice registered on-chain (company only)
router.post(
  '/:id/confirm-registration',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = ConfirmRegistrationSchema.safeParse(req.body);
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

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check company access
      const company = await Company.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!company || company._id.toString() !== invoice.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this invoice',
          },
        });
        return;
      }

      if (invoice.status !== 'approved') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot confirm registration for invoice with status '${invoice.status}'. Invoice must be in 'approved' status.`,
          },
        });
        return;
      }

      const { txHash, blockNumber, chequeId, vaultAddress } = parseResult.data;

      // Check txHash uniqueness across all invoices
      const existingTx = await Invoice.findOne({ 'transactions.txHash': txHash });
      if (existingTx) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This transaction hash has already been recorded',
          },
        });
        return;
      }

      invoice.status = 'registered';
      invoice.chequeId = chequeId;
      invoice.transactions.push({
        txHash,
        txType: 'register',
        blockNumber,
        chequeId,
        vaultAddress,
        createdAt: new Date(),
      });

      await invoice.save();

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/confirm-payment — Confirm invoice paid on-chain (contractor only)
router.post(
  '/:id/confirm-payment',
  authenticate,
  requireRole('contractor'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = ConfirmPaymentSchema.safeParse(req.body);
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

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check contractor access
      const contractor = await Contractor.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!contractor || contractor._id.toString() !== invoice.contractorId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this invoice',
          },
        });
        return;
      }

      if (invoice.status !== 'registered') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot confirm payment for invoice with status '${invoice.status}'. Invoice must be in 'registered' status.`,
          },
        });
        return;
      }

      const { txHash, blockNumber, chequeId, vaultAddress } = parseResult.data;

      // Check txHash uniqueness across all invoices
      const existingTx = await Invoice.findOne({ 'transactions.txHash': txHash });
      if (existingTx) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This transaction hash has already been recorded',
          },
        });
        return;
      }

      invoice.status = 'paid';
      invoice.transactions.push({
        txHash,
        txType: 'execute',
        blockNumber,
        chequeId,
        vaultAddress,
        createdAt: new Date(),
      });

      await invoice.save();

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/confirm-cancellation — Confirm invoice cancelled on-chain (company only)
router.post(
  '/:id/confirm-cancellation',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = ConfirmCancellationSchema.safeParse(req.body);
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

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          },
        });
        return;
      }

      // Check company access
      const company = await Company.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!company || company._id.toString() !== invoice.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this invoice',
          },
        });
        return;
      }

      if (invoice.status !== 'registered') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot confirm cancellation for invoice with status '${invoice.status}'. Invoice must be in 'registered' status.`,
          },
        });
        return;
      }

      const { txHash, blockNumber, vaultAddress } = parseResult.data;

      // Check txHash uniqueness across all invoices
      const existingTx = await Invoice.findOne({ 'transactions.txHash': txHash });
      if (existingTx) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This transaction hash has already been recorded',
          },
        });
        return;
      }

      invoice.status = 'cancelled';
      invoice.transactions.push({
        txHash,
        txType: 'cancel',
        blockNumber,
        vaultAddress,
        createdAt: new Date(),
      });

      await invoice.save();

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
