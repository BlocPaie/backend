import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { Company } from '../../models/Company';
import { Vault } from '../../models/Vault';
import { CreateVaultSchema, CreateVaultTransactionSchema } from '../../validators/registry';

const router = Router();

// POST / — Register a vault after on-chain deployment (company or platform)
router.post(
  '/',
  authenticate,
  requireRole('company', 'platform'),
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

      // Company role: verify the companyId in the body matches their JWT identity
      if (req.user.role === 'company') {
        if (req.user.sub.toLowerCase() !== company.portoAccountAddress.toLowerCase()) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only register vaults for your own company',
            },
          });
          return;
        }
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

// POST /:address/transactions — Record a deposit/withdraw tx (company auth, frontend only)
router.post(
  '/:address/transactions',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateVaultTransactionSchema.safeParse(req.body);
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

      const vault = await Vault.findOne({ vaultAddress: req.params.address.toLowerCase() });
      if (!vault) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vault not found' },
        });
        return;
      }

      const company = await Company.findOne({ portoAccountAddress: req.user.sub.toLowerCase() });
      if (!company || company._id.toString() !== vault.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this vault' },
        });
        return;
      }

      const { txHash, txType, amount, blockNumber } = parseResult.data;

      // Idempotent — skip if already recorded
      const alreadyRecorded = vault.transactions.some((t) => t.txHash === txHash && t.txType === txType);
      if (!alreadyRecorded) {
        vault.transactions.push({ txHash, txType, amount, blockNumber, createdAt: new Date() });
        await vault.save();
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:address/transactions — List all vault transactions (company auth)
router.get(
  '/:address/transactions',
  authenticate,
  requireRole('company'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vault = await Vault.findOne({ vaultAddress: req.params.address.toLowerCase() });
      if (!vault) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Vault not found' },
        });
        return;
      }

      const company = await Company.findOne({ portoAccountAddress: req.user.sub.toLowerCase() });
      if (!company || company._id.toString() !== vault.companyId.toString()) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this vault' },
        });
        return;
      }

      const sorted = [...vault.transactions].sort((a, b) => b.blockNumber - a.blockNumber);
      res.json({ success: true, data: sorted });
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
