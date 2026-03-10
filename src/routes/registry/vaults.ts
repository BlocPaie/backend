import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { Company } from '../../models/Company';
import { Vault } from '../../models/Vault';
import { CreateVaultSchema } from '../../validators/registry';

const router = Router();

// POST / — Create a new vault (platform only)
router.post(
  '/',
  authenticate,
  requireRole('platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateVaultSchema.safeParse(req.body);
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

      const { companyId, vaultAddress, vaultType, tokenAddress, deployedAtBlock } = parseResult.data;

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

      const existingVault = await Vault.findOne({
        vaultAddress: vaultAddress.toLowerCase(),
      });
      if (existingVault) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A vault with this address already exists',
          },
        });
        return;
      }

      const vault = new Vault({
        companyId: company._id,
        vaultAddress,
        vaultType,
        tokenAddress,
        deployedAtBlock,
      });
      await vault.save();

      res.status(201).json({ success: true, data: vault });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:address — Get a vault by address
router.get(
  '/:address',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vault = await Vault.findOne({
        vaultAddress: req.params.address.toLowerCase(),
      });

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

      res.json({ success: true, data: vault });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
