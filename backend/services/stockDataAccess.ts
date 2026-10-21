import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import {
  inMemoryDb,
  isMongoConnected,
  StockTransactionModel,
  WarehouseBalanceModel,
  TechnicianBalanceModel,
  ReturnRequestModel,
  IdempotencyRecordModel,
  ItemModel,
  UserModel,
} from '../db/index.js';
import {
  IStockTransaction,
  IReturnRequest,
  IIdempotencyRecord,
  StockError,
} from '../types/index.js';
import {
  safeAddQuantity,
  safeSubtractQuantity,
  validatePositiveWholeQuantity,
  OPERATION_MAX_QUANTITIES,
} from '../utils/mathUtils.js';

export function validateId(id: unknown, fieldName: string): string {
  const strId = (typeof id === 'string' ? id : (id && typeof (id as any).toHexString === 'function' ? (id as any).toHexString() : (id && typeof (id as any).toString === 'function' ? (id as any).toString() : ''))) || '';
  if (!strId.trim() || !Types.ObjectId.isValid(strId.trim())) {
    throw new StockError('INVALID_ID', `Invalid ${fieldName}: '${id}' is not a valid 24-character hexadecimal ObjectId.`, 400);
  }
  return strId.trim();
}

export function hashPayload(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload || {}, Object.keys(payload || ({} as object)).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  } catch {
    return crypto.createHash('sha256').update(String(payload)).digest('hex');
  }
}

export interface IStockDataAccess {
  getNow: () => Date;

  atomicPurchase(params: {
    itemId: string;
    quantity: number;
    supplierName?: string;
    invoiceNumber?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }>;

  atomicIssue(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    remarks?: string;
    kitName?: string;
    kitAmount?: number;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }>;

  atomicUsage(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    siteName?: string;
    jobReference?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newTechQty: number }>;

  atomicDamageWriteoff(params: {
    itemId: string;
    quantity: number;
    reason?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }>;

  atomicCreateReturnRequest(params: {
    technicianId: string;
    itemId: string;
    quantity: number;
    reason: string;
  }): Promise<IReturnRequest>;

  atomicConfirmReturn(params: {
    returnRequestId: string;
    confirmedBy: string;
  }): Promise<{ returnRequest: IReturnRequest; transaction: IStockTransaction; newWarehouseQty: number }>;

  atomicDirectReturn(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    reason?: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }>;

  claimIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
  }): Promise<{ claimed: boolean; existing?: IIdempotencyRecord }>;

  resolveIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void>;

  getIdempotencyRecord(key: string, userId: string, endpoint: string): Promise<IIdempotencyRecord | null>;

  saveIdempotencyRecord(record: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void>;
}

// -------------------------------------------------------------
// 1. IN-MEMORY IMPLEMENTATION (Zero await during check-and-write)
// -------------------------------------------------------------
export class MemoryStockDataAccess implements IStockDataAccess {
  constructor(public getNow: () => Date = () => new Date()) {}

