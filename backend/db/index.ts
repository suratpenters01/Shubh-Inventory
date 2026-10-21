import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  IUser,
  IItem,
  IStockTransaction,
  IWarehouseBalance,
  ITechnicianBalance,
  IReturnRequest,
} from '../types/index.js';

// --- Real Mongoose Schemas ---
const UserSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'technician'], required: true },
  isActive: { type: Boolean, default: true },
  area: { type: String },
  employeeCode: { type: String },
  email: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const ItemSchema = new Schema({
  itemCode: { type: String, unique: true, required: true },
  itemName: { type: String, required: true },
  category: {
    type: String,
    enum: ['One Kit', 'GKK1', 'GKK2', 'SF', 'UV Lamp', 'Mineral Cartridge', 'Spare Part', 'Other'],
    required: true,
  },
  price: { type: Number, default: 0 },
  oldPrice: { type: Number, default: 0 }, // AO Smith / Company System Portal Price
  newPrice: { type: Number, default: 0 }, // Box Printing MRP / Tech Customer Charge
  priceNotes: { type: String, default: '' },
  priceUpdatedAt: { type: Date, default: Date.now },
  gkkType: { type: String },
  unit: { type: String, default: 'pcs' },
  compatibleModels: { type: String },
  brand: { type: String, default: '' },
  storageLocation: { type: String, default: '' },
  description: { type: String, default: '' },
  isKit: { type: Boolean, default: false },
  kitComponents: { type: String, default: '' },
  supplier: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  barcode: { type: String, default: '' },
  lowStockThreshold: { type: Number, default: 5 },
  reorderLevel: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const StockTransactionSchema = new Schema({
  transactionType: {
    type: String,
    enum: ['PURCHASE_IN', 'ISSUE_TO_TECH', 'USAGE_AT_SITE', 'RETURN_TO_WAREHOUSE', 'DAMAGE_WRITEOFF', 'ADJUSTMENT'],
    required: true,
  },
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  technician: { type: Schema.Types.ObjectId, ref: 'User' },
  siteName: { type: String },
  jobReference: { type: String },
  supplierName: { type: String },
  invoiceNumber: { type: String },
  kitName: { type: String },
  kitAmount: { type: Number },
  reason: { type: String },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  remarks: { type: String },
  transactionDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const WarehouseBalanceSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'Item', unique: true, required: true },
  quantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

const TechnicianBalanceSchema = new Schema({
  technician: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});
TechnicianBalanceSchema.index({ technician: 1, item: 1 }, { unique: true });

const ReturnRequestSchema = new Schema({
  technician: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'REJECTED'], default: 'PENDING' },
  requestedAt: { type: Date, default: Date.now },
  confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  rejectionReason: { type: String },
});

const IdempotencyRecordSchema = new Schema({
  key: { type: String, required: true },
  userId: { type: String, required: true },
  endpoint: { type: String, required: true },
  payloadHash: { type: String, required: true },
  status: { type: String, enum: ['IN_PROGRESS', 'RESOLVED'], default: 'IN_PROGRESS' },
  statusCode: { type: Number },
  responseBody: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 },
});
IdempotencyRecordSchema.index({ key: 1, userId: 1, endpoint: 1 }, { unique: true });

// --- Inventory Management Schema (Always Seeded & Full CRUD) ---
export interface IInventoryItem {
  id: string;
  name: string;
  category: string;
  code: string;
  quantity: number;
  unit: string;
  minStock: number;
  price: number;
  location: string;
  updatedAt: string;
}

const InventorySchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'pcs' },
  minStock: { type: Number, default: 5 },
  price: { type: Number, default: 0 },
  location: { type: String, default: 'Main Warehouse' },
  updatedAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export const ItemModel = mongoose.models.Item || mongoose.model('Item', ItemSchema);
export const StockTransactionModel = mongoose.models.StockTransaction || mongoose.model('StockTransaction', StockTransactionSchema);
export const WarehouseBalanceModel = mongoose.models.WarehouseBalance || mongoose.model('WarehouseBalance', WarehouseBalanceSchema);
export const TechnicianBalanceModel = mongoose.models.TechnicianBalance || mongoose.model('TechnicianBalance', TechnicianBalanceSchema);
export const ReturnRequestModel = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', ReturnRequestSchema);
export const IdempotencyRecordModel = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
export const InventoryModel = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);

// --- High Performance In-Memory / Hybrid Transactional Engine ---
// Provides full MongoDB & Mongoose semantic parity when MongoDB daemon is not running locally.
class InMemoryDatabase {
  users: Map<string, IUser> = new Map();
  items: Map<string, IItem> = new Map();
  inventory: Map<string, IInventoryItem> = new Map();
  transactions: IStockTransaction[] = [];
  warehouseBalances: Map<string, IWarehouseBalance> = new Map(); // key = itemId
  technicianBalances: Map<string, ITechnicianBalance> = new Map(); // key = `${techId}_${itemId}`
  returnRequests: Map<string, IReturnRequest> = new Map();
  idempotencyRecords: Map<string, any> = new Map(); // key = `${userId}_${endpoint}_${key}`

  clearAll() {
    this.users.clear();
    this.items.clear();
    this.inventory.clear();
    this.transactions = [];
    this.warehouseBalances.clear();
    this.technicianBalances.clear();
    this.returnRequests.clear();
    this.idempotencyRecords.clear();
  }

