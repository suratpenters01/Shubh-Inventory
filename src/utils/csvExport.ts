import { IStockTransaction, IItem, IWarehouseBalanceItem, IReconciliationItem } from '../types';

/**
 * Escapes a cell value for standard CSV compatibility (RFC 4180).
 * Handles commas, double-quotes, newlines, and unicode.
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // If the cell contains quotes, commas, or line breaks, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Triggers a browser download of a CSV string with UTF-8 Byte Order Mark (BOM).
 * The BOM ensures Microsoft Excel and Google Sheets correctly display unicode characters (like ₹).
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts headers and row data array into a clean CSV string.
 */
export function generateCsvString(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Exports current warehouse inventory balances, thresholds, and valuation to CSV for external audit.
 */
export function exportInventoryToCsv(
  items: IItem[],
  balances?: IWarehouseBalanceItem[],
  reconciliations?: IReconciliationItem[]
): void {
  const headers = [
    'Item SKU Code',
    'Item Description',
    'Category',
    'GKK Kit Type / Variant',
    'Unit of Measure',
    'Official MRP (INR)',
    'Warehouse Stock (Units)',
    'Low Stock Threshold (Min Units)',
    'Stock Health Status',
    'Replenishment Deficit (Units)',
    'Stock Valuation (INR)',
    'Stock with Field Technicians',
    'Total Lifetime Inward Purchases',
    'Total Consumed at Sites',
    'Total Damaged Write-offs',
    'Audit Ledger Match Status',
    'Compatible Water Purifier Models',
    'Catalog Status',
    'Audit Export Timestamp',
  ];

  const timestamp = new Date().toISOString();
  const dateStr = new Date().toISOString().slice(0, 10);

  const rows = items.map((item) => {
    // Find warehouse balance
    const balEntry = balances?.find((b) => (typeof b.item === 'string' ? b.item : b.item._id) === item._id);
    const warehouseQty = item.warehouseQty ?? balEntry?.quantity ?? 0;
    const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
    const deficit = Math.max(0, threshold - warehouseQty);
    const unitPrice = item.price ?? 0;
    const valuation = Math.round(warehouseQty * unitPrice * 100) / 100;

    // Find reconciliation audit data if available
    const recEntry = reconciliations?.find((r) => r.item._id === item._id);
    const techQty = recEntry?.techniciansTotalBalance ?? 0;
    const purchasedQty = recEntry?.totalPurchased ?? 0;
    const consumedQty = recEntry?.totalConsumed ?? 0;
    const damagedQty = recEntry?.totalDamaged ?? 0;
    const ledgerStatus = recEntry?.status ?? 'MATCHED';

    let healthStatus = 'SUFFICIENT (HEALTHY)';
    if (warehouseQty === 0) {
      healthStatus = 'CRITICAL (OUT OF STOCK)';
    } else if (warehouseQty <= threshold) {
      healthStatus = 'BELOW MINIMUM THRESHOLD';
    }

    return [
      item.itemCode,
      item.itemName,
      item.category,
      item.gkkType || item.category,
      item.unit,
      unitPrice,
      warehouseQty,
      threshold,
      healthStatus,
      deficit,
      valuation,
      techQty,
      purchasedQty,
      consumedQty,
      damagedQty,
      ledgerStatus,
      item.compatibleModels || 'N/A',
      item.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      timestamp,
    ];
  });

  const csv = generateCsvString(headers, rows);
  downloadCsvFile(`pureit_inventory_audit_${dateStr}.csv`, csv);
}

/**
 * Exports immutable stock transaction ledger to CSV for external auditor examination.
 */
export function exportLedgerToCsv(
  transactions: IStockTransaction[],
  customFilenameSuffix = ''
): void {
  const headers = [
    'Transaction ID',
    'Date',
    'Time (UTC)',
    'Transaction Type Code',
    'Transaction Type Name',
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
    'Record Created Timestamp',
  ];

  const dateStr = new Date().toISOString().slice(0, 10);

  const getTypeName = (type: string) => {
    switch (type) {
      case 'PURCHASE_IN':
        return 'Stock Inward Purchase (HUL Distribution)';
      case 'ISSUE_TO_TECH':
        return 'Stock Issue to Field Technician';
      case 'USAGE_AT_SITE':
        return 'Filter Replaced / Consumed at Site';
      case 'RETURN_TO_WAREHOUSE':
        return 'Stock Returned to Warehouse';
      case 'DAMAGE_WRITEOFF':
        return 'Damaged / Transit Write-off';
      case 'ADJUSTMENT':
        return 'Inventory Audit Reconciliation Adjustment';
      default:
        return type;
    }
  };

  const rows = transactions.map((tx) => {
    const item = typeof tx.item === 'object' ? tx.item : null;
    const tech = typeof tx.technician === 'object' ? tx.technician : null;
    const performedBy = typeof tx.performedBy === 'object' ? (tx.performedBy as any)?.name : 'System/Admin';

    const txDate = tx.transactionDate ? new Date(tx.transactionDate) : new Date();
    const formattedDate = txDate.toISOString().slice(0, 10);
    const formattedTime = txDate.toISOString().slice(11, 19);

    return [
      tx._id,
      formattedDate,
      formattedTime,
      tx.transactionType,
      getTypeName(tx.transactionType),
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

  const csv = generateCsvString(headers, rows);
  const suffix = customFilenameSuffix ? `_${customFilenameSuffix}` : '';
  downloadCsvFile(`pureit_ledger_audit_${dateStr}${suffix}.csv`, csv);
}

/**
 * Exports complete Ledger Reconciliation & Invariant Verification audit report to CSV.
 */
export function exportReconciliationToCsv(reconciliation: IReconciliationItem[]): void {
  const headers = [
    'Item SKU Code',
    'Item Description',
    'Category',
    'Unit of Measure',
    'Total Stock Ever Purchased (A)',
    'Warehouse Stock (B)',
    'Technicians Stock Total (C)',
    'Stock Consumed at Sites (D)',
    'Damaged Stock Write-offs (E)',
    'Expected Accountable Units (B+C+D+E)',
    'Variance (Purchased - Accounted)',
    'Audit Verdict',
    'Warehouse Balance (Ledger Replay)',
    'Tech Total (Ledger Replay)',
    'Total Issues Recorded',
    'Total Returns Recorded',
    'Total Adjustments',
    'Audit Timestamp',
  ];

  const timestamp = new Date().toISOString();
  const dateStr = new Date().toISOString().slice(0, 10);

  const rows = reconciliation.map((rec) => {
    return [
      rec.item.itemCode,
      rec.item.itemName,
      rec.item.category,
      rec.item.unit,
      rec.totalPurchased,
      rec.warehouseBalance,
      rec.techniciansTotalBalance,
      rec.totalConsumed,
      rec.totalDamaged,
      rec.actualAvailable,
      rec.variance,
      rec.status === 'MATCHED' ? 'VERIFIED MATCH (0 DRIFT)' : 'MISMATCH DETECTED',
      rec.ledgerAudit.calculatedWarehouse,
      rec.ledgerAudit.calculatedTechTotal,
      rec.ledgerAudit.totalIssued,
      rec.ledgerAudit.totalReturned,
      rec.ledgerAudit.totalAdjusted,
      timestamp,
    ];
  });

  const csv = generateCsvString(headers, rows);
  downloadCsvFile(`pureit_reconciliation_audit_${dateStr}.csv`, csv);
}
