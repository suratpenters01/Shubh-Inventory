import { Router } from 'express';
import { stockController } from '../controllers/stockController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import {
  validateBody,
  purchaseBodySchema,
  bulkPurchaseBodySchema,
  issueBodySchema,
  bulkIssueBodySchema,
  bulkReturnBodySchema,
  usageBodySchema,
  returnRequestBodySchema,
} from '../schemas/stockSchemas.js';

const router = Router();

// Stock movements with strict server-side validation & idempotency protection
router.post(
  '/purchase',
  requireAuth,
  requireAdmin,
  validateBody(purchaseBodySchema),
  idempotencyMiddleware(),
  stockController.purchase
);

router.post(
  '/purchase-bulk',
  requireAuth,
  requireAdmin,
  validateBody(bulkPurchaseBodySchema),
  idempotencyMiddleware(),
  stockController.purchaseBulk
);

router.post(
  '/issue',
  requireAuth,
  requireAdmin,
  validateBody(issueBodySchema),
  idempotencyMiddleware(),
  stockController.issue
);

router.post(
  '/issue-bulk',
  requireAuth,
  requireAdmin,
  validateBody(bulkIssueBodySchema),
  idempotencyMiddleware(),
  stockController.issueBulk
);

router.post(
  '/return-bulk',
  requireAuth,
  validateBody(bulkReturnBodySchema),
  idempotencyMiddleware(),
  stockController.returnBulk
);

router.post(
  '/usage',
  requireAuth,
  validateBody(usageBodySchema),
  idempotencyMiddleware(),
  stockController.usage
);

router.post('/damage-writeoff', requireAuth, requireAdmin, stockController.damageWriteoff);

// Return requests workflow
router.post(
  '/return-request',
  requireAuth,
  validateBody(returnRequestBodySchema),
  idempotencyMiddleware(),
  stockController.createReturnRequest
);
router.get('/return-requests', requireAuth, stockController.getReturnRequests);
router.put('/return-request/:id/confirm', requireAuth, requireAdmin, stockController.confirmReturnRequest);
router.put('/return-request/:id/reject', requireAuth, requireAdmin, stockController.rejectReturnRequest);

// Balances
router.get('/warehouse-balance', requireAuth, stockController.getWarehouseBalances);
router.get('/technician-balance/:technicianId', requireAuth, stockController.getTechnicianBalance);
router.get('/technician-balance', requireAuth, stockController.getTechniciansBalanceMatrix);

// Immutable Ledger history
router.get('/ledger', requireAuth, stockController.getLedger);

export default router;