  async atomicPurchase(params: {
    itemId: string;
    quantity: number;
    supplierName?: string;
    invoiceNumber?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found or inactive.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Purchase quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    // SYNCHRONOUS ATOMIC BALANCE UPDATE
    const currentBal = inMemoryDb.warehouseBalances.get(validItemId);
    const prevQty = currentBal ? currentBal.quantity : 0;
    const newQty = safeAddQuantity(prevQty, qty);

    if (currentBal) {
      currentBal.quantity = newQty;
      currentBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.warehouseBalances.set(validItemId, {
        _id: inMemoryDb.generateId(),
        item: validItemId,
        quantity: newQty,
        lastUpdated: this.getNow(),
      });
    }

    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'PURCHASE_IN',
      item: validItemId,
      quantity: qty,
      supplierName: params.supplierName || 'Direct Supplier',
      invoiceNumber: params.invoiceNumber || '',
      performedBy: validPerformedBy,
      remarks: params.remarks || '',
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return { transaction: tx, newWarehouseQty: newQty };
  }

  async atomicIssue(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    remarks?: string;
    kitName?: string;
    kitAmount?: number;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found or inactive.`, 404);
    }

    const tech = inMemoryDb.users.get(validTechId);
    if (!tech || tech.role !== 'technician' || !tech.isActive) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found or inactive.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Issue quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    // SYNCHRONOUS ATOMIC CHECK-AND-DEDUCT (Zero await between check & write)
    const whBal = inMemoryDb.warehouseBalances.get(validItemId);
    const currentWhQty = whBal ? whBal.quantity : 0;

    const subResult = safeSubtractQuantity(currentWhQty, qty);
    if (!subResult.success) {
      throw new StockError('INSUFFICIENT_STOCK', subResult.error!, 400, {
        available: currentWhQty,
        requested: qty,
      });
    }

    // Write new warehouse quantity synchronously
    if (whBal) {
      whBal.quantity = subResult.newBalance;
      whBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.warehouseBalances.set(validItemId, {
        _id: inMemoryDb.generateId(),
        item: validItemId,
        quantity: subResult.newBalance,
        lastUpdated: this.getNow(),
      });
    }

    // Increment technician balance atomically
    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const prevTechQty = techBal ? techBal.quantity : 0;
    const newTechQty = safeAddQuantity(prevTechQty, qty);

    if (techBal) {
      techBal.quantity = newTechQty;
      techBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.technicianBalances.set(techKey, {
        _id: inMemoryDb.generateId(),
        technician: validTechId,
        item: validItemId,
        quantity: newTechQty,
        lastUpdated: this.getNow(),
      });
    }

    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'ISSUE_TO_TECH',
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      kitName: params.kitName,
      kitAmount: params.kitAmount,
      performedBy: validPerformedBy,
      remarks: params.remarks || '',
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return {
      transaction: tx,
      newWarehouseQty: subResult.newBalance,
      newTechQty,
    };
  }

  async atomicUsage(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    siteName?: string;
    jobReference?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }

    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Usage quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    // SYNCHRONOUS ATOMIC DEDUCT FROM TECHNICIAN BALANCE
    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;

    const subResult = safeSubtractQuantity(currentTechQty, qty);
    if (!subResult.success) {
      throw new StockError('INSUFFICIENT_STOCK', subResult.error!, 400, {
        available: currentTechQty,
        requested: qty,
      });
    }

    if (techBal) {
      techBal.quantity = subResult.newBalance;
      techBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.technicianBalances.set(techKey, {
        _id: inMemoryDb.generateId(),
        technician: validTechId,
        item: validItemId,
        quantity: subResult.newBalance,
        lastUpdated: this.getNow(),
      });
    }

    const effectiveSite = params.siteName?.trim() || (params.jobReference?.trim() ? `Case #${params.jobReference.trim()}` : 'On-Site Service');
    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'USAGE_AT_SITE',
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      siteName: effectiveSite,
      jobReference: params.jobReference?.trim() || '',
      performedBy: validPerformedBy,
      remarks: params.remarks?.trim() || '',
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return {
      transaction: tx,
      newTechQty: subResult.newBalance,
    };
  }

  async atomicDamageWriteoff(params: {
    itemId: string;
    quantity: number;
    reason?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(
      params.quantity,
      'Damage write-off quantity',
      OPERATION_MAX_QUANTITIES.DAMAGE_WRITEOFF
    );
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    const whBal = inMemoryDb.warehouseBalances.get(validItemId);
    const currentWhQty = whBal ? whBal.quantity : 0;

    const subResult = safeSubtractQuantity(currentWhQty, qty);
    if (!subResult.success) {
      throw new StockError(
        'INSUFFICIENT_STOCK',
        `Insufficient warehouse stock to write off. Available: ${currentWhQty}, Requested: ${qty}`,
        400,
        { available: currentWhQty, requested: qty }
      );
    }

    if (whBal) {
      whBal.quantity = subResult.newBalance;
      whBal.lastUpdated = this.getNow();
    }

    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'DAMAGE_WRITEOFF',
      item: validItemId,
      quantity: qty,
      reason: params.reason?.trim() || 'Damaged / Expired stock write-off',
      performedBy: validPerformedBy,
      remarks: params.remarks?.trim() || '',
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return {
      transaction: tx,
      newWarehouseQty: subResult.newBalance,
    };
  }

  async atomicCreateReturnRequest(params: {
    technicianId: string;
    itemId: string;
    quantity: number;
    reason: string;
  }): Promise<IReturnRequest> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }

    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Return quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;

    if (currentTechQty < qty) {
      throw new StockError(
        'INSUFFICIENT_STOCK',
        `Technician does not hold ${qty} units. Current hand balance: ${currentTechQty}`,
        400
      );
    }

    const retReq: IReturnRequest = {
      _id: inMemoryDb.generateId(),
      technician: validTechId,
      item: validItemId,
      quantity: qty,
      reason: params.reason.trim(),
      status: 'PENDING',
      requestedAt: this.getNow(),
    };
    inMemoryDb.returnRequests.set(retReq._id, retReq);
    inMemoryDb.scheduleSave();

    return retReq;
  }

