import { Request, Response } from 'express';
import { storageService } from '../services/storageService.js';
import { IStockTransaction } from '../types/index.js';
import { resetAndSeedPureitData, resetToZeroStock } from '../seed.js';

export const reportController = {
  // POST /api/reports/reset-zero-stock
  async resetZeroStock(req: Request, res: Response) {
    try {
      await resetToZeroStock();
      const data = await storageService.computeReconciliation(true);
      return res.json({
        message: 'All stock has been set to ZERO (0). Authentic Pureit catalog & technician accounts are ready for manual entries.',
        ...data,
      });
    } catch (err: any) {
      console.error('Error resetting to zero stock:', err);
      return res.status(500).json({ error: 'Failed to reset all stock to zero.' });
    }
  },

  // POST /api/reports/reset-live-catalog
  async resetLiveCatalog(req: Request, res: Response) {
    try {
      await resetAndSeedPureitData(true);
      const data = await storageService.computeReconciliation(true);
      return res.json({
        message: 'Database purged of dummy data and successfully populated with live Pureit catalog and ledger.',
        ...data,
      });
    } catch (err: any) {
      console.error('Error resetting to live Pureit catalog:', err);
      return res.status(500).json({ error: 'Failed to reset database with live Pureit catalog.' });
    }
  },

  // GET /api/reports/reconciliation
  async getReconciliation(req: Request, res: Response) {
    try {
      const data = await storageService.computeReconciliation(false);
      return res.json(data);
    } catch (err: any) {
      console.error('Error computing reconciliation:', err);
      return res.status(500).json({ error: 'Failed to compute reconciliation audit report.' });
    }
  },

  // POST /api/reports/reconciliation/recalculate
  async recalculateAndVerify(req: Request, res: Response) {
    try {
      const { resync } = req.body;
      const shouldResync = resync !== undefined ? Boolean(resync) : true;
      const data = await storageService.computeReconciliation(shouldResync);
      return res.json({
        message: shouldResync
          ? 'Ledger independently re-summed and verified. Cached balances synchronized.'
          : 'Ledger independently re-summed and verified against cached balances.',
        ...data,
      });
    } catch (err: any) {
      console.error('Error recalculating from ledger:', err);
      return res.status(500).json({ error: 'Failed to recalculate and verify from ledger.' });
    }
  },

  // GET /api/reports/low-stock
  async getLowStock(req: Request, res: Response) {
    try {
      const items = await storageService.listItems({ isActive: true });
      const lowStockItems: any[] = [];

      for (const item of items) {
        const warehouseQty = await storageService.getWarehouseBalance(item._id);
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        if (warehouseQty <= threshold) {
          lowStockItems.push({
            ...item,
            warehouseQty,
            lowStockThreshold: threshold,
            reorderLevel: threshold,
            deficit: Math.max(0, threshold - warehouseQty),
            urgency: warehouseQty === 0 ? 'CRITICAL_OUT_OF_STOCK' : 'BELOW_THRESHOLD',
          });
        }
      }

      // Sort by critical (0 stock) first, then greatest deficit
      lowStockItems.sort((a, b) => {
        if (a.warehouseQty === 0 && b.warehouseQty > 0) return -1;
        if (b.warehouseQty === 0 && a.warehouseQty > 0) return 1;
        return b.deficit - a.deficit;
      });

      return res.json({
        count: lowStockItems.length,
        items: lowStockItems,
      });
    } catch (err: any) {
      console.error('Error fetching low stock report:', err);
      return res.status(500).json({ error: 'Failed to retrieve low-stock report.' });
    }
  },

  // GET /api/reports/dashboard-stats
  async getDashboardStats(req: Request, res: Response) {
    try {
      const [items, technicians, warehouseBalances, returnRequests] = await Promise.all([
        storageService.listItems({ isActive: true }),
        storageService.listTechnicians(),
        storageService.getAllWarehouseBalances(),
        storageService.listReturnRequests({ status: 'PENDING' }),
      ]);

      const totalItems = items.length;
      const activeTechnicians = technicians.length;
      const pendingReturnsCount = returnRequests.length;

      let totalWarehouseQty = 0;
      let lowStockCount = 0;
      const lowStockItems: any[] = [];

      for (const item of items) {
        const balEntry = warehouseBalances.find((b) => {
          const bItemId = typeof b.item === 'string' ? b.item : (b.item as any)?._id;
          return bItemId === item._id;
        });
        const bal = balEntry?.quantity ?? 0;
        totalWarehouseQty += bal;
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        if (bal <= threshold) {
          lowStockCount++;
          lowStockItems.push({
            ...item,
            warehouseQty: bal,
            lowStockThreshold: threshold,
            reorderLevel: threshold,
            deficit: Math.max(0, threshold - bal),
            urgency: bal === 0 ? 'CRITICAL_OUT_OF_STOCK' : 'BELOW_THRESHOLD',
          });
        }
      }

      // Sort critical 0 stock first, then largest deficit
      lowStockItems.sort((a, b) => {
        if (a.warehouseQty === 0 && b.warehouseQty > 0) return -1;
        if (b.warehouseQty === 0 && a.warehouseQty > 0) return 1;
        return b.deficit - a.deficit;
      });

      // Compute stock issued this month per technician for Recharts bar chart
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const recentTransactions = await storageService.listStockTransactions({
        type: 'ISSUE_TO_TECH',
        fromDate: startOfMonth.toISOString(),
      });

      const techIssueMap: Record<string, { techName: string; totalQty: number; txCount: number }> = {};

      for (const tech of technicians) {
        techIssueMap[tech._id] = {
          techName: tech.name,
          totalQty: 0,
          txCount: 0,
        };
      }

      for (const tx of recentTransactions) {
        const techId = typeof tx.technician === 'string' ? tx.technician : tx.technician?._id;
        if (techId && techIssueMap[techId]) {
          techIssueMap[techId].totalQty += Number(tx.quantity) || 0;
          techIssueMap[techId].txCount += 1;
        }
      }

      const issuesPerTechnicianChartData = Object.values(techIssueMap).map((d) => ({
        technician: d.techName,
        issuedQuantity: Math.round(d.totalQty * 100) / 100,
        issuesCount: d.txCount,
      }));

      // Recent 10 ledger transactions for dashboard stream
      const recentActivity = await storageService.listStockTransactions({ limit: 8 });

      return res.json({
        summary: {
          totalItems,
          totalWarehouseQty: Math.round(totalWarehouseQty * 100) / 100,
          activeTechnicians,
          lowStockCount,
          pendingReturnsCount,
        },
        lowStockItems,
        issuesPerTechnicianChartData,
        recentActivity,
      });
    } catch (err: any) {
      console.error('Error generating dashboard stats:', err);
      return res.status(500).json({ error: 'Failed to generate dashboard statistics.' });
    }
  },

  // GET /api/reports/export/inventory-csv
  async exportInventoryCsv(req: Request, res: Response) {
    try {
      const [items, warehouseBalances, reconciliationData] = await Promise.all([
        storageService.listItems(),
        storageService.getAllWarehouseBalances(),
        storageService.computeReconciliation(false),
      ]);

      const headers = [
        'Item SKU Code',
        'Item Description',
        'Category',
        'GKK Kit Type',
        'Unit of Measure',
        'Official MRP (INR)',
        'Warehouse Stock (Units)',
        'Low Stock Threshold (Min Units)',
        'Stock Health Status',
        'Replenishment Deficit',
        'Stock Valuation (INR)',
        'Stock with Technicians',
        'Total Lifetime Purchased',
        'Total Consumed at Sites',
        'Total Damaged Write-offs',
        'Audit Reconciliation Status',
        'Compatible Models',
        'Catalog Status',
        'Audit Timestamp',
      ];

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '""';
        const str = String(v);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const rows = items.map((item) => {
        const balEntry = warehouseBalances.find((b) => {
          const bItemId = typeof b.item === 'string' ? b.item : (b.item as any)?._id;
          return bItemId === item._id;
        });
        const warehouseQty = balEntry?.quantity ?? 0;
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        const deficit = Math.max(0, threshold - warehouseQty);
        const valuation = Math.round(warehouseQty * (item.price || 0) * 100) / 100;
        const rec = reconciliationData.items.find((r) => r.item._id === item._id);

        let status = 'SUFFICIENT (HEALTHY)';
        if (warehouseQty === 0) status = 'CRITICAL (OUT OF STOCK)';
        else if (warehouseQty <= threshold) status = 'BELOW MINIMUM THRESHOLD';

        return [
          item.itemCode,
          item.itemName,
          item.category,
          item.gkkType || item.category,
          item.unit,
          item.price || 0,
          warehouseQty,
          threshold,
          status,
          deficit,
          valuation,
          rec?.techniciansTotalBalance ?? 0,
          rec?.totalPurchased ?? 0,
          rec?.totalConsumed ?? 0,
          rec?.totalDamaged ?? 0,
          rec?.status ?? 'MATCHED',
          item.compatibleModels || 'N/A',
          item.isActive !== false ? 'ACTIVE' : 'INACTIVE',
          new Date().toISOString(),
        ];
      });

      const csvContent =
        '\uFEFF' +
        [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join(
          '\r\n'
        );
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pureit_inventory_audit_${dateStr}.csv"`
      );
      return res.send(csvContent);
    } catch (err: any) {
      console.error('Error generating inventory CSV:', err);
      return res.status(500).json({ error: 'Failed to export inventory CSV.' });
    }
  },

  // GET /api/reports/export/ledger-csv
  async exportLedgerCsv(req: Request, res: Response) {
    try {
      const { type, itemId, technicianId, fromDate, toDate } = req.query;
      const transactions = await storageService.listStockTransactions({
        type: type as string,
        itemId: itemId as string,
        technicianId: technicianId as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        limit: 10000,
      });

      const headers = [
        'Transaction ID',
        'Date',
        'Time (UTC)',
        'Transaction Type',
        'Item SKU Code',
        'Item Description',
        'Category',
        'Quantity',
        'Unit',
        'Technician Name',
        'Technician Phone',
        'Supplier / Vendor',
        'Supplier Invoice / PO #',
        'Site / Client Name',
        'Job / Ticket Reference',
        'Audit Reason / Purpose',
        'Remarks / Notes',
        'Performed By (User)',
        'Created Timestamp',
      ];

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '""';
        const str = String(v);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const rows = transactions.map((tx) => {
        const item = typeof tx.item === 'object' ? tx.item : null;
        const tech = typeof tx.technician === 'object' ? tx.technician : null;
        const performedBy =
          typeof tx.performedBy === 'object' ? (tx.performedBy as any)?.name : 'System/Admin';
        const txDate = tx.transactionDate ? new Date(tx.transactionDate) : new Date();

        return [
          tx._id,
          txDate.toISOString().slice(0, 10),
          txDate.toISOString().slice(11, 19),
          tx.transactionType,
          item?.itemCode || 'UNKNOWN',
          item?.itemName || 'Item',
          item?.category || '',
          tx.quantity,
          item?.unit || 'pcs',
          tech?.name || 'N/A',
          tech?.phone || 'N/A',
          tx.supplierName || 'N/A',
          tx.invoiceNumber || 'N/A',
          tx.siteName || 'N/A',
          tx.jobReference || 'N/A',
          tx.reason || 'N/A',
          tx.remarks || '',
          performedBy,
          tx.createdAt ? new Date(tx.createdAt).toISOString() : txDate.toISOString(),
        ];
      });

      const csvContent =
        '\uFEFF' +
        [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join(
          '\r\n'
        );
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pureit_ledger_audit_${dateStr}.csv"`
      );
      return res.send(csvContent);
    } catch (err: any) {
      console.error('Error generating ledger CSV:', err);
      return res.status(500).json({ error: 'Failed to export ledger CSV.' });
    }
  },
};
