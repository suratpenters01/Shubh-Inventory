import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

// GET /api/notifications/stream - Real-Time Server-Sent Events (SSE) Stream
router.get('/stream', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const clientId = `${user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n');

  // Register client
  notificationService.addClient(clientId, user._id, user.role, res);

  // Periodic heartbeat keep-alive every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationService.removeClient(clientId);
  });
});

// GET /api/notifications - Fetch user notifications history
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const notifications = notificationService.getNotificationsForUser(user._id, user.role);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return res.json({
    notifications,
    unreadCount,
  });
});

// PUT /api/notifications/:id/read - Mark a notification as read
router.put('/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const updated = notificationService.markAsRead(id, user._id);

  return res.json({
    success: updated,
    message: updated ? 'Notification marked as read' : 'Notification not found',
  });
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const count = notificationService.markAllAsRead(user._id, user.role);

  return res.json({
    success: true,
    markedCount: count,
  });
});

// DELETE /api/notifications/clear - Clear read notifications
router.delete('/clear', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  notificationService.clearReadNotifications(user._id, user.role);

  return res.json({
    success: true,
    message: 'Read notifications cleared',
  });
});

export default router;
