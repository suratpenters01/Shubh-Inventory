// server.ts
import path from "path";
import express2 from "express";
import { createServer as createViteServer } from "vite";

// backend/app.ts
import express from "express";

// backend/routes/authRoutes.ts
import { Router } from "express";

// backend/controllers/authController.ts
import bcrypt from "bcryptjs";

// backend/services/storageService.ts
import { Types as Types2 } from "mongoose";

// backend/db/index.ts
import mongoose, { Schema, Types } from "mongoose";
var UserSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "technician"], required: true },
  isActive: { type: Boolean, default: true },
  area: { type: String },
  employeeCode: { type: String },
  email: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});
var ItemSchema = new Schema({
  itemCode: { type: String, unique: true, required: true },
  itemName: { type: String, required: true },
  category: {
    type: String,
    enum: ["One Kit", "GKK1", "GKK2", "SF", "UV Lamp", "Mineral Cartridge", "Spare Part", "Other"],
    required: true
  },
  price: { type: Number, default: 0 },
  oldPrice: { type: Number, default: 0 },
  // AO Smith / Company System Portal Price
  newPrice: { type: Number, default: 0 },
  // Box Printing MRP / Tech Customer Charge
  priceNotes: { type: String, default: "" },
  priceUpdatedAt: { type: Date, default: Date.now },
  gkkType: { type: String },
  unit: { type: String, default: "pcs" },
  compatibleModels: { type: String },
  brand: { type: String, default: "" },
  storageLocation: { type: String, default: "" },
  description: { type: String, default: "" },
  isKit: { type: Boolean, default: false },
  kitComponents: { type: String, default: "" },
  supplier: { type: String, default: "" },
  hsnCode: { type: String, default: "" },
  barcode: { type: String, default: "" },
  lowStockThreshold: { type: Number, default: 5 },
  reorderLevel: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
var StockTransactionSchema = new Schema({
  transactionType: {
    type: String,
    enum: ["PURCHASE_IN", "ISSUE_TO_TECH", "USAGE_AT_SITE", "RETURN_TO_WAREHOUSE", "DAMAGE_WRITEOFF", "ADJUSTMENT"],
    required: true
  },
  item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  technician: { type: Schema.Types.ObjectId, ref: "User" },
  siteName: { type: String },
  jobReference: { type: String },
  supplierName: { type: String },
  invoiceNumber: { type: String },
  kitName: { type: String },
  kitAmount: { type: Number },
  reason: { type: String },
  performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  remarks: { type: String },
  transactionDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
var WarehouseBalanceSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "Item", unique: true, required: true },
  quantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});
var TechnicianBalanceSchema = new Schema({
  technician: { type: Schema.Types.ObjectId, ref: "User", required: true },
  item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
  quantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});
TechnicianBalanceSchema.index({ technician: 1, item: 1 }, { unique: true });
var ReturnRequestSchema = new Schema({
  technician: { type: Schema.Types.ObjectId, ref: "User", required: true },
  item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true },
  status: { type: String, enum: ["PENDING", "CONFIRMED", "REJECTED"], default: "PENDING" },
  requestedAt: { type: Date, default: Date.now },
  confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
  confirmedAt: { type: Date },
  rejectionReason: { type: String }
});
var IdempotencyRecordSchema = new Schema({
  key: { type: String, required: true },
  userId: { type: String, required: true },
  endpoint: { type: String, required: true },
  payloadHash: { type: String, required: true },
  status: { type: String, enum: ["IN_PROGRESS", "RESOLVED"], default: "IN_PROGRESS" },
  statusCode: { type: Number },
  responseBody: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 }
});
IdempotencyRecordSchema.index({ key: 1, userId: 1, endpoint: 1 }, { unique: true });
var UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
var ItemModel = mongoose.models.Item || mongoose.model("Item", ItemSchema);
var StockTransactionModel = mongoose.models.StockTransaction || mongoose.model("StockTransaction", StockTransactionSchema);
var WarehouseBalanceModel = mongoose.models.WarehouseBalance || mongoose.model("WarehouseBalance", WarehouseBalanceSchema);
var TechnicianBalanceModel = mongoose.models.TechnicianBalance || mongoose.model("TechnicianBalance", TechnicianBalanceSchema);
var ReturnRequestModel = mongoose.models.ReturnRequest || mongoose.model("ReturnRequest", ReturnRequestSchema);
var IdempotencyRecordModel = mongoose.models.IdempotencyRecord || mongoose.model("IdempotencyRecord", IdempotencyRecordSchema);
var InMemoryDatabase = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.items = /* @__PURE__ */ new Map();
    this.transactions = [];
    this.warehouseBalances = /* @__PURE__ */ new Map();
    // key = itemId
    this.technicianBalances = /* @__PURE__ */ new Map();
    // key = `${techId}_${itemId}`
    this.returnRequests = /* @__PURE__ */ new Map();
    this.idempotencyRecords = /* @__PURE__ */ new Map();
  }
  // key = `${userId}_${endpoint}_${key}`
  clearAll() {
    this.users.clear();
    this.items.clear();
    this.transactions = [];
    this.warehouseBalances.clear();
    this.technicianBalances.clear();
    this.returnRequests.clear();
    this.idempotencyRecords.clear();
  }
  generateId() {
    return new Types.ObjectId().toString();
  }
  cloneState() {
    return {
      users: new Map(Array.from(this.users.entries()).map(([k, v]) => [k, { ...v }])),
      items: new Map(Array.from(this.items.entries()).map(([k, v]) => [k, { ...v }])),
      transactions: this.transactions.map((t) => ({ ...t })),
      warehouseBalances: new Map(Array.from(this.warehouseBalances.entries()).map(([k, v]) => [k, { ...v }])),
      technicianBalances: new Map(Array.from(this.technicianBalances.entries()).map(([k, v]) => [k, { ...v }])),
      returnRequests: new Map(Array.from(this.returnRequests.entries()).map(([k, v]) => [k, { ...v }]))
    };
  }
  restoreState(state) {
    this.users = state.users;
    this.items = state.items;
    this.transactions = state.transactions;
    this.warehouseBalances = state.warehouseBalances;
    this.technicianBalances = state.technicianBalances;
    this.returnRequests = state.returnRequests;
  }
  scheduleSave() {
  }
};
var inMemoryDb = new InMemoryDatabase();
var isConnectedToMongo = false;
async function initDatabase() {
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      console.log(`[DB] Attempting MongoDB connection to ${mongoUri}...`);
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
      isConnectedToMongo = true;
      console.log("[DB] Successfully connected to MongoDB.");
      return;
    } catch (err) {
      console.warn(`[DB] Could not connect to external MongoDB: ${err.message}. Using built-in ACID transactional in-memory database engine.`);
      isConnectedToMongo = false;
    }
  } else {
    console.log("[DB] No MONGO_URI specified. Operating with built-in transactional in-memory database engine.");
  }
}
function isMongoConnected() {
  return isConnectedToMongo;
}

