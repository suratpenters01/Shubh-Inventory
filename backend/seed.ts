import bcrypt from 'bcryptjs';
import { storageService } from './services/storageService.js';

export const LIVE_PUREIT_CATALOG = [
  {
    itemCode: 'SV-KIT-01',
    itemName: 'Solenoid Valve (SV) Kit with 1/4" Push Connectors & Clamp',
    category: 'Spare Part' as const,
    isKit: true,
    brand: 'A.O. Smith',
    gkkType: 'SV Kit',
    price: 1100,
    oldPrice: 850,
    newPrice: 1100,
    priceNotes: 'AO Smith Portal Rate: ₹850 | Box Printed MRP (Tech Charge): ₹1,100',
    unit: 'kit',
    compatibleModels: 'ProPlanet P7, Z8, Green RO, X8, Elegance Series, Universal RO',
    kitComponents: '• 1x 24V DC High Pressure Solenoid Valve\n• 2x 1/4" Quick Push-Fit Elbow Connectors\n• 1x Heavy Duty Mounting Bracket & Screws\n• 1x Teflon Seal Tape Roll',
    storageLocation: 'Rack A-02, Shelf 1',
    description: 'Original A.O. Smith Solenoid Valve repair kit for RO purifier automatic shut-off and leakage prevention.',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GMWM100',
    itemName: 'Pureit Germkill Kit (One Kit) - Marina & Wave Series',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 2500,
    oldPrice: 2200,
    newPrice: 2500,
    priceNotes: 'AO Smith Portal: ₹2,200 | Box MRP (Tech Charge): ₹2,500',
    unit: 'kit',
    compatibleModels: 'Marina Pro, Marina Prime, Wave Pro, Wave Prime',
    lowStockThreshold: 6,
    reorderLevel: 6,
  },
  {
    itemCode: 'GCRX200',
    itemName: 'Pureit Germkill Kit (One Kit) - Classic G2 & Marvella',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: 'AO Smith Portal: ₹2,800 | Box MRP (Tech Charge): ₹3,100',
    unit: 'kit',
    compatibleModels: 'Classic G2, Marvella Mineral RO+UV+MF+MP, Advance Max Mineral',
    lowStockThreshold: 6,
    reorderLevel: 6,
  },
  {
    itemCode: 'GPRD500',
    itemName: 'Pureit Revito 7-Stage Germkill Kit 2',
    category: 'GKK2' as const,
    gkkType: 'GKK 2',
    price: 4000,
    oldPrice: 3600,
    newPrice: 4000,
    priceNotes: 'AO Smith Portal: ₹3,600 | Box MRP (Tech Charge): ₹4,000',
    unit: 'kit',
    compatibleModels: 'Revito Series (7 Stage)',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GPRB500',
    itemName: 'Pureit Revito 8-Stage / One Piece Germkill Kit 2',
    category: 'GKK2' as const,
    gkkType: 'GKK 2',
    price: 4000,
    oldPrice: 3600,
    newPrice: 4000,
    priceNotes: 'AO Smith Portal: ₹3,600 | Box MRP (Tech Charge): ₹4,000',
    unit: 'kit',
    compatibleModels: 'Revito Series (8 Stage), Revito Series (One piece)',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GPRC500',
    itemName: 'Pureit Revito ESF Germkill Kit 1',
    category: 'GKK1' as const,
    gkkType: 'GKK 1',
    price: 2900,
    oldPrice: 2600,
    newPrice: 2900,
    priceNotes: 'AO Smith Portal: ₹2,600 | Box MRP (Tech Charge): ₹2,900',
    unit: 'kit',
    compatibleModels: 'Revito Series (ESF)',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GPRA500',
    itemName: 'Pureit Revito One Piece Germkill Kit 1',
    category: 'GKK1' as const,
    gkkType: 'GKK 1',
    price: 3000,
    oldPrice: 2700,
    newPrice: 3000,
    priceNotes: 'AO Smith Portal: ₹2,700 | Box MRP (Tech Charge): ₹3,000',
    unit: 'kit',
    compatibleModels: 'Revito Series (One piece)',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GPVA100',
    itemName: 'Pureit Vital Series Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 4200,
    oldPrice: 3800,
    newPrice: 4200,
    priceNotes: 'AO Smith Portal: ₹3,800 | Box MRP (Tech Charge): ₹4,200',
    unit: 'kit',
    compatibleModels: 'Vital Series',
    lowStockThreshold: 4,
    reorderLevel: 4,
  },
  {
    itemCode: 'GEAS100',
    itemName: 'Pureit Eco Series Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 5000,
    oldPrice: 4500,
    newPrice: 5000,
    priceNotes: 'AO Smith Portal: ₹4,500 | Box MRP (Tech Charge): ₹5,000',
    unit: 'kit',
    compatibleModels: 'Marvella Eco, Ultima Eco, Copper Eco',
    lowStockThreshold: 4,
    reorderLevel: 4,
  },
  {
    itemCode: 'RGKK100',
    itemName: 'Pureit RO+UV Series Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 4000,
    oldPrice: 3600,
    newPrice: 4000,
    priceNotes: 'AO Smith Portal: ₹3,600 | Box MRP (Tech Charge): ₹4,000',
    unit: 'kit',
    compatibleModels: 'Ultima RO+UV, Marvella RO+UV, Classic RO+UV',
    lowStockThreshold: 6,
    reorderLevel: 6,
  },
  {
    itemCode: 'GBRE200',
    itemName: 'Pureit Ultima Next Mineral RO UV+MF Germkill Kit 2',
    category: 'GKK2' as const,
    gkkType: 'GKK 2',
    price: 4000,
    oldPrice: 3650,
    newPrice: 4000,
    priceNotes: 'AO Smith Portal: ₹3,650 | Box MRP (Tech Charge): ₹4,000',
    unit: 'kit',
    compatibleModels: 'Ultima Next Mineral RO UV+MF',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GBRC200',
    itemName: 'Pureit Marvella & Ultima Mineral RO Germkill Kit 2',
    category: 'GKK2' as const,
    gkkType: 'GKK 2',
    price: 4000,
    oldPrice: 3650,
    newPrice: 4000,
    priceNotes: 'AO Smith Portal: ₹3,650 | Box MRP (Tech Charge): ₹4,000',
    unit: 'kit',
    compatibleModels: 'Ultima Mineral RO UV+MF, Marvella Mineral RO UV+MF, Marvella RO, Marvella RO Slim',
    lowStockThreshold: 6,
    reorderLevel: 6,
  },
  {
    itemCode: 'GBRD200',
    itemName: 'Pureit Marvella / Ultima / Copper+ Mineral RO Germkill Kit 1',
    category: 'GKK1' as const,
    gkkType: 'GKK 1',
    price: 2900,
    oldPrice: 2600,
    newPrice: 2900,
    priceNotes: 'AO Smith Portal: ₹2,600 | Box MRP (Tech Charge): ₹2,900',
    unit: 'kit',
    compatibleModels: 'Ultima Next Mineral RO UV+MF, Ultima Mineral RO UV+MF, Marvella Mineral RO UV+MF, Marvella RO, Marvella RO Slim, Copper+ Mineral RO+UV+MF',
    lowStockThreshold: 6,
    reorderLevel: 6,
  },
  {
    itemCode: 'GCUR300',
    itemName: 'Pureit Advance Pro & Plus Mineral RO+UV Germkill Kit',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: 'AO Smith Portal: ₹2,800 | Box MRP (Tech Charge): ₹3,100',
    unit: 'kit',
    compatibleModels: 'Advance Pro Mineral RO+UV, Advance Plus Mineral RO+UV',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GCRA100',
    itemName: 'Pureit RO+MF Series Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 3100,
    oldPrice: 2800,
    newPrice: 3100,
    priceNotes: 'AO Smith Portal: ₹2,800 | Box MRP (Tech Charge): ₹3,100',
    unit: 'kit',
    compatibleModels: 'RO+MF Classic, RO+MF Advance, RO+MF+MP Advance',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GCUV100',
    itemName: 'Pureit Classic & Marvella Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 1500,
    oldPrice: 1350,
    newPrice: 1500,
    priceNotes: 'AO Smith Portal: ₹1,350 | Box MRP (Tech Charge): ₹1,500',
    unit: 'kit',
    compatibleModels: 'Classic, Marvella',
    lowStockThreshold: 5,
    reorderLevel: 5,
  },
  {
    itemCode: 'GCUV300',
    itemName: 'Pureit UV+G2 Series Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 2000,
    oldPrice: 1800,
    newPrice: 2000,
    priceNotes: 'AO Smith Portal: ₹1,800 | Box MRP (Tech Charge): ₹2,000',
    unit: 'kit',
    compatibleModels: 'Marvella UV+G2, Classic UV+G2',
    lowStockThreshold: 4,
    reorderLevel: 4,
  },
  {
    itemCode: 'GCUV400',
    itemName: 'Pureit Copper UV & Copper UV Plus Germkill Kit (One Kit)',
    category: 'One Kit' as const,
    gkkType: 'One Kit',
    price: 1900,
    oldPrice: 1700,
    newPrice: 1900,
    priceNotes: 'AO Smith Portal: ₹1,700 | Box MRP (Tech Charge): ₹1,900',
    unit: 'kit',
    compatibleModels: 'Copper UV, Copper UV Plus',
    lowStockThreshold: 4,
    reorderLevel: 4,
  },
  {
    itemCode: 'SXGS100',
    itemName: 'Pureit Pre-Sediment Filter Candle (Standard Models)',
    category: 'SF' as const,
    gkkType: 'SF',
    price: 250,
    oldPrice: 220,
    newPrice: 250,
    priceNotes: 'AO Smith Portal: ₹220 | Box MRP (Tech Charge): ₹250',
    unit: 'pcs',
    compatibleModels: 'Marvella RO, Marvella RO Slim, Classic G2, Mineral RO+UV, Mineral RO+MF and all standard models',
    lowStockThreshold: 15,
    reorderLevel: 15,
  },
  {
    itemCode: 'WRDR200',
    itemName: 'Pureit Sediment / Pre-Carbon Cartridge - Marvella RO Series',
    category: 'SF' as const,
    gkkType: 'SF',
    price: 250,
    oldPrice: 220,
    newPrice: 250,
    priceNotes: 'AO Smith Portal: ₹220 | Box MRP (Tech Charge): ₹250',
    unit: 'pcs',
    compatibleModels: 'Marvella RO, Marvella RO Slim',
    lowStockThreshold: 12,
    reorderLevel: 12,
  },
  {
    itemCode: 'SXGS200',
    itemName: 'Pureit Advanced Sediment Filter Cartridge',
    category: 'SF' as const,
    gkkType: 'SF',
    price: 350,
    oldPrice: 300,
    newPrice: 350,
    priceNotes: 'AO Smith Portal: ₹300 | Box MRP (Tech Charge): ₹350',
    unit: 'pcs',
    compatibleModels: 'Classic G2, Mineral RO+UV, Mineral RO+MF, All New RO Models',
    lowStockThreshold: 15,
    reorderLevel: 15,
  },
];

