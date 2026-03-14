import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../../middleware/auth';
import { Contractor } from '../../models/Contractor';
import { CreateContractorSchema, SetPayoutAddressSchema } from '../../validators/registry';

const router = Router();

// POST / — Create a new contractor (public — called on first onboarding, before JWT exists)
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateContractorSchema.safeParse(req.body);
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

      const existing = await Contractor.findOne({
        portoAccountAddress: portoAccountAddress.toLowerCase(),
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A contractor with this portoAccountAddress already exists',
          },
        });
        return;
      }

      const contractor = new Contractor({ name, portoAccountAddress });
      await contractor.save();

      res.status(201).json({ success: true, data: contractor });
    } catch (err) {
      next(err);
    }
  }
);

// GET /me — Get the authenticated contractor's own profile
router.get(
  '/me',
  authenticate,
  requireRole('contractor', 'platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contractor = await Contractor.findOne({
        portoAccountAddress: req.user.sub.toLowerCase(),
      });
      if (!contractor) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contractor not found' },
        });
        return;
      }
      res.json({ success: true, data: contractor });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/payout-address — Set payout address (contractor only, own record)
router.put(
  '/:id/payout-address',
  authenticate,
  requireRole('contractor'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contractor not found' },
        });
        return;
      }

      const contractor = await Contractor.findById(req.params.id);
      if (!contractor) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contractor not found' },
        });
        return;
      }

      if (req.user.sub.toLowerCase() !== contractor.portoAccountAddress.toLowerCase()) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update your own payout address' },
        });
        return;
      }

      const parseResult = SetPayoutAddressSchema.safeParse(req.body);
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

      contractor.payoutAddress = parseResult.data.payoutAddress;
      await contractor.save();

      res.json({ success: true, data: contractor });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id — Get a contractor by ID
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
            message: 'Contractor not found',
          },
        });
        return;
      }

      const contractor = await Contractor.findById(req.params.id);
      if (!contractor) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Contractor not found',
          },
        });
        return;
      }

      if (req.user.role === 'contractor') {
        if (req.user.sub.toLowerCase() !== contractor.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this contractor',
            },
          });
          return;
        }
      }

      res.json({ success: true, data: contractor });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
