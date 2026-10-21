export type UserRole = 'admin' | 'technician';

export interface IUser {
  _id: string;
  id?: string;
  name: string;
  phone: string;
  role: UserRole;
  isActive?: boolean;
  area?: string;
  employeeCode?: string;
  email?: string;
  notes?: string;
  createdAt?: string | Date;
  totalHeldQty?: number;
}

export type ItemCategory =
  | 'One Kit'
  | 'GKK1'
  | 'GKK2'
  | 'SF'
  | 'UV Lamp'
  | 'Mineral Cartridge'
  | 'Spare Part'
  | 'Other';

export interface IItem {
  _id: string;
  itemCode: string;
  itemName: string;
  category: ItemCategory;
  unit: string;
  price?: number;
  oldPrice?: number; // AO Smith / Company System Portal Price (Old Price)
  newPrice?: number; // Box Printed MRP / Technician Customer Charge Price (New Price)
  priceNotes?: string;
  priceUpdatedAt?: string | Date;
  gkkType?: string;
  compatibleModels?: string;
  brand?: string;
  storageLocation?: string;
  description?: string;
  isKit?: boolean;
  kitComponents?: string;
  supplier?: string;
  hsnCode?: string;
  barcode?: string;
  lowStockThreshold: number;
  reorderLevel: number;
  isActive?: boolean;
  warehouseQty?: number;
  isLowStock?: boolean;
  createdAt?: string | Date;
}

export type TransactionType =
  | 'PURCHASE_IN'
  | 'ISSUE_TO_TECH'
  | 'USAGE_AT_SITE'
  | 'RETURN_TO_WAREHOUSE'
  | 'DAMAGE_WRITEOFF'
  | 'ADJUSTMENT';

export interface IStockTransaction {
  _id: string;
  transactionType: TransactionType;
  item: IItem | string;
  quantity: number;
  technician?: IUser | string;
  caseId?: string;
  siteName?: string;
  jobReference?: string;
  supplierName?: string;
  invoiceNumber?: string;
  kitName?: string;
  kitAmount?: number;
  reason?: string;
  performedBy: IUser | string;
  remarks?: string;
  transactionDate: string;
  createdAt: string;
}

export interface IWarehouseBalanceItem {
  item: IItem;
  quantity: number;
  lastUpdated: string;
}

export type ReturnStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface IReturnRequest {
  _id: string;
  technician: IUser;
  item: IItem;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  requestedAt: string;
  confirmedBy?: IUser;
  confirmedAt?: string;
  rejectionReason?: string;
}

export interface IReconciliationItem {
  item: IItem;
  totalPurchased: number;
  totalConsumed: number;
  totalDamaged: number;
  warehouseBalance: number;
  techniciansTotalBalance: number;
  expectedAvailable: number;
  actualAvailable: number;
  variance: number;
  status: 'MATCHED' | 'MISMATCH';
  ledgerAudit: {
    totalPurchased: number;
    totalIssued: number;
    totalUsed: number;
    totalReturned: number;
    totalDamaged: number;
    totalAdjusted: number;
    calculatedWarehouse: number;
    calculatedTechTotal: number;
  };
}

export interface IReconciliationResponse {
  items: IReconciliationItem[];
  summary: {
    totalItems: number;
    matchedCount: number;
    mismatchedCount: number;
    overallSystemStatus: 'PERFECT_MATCH' | 'DISCREPANCY_DETECTED';
    totalPurchasedQty: number;
    totalWarehouseQty: number;
    totalTechQty: number;
    totalConsumedQty: number;
    totalDamagedQty: number;
  };
  message?: string;
}

export interface ILowStockItem extends IItem {
  warehouseQty: number;
  lowStockThreshold: number;
  deficit: number;
  urgency?: 'CRITICAL_OUT_OF_STOCK' | 'BELOW_THRESHOLD';
}

export interface IDashboardStats {
  summary: {
    totalItems: number;
    totalWarehouseQty: number;
    activeTechnicians: number;
    lowStockCount: number;
    pendingReturnsCount: number;
  };
  lowStockItems?: ILowStockItem[];
  issuesPerTechnicianChartData: Array<{
    technician: string;
    issuedQuantity: number;
    issuesCount: number;
  }>;
  recentActivity: IStockTransaction[];
}

export type NotificationType =
  | 'LOW_STOCK'
  | 'RETURN_PENDING'
  | 'RETURN_CONFIRMED'
  | 'RETURN_REJECTED'
  | 'STOCK_ISSUED'
  | 'STOCK_INWARD'
  | 'SYSTEM_ALERT';

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'warning' | 'critical' | 'info' | 'success';
  targetRole: 'admin' | 'technician' | 'all';
  targetUserId?: string;
  timestamp: string;
  read: boolean;
  actionLink?: string;
  metadata?: Record<string, any>;
}