export async function resetAndSeedPureitData(force = false) {
  const existingItems = await storageService.listItems();
  const hasDummyItems = existingItems.some(
    (i) => i.itemCode.startsWith('GKK-') || i.itemCode === 'SF-05' || i.itemCode === 'SP-TAP'
  );

  if (hasDummyItems || force) {
    console.log('[SEED] Purging dummy data and reseeding with original Pureit catalog...');
    await storageService.clearAllData();
  } else if (existingItems.length > 0) {
    console.log('[SEED] Database already holds catalog. Verifying dual price backfills...');
    for (const item of existingItems) {
      if (!item.newPrice || !item.oldPrice || item.newPrice === 0) {
        const catalogMatch = LIVE_PUREIT_CATALOG.find((c) => c.itemCode === item.itemCode);
        const oldP = catalogMatch?.oldPrice || Math.round((item.price || 1000) * 0.88);
        const newP = catalogMatch?.newPrice || (item.price || 1000);
        await storageService.updateItem(item._id, {
          oldPrice: oldP,
          newPrice: newP,
          price: newP,
          priceNotes: catalogMatch?.priceNotes || `AO Smith Portal: ₹${oldP} | Box MRP: ₹${newP}`,
          priceUpdatedAt: new Date(),
        });
      }
    }
    console.log('[SEED] Catalog dual prices verified.');
    return;
  }

  console.log('[SEED] Seeding database with authentic Pureit GKK / Filter inventory...');

  // 1. Seed Admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await storageService.createUser({
    name: 'Suresh Verma (Central Warehouse)',
    phone: '9876543210',
    passwordHash: adminPasswordHash,
    role: 'admin',
    isActive: true,
  });

  // 2. Seed Technicians
  const techPasswordHash = await bcrypt.hash('tech123', 10);
  const tech1 = await storageService.createUser({
    name: 'Rajesh Kumar',
    phone: '9876500001',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
  });

  const tech2 = await storageService.createUser({
    name: 'Amit Sharma',
    phone: '9876500002',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
  });

  const tech3 = await storageService.createUser({
    name: 'Priya Patel',
    phone: '9876500003',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
  });

  const tech4 = await storageService.createUser({
    name: 'Vikram Singh',
    phone: '9876500004',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
  });

  // 3. Seed Items (Live Pureit Catalog)
  const createdItems = [];
  for (const itemData of LIVE_PUREIT_CATALOG) {
    const item = await storageService.createItem(itemData);
    createdItems.push(item);
  }

  // 4. Seed Initial Inward Purchases into Warehouse from HUL Pureit Distribution
  const purchases = [
    { code: 'GMWM100', qty: 25, inv: 'HUL-PUR-2026-081' },
    { code: 'GCRX200', qty: 20, inv: 'HUL-PUR-2026-081' },
    { code: 'GPRD500', qty: 15, inv: 'HUL-PUR-2026-082' },
    { code: 'GPRB500', qty: 15, inv: 'HUL-PUR-2026-082' },
    { code: 'GPRC500', qty: 18, inv: 'HUL-PUR-2026-082' },
    { code: 'GPRA500', qty: 16, inv: 'HUL-PUR-2026-082' },
    { code: 'GPVA100', qty: 12, inv: 'HUL-PUR-2026-083' },
    { code: 'GEAS100', qty: 10, inv: 'HUL-PUR-2026-083' },
    { code: 'RGKK100', qty: 20, inv: 'HUL-PUR-2026-083' },
    { code: 'GBRE200', qty: 14, inv: 'HUL-PUR-2026-084' },
    { code: 'GBRC200', qty: 22, inv: 'HUL-PUR-2026-084' },
    { code: 'GBRD200', qty: 25, inv: 'HUL-PUR-2026-084' },
    { code: 'GCUR300', qty: 16, inv: 'HUL-PUR-2026-085' },
    { code: 'GCRA100', qty: 18, inv: 'HUL-PUR-2026-085' },
    { code: 'GCUV100', qty: 15, inv: 'HUL-PUR-2026-086' },
    { code: 'GCUV300', qty: 12, inv: 'HUL-PUR-2026-086' },
    { code: 'GCUV400', qty: 14, inv: 'HUL-PUR-2026-086' },
    { code: 'SXGS100', qty: 60, inv: 'HUL-PUR-2026-087' },
    { code: 'WRDR200', qty: 45, inv: 'HUL-PUR-2026-087' },
    { code: 'SXGS200', qty: 50, inv: 'HUL-PUR-2026-087' },
  ];

  for (const p of purchases) {
    const item = createdItems.find((i) => i.itemCode === p.code);
    if (!item) continue;

    await storageService.insertStockTransaction({
      transactionType: 'PURCHASE_IN',
      item: item._id,
      quantity: p.qty,
      supplierName: 'Hindustan Unilever Ltd (Pureit OEM Supply)',
      invoiceNumber: p.inv,
      performedBy: admin._id,
      remarks: 'Primary factory stock intake from HUL Pureit hub',
      transactionDate: new Date(Date.now() - 14 * 24 * 3600 * 1000),
    });
    await storageService.updateWarehouseBalance(item._id, p.qty);
  }

  // 5. Seed Stock Issued to Technicians
  const stockIssues = [
    // Rajesh Kumar
    { tech: tech1, code: 'GMWM100', qty: 4, remarks: 'Weekly allocation for Marina / Wave maintenance' },
    { tech: tech1, code: 'GCRX200', qty: 3, remarks: 'Classic G2 & Marvella kit replenishment' },
    { tech: tech1, code: 'SXGS100', qty: 10, remarks: 'Pre-sediment filter candles' },
    { tech: tech1, code: 'SXGS200', qty: 8, remarks: 'Advanced sediment filter cartridges' },

    // Amit Sharma
    { tech: tech2, code: 'GBRC200', qty: 4, remarks: 'Ultima/Marvella GKK 2 kits for high-TDS zones' },
    { tech: tech2, code: 'GBRD200', qty: 4, remarks: 'Mineral RO GKK 1 kits' },
    { tech: tech2, code: 'WRDR200', qty: 8, remarks: 'Marvella RO sediment/carbon cartridges' },
    { tech: tech2, code: 'SXGS100', qty: 8, remarks: 'Sediment pre-filters' },

    // Priya Patel
    { tech: tech3, code: 'RGKK100', qty: 3, remarks: 'Ultima RO+UV One Kit replacements' },
    { tech: tech3, code: 'GCUR300', qty: 3, remarks: 'Advance Pro & Plus Mineral RO kits' },
    { tech: tech3, code: 'GCUV100', qty: 3, remarks: 'Classic & Marvella UV kits' },
    { tech: tech3, code: 'SXGS200', qty: 6, remarks: 'Classic G2 sediment cartridges' },

    // Vikram Singh
    { tech: tech4, code: 'GPRD500', qty: 3, remarks: 'Pureit Revito 7-stage GKK 2 spares' },
    { tech: tech4, code: 'GPRB500', qty: 2, remarks: 'Revito 8-stage GKK 2 spares' },
    { tech: tech4, code: 'GPRC500', qty: 3, remarks: 'Revito ESF GKK 1 spares' },
    { tech: tech4, code: 'SXGS100', qty: 6, remarks: 'Pre-sediment filter candles' },
  ];

  for (const issue of stockIssues) {
    const item = createdItems.find((i) => i.itemCode === issue.code);
    if (!item) continue;

    await storageService.insertStockTransaction({
      transactionType: 'ISSUE_TO_TECH',
      item: item._id,
      technician: issue.tech._id,
      quantity: issue.qty,
      performedBy: admin._id,
      remarks: issue.remarks,
      transactionDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });
    await storageService.updateWarehouseBalance(item._id, -issue.qty);
    await storageService.updateTechnicianBalance(issue.tech._id, item._id, issue.qty);
  }

  // 6. Seed Realistic On-Site Usages by Technicians
  const usages = [
    {
      tech: tech1,
      code: 'GMWM100',
      qty: 2,
      site: 'Palm Meadows Villa 14, Whitefield',
      jobRef: 'PUR-JOB-401',
      remarks: 'Pureit Marina Pro annual scheduled GKK maintenance completed',
    },
    {
      tech: tech1,
      code: 'SXGS100',
      qty: 3,
      site: 'Sobha Silicon Oasis Flat 502, Hosa Road',
      jobRef: 'PUR-JOB-402',
      remarks: 'Choked pre-sediment filter candle replaced on Pureit Classic RO',
    },
    {
      tech: tech1,
      code: 'GCRX200',
      qty: 1,
      site: 'Prestige Shantiniketan Tower 7, Apt 1102',
      jobRef: 'PUR-JOB-403',
      remarks: 'Pureit Classic G2 service and One Kit installation',
    },
    {
      tech: tech2,
      code: 'GBRC200',
      qty: 1,
      site: 'Green Glen Apartments Apt 402, Bellandur',
      jobRef: 'PUR-JOB-405',
      remarks: 'Pureit Marvella Mineral RO GKK 2 membrane kit replaced (TDS restored to 28 ppm)',
    },
    {
      tech: tech2,
      code: 'GBRD200',
      qty: 1,
      site: 'Green Glen Apartments Apt 402, Bellandur',
      jobRef: 'PUR-JOB-405',
      remarks: 'Pureit Marvella Mineral RO GKK 1 primary filter replaced',
    },
    {
      tech: tech2,
      code: 'WRDR200',
      qty: 2,
      site: 'Shriram Greenfield B-302, Budigere Cross',
      jobRef: 'PUR-JOB-406',
      remarks: 'Pureit Marvella RO Slim internal sediment cartridge replaced',
    },
    {
      tech: tech3,
      code: 'RGKK100',
      qty: 1,
      site: 'Brigade Meadows Cedar Block 104, Kanakapura Rd',
      jobRef: 'PUR-JOB-408',
      remarks: 'Pureit Ultima RO+UV annual service completed with One Kit',
    },
    {
      tech: tech3,
      code: 'SXGS200',
      qty: 2,
      site: 'Godrej United Tower 2 Apt 601, Hoodi',
      jobRef: 'PUR-JOB-409',
      remarks: 'Classic G2 sediment pre-filter replaced due to high inlet turbidity',
    },
    {
      tech: tech4,
      code: 'GPRC500',
      qty: 1,
      site: 'Purva Westend A-802, Kudlu Gate',
      jobRef: 'PUR-JOB-412',
      remarks: 'Pureit Revito ESF Germkill Kit 1 service performed',
    },
    {
      tech: tech4,
      code: 'SXGS100',
      qty: 1,
      site: 'Purva Westend A-802, Kudlu Gate',
      jobRef: 'PUR-JOB-412',
      remarks: 'External pre-filter candle replaced',
    },
  ];

  for (const u of usages) {
    const item = createdItems.find((i) => i.itemCode === u.code);
    if (!item) continue;

    await storageService.insertStockTransaction({
      transactionType: 'USAGE_AT_SITE',
      item: item._id,
      technician: u.tech._id,
      quantity: u.qty,
      siteName: u.site,
      jobReference: u.jobRef,
      performedBy: u.tech._id,
      remarks: u.remarks,
      transactionDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    });
    await storageService.updateTechnicianBalance(u.tech._id, item._id, -u.qty);
  }

  // 7. Seed one Confirmed Return
  const returnItem = createdItems.find((i) => i.itemCode === 'SXGS200')!;
  await storageService.insertStockTransaction({
    transactionType: 'RETURN_TO_WAREHOUSE',
    item: returnItem._id,
    technician: tech1._id,
    quantity: 1,
    reason: 'Surplus sediment filter cartridge from completed job returned to warehouse',
    performedBy: admin._id,
    remarks: 'Verified by central warehouse manager',
    transactionDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
  });
  await storageService.updateTechnicianBalance(tech1._id, returnItem._id, -1);
  await storageService.updateWarehouseBalance(returnItem._id, 1);

  // 8. Seed one Pending Return Request for Admin workflow preview
  const pendingReturnItem = createdItems.find((i) => i.itemCode === 'WRDR200')!;
  await storageService.createReturnRequest({
    technician: tech2._id,
    item: pendingReturnItem._id,
    quantity: 1,
    reason: 'Customer rescheduled appointment to next month',
  });

  console.log('[SEED] Pureit live inventory seeding completed successfully.');
  console.log('[SEED] Default logins:');
  console.log('       Admin: Phone 9876543210 / Password admin123');
  console.log('       Techs: Phone 9876500001 (Rajesh), 9876500002 (Amit), 9876500003 (Priya), 9876500004 (Vikram) / Password tech123');
}

