import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { storageService } from '../services/storageService.js';
import { getStockDataAccess } from '../services/stockDataAccess.js';
import { StockError } from '../types/index.js';
import { notificationService } from '../services/notificationService.js';

export const stockController = {
  // 1. POST /api/stock/purchase
  async purchase(req: AuthRequest, res: Response) {
    try {
      const { itemId, quantity, supplierName, invoiceNumber, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();

      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const result = await dataAccess.atomicPurchase({
        itemId,
        quantity,
        supplierName: supplierName?.trim(),
        invoiceNumber: invoiceNumber?.trim(),
        performedBy: req.user!._id,
        remarks: remarks?.trim(),
        transactionDate: parsedDate,
      });

      const item = await storageService.findItemById(itemId);

      return res.status(201).json({
        message: 'Stock purchase recorded successfully',
        transaction: result.transaction,
        item,
        warehouseBalance: result.newWarehouseQty,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error recording purchase:', err);
      return res.status(500).json({ error: 'Failed to record stock purchase.' });
    }
  },

  // 1b. POST /api/stock/purchase-bulk (Direct bulk stock inward into warehouse)
  async purchaseBulk(req: AuthRequest, res: Response) {
    try {
      const { items, supplierName, invoiceNumber, remarks, transactionDate } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items array is required.' });
      }

      const dataAccess = getStockDataAccess();
      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const results: any[] = [];
      let totalQty = 0;

      for (const entry of items) {
        const itemRes = await dataAccess.atomicPurchase({
          itemId: entry.itemId,
          quantity: Number(entry.quantity),
          supplierName: supplierName?.trim() || 'Direct Supplier',
          invoiceNumber: invoiceNumber?.trim() || '',
          performedBy: req.user!._id,
          remarks: entry.remarks?.trim() || remarks?.trim() || 'Bulk warehouse inward entry',
          transactionDate: parsedDate,
        });

        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty,
        });
      }

      notificationService.broadcast({
        type: 'STOCK_INWARD',
        title: `Bulk Inward: ${items.length} items (${totalQty} units)`,
        message: `Warehouse inward receipt of ${items.length} items (${totalQty} units) recorded from ${supplierName || 'supplier'}.`,
        severity: 'success',
        targetRole: 'admin',
        actionLink: '/warehouse-stock',
        metadata: { totalItems: items.length, totalQty },
      });

      return res.status(201).json({
        message: `Successfully received ${items.length} items (${totalQty} units) into warehouse`,
        totalItems: items.length,
        totalQuantity: totalQty,
        results,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error in bulk purchase:', err);
      return res.status(500).json({ error: err.message || 'Failed to record bulk stock inward.' });
    }
  },
  async issue(req: AuthRequest, res: Response) {
    try {
      const { itemId, technicianId, quantity, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();

      const parsedIssueDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const result = await dataAccess.atomicIssue({
        itemId,
        technicianId,
        quantity,
        performedBy: req.user!._id,
        remarks: remarks?.trim(),
        transactionDate: parsedIssueDate,
      });

      const [item, technician] = await Promise.all([
        storageService.findItemById(itemId),
        storageService.findUserById(technicianId),
      ]);

      // Real-Time Notification 1: Alert technician about received stock
      if (technician) {
        notificationService.broadcast({
          type: 'STOCK_ISSUED',
          title: `Stock Received: ${result.transaction.quantity}x ${item?.itemCode || 'parts'}`,
          message: `Godown Manager ne aapke hand stock me ${result.transaction.quantity} ${item?.unit || 'units'} (${item?.itemName}) transfer kiye hain.`,
          severity: 'info',
          targetRole: 'technician',
          targetUserId: technicianId,
          actionLink: '/my-stock',
          metadata: { itemId, quantity: result.transaction.quantity, newTechQty: result.newTechQty },
        });
      }

      // Real-Time Notification 2: If warehouse balance dropped to or below threshold, alert admins
      const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
      if (result.newWarehouseQty <= threshold) {
        const isZero = result.newWarehouseQty === 0;
        notificationService.broadcast({
          type: 'LOW_STOCK',
          title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
          message: isZero
            ? `${item?.itemName} godown me 0 units bacha hai! Urgent stock inward karein.`
            : `${item?.itemName} sirf ${result.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
          severity: isZero ? 'critical' : 'warning',
          targetRole: 'admin',
          actionLink: '/warehouse-stock',
          metadata: { itemId, itemCode: item?.itemCode, currentQty: result.newWarehouseQty, threshold },
        });
      }

      return res.status(201).json({
        message: 'Stock issued to technician successfully',
        transaction: result.transaction,
        item,
        technician: technician ? { id: technician._id, name: technician.name } : { id: technicianId },
        warehouseBalance: result.newWarehouseQty,
        technicianBalance: result.newTechQty,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error issuing stock:', err);
      return res.status(500).json({ error: 'Failed to issue stock to technician.' });
    }
  },

  // 2b. POST /api/stock/issue-bulk
  async issueBulk(req: AuthRequest, res: Response) {
    try {
      const { technicianId, items, remarks, transactionDate, kitName, kitAmount } = req.body;
      if (!technicianId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'technicianId and items array are required.' });
      }

      const dataAccess = getStockDataAccess();
      const parsedIssueDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const technician = await storageService.findUserById(technicianId);
      if (!technician) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const parsedKitAmount = kitAmount !== undefined && kitAmount !== null && !isNaN(Number(kitAmount))
        ? Number(kitAmount)
        : undefined;

      const results: any[] = [];
      let totalQty = 0;

      for (const entry of items) {
        const itemRes = await dataAccess.atomicIssue({
          itemId: entry.itemId,
          technicianId,
          quantity: Number(entry.quantity),
          performedBy: req.user!._id,
          remarks: entry.remarks?.trim() || remarks?.trim() || (kitName ? `Kit: ${kitName}` : 'Bulk stock dispatch to technician'),
          kitName: kitName?.trim() || undefined,
          kitAmount: parsedKitAmount,
          transactionDate: parsedIssueDate,
        });

        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty,
          technicianBalance: itemRes.newTechQty,
        });

        const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
        if (itemRes.newWarehouseQty <= threshold) {
          const isZero = itemRes.newWarehouseQty === 0;
          notificationService.broadcast({
            type: 'LOW_STOCK',
            title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
            message: isZero
              ? `${item?.itemName} godown me 0 units bacha hai! Urgent stock inward karein.`
              : `${item?.itemName} sirf ${itemRes.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
            severity: isZero ? 'critical' : 'warning',
            targetRole: 'admin',
            actionLink: '/warehouse-stock',
            metadata: { itemId: entry.itemId, itemCode: item?.itemCode, currentQty: itemRes.newWarehouseQty, threshold },
          });
        }
      }

      notificationService.broadcast({
        type: 'STOCK_ISSUED',
        title: `Bulk Stock Received: ${items.length} items (${totalQty} units)`,
        message: `Godown Manager ne aapke hand stock me ${items.length} items (Total: ${totalQty} units) transfer kiye hain.`,
        severity: 'info',
        targetRole: 'technician',
        targetUserId: technicianId,
        actionLink: '/my-stock',
        metadata: { totalItems: items.length, totalQty },
      });

      return res.status(201).json({
        message: kitName
          ? `Successfully issued Kit "${kitName}" (${items.length} items, ${totalQty} units) to ${technician.name}`
          : `Successfully issued ${items.length} items (${totalQty} units) to ${technician.name}`,
        technician: { id: technician._id, name: technician.name },
        kitName: kitName?.trim() || undefined,
        kitAmount: parsedKitAmount,
        totalItems: items.length,
        totalQuantity: totalQty,
        results,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error in bulk issue:', err);
      return res.status(500).json({ error: err.message || 'Failed to issue stock in bulk.' });
    }
  },

  // 3. POST /api/stock/usage
  async usage(req: AuthRequest, res: Response) {
    try {
      const { itemId, technicianId: bodyTechId, quantity, siteName, jobReference, caseId, remarks, transactionDate } = req.body;
      const targetTechId = req.user!.role === 'technician' ? req.user!._id : bodyTechId;

      if (!targetTechId) {
        return res.status(400).json({ error: 'Technician ID is required for logging usage.' });
      }

      const parsedUsageDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const effectiveJobRef = (caseId?.trim() || jobReference?.trim() || '');
      const effectiveSite = siteName?.trim() || (effectiveJobRef ? `Case #${effectiveJobRef}` : 'On-Site Service');

      const dataAccess = getStockDataAccess();
      const result = await dataAccess.atomicUsage({
        itemId,
        technicianId: targetTechId,
        quantity,
        siteName: effectiveSite,
        jobReference: effectiveJobRef,
        performedBy: req.user!._id,
        remarks: remarks?.trim(),
        transactionDate: parsedUsageDate,
      });

      const [item, technician] = await Promise.all([
        storageService.findItemById(itemId),
        storageService.findUserById(targetTechId),
      ]);

      return res.status(201).json({
        message: 'On-site stock usage logged successfully',
        transaction: result.transaction,
        item,
        technician: technician ? { id: technician._id, name: technician.name } : { id: targetTechId },
        technicianBalance: result.newTechQty,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error logging stock usage:', err);
      return res.status(500).json({ error: 'Failed to log stock usage.' });
    }
  },

  // 4. POST /api/stock/return-request (Technician submits return)
  async createReturnRequest(req: AuthRequest, res: Response) {
    try {
      const { itemId, quantity, reason, technicianId: bodyTechId } = req.body;
      const techId = req.user!.role === 'technician' ? req.user!._id : (bodyTechId || req.user!._id);

      const dataAccess = getStockDataAccess();
      const returnReq = await dataAccess.atomicCreateReturnRequest({
        technicianId: techId,
        itemId,
        quantity,
        reason: reason.trim(),
      });

      // Real-Time Notification: Alert admins of new pending return
      const item = await storageService.findItemById(itemId);
      notificationService.broadcast({
        type: 'RETURN_PENDING',
        title: `Pending Return: ${returnReq.quantity}x ${item?.itemCode || 'parts'}`,
        message: `${req.user!.name} ne ${returnReq.quantity} units (${item?.itemName || 'spare'}) return karne ka request submit kiya hai. Approval karein.`,
        severity: 'warning',
        targetRole: 'admin',
        actionLink: '/returns',
        metadata: { returnRequestId: returnReq._id, quantity: returnReq.quantity, technicianId: techId },
      });

      return res.status(201).json({
        message: 'Return request submitted successfully. Awaiting warehouse admin confirmation.',
        returnRequest: returnReq,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error creating return request:', err);
      return res.status(500).json({ error: 'Failed to submit return request.' });
    }
  },

  // 4b. POST /api/stock/return-bulk (Direct bulk return from technician into warehouse)
  async returnBulk(req: AuthRequest, res: Response) {
    try {
      const { technicianId: bodyTechId, items, remarks, transactionDate } = req.body;
      const targetTechId = req.user!.role === 'technician' ? req.user!._id : (bodyTechId || req.user!._id);

      if (!targetTechId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'technicianId and items array are required.' });
      }

      const dataAccess = getStockDataAccess();
      const parsedReturnDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const technician = await storageService.findUserById(targetTechId);
      if (!technician) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const results: any[] = [];
      let totalQty = 0;

      for (const entry of items) {
        const itemRes = await dataAccess.atomicDirectReturn({
          itemId: entry.itemId,
          technicianId: targetTechId,
          quantity: Number(entry.quantity),
          performedBy: req.user!._id,
          reason: entry.reason?.trim() || remarks?.trim() || 'Bulk stock return to central warehouse',
          remarks: remarks?.trim() || '',
          transactionDate: parsedReturnDate,
        });

        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty,
          technicianBalance: itemRes.newTechQty,
        });
      }

      notificationService.broadcast({
        type: 'RETURN_CONFIRMED',
        title: `Bulk Return Received: ${items.length} items (${totalQty} units)`,
        message: `Successfully received ${items.length} items (${totalQty} units) from ${technician.name} into central warehouse inventory.`,
        severity: 'success',
        targetRole: 'admin',
        actionLink: '/warehouse-stock',
        metadata: { technicianId: targetTechId, totalItems: items.length, totalQty },
      });

      return res.status(201).json({
        message: `Successfully returned ${items.length} items (${totalQty} units) from ${technician.name} to warehouse`,
        technician: { id: technician._id, name: technician.name },
        totalItems: items.length,
        totalQuantity: totalQty,
        results,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error in bulk return:', err);
      return res.status(500).json({ error: err.message || 'Failed to return stock in bulk.' });
    }
  },

  // 5. GET /api/stock/return-requests
  async getReturnRequests(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;
      const filter: any = {};
      if (status) filter.status = status as string;

      // If technician, view only own return requests
      if (req.user!.role === 'technician') {
        filter.technicianId = req.user!._id;
      }

      const list = await storageService.listReturnRequests(filter);
      return res.json({ returnRequests: list });
    } catch (err: any) {
      console.error('Error fetching return requests:', err);
      return res.status(500).json({ error: 'Failed to fetch return requests.' });
    }
  },

  // 6. PUT /api/stock/return-request/:id/confirm (Admin confirms return)
  async confirmReturnRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const dataAccess = getStockDataAccess();

      const result = await dataAccess.atomicConfirmReturn({
        returnRequestId: id,
        confirmedBy: req.user!._id,
      });

      // Real-Time Notification: Alert the technician that return was confirmed
      const techId = typeof result.returnRequest.technician === 'object'
        ? (result.returnRequest.technician as any)._id
        : result.returnRequest.technician;
      const returnItem = typeof result.returnRequest.item === 'object'
        ? (result.returnRequest.item as any)
        : await storageService.findItemById(result.returnRequest.item as string);

      notificationService.broadcast({
        type: 'RETURN_CONFIRMED',
        title: `Return Approved: ${result.returnRequest.quantity}x ${returnItem?.itemCode || 'units'}`,
        message: `Godown Manager Suresh Verma ne aapka return request approve kar liya hai. Units warehouse stock me wapas add ho gaye hain.`,
        severity: 'success',
        targetRole: 'technician',
        targetUserId: techId?.toString(),
        actionLink: '/returns',
        metadata: { returnRequestId: id, quantity: result.returnRequest.quantity },
      });

      return res.json({
        message: 'Return confirmed and stock safely added back to warehouse.',
        returnRequest: result.returnRequest,
        transaction: result.transaction,
        warehouseBalance: result.newWarehouseQty,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error confirming return request:', err);
      return res.status(500).json({ error: 'Failed to confirm return request.' });
    }
  },

  // 7. PUT /api/stock/return-request/:id/reject
  async rejectReturnRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const returnReq = await storageService.findReturnRequestById(id);
      if (!returnReq) {
        return res.status(404).json({ error: 'Return request not found.' });
      }

      if (returnReq.status !== 'PENDING') {
        return res.status(400).json({ error: `Return request is already marked as ${returnReq.status}.` });
      }

      const updated = await storageService.updateReturnRequest(id, {
        status: 'REJECTED',
        rejectionReason: reason?.trim() || 'Rejected by warehouse admin',
        confirmedBy: req.user!._id,
        confirmedAt: new Date(),
      });

      // Real-Time Notification: Alert the technician that return was rejected
      const techId = typeof returnReq.technician === 'object'
        ? (returnReq.technician as any)._id
        : returnReq.technician;
      notificationService.broadcast({
        type: 'RETURN_REJECTED',
        title: `Return Request Rejected`,
        message: `Aapka return request reject kar diya gaya hai. Reason: ${reason?.trim() || 'Not approved by admin'}.`,
        severity: 'critical',
        targetRole: 'technician',
        targetUserId: techId?.toString(),
        actionLink: '/returns',
        metadata: { returnRequestId: id, reason },
      });

      return res.json({
        message: 'Return request rejected.',
        returnRequest: updated,
      });
    } catch (err: any) {
      console.error('Error rejecting return request:', err);
      return res.status(500).json({ error: 'Failed to reject return request.' });
    }
  },

  // 8. POST /api/stock/damage-writeoff
  async damageWriteoff(req: AuthRequest, res: Response) {
    try {
      const { itemId, quantity, reason, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();

      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime())
        ? new Date(transactionDate)
        : new Date();

      const result = await dataAccess.atomicDamageWriteoff({
        itemId,
        quantity,
        reason: reason?.trim(),
        performedBy: req.user!._id,
        remarks: remarks?.trim(),
        transactionDate: parsedDate,
      });

      // Real-Time Notification: If damage write-off dropped warehouse stock to or below threshold, alert admins
      const item = await storageService.findItemById(itemId);
      const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
      if (result.newWarehouseQty <= threshold) {
        const isZero = result.newWarehouseQty === 0;
        notificationService.broadcast({
          type: 'LOW_STOCK',
          title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
          message: isZero
            ? `${item?.itemName} godown me 0 units bacha hai! Damage write-off ke baad balance khatam ho gaya.`
            : `${item?.itemName} damage write-off ke baad sirf ${result.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
          severity: isZero ? 'critical' : 'warning',
          targetRole: 'admin',
          actionLink: '/warehouse-stock',
          metadata: { itemId, itemCode: item?.itemCode, currentQty: result.newWarehouseQty, threshold },
        });
      }

      return res.status(201).json({
        message: 'Damage write-off recorded successfully in ledger',
        transaction: result.transaction,
        warehouseBalance: result.newWarehouseQty,
      });
    } catch (err: any) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error('Error recording damage writeoff:', err);
      return res.status(500).json({ error: 'Failed to record damage write-off.' });
    }
  },

  // 9. GET /api/stock/warehouse-balance
  async getWarehouseBalances(req: AuthRequest, res: Response) {
    try {
      const balances = await storageService.getAllWarehouseBalances();
      return res.json({ balances });
    } catch (err: any) {
      console.error('Error fetching warehouse balances:', err);
      return res.status(500).json({ error: 'Failed to retrieve warehouse balances.' });
    }
  },

  // 10. GET /api/stock/technician-balance/:technicianId
  async getTechnicianBalance(req: AuthRequest, res: Response) {
    try {
      const { technicianId } = req.params;

      // If logged in as technician, they can only see their own balance
      if (req.user!.role === 'technician' && req.user!._id !== technicianId) {
        return res.status(403).json({ error: 'Access denied: You can only view your own stock balance.' });
      }

      const technician = await storageService.findUserById(technicianId);
      if (!technician) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const balances = await storageService.getBalancesForTechnician(technicianId);
      return res.json({
        technician: {
          id: technician._id,
          name: technician.name,
          phone: technician.phone,
        },
        balances,
      });
    } catch (err: any) {
      console.error('Error fetching technician balance:', err);
      return res.status(500).json({ error: 'Failed to retrieve technician balance.' });
    }
  },

  // 11. GET /api/stock/technician-balance (Matrix view)
  async getTechniciansBalanceMatrix(req: AuthRequest, res: Response) {
    try {
      const data = await storageService.getAllTechnicianBalancesMatrix();
      return res.json(data);
    } catch (err: any) {
      console.error('Error fetching technicians balance matrix:', err);
      return res.status(500).json({ error: 'Failed to retrieve technician balance matrix.' });
    }
  },

  // 12. GET /api/stock/ledger
  async getLedger(req: AuthRequest, res: Response) {
    try {
      const { itemId, technicianId, type, fromDate, toDate, limit } = req.query;

      // If technician, filter by self unless admin
      let targetTechId = technicianId as string;
      if (req.user!.role === 'technician') {
        targetTechId = req.user!._id;
      }

      const transactions = await storageService.listStockTransactions({
        itemId: itemId as string,
        technicianId: targetTechId,
        type: type as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json({ transactions });
    } catch (err: any) {
      console.error('Error fetching ledger history:', err);
      return res.status(500).json({ error: 'Failed to retrieve ledger transactions.' });
    }
  },
};
