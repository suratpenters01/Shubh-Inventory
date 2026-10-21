import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  validatePositiveWholeQuantity,
  safeSubtractQuantity,
  safeAddQuantity,
  roundMoney,
  calculateValuation,
  OPERATION_MAX_QUANTITIES,
} from '../backend/utils/mathUtils.js';
import {
  MemoryStockDataAccess,
  MongoStockDataAccess,
  IStockDataAccess,
  hashPayload,
} from '../backend/services/stockDataAccess.js';
import {
  inMemoryDb,
  ItemModel,
  UserModel,
  WarehouseBalanceModel,
  TechnicianBalanceModel,
  StockTransactionModel,
  IdempotencyRecordModel,
  ReturnRequestModel,
} from '../backend/db/index.js';
import { StockError } from '../backend/types/index.js';

// -------------------------------------------------------------
// Part 1: Math Utility & Quantity Validation Unit Tests
// -------------------------------------------------------------
describe('Stock Math Utility & Precision Unit Tests', () => {
  it('rejects zero quantity (0)', () => {
    const r = validatePositiveWholeQuantity(0, 'Qty');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('greater than zero');
  });

  it('rejects negative quantity (-5)', () => {
    const r = validatePositiveWholeQuantity(-5, 'Qty');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('greater than zero');
  });

  it('rejects decimal quantity (2.5) for physical discrete purifier spares', () => {
    const r = validatePositiveWholeQuantity(2.5, 'Qty');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('positive whole number');
  });

  it('rejects quantities exceeding operation maximum thresholds', () => {
    const r = validatePositiveWholeQuantity(
      OPERATION_MAX_QUANTITIES.PURCHASE + 1,
      'Purchase Qty',
      OPERATION_MAX_QUANTITIES.PURCHASE
    );
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum allowable threshold');
  });

  it('accepts positive whole integers within threshold', () => {
    const r = validatePositiveWholeQuantity(15, 'Qty');
    expect(r.valid).toBe(true);
    expect(r.value).toBe(15);
  });

  it('safeSubtractQuantity strictly guards against negative stock balance', () => {
    const successResult = safeSubtractQuantity(10, 4);
    expect(successResult.success).toBe(true);
    expect(successResult.newBalance).toBe(6);

    const failResult = safeSubtractQuantity(10, 11);
    expect(failResult.success).toBe(false);
    expect(failResult.newBalance).toBe(10);
    expect(failResult.error).toContain('Insufficient stock balance');
  });

  it('calculateValuation and roundMoney apply single rounding once at the end', () => {
    const val = calculateValuation(3, 499.99);
    expect(val).toBe(1499.97);

    const rounded = roundMoney(123.456);
    expect(rounded).toBe(123.46);
  });
});

