import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { Contractor } from '../../models/Contractor';
import { Vault } from '../../models/Vault';
import { AddressMapping } from '../../models/AddressMapping';
import { CreateAddressMappingSchema, AddressMappingQuerySchema } from '../../validators/registry';

const router = Router();

// POST / — Create a new address mapping (platform only)
router.post(
  '/',
  authenticate,
  requireRole('platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateAddressMappingSchema.safeParse(req.body);
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

      const { contractorId, vaultId, freshAddress } = parseResult.data;

      const contractor = await Contractor.findById(contractorId);
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

      if (vault.vaultType !== 'erc20') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_VAULT_TYPE',
            message: 'Address mappings can only be created for ERC20 vaults',
          },
        });
        return;
      }

      const existingMapping = await AddressMapping.findOne({ vaultId: vault._id, contractorId: contractor._id });
      if (existingMapping) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'An address mapping already exists for this vault and contractor combination',
          },
        });
        return;
      }

      const mapping = new AddressMapping({
        contractorId: contractor._id,
        vaultId: vault._id,
        freshAddress,
      });
      await mapping.save();

      res.status(201).json({ success: true, data: mapping });
    } catch (err) {
      next(err);
    }
  }
);

// GET /by-contractor — Find mapping by vaultId + contractorId
router.get(
  '/by-contractor',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = AddressMappingQuerySchema.safeParse(req.query);
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

      const { vaultId, contractorId } = parseResult.data;

      const mapping = await AddressMapping.findOne({ vaultId, contractorId });
      if (!mapping) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Address mapping not found',
          },
        });
        return;
      }

      res.json({ success: true, data: mapping });
    } catch (err) {
      next(err);
    }
  }
);

// GET /resolve/:address — Resolve a fresh address to a contractor (platform only)
router.get(
  '/resolve/:address',
  authenticate,
  requireRole('platform'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapping = await AddressMapping.findOne({
        freshAddress: req.params.address.toLowerCase(),
      }).populate('contractorId');

      if (!mapping) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No mapping found for this address',
          },
        });
        return;
      }

      res.json({ success: true, data: mapping.contractorId });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