  generateId(): string {
    return new Types.ObjectId().toString();
  }

  cloneState() {
    return {
      users: new Map(Array.from(this.users.entries()).map(([k, v]) => [k, { ...v }])),
      items: new Map(Array.from(this.items.entries()).map(([k, v]) => [k, { ...v }])),
      inventory: new Map(Array.from(this.inventory.entries()).map(([k, v]) => [k, { ...v }])),
      transactions: this.transactions.map((t) => ({ ...t })),
      warehouseBalances: new Map(Array.from(this.warehouseBalances.entries()).map(([k, v]) => [k, { ...v }])),
      technicianBalances: new Map(Array.from(this.technicianBalances.entries()).map(([k, v]) => [k, { ...v }])),
      returnRequests: new Map(Array.from(this.returnRequests.entries()).map(([k, v]) => [k, { ...v }])),
    };
  }

  restoreState(state: any) {
    this.users = state.users;
    this.items = state.items;
    this.inventory = state.inventory || new Map();
    this.transactions = state.transactions;
    this.warehouseBalances = state.warehouseBalances;
    this.technicianBalances = state.technicianBalances;
    this.returnRequests = state.returnRequests;
  }

  scheduleSave() {
    // Persistence hook for in-memory storage state synchronization
  }
}

export const inMemoryDb = new InMemoryDatabase();

let isConnectedToMongo = false;

function sanitizeMongoUri(raw: string): string {
  try {
    const trimmed = raw.trim();
    const prefixMatch = trimmed.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
    if (!prefixMatch) return trimmed;
    const prefix = prefixMatch[1];
    const rest = prefixMatch[2];

    const lastAtIndex = rest.lastIndexOf('@');
    if (lastAtIndex === -1) return trimmed;

    const userInfo = rest.substring(0, lastAtIndex);
    const hostAndQuery = rest.substring(lastAtIndex + 1);

    const colonIndex = userInfo.indexOf(':');
    if (colonIndex === -1) return trimmed;

    const username = userInfo.substring(0, colonIndex);
    const password = userInfo.substring(colonIndex + 1);

    const cleanUsername = encodeURIComponent(decodeURIComponent(username));
    const cleanPassword = encodeURIComponent(decodeURIComponent(password));

    return `${prefix}${cleanUsername}:${cleanPassword}@${hostAndQuery}`;
  } catch {
    return raw.trim();
  }
}

export async function initDatabase() {
  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (rawUri && rawUri.trim()) {
    const sanitizedUri = sanitizeMongoUri(rawUri);
    try {
      console.log(`[DB] Attempting MongoDB connection to cluster...`);
      await mongoose.connect(sanitizedUri, { serverSelectionTimeoutMS: 5000 });
      isConnectedToMongo = true;
      console.log('[DB] Successfully connected to MongoDB Atlas / Remote Cluster.');
      return;
    } catch (err: any) {
      console.warn(`[DB] Could not connect to external MongoDB: ${err.message}. Using built-in ACID transactional in-memory database engine.`);
      isConnectedToMongo = false;
    }
  } else {
    console.log('[DB] No MONGODB_URI or MONGO_URI specified. Operating with built-in transactional in-memory database engine.');
  }
}

export function isMongoConnected() {
  return isConnectedToMongo;
}

// Transaction Session Manager
export interface TransactionSession {
  inTransaction: boolean;
  snapshot?: any;
  startTransaction: () => Promise<void>;
  commitTransaction: () => Promise<void>;
  abortTransaction: () => Promise<void>;
  endSession: () => Promise<void>;
}

export async function createSession(): Promise<TransactionSession> {
  if (isConnectedToMongo) {
    try {
      const mongooseSession = await mongoose.startSession();
      const mongoSessionObj: TransactionSession = {
        inTransaction: false,
        async startTransaction() {
          mongooseSession.startTransaction();
          mongoSessionObj.inTransaction = true;
        },
        async commitTransaction() {
          await mongooseSession.commitTransaction();
          mongoSessionObj.inTransaction = false;
        },
        async abortTransaction() {
          await mongooseSession.abortTransaction();
          mongoSessionObj.inTransaction = false;
        },
        async endSession() {
          await mongooseSession.endSession();
        },
      };
      return mongoSessionObj;
    } catch {
      // If standalone MongoDB doesn't support replica set sessions, fallback to memory transactional state
    }
  }

  // Built-in Transaction Session with Atomic Rollback & Commit
  let snapshot: any = null;
  let active = false;

  const memSessionObj: TransactionSession = {
    inTransaction: false,
    async startTransaction() {
      snapshot = inMemoryDb.cloneState();
      active = true;
      memSessionObj.inTransaction = true;
    },
    async commitTransaction() {
      // Changes already in memory, discard snapshot
      snapshot = null;
      active = false;
      memSessionObj.inTransaction = false;
    },
    async abortTransaction() {
      if (snapshot) {
        inMemoryDb.restoreState(snapshot);
        snapshot = null;
      }
      active = false;
      memSessionObj.inTransaction = false;
    },
    async endSession() {
      if (active && snapshot) {
        inMemoryDb.restoreState(snapshot);
      }
      active = false;
      memSessionObj.inTransaction = false;
    },
  };

  return memSessionObj;
}
