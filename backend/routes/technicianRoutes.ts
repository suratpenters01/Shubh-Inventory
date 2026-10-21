import { Router } from 'express';
import { technicianController } from '../controllers/technicianController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/technicians', requireAuth, technicianController.getTechnicians);
router.post('/admin/technicians', requireAuth, requireAdmin, technicianController.addTechnician);
router.put('/admin/technicians/:id', requireAuth, requireAdmin, technicianController.updateTechnician);
router.post('/admin/technicians/:id/reset-password', requireAuth, requireAdmin, technicianController.resetPassword);
router.post('/admin/technicians/:id/toggle-status', requireAuth, requireAdmin, technicianController.toggleStatus);
router.delete('/admin/technicians/:id', requireAuth, requireAdmin, technicianController.deleteTechnician);

export default router;
