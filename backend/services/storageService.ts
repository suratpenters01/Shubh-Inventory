import { Types } from 'mongoose';
import {
  IUser,
  IItem,
  IStockTransaction,
  IWarehouseBalance,
  ITechnicianBalance,
  IReturnRequest,
  IReconciliationItem,
} from '../types/index.js';
import {
  inMemoryDb,
  isMongoConnected,
  UserModel,
  ItemModel,
  StockTransactionModel,
  WarehouseBalanceModel,
  TechnicianBalanceModel,
  ReturnRequestModel,
  TransactionSession,
} from '../db/index.js';

export const storageService = {
  // --- USERS ---
  async findUserByPhone(phone: string): Promise<IUser | null> {
    if (isMongoConnected()) {
      const doc = await UserModel.findOne({ phone }).lean();
      return doc ? (doc as any) : null;
    }
    for (const u of inMemoryDb.users.values()) {
      if (u.phone === phone) return { ...u };
    }
    return null;
  },

  async findUserById(id: string): Promise<IUser | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await UserModel.findById(id).lean();
      return doc ? (doc as any) : null;
    }
    const u = inMemoryDb.users.get(id);
    return u ? { ...u } : null;
  },

  async createUser(userData: Omit<IUser, '_id'> & { _id?: string }): Promise<IUser> {
    if (isMongoConnected()) {
      const doc = await UserModel.create(userData);
      return doc.toObject() as any;
    }
    const _id = userData._id || inMemoryDb.generateId();
    const newUser: IUser = {
      ...userData,
      _id,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: userData.createdAt || new Date(),
    };
    inMemoryDb.users.set(_id, newUser);
    return { ...newUser };
  },

  async listTechnicians(): Promise<IUser[]> {
    if (isMongoConnected()) {
      const list = await UserModel.find({ role: 'technician' }).sort({ name: 1 }).lean();
      return list as any;
    }
    return Array.from(inMemoryDb.users.values())
      .filter((u) => u.role === 'technician')
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async listUsers(): Promise<IUser[]> {
    if (isMongoConnected()) {
      return (await UserModel.find().sort({ name: 1 }).lean()) as any;
    }
    return Array.from(inMemoryDb.users.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  async updateUser(id: string, updates: Partial<IUser>): Promise<IUser | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await UserModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
      return doc ? (doc as any) : null;
    }
    const existing = inMemoryDb.users.get(id);
    if (!existing) return null;
    const updated: IUser = {
      ...existing,
      ...updates,
      _id: id,
    };
    inMemoryDb.users.set(id, updated);
    return { ...updated };
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return false;
    }
    if (isMongoConnected()) {
      const res = await UserModel.findByIdAndDelete(id);
      return !!res;
    }
    return inMemoryDb.users.delete(id);
  },

  // --- ITEMS ---
  async findItemById(id: string): Promise<IItem | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ItemModel.findById(id).lean();
      return doc ? (doc as any) : null;
    }
    const item = inMemoryDb.items.get(id);
    return item ? { ...item } : null;
  },

  async findItemByCode(code: string): Promise<IItem | null> {
    if (isMongoConnected()) {
      const doc = await ItemModel.findOne({ itemCode: code }).lean();
      return doc ? (doc as any) : null;
    }
    for (const item of inMemoryDb.items.values()) {
      if (item.itemCode.toLowerCase() === code.toLowerCase()) {
        return { ...item };
      }
    }
    return null;
  },

  async clearAllData(): Promise<void> {
    if (isMongoConnected()) {
      await Promise.all([
        UserModel.deleteMany({}),
        ItemModel.deleteMany({}),
        StockTransactionModel.deleteMany({}),
        WarehouseBalanceModel.deleteMany({}),
        TechnicianBalanceModel.deleteMany({}),
        ReturnRequestModel.deleteMany({}),
      ]);
      return;
    }
    inMemoryDb.clearAll();
  },

  async createItem(itemData: Omit<IItem, '_id'> & { _id?: string }): Promise<IItem> {
    const rawThreshold = itemData.lowStockThreshold !== undefined
      ? itemData.lowStockThreshold
      : (itemData.reorderLevel !== undefined ? itemData.reorderLevel : 5);
    const parsedThreshold = Number(rawThreshold);
    const thresholdVal = isNaN(parsedThreshold) || parsedThreshold < 0 ? 5 : parsedThreshold;

    const dataToSave = {
      ...itemData,
      lowStockThreshold: thresholdVal,
      reorderLevel: thresholdVal,
    };

    if (isMongoConnected()) {
      const doc = await ItemModel.create(dataToSave);
      // Initialize warehouse balance to 0
      await WarehouseBalanceModel.create({
        item: doc._id,
        quantity: 0,
        lastUpdated: new Date(),
      });
      return doc.toObject() as any;
    }
    const _id = itemData._id || inMemoryDb.generateId();
    const newItem: IItem = {
      ...dataToSave,
      _id,
      brand: itemData.brand || '',
      storageLocation: itemData.storageLocation || '',
      description: itemData.description || '',
      isKit: Boolean(itemData.isKit || itemData.category === 'One Kit' || (itemData.category && itemData.category.includes('Kit'))),
      kitComponents: itemData.kitComponents || '',
      supplier: itemData.supplier || '',
      hsnCode: itemData.hsnCode || '',
      barcode: itemData.barcode || '',
      price: itemData.price !== undefined ? Number(itemData.price) : 0,
      oldPrice: itemData.oldPrice !== undefined ? Number(itemData.oldPrice) : (itemData.price !== undefined ? Number(itemData.price) : 0),
      newPrice: itemData.newPrice !== undefined ? Number(itemData.newPrice) : (itemData.price !== undefined ? Number(itemData.price) : 0),
      priceNotes: itemData.priceNotes || '',
      priceUpdatedAt: itemData.priceUpdatedAt || new Date(),
      gkkType: itemData.gkkType || '',
      lowStockThreshold: thresholdVal,
      reorderLevel: thresholdVal,
      isActive: itemData.isActive !== undefined ? itemData.isActive : true,
      unit: itemData.unit || 'pcs',
      createdAt: itemData.createdAt || new Date(),
    };
    inMemoryDb.items.set(_id, newItem);
    // Initialize warehouse balance
    inMemoryDb.warehouseBalances.set(_id, {
      _id: inMemoryDb.generateId(),
      item: _id,
      quantity: 0,
      lastUpdated: new Date(),
    });
    return { ...newItem };
  },

  async updateItem(id: string, updates: Partial<IItem>): Promise<IItem | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.lowStockThreshold !== undefined) {
      const t = Number(normalizedUpdates.lowStockThreshold);
      const val = isNaN(t) || t < 0 ? 5 : t;
      normalizedUpdates.lowStockThreshold = val;
      normalizedUpdates.reorderLevel = val;
    } else if (normalizedUpdates.reorderLevel !== undefined) {
      const r = Number(normalizedUpdates.reorderLevel);
      const val = isNaN(r) || r < 0 ? 5 : r;
      normalizedUpdates.lowStockThreshold = val;
      normalizedUpdates.reorderLevel = val;
    }

    if (isMongoConnected()) {
      const doc = await ItemModel.findByIdAndUpdate(id, normalizedUpdates, { new: true }).lean();
      return doc ? (doc as any) : null;
    }
    const existing = inMemoryDb.items.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...normalizedUpdates,
      lowStockThreshold: normalizedUpdates.lowStockThreshold ?? existing.lowStockThreshold ?? existing.reorderLevel ?? 5,
      reorderLevel: normalizedUpdates.reorderLevel ?? existing.reorderLevel ?? existing.lowStockThreshold ?? 5,
    };
    inMemoryDb.items.set(id, updated);
    return { ...updated };
  },

  async listItems(query?: { category?: string; search?: string; isActive?: boolean }): Promise<IItem[]> {
    if (isMongoConnected()) {
      const filter: any = {};
      if (query?.category) filter.category = query.category;
      if (query?.isActive !== undefined) filter.isActive = query.isActive;
      if (query?.search) {
        filter.$or = [
          { itemName: { $regex: query.search, $options: 'i' } },
          { itemCode: { $regex: query.search, $options: 'i' } },
          { compatibleModels: { $regex: query.search, $options: 'i' } },
          { gkkType: { $regex: query.search, $options: 'i' } },
        ];
      }
      return (await ItemModel.find(filter).sort({ itemCode: 1 }).lean()) as any;
    }
    let items = Array.from(inMemoryDb.items.values());
    if (query?.category) {
      items = items.filter((i) => i.category === query.category);
    }
    if (query?.isActive !== undefined) {
      items = items.filter((i) => i.isActive === query.isActive);
    }
    if (query?.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.itemName.toLowerCase().includes(s) ||
          i.itemCode.toLowerCase().includes(s) ||
          (i.compatibleModels || '').toLowerCase().includes(s) ||
          (i.gkkType || '').toLowerCase().includes(s) ||
          (i.brand || '').toLowerCase().includes(s) ||
          (i.kitComponents || '').toLowerCase().includes(s) ||
          (i.storageLocation || '').toLowerCase().includes(s)
      );
    }
    return items.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  },

  // --- WAREHOUSE BALANCES ---
  async getWarehouseBalance(itemId: string): Promise<number> {
    if (isMongoConnected()) {
      const doc = await WarehouseBalanceModel.findOne({ item: itemId }).lean();
      return doc ? (doc as any).quantity : 0;
    }
    const bal = inMemoryDb.warehouseBalances.get(itemId);
    return bal ? bal.quantity : 0;
  },

  async updateWarehouseBalance(itemId: string, delta: number): Promise<number> {
    if (isMongoConnected()) {
      const doc = await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $inc: { quantity: delta }, $set: { lastUpdated: new Date() } },
        { upsert: true, new: true }
      ).lean();
      return (doc as any).quantity;
    }
    let bal = inMemoryDb.warehouseBalances.get(itemId);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        item: itemId,
        quantity: 0,
        lastUpdated: new Date(),
      };
    }
    bal.quantity = Math.round((bal.quantity + delta) * 100) / 100;
    bal.lastUpdated = new Date();
    inMemoryDb.warehouseBalances.set(itemId, bal);
    return bal.quantity;
  },

  async setWarehouseBalanceDirect(itemId: string, newQty: number): Promise<void> {
    if (isMongoConnected()) {
      await WarehouseBalanceModel.findOneAndUpdate(
        { item: itemId },
        { $set: { quantity: newQty, lastUpdated: new Date() } },
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
        lastUpdated: new Date(),
      };
    } else {
      bal.quantity = newQty;
      bal.lastUpdated = new Date();
    }
    inMemoryDb.warehouseBalances.set(itemId, bal);
  },

  async getAllWarehouseBalances(): Promise<Array<{ item: IItem; quantity: number; lastUpdated: Date | string }>> {
    const items = await this.listItems();
    const result: Array<{ item: IItem; quantity: number; lastUpdated: Date | string }> = [];

    for (const item of items) {
      const qty = await this.getWarehouseBalance(item._id);
      const balDoc = inMemoryDb.warehouseBalances.get(item._id);
      result.push({
        item,
        quantity: qty,
        lastUpdated: balDoc?.lastUpdated || item.createdAt || new Date(),
      });
    }
    return result;
  },

  // --- TECHNICIAN BALANCES ---
  async getTechnicianBalance(technicianId: string, itemId: string): Promise<number> {
    if (isMongoConnected()) {
      const doc = await TechnicianBalanceModel.findOne({ technician: technicianId, item: itemId }).lean();
      return doc ? (doc as any).quantity : 0;
    }
    const key = `${technicianId}_${itemId}`;
    const bal = inMemoryDb.technicianBalances.get(key);
    return bal ? bal.quantity : 0;
  },

  async updateTechnicianBalance(technicianId: string, itemId: string, delta: number): Promise<number> {
    if (isMongoConnected()) {
      const doc = await TechnicianBalanceModel.findOneAndUpdate(
        { technician: technicianId, item: itemId },
        { $inc: { quantity: delta }, $set: { lastUpdated: new Date() } },
        { upsert: true, new: true }
      ).lean();
      return (doc as any).quantity;
    }
    const key = `${technicianId}_${itemId}`;
    let bal = inMemoryDb.technicianBalances.get(key);
    if (!bal) {
      bal = {
        _id: inMemoryDb.generateId(),
        technician: technicianId,
        item: itemId,
        quantity: 0,
        lastUpdated: new Date(),
      };
    }
    bal.quantity = Math.round((bal.quantity + delta) * 100) / 100;
    bal.lastUpdated = new Date();
    inMemoryDb.technicianBalances.set(key, bal);
    return bal.quantity;
  },

  async setTechnicianBalanceDirect(technicianId: string, itemId: string, newQty: number): Promise<void> {
    if (isMongoConnected()) {
      await TechnicianBalanceModel.findOneAndUpdate(
        { technician: technicianId, item: itemId },
        { $set: { quantity: newQty, lastUpdated: new Date() } },
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
        lastUpdated: new Date(),
      };
    } else {
      bal.quantity = newQty;
      bal.lastUpdated = new Date();
    }
    inMemoryDb.technicianBalances.set(key, bal);
  },

  async getBalancesForTechnician(technicianId: string): Promise<Array<{ item: IItem; quantity: number }>> {
    const items = await this.listItems();
    const list: Array<{ item: IItem; quantity: number }> = [];
    for (const item of items) {
      const qty = await this.getTechnicianBalance(technicianId, item._id);
      if (qty > 0) {
        list.push({ item, quantity: qty });
      }
    }
    return list;
  },

  async getAllTechnicianBalancesMatrix(): Promise<{
    technicians: IUser[];
    items: IItem[];
    matrix: Array<{
      item: IItem;
      warehouseQty: number;
      techBalances: Record<string, number>; // techId -> qty
      totalHeldByTechs: number;
    }>;
  }> {
    const technicians = await this.listTechnicians();
    const items = await this.listItems();

    const matrix = await Promise.all(
      items.map(async (item) => {
        const warehouseQty = await this.getWarehouseBalance(item._id);
        const techBalances: Record<string, number> = {};
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
          totalHeldByTechs: Math.round(totalHeldByTechs * 100) / 100,
        };
      })
    );

    return { technicians, items, matrix };
  },

  // --- TRANSACTIONS (IMMUTABLE LEDGER) ---
  async insertStockTransaction(
    txData: Omit<IStockTransaction, '_id' | 'createdAt'> & { _id?: string; createdAt?: Date }
  ): Promise<IStockTransaction> {
    if (isMongoConnected()) {
      const doc = await StockTransactionModel.create({
        ...txData,
        createdAt: txData.createdAt || new Date(),
        transactionDate: txData.transactionDate || new Date(),
      });
      return doc.toObject() as any;
    }
    const _id = txData._id || inMemoryDb.generateId();
    const newTx: IStockTransaction = {
      ...txData,
      _id,
      transactionDate: txData.transactionDate || new Date(),
      createdAt: txData.createdAt || new Date(),
    };
    inMemoryDb.transactions.unshift(newTx); // newest first
    return { ...newTx };
  },

  async listStockTransactions(filter?: {
    itemId?: string;
    technicianId?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<Array<IStockTransaction & { item: IItem; technician?: IUser; performedBy: IUser }>> {
    let rawList: IStockTransaction[] = [];

    if (isMongoConnected()) {
      const query: any = {};
      if (filter?.itemId) query.item = filter.itemId;
      if (filter?.technicianId) query.technician = filter.technicianId;
      if (filter?.type) query.transactionType = filter.type;
      if (filter?.fromDate || filter?.toDate) {
        query.transactionDate = {};
        if (filter.fromDate) query.transactionDate.$gte = new Date(filter.fromDate);
        if (filter.toDate) query.transactionDate.$lte = new Date(filter.toDate);
      }
      rawList = (await StockTransactionModel.find(query)
        .sort({ transactionDate: -1, createdAt: -1 })
        .limit(filter?.limit || 200)
        .lean()) as any;
    } else {
      rawList = [...inMemoryDb.transactions];
      if (filter?.itemId) {
        rawList = rawList.filter((t) => (typeof t.item === 'string' ? t.item : t.item._id) === filter.itemId);
      }
      if (filter?.technicianId) {
        rawList = rawList.filter((t) => {
          if (!t.technician) return false;
          const tid = typeof t.technician === 'string' ? t.technician : t.technician._id;
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

    // Populate references
    const populated = await Promise.all(
      rawList.map(async (tx) => {
        const itemId = typeof tx.item === 'string' ? tx.item : tx.item?._id;
        const item = (await this.findItemById(itemId)) || (tx.item as IItem);

        let technician: IUser | undefined = undefined;
        if (tx.technician) {
          const techId = typeof tx.technician === 'string' ? tx.technician : tx.technician?._id;
          technician = (await this.findUserById(techId)) || (tx.technician as IUser);
        }

        const performerId = typeof tx.performedBy === 'string' ? tx.performedBy : tx.performedBy?._id;
        const performedBy = (await this.findUserById(performerId)) || (tx.performedBy as IUser);

        return {
          ...tx,
          item,
          technician,
          performedBy,
        };
      })
    );

    return populated;
  },

  // --- RETURN REQUESTS ---
  async createReturnRequest(data: Omit<IReturnRequest, '_id' | 'status' | 'requestedAt'>): Promise<IReturnRequest> {
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.create({
        ...data,
        status: 'PENDING',
        requestedAt: new Date(),
      });
      return doc.toObject() as any;
    }
    const _id = inMemoryDb.generateId();
    const newReq: IReturnRequest = {
      ...data,
      _id,
      status: 'PENDING',
      requestedAt: new Date(),
    };
    inMemoryDb.returnRequests.set(_id, newReq);
    return { ...newReq };
  },

  async findReturnRequestById(id: string): Promise<IReturnRequest | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.findById(id).lean();
      return doc ? (doc as any) : null;
    }
    const req = inMemoryDb.returnRequests.get(id);
    return req ? { ...req } : null;
  },

  async updateReturnRequest(id: string, updates: Partial<IReturnRequest>): Promise<IReturnRequest | null> {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return null;
    }
    if (isMongoConnected()) {
      const doc = await ReturnRequestModel.findByIdAndUpdate(id, updates, { new: true }).lean();
      return doc ? (doc as any) : null;
    }
    const existing = inMemoryDb.returnRequests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    inMemoryDb.returnRequests.set(id, updated);
    return { ...updated };
  },

  async listReturnRequests(filter?: { technicianId?: string; status?: string }): Promise<
    Array<IReturnRequest & { item: IItem; technician: IUser; confirmedBy?: IUser }>
  > {
    let rawList: IReturnRequest[] = [];
    if (isMongoConnected()) {
      const query: any = {};
      if (filter?.technicianId) query.technician = filter.technicianId;
      if (filter?.status) query.status = filter.status;
      rawList = (await ReturnRequestModel.find(query).sort({ requestedAt: -1 }).lean()) as any;
    } else {
      rawList = Array.from(inMemoryDb.returnRequests.values());
      if (filter?.technicianId) {
        rawList = rawList.filter((r) => {
          const tid = typeof r.technician === 'string' ? r.technician : r.technician._id;
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
        const itemId = typeof r.item === 'string' ? r.item : r.item?._id;
        const item = (await this.findItemById(itemId)) || (r.item as IItem);

        const techId = typeof r.technician === 'string' ? r.technician : r.technician?._id;
        const technician = (await this.findUserById(techId)) || (r.technician as IUser);

        let confirmedBy: IUser | undefined = undefined;
        if (r.confirmedBy) {
          const confId = typeof r.confirmedBy === 'string' ? r.confirmedBy : r.confirmedBy?._id;
          confirmedBy = (await this.findUserById(confId)) || (r.confirmedBy as IUser);
        }

        return {
          ...r,
          item,
          technician,
          confirmedBy,
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
  async computeReconciliation(recalculateAndResync = false): Promise<{
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
  }> {
    const items = await this.listItems();
    const technicians = await this.listTechnicians();

    // Fetch all transactions
    let allTransactions: IStockTransaction[] = [];
    if (isMongoConnected()) {
      allTransactions = (await StockTransactionModel.find().lean()) as any;
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

    const reconciliationList: IReconciliationItem[] = [];

    for (const item of items) {
      const itemId = item._id.toString();

      // Ledger audit sums
      let totalPurchased = 0;
      let totalIssued = 0;
      let totalUsed = 0;
      let totalReturned = 0;
      let totalDamaged = 0;
      let totalAdjusted = 0;

      // Filter transactions for this item
      const itemTxList = allTransactions.filter((tx) => {
        const txItemId = typeof tx.item === 'string' ? tx.item : tx.item?._id?.toString();
        return txItemId === itemId;
      });

      for (const tx of itemTxList) {
        const qty = Number(tx.quantity) || 0;
        switch (tx.transactionType) {
          case 'PURCHASE_IN':
            totalPurchased += qty;
            break;
          case 'ISSUE_TO_TECH':
            totalIssued += qty;
            break;
          case 'USAGE_AT_SITE':
            totalUsed += qty;
            break;
          case 'RETURN_TO_WAREHOUSE':
            totalReturned += qty;
            break;
          case 'DAMAGE_WRITEOFF':
            totalDamaged += qty;
            break;
          case 'ADJUSTMENT':
            totalAdjusted += qty;
            break;
        }
      }

      // Expected math derived from ledger
      const calculatedWarehouse = Math.round((totalPurchased - totalIssued + totalReturned - totalDamaged + totalAdjusted) * 100) / 100;
      const calculatedTechTotal = Math.round((totalIssued - totalUsed - totalReturned) * 100) / 100;

      // Fast-read cached balances
      let currentWarehouse = await this.getWarehouseBalance(itemId);
      let currentTechTotal = 0;

      for (const tech of technicians) {
        const tQty = await this.getTechnicianBalance(tech._id.toString(), itemId);
        currentTechTotal += tQty;
      }
      currentTechTotal = Math.round(currentTechTotal * 100) / 100;

      // If recalculateAndResync requested, sync cached balances from ledger
      if (recalculateAndResync) {
        if (currentWarehouse !== calculatedWarehouse) {
          await this.setWarehouseBalanceDirect(itemId, calculatedWarehouse);
          currentWarehouse = calculatedWarehouse;
        }
        // Resync individual technician balances from ledger if discrepancy
        for (const tech of technicians) {
          const techId = tech._id.toString();
          let techItemIssued = 0;
          let techItemUsed = 0;
          let techItemReturned = 0;

          for (const tx of itemTxList) {
            const txTechId = typeof tx.technician === 'string' ? tx.technician : tx.technician?._id?.toString();
            if (txTechId === techId) {
              const qty = Number(tx.quantity) || 0;
              if (tx.transactionType === 'ISSUE_TO_TECH') techItemIssued += qty;
              if (tx.transactionType === 'USAGE_AT_SITE') techItemUsed += qty;
              if (tx.transactionType === 'RETURN_TO_WAREHOUSE') techItemReturned += qty;
            }
          }
          const actualTechStock = Math.round((techItemIssued - techItemUsed - techItemReturned) * 100) / 100;
          await this.setTechnicianBalanceDirect(techId, itemId, Math.max(0, actualTechStock));
        }
        // Re-read current tech total after resync
        currentTechTotal = 0;
        for (const tech of technicians) {
          currentTechTotal += await this.getTechnicianBalance(tech._id.toString(), itemId);
        }
        currentTechTotal = Math.round(currentTechTotal * 100) / 100;
      }

      // Reconciliation equation:
      // Left side: Total Purchased
      // Right side: Warehouse Balance + Technicians Total + Total Consumed + Total Damaged
      const expectedAvailable = Math.round((totalPurchased - totalUsed - totalDamaged) * 100) / 100;
      const actualAvailable = Math.round((currentWarehouse + currentTechTotal) * 100) / 100;
      const variance = Math.round((expectedAvailable - actualAvailable) * 100) / 100;
      const status: 'MATCHED' | 'MISMATCH' = Math.abs(variance) < 0.001 ? 'MATCHED' : 'MISMATCH';

      if (status === 'MATCHED') {
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
          calculatedTechTotal,
        },
      });
    }

    return {
      items: reconciliationList,
      summary: {
        totalItems: items.length,
        matchedCount,
        mismatchedCount,
        overallSystemStatus: mismatchedCount === 0 ? 'PERFECT_MATCH' : 'DISCREPANCY_DETECTED',
        totalPurchasedQty: Math.round(summaryTotalPurchased * 100) / 100,
        totalWarehouseQty: Math.round(summaryWarehouse * 100) / 100,
        totalTechQty: Math.round(summaryTech * 100) / 100,
        totalConsumedQty: Math.round(summaryConsumed * 100) / 100,
        totalDamagedQty: Math.round(summaryDamaged * 100) / 100,
      },
    };
  },
};
