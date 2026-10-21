export type UserRole = 'admin' | 'technician';

export interface IUser {
  _id: string;
  name: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  area?: string;
  employeeCode?: string;
  email?: string;
  notes?: string;
  createdAt?: string | Date;
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
  item: string | IItem;
  quantity: number;
  technician?: string | IUser;
  siteName?: string;
  jobReference?: string;
  supplierName?: string;
  invoiceNumber?: string;
  kitName?: string;
  kitAmount?: number;
  reason?: string;
  performedBy: string | IUser;
  remarks?: string;
  transactionDate: string | Date;
  createdAt: string | Date;
}

export interface IWarehouseBalance {
  _id: string;
  item: string | IItem;
  quantity: number;
  lastUpdated: string | Date;
}

export interface ITechnicianBalance {
  _id: string;
  technician: string | IUser;
  item: string | IItem;
  quantity: number;
  lastUpdated: string | Date;
}

export type ReturnStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface IReturnRequest {
  _id: string;
  technician: string | IUser;
  item: string | IItem;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  requestedAt: string | Date;
  confirmedBy?: string | IUser;
  confirmedAt?: string | Date;
  rejectionReason?: string;
}

export interface IReconciliationItem {
  item: IItem;
  totalPurchased: number;
  totalConsumed: number;
  totalDamaged: number;
  warehouseBalance: number;
  techniciansTotalBalance: number;
  expectedAvailable: number; // totalPurchased - totalConsumed - totalDamaged
  actualAvailable: number; // warehouseBalance + techniciansTotalBalance
  variance: number;
  status: 'MATCHED' | 'MISMATCH';
  ledgerAudit: {
    totalPurchased: number;
    totalIssued: number;
    totalUsed: number;
    totalReturned: number;
    totalDamaged: number;
    totalAdjusted: number;
    calculatedWarehouse: number; // purchased - issued + returned - damaged
    calculatedTechTotal: number; // issued - used - returned
  };
}

export interface IIdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  payloadHash: string;
  status?: 'IN_PROGRESS' | 'RESOLVED';
  statusCode: number;
  responseBody: any;
  createdAt: Date;
  expiresAt: Date;
}

export class StockError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(code: string, message: string, status = 400, details?: any) {
    super(message);
    this.name = 'StockError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
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

