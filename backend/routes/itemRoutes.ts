import { Router } from 'express';
import { itemController } from '../controllers/itemController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, itemController.getItems);
router.post('/', requireAuth, requireAdmin, itemController.addItem);
router.post('/bulk-update-prices', requireAuth, requireAdmin, itemController.bulkUpdatePrices);
router.put('/:id/prices', requireAuth, requireAdmin, itemController.updateItem);
router.put('/:id', requireAuth, requireAdmin, itemController.updateItem);

export default router;