// backend/services/storageService.ts
var storageService = {
  // --- USERS ---
  async findUserByPhone(phone) {
    if (isMongoConnected()) {
      const doc = await UserModel.findOne({ phone }).lean();
      return doc ? doc : null;
    }
    for (const u of inMemoryDb.users.values()) {
      if (u.phone === phone) return { ...u };
    }
    return null;
  },
  async findUserById(id) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await UserModel.findById(id).lean();
      return doc ? doc : null;
    }
    const u = inMemoryDb.users.get(id);
    return u ? { ...u } : null;
  },
  async createUser(userData) {
    if (isMongoConnected()) {
      const doc = await UserModel.create(userData);
      return doc.toObject();
    }
    const _id = userData._id || inMemoryDb.generateId();
    const newUser = {
      ...userData,
      _id,
      isActive: userData.isActive !== void 0 ? userData.isActive : true,
      createdAt: userData.createdAt || /* @__PURE__ */ new Date()
    };
    inMemoryDb.users.set(_id, newUser);
    return { ...newUser };
  },
  async listTechnicians() {
    if (isMongoConnected()) {
      const list = await UserModel.find({ role: "technician" }).sort({ name: 1 }).lean();
      return list;
    }
    return Array.from(inMemoryDb.users.values()).filter((u) => u.role === "technician").sort((a, b) => a.name.localeCompare(b.name));
  },
  async listUsers() {
    if (isMongoConnected()) {
      return await UserModel.find().sort({ name: 1 }).lean();
    }
    return Array.from(inMemoryDb.users.values()).sort((a, b) => a.name.localeCompare(b.name));
  },
  async updateUser(id, updates) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await UserModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
      return doc ? doc : null;
    }
    const existing = inMemoryDb.users.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      _id: id
    };
    inMemoryDb.users.set(id, updated);
    return { ...updated };
  },
  async deleteUser(id) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return false;
    }
    if (isMongoConnected()) {
      const res = await UserModel.findByIdAndDelete(id);
      return !!res;
    }
    return inMemoryDb.users.delete(id);
  },
  // --- ITEMS ---
  async findItemById(id) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ItemModel.findById(id).lean();
      return doc ? doc : null;
    }
    const item = inMemoryDb.items.get(id);
    return item ? { ...item } : null;
  },
  async findItemByCode(code) {
    if (isMongoConnected()) {
      const doc = await ItemModel.findOne({ itemCode: code }).lean();
      return doc ? doc : null;
    }
    for (const item of inMemoryDb.items.values()) {
      if (item.itemCode.toLowerCase() === code.toLowerCase()) {
        return { ...item };
      }
    }
    return null;
  },
  async clearAllData() {
    if (isMongoConnected()) {
      await Promise.all([
        UserModel.deleteMany({}),
        ItemModel.deleteMany({}),
        StockTransactionModel.deleteMany({}),
        WarehouseBalanceModel.deleteMany({}),
        TechnicianBalanceModel.deleteMany({}),
        ReturnRequestModel.deleteMany({})
      ]);
      return;
    }
    inMemoryDb.clearAll();
  },
  async createItem(itemData) {
    const rawThreshold = itemData.lowStockThreshold !== void 0 ? itemData.lowStockThreshold : itemData.reorderLevel !== void 0 ? itemData.reorderLevel : 5;
    const parsedThreshold = Number(rawThreshold);
    const thresholdVal = isNaN(parsedThreshold) || parsedThreshold < 0 ? 5 : parsedThreshold;
    const dataToSave = {
      ...itemData,
      lowStockThreshold: thresholdVal,
      reorderLevel: thresholdVal
    };
    if (isMongoConnected()) {
      const doc = await ItemModel.create(dataToSave);
      await WarehouseBalanceModel.create({
        item: doc._id,
        quantity: 0,
        lastUpdated: /* @__PURE__ */ new Date()
      });
      return doc.toObject();
    }
    const _id = itemData._id || inMemoryDb.generateId();
    const newItem = {
      ...dataToSave,
      _id,
      brand: itemData.brand || "",
      storageLocation: itemData.storageLocation || "",
      description: itemData.description || "",
      isKit: Boolean(itemData.isKit || itemData.category === "One Kit" || itemData.category && itemData.category.includes("Kit")),
      kitComponents: itemData.kitComponents || "",
      supplier: itemData.supplier || "",
      hsnCode: itemData.hsnCode || "",
      barcode: itemData.barcode || "",
      price: itemData.price !== void 0 ? Number(itemData.price) : 0,
      oldPrice: itemData.oldPrice !== void 0 ? Number(itemData.oldPrice) : itemData.price !== void 0 ? Number(itemData.price) : 0,
      newPrice: itemData.newPrice !== void 0 ? Number(itemData.newPrice) : itemData.price !== void 0 ? Number(itemData.price) : 0,
      priceNotes: itemData.priceNotes || "",
      priceUpdatedAt: itemData.priceUpdatedAt || /* @__PURE__ */ new Date(),
      gkkType: itemData.gkkType || "",
      lowStockThreshold: thresholdVal,
      reorderLevel: thresholdVal,
      isActive: itemData.isActive !== void 0 ? itemData.isActive : true,
      unit: itemData.unit || "pcs",
      createdAt: itemData.createdAt || /* @__PURE__ */ new Date()
    };
    inMemoryDb.items.set(_id, newItem);
    inMemoryDb.warehouseBalances.set(_id, {
      _id: inMemoryDb.generateId(),
      item: _id,
      quantity: 0,
      lastUpdated: /* @__PURE__ */ new Date()
    });
    return { ...newItem };
  },
  async updateItem(id, updates) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.lowStockThreshold !== void 0) {
      const t = Number(normalizedUpdates.lowStockThreshold);
      const val = isNaN(t) || t < 0 ? 5 : t;
      normalizedUpdates.lowStockThreshold = val;
      normalizedUpdates.reorderLevel = val;
    } else if (normalizedUpdates.reorderLevel !== void 0) {
      const r = Number(normalizedUpdates.reorderLevel);
      const val = isNaN(r) || r < 0 ? 5 : r;
      normalizedUpdates.lowStockThreshold = val;
      normalizedUpdates.reorderLevel = val;
    }
    if (isMongoConnected()) {
      const doc = await ItemModel.findByIdAndUpdate(id, normalizedUpdates, { new: true }).lean();
      return doc ? doc : null;
    }
    const existing = inMemoryDb.items.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...normalizedUpdates,
      lowStockThreshold: normalizedUpdates.lowStockThreshold ?? existing.lowStockThreshold ?? existing.reorderLevel ?? 5,
      reorderLevel: normalizedUpdates.reorderLevel ?? existing.reorderLevel ?? existing.lowStockThreshold ?? 5
    };
    inMemoryDb.items.set(id, updated);
    return { ...updated };
  },
  async listItems(query) {
    if (isMongoConnected()) {
      const filter = {};
      if (query?.category) filter.category = query.category;
      if (query?.isActive !== void 0) filter.isActive = query.isActive;
      if (query?.search) {
        filter.$or = [
          { itemName: { $regex: query.search, $options: "i" } },
          { itemCode: { $regex: query.search, $options: "i" } },
          { compatibleModels: { $regex: query.search, $options: "i" } },
          { gkkType: { $regex: query.search, $options: "i" } }
        ];
      }
      return await ItemModel.find(filter).sort({ itemCode: 1 }).lean();
    }
    let items = Array.from(inMemoryDb.items.values());
    if (query?.category) {
      items = items.filter((i) => i.category === query.category);
    }
    if (query?.isActive !== void 0) {
      items = items.filter((i) => i.isActive === query.isActive);
    }
    if (query?.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (i) => i.itemName.toLowerCase().includes(s) || i.itemCode.toLowerCase().includes(s) || (i.compatibleModels || "").toLowerCase().includes(s) || (i.gkkType || "").toLowerCase().includes(s) || (i.brand || "").toLowerCase().includes(s) || (i.kitComponents || "").toLowerCase().includes(s) || (i.storageLocation || "").toLowerCase().includes(s)
      );
    }
    return items.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  },
  // --- WAREHOUSE BALANCES ---
  async getWarehouseBalance(itemId) {
    if (isMongoConnected()) {
      const doc = await WarehouseBalanceModel.findOne({ item: itemId }).lean();
      return doc ? doc.quantity : 0;
    }
    const bal = inMemoryDb.warehouseBalances.get(itemId);
    return bal ? bal.quantity : 0;
  },
  async updateWarehouseBalance(itemId, delta) {
    if (isMongoConnected()) {
      const doc = await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $inc: { quantity: delta }, $set: { lastUpdated: /* @__PURE__ */ new Date() } },
        { upsert: true, new: true }
      ).lean();
      return doc.quantity;
    }
    let bal = inMemoryDb.warehouseBalances.get(itemId);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        item: itemId,
        quantity: 0,
        lastUpdated: /* @__PURE__ */ new Date()
      };
    }
    bal.quantity = Math.round((bal.quantity + delta) * 100) / 100;
    bal.lastUpdated = /* @__PURE__ */ new Date();
    inMemoryDb.warehouseBalances.set(itemId, bal);
    return bal.quantity;
  },
  async setWarehouseBalanceDirect(itemId, newQty) {
    if (isMongoConnected()) {
      await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $set: { quantity: newQty, lastUpdated: /* @__PURE__ */ new Date() } },
        { upsert: true }
      );
      return;
    }
    let bal = inMemoryDb.warehouseBalances.get(itemId);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        item: itemId,
        quantity: newQty,
        lastUpdated: /* @__PURE__ */ new Date()
      };
    } else {
      bal.quantity = newQty;
      bal.lastUpdated = /* @__PURE__ */ new Date();
    }
    inMemoryDb.warehouseBalances.set(itemId, bal);
  },
  async getAllWarehouseBalances() {
    const items = await this.listItems();
    const result = [];
    for (const item of items) {
      const qty = await this.getWarehouseBalance(item._id);
      const balDoc = inMemoryDb.warehouseBalances.get(item._id);
      result.push({
        item,
        quantity: qty,
        lastUpdated: balDoc?.lastUpdated || item.createdAt || /* @__PURE__ */ new Date()
      });
    }
    return result;
  },
  // --- TECHNICIAN BALANCES ---
  async getTechnicianBalance(technicianId, itemId) {
    if (isMongoConnected()) {
      const doc = await TechnicianBalanceModel.findOne({ technician: technicianId, item: itemId }).lean();
      return doc ? doc.quantity : 0;
    }
    const key = `${technicianId}_${itemId}`;
    const bal = inMemoryDb.technicianBalances.get(key);
    return bal ? bal.quantity : 0;
  },
  async updateTechnicianBalance(technicianId, itemId, delta) {
    if (isMongoConnected()) {
      const doc = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: technicianId, item: itemId },
        { $inc: { quantity: delta }, $set: { lastUpdated: /* @__PURE__ */ new Date() } },
        { upsert: true, new: true }
      ).lean();
      return doc.quantity;
    }
    const key = `${technicianId}_${itemId}`;
    let bal = inMemoryDb.technicianBalances.get(key);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        technician: technicianId,
        item: itemId,
        quantity: 0,
        lastUpdated: /* @__PURE__ */ new Date()
      };
    }
    bal.quantity = Math.round((bal.quantity + delta) * 100) / 100;
    bal.lastUpdated = /* @__PURE__ */ new Date();
    inMemoryDb.technicianBalances.set(key, bal);
    return bal.quantity;
  },
  async setTechnicianBalanceDirect(technicianId, itemId, newQty) {
    if (isMongoConnected()) {
      await TechnicianBalanceModel.findOneAndUpdate(
        { technician: technicianId, item: itemId },
        { $set: { quantity: newQty, lastUpdated: /* @__PURE__ */ new Date() } },
        { upsert: true }
      );
      return;
    }
    const key = `${technicianId}_${itemId}`;
    let bal = inMemoryDb.technicianBalances.get(key);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        technician: technicianId,
        item: itemId,
        quantity: newQty,
        lastUpdated: /* @__PURE__ */ new Date()
      };
    } else {
      bal.quantity = newQty;
      bal.lastUpdated = /* @__PURE__ */ new Date();
    }
    inMemoryDb.technicianBalances.set(key, bal);
  },
  async getBalancesForTechnician(technicianId) {
    const items = await this.listItems();
    const list = [];
    for (const item of items) {
      const qty = await this.getTechnicianBalance(technicianId, item._id);
      if (qty > 0) {
        list.push({ item, quantity: qty });
      }
    }
    return list;
  },
  async getAllTechnicianBalancesMatrix() {
    const technicians = await this.listTechnicians();
    const items = await this.listItems();
    const matrix = await Promise.all(
      items.map(async (item) => {
        const warehouseQty = await this.getWarehouseBalance(item._id);
        const techBalances = {};
        let totalHeldByTechs = 0;
        for (const tech of technicians) {
          const qty = await this.getTechnicianBalance(tech._id, item._id);
          techBalances[tech._id] = qty;
          totalHeldByTechs += qty;
        }
        return {
          item,
          warehouseQty,
          techBalances,
          totalHeldByTechs: Math.round(totalHeldByTechs * 100) / 100
        };
      })
    );
    return { technicians, items, matrix };
  },
  // --- TRANSACTIONS (IMMUTABLE LEDGER) ---
  async insertStockTransaction(txData) {
    if (isMongoConnected()) {
      const doc = await StockTransactionModel.create({
        ...txData,
        createdAt: txData.createdAt || /* @__PURE__ */ new Date(),
        transactionDate: txData.transactionDate || /* @__PURE__ */ new Date()
      });
      return doc.toObject();
    }
    const _id = txData._id || inMemoryDb.generateId();
    const newTx = {
      ...txData,
      _id,
      transactionDate: txData.transactionDate || /* @__PURE__ */ new Date(),
      createdAt: txData.createdAt || /* @__PURE__ */ new Date()
    };
    inMemoryDb.transactions.unshift(newTx);
    return { ...newTx };
  },
  async listStockTransactions(filter) {
    let rawList = [];
    if (isMongoConnected()) {
      const query = {};
      if (filter?.itemId) query.item = filter.itemId;
      if (filter?.technicianId) query.technician = filter.technicianId;
      if (filter?.type) query.transactionType = filter.type;
      if (filter?.fromDate || filter?.toDate) {
        query.transactionDate = {};
        if (filter.fromDate) query.transactionDate.$gte = new Date(filter.fromDate);
        if (filter.toDate) query.transactionDate.$lte = new Date(filter.toDate);
      }
      rawList = await StockTransactionModel.find(query).sort({ transactionDate: -1, createdAt: -1 }).limit(filter?.limit || 200).lean();
    } else {
      rawList = [...inMemoryDb.transactions];
      if (filter?.itemId) {
        rawList = rawList.filter((t) => (typeof t.item === "string" ? t.item : t.item._id) === filter.itemId);
      }
      if (filter?.technicianId) {
        rawList = rawList.filter((t) => {
          if (!t.technician) return false;
          const tid = typeof t.technician === "string" ? t.technician : t.technician._id;
          return tid === filter.technicianId;
        });
      }
      if (filter?.type) {
        rawList = rawList.filter((t) => t.transactionType === filter.type);
      }
      if (filter?.fromDate) {
        const from = new Date(filter.fromDate).getTime();
        rawList = rawList.filter((t) => new Date(t.transactionDate).getTime() >= from);
      }
      if (filter?.toDate) {
        const to = new Date(filter.toDate).getTime();
        rawList = rawList.filter((t) => new Date(t.transactionDate).getTime() <= to);
      }
      rawList.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
      if (filter?.limit) {
        rawList = rawList.slice(0, filter.limit);
      }
    }
    const populated = await Promise.all(
      rawList.map(async (tx) => {
        const itemId = typeof tx.item === "string" ? tx.item : tx.item?._id;
        const item = await this.findItemById(itemId) || tx.item;
        let technician = void 0;
        if (tx.technician) {
          const techId = typeof tx.technician === "string" ? tx.technician : tx.technician?._id;
          technician = await this.findUserById(techId) || tx.technician;
        }
        const performerId = typeof tx.performedBy === "string" ? tx.performedBy : tx.performedBy?._id;
        const performedBy = await this.findUserById(performerId) || tx.performedBy;
        return {
          ...tx,
          item,
          technician,
          performedBy
        };
      })
    );
    return populated;
  },
  // --- RETURN REQUESTS ---
  async createReturnRequest(data) {
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.create({
        ...data,
        status: "PENDING",
        requestedAt: /* @__PURE__ */ new Date()
      });
      return doc.toObject();
    }
    const _id = inMemoryDb.generateId();
    const newReq = {
      ...data,
      _id,
      status: "PENDING",
      requestedAt: /* @__PURE__ */ new Date()
    };
    inMemoryDb.returnRequests.set(_id, newReq);
    return { ...newReq };
  },
  async findReturnRequestById(id) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.findById(id).lean();
      return doc ? doc : null;
    }
    const req = inMemoryDb.returnRequests.get(id);
    return req ? { ...req } : null;
  },
  async updateReturnRequest(id, updates) {
    if (!id || typeof id !== "string" || !Types2.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.findByIdAndUpdate(id, updates, { new: true }).lean();
      return doc ? doc : null;
    }
    const existing = inMemoryDb.returnRequests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    inMemoryDb.returnRequests.set(id, updated);
    return { ...updated };
  },
  async listReturnRequests(filter) {
    let rawList = [];
    if (isMongoConnected()) {
      const query = {};
      if (filter?.technicianId) query.technician = filter.technicianId;
      if (filter?.status) query.status = filter.status;
      rawList = await ReturnRequestModel.find(query).sort({ requestedAt: -1 }).lean();
    } else {
      rawList = Array.from(inMemoryDb.returnRequests.values());
      if (filter?.technicianId) {
        rawList = rawList.filter((r) => {
          const tid = typeof r.technician === "string" ? r.technician : r.technician._id;
          return tid === filter.technicianId;
        });
      }
      if (filter?.status) {
        rawList = rawList.filter((r) => r.status === filter.status);
      }
      rawList.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
    const populated = await Promise.all(
      rawList.map(async (r) => {
        const itemId = typeof r.item === "string" ? r.item : r.item?._id;
        const item = await this.findItemById(itemId) || r.item;
        const techId = typeof r.technician === "string" ? r.technician : r.technician?._id;
        const technician = await this.findUserById(techId) || r.technician;
        let confirmedBy = void 0;
        if (r.confirmedBy) {
          const confId = typeof r.confirmedBy === "string" ? r.confirmedBy : r.confirmedBy?._id;
          confirmedBy = await this.findUserById(confId) || r.confirmedBy;
        }
        return {
          ...r,
          item,
          technician,
          confirmedBy
        };
      })
    );
    return populated;
  },
  // --- RECONCILIATION & RE-SUM FROM LEDGER (CORE DESIGN PRINCIPLE) ---
  /**
   * Independently re-sums the entire ledger from scratch for every item
   * and verifies against the fast-read cached balances.
   *
   * The formula:
   * Total Purchased (all time) = Current Warehouse Balance + SUM(Current Balance across ALL Technicians) + Total Consumed (all time) + Total Damaged/Written-off (all time)
   */
  async computeReconciliation(recalculateAndResync = false) {
    const items = await this.listItems();
    const technicians = await this.listTechnicians();
    let allTransactions = [];
    if (isMongoConnected()) {
      allTransactions = await StockTransactionModel.find().lean();
    } else {
      allTransactions = [...inMemoryDb.transactions];
    }
    let summaryTotalPurchased = 0;
    let summaryWarehouse = 0;
    let summaryTech = 0;
    let summaryConsumed = 0;
    let summaryDamaged = 0;
    let matchedCount = 0;
    let mismatchedCount = 0;
    const reconciliationList = [];
    for (const item of items) {
      const itemId = item._id.toString();
      let totalPurchased = 0;
      let totalIssued = 0;
      let totalUsed = 0;
      let totalReturned = 0;
      let totalDamaged = 0;
      let totalAdjusted = 0;
      const itemTxList = allTransactions.filter((tx) => {
        const txItemId = typeof tx.item === "string" ? tx.item : tx.item?._id?.toString();
        return txItemId === itemId;
      });
      for (const tx of itemTxList) {
        const qty = Number(tx.quantity) || 0;
        switch (tx.transactionType) {
          case "PURCHASE_IN":
            totalPurchased += qty;
            break;
          case "ISSUE_TO_TECH":
            totalIssued += qty;
            break;
          case "USAGE_AT_SITE":
            totalUsed += qty;
            break;
          case "RETURN_TO_WAREHOUSE":
            totalReturned += qty;
            break;
          case "DAMAGE_WRITEOFF":
            totalDamaged += qty;
            break;
          case "ADJUSTMENT":
            totalAdjusted += qty;
            break;
        }
      }
      const calculatedWarehouse = Math.round((totalPurchased - totalIssued + totalReturned - totalDamaged + totalAdjusted) * 100) / 100;
      const calculatedTechTotal = Math.round((totalIssued - totalUsed - totalReturned) * 100) / 100;
      let currentWarehouse = await this.getWarehouseBalance(itemId);
      let currentTechTotal = 0;
      for (const tech of technicians) {
        const tQty = await this.getTechnicianBalance(tech._id.toString(), itemId);
        currentTechTotal += tQty;
      }
      currentTechTotal = Math.round(currentTechTotal * 100) / 100;
      if (recalculateAndResync) {
        if (currentWarehouse !== calculatedWarehouse) {
          await this.setWarehouseBalanceDirect(itemId, calculatedWarehouse);
          currentWarehouse = calculatedWarehouse;
        }
        for (const tech of technicians) {
          const techId = tech._id.toString();
          let techItemIssued = 0;
          let techItemUsed = 0;
          let techItemReturned = 0;
          for (const tx of itemTxList) {
            const txTechId = typeof tx.technician === "string" ? tx.technician : tx.technician?._id?.toString();
            if (txTechId === techId) {
              const qty = Number(tx.quantity) || 0;
              if (tx.transactionType === "ISSUE_TO_TECH") techItemIssued += qty;
              if (tx.transactionType === "USAGE_AT_SITE") techItemUsed += qty;
              if (tx.transactionType === "RETURN_TO_WAREHOUSE") techItemReturned += qty;
            }
          }
          const actualTechStock = Math.round((techItemIssued - techItemUsed - techItemReturned) * 100) / 100;
          await this.setTechnicianBalanceDirect(techId, itemId, Math.max(0, actualTechStock));
        }
        currentTechTotal = 0;
        for (const tech of technicians) {
          currentTechTotal += await this.getTechnicianBalance(tech._id.toString(), itemId);
        }
        currentTechTotal = Math.round(currentTechTotal * 100) / 100;
      }
      const expectedAvailable = Math.round((totalPurchased - totalUsed - totalDamaged) * 100) / 100;
      const actualAvailable = Math.round((currentWarehouse + currentTechTotal) * 100) / 100;
      const variance = Math.round((expectedAvailable - actualAvailable) * 100) / 100;
      const status = Math.abs(variance) < 1e-3 ? "MATCHED" : "MISMATCH";
      if (status === "MATCHED") {
        matchedCount++;
      } else {
        mismatchedCount++;
      }
      summaryTotalPurchased += totalPurchased;
      summaryWarehouse += currentWarehouse;
      summaryTech += currentTechTotal;
      summaryConsumed += totalUsed;
      summaryDamaged += totalDamaged;
      reconciliationList.push({
        item,
        totalPurchased: Math.round(totalPurchased * 100) / 100,
        totalConsumed: Math.round(totalUsed * 100) / 100,
        totalDamaged: Math.round(totalDamaged * 100) / 100,
        warehouseBalance: currentWarehouse,
        techniciansTotalBalance: currentTechTotal,
        expectedAvailable,
        actualAvailable,
        variance,
        status,
        ledgerAudit: {
          totalPurchased,
          totalIssued,
          totalUsed,
          totalReturned,
          totalDamaged,
          totalAdjusted,
          calculatedWarehouse,
          calculatedTechTotal
        }
      });
    }
    return {
      items: reconciliationList,
      summary: {
        totalItems: items.length,
        matchedCount,
        mismatchedCount,
        overallSystemStatus: mismatchedCount === 0 ? "PERFECT_MATCH" : "DISCREPANCY_DETECTED",
        totalPurchasedQty: Math.round(summaryTotalPurchased * 100) / 100,
        totalWarehouseQty: Math.round(summaryWarehouse * 100) / 100,
        totalTechQty: Math.round(summaryTech * 100) / 100,
        totalConsumedQty: Math.round(summaryConsumed * 100) / 100,
        totalDamagedQty: Math.round(summaryDamaged * 100) / 100
      }
    };
  }
};