  async atomicConfirmReturn(params: {
    returnRequestId: string;
    confirmedBy: string;
  }): Promise<{ returnRequest: IReturnRequest; transaction: IStockTransaction; newWarehouseQty: number }> {
    const validReturnId = validateId(params.returnRequestId, 'Return Request ID');
    const validConfirmedBy = validateId(params.confirmedBy, 'User ID');

    const ret = inMemoryDb.returnRequests.get(validReturnId);
    if (!ret) {
      throw new StockError('RETURN_NOT_FOUND', 'Return request not found.', 404);
    }
    if (ret.status !== 'PENDING') {
      throw new StockError('INVALID_STATE', `Return request already ${ret.status}.`, 400);
    }

    const techId = typeof ret.technician === 'object' ? ret.technician._id : ret.technician;
    const itemId = typeof ret.item === 'object' ? ret.item._id : ret.item;

    // SYNCHRONOUS ATOMIC DEDUCT FROM TECH AND ADD TO WAREHOUSE
    const techKey = `${techId}_${itemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;

    const subResult = safeSubtractQuantity(currentTechQty, ret.quantity);
    if (!subResult.success) {
      throw new StockError('INSUFFICIENT_STOCK', `Technician no longer holds requested return quantity (${ret.quantity}).`, 400);
    }

    if (techBal) {
      techBal.quantity = subResult.newBalance;
      techBal.lastUpdated = this.getNow();
    }

    // Add back to warehouse
    const whBal = inMemoryDb.warehouseBalances.get(itemId);
    const currentWhQty = whBal ? whBal.quantity : 0;
    const newWhQty = safeAddQuantity(currentWhQty, ret.quantity);

    if (whBal) {
      whBal.quantity = newWhQty;
      whBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.warehouseBalances.set(itemId, {
        _id: inMemoryDb.generateId(),
        item: itemId,
        quantity: newWhQty,
        lastUpdated: this.getNow(),
      });
    }

    ret.status = 'CONFIRMED';
    ret.confirmedBy = validConfirmedBy;
    ret.confirmedAt = this.getNow();

    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'RETURN_TO_WAREHOUSE',
      item: itemId,
      technician: techId,
      quantity: ret.quantity,
      performedBy: validConfirmedBy,
      remarks: `Return confirmed: ${ret.reason}`,
      transactionDate: this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return { returnRequest: ret, transaction: tx, newWarehouseQty: newWhQty };
  }

  async atomicDirectReturn(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    reason?: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }

    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Return quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;

    const subResult = safeSubtractQuantity(currentTechQty, qty);
    if (!subResult.success) {
      throw new StockError(
        'INSUFFICIENT_STOCK',
        `Technician currently holds ${currentTechQty} units. Cannot return ${qty} units.`,
        400,
        { available: currentTechQty, requested: qty }
      );
    }

    // Deduct technician balance
    if (techBal) {
      techBal.quantity = subResult.newBalance;
      techBal.lastUpdated = this.getNow();
    }

    // Add back to warehouse balance
    const whBal = inMemoryDb.warehouseBalances.get(validItemId);
    const currentWhQty = whBal ? whBal.quantity : 0;
    const newWhQty = safeAddQuantity(currentWhQty, qty);

    if (whBal) {
      whBal.quantity = newWhQty;
      whBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.warehouseBalances.set(validItemId, {
        _id: inMemoryDb.generateId(),
        item: validItemId,
        quantity: newWhQty,
        lastUpdated: this.getNow(),
      });
    }

    const tx: IStockTransaction = {
      _id: inMemoryDb.generateId(),
      transactionType: 'RETURN_TO_WAREHOUSE',
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      performedBy: validPerformedBy,
      reason: params.reason?.trim() || 'Bulk stock return to central warehouse',
      remarks: params.remarks?.trim() || '',
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow(),
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();

    return {
      transaction: tx,
      newWarehouseQty: newWhQty,
      newTechQty: subResult.newBalance,
    };
  }

  async claimIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
  }): Promise<{ claimed: boolean; existing?: IIdempotencyRecord }> {
    const fullKey = `${params.userId}_${params.endpoint}_${params.key}`;
    const existing = inMemoryDb.idempotencyRecords.get(fullKey);

    if (existing) {
      if (this.getNow() > new Date(existing.expiresAt)) {
        inMemoryDb.idempotencyRecords.delete(fullKey);
      } else {
        return { claimed: false, existing };
      }
    }

    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1000);
    const record: IIdempotencyRecord = {
      key: params.key,
      userId: params.userId,
      endpoint: params.endpoint,
      payloadHash: params.payloadHash,
      status: 'IN_PROGRESS',
      statusCode: 200,
      responseBody: null,
      createdAt: this.getNow(),
      expiresAt,
    };
    // Synchronous write guarantees atomic leader claim
    inMemoryDb.idempotencyRecords.set(fullKey, record);
    return { claimed: true };
  }

  async resolveIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void> {
    const fullKey = `${params.userId}_${params.endpoint}_${params.key}`;
    const existing = inMemoryDb.idempotencyRecords.get(fullKey);
    if (existing) {
      existing.status = 'RESOLVED';
      existing.statusCode = params.statusCode;
      existing.responseBody = params.responseBody;
    }
  }

  async getIdempotencyRecord(key: string, userId: string, endpoint: string): Promise<IIdempotencyRecord | null> {
    const fullKey = `${userId}_${endpoint}_${key}`;
    const record = inMemoryDb.idempotencyRecords.get(fullKey);
    if (!record) return null;

    if (this.getNow() > new Date(record.expiresAt)) {
      inMemoryDb.idempotencyRecords.delete(fullKey);
      return null;
    }
    return record;
  }

  async saveIdempotencyRecord(record: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void> {
    const fullKey = `${record.userId}_${record.endpoint}_${record.key}`;
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1000);
    inMemoryDb.idempotencyRecords.set(fullKey, {
      ...record,
      status: 'RESOLVED',
      createdAt: this.getNow(),
      expiresAt,
    });
  }
}

// Helper to execute Mongo multi-document operations inside ACID transactions with automatic retry on WriteConflict/TransientTransactionError
async function runInMongoTransaction<T>(
  fn: (session: mongoose.ClientSession) => Promise<T>,
  maxRetries = 25
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err: any) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore if already aborted
      }
      const isTransient =
        err?.hasErrorLabel?.('TransientTransactionError') ||
        err?.code === 112 ||
        err?.message?.includes('WriteConflict') ||
        err?.message?.includes('Please retry your operation');

      if (isTransient && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (20 * Math.pow(1.15, attempt)) + 10)));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

// -------------------------------------------------------------
// 2. MONGO DB IMPLEMENTATION (ACID Transactions & Conditional Atomic Queries)
// -------------------------------------------------------------
export class MongoStockDataAccess implements IStockDataAccess {
  constructor(public getNow: () => Date = () => new Date()) {}

  async atomicPurchase(params: {
    itemId: string;
    quantity: number;
    supplierName?: string;
    invoiceNumber?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = await ItemModel.findById(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found or inactive.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Purchase quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    return runInMongoTransaction(async (session) => {
      // Conditional atomic upsert bound to session
      const updatedBalance = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );

      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'PURCHASE_IN',
            item: validItemId,
            quantity: qty,
            supplierName: params.supplierName || 'Direct Supplier',
            invoiceNumber: params.invoiceNumber || '',
            performedBy: validPerformedBy,
            remarks: params.remarks || '',
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        transaction: txDocs[0].toObject() as IStockTransaction,
        newWarehouseQty: updatedBalance!.quantity,
      };
    });
  }

  async atomicIssue(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    remarks?: string;
    kitName?: string;
    kitAmount?: number;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId),
    ]);

    if (!item || item.isActive === false) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found or inactive.`, 404);
    }
    if (!tech || tech.role !== 'technician' || !tech.isActive) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found or inactive.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Issue quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    return runInMongoTransaction(async (session) => {
      // STRICT ATOMIC CONDITIONAL DEDUCT: query enforces quantity >= qty inside session
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );

      if (!updatedWh) {
        const currentWh = await WarehouseBalanceModel.findOne({ item: validItemId }).session(session);
        const curr = currentWh ? currentWh.quantity : 0;
        throw new StockError('INSUFFICIENT_STOCK', `Insufficient warehouse stock. Available: ${curr}, Requested: ${qty}`, 400, {
          available: curr,
          requested: qty,
        });
      }

      // Increment technician balance inside session
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );

      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'ISSUE_TO_TECH',
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            kitName: params.kitName,
            kitAmount: params.kitAmount,
            performedBy: validPerformedBy,
            remarks: params.remarks || '',
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        transaction: txDocs[0].toObject() as IStockTransaction,
        newWarehouseQty: updatedWh.quantity,
        newTechQty: updatedTech!.quantity,
      };
    });
  }

  async atomicUsage(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    siteName?: string;
    jobReference?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId),
    ]);

    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }
    if (!tech) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Usage quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    return runInMongoTransaction(async (session) => {
      // STRICT ATOMIC CONDITIONAL DEDUCT FROM TECH: query enforces quantity >= qty inside session
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );

      if (!updatedTech) {
        const currentTech = await TechnicianBalanceModel.findOne({ technician: validTechId, item: validItemId }).session(session);
        const curr = currentTech ? currentTech.quantity : 0;
        throw new StockError('INSUFFICIENT_STOCK', `Technician does not hold enough stock. Available: ${curr}, Requested: ${qty}`, 400, {
          available: curr,
          requested: qty,
        });
      }

      const effectiveSite = params.siteName?.trim() || (params.jobReference?.trim() ? `Case #${params.jobReference.trim()}` : 'On-Site Service');
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'USAGE_AT_SITE',
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            siteName: effectiveSite,
            jobReference: params.jobReference?.trim() || '',
            performedBy: validPerformedBy,
            remarks: params.remarks?.trim() || '',
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        transaction: txDocs[0].toObject() as IStockTransaction,
        newTechQty: updatedTech.quantity,
      };
    });
  }

  async atomicDamageWriteoff(params: {
    itemId: string;
    quantity: number;
    reason?: string;
    performedBy: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const item = await ItemModel.findById(validItemId);
    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(
      params.quantity,
      'Damage write-off quantity',
      OPERATION_MAX_QUANTITIES.DAMAGE_WRITEOFF
    );
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    return runInMongoTransaction(async (session) => {
      // STRICT ATOMIC CONDITIONAL DEDUCT FROM WAREHOUSE: query enforces quantity >= qty inside session
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );

      if (!updatedWh) {
        const currentWh = await WarehouseBalanceModel.findOne({ item: validItemId }).session(session);
        const curr = currentWh ? currentWh.quantity : 0;
        throw new StockError(
          'INSUFFICIENT_STOCK',
          `Insufficient warehouse stock to write off. Available: ${curr}, Requested: ${qty}`,
          400,
          { available: curr, requested: qty }
        );
      }

      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'DAMAGE_WRITEOFF',
            item: validItemId,
            quantity: qty,
            reason: params.reason?.trim() || 'Damaged / Expired stock write-off',
            performedBy: validPerformedBy,
            remarks: params.remarks?.trim() || '',
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        transaction: txDocs[0].toObject() as IStockTransaction,
        newWarehouseQty: updatedWh.quantity,
      };
    });
  }

  async atomicCreateReturnRequest(params: {
    technicianId: string;
    itemId: string;
    quantity: number;
    reason: string;
  }): Promise<IReturnRequest> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');

    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId),
    ]);

    if (!item) {
      throw new StockError('ITEM_NOT_FOUND', `Item with ID ${validItemId} not found.`, 404);
    }
    if (!tech) {
      throw new StockError('INVALID_TECHNICIAN', `Technician with ID ${validTechId} not found.`, 404);
    }

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Return quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    const techBal = await TechnicianBalanceModel.findOne({
      technician: validTechId,
      item: validItemId,
    });
    const currentTechQty = techBal ? techBal.quantity : 0;

    if (currentTechQty < qty) {
      throw new StockError(
        'INSUFFICIENT_STOCK',
        `Technician does not hold ${qty} units. Current hand balance: ${currentTechQty}`,
        400
      );
    }

    const doc = await ReturnRequestModel.create({
      technician: validTechId,
      item: validItemId,
      quantity: qty,
      reason: params.reason.trim(),
      status: 'PENDING',
      requestedAt: this.getNow(),
    });

    return doc.toObject() as IReturnRequest;
  }

  async atomicConfirmReturn(params: {
    returnRequestId: string;
    confirmedBy: string;
  }): Promise<{ returnRequest: IReturnRequest; transaction: IStockTransaction; newWarehouseQty: number }> {
    const validReturnId = validateId(params.returnRequestId, 'Return Request ID');
    const validConfirmedBy = validateId(params.confirmedBy, 'User ID');

    return runInMongoTransaction(async (session) => {
      // 1. Atomically claim return request in PENDING state
      const updatedReturn = await ReturnRequestModel.findOneAndUpdate(
        { _id: validReturnId, status: 'PENDING' },
        {
          $set: {
            status: 'CONFIRMED',
            confirmedBy: new Types.ObjectId(validConfirmedBy) as any,
            confirmedAt: this.getNow(),
          },
        },
        { new: true, session }
      );

      if (!updatedReturn) {
        throw new StockError('INVALID_STATE', 'Return request not found or already processed.', 400);
      }

      const techId = updatedReturn.technician.toString();
      const itemId = updatedReturn.item.toString();

      // 2. Deduct from technician atomically
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: techId, item: itemId, quantity: { $gte: updatedReturn.quantity } },
        { $inc: { quantity: -updatedReturn.quantity }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );

      if (!updatedTech) {
        throw new StockError('INSUFFICIENT_STOCK', `Technician no longer holds required stock of ${updatedReturn.quantity}.`, 400);
      }

      // 3. Add to warehouse atomically
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $inc: { quantity: updatedReturn.quantity }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );

      // 4. Ledger transaction record
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'RETURN_TO_WAREHOUSE',
            item: itemId,
            technician: techId,
            quantity: updatedReturn.quantity,
            performedBy: validConfirmedBy,
            remarks: `Return confirmed: ${updatedReturn.reason}`,
            transactionDate: this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        returnRequest: updatedReturn.toObject() as IReturnRequest,
        transaction: txDocs[0].toObject() as IStockTransaction,
        newWarehouseQty: updatedWh!.quantity,
      };
    });
  }

  async atomicDirectReturn(params: {
    itemId: string;
    technicianId: string;
    quantity: number;
    performedBy: string;
    reason?: string;
    remarks?: string;
    transactionDate?: Date;
  }): Promise<{ transaction: IStockTransaction; newWarehouseQty: number; newTechQty: number }> {
    const validItemId = validateId(params.itemId, 'Item ID');
    const validTechId = validateId(params.technicianId, 'Technician ID');
    const validPerformedBy = validateId(params.performedBy, 'User ID');

    const qtyVal = validatePositiveWholeQuantity(params.quantity, 'Return quantity');
    if (!qtyVal.valid) {
      throw new StockError('INVALID_QUANTITY', qtyVal.error!, 400);
    }
    const qty = qtyVal.value;

    return runInMongoTransaction(async (session) => {
      // 1. Deduct from technician atomically
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );

      if (!updatedTech) {
        const current = await TechnicianBalanceModel.findOne({ technician: validTechId, item: validItemId }).session(session);
        const curr = current ? current.quantity : 0;
        throw new StockError('INSUFFICIENT_STOCK', `Technician holds ${curr} units. Cannot return ${qty}.`, 400, {
          available: curr,
          requested: qty,
        });
      }

      // 2. Add to warehouse atomically
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );

      // 3. Ledger transaction record
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: 'RETURN_TO_WAREHOUSE',
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            performedBy: validPerformedBy,
            reason: params.reason?.trim() || 'Bulk stock return to central warehouse',
            remarks: params.remarks?.trim() || '',
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow(),
          },
        ],
        { session }
      );

      return {
        transaction: txDocs[0].toObject() as IStockTransaction,
        newWarehouseQty: updatedWh!.quantity,
        newTechQty: updatedTech.quantity,
      };
    });
  }

  async claimIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
  }): Promise<{ claimed: boolean; existing?: IIdempotencyRecord }> {
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1000);
    try {
      await IdempotencyRecordModel.create({
        key: params.key,
        userId: params.userId,
        endpoint: params.endpoint,
        payloadHash: params.payloadHash,
        status: 'IN_PROGRESS',
        createdAt: this.getNow(),
        expiresAt,
      });
      return { claimed: true };
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        const existing = await IdempotencyRecordModel.findOne({
          key: params.key,
          userId: params.userId,
          endpoint: params.endpoint,
        });
        if (existing) {
          if (this.getNow() > new Date(existing.expiresAt)) {
            await IdempotencyRecordModel.deleteOne({ _id: existing._id });
            return this.claimIdempotencyKey(params);
          }
          return { claimed: false, existing: existing.toObject() as IIdempotencyRecord };
        }
      }
      throw err;
    }
  }

  async resolveIdempotencyKey(params: {
    key: string;
    userId: string;
    endpoint: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void> {
    await IdempotencyRecordModel.updateOne(
      { key: params.key, userId: params.userId, endpoint: params.endpoint },
      {
        $set: {
          status: 'RESOLVED',
          statusCode: params.statusCode,
          responseBody: params.responseBody,
        },
      }
    );
  }

  async getIdempotencyRecord(key: string, userId: string, endpoint: string): Promise<IIdempotencyRecord | null> {
    const doc = await IdempotencyRecordModel.findOne({ key, userId, endpoint });
    if (!doc) return null;
    if (this.getNow() > new Date(doc.expiresAt)) {
      await IdempotencyRecordModel.deleteOne({ _id: doc._id });
      return null;
    }
    return doc.toObject() as IIdempotencyRecord;
  }

  async saveIdempotencyRecord(record: {
    key: string;
    userId: string;
    endpoint: string;
    payloadHash: string;
    statusCode: number;
    responseBody: any;
  }): Promise<void> {
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1000);
    await IdempotencyRecordModel.findOneAndUpdate(
      { key: record.key, userId: record.userId, endpoint: record.endpoint },
      {
        ...record,
        status: 'RESOLVED',
        expiresAt,
        createdAt: this.getNow(),
      },
      { upsert: true }
    );
  }
}

export const memoryStockDataAccess = new MemoryStockDataAccess();
export const mongoStockDataAccess = new MongoStockDataAccess();

export function getStockDataAccess(): IStockDataAccess {
  return isMongoConnected() ? mongoStockDataAccess : memoryStockDataAccess;
}
