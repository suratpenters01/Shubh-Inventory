import { Response } from 'express';
import { INotification, NotificationType, UserRole } from '../types/index.js';
import { storageService } from './storageService.js';

interface ConnectedClient {
  id: string;
  userId: string;
  role: UserRole;
  res: Response;
}

class NotificationService {
  private clients: Map<string, ConnectedClient> = new Map();
  private notifications: INotification[] = [];
  private maxStored = 200;

  constructor() {
    // Populate active alerts on service bootstrap
    setTimeout(() => {
      this.syncInitialNotifications().catch((err) => {
        console.error('[NotificationService] Error syncing initial alerts:', err);
      });
    }, 1500);
  }

  // Register an SSE client connection
  addClient(id: string, userId: string, role: UserRole, res: Response) {
    this.clients.set(id, { id, userId, role, res });

    // Send initial snapshot of notifications for this user
    const initialList = this.getNotificationsForUser(userId, role);
    this.sendToClient(res, 'init', {
      notifications: initialList,
      unreadCount: initialList.filter((n) => !n.read).length,
    });
  }

  // Remove client upon disconnect
  removeClient(id: string) {
    this.clients.delete(id);
  }

  // Broadcast or send targeted notification
  broadcast(notification: Omit<INotification, 'id' | 'timestamp' | 'read'>): INotification {
    const newNotification: INotification = {
      ...notification,
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Store in history
    this.notifications.unshift(newNotification);
    if (this.notifications.length > this.maxStored) {
      this.notifications.pop();
    }

    // Push to matching connected clients
    for (const client of this.clients.values()) {
      if (this.isNotificationForClient(newNotification, client)) {
        this.sendToClient(client.res, 'notification', newNotification);
      }
    }

    return newNotification;
  }

  private isNotificationForClient(notif: INotification, client: ConnectedClient): boolean {
    if (notif.targetUserId && notif.targetUserId !== client.userId) {
      return false;
    }
    if (notif.targetRole === 'all') return true;
    return notif.targetRole === client.role;
  }

  private sendToClient(res: Response, event: string, data: any) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Client connection likely terminated
    }
  }

  // Get notifications for a specific user
  getNotificationsForUser(userId: string, role: UserRole): INotification[] {
    return this.notifications.filter((n) => {
      if (n.targetUserId && n.targetUserId !== userId) return false;
      if (n.targetRole === 'all') return true;
      return n.targetRole === role;
    });
  }

  // Mark single as read
  markAsRead(notificationId: string, userId: string): boolean {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  // Mark all as read for user
  markAllAsRead(userId: string, role: UserRole): number {
    let count = 0;
    for (const notif of this.notifications) {
      if (this.isNotificationForClient(notif, { id: '', userId, role, res: null as any })) {
        if (!notif.read) {
          notif.read = true;
          count++;
        }
      }
    }
    return count;
  }

  // Clear read notifications
  clearReadNotifications(userId: string, role: UserRole) {
    this.notifications = this.notifications.filter((notif) => {
      return !this.isNotificationForClient(notif, { id: '', userId, role, res: null as any }) || !notif.read;
    });
  }

  // Scan live database state on startup to populate existing low-stock and pending return alerts
  async syncInitialNotifications() {
    try {
      const [items, pendingReturns] = await Promise.all([
        storageService.listItems({ isActive: true }),
        storageService.listReturnRequests({ status: 'PENDING' }),
      ]);

      // 1. Pending returns alerts for admin
      for (const ret of pendingReturns) {
        const techName = typeof ret.technician === 'object' ? ret.technician.name : 'Field Technician';
        const itemName = typeof ret.item === 'object' ? ret.item.itemName : 'Spare part';
        const itemCode = typeof ret.item === 'object' ? ret.item.itemCode : '';

        this.notifications.push({
          id: 'init_ret_' + ret._id,
          type: 'RETURN_PENDING',
          title: `Pending Return: ${ret.quantity}x ${itemCode || itemName}`,
          message: `${techName} ne ${ret.quantity} units (${itemName}) return karne ka request bheja hai. Approval pending hai.`,
          severity: 'warning',
          targetRole: 'admin',
          timestamp: ret.requestedAt ? new Date(ret.requestedAt).toISOString() : new Date().toISOString(),
          read: false,
          actionLink: '/returns',
          metadata: { returnRequestId: ret._id, quantity: ret.quantity, itemCode },
        });
      }

      // 2. Low stock alerts for items
      for (const item of items) {
        const qty = await storageService.getWarehouseBalance(item._id);
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        if (qty <= threshold) {
          const isZero = qty === 0;
          this.notifications.push({
            id: 'init_low_' + item._id,
            type: 'LOW_STOCK',
            title: isZero ? `OUT OF STOCK: ${item.itemCode}` : `Low Stock Alert: ${item.itemCode}`,
            message: isZero
              ? `${item.itemName} godown me 0 units bacha hai! Urgent stock inward karein.`
              : `${item.itemName} sirf ${qty} ${item.unit} bacha hai (Min safety limit: ${threshold} ${item.unit}).`,
            severity: isZero ? 'critical' : 'warning',
            targetRole: 'admin',
            timestamp: new Date().toISOString(),
            read: false,
            actionLink: '/warehouse-stock',
            metadata: { itemId: item._id, itemCode: item.itemCode, currentQty: qty, threshold },
          });
        }
      }
    } catch (err) {
      console.error('[NotificationService] Error syncing initial notifications:', err);
    }
  }
}

export const notificationService = new NotificationService();