// backend/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "field_service_stock_secret_jwt_key_2026";
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (typeof req.query.token === "string" && req.query.token.trim()) {
      token = req.query.token.trim();
    }
    if (!token) {
      return res.status(401).json({ error: "Authentication required. Missing or malformed token." });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await storageService.findUserById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User account is inactive or not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access forbidden: Required role [${allowedRoles.join(", ")}]. Current role: ${req.user.role}`
      });
    }
    next();
  };
}
var requireAdmin = requireRole(["admin"]);

// backend/controllers/authController.ts
var authController = {
  async login(req, res) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: "Phone number and password are required." });
      }
      const user = await storageService.findUserByPhone(phone.trim());
      if (!user) {
        return res.status(401).json({ error: "Invalid phone number or password." });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated. Please contact your manager." });
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid phone number or password." });
      }
      const token = generateToken(user);
      const userSafe = {
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
      };
      return res.json({
        message: "Login successful",
        token,
        user: userSafe
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Internal server error during authentication." });
    }
  },
  async getMe(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { passwordHash, ...userSafe } = req.user;
    return res.json({ user: userSafe });
  }
};

// backend/routes/authRoutes.ts
var router = Router();
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.getMe);
var authRoutes_default = router;

// backend/routes/itemRoutes.ts
import { Router as Router2 } from "express";

// backend/controllers/itemController.ts
var VALID_CATEGORIES = [
  "One Kit",
  "GKK1",
  "GKK2",
  "SF",
  "UV Lamp",
  "Mineral Cartridge",
  "Spare Part",
  "Other"
];
var itemController = {
  async getItems(req, res) {
    try {
      const { category, search, isActive } = req.query;
      const items = await storageService.listItems({
        category,
        search,
        isActive: isActive !== void 0 ? isActive === "true" : void 0
      });
      const itemsWithBalance = await Promise.all(
        items.map(async (item) => {
          const warehouseQty = await storageService.getWarehouseBalance(item._id);
          const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
          return {
            ...item,
            lowStockThreshold: threshold,
            reorderLevel: threshold,
            warehouseQty,
            isLowStock: warehouseQty <= threshold
          };
        })
      );
      return res.json({ items: itemsWithBalance });
    } catch (err) {
      console.error("Error fetching items:", err);
      return res.status(500).json({ error: "Failed to retrieve item catalog." });
    }
  },
  async addItem(req, res) {
    try {
      const {
        itemCode,
        itemName,
        category,
        unit,
        compatibleModels,
        lowStockThreshold,
        reorderLevel,
        price,
        oldPrice,
        newPrice,
        priceNotes,
        gkkType,
        brand,
        storageLocation,
        description,
        isKit,
        kitComponents,
        supplier,
        hsnCode,
        barcode,
        initialStock,
        initialQuantity,
        initialInvoiceNumber,
        inwardRemarks
      } = req.body;
      if (!itemCode || !itemName || !category) {
        return res.status(400).json({ error: "itemCode, itemName, and category are required." });
      }
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
        });
      }
      const existing = await storageService.findItemByCode(itemCode.trim());
      if (existing) {
        return res.status(400).json({ error: `An item with item code '${itemCode}' already exists.` });
      }
      const rawThreshold = lowStockThreshold !== void 0 ? lowStockThreshold : reorderLevel;
      const parsedThreshold = Number(rawThreshold);
      const thresholdVal = isNaN(parsedThreshold) || parsedThreshold < 0 ? 5 : parsedThreshold;
      const parsedPrice = price !== void 0 ? Number(price) : 0;
      const parsedOldPrice = oldPrice !== void 0 ? Number(oldPrice) : parsedPrice;
      const parsedNewPrice = newPrice !== void 0 ? Number(newPrice) : parsedPrice || parsedOldPrice;
      const isKitFlag = Boolean(isKit || category === "One Kit" || category && category.includes("Kit"));
      const newItem = await storageService.createItem({
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        category,
        unit: unit?.trim() || (isKitFlag ? "kit" : category === "SF" ? "pcs" : "pcs"),
        price: isNaN(parsedNewPrice) ? isNaN(parsedPrice) ? 0 : parsedPrice : parsedNewPrice,
        oldPrice: isNaN(parsedOldPrice) ? 0 : parsedOldPrice,
        newPrice: isNaN(parsedNewPrice) ? 0 : parsedNewPrice,
        priceNotes: priceNotes?.trim() || "",
        priceUpdatedAt: /* @__PURE__ */ new Date(),
        gkkType: gkkType?.trim() || category,
        compatibleModels: compatibleModels?.trim() || "",
        brand: brand?.trim() || "",
        storageLocation: storageLocation?.trim() || "",
        description: description?.trim() || "",
        isKit: isKitFlag,
        kitComponents: kitComponents?.trim() || "",
        supplier: supplier?.trim() || "",
        hsnCode: hsnCode?.trim() || "",
        barcode: barcode?.trim() || "",
        lowStockThreshold: thresholdVal,
        reorderLevel: thresholdVal,
        isActive: true
      });
      const startQty = Number(initialStock !== void 0 ? initialStock : initialQuantity);
      if (!isNaN(startQty) && startQty > 0) {
        await storageService.updateWarehouseBalance(newItem._id, startQty);
        await storageService.insertStockTransaction({
          transactionType: "PURCHASE_IN",
          item: newItem._id,
          quantity: startQty,
          supplierName: supplier?.trim() || "Central Warehouse Opening Setup",
          invoiceNumber: initialInvoiceNumber?.trim() || `INIT-${newItem.itemCode}`,
          performedBy: req.user?._id || "admin",
          remarks: inwardRemarks?.trim() || `Opening warehouse inventory for ${isKitFlag ? "Kit" : "Item"} (${startQty} ${newItem.unit})`,
          transactionDate: /* @__PURE__ */ new Date()
        });
      }
      const currentWarehouseQty = await storageService.getWarehouseBalance(newItem._id);
      return res.status(201).json({
        message: `${isKitFlag ? "Kit" : "Inventory item"} added successfully to catalog${startQty > 0 ? ` with ${startQty} units inwarded` : ""}`,
        item: {
          ...newItem,
          warehouseQty: currentWarehouseQty,
          isLowStock: currentWarehouseQty <= thresholdVal
        }
      });
    } catch (err) {
      console.error("Error adding item:", err);
      return res.status(500).json({ error: "Failed to add item." });
    }
  },
  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const {
        itemName,
        category,
        unit,
        compatibleModels,
        lowStockThreshold,
        reorderLevel,
        isActive,
        price,
        oldPrice,
        newPrice,
        priceNotes,
        gkkType,
        brand,
        storageLocation,
        description,
        isKit,
        kitComponents,
        supplier,
        hsnCode,
        barcode
      } = req.body;
      const item = await storageService.findItemById(id);
      if (!item) {
        return res.status(404).json({ error: "Item not found." });
      }
      if (category && !VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
        });
      }
      const updates = {};
      if (itemName !== void 0) updates.itemName = itemName.trim();
      if (category !== void 0) updates.category = category;
      if (unit !== void 0) updates.unit = unit.trim();
      if (compatibleModels !== void 0) updates.compatibleModels = compatibleModels.trim();
      if (gkkType !== void 0) updates.gkkType = gkkType.trim();
      if (brand !== void 0) updates.brand = brand.trim();
      if (storageLocation !== void 0) updates.storageLocation = storageLocation.trim();
      if (description !== void 0) updates.description = description.trim();
      if (isKit !== void 0) updates.isKit = Boolean(isKit);
      if (kitComponents !== void 0) updates.kitComponents = kitComponents.trim();
      if (supplier !== void 0) updates.supplier = supplier.trim();
      if (hsnCode !== void 0) updates.hsnCode = hsnCode.trim();
      if (barcode !== void 0) updates.barcode = barcode.trim();
      let priceChanged = false;
      if (oldPrice !== void 0) {
        updates.oldPrice = Number(oldPrice) || 0;
        priceChanged = true;
      }
      if (newPrice !== void 0) {
        const np = Number(newPrice) || 0;
        updates.newPrice = np;
        updates.price = np;
        priceChanged = true;
      } else if (price !== void 0) {
        const p = Number(price) || 0;
        updates.price = p;
        if (updates.newPrice === void 0) updates.newPrice = p;
        priceChanged = true;
      }
      if (priceNotes !== void 0) updates.priceNotes = priceNotes.trim();
      if (priceChanged) updates.priceUpdatedAt = /* @__PURE__ */ new Date();
      const rawThreshold = lowStockThreshold !== void 0 ? lowStockThreshold : reorderLevel;
      if (rawThreshold !== void 0) {
        const r = Number(rawThreshold);
        const thresholdVal = isNaN(r) || r < 0 ? 5 : r;
        updates.lowStockThreshold = thresholdVal;
        updates.reorderLevel = thresholdVal;
      }
      if (isActive !== void 0) updates.isActive = Boolean(isActive);
      const updated = await storageService.updateItem(id, updates);
      return res.json({ message: "Item updated successfully", item: updated });
    } catch (err) {
      console.error("Error updating item:", err);
      return res.status(500).json({ error: "Failed to update item." });
    }
  },
  // Bulk update prices across all kits in one swift call
  async bulkUpdatePrices(req, res) {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "updates array is required." });
      }
      const updatedItems = [];
      for (const entry of updates) {
        if (!entry.id) continue;
        const oldP = Number(entry.oldPrice) || 0;
        const newP = Number(entry.newPrice) || 0;
        const patch = {
          oldPrice: oldP,
          newPrice: newP,
          price: newP,
          // base price synchronized with new printed MRP
          priceUpdatedAt: /* @__PURE__ */ new Date()
        };
        if (entry.priceNotes !== void 0) {
          patch.priceNotes = String(entry.priceNotes).trim();
        }
        const updated = await storageService.updateItem(entry.id, patch);
        if (updated) {
          updatedItems.push(updated);
        }
      }
      return res.json({
        message: `Successfully updated prices for ${updatedItems.length} kit(s).`,
        updatedCount: updatedItems.length,
        items: updatedItems
      });
    } catch (err) {
      console.error("Error bulk updating prices:", err);
      return res.status(500).json({ error: "Failed to bulk update prices." });
    }
  }
};

// backend/routes/itemRoutes.ts
var router2 = Router2();
router2.get("/", requireAuth, itemController.getItems);
router2.post("/", requireAuth, requireAdmin, itemController.addItem);
router2.post("/bulk-update-prices", requireAuth, requireAdmin, itemController.bulkUpdatePrices);
router2.put("/:id/prices", requireAuth, requireAdmin, itemController.updateItem);
router2.put("/:id", requireAuth, requireAdmin, itemController.updateItem);
var itemRoutes_default = router2;

// backend/routes/technicianRoutes.ts
import { Router as Router3 } from "express";

// backend/controllers/technicianController.ts
import bcrypt2 from "bcryptjs";
var technicianController = {
  async getTechnicians(req, res) {
    try {
      const technicians = await storageService.listTechnicians();
      const safeTechs = await Promise.all(
        technicians.map(async ({ passwordHash, ...tech }) => {
          const balances = await storageService.getBalancesForTechnician(tech._id.toString());
          const totalHeldQty = balances.reduce((sum, b) => sum + b.quantity, 0);
          return {
            ...tech,
            totalHeldQty
          };
        })
      );
      return res.json({ technicians: safeTechs });
    } catch (err) {
      console.error("Error fetching technicians:", err);
      return res.status(500).json({ error: "Failed to retrieve technicians." });
    }
  },
  async addTechnician(req, res) {
    try {
      const { name, phone, password, area, employeeCode, email, notes } = req.body;
      if (!name || !phone || !password) {
        return res.status(400).json({ error: "Name, phone number, and password are required." });
      }
      const cleanPhone = phone.trim();
      const existing = await storageService.findUserByPhone(cleanPhone);
      if (existing) {
        return res.status(400).json({ error: `A user with phone number '${cleanPhone}' already exists.` });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      const salt = await bcrypt2.genSalt(10);
      const passwordHash = await bcrypt2.hash(password, salt);
      const newTech = await storageService.createUser({
        name: name.trim(),
        phone: cleanPhone,
        passwordHash,
        role: "technician",
        isActive: true,
        area: area ? area.trim() : void 0,
        employeeCode: employeeCode ? employeeCode.trim() : void 0,
        email: email ? email.trim() : void 0,
        notes: notes ? notes.trim() : void 0
      });
      const { passwordHash: _, ...safeTech } = newTech;
      return res.status(201).json({
        message: "Technician created successfully",
        technician: { ...safeTech, totalHeldQty: 0 }
      });
    } catch (err) {
      console.error("Error creating technician:", err);
      return res.status(500).json({ error: "Failed to create technician." });
    }
  },
  async updateTechnician(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, area, employeeCode, email, notes, isActive, password } = req.body;
      const existing = await storageService.findUserById(id);
      if (!existing) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const updates = {};
      if (name !== void 0) updates.name = name.trim();
      if (area !== void 0) updates.area = area.trim();
      if (employeeCode !== void 0) updates.employeeCode = employeeCode.trim();
      if (email !== void 0) updates.email = email.trim();
      if (notes !== void 0) updates.notes = notes.trim();
      if (isActive !== void 0) updates.isActive = Boolean(isActive);
      if (phone && phone.trim() !== existing.phone) {
        const cleanPhone = phone.trim();
        const conflict = await storageService.findUserByPhone(cleanPhone);
        if (conflict && conflict._id.toString() !== id) {
          return res.status(400).json({ error: `Phone number '${cleanPhone}' is already in use by another user.` });
        }
        updates.phone = cleanPhone;
      }
      if (password && password.trim().length >= 6) {
        const salt = await bcrypt2.genSalt(10);
        updates.passwordHash = await bcrypt2.hash(password.trim(), salt);
      }
      const updated = await storageService.updateUser(id, updates);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update technician." });
      }
      const { passwordHash: _, ...safeTech } = updated;
      const balances = await storageService.getBalancesForTechnician(id);
      const totalHeldQty = balances.reduce((sum, b) => sum + b.quantity, 0);
      return res.json({
        message: "Technician profile updated successfully",
        technician: { ...safeTech, totalHeldQty }
      });
    } catch (err) {
      console.error("Error updating technician:", err);
      return res.status(500).json({ error: "Failed to update technician." });
    }
  },
  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long." });
      }
      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const salt = await bcrypt2.genSalt(10);
      const passwordHash = await bcrypt2.hash(password, salt);
      await storageService.updateUser(id, { passwordHash });
      return res.json({
        message: `Password reset successfully for ${user.name}.`
      });
    } catch (err) {
      console.error("Error resetting password:", err);
      return res.status(500).json({ error: "Failed to reset password." });
    }
  },
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const newStatus = !user.isActive;
      const updated = await storageService.updateUser(id, { isActive: newStatus });
      return res.json({
        message: `Technician account has been ${newStatus ? "activated" : "deactivated"}.`,
        isActive: newStatus,
        technician: updated
      });
    } catch (err) {
      console.error("Error toggling technician status:", err);
      return res.status(500).json({ error: "Failed to toggle status." });
    }
  },
  async deleteTechnician(req, res) {
    try {
      const { id } = req.params;
      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const balances = await storageService.getBalancesForTechnician(id);
      const totalHeld = balances.reduce((sum, b) => sum + b.quantity, 0);
      if (totalHeld > 0) {
        return res.status(400).json({
          error: `Cannot delete technician '${user.name}'. They currently hold ${totalHeld} unit(s) of physical stock. Please return all stock to warehouse first or deactivate the account.`
        });
      }
      const txs = await storageService.listStockTransactions({ technicianId: id });
      if (txs.length > 0) {
        await storageService.updateUser(id, { isActive: false });
        return res.json({
          message: `Technician has ${txs.length} transaction entries in the immutable ledger. To preserve audit integrity, their account has been deactivated rather than deleted.`,
          deactivated: true
        });
      }
      await storageService.deleteUser(id);
      return res.json({
        message: `Technician '${user.name}' has been permanently deleted.`,
        deleted: true
      });
    } catch (err) {
      console.error("Error deleting technician:", err);
      return res.status(500).json({ error: "Failed to delete technician." });
    }
  }
};

// backend/routes/technicianRoutes.ts
var router3 = Router3();
router3.get("/technicians", requireAuth, technicianController.getTechnicians);
router3.post("/admin/technicians", requireAuth, requireAdmin, technicianController.addTechnician);
router3.put("/admin/technicians/:id", requireAuth, requireAdmin, technicianController.updateTechnician);
router3.post("/admin/technicians/:id/reset-password", requireAuth, requireAdmin, technicianController.resetPassword);
router3.post("/admin/technicians/:id/toggle-status", requireAuth, requireAdmin, technicianController.toggleStatus);
router3.delete("/admin/technicians/:id", requireAuth, requireAdmin, technicianController.deleteTechnician);
var technicianRoutes_default = router3;

// backend/routes/stockRoutes.ts
import { Router as Router4 } from "express";

// backend/services/stockDataAccess.ts
import crypto from "crypto";
import mongoose2, { Types as Types3 } from "mongoose";

// backend/types/index.ts
var StockError = class extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "StockError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
};

// backend/utils/mathUtils.ts
var OPERATION_MAX_QUANTITIES = {
  PURCHASE: 1e5,
  ISSUE: 1e4,
  USAGE: 50,
  RETURN: 1e4,
  DAMAGE_WRITEOFF: 1e3
};
var MAX_SANE_QUANTITY = OPERATION_MAX_QUANTITIES.PURCHASE;
function validatePositiveWholeQuantity(rawQty, fieldName = "Quantity", max = MAX_SANE_QUANTITY) {
  if (rawQty === null || rawQty === void 0 || rawQty === "") {
    return { valid: false, value: 0, error: `${fieldName} is required.` };
  }
  const num = Number(rawQty);
  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, error: `${fieldName} must be a valid number.` };
  }
  if (num <= 0) {
    return { valid: false, value: 0, error: `${fieldName} must be greater than zero.` };
  }
  if (!Number.isInteger(num)) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} must be a positive whole number (e.g. 1, 5, 20). Fractions/decimals are not permitted for physical filter spares.`
    };
  }
  if (num > max) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} exceeds maximum allowable threshold (${max.toLocaleString("en-IN")}).`
    };
  }
  return { valid: true, value: num };
}
function safeAddQuantity(current, toAdd) {
  const a = Math.round(Number(current) || 0);
  const b = Math.round(Number(toAdd) || 0);
  return a + b;
}
function safeSubtractQuantity(current, toDeduct) {
  const curr = Math.round(Number(current) || 0);
  const deduct = Math.round(Number(toDeduct) || 0);
  if (deduct > curr) {
    return {
      success: false,
      newBalance: curr,
      error: `Insufficient stock balance. Available: ${curr}, Requested: ${deduct}.`
    };
  }
  return {
    success: true,
    newBalance: curr - deduct
  };
}

// backend/services/stockDataAccess.ts
function validateId(id, fieldName) {
  const strId = (typeof id === "string" ? id : id && typeof id.toHexString === "function" ? id.toHexString() : id && typeof id.toString === "function" ? id.toString() : "") || "";
  if (!strId.trim() || !Types3.ObjectId.isValid(strId.trim())) {
    throw new StockError("INVALID_ID", `Invalid ${fieldName}: '${id}' is not a valid 24-character hexadecimal ObjectId.`, 400);
  }
  return strId.trim();
}
function hashPayload(payload) {
  try {
    const serialized = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    return crypto.createHash("sha256").update(serialized).digest("hex");
  } catch {
    return crypto.createHash("sha256").update(String(payload)).digest("hex");
  }
}
var MemoryStockDataAccess = class {
  constructor(getNow = () => /* @__PURE__ */ new Date()) {
    this.getNow = getNow;
  }
  async atomicPurchase(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found or inactive.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Purchase quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
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
        lastUpdated: this.getNow()
      });
    }
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "PURCHASE_IN",
      item: validItemId,
      quantity: qty,
      supplierName: params.supplierName || "Direct Supplier",
      invoiceNumber: params.invoiceNumber || "",
      performedBy: validPerformedBy,
      remarks: params.remarks || "",
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return { transaction: tx, newWarehouseQty: newQty };
  }
  async atomicIssue(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found or inactive.`, 404);
    }
    const tech = inMemoryDb.users.get(validTechId);
    if (!tech || tech.role !== "technician" || !tech.isActive) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found or inactive.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Issue quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const whBal = inMemoryDb.warehouseBalances.get(validItemId);
    const currentWhQty = whBal ? whBal.quantity : 0;
    const subResult = safeSubtractQuantity(currentWhQty, qty);
    if (!subResult.success) {
      throw new StockError("INSUFFICIENT_STOCK", subResult.error, 400, {
        available: currentWhQty,
        requested: qty
      });
    }
    if (whBal) {
      whBal.quantity = subResult.newBalance;
      whBal.lastUpdated = this.getNow();
    } else {
      inMemoryDb.warehouseBalances.set(validItemId, {
        _id: inMemoryDb.generateId(),
        item: validItemId,
        quantity: subResult.newBalance,
        lastUpdated: this.getNow()
      });
    }
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
        lastUpdated: this.getNow()
      });
    }
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "ISSUE_TO_TECH",
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      kitName: params.kitName,
      kitAmount: params.kitAmount,
      performedBy: validPerformedBy,
      remarks: params.remarks || "",
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return {
      transaction: tx,
      newWarehouseQty: subResult.newBalance,
      newTechQty
    };
  }
  async atomicUsage(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Usage quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;
    const subResult = safeSubtractQuantity(currentTechQty, qty);
    if (!subResult.success) {
      throw new StockError("INSUFFICIENT_STOCK", subResult.error, 400, {
        available: currentTechQty,
        requested: qty
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
        lastUpdated: this.getNow()
      });
    }
    const effectiveSite = params.siteName?.trim() || (params.jobReference?.trim() ? `Case #${params.jobReference.trim()}` : "On-Site Service");
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "USAGE_AT_SITE",
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      siteName: effectiveSite,
      jobReference: params.jobReference?.trim() || "",
      performedBy: validPerformedBy,
      remarks: params.remarks?.trim() || "",
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return {
      transaction: tx,
      newTechQty: subResult.newBalance
    };
  }
  async atomicDamageWriteoff(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(
      params.quantity,
      "Damage write-off quantity",
      OPERATION_MAX_QUANTITIES.DAMAGE_WRITEOFF
    );
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const whBal = inMemoryDb.warehouseBalances.get(validItemId);
    const currentWhQty = whBal ? whBal.quantity : 0;
    const subResult = safeSubtractQuantity(currentWhQty, qty);
    if (!subResult.success) {
      throw new StockError(
        "INSUFFICIENT_STOCK",
        `Insufficient warehouse stock to write off. Available: ${currentWhQty}, Requested: ${qty}`,
        400,
        { available: currentWhQty, requested: qty }
      );
    }
    if (whBal) {
      whBal.quantity = subResult.newBalance;
      whBal.lastUpdated = this.getNow();
    }
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "DAMAGE_WRITEOFF",
      item: validItemId,
      quantity: qty,
      reason: params.reason?.trim() || "Damaged / Expired stock write-off",
      performedBy: validPerformedBy,
      remarks: params.remarks?.trim() || "",
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return {
      transaction: tx,
      newWarehouseQty: subResult.newBalance
    };
  }
  async atomicCreateReturnRequest(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Return quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;
    if (currentTechQty < qty) {
      throw new StockError(
        "INSUFFICIENT_STOCK",
        `Technician does not hold ${qty} units. Current hand balance: ${currentTechQty}`,
        400
      );
    }
    const retReq = {
      _id: inMemoryDb.generateId(),
      technician: validTechId,
      item: validItemId,
      quantity: qty,
      reason: params.reason.trim(),
      status: "PENDING",
      requestedAt: this.getNow()
    };
    inMemoryDb.returnRequests.set(retReq._id, retReq);
    inMemoryDb.scheduleSave();
    return retReq;
  }
  async atomicConfirmReturn(params) {
    const validReturnId = validateId(params.returnRequestId, "Return Request ID");
    const validConfirmedBy = validateId(params.confirmedBy, "User ID");
    const ret = inMemoryDb.returnRequests.get(validReturnId);
    if (!ret) {
      throw new StockError("RETURN_NOT_FOUND", "Return request not found.", 404);
    }
    if (ret.status !== "PENDING") {
      throw new StockError("INVALID_STATE", `Return request already ${ret.status}.`, 400);
    }
    const techId = typeof ret.technician === "object" ? ret.technician._id : ret.technician;
    const itemId = typeof ret.item === "object" ? ret.item._id : ret.item;
    const techKey = `${techId}_${itemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;
    const subResult = safeSubtractQuantity(currentTechQty, ret.quantity);
    if (!subResult.success) {
      throw new StockError("INSUFFICIENT_STOCK", `Technician no longer holds requested return quantity (${ret.quantity}).`, 400);
    }
    if (techBal) {
      techBal.quantity = subResult.newBalance;
      techBal.lastUpdated = this.getNow();
    }
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
        lastUpdated: this.getNow()
      });
    }
    ret.status = "CONFIRMED";
    ret.confirmedBy = validConfirmedBy;
    ret.confirmedAt = this.getNow();
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "RETURN_TO_WAREHOUSE",
      item: itemId,
      technician: techId,
      quantity: ret.quantity,
      performedBy: validConfirmedBy,
      remarks: `Return confirmed: ${ret.reason}`,
      transactionDate: this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return { returnRequest: ret, transaction: tx, newWarehouseQty: newWhQty };
  }
  async atomicDirectReturn(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = inMemoryDb.items.get(validItemId);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    const tech = inMemoryDb.users.get(validTechId);
    if (!tech) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Return quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const techKey = `${validTechId}_${validItemId}`;
    const techBal = inMemoryDb.technicianBalances.get(techKey);
    const currentTechQty = techBal ? techBal.quantity : 0;
    const subResult = safeSubtractQuantity(currentTechQty, qty);
    if (!subResult.success) {
      throw new StockError(
        "INSUFFICIENT_STOCK",
        `Technician currently holds ${currentTechQty} units. Cannot return ${qty} units.`,
        400,
        { available: currentTechQty, requested: qty }
      );
    }
    if (techBal) {
      techBal.quantity = subResult.newBalance;
      techBal.lastUpdated = this.getNow();
    }
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
        lastUpdated: this.getNow()
      });
    }
    const tx = {
      _id: inMemoryDb.generateId(),
      transactionType: "RETURN_TO_WAREHOUSE",
      item: validItemId,
      technician: validTechId,
      quantity: qty,
      performedBy: validPerformedBy,
      reason: params.reason?.trim() || "Bulk stock return to central warehouse",
      remarks: params.remarks?.trim() || "",
      transactionDate: params.transactionDate || this.getNow(),
      createdAt: this.getNow()
    };
    inMemoryDb.transactions.push(tx);
    inMemoryDb.scheduleSave();
    return {
      transaction: tx,
      newWarehouseQty: newWhQty,
      newTechQty: subResult.newBalance
    };
  }
  async claimIdempotencyKey(params) {
    const fullKey = `${params.userId}_${params.endpoint}_${params.key}`;
    const existing = inMemoryDb.idempotencyRecords.get(fullKey);
    if (existing) {
      if (this.getNow() > new Date(existing.expiresAt)) {
        inMemoryDb.idempotencyRecords.delete(fullKey);
      } else {
        return { claimed: false, existing };
      }
    }
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1e3);
    const record = {
      key: params.key,
      userId: params.userId,
      endpoint: params.endpoint,
      payloadHash: params.payloadHash,
      status: "IN_PROGRESS",
      statusCode: 200,
      responseBody: null,
      createdAt: this.getNow(),
      expiresAt
    };
    inMemoryDb.idempotencyRecords.set(fullKey, record);
    return { claimed: true };
  }
  async resolveIdempotencyKey(params) {
    const fullKey = `${params.userId}_${params.endpoint}_${params.key}`;
    const existing = inMemoryDb.idempotencyRecords.get(fullKey);
    if (existing) {
      existing.status = "RESOLVED";
      existing.statusCode = params.statusCode;
      existing.responseBody = params.responseBody;
    }
  }
  async getIdempotencyRecord(key, userId, endpoint) {
    const fullKey = `${userId}_${endpoint}_${key}`;
    const record = inMemoryDb.idempotencyRecords.get(fullKey);
    if (!record) return null;
    if (this.getNow() > new Date(record.expiresAt)) {
      inMemoryDb.idempotencyRecords.delete(fullKey);
      return null;
    }
    return record;
  }
  async saveIdempotencyRecord(record) {
    const fullKey = `${record.userId}_${record.endpoint}_${record.key}`;
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1e3);
    inMemoryDb.idempotencyRecords.set(fullKey, {
      ...record,
      status: "RESOLVED",
      createdAt: this.getNow(),
      expiresAt
    });
  }
};
async function runInMongoTransaction(fn, maxRetries = 25) {
  let attempt = 0;
  while (true) {
    attempt++;
    const session = await mongoose2.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch {
      }
      const isTransient = err?.hasErrorLabel?.("TransientTransactionError") || err?.code === 112 || err?.message?.includes("WriteConflict") || err?.message?.includes("Please retry your operation");
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
var MongoStockDataAccess = class {
  constructor(getNow = () => /* @__PURE__ */ new Date()) {
    this.getNow = getNow;
  }
  async atomicPurchase(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = await ItemModel.findById(validItemId);
    if (!item || item.isActive === false) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found or inactive.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Purchase quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    return runInMongoTransaction(async (session) => {
      const updatedBalance = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "PURCHASE_IN",
            item: validItemId,
            quantity: qty,
            supplierName: params.supplierName || "Direct Supplier",
            invoiceNumber: params.invoiceNumber || "",
            performedBy: validPerformedBy,
            remarks: params.remarks || "",
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        transaction: txDocs[0].toObject(),
        newWarehouseQty: updatedBalance.quantity
      };
    });
  }
  async atomicIssue(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId)
    ]);
    if (!item || item.isActive === false) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found or inactive.`, 404);
    }
    if (!tech || tech.role !== "technician" || !tech.isActive) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found or inactive.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Issue quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    return runInMongoTransaction(async (session) => {
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );
      if (!updatedWh) {
        const currentWh = await WarehouseBalanceModel.findOne({ item: validItemId }).session(session);
        const curr = currentWh ? currentWh.quantity : 0;
        throw new StockError("INSUFFICIENT_STOCK", `Insufficient warehouse stock. Available: ${curr}, Requested: ${qty}`, 400, {
          available: curr,
          requested: qty
        });
      }
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "ISSUE_TO_TECH",
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            kitName: params.kitName,
            kitAmount: params.kitAmount,
            performedBy: validPerformedBy,
            remarks: params.remarks || "",
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        transaction: txDocs[0].toObject(),
        newWarehouseQty: updatedWh.quantity,
        newTechQty: updatedTech.quantity
      };
    });
  }
  async atomicUsage(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId)
    ]);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    if (!tech) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Usage quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    return runInMongoTransaction(async (session) => {
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );
      if (!updatedTech) {
        const currentTech = await TechnicianBalanceModel.findOne({ technician: validTechId, item: validItemId }).session(session);
        const curr = currentTech ? currentTech.quantity : 0;
        throw new StockError("INSUFFICIENT_STOCK", `Technician does not hold enough stock. Available: ${curr}, Requested: ${qty}`, 400, {
          available: curr,
          requested: qty
        });
      }
      const effectiveSite = params.siteName?.trim() || (params.jobReference?.trim() ? `Case #${params.jobReference.trim()}` : "On-Site Service");
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "USAGE_AT_SITE",
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            siteName: effectiveSite,
            jobReference: params.jobReference?.trim() || "",
            performedBy: validPerformedBy,
            remarks: params.remarks?.trim() || "",
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        transaction: txDocs[0].toObject(),
        newTechQty: updatedTech.quantity
      };
    });
  }
  async atomicDamageWriteoff(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const item = await ItemModel.findById(validItemId);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(
      params.quantity,
      "Damage write-off quantity",
      OPERATION_MAX_QUANTITIES.DAMAGE_WRITEOFF
    );
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    return runInMongoTransaction(async (session) => {
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );
      if (!updatedWh) {
        const currentWh = await WarehouseBalanceModel.findOne({ item: validItemId }).session(session);
        const curr = currentWh ? currentWh.quantity : 0;
        throw new StockError(
          "INSUFFICIENT_STOCK",
          `Insufficient warehouse stock to write off. Available: ${curr}, Requested: ${qty}`,
          400,
          { available: curr, requested: qty }
        );
      }
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "DAMAGE_WRITEOFF",
            item: validItemId,
            quantity: qty,
            reason: params.reason?.trim() || "Damaged / Expired stock write-off",
            performedBy: validPerformedBy,
            remarks: params.remarks?.trim() || "",
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        transaction: txDocs[0].toObject(),
        newWarehouseQty: updatedWh.quantity
      };
    });
  }
  async atomicCreateReturnRequest(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const [item, tech] = await Promise.all([
      ItemModel.findById(validItemId),
      UserModel.findById(validTechId)
    ]);
    if (!item) {
      throw new StockError("ITEM_NOT_FOUND", `Item with ID ${validItemId} not found.`, 404);
    }
    if (!tech) {
      throw new StockError("INVALID_TECHNICIAN", `Technician with ID ${validTechId} not found.`, 404);
    }
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Return quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    const techBal = await TechnicianBalanceModel.findOne({
      technician: validTechId,
      item: validItemId
    });
    const currentTechQty = techBal ? techBal.quantity : 0;
    if (currentTechQty < qty) {
      throw new StockError(
        "INSUFFICIENT_STOCK",
        `Technician does not hold ${qty} units. Current hand balance: ${currentTechQty}`,
        400
      );
    }
    const doc = await ReturnRequestModel.create({
      technician: validTechId,
      item: validItemId,
      quantity: qty,
      reason: params.reason.trim(),
      status: "PENDING",
      requestedAt: this.getNow()
    });
    return doc.toObject();
  }
  async atomicConfirmReturn(params) {
    const validReturnId = validateId(params.returnRequestId, "Return Request ID");
    const validConfirmedBy = validateId(params.confirmedBy, "User ID");
    return runInMongoTransaction(async (session) => {
      const updatedReturn = await ReturnRequestModel.findOneAndUpdate(
        { _id: validReturnId, status: "PENDING" },
        {
          $set: {
            status: "CONFIRMED",
            confirmedBy: new Types3.ObjectId(validConfirmedBy),
            confirmedAt: this.getNow()
          }
        },
        { new: true, session }
      );
      if (!updatedReturn) {
        throw new StockError("INVALID_STATE", "Return request not found or already processed.", 400);
      }
      const techId = updatedReturn.technician.toString();
      const itemId = updatedReturn.item.toString();
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: techId, item: itemId, quantity: { $gte: updatedReturn.quantity } },
        { $inc: { quantity: -updatedReturn.quantity }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );
      if (!updatedTech) {
        throw new StockError("INSUFFICIENT_STOCK", `Technician no longer holds required stock of ${updatedReturn.quantity}.`, 400);
      }
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $inc: { quantity: updatedReturn.quantity }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "RETURN_TO_WAREHOUSE",
            item: itemId,
            technician: techId,
            quantity: updatedReturn.quantity,
            performedBy: validConfirmedBy,
            remarks: `Return confirmed: ${updatedReturn.reason}`,
            transactionDate: this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        returnRequest: updatedReturn.toObject(),
        transaction: txDocs[0].toObject(),
        newWarehouseQty: updatedWh.quantity
      };
    });
  }
  async atomicDirectReturn(params) {
    const validItemId = validateId(params.itemId, "Item ID");
    const validTechId = validateId(params.technicianId, "Technician ID");
    const validPerformedBy = validateId(params.performedBy, "User ID");
    const qtyVal = validatePositiveWholeQuantity(params.quantity, "Return quantity");
    if (!qtyVal.valid) {
      throw new StockError("INVALID_QUANTITY", qtyVal.error, 400);
    }
    const qty = qtyVal.value;
    return runInMongoTransaction(async (session) => {
      const updatedTech = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: validTechId, item: validItemId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, session }
      );
      if (!updatedTech) {
        const current = await TechnicianBalanceModel.findOne({ technician: validTechId, item: validItemId }).session(session);
        const curr = current ? current.quantity : 0;
        throw new StockError("INSUFFICIENT_STOCK", `Technician holds ${curr} units. Cannot return ${qty}.`, 400, {
          available: curr,
          requested: qty
        });
      }
      const updatedWh = await WarehouseBalanceModel.findOneAndUpdate(
        { item: validItemId },
        { $inc: { quantity: qty }, $set: { lastUpdated: this.getNow() } },
        { new: true, upsert: true, session }
      );
      const txDocs = await StockTransactionModel.create(
        [
          {
            transactionType: "RETURN_TO_WAREHOUSE",
            item: validItemId,
            technician: validTechId,
            quantity: qty,
            performedBy: validPerformedBy,
            reason: params.reason?.trim() || "Bulk stock return to central warehouse",
            remarks: params.remarks?.trim() || "",
            transactionDate: params.transactionDate || this.getNow(),
            createdAt: this.getNow()
          }
        ],
        { session }
      );
      return {
        transaction: txDocs[0].toObject(),
        newWarehouseQty: updatedWh.quantity,
        newTechQty: updatedTech.quantity
      };
    });
  }
  async claimIdempotencyKey(params) {
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1e3);
    try {
      await IdempotencyRecordModel.create({
        key: params.key,
        userId: params.userId,
        endpoint: params.endpoint,
        payloadHash: params.payloadHash,
        status: "IN_PROGRESS",
        createdAt: this.getNow(),
        expiresAt
      });
      return { claimed: true };
    } catch (err) {
      if (err.code === 11e3 || err.name === "MongoServerError") {
        const existing = await IdempotencyRecordModel.findOne({
          key: params.key,
          userId: params.userId,
          endpoint: params.endpoint
        });
        if (existing) {
          if (this.getNow() > new Date(existing.expiresAt)) {
            await IdempotencyRecordModel.deleteOne({ _id: existing._id });
            return this.claimIdempotencyKey(params);
          }
          return { claimed: false, existing: existing.toObject() };
        }
      }
      throw err;
    }
  }
  async resolveIdempotencyKey(params) {
    await IdempotencyRecordModel.updateOne(
      { key: params.key, userId: params.userId, endpoint: params.endpoint },
      {
        $set: {
          status: "RESOLVED",
          statusCode: params.statusCode,
          responseBody: params.responseBody
        }
      }
    );
  }
  async getIdempotencyRecord(key, userId, endpoint) {
    const doc = await IdempotencyRecordModel.findOne({ key, userId, endpoint });
    if (!doc) return null;
    if (this.getNow() > new Date(doc.expiresAt)) {
      await IdempotencyRecordModel.deleteOne({ _id: doc._id });
      return null;
    }
    return doc.toObject();
  }
  async saveIdempotencyRecord(record) {
    const expiresAt = new Date(this.getNow().getTime() + 24 * 60 * 60 * 1e3);
    await IdempotencyRecordModel.findOneAndUpdate(
      { key: record.key, userId: record.userId, endpoint: record.endpoint },
      {
        ...record,
        status: "RESOLVED",
        expiresAt,
        createdAt: this.getNow()
      },
      { upsert: true }
    );
  }
};
var memoryStockDataAccess = new MemoryStockDataAccess();
var mongoStockDataAccess = new MongoStockDataAccess();
function getStockDataAccess() {
  return isMongoConnected() ? mongoStockDataAccess : memoryStockDataAccess;
}

