import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/reconciliation', requireAuth, requireAdmin, reportController.getReconciliation);
router.post('/reconciliation/recalculate', requireAuth, requireAdmin, reportController.recalculateAndVerify);
router.post('/reset-zero-stock', requireAuth, requireAdmin, reportController.resetZeroStock);
router.post('/reset-live-catalog', requireAuth, requireAdmin, reportController.resetLiveCatalog);
router.get('/low-stock', requireAuth, reportController.getLowStock);
router.get('/dashboard-stats', requireAuth, reportController.getDashboardStats);
router.get('/export/inventory-csv', requireAuth, requireAdmin, reportController.exportInventoryCsv);
router.get('/export/ledger-csv', requireAuth, requireAdmin, reportController.exportLedgerCsv);

export default router;