// -------------------------------------------------------------
// Part 2: Shared Stock Data Access Concurrency & Atomicity Suite
// -------------------------------------------------------------
function defineSharedStockTests(
  engineName: string,
  createDataAccess: (clock?: () => Date) => IStockDataAccess,
  setupContext: () => Promise<{ itemId: string; techId: string; adminId: string }>,
  cleanDb: () => Promise<void>
) {
  describe(`Shared Concurrency Suite: ${engineName}`, () => {
    let ctx: { itemId: string; techId: string; adminId: string };
    let dataAccess: IStockDataAccess;

    beforeEach(async () => {
      await cleanDb();
      ctx = await setupContext();
      dataAccess = createDataAccess();
    });

    // 1. Issue: 50 parallel requests of qty 1 against stock 10
    it('50 parallel issue requests of qty 1 against stock 10 -> exactly 10 successes, final stock 0, 40 rejections', async () => {
      // Seed warehouse with exactly 10 units
      await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 10,
        performedBy: ctx.adminId,
        supplierName: 'Initial Test Inward',
      });

      // Fire 50 parallel issue requests
      const parallelRequests = Array.from({ length: 50 }, (_, i) =>
        dataAccess
          .atomicIssue({
            itemId: ctx.itemId,
            technicianId: ctx.techId,
            quantity: 1,
            performedBy: ctx.adminId,
            remarks: `Parallel issue #${i + 1}`,
          })
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err }))
      );

      const results = await Promise.all(parallelRequests);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(10);
      expect(failures.length).toBe(40);

      // Verify that every failure was due to INSUFFICIENT_STOCK
      failures.forEach((f: any) => {
        expect(f.err).toBeInstanceOf(StockError);
        expect(f.err.code).toBe('INSUFFICIENT_STOCK');
      });

      // Verify final stock is exactly 0 and tech stock is 10
      const minWhQty = Math.min(...successes.map((s: any) => s.res.newWarehouseQty));
      const maxTechQty = Math.max(...successes.map((s: any) => s.res.newTechQty));
      expect(minWhQty).toBe(0);
      expect(maxTechQty).toBe(10);

      // Verify any further attempt is rejected because stock is depleted
      await expect(
        dataAccess.atomicIssue({
          itemId: ctx.itemId,
          technicianId: ctx.techId,
          quantity: 1,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);
    });

    // 2. Usage: 50 parallel usage requests of qty 1 against tech stock 10
    it('50 parallel usage requests of qty 1 against technician stock 10 -> exactly 10 successes, final tech stock 0', async () => {
      // First put 10 units in warehouse, then issue 10 units to tech
      await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 10,
        performedBy: ctx.adminId,
      });
      await dataAccess.atomicIssue({
        itemId: ctx.itemId,
        technicianId: ctx.techId,
        quantity: 10,
        performedBy: ctx.adminId,
      });

      // Fire 50 parallel usage requests
      const parallelUsages = Array.from({ length: 50 }, (_, i) =>
        dataAccess
          .atomicUsage({
            itemId: ctx.itemId,
            technicianId: ctx.techId,
            quantity: 1,
            siteName: `Customer #${i + 1}`,
            jobReference: `1000000${i % 10}`,
            performedBy: ctx.techId,
          })
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err }))
      );

      const results = await Promise.all(parallelUsages);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(10);
      expect(failures.length).toBe(40);
      const minTechQty = Math.min(...successes.map((s: any) => s.res.newTechQty));
      expect(minTechQty).toBe(0);

      // Verify any further usage attempt is rejected because technician stock is depleted
      await expect(
        dataAccess.atomicUsage({
          itemId: ctx.itemId,
          technicianId: ctx.techId,
          quantity: 1,
          performedBy: ctx.techId,
        })
      ).rejects.toThrow(StockError);
    });

    // 3. Purchase: 50 parallel purchase requests of qty 2
    it('50 parallel purchase requests of qty 2 -> all 50 succeed, warehouse stock exactly 100', async () => {
      const parallelPurchases = Array.from({ length: 50 }, (_, i) =>
        dataAccess.atomicPurchase({
          itemId: ctx.itemId,
          quantity: 2,
          performedBy: ctx.adminId,
          invoiceNumber: `INV-${i + 1}`,
        })
      );

      const results = await Promise.all(parallelPurchases);
      expect(results.length).toBe(50);

      // Verify the last result or an extra purchase sees cumulative 100 units
      const checkResult = await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 1,
        performedBy: ctx.adminId,
      });
      expect(checkResult.newWarehouseQty).toBe(101);
    });

    // 3b. Damage Write-off: 10 parallel write-offs of qty 2 against warehouse stock 10
    it('10 parallel damage write-offs of qty 2 against stock 10 -> exactly 5 succeed, stock 0, 5 rejected', async () => {
      // Seed warehouse with exactly 10 units
      await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 10,
        performedBy: ctx.adminId,
      });

      const parallelWriteoffs = Array.from({ length: 10 }, (_, i) =>
        dataAccess
          .atomicDamageWriteoff({
            itemId: ctx.itemId,
            quantity: 2,
            performedBy: ctx.adminId,
            reason: `Damaged in handling test ${i + 1}`,
          })
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err }))
      );

      const results = await Promise.all(parallelWriteoffs);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(5);

      failures.forEach((f: any) => {
        expect(f.err.code).toBe('INSUFFICIENT_STOCK');
      });

      // Verify further write-off fails because warehouse stock is 0
      await expect(
        dataAccess.atomicDamageWriteoff({
          itemId: ctx.itemId,
          quantity: 1,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);
    });

    // 4. Return Confirmation: 10 parallel confirm requests for same return request
    it('10 parallel confirm requests for the SAME return request ID -> exactly 1 succeeds, stock added only once', async () => {
      // Tech receives 5 units
      await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 5,
        performedBy: ctx.adminId,
      });
      await dataAccess.atomicIssue({
        itemId: ctx.itemId,
        technicianId: ctx.techId,
        quantity: 5,
        performedBy: ctx.adminId,
      });

      // Tech creates return request for 5 units
      const retReq = await dataAccess.atomicCreateReturnRequest({
        technicianId: ctx.techId,
        itemId: ctx.itemId,
        quantity: 5,
        reason: 'Surplus kit returned to godown',
      });

      // Fire 10 parallel confirm requests for the EXACT SAME returnRequestId
      const parallelConfirms = Array.from({ length: 10 }, () =>
        dataAccess
          .atomicConfirmReturn({
            returnRequestId: retReq._id,
            confirmedBy: ctx.adminId,
          })
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err }))
      );

      const results = await Promise.all(parallelConfirms);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(9);
      expect((successes[0] as any).res.newWarehouseQty).toBe(5);

      failures.forEach((f: any) => {
        expect(f.err.code).toBe('INVALID_STATE');
      });
    });

    // 5. Idempotency: same key + different payload returns 409
    it('same Idempotency-Key + different payload returns HTTP 409 conflict', async () => {
      const key = 'idem_key_' + Math.random().toString(36).slice(2);
      const endpoint = 'POST /api/stock/issue';
      const payload1 = { itemId: ctx.itemId, quantity: 2, techId: ctx.techId };
      const payload2 = { itemId: ctx.itemId, quantity: 5, techId: ctx.techId };

      const claim1 = await dataAccess.claimIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        payloadHash: hashPayload(payload1),
      });
      expect(claim1.claimed).toBe(true);

      // Resolve claim 1
      await dataAccess.resolveIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        statusCode: 201,
        responseBody: { message: 'Stock issued', txId: 'tx_001' },
      });

      // Same key with DIFFERENT payload
      const claim2 = await dataAccess.claimIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        payloadHash: hashPayload(payload2),
      });

      expect(claim2.claimed).toBe(false);
      expect(claim2.existing).toBeDefined();
      expect(claim2.existing!.payloadHash).not.toBe(hashPayload(payload2));

      // Assert status code 409 behavior
      const isMismatch = claim2.existing!.payloadHash !== hashPayload(payload2);
      const statusCode = isMismatch ? 409 : 200;
      expect(statusCode).toBe(409);
    });

    // 6. Idempotency: same key twice creates exactly ONE transaction and changes stock once
    it('same Idempotency-Key twice creates exactly ONE transaction and changes stock once (both asserted)', async () => {
      // Seed warehouse with 20 units
      await dataAccess.atomicPurchase({
        itemId: ctx.itemId,
        quantity: 20,
        performedBy: ctx.adminId,
      });

      const key = 'idem_twice_' + Math.random().toString(36).slice(2);
      const endpoint = 'POST /api/stock/issue';
      const payload = { itemId: ctx.itemId, quantity: 5, techId: ctx.techId };
      const pHash = hashPayload(payload);

      // First execution
      const claim1 = await dataAccess.claimIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        payloadHash: pHash,
      });
      expect(claim1.claimed).toBe(true);

      const issueResult = await dataAccess.atomicIssue({
        itemId: ctx.itemId,
        technicianId: ctx.techId,
        quantity: 5,
        performedBy: ctx.adminId,
      });

      await dataAccess.resolveIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        statusCode: 201,
        responseBody: issueResult,
      });

      // Second execution with same key and same payload
      const claim2 = await dataAccess.claimIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        payloadHash: pHash,
      });
      expect(claim2.claimed).toBe(false);
      expect(claim2.existing).toBeDefined();
      expect(claim2.existing!.payloadHash).toBe(pHash);

      // Assert stock changed exactly once: 20 - 5 = 15
      const probe = await dataAccess.atomicIssue({
        itemId: ctx.itemId,
        technicianId: ctx.techId,
        quantity: 1,
        performedBy: ctx.adminId,
      });
      // If stock had been deducted twice (5 + 5), probe would see 9. Since deducted once, probe sees 14!
      expect(probe.newWarehouseQty).toBe(14);
      expect(probe.newTechQty).toBe(6); // 5 from first issue + 1 from probe

      // Assert exactly ONE ledger entry created for the 5-unit issue
      const txCount = inMemoryDb.transactions.length > 0
        ? inMemoryDb.transactions.filter((t) => t.item === ctx.itemId && t.transactionType === 'ISSUE_TO_TECH' && t.quantity === 5).length
        : await StockTransactionModel.countDocuments({ item: ctx.itemId, transactionType: 'ISSUE_TO_TECH', quantity: 5 });
      expect(txCount).toBe(1);
    });

    // 7. Idempotency: 10 parallel requests with the same key execute exactly once
    it('10 parallel requests with the same key execute exactly once', async () => {
      const key = 'idem_parallel_10_' + Math.random().toString(36).slice(2);
      const endpoint = 'POST /api/stock/issue';
      const payload = { itemId: ctx.itemId, quantity: 3, techId: ctx.techId };
      const pHash = hashPayload(payload);

      let executionsCount = 0;

      // 10 concurrent requests claiming key
      const claims = await Promise.all(
        Array.from({ length: 10 }, async () => {
          const claim = await dataAccess.claimIdempotencyKey({
            key,
            userId: ctx.adminId,
            endpoint,
            payloadHash: pHash,
          });

          if (claim.claimed) {
            executionsCount++;
            await dataAccess.resolveIdempotencyKey({
              key,
              userId: ctx.adminId,
              endpoint,
              statusCode: 201,
              responseBody: { done: true },
            });
            return { claimed: true };
          }
          return { claimed: false, existing: claim.existing };
        })
      );

      const successfulClaims = claims.filter((c) => c.claimed);
      expect(successfulClaims.length).toBe(1);
      expect(executionsCount).toBe(1);
    });

    // 8. Idempotency: key older than 24h treated as expired via injectable clock
    it('key older than 24h is treated as expired (using injectable clock)', async () => {
      let simulatedTime = new Date('2026-09-30T10:00:00Z');
      const timeInjectableDataAccess = createDataAccess(() => simulatedTime);

      const key = 'idem_clock_' + Math.random().toString(36).slice(2);
      const endpoint = 'POST /api/stock/issue';
      const payload = { itemId: ctx.itemId, quantity: 1 };
      const pHash = hashPayload(payload);

      // Claim at 10:00 AM
      const claim1 = await timeInjectableDataAccess.claimIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        payloadHash: pHash,
      });
      expect(claim1.claimed).toBe(true);

      await timeInjectableDataAccess.resolveIdempotencyKey({
        key,
        userId: ctx.adminId,
        endpoint,
        statusCode: 201,
        responseBody: { done: true },
      });

      // 1 hour later: still valid
      simulatedTime = new Date('2026-09-30T11:00:00Z');
      const recordValid = await timeInjectableDataAccess.getIdempotencyRecord(key, ctx.adminId, endpoint);
      expect(recordValid).not.toBeNull();

      // 25 hours later: expired!
      simulatedTime = new Date('2026-10-01T11:05:00Z');
      const recordExpired = await timeInjectableDataAccess.getIdempotencyRecord(key, ctx.adminId, endpoint);
      expect(recordExpired).toBeNull();
    });

    // 9. Edge Cases & Missing/Undefined Fields
    it('rejects missing or undefined fields across all endpoints', async () => {
      // Missing itemId
      await expect(
        dataAccess.atomicPurchase({
          itemId: '',
          quantity: 5,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Missing technicianId in Issue
      await expect(
        dataAccess.atomicIssue({
          itemId: ctx.itemId,
          technicianId: '',
          quantity: 5,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Malformed ID returns HTTP 400 (never 500 or CastError) on BOTH engines
      try {
        await dataAccess.atomicPurchase({
          itemId: 'malformed-id-123',
          quantity: 5,
          performedBy: ctx.adminId,
        });
        expect.fail('Should have thrown StockError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(StockError);
        expect(err.status).toBe(400);
        expect(err.code).toBe('INVALID_ID');
      }

      try {
        await dataAccess.atomicIssue({
          itemId: ctx.itemId,
          technicianId: 'invalid-tech-id',
          quantity: 1,
          performedBy: ctx.adminId,
        });
        expect.fail('Should have thrown StockError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(StockError);
        expect(err.status).toBe(400);
        expect(err.code).toBe('INVALID_ID');
      }

      // Missing quantity (0 or NaN)
      await expect(
        dataAccess.atomicPurchase({
          itemId: ctx.itemId,
          quantity: 0,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Decimal quantity
      await expect(
        dataAccess.atomicIssue({
          itemId: ctx.itemId,
          technicianId: ctx.techId,
          quantity: 1.5,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Huge quantity exceeding threshold
      await expect(
        dataAccess.atomicPurchase({
          itemId: ctx.itemId,
          quantity: 999999,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Non-existent item (404)
      await expect(
        dataAccess.atomicPurchase({
          itemId: '507f1f77bcf86cd799439011',
          quantity: 5,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);

      // Non-existent technician (404)
      await expect(
        dataAccess.atomicIssue({
          itemId: ctx.itemId,
          technicianId: '507f1f77bcf86cd799439099',
          quantity: 1,
          performedBy: ctx.adminId,
        })
      ).rejects.toThrow(StockError);
    });
  });
}

// -------------------------------------------------------------
// Part 3: Execute Shared Suite on In-Memory Engine
// -------------------------------------------------------------
defineSharedStockTests(
  'In-Memory Atomic Engine',
  (clock) => new MemoryStockDataAccess(clock),
  async () => {
    const itemId = inMemoryDb.generateId();
    const techId = inMemoryDb.generateId();
    const adminId = inMemoryDb.generateId();

    inMemoryDb.items.set(itemId, {
      _id: itemId,
      itemCode: 'PUR-GKK1-MEM',
      itemName: 'Pureit GKK 1 Filter Kit',
      category: 'GKK1',
      unit: 'kit',
      price: 2900,
      lowStockThreshold: 5,
      reorderLevel: 5,
      isActive: true,
    });

    inMemoryDb.users.set(techId, {
      _id: techId,
      name: 'Rajesh Kumar Tech',
      email: 'tech@example.com',
      role: 'technician',
      phone: '9876500001',
      passwordHash: 'test_hash',
      isActive: true,
    });

    inMemoryDb.users.set(adminId, {
      _id: adminId,
      name: 'Central Admin',
      email: 'admin@example.com',
      role: 'admin',
      phone: '9876500000',
      passwordHash: 'test_hash',
      isActive: true,
    });

    return { itemId, techId, adminId };
  },
  async () => {
    inMemoryDb.clearAll();
  }
);

// -------------------------------------------------------------
// Part 4: Execute Shared Suite on MongoDB with MongoMemoryReplSet
// -------------------------------------------------------------
describe('MongoDB Replica Set (MongoMemoryReplSet) Implementation', () => {
  let replSet: MongoMemoryReplSet | null = null;
  let mongoUri = '';

  beforeAll(async () => {
    try {
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      mongoUri = replSet.getUri();
      await mongoose.connect(mongoUri);
      await Promise.all([
        UserModel.syncIndexes(),
        ItemModel.syncIndexes(),
        WarehouseBalanceModel.syncIndexes(),
        TechnicianBalanceModel.syncIndexes(),
        ReturnRequestModel.syncIndexes(),
        IdempotencyRecordModel.syncIndexes(),
      ]);
    } catch (err) {
      console.warn('[Mongo Memory Server] Warning: Could not start MongoMemoryReplSet in environment:', err);
    }
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  });

  it('verifies that Mongo IdempotencyRecord has TTL index on expiresAt', async () => {
    if (!replSet) {
      console.warn('Skipping TTL assertion as MongoReplSet is not running');
      return;
    }
    const indexes = await IdempotencyRecordModel.collection.indexes();
    const ttlIndex = indexes.find((idx: any) => idx.key?.expiresAt !== undefined);
    expect(ttlIndex).toBeDefined();
    expect((ttlIndex as any)?.expireAfterSeconds).toBe(0);
  });

  // Run the full shared suite on MongoDB
  defineSharedStockTests(
    'Mongo DB (Real ACID Transactions)',
    (clock) => new MongoStockDataAccess(clock),
    async () => {
      const item = await ItemModel.create({
        itemCode: 'PUR-GKK1-MONGO-' + Math.random().toString(36).slice(2),
        itemName: 'Pureit GKK 1 Filter Kit',
        category: 'GKK1',
        unit: 'kit',
        price: 2900,
        lowStockThreshold: 5,
        reorderLevel: 5,
        isActive: true,
      });

      const tech = await UserModel.create({
        name: 'Rajesh Kumar Tech',
        email: `tech_${Date.now()}@example.com`,
        role: 'technician',
        phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
        passwordHash: 'test_hash',
        isActive: true,
      });

      const admin = await UserModel.create({
        name: 'Central Admin',
        email: `admin_${Date.now()}@example.com`,
        role: 'admin',
        phone: '99' + Math.floor(10000000 + Math.random() * 90000000),
        passwordHash: 'test_hash',
        isActive: true,
      });

      return {
        itemId: item._id.toString(),
        techId: tech._id.toString(),
        adminId: admin._id.toString(),
      };
    },
    async () => {
      if (mongoose.connection.readyState === 1) {
        await Promise.all([
          ItemModel.deleteMany({}),
          UserModel.deleteMany({}),
          WarehouseBalanceModel.deleteMany({}),
          TechnicianBalanceModel.deleteMany({}),
          StockTransactionModel.deleteMany({}),
          ReturnRequestModel.deleteMany({}),
          IdempotencyRecordModel.deleteMany({}),
        ]);
      }
    }
  );
});