// backend/services/notificationService.ts
var NotificationService = class {
  constructor() {
    this.clients = /* @__PURE__ */ new Map();
    this.notifications = [];
    this.maxStored = 200;
    setTimeout(() => {
      this.syncInitialNotifications().catch((err) => {
        console.error("[NotificationService] Error syncing initial alerts:", err);
      });
    }, 1500);
  }
  // Register an SSE client connection
  addClient(id, userId, role, res) {
    this.clients.set(id, { id, userId, role, res });
    const initialList = this.getNotificationsForUser(userId, role);
    this.sendToClient(res, "init", {
      notifications: initialList,
      unreadCount: initialList.filter((n) => !n.read).length
    });
  }
  // Remove client upon disconnect
  removeClient(id) {
    this.clients.delete(id);
  }
  // Broadcast or send targeted notification
  broadcast(notification) {
    const newNotification = {
      ...notification,
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    };
    this.notifications.unshift(newNotification);
    if (this.notifications.length > this.maxStored) {
      this.notifications.pop();
    }
    for (const client of this.clients.values()) {
      if (this.isNotificationForClient(newNotification, client)) {
        this.sendToClient(client.res, "notification", newNotification);
      }
    }
    return newNotification;
  }
  isNotificationForClient(notif, client) {
    if (notif.targetUserId && notif.targetUserId !== client.userId) {
      return false;
    }
    if (notif.targetRole === "all") return true;
    return notif.targetRole === client.role;
  }
  sendToClient(res, event, data) {
    try {
      res.write(`event: ${event}
`);
      res.write(`data: ${JSON.stringify(data)}

`);
    } catch (err) {
    }
  }
  // Get notifications for a specific user
  getNotificationsForUser(userId, role) {
    return this.notifications.filter((n) => {
      if (n.targetUserId && n.targetUserId !== userId) return false;
      if (n.targetRole === "all") return true;
      return n.targetRole === role;
    });
  }
  // Mark single as read
  markAsRead(notificationId, userId) {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }
  // Mark all as read for user
  markAllAsRead(userId, role) {
    let count = 0;
    for (const notif of this.notifications) {
      if (this.isNotificationForClient(notif, { id: "", userId, role, res: null })) {
        if (!notif.read) {
          notif.read = true;
          count++;
        }
      }
    }
    return count;
  }
  // Clear read notifications
  clearReadNotifications(userId, role) {
    this.notifications = this.notifications.filter((notif) => {
      return !this.isNotificationForClient(notif, { id: "", userId, role, res: null }) || !notif.read;
    });
  }
  // Scan live database state on startup to populate existing low-stock and pending return alerts
  async syncInitialNotifications() {
    try {
      const [items, pendingReturns] = await Promise.all([
        storageService.listItems({ isActive: true }),
        storageService.listReturnRequests({ status: "PENDING" })
      ]);
      for (const ret of pendingReturns) {
        const techName = typeof ret.technician === "object" ? ret.technician.name : "Field Technician";
        const itemName = typeof ret.item === "object" ? ret.item.itemName : "Spare part";
        const itemCode = typeof ret.item === "object" ? ret.item.itemCode : "";
        this.notifications.push({
          id: "init_ret_" + ret._id,
          type: "RETURN_PENDING",
          title: `Pending Return: ${ret.quantity}x ${itemCode || itemName}`,
          message: `${techName} ne ${ret.quantity} units (${itemName}) return karne ka request bheja hai. Approval pending hai.`,
          severity: "warning",
          targetRole: "admin",
          timestamp: ret.requestedAt ? new Date(ret.requestedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
          read: false,
          actionLink: "/returns",
          metadata: { returnRequestId: ret._id, quantity: ret.quantity, itemCode }
        });
      }
      for (const item of items) {
        const qty = await storageService.getWarehouseBalance(item._id);
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        if (qty <= threshold) {
          const isZero = qty === 0;
          this.notifications.push({
            id: "init_low_" + item._id,
            type: "LOW_STOCK",
            title: isZero ? `OUT OF STOCK: ${item.itemCode}` : `Low Stock Alert: ${item.itemCode}`,
            message: isZero ? `${item.itemName} godown me 0 units bacha hai! Urgent stock inward karein.` : `${item.itemName} sirf ${qty} ${item.unit} bacha hai (Min safety limit: ${threshold} ${item.unit}).`,
            severity: isZero ? "critical" : "warning",
            targetRole: "admin",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            read: false,
            actionLink: "/warehouse-stock",
            metadata: { itemId: item._id, itemCode: item.itemCode, currentQty: qty, threshold }
          });
        }
      }
    } catch (err) {
      console.error("[NotificationService] Error syncing initial notifications:", err);
    }
  }
};
var notificationService = new NotificationService();

// backend/controllers/stockController.ts
var stockController = {
  // 1. POST /api/stock/purchase
  async purchase(req, res) {
    try {
      const { itemId, quantity, supplierName, invoiceNumber, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();
      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const result = await dataAccess.atomicPurchase({
        itemId,
        quantity,
        supplierName: supplierName?.trim(),
        invoiceNumber: invoiceNumber?.trim(),
        performedBy: req.user._id,
        remarks: remarks?.trim(),
        transactionDate: parsedDate
      });
      const item = await storageService.findItemById(itemId);
      return res.status(201).json({
        message: "Stock purchase recorded successfully",
        transaction: result.transaction,
        item,
        warehouseBalance: result.newWarehouseQty
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error recording purchase:", err);
      return res.status(500).json({ error: "Failed to record stock purchase." });
    }
  },
  // 1b. POST /api/stock/purchase-bulk (Direct bulk stock inward into warehouse)
  async purchaseBulk(req, res) {
    try {
      const { items, supplierName, invoiceNumber, remarks, transactionDate } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array is required." });
      }
      const dataAccess = getStockDataAccess();
      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const results = [];
      let totalQty = 0;
      for (const entry of items) {
        const itemRes = await dataAccess.atomicPurchase({
          itemId: entry.itemId,
          quantity: Number(entry.quantity),
          supplierName: supplierName?.trim() || "Direct Supplier",
          invoiceNumber: invoiceNumber?.trim() || "",
          performedBy: req.user._id,
          remarks: entry.remarks?.trim() || remarks?.trim() || "Bulk warehouse inward entry",
          transactionDate: parsedDate
        });
        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty
        });
      }
      notificationService.broadcast({
        type: "STOCK_INWARD",
        title: `Bulk Inward: ${items.length} items (${totalQty} units)`,
        message: `Warehouse inward receipt of ${items.length} items (${totalQty} units) recorded from ${supplierName || "supplier"}.`,
        severity: "success",
        targetRole: "admin",
        actionLink: "/warehouse-stock",
        metadata: { totalItems: items.length, totalQty }
      });
      return res.status(201).json({
        message: `Successfully received ${items.length} items (${totalQty} units) into warehouse`,
        totalItems: items.length,
        totalQuantity: totalQty,
        results
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error in bulk purchase:", err);
      return res.status(500).json({ error: err.message || "Failed to record bulk stock inward." });
    }
  },
  async issue(req, res) {
    try {
      const { itemId, technicianId, quantity, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();
      const parsedIssueDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const result = await dataAccess.atomicIssue({
        itemId,
        technicianId,
        quantity,
        performedBy: req.user._id,
        remarks: remarks?.trim(),
        transactionDate: parsedIssueDate
      });
      const [item, technician] = await Promise.all([
        storageService.findItemById(itemId),
        storageService.findUserById(technicianId)
      ]);
      if (technician) {
        notificationService.broadcast({
          type: "STOCK_ISSUED",
          title: `Stock Received: ${result.transaction.quantity}x ${item?.itemCode || "parts"}`,
          message: `Godown Manager ne aapke hand stock me ${result.transaction.quantity} ${item?.unit || "units"} (${item?.itemName}) transfer kiye hain.`,
          severity: "info",
          targetRole: "technician",
          targetUserId: technicianId,
          actionLink: "/my-stock",
          metadata: { itemId, quantity: result.transaction.quantity, newTechQty: result.newTechQty }
        });
      }
      const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
      if (result.newWarehouseQty <= threshold) {
        const isZero = result.newWarehouseQty === 0;
        notificationService.broadcast({
          type: "LOW_STOCK",
          title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
          message: isZero ? `${item?.itemName} godown me 0 units bacha hai! Urgent stock inward karein.` : `${item?.itemName} sirf ${result.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
          severity: isZero ? "critical" : "warning",
          targetRole: "admin",
          actionLink: "/warehouse-stock",
          metadata: { itemId, itemCode: item?.itemCode, currentQty: result.newWarehouseQty, threshold }
        });
      }
      return res.status(201).json({
        message: "Stock issued to technician successfully",
        transaction: result.transaction,
        item,
        technician: technician ? { id: technician._id, name: technician.name } : { id: technicianId },
        warehouseBalance: result.newWarehouseQty,
        technicianBalance: result.newTechQty
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error issuing stock:", err);
      return res.status(500).json({ error: "Failed to issue stock to technician." });
    }
  },
  // 2b. POST /api/stock/issue-bulk
  async issueBulk(req, res) {
    try {
      const { technicianId, items, remarks, transactionDate, kitName, kitAmount } = req.body;
      if (!technicianId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "technicianId and items array are required." });
      }
      const dataAccess = getStockDataAccess();
      const parsedIssueDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const technician = await storageService.findUserById(technicianId);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const parsedKitAmount = kitAmount !== void 0 && kitAmount !== null && !isNaN(Number(kitAmount)) ? Number(kitAmount) : void 0;
      const results = [];
      let totalQty = 0;
      for (const entry of items) {
        const itemRes = await dataAccess.atomicIssue({
          itemId: entry.itemId,
          technicianId,
          quantity: Number(entry.quantity),
          performedBy: req.user._id,
          remarks: entry.remarks?.trim() || remarks?.trim() || (kitName ? `Kit: ${kitName}` : "Bulk stock dispatch to technician"),
          kitName: kitName?.trim() || void 0,
          kitAmount: parsedKitAmount,
          transactionDate: parsedIssueDate
        });
        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty,
          technicianBalance: itemRes.newTechQty
        });
        const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
        if (itemRes.newWarehouseQty <= threshold) {
          const isZero = itemRes.newWarehouseQty === 0;
          notificationService.broadcast({
            type: "LOW_STOCK",
            title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
            message: isZero ? `${item?.itemName} godown me 0 units bacha hai! Urgent stock inward karein.` : `${item?.itemName} sirf ${itemRes.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
            severity: isZero ? "critical" : "warning",
            targetRole: "admin",
            actionLink: "/warehouse-stock",
            metadata: { itemId: entry.itemId, itemCode: item?.itemCode, currentQty: itemRes.newWarehouseQty, threshold }
          });
        }
      }
      notificationService.broadcast({
        type: "STOCK_ISSUED",
        title: `Bulk Stock Received: ${items.length} items (${totalQty} units)`,
        message: `Godown Manager ne aapke hand stock me ${items.length} items (Total: ${totalQty} units) transfer kiye hain.`,
        severity: "info",
        targetRole: "technician",
        targetUserId: technicianId,
        actionLink: "/my-stock",
        metadata: { totalItems: items.length, totalQty }
      });
      return res.status(201).json({
        message: kitName ? `Successfully issued Kit "${kitName}" (${items.length} items, ${totalQty} units) to ${technician.name}` : `Successfully issued ${items.length} items (${totalQty} units) to ${technician.name}`,
        technician: { id: technician._id, name: technician.name },
        kitName: kitName?.trim() || void 0,
        kitAmount: parsedKitAmount,
        totalItems: items.length,
        totalQuantity: totalQty,
        results
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error in bulk issue:", err);
      return res.status(500).json({ error: err.message || "Failed to issue stock in bulk." });
    }
  },
  // 3. POST /api/stock/usage
  async usage(req, res) {
    try {
      const { itemId, technicianId: bodyTechId, quantity, siteName, jobReference, caseId, remarks, transactionDate } = req.body;
      const targetTechId = req.user.role === "technician" ? req.user._id : bodyTechId;
      if (!targetTechId) {
        return res.status(400).json({ error: "Technician ID is required for logging usage." });
      }
      const parsedUsageDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const effectiveJobRef = caseId?.trim() || jobReference?.trim() || "";
      const effectiveSite = siteName?.trim() || (effectiveJobRef ? `Case #${effectiveJobRef}` : "On-Site Service");
      const dataAccess = getStockDataAccess();
      const result = await dataAccess.atomicUsage({
        itemId,
        technicianId: targetTechId,
        quantity,
        siteName: effectiveSite,
        jobReference: effectiveJobRef,
        performedBy: req.user._id,
        remarks: remarks?.trim(),
        transactionDate: parsedUsageDate
      });
      const [item, technician] = await Promise.all([
        storageService.findItemById(itemId),
        storageService.findUserById(targetTechId)
      ]);
      return res.status(201).json({
        message: "On-site stock usage logged successfully",
        transaction: result.transaction,
        item,
        technician: technician ? { id: technician._id, name: technician.name } : { id: targetTechId },
        technicianBalance: result.newTechQty
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error logging stock usage:", err);
      return res.status(500).json({ error: "Failed to log stock usage." });
    }
  },
  // 4. POST /api/stock/return-request (Technician submits return)
  async createReturnRequest(req, res) {
    try {
      const { itemId, quantity, reason, technicianId: bodyTechId } = req.body;
      const techId = req.user.role === "technician" ? req.user._id : bodyTechId || req.user._id;
      const dataAccess = getStockDataAccess();
      const returnReq = await dataAccess.atomicCreateReturnRequest({
        technicianId: techId,
        itemId,
        quantity,
        reason: reason.trim()
      });
      const item = await storageService.findItemById(itemId);
      notificationService.broadcast({
        type: "RETURN_PENDING",
        title: `Pending Return: ${returnReq.quantity}x ${item?.itemCode || "parts"}`,
        message: `${req.user.name} ne ${returnReq.quantity} units (${item?.itemName || "spare"}) return karne ka request submit kiya hai. Approval karein.`,
        severity: "warning",
        targetRole: "admin",
        actionLink: "/returns",
        metadata: { returnRequestId: returnReq._id, quantity: returnReq.quantity, technicianId: techId }
      });
      return res.status(201).json({
        message: "Return request submitted successfully. Awaiting warehouse admin confirmation.",
        returnRequest: returnReq
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error creating return request:", err);
      return res.status(500).json({ error: "Failed to submit return request." });
    }
  },
  // 4b. POST /api/stock/return-bulk (Direct bulk return from technician into warehouse)
  async returnBulk(req, res) {
    try {
      const { technicianId: bodyTechId, items, remarks, transactionDate } = req.body;
      const targetTechId = req.user.role === "technician" ? req.user._id : bodyTechId || req.user._id;
      if (!targetTechId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "technicianId and items array are required." });
      }
      const dataAccess = getStockDataAccess();
      const parsedReturnDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const technician = await storageService.findUserById(targetTechId);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const results = [];
      let totalQty = 0;
      for (const entry of items) {
        const itemRes = await dataAccess.atomicDirectReturn({
          itemId: entry.itemId,
          technicianId: targetTechId,
          quantity: Number(entry.quantity),
          performedBy: req.user._id,
          reason: entry.reason?.trim() || remarks?.trim() || "Bulk stock return to central warehouse",
          remarks: remarks?.trim() || "",
          transactionDate: parsedReturnDate
        });
        const item = await storageService.findItemById(entry.itemId);
        totalQty += Number(entry.quantity);
        results.push({
          item,
          quantity: entry.quantity,
          transaction: itemRes.transaction,
          warehouseBalance: itemRes.newWarehouseQty,
          technicianBalance: itemRes.newTechQty
        });
      }
      notificationService.broadcast({
        type: "RETURN_CONFIRMED",
        title: `Bulk Return Received: ${items.length} items (${totalQty} units)`,
        message: `Successfully received ${items.length} items (${totalQty} units) from ${technician.name} into central warehouse inventory.`,
        severity: "success",
        targetRole: "admin",
        actionLink: "/warehouse-stock",
        metadata: { technicianId: targetTechId, totalItems: items.length, totalQty }
      });
      return res.status(201).json({
        message: `Successfully returned ${items.length} items (${totalQty} units) from ${technician.name} to warehouse`,
        technician: { id: technician._id, name: technician.name },
        totalItems: items.length,
        totalQuantity: totalQty,
        results
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error in bulk return:", err);
      return res.status(500).json({ error: err.message || "Failed to return stock in bulk." });
    }
  },
  // 5. GET /api/stock/return-requests
  async getReturnRequests(req, res) {
    try {
      const { status } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (req.user.role === "technician") {
        filter.technicianId = req.user._id;
      }
      const list = await storageService.listReturnRequests(filter);
      return res.json({ returnRequests: list });
    } catch (err) {
      console.error("Error fetching return requests:", err);
      return res.status(500).json({ error: "Failed to fetch return requests." });
    }
  },
  // 6. PUT /api/stock/return-request/:id/confirm (Admin confirms return)
  async confirmReturnRequest(req, res) {
    try {
      const { id } = req.params;
      const dataAccess = getStockDataAccess();
      const result = await dataAccess.atomicConfirmReturn({
        returnRequestId: id,
        confirmedBy: req.user._id
      });
      const techId = typeof result.returnRequest.technician === "object" ? result.returnRequest.technician._id : result.returnRequest.technician;
      const returnItem = typeof result.returnRequest.item === "object" ? result.returnRequest.item : await storageService.findItemById(result.returnRequest.item);
      notificationService.broadcast({
        type: "RETURN_CONFIRMED",
        title: `Return Approved: ${result.returnRequest.quantity}x ${returnItem?.itemCode || "units"}`,
        message: `Godown Manager Suresh Verma ne aapka return request approve kar liya hai. Units warehouse stock me wapas add ho gaye hain.`,
        severity: "success",
        targetRole: "technician",
        targetUserId: techId?.toString(),
        actionLink: "/returns",
        metadata: { returnRequestId: id, quantity: result.returnRequest.quantity }
      });
      return res.json({
        message: "Return confirmed and stock safely added back to warehouse.",
        returnRequest: result.returnRequest,
        transaction: result.transaction,
        warehouseBalance: result.newWarehouseQty
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error confirming return request:", err);
      return res.status(500).json({ error: "Failed to confirm return request." });
    }
  },
  // 7. PUT /api/stock/return-request/:id/reject
  async rejectReturnRequest(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const returnReq = await storageService.findReturnRequestById(id);
      if (!returnReq) {
        return res.status(404).json({ error: "Return request not found." });
      }
      if (returnReq.status !== "PENDING") {
        return res.status(400).json({ error: `Return request is already marked as ${returnReq.status}.` });
      }
      const updated = await storageService.updateReturnRequest(id, {
        status: "REJECTED",
        rejectionReason: reason?.trim() || "Rejected by warehouse admin",
        confirmedBy: req.user._id,
        confirmedAt: /* @__PURE__ */ new Date()
      });
      const techId = typeof returnReq.technician === "object" ? returnReq.technician._id : returnReq.technician;
      notificationService.broadcast({
        type: "RETURN_REJECTED",
        title: `Return Request Rejected`,
        message: `Aapka return request reject kar diya gaya hai. Reason: ${reason?.trim() || "Not approved by admin"}.`,
        severity: "critical",
        targetRole: "technician",
        targetUserId: techId?.toString(),
        actionLink: "/returns",
        metadata: { returnRequestId: id, reason }
      });
      return res.json({
        message: "Return request rejected.",
        returnRequest: updated
      });
    } catch (err) {
      console.error("Error rejecting return request:", err);
      return res.status(500).json({ error: "Failed to reject return request." });
    }
  },
  // 8. POST /api/stock/damage-writeoff
  async damageWriteoff(req, res) {
    try {
      const { itemId, quantity, reason, remarks, transactionDate } = req.body;
      const dataAccess = getStockDataAccess();
      const parsedDate = transactionDate && !isNaN(new Date(transactionDate).getTime()) ? new Date(transactionDate) : /* @__PURE__ */ new Date();
      const result = await dataAccess.atomicDamageWriteoff({
        itemId,
        quantity,
        reason: reason?.trim(),
        performedBy: req.user._id,
        remarks: remarks?.trim(),
        transactionDate: parsedDate
      });
      const item = await storageService.findItemById(itemId);
      const threshold = item?.lowStockThreshold ?? item?.reorderLevel ?? 5;
      if (result.newWarehouseQty <= threshold) {
        const isZero = result.newWarehouseQty === 0;
        notificationService.broadcast({
          type: "LOW_STOCK",
          title: isZero ? `OUT OF STOCK: ${item?.itemCode}` : `Low Stock Alert: ${item?.itemCode}`,
          message: isZero ? `${item?.itemName} godown me 0 units bacha hai! Damage write-off ke baad balance khatam ho gaya.` : `${item?.itemName} damage write-off ke baad sirf ${result.newWarehouseQty} ${item?.unit} bacha hai (Min safety limit: ${threshold} ${item?.unit}).`,
          severity: isZero ? "critical" : "warning",
          targetRole: "admin",
          actionLink: "/warehouse-stock",
          metadata: { itemId, itemCode: item?.itemCode, currentQty: result.newWarehouseQty, threshold }
        });
      }
      return res.status(201).json({
        message: "Damage write-off recorded successfully in ledger",
        transaction: result.transaction,
        warehouseBalance: result.newWarehouseQty
      });
    } catch (err) {
      if (err instanceof StockError) {
        return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
      }
      console.error("Error recording damage writeoff:", err);
      return res.status(500).json({ error: "Failed to record damage write-off." });
    }
  },
  // 9. GET /api/stock/warehouse-balance
  async getWarehouseBalances(req, res) {
    try {
      const balances = await storageService.getAllWarehouseBalances();
      return res.json({ balances });
    } catch (err) {
      console.error("Error fetching warehouse balances:", err);
      return res.status(500).json({ error: "Failed to retrieve warehouse balances." });
    }
  },
  // 10. GET /api/stock/technician-balance/:technicianId
  async getTechnicianBalance(req, res) {
    try {
      const { technicianId } = req.params;
      if (req.user.role === "technician" && req.user._id !== technicianId) {
        return res.status(403).json({ error: "Access denied: You can only view your own stock balance." });
      }
      const technician = await storageService.findUserById(technicianId);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found." });
      }
      const balances = await storageService.getBalancesForTechnician(technicianId);
      return res.json({
        technician: {
          id: technician._id,
          name: technician.name,
          phone: technician.phone
        },
        balances
      });
    } catch (err) {
      console.error("Error fetching technician balance:", err);
      return res.status(500).json({ error: "Failed to retrieve technician balance." });
    }
  },
  // 11. GET /api/stock/technician-balance (Matrix view)
  async getTechniciansBalanceMatrix(req, res) {
    try {
      const data = await storageService.getAllTechnicianBalancesMatrix();
      return res.json(data);
    } catch (err) {
      console.error("Error fetching technicians balance matrix:", err);
      return res.status(500).json({ error: "Failed to retrieve technician balance matrix." });
    }
  },
  // 12. GET /api/stock/ledger
  async getLedger(req, res) {
    try {
      const { itemId, technicianId, type, fromDate, toDate, limit } = req.query;
      let targetTechId = technicianId;
      if (req.user.role === "technician") {
        targetTechId = req.user._id;
      }
      const transactions = await storageService.listStockTransactions({
        itemId,
        technicianId: targetTechId,
        type,
        fromDate,
        toDate,
        limit: limit ? Number(limit) : void 0
      });
      return res.json({ transactions });
    } catch (err) {
      console.error("Error fetching ledger history:", err);
      return res.status(500).json({ error: "Failed to retrieve ledger transactions." });
    }
  }
};

// backend/middleware/idempotency.ts
function idempotencyMiddleware() {
  return async (req, res, next) => {
    const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    if (!rawKey || typeof rawKey !== "string") {
      return next();
    }
    const key = rawKey.trim();
    if (key.length < 8 || key.length > 128) {
      return res.status(400).json({
        error: "Idempotency-Key header must be between 8 and 128 characters."
      });
    }
    const userId = req.user ? req.user._id.toString() : "anonymous";
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    const payloadHash = hashPayload(req.body);
    const dataAccess = getStockDataAccess();
    try {
      const claimResult = await dataAccess.claimIdempotencyKey({
        key,
        userId,
        endpoint,
        payloadHash
      });
      if (!claimResult.claimed) {
        const existing = claimResult.existing;
        if (!existing) {
          return res.status(409).json({
            error: "Idempotency conflict: key was already claimed.",
            code: "IDEMPOTENCY_CONFLICT"
          });
        }
        if (existing.payloadHash !== payloadHash) {
          return res.status(409).json({
            error: "Idempotency conflict: The Idempotency-Key has already been used with a different request payload.",
            code: "IDEMPOTENCY_PAYLOAD_MISMATCH"
          });
        }
        let resolved = existing;
        if (resolved.status === "IN_PROGRESS") {
          for (let i = 0; i < 25; i++) {
            await new Promise((r) => setTimeout(r, 80));
            const poll = await dataAccess.getIdempotencyRecord(key, userId, endpoint);
            if (poll && poll.status === "RESOLVED") {
              resolved = poll;
              break;
            }
          }
        }
        if (resolved.status === "IN_PROGRESS") {
          return res.status(409).json({
            error: "A request with this Idempotency-Key is currently in progress. Please retry shortly.",
            code: "IDEMPOTENCY_IN_PROGRESS"
          });
        }
        res.set("X-Cache-Lookup", "HIT-IDEMPOTENT");
        return res.status(resolved.statusCode || 200).json(resolved.responseBody);
      }
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          dataAccess.resolveIdempotencyKey({
            key,
            userId,
            endpoint,
            statusCode: res.statusCode,
            responseBody: body
          }).catch((err) => {
            console.error("[Idempotency] Failed to resolve key:", err);
          });
        }
        return originalJson(body);
      };
      next();
    } catch (err) {
      console.error("[Idempotency] Error reading idempotency key:", err);
      next();
    }
  };
}

// backend/schemas/stockSchemas.ts
import { z } from "zod";
import { Types as Types4 } from "mongoose";
var requiredIdSchema = z.string().trim().min(1, "ID is required and cannot be empty.").refine((val) => Types4.ObjectId.isValid(val), {
  message: "Invalid ID format: must be a 24-character hexadecimal ObjectId."
});
var optionalIdSchema = z.union([z.string(), z.undefined(), z.null()]).transform((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" ? void 0 : trimmed;
  }
  return void 0;
}).refine((val) => val === void 0 || Types4.ObjectId.isValid(val), {
  message: "Invalid ID format: must be a 24-character hexadecimal ObjectId."
});
var reasonableDateSchema = z.string().refine(
  (val) => {
    if (!val) return true;
    const parsed = new Date(val).getTime();
    if (isNaN(parsed)) return false;
    const maxFuture = Date.now() + 30 * 24 * 60 * 60 * 1e3;
    return parsed <= maxFuture;
  },
  { message: "Date cannot be more than 30 days in the future." }
).optional();
var purchaseBodySchema = z.object({
  itemId: requiredIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.PURCHASE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.PURCHASE.toLocaleString("en-IN")} units per purchase.`),
  supplierName: z.string().max(200, "Supplier name cannot exceed 200 characters.").optional(),
  invoiceNumber: z.string().max(100, "Invoice number cannot exceed 100 characters.").optional(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters.").optional(),
  transactionDate: reasonableDateSchema
});
var bulkPurchaseItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.PURCHASE),
  remarks: z.string().max(500).optional()
});
var bulkPurchaseBodySchema = z.object({
  items: z.array(bulkPurchaseItemSchema).min(1, "At least 1 item is required for bulk stock inward."),
  supplierName: z.string().max(200, "Supplier name cannot exceed 200 characters.").optional(),
  invoiceNumber: z.string().max(100, "Invoice number cannot exceed 100 characters.").optional(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters.").optional(),
  transactionDate: reasonableDateSchema
});
var issueBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: requiredIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.ISSUE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.ISSUE.toLocaleString("en-IN")} units per issue.`),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters.").optional(),
  transactionDate: reasonableDateSchema
});
var bulkIssueItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.ISSUE),
  remarks: z.string().max(500).optional()
});
var bulkIssueBodySchema = z.object({
  technicianId: requiredIdSchema,
  items: z.array(bulkIssueItemSchema).min(1, "At least 1 item is required for bulk issue."),
  kitName: z.string().max(200, "Kit name cannot exceed 200 characters.").optional(),
  kitAmount: z.number().min(0, "Kit amount cannot be negative.").optional(),
  remarks: z.string().max(500).optional(),
  transactionDate: reasonableDateSchema
});
var bulkReturnItemSchema = z.object({
  itemId: requiredIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.RETURN),
  reason: z.string().max(500).optional()
});
var bulkReturnBodySchema = z.object({
  technicianId: requiredIdSchema,
  items: z.array(bulkReturnItemSchema).min(1, "At least 1 item is required for bulk return."),
  remarks: z.string().max(500).optional(),
  transactionDate: reasonableDateSchema
});
var usageBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: optionalIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.USAGE, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.USAGE.toLocaleString("en-IN")} units per site usage.`),
  caseId: z.string().regex(/^\d{8}$/, "Case ID must be exactly 8 digits.").optional(),
  siteName: z.string().max(300).optional(),
  jobReference: z.string().max(100, "Job reference cannot exceed 100 characters.").optional(),
  remarks: z.string().max(500, "Remarks cannot exceed 500 characters.").optional(),
  transactionDate: reasonableDateSchema
});
var returnRequestBodySchema = z.object({
  itemId: requiredIdSchema,
  technicianId: optionalIdSchema,
  quantity: z.number().int("Quantity must be a positive whole integer.").positive("Quantity must be greater than zero.").max(OPERATION_MAX_QUANTITIES.RETURN, `Quantity cannot exceed ${OPERATION_MAX_QUANTITIES.RETURN.toLocaleString("en-IN")} units per return request.`),
  reason: z.string().min(2, "Reason for return is required and must be at least 2 characters.").max(500)
});
function validateBody(schema) {
  return (req, res, next) => {
    if (req.body && typeof req.body.quantity === "string") {
      const num = Number(req.body.quantity);
      if (!isNaN(num)) {
        req.body.quantity = num;
      }
    }
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message
      }));
      return res.status(400).json({
        error: "Validation failed: " + result.error.issues.map((e) => e.message).join(" "),
        details: errors
      });
    }
    req.body = result.data;
    next();
  };
}

// backend/routes/stockRoutes.ts
var router4 = Router4();
router4.post(
  "/purchase",
  requireAuth,
  requireAdmin,
  validateBody(purchaseBodySchema),
  idempotencyMiddleware(),
  stockController.purchase
);
router4.post(
  "/purchase-bulk",
  requireAuth,
  requireAdmin,
  validateBody(bulkPurchaseBodySchema),
  idempotencyMiddleware(),
  stockController.purchaseBulk
);
router4.post(
  "/issue",
  requireAuth,
  requireAdmin,
  validateBody(issueBodySchema),
  idempotencyMiddleware(),
  stockController.issue
);
router4.post(
  "/issue-bulk",
  requireAuth,
  requireAdmin,
  validateBody(bulkIssueBodySchema),
  idempotencyMiddleware(),
  stockController.issueBulk
);
router4.post(
  "/return-bulk",
  requireAuth,
  validateBody(bulkReturnBodySchema),
  idempotencyMiddleware(),
  stockController.returnBulk
);
router4.post(
  "/usage",
  requireAuth,
  validateBody(usageBodySchema),
  idempotencyMiddleware(),
  stockController.usage
);
router4.post("/damage-writeoff", requireAuth, requireAdmin, stockController.damageWriteoff);
router4.post(
  "/return-request",
  requireAuth,
  validateBody(returnRequestBodySchema),
  idempotencyMiddleware(),
  stockController.createReturnRequest
);
router4.get("/return-requests", requireAuth, stockController.getReturnRequests);
router4.put("/return-request/:id/confirm", requireAuth, requireAdmin, stockController.confirmReturnRequest);
router4.put("/return-request/:id/reject", requireAuth, requireAdmin, stockController.rejectReturnRequest);
router4.get("/warehouse-balance", requireAuth, stockController.getWarehouseBalances);
router4.get("/technician-balance/:technicianId", requireAuth, stockController.getTechnicianBalance);
router4.get("/technician-balance", requireAuth, stockController.getTechniciansBalanceMatrix);
router4.get("/ledger", requireAuth, stockController.getLedger);
var stockRoutes_default = router4;

// backend/routes/reportRoutes.ts
import { Router as Router5 } from "express";

// backend/seed.ts
import bcrypt3 from "bcryptjs";
var LIVE_PUREIT_CATALOG = [
  {
    itemCode: "SV-KIT-01",
    itemName: 'Solenoid Valve (SV) Kit with 1/4" Push Connectors & Clamp',
    category: "Spare Part",
    isKit: true,
    brand: "A.O. Smith",
    gkkType: "SV Kit",
    price: 1100,
    oldPrice: 850,
    newPrice: 1100,
    priceNotes: "AO Smith Portal Rate: \u20B9850 | Box Printed MRP (Tech Charge): \u20B91,100",
    unit: "kit",
    compatibleModels: "ProPlanet P7, Z8, Green RO, X8, Elegance Series, Universal RO",
    kitComponents: '\u2022 1x 24V DC High Pressure Solenoid Valve\n\u2022 2x 1/4" Quick Push-Fit Elbow Connectors\n\u2022 1x Heavy Duty Mounting Bracket & Screws\n\u2022 1x Teflon Seal Tape Roll',
    storageLocation: "Rack A-02, Shelf 1",
    description: "Original A.O. Smith Solenoid Valve repair kit for RO purifier automatic shut-off and leakage prevention.",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GMWM100",
    itemName: "Pureit Germkill Kit (One Kit) - Marina & Wave Series",
    category: "One Kit",
    gkkType: "One Kit",
    price: 2500,
    oldPrice: 2200,
    newPrice: 2500,
    priceNotes: "AO Smith Portal: \u20B92,200 | Box MRP (Tech Charge): \u20B92,500",
    unit: "kit",
    compatibleModels: "Marina Pro, Marina Prime, Wave Pro, Wave Prime",
    lowStockThreshold: 6,
    reorderLevel: 6
  },
  {
    itemCode: "GCRX200",
    itemName: "Pureit Germkill Kit (One Kit) - Classic G2 & Marvella",
    category: "One Kit",
    gkkType: "One Kit",
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: "AO Smith Portal: \u20B92,800 | Box MRP (Tech Charge): \u20B93,100",
    unit: "kit",
    compatibleModels: "Classic G2, Marvella Mineral RO+UV+MF+MP, Advance Max Mineral",
    lowStockThreshold: 6,
    reorderLevel: 6
  },
  {
    itemCode: "GPRD500",
    itemName: "Pureit Revito 7-Stage Germkill Kit 2",
    category: "GKK2",
    gkkType: "GKK 2",
    price: 4e3,
    oldPrice: 3600,
    newPrice: 4e3,
    priceNotes: "AO Smith Portal: \u20B93,600 | Box MRP (Tech Charge): \u20B94,000",
    unit: "kit",
    compatibleModels: "Revito Series (7 Stage)",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GPRB500",
    itemName: "Pureit Revito 8-Stage / One Piece Germkill Kit 2",
    category: "GKK2",
    gkkType: "GKK 2",
    price: 4e3,
    oldPrice: 3600,
    newPrice: 4e3,
    priceNotes: "AO Smith Portal: \u20B93,600 | Box MRP (Tech Charge): \u20B94,000",
    unit: "kit",
    compatibleModels: "Revito Series (8 Stage), Revito Series (One piece)",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GPRC500",
    itemName: "Pureit Revito ESF Germkill Kit 1",
    category: "GKK1",
    gkkType: "GKK 1",
    price: 2900,
    oldPrice: 2600,
    newPrice: 2900,
    priceNotes: "AO Smith Portal: \u20B92,600 | Box MRP (Tech Charge): \u20B92,900",
    unit: "kit",
    compatibleModels: "Revito Series (ESF)",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GPRA500",
    itemName: "Pureit Revito One Piece Germkill Kit 1",
    category: "GKK1",
    gkkType: "GKK 1",
    price: 3e3,
    oldPrice: 2700,
    newPrice: 3e3,
    priceNotes: "AO Smith Portal: \u20B92,700 | Box MRP (Tech Charge): \u20B93,000",
    unit: "kit",
    compatibleModels: "Revito Series (One piece)",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GPVA100",
    itemName: "Pureit Vital Series Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 4200,
    oldPrice: 3800,
    newPrice: 4200,
    priceNotes: "AO Smith Portal: \u20B93,800 | Box MRP (Tech Charge): \u20B94,200",
    unit: "kit",
    compatibleModels: "Vital Series",
    lowStockThreshold: 4,
    reorderLevel: 4
  },
  {
    itemCode: "GEAS100",
    itemName: "Pureit Eco Series Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 5e3,
    oldPrice: 4500,
    newPrice: 5e3,
    priceNotes: "AO Smith Portal: \u20B94,500 | Box MRP (Tech Charge): \u20B95,000",
    unit: "kit",
    compatibleModels: "Marvella Eco, Ultima Eco, Copper Eco",
    lowStockThreshold: 4,
    reorderLevel: 4
  },
  {
    itemCode: "RGKK100",
    itemName: "Pureit RO+UV Series Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 4e3,
    oldPrice: 3600,
    newPrice: 4e3,
    priceNotes: "AO Smith Portal: \u20B93,600 | Box MRP (Tech Charge): \u20B94,000",
    unit: "kit",
    compatibleModels: "Ultima RO+UV, Marvella RO+UV, Classic RO+UV",
    lowStockThreshold: 6,
    reorderLevel: 6
  },
  {
    itemCode: "GBRE200",
    itemName: "Pureit Ultima Next Mineral RO UV+MF Germkill Kit 2",
    category: "GKK2",
    gkkType: "GKK 2",
    price: 4e3,
    oldPrice: 3650,
    newPrice: 4e3,
    priceNotes: "AO Smith Portal: \u20B93,650 | Box MRP (Tech Charge): \u20B94,000",
    unit: "kit",
    compatibleModels: "Ultima Next Mineral RO UV+MF",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GBRC200",
    itemName: "Pureit Marvella & Ultima Mineral RO Germkill Kit 2",
    category: "GKK2",
    gkkType: "GKK 2",
    price: 4e3,
    oldPrice: 3650,
    newPrice: 4e3,
    priceNotes: "AO Smith Portal: \u20B93,650 | Box MRP (Tech Charge): \u20B94,000",
    unit: "kit",
    compatibleModels: "Ultima Mineral RO UV+MF, Marvella Mineral RO UV+MF, Marvella RO, Marvella RO Slim",
    lowStockThreshold: 6,
    reorderLevel: 6
  },
  {
    itemCode: "GBRD200",
    itemName: "Pureit Marvella / Ultima / Copper+ Mineral RO Germkill Kit 1",
    category: "GKK1",
    gkkType: "GKK 1",
    price: 2900,
    oldPrice: 2600,
    newPrice: 2900,
    priceNotes: "AO Smith Portal: \u20B92,600 | Box MRP (Tech Charge): \u20B92,900",
    unit: "kit",
    compatibleModels: "Ultima Next Mineral RO UV+MF, Ultima Mineral RO UV+MF, Marvella Mineral RO UV+MF, Marvella RO, Marvella RO Slim, Copper+ Mineral RO+UV+MF",
    lowStockThreshold: 6,
    reorderLevel: 6
  },
  {
    itemCode: "GCUR300",
    itemName: "Pureit Advance Pro & Plus Mineral RO+UV Germkill Kit",
    category: "One Kit",
    gkkType: "One Kit",
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: "AO Smith Portal: \u20B92,800 | Box MRP (Tech Charge): \u20B93,100",
    unit: "kit",
    compatibleModels: "Advance Pro Mineral RO+UV, Advance Plus Mineral RO+UV",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GCRA100",
    itemName: "Pureit RO+MF Series Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: "AO Smith Portal: \u20B92,800 | Box MRP (Tech Charge): \u20B93,100",
    unit: "kit",
    compatibleModels: "RO+MF Classic, RO+MF Advance, RO+MF+MP Advance",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GCUV100",
    itemName: "Pureit Classic & Marvella Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 1500,
    oldPrice: 1350,
    newPrice: 1500,
    priceNotes: "AO Smith Portal: \u20B91,350 | Box MRP (Tech Charge): \u20B91,500",
    unit: "kit",
    compatibleModels: "Classic, Marvella",
    lowStockThreshold: 5,
    reorderLevel: 5
  },
  {
    itemCode: "GCUV300",
    itemName: "Pureit UV+G2 Series Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 2e3,
    oldPrice: 1800,
    newPrice: 2e3,
    priceNotes: "AO Smith Portal: \u20B91,800 | Box MRP (Tech Charge): \u20B92,000",
    unit: "kit",
    compatibleModels: "Marvella UV+G2, Classic UV+G2",
    lowStockThreshold: 4,
    reorderLevel: 4
  },
  {
    itemCode: "GCUV400",
    itemName: "Pureit Copper UV & Copper UV Plus Germkill Kit (One Kit)",
    category: "One Kit",
    gkkType: "One Kit",
    price: 1900,
    oldPrice: 1700,
    newPrice: 1900,
    priceNotes: "AO Smith Portal: \u20B91,700 | Box MRP (Tech Charge): \u20B91,900",
    unit: "kit",
    compatibleModels: "Copper UV, Copper UV Plus",
    lowStockThreshold: 4,
    reorderLevel: 4
  },
  {
    itemCode: "SXGS100",
    itemName: "Pureit Pre-Sediment Filter Candle (Standard Models)",
    category: "SF",
    gkkType: "SF",
    price: 250,
    oldPrice: 220,
    newPrice: 250,
    priceNotes: "AO Smith Portal: \u20B9220 | Box MRP (Tech Charge): \u20B9250",
    unit: "pcs",
    compatibleModels: "Marvella RO, Marvella RO Slim, Classic G2, Mineral RO+UV, Mineral RO+MF and all standard models",
    lowStockThreshold: 15,
    reorderLevel: 15
  },
  {
    itemCode: "WRDR200",
    itemName: "Pureit Sediment / Pre-Carbon Cartridge - Marvella RO Series",
    category: "SF",
    gkkType: "SF",
    price: 250,
    oldPrice: 220,
    newPrice: 250,
    priceNotes: "AO Smith Portal: \u20B9220 | Box MRP (Tech Charge): \u20B9250",
    unit: "pcs",
    compatibleModels: "Marvella RO, Marvella RO Slim",
    lowStockThreshold: 12,
    reorderLevel: 12
  },
  {
    itemCode: "SXGS200",
    itemName: "Pureit Advanced Sediment Filter Cartridge",
    category: "SF",
    gkkType: "SF",
    price: 350,
    oldPrice: 300,
    newPrice: 350,
    priceNotes: "AO Smith Portal: \u20B9300 | Box MRP (Tech Charge): \u20B9350",
    unit: "pcs",
    compatibleModels: "Classic G2, Mineral RO+UV, Mineral RO+MF, All New RO Models",
    lowStockThreshold: 15,
    reorderLevel: 15
  }
];
async function resetAndSeedPureitData(force = false) {
  const existingItems = await storageService.listItems();
  const hasDummyItems = existingItems.some(
    (i) => i.itemCode.startsWith("GKK-") || i.itemCode === "SF-05" || i.itemCode === "SP-TAP"
  );
  if (hasDummyItems || force) {
    console.log("[SEED] Purging dummy data and reseeding with original Pureit catalog...");
    await storageService.clearAllData();
  } else if (existingItems.length > 0) {
    console.log("[SEED] Database already holds catalog. Verifying dual price backfills...");
    for (const item of existingItems) {
      if (!item.newPrice || !item.oldPrice || item.newPrice === 0) {
        const catalogMatch = LIVE_PUREIT_CATALOG.find((c) => c.itemCode === item.itemCode);
        const oldP = catalogMatch?.oldPrice || Math.round((item.price || 1e3) * 0.88);
        const newP = catalogMatch?.newPrice || (item.price || 1e3);
        await storageService.updateItem(item._id, {
          oldPrice: oldP,
          newPrice: newP,
          price: newP,
          priceNotes: catalogMatch?.priceNotes || `AO Smith Portal: \u20B9${oldP} | Box MRP: \u20B9${newP}`,
          priceUpdatedAt: /* @__PURE__ */ new Date()
        });
      }
    }
    console.log("[SEED] Catalog dual prices verified.");
    return;
  }
  console.log("[SEED] Seeding database with authentic Pureit GKK / Filter inventory...");
  const adminPasswordHash = await bcrypt3.hash("admin123", 10);
  const admin = await storageService.createUser({
    name: "Suresh Verma (Central Warehouse)",
    phone: "9876543210",
    passwordHash: adminPasswordHash,
    role: "admin",
    isActive: true
  });
  const techPasswordHash = await bcrypt3.hash("tech123", 10);
  const tech1 = await storageService.createUser({
    name: "Rajesh Kumar",
    phone: "9876500001",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true
  });
  const tech2 = await storageService.createUser({
    name: "Amit Sharma",
    phone: "9876500002",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true
  });
  const tech3 = await storageService.createUser({
    name: "Priya Patel",
    phone: "9876500003",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true
  });
  const tech4 = await storageService.createUser({
    name: "Vikram Singh",
    phone: "9876500004",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true
  });
  const createdItems = [];
  for (const itemData of LIVE_PUREIT_CATALOG) {
    const item = await storageService.createItem(itemData);
    createdItems.push(item);
  }
  const purchases = [
    { code: "GMWM100", qty: 25, inv: "HUL-PUR-2026-081" },
    { code: "GCRX200", qty: 20, inv: "HUL-PUR-2026-081" },
    { code: "GPRD500", qty: 15, inv: "HUL-PUR-2026-082" },
    { code: "GPRB500", qty: 15, inv: "HUL-PUR-2026-082" },
    { code: "GPRC500", qty: 18, inv: "HUL-PUR-2026-082" },
    { code: "GPRA500", qty: 16, inv: "HUL-PUR-2026-082" },
    { code: "GPVA100", qty: 12, inv: "HUL-PUR-2026-083" },
    { code: "GEAS100", qty: 10, inv: "HUL-PUR-2026-083" },
    { code: "RGKK100", qty: 20, inv: "HUL-PUR-2026-083" },
    { code: "GBRE200", qty: 14, inv: "HUL-PUR-2026-084" },
    { code: "GBRC200", qty: 22, inv: "HUL-PUR-2026-084" },
    { code: "GBRD200", qty: 25, inv: "HUL-PUR-2026-084" },
    { code: "GCUR300", qty: 16, inv: "HUL-PUR-2026-085" },
    { code: "GCRA100", qty: 18, inv: "HUL-PUR-2026-085" },
    { code: "GCUV100", qty: 15, inv: "HUL-PUR-2026-086" },
    { code: "GCUV300", qty: 12, inv: "HUL-PUR-2026-086" },
    { code: "GCUV400", qty: 14, inv: "HUL-PUR-2026-086" },
    { code: "SXGS100", qty: 60, inv: "HUL-PUR-2026-087" },
    { code: "WRDR200", qty: 45, inv: "HUL-PUR-2026-087" },
    { code: "SXGS200", qty: 50, inv: "HUL-PUR-2026-087" }
  ];
  for (const p of purchases) {
    const item = createdItems.find((i) => i.itemCode === p.code);
    if (!item) continue;
    await storageService.insertStockTransaction({
      transactionType: "PURCHASE_IN",
      item: item._id,
      quantity: p.qty,
      supplierName: "Hindustan Unilever Ltd (Pureit OEM Supply)",
      invoiceNumber: p.inv,
      performedBy: admin._id,
      remarks: "Primary factory stock intake from HUL Pureit hub",
      transactionDate: new Date(Date.now() - 14 * 24 * 3600 * 1e3)
    });
    await storageService.updateWarehouseBalance(item._id, p.qty);
  }
  const stockIssues = [
    // Rajesh Kumar
    { tech: tech1, code: "GMWM100", qty: 4, remarks: "Weekly allocation for Marina / Wave maintenance" },
    { tech: tech1, code: "GCRX200", qty: 3, remarks: "Classic G2 & Marvella kit replenishment" },
    { tech: tech1, code: "SXGS100", qty: 10, remarks: "Pre-sediment filter candles" },
    { tech: tech1, code: "SXGS200", qty: 8, remarks: "Advanced sediment filter cartridges" },
    // Amit Sharma
    { tech: tech2, code: "GBRC200", qty: 4, remarks: "Ultima/Marvella GKK 2 kits for high-TDS zones" },
    { tech: tech2, code: "GBRD200", qty: 4, remarks: "Mineral RO GKK 1 kits" },
    { tech: tech2, code: "WRDR200", qty: 8, remarks: "Marvella RO sediment/carbon cartridges" },
    { tech: tech2, code: "SXGS100", qty: 8, remarks: "Sediment pre-filters" },
    // Priya Patel
    { tech: tech3, code: "RGKK100", qty: 3, remarks: "Ultima RO+UV One Kit replacements" },
    { tech: tech3, code: "GCUR300", qty: 3, remarks: "Advance Pro & Plus Mineral RO kits" },
    { tech: tech3, code: "GCUV100", qty: 3, remarks: "Classic & Marvella UV kits" },
    { tech: tech3, code: "SXGS200", qty: 6, remarks: "Classic G2 sediment cartridges" },
    // Vikram Singh
    { tech: tech4, code: "GPRD500", qty: 3, remarks: "Pureit Revito 7-stage GKK 2 spares" },
    { tech: tech4, code: "GPRB500", qty: 2, remarks: "Revito 8-stage GKK 2 spares" },
    { tech: tech4, code: "GPRC500", qty: 3, remarks: "Revito ESF GKK 1 spares" },
    { tech: tech4, code: "SXGS100", qty: 6, remarks: "Pre-sediment filter candles" }
  ];
  for (const issue of stockIssues) {
    const item = createdItems.find((i) => i.itemCode === issue.code);
    if (!item) continue;
    await storageService.insertStockTransaction({
      transactionType: "ISSUE_TO_TECH",
      item: item._id,
      technician: issue.tech._id,
      quantity: issue.qty,
      performedBy: admin._id,
      remarks: issue.remarks,
      transactionDate: new Date(Date.now() - 7 * 24 * 3600 * 1e3)
    });
    await storageService.updateWarehouseBalance(item._id, -issue.qty);
    await storageService.updateTechnicianBalance(issue.tech._id, item._id, issue.qty);
  }
  const usages = [
    {
      tech: tech1,
      code: "GMWM100",
      qty: 2,
      site: "Palm Meadows Villa 14, Whitefield",
      jobRef: "PUR-JOB-401",
      remarks: "Pureit Marina Pro annual scheduled GKK maintenance completed"
    },
    {
      tech: tech1,
      code: "SXGS100",
      qty: 3,
      site: "Sobha Silicon Oasis Flat 502, Hosa Road",
      jobRef: "PUR-JOB-402",
      remarks: "Choked pre-sediment filter candle replaced on Pureit Classic RO"
    },
    {
      tech: tech1,
      code: "GCRX200",
      qty: 1,
      site: "Prestige Shantiniketan Tower 7, Apt 1102",
      jobRef: "PUR-JOB-403",
      remarks: "Pureit Classic G2 service and One Kit installation"
    },
    {
      tech: tech2,
      code: "GBRC200",
      qty: 1,
      site: "Green Glen Apartments Apt 402, Bellandur",
      jobRef: "PUR-JOB-405",
      remarks: "Pureit Marvella Mineral RO GKK 2 membrane kit replaced (TDS restored to 28 ppm)"
    },
    {
      tech: tech2,
      code: "GBRD200",
      qty: 1,
      site: "Green Glen Apartments Apt 402, Bellandur",
      jobRef: "PUR-JOB-405",
      remarks: "Pureit Marvella Mineral RO GKK 1 primary filter replaced"
    },
    {
      tech: tech2,
      code: "WRDR200",
      qty: 2,
      site: "Shriram Greenfield B-302, Budigere Cross",
      jobRef: "PUR-JOB-406",
      remarks: "Pureit Marvella RO Slim internal sediment cartridge replaced"
    },
    {
      tech: tech3,
      code: "RGKK100",
      qty: 1,
      site: "Brigade Meadows Cedar Block 104, Kanakapura Rd",
      jobRef: "PUR-JOB-408",
      remarks: "Pureit Ultima RO+UV annual service completed with One Kit"
    },
    {
      tech: tech3,
      code: "SXGS200",
      qty: 2,
      site: "Godrej United Tower 2 Apt 601, Hoodi",
      jobRef: "PUR-JOB-409",
      remarks: "Classic G2 sediment pre-filter replaced due to high inlet turbidity"
    },
    {
      tech: tech4,
      code: "GPRC500",
      qty: 1,
      site: "Purva Westend A-802, Kudlu Gate",
      jobRef: "PUR-JOB-412",
      remarks: "Pureit Revito ESF Germkill Kit 1 service performed"
    },
    {
      tech: tech4,
      code: "SXGS100",
      qty: 1,
      site: "Purva Westend A-802, Kudlu Gate",
      jobRef: "PUR-JOB-412",
      remarks: "External pre-filter candle replaced"
    }
  ];
  for (const u of usages) {
    const item = createdItems.find((i) => i.itemCode === u.code);
    if (!item) continue;
    await storageService.insertStockTransaction({
      transactionType: "USAGE_AT_SITE",
      item: item._id,
      technician: u.tech._id,
      quantity: u.qty,
      siteName: u.site,
      jobReference: u.jobRef,
      performedBy: u.tech._id,
      remarks: u.remarks,
      transactionDate: new Date(Date.now() - 3 * 24 * 3600 * 1e3)
    });
    await storageService.updateTechnicianBalance(u.tech._id, item._id, -u.qty);
  }
  const returnItem = createdItems.find((i) => i.itemCode === "SXGS200");
  await storageService.insertStockTransaction({
    transactionType: "RETURN_TO_WAREHOUSE",
    item: returnItem._id,
    technician: tech1._id,
    quantity: 1,
    reason: "Surplus sediment filter cartridge from completed job returned to warehouse",
    performedBy: admin._id,
    remarks: "Verified by central warehouse manager",
    transactionDate: new Date(Date.now() - 1 * 24 * 3600 * 1e3)
  });
  await storageService.updateTechnicianBalance(tech1._id, returnItem._id, -1);
  await storageService.updateWarehouseBalance(returnItem._id, 1);
  const pendingReturnItem = createdItems.find((i) => i.itemCode === "WRDR200");
  await storageService.createReturnRequest({
    technician: tech2._id,
    item: pendingReturnItem._id,
    quantity: 1,
    reason: "Customer rescheduled appointment to next month"
  });
  console.log("[SEED] Pureit live inventory seeding completed successfully.");
  console.log("[SEED] Default logins:");
  console.log("       Admin: Phone 9876543210 / Password admin123");
  console.log("       Techs: Phone 9876500001 (Rajesh), 9876500002 (Amit), 9876500003 (Priya), 9876500004 (Vikram) / Password tech123");
}
async function resetToZeroStock() {
  console.log("[SEED] Purging all transactions and setting all stock to ZERO (0) for fresh user entry...");
  await storageService.clearAllData();
  const adminPasswordHash = await bcrypt3.hash("admin123", 10);
  await storageService.createUser({
    name: "Suresh Verma (Central Warehouse)",
    phone: "9876543210",
    passwordHash: adminPasswordHash,
    role: "admin",
    isActive: true
  });
  const techPasswordHash = await bcrypt3.hash("tech123", 10);
  await storageService.createUser({
    name: "Rajesh Kumar",
    phone: "9876500001",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true,
    employeeCode: "PUR-TECH-01",
    area: "South Delhi Hub"
  });
  await storageService.createUser({
    name: "Amit Sharma",
    phone: "9876500002",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true,
    employeeCode: "PUR-TECH-02",
    area: "Noida & Greater Noida"
  });
  await storageService.createUser({
    name: "Priya Patel",
    phone: "9876500003",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true,
    employeeCode: "PUR-TECH-03",
    area: "Gurugram Central"
  });
  await storageService.createUser({
    name: "Vikram Singh",
    phone: "9876500004",
    passwordHash: techPasswordHash,
    role: "technician",
    isActive: true,
    employeeCode: "PUR-TECH-04",
    area: "Ghaziabad East"
  });
  for (const itemData of LIVE_PUREIT_CATALOG) {
    await storageService.createItem(itemData);
  }
  console.log("[SEED] All stock successfully initialized to ZERO (0). Ready for manual user entry.");
}
async function seedDatabase() {
  await resetToZeroStock();
}

// backend/controllers/reportController.ts
var reportController = {
  // POST /api/reports/reset-zero-stock
  async resetZeroStock(req, res) {
    try {
      await resetToZeroStock();
      const data = await storageService.computeReconciliation(true);
      return res.json({
        message: "All stock has been set to ZERO (0). Authentic Pureit catalog & technician accounts are ready for manual entries.",
        ...data
      });
    } catch (err) {
      console.error("Error resetting to zero stock:", err);
      return res.status(500).json({ error: "Failed to reset all stock to zero." });
    }
  },
  // POST /api/reports/reset-live-catalog
  async resetLiveCatalog(req, res) {
    try {
      await resetAndSeedPureitData(true);
      const data = await storageService.computeReconciliation(true);
      return res.json({
        message: "Database purged of dummy data and successfully populated with live Pureit catalog and ledger.",
        ...data
      });
    } catch (err) {
      console.error("Error resetting to live Pureit catalog:", err);
      return res.status(500).json({ error: "Failed to reset database with live Pureit catalog." });
    }
  },
  // GET /api/reports/reconciliation
  async getReconciliation(req, res) {
    try {
      const data = await storageService.computeReconciliation(false);
      return res.json(data);
    } catch (err) {
      console.error("Error computing reconciliation:", err);
      return res.status(500).json({ error: "Failed to compute reconciliation audit report." });
    }
  },
  // POST /api/reports/reconciliation/recalculate
  async recalculateAndVerify(req, res) {
    try {
      const { resync } = req.body;
      const shouldResync = resync !== void 0 ? Boolean(resync) : true;
      const data = await storageService.computeReconciliation(shouldResync);
      return res.json({
        message: shouldResync ? "Ledger independently re-summed and verified. Cached balances synchronized." : "Ledger independently re-summed and verified against cached balances.",
        ...data
      });
    } catch (err) {
      console.error("Error recalculating from ledger:", err);
      return res.status(500).json({ error: "Failed to recalculate and verify from ledger." });
    }
  },
  // GET /api/reports/low-stock
  async getLowStock(req, res) {
    try {
      const items = await storageService.listItems({ isActive: true });
      const lowStockItems = [];
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
            urgency: warehouseQty === 0 ? "CRITICAL_OUT_OF_STOCK" : "BELOW_THRESHOLD"
          });
        }
      }
      lowStockItems.sort((a, b) => {
        if (a.warehouseQty === 0 && b.warehouseQty > 0) return -1;
        if (b.warehouseQty === 0 && a.warehouseQty > 0) return 1;
        return b.deficit - a.deficit;
      });
      return res.json({
        count: lowStockItems.length,
        items: lowStockItems
      });
    } catch (err) {
      console.error("Error fetching low stock report:", err);
      return res.status(500).json({ error: "Failed to retrieve low-stock report." });
    }
  },
  // GET /api/reports/dashboard-stats
  async getDashboardStats(req, res) {
    try {
      const [items, technicians, warehouseBalances, returnRequests] = await Promise.all([
        storageService.listItems({ isActive: true }),
        storageService.listTechnicians(),
        storageService.getAllWarehouseBalances(),
        storageService.listReturnRequests({ status: "PENDING" })
      ]);
      const totalItems = items.length;
      const activeTechnicians = technicians.length;
      const pendingReturnsCount = returnRequests.length;
      let totalWarehouseQty = 0;
      let lowStockCount = 0;
      const lowStockItems = [];
      for (const item of items) {
        const balEntry = warehouseBalances.find((b) => {
          const bItemId = typeof b.item === "string" ? b.item : b.item?._id;
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
            urgency: bal === 0 ? "CRITICAL_OUT_OF_STOCK" : "BELOW_THRESHOLD"
          });
        }
      }
      lowStockItems.sort((a, b) => {
        if (a.warehouseQty === 0 && b.warehouseQty > 0) return -1;
        if (b.warehouseQty === 0 && a.warehouseQty > 0) return 1;
        return b.deficit - a.deficit;
      });
      const startOfMonth = /* @__PURE__ */ new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const recentTransactions = await storageService.listStockTransactions({
        type: "ISSUE_TO_TECH",
        fromDate: startOfMonth.toISOString()
      });
      const techIssueMap = {};
      for (const tech of technicians) {
        techIssueMap[tech._id] = {
          techName: tech.name,
          totalQty: 0,
          txCount: 0
        };
      }
      for (const tx of recentTransactions) {
        const techId = typeof tx.technician === "string" ? tx.technician : tx.technician?._id;
        if (techId && techIssueMap[techId]) {
          techIssueMap[techId].totalQty += Number(tx.quantity) || 0;
          techIssueMap[techId].txCount += 1;
        }
      }
      const issuesPerTechnicianChartData = Object.values(techIssueMap).map((d) => ({
        technician: d.techName,
        issuedQuantity: Math.round(d.totalQty * 100) / 100,
        issuesCount: d.txCount
      }));
      const recentActivity = await storageService.listStockTransactions({ limit: 8 });
      return res.json({
        summary: {
          totalItems,
          totalWarehouseQty: Math.round(totalWarehouseQty * 100) / 100,
          activeTechnicians,
          lowStockCount,
          pendingReturnsCount
        },
        lowStockItems,
        issuesPerTechnicianChartData,
        recentActivity
      });
    } catch (err) {
      console.error("Error generating dashboard stats:", err);
      return res.status(500).json({ error: "Failed to generate dashboard statistics." });
    }
  },
  // GET /api/reports/export/inventory-csv
  async exportInventoryCsv(req, res) {
    try {
      const [items, warehouseBalances, reconciliationData] = await Promise.all([
        storageService.listItems(),
        storageService.getAllWarehouseBalances(),
        storageService.computeReconciliation(false)
      ]);
      const headers = [
        "Item SKU Code",
        "Item Description",
        "Category",
        "GKK Kit Type",
        "Unit of Measure",
        "Official MRP (INR)",
        "Warehouse Stock (Units)",
        "Low Stock Threshold (Min Units)",
        "Stock Health Status",
        "Replenishment Deficit",
        "Stock Valuation (INR)",
        "Stock with Technicians",
        "Total Lifetime Purchased",
        "Total Consumed at Sites",
        "Total Damaged Write-offs",
        "Audit Reconciliation Status",
        "Compatible Models",
        "Catalog Status",
        "Audit Timestamp"
      ];
      const escapeCell = (v) => {
        if (v === null || v === void 0) return '""';
        const str = String(v);
        if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };
      const rows = items.map((item) => {
        const balEntry = warehouseBalances.find((b) => {
          const bItemId = typeof b.item === "string" ? b.item : b.item?._id;
          return bItemId === item._id;
        });
        const warehouseQty = balEntry?.quantity ?? 0;
        const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
        const deficit = Math.max(0, threshold - warehouseQty);
        const valuation = Math.round(warehouseQty * (item.price || 0) * 100) / 100;
        const rec = reconciliationData.items.find((r) => r.item._id === item._id);
        let status = "SUFFICIENT (HEALTHY)";
        if (warehouseQty === 0) status = "CRITICAL (OUT OF STOCK)";
        else if (warehouseQty <= threshold) status = "BELOW MINIMUM THRESHOLD";
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
          rec?.status ?? "MATCHED",
          item.compatibleModels || "N/A",
          item.isActive !== false ? "ACTIVE" : "INACTIVE",
          (/* @__PURE__ */ new Date()).toISOString()
        ];
      });
      const csvContent = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(
        "\r\n"
      );
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pureit_inventory_audit_${dateStr}.csv"`
      );
      return res.send(csvContent);
    } catch (err) {
      console.error("Error generating inventory CSV:", err);
      return res.status(500).json({ error: "Failed to export inventory CSV." });
    }
  },
  // GET /api/reports/export/ledger-csv
  async exportLedgerCsv(req, res) {
    try {
      const { type, itemId, technicianId, fromDate, toDate } = req.query;
      const transactions = await storageService.listStockTransactions({
        type,
        itemId,
        technicianId,
        fromDate,
        toDate,
        limit: 1e4
      });
      const headers = [
        "Transaction ID",
        "Date",
        "Time (UTC)",
        "Transaction Type",
        "Item SKU Code",
        "Item Description",
        "Category",
        "Quantity",
        "Unit",
        "Technician Name",
        "Technician Phone",
        "Supplier / Vendor",
        "Supplier Invoice / PO #",
        "Site / Client Name",
        "Job / Ticket Reference",
        "Audit Reason / Purpose",
        "Remarks / Notes",
        "Performed By (User)",
        "Created Timestamp"
      ];
      const escapeCell = (v) => {
        if (v === null || v === void 0) return '""';
        const str = String(v);
        if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };
      const rows = transactions.map((tx) => {
        const item = typeof tx.item === "object" ? tx.item : null;
        const tech = typeof tx.technician === "object" ? tx.technician : null;
        const performedBy = typeof tx.performedBy === "object" ? tx.performedBy?.name : "System/Admin";
        const txDate = tx.transactionDate ? new Date(tx.transactionDate) : /* @__PURE__ */ new Date();
        return [
          tx._id,
          txDate.toISOString().slice(0, 10),
          txDate.toISOString().slice(11, 19),
          tx.transactionType,
          item?.itemCode || "UNKNOWN",
          item?.itemName || "Item",
          item?.category || "",
          tx.quantity,
          item?.unit || "pcs",
          tech?.name || "N/A",
          tech?.phone || "N/A",
          tx.supplierName || "N/A",
          tx.invoiceNumber || "N/A",
          tx.siteName || "N/A",
          tx.jobReference || "N/A",
          tx.reason || "N/A",
          tx.remarks || "",
          performedBy,
          tx.createdAt ? new Date(tx.createdAt).toISOString() : txDate.toISOString()
        ];
      });
      const csvContent = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(
        "\r\n"
      );
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pureit_ledger_audit_${dateStr}.csv"`
      );
      return res.send(csvContent);
    } catch (err) {
      console.error("Error generating ledger CSV:", err);
      return res.status(500).json({ error: "Failed to export ledger CSV." });
    }
  }
};