export async function resetToZeroStock() {
  console.log('[SEED] Purging all transactions and setting all stock to ZERO (0) for fresh user entry...');
  await storageService.clearAllData();

  // 1. Seed Admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await storageService.createUser({
    name: 'Suresh Verma (Central Warehouse)',
    phone: '9876543210',
    passwordHash: adminPasswordHash,
    role: 'admin',
    isActive: true,
  });

  // 2. Seed Technicians
  const techPasswordHash = await bcrypt.hash('tech123', 10);
  await storageService.createUser({
    name: 'Rajesh Kumar',
    phone: '9876500001',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
    employeeCode: 'PUR-TECH-01',
    area: 'South Delhi Hub',
  });

  await storageService.createUser({
    name: 'Amit Sharma',
    phone: '9876500002',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
    employeeCode: 'PUR-TECH-02',
    area: 'Noida & Greater Noida',
  });

  await storageService.createUser({
    name: 'Priya Patel',
    phone: '9876500003',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
    employeeCode: 'PUR-TECH-03',
    area: 'Gurugram Central',
  });

  await storageService.createUser({
    name: 'Vikram Singh',
    phone: '9876500004',
    passwordHash: techPasswordHash,
    role: 'technician',
    isActive: true,
    employeeCode: 'PUR-TECH-04',
    area: 'Ghaziabad East',
  });

  // 3. Seed Items (Live Pureit Catalog with exact 0 stock)
  for (const itemData of LIVE_PUREIT_CATALOG) {
    await storageService.createItem(itemData);
  }

  // Stock transactions = empty, warehouse balances = 0, technician balances = 0
  console.log('[SEED] All stock successfully initialized to ZERO (0). Ready for manual user entry.');
}

export async function seedDatabase() {
  // Always initialize with 0 stock as requested by user
  await resetToZeroStock();
}