// backend/routes/reportRoutes.ts
var router5 = Router5();
router5.get("/reconciliation", requireAuth, requireAdmin, reportController.getReconciliation);
router5.post("/reconciliation/recalculate", requireAuth, requireAdmin, reportController.recalculateAndVerify);
router5.post("/reset-zero-stock", requireAuth, requireAdmin, reportController.resetZeroStock);
router5.post("/reset-live-catalog", requireAuth, requireAdmin, reportController.resetLiveCatalog);
router5.get("/low-stock", requireAuth, reportController.getLowStock);
router5.get("/dashboard-stats", requireAuth, reportController.getDashboardStats);
router5.get("/export/inventory-csv", requireAuth, requireAdmin, reportController.exportInventoryCsv);
router5.get("/export/ledger-csv", requireAuth, requireAdmin, reportController.exportLedgerCsv);
var reportRoutes_default = router5;

// backend/routes/notificationRoutes.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/stream", requireAuth, (req, res) => {
  const user = req.user;
  const clientId = `${user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(": connected\n\n");
  notificationService.addClient(clientId, user._id, user.role, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 2e4);
  req.on("close", () => {
    clearInterval(heartbeat);
    notificationService.removeClient(clientId);
  });
});
router6.get("/", requireAuth, (req, res) => {
  const user = req.user;
  const notifications = notificationService.getNotificationsForUser(user._id, user.role);
  const unreadCount = notifications.filter((n) => !n.read).length;
  return res.json({
    notifications,
    unreadCount
  });
});
router6.put("/:id/read", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const updated = notificationService.markAsRead(id, user._id);
  return res.json({
    success: updated,
    message: updated ? "Notification marked as read" : "Notification not found"
  });
});
router6.put("/mark-all-read", requireAuth, (req, res) => {
  const user = req.user;
  const count = notificationService.markAllAsRead(user._id, user.role);
  return res.json({
    success: true,
    markedCount: count
  });
});
router6.delete("/clear", requireAuth, (req, res) => {
  const user = req.user;
  notificationService.clearReadNotifications(user._id, user.role);
  return res.json({
    success: true,
    message: "Read notifications cleared"
  });
});
var notificationRoutes_default = router6;

// backend/app.ts
function createExpressApp() {
  const app = express();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key, x-idempotency-key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json());
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Field Service Stock & Inventory Management System",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.use("/api/auth", authRoutes_default);
  app.use("/api/items", itemRoutes_default);
  app.use("/api", technicianRoutes_default);
  app.use("/api/stock", stockRoutes_default);
  app.use("/api/reports", reportRoutes_default);
  app.use("/api/notifications", notificationRoutes_default);
  app.use("/notifications", notificationRoutes_default);
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });
  app.use((err, req, res, next) => {
    console.error("[Unhandled Express Error]:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(err.status || 500).json({
      error: err.message || "Internal server error occurred.",
      code: err.code || "INTERNAL_SERVER_ERROR"
    });
  });
  return app;
}

// server.ts
var appDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
process.on("uncaughtException", (err) => {
  console.error("[Process Error] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process Error] Unhandled Rejection at:", promise, "reason:", reason);
});
async function startServer() {
  const PORT = Number(process.env.PORT) || 3e3;
  const app = createExpressApp();
  await initDatabase();
  await seedDatabase();
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Mounting Vite development middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving production static files from dist...");
    const distPath = path.join(appDir, "dist");
    app.use(express2.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Field Service Stock System running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[Server] Fatal error on startup:", err);
  process.exit(1);
});
