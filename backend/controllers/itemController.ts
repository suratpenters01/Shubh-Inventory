import { Request, Response } from 'express';
import { storageService } from '../services/storageService.js';
import { ItemCategory } from '../types/index.js';

const VALID_CATEGORIES: ItemCategory[] = [
  'One Kit',
  'GKK1',
  'GKK2',
  'SF',
  'UV Lamp',
  'Mineral Cartridge',
  'Spare Part',
  'Other',
];

export const itemController = {
  async getItems(req: Request, res: Response) {
    try {
      const { category, search, isActive } = req.query;
      const items = await storageService.listItems({
        category: category as string,
        search: search as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      // Attach warehouse balance to each item for convenience
      const itemsWithBalance = await Promise.all(
        items.map(async (item) => {
          const warehouseQty = await storageService.getWarehouseBalance(item._id);
          const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
          return {
            ...item,
            lowStockThreshold: threshold,
            reorderLevel: threshold,
            warehouseQty,
            isLowStock: warehouseQty <= threshold,
          };
        })
      );

      return res.json({ items: itemsWithBalance });
    } catch (err: any) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ error: 'Failed to retrieve item catalog.' });
    }
  },

  async addItem(req: Request, res: Response) {
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
        inwardRemarks,
      } = req.body;

      if (!itemCode || !itemName || !category) {
        return res.status(400).json({ error: 'itemCode, itemName, and category are required.' });
      }

      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }

      const existing = await storageService.findItemByCode(itemCode.trim());
      if (existing) {
        return res.status(400).json({ error: `An item with item code '${itemCode}' already exists.` });
      }

      const rawThreshold = lowStockThreshold !== undefined ? lowStockThreshold : reorderLevel;
      const parsedThreshold = Number(rawThreshold);
      const thresholdVal = isNaN(parsedThreshold) || parsedThreshold < 0 ? 5 : parsedThreshold;
      const parsedPrice = price !== undefined ? Number(price) : 0;
      const parsedOldPrice = oldPrice !== undefined ? Number(oldPrice) : parsedPrice;
      const parsedNewPrice = newPrice !== undefined ? Number(newPrice) : (parsedPrice || parsedOldPrice);

      const isKitFlag = Boolean(isKit || category === 'One Kit' || (category && category.includes('Kit')));

      const newItem = await storageService.createItem({
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        category,
        unit: unit?.trim() || (isKitFlag ? 'kit' : category === 'SF' ? 'pcs' : 'pcs'),
        price: isNaN(parsedNewPrice) ? (isNaN(parsedPrice) ? 0 : parsedPrice) : parsedNewPrice,
        oldPrice: isNaN(parsedOldPrice) ? 0 : parsedOldPrice,
        newPrice: isNaN(parsedNewPrice) ? 0 : parsedNewPrice,
        priceNotes: priceNotes?.trim() || '',
        priceUpdatedAt: new Date(),
        gkkType: gkkType?.trim() || category,
        compatibleModels: compatibleModels?.trim() || '',
        brand: brand?.trim() || '',
        storageLocation: storageLocation?.trim() || '',
        description: description?.trim() || '',
        isKit: isKitFlag,
        kitComponents: kitComponents?.trim() || '',
        supplier: supplier?.trim() || '',
        hsnCode: hsnCode?.trim() || '',
        barcode: barcode?.trim() || '',
        lowStockThreshold: thresholdVal,
        reorderLevel: thresholdVal,
        isActive: true,
      });

      // Handle direct initial stock inward into warehouse if specified
      const startQty = Number(initialStock !== undefined ? initialStock : initialQuantity);
      if (!isNaN(startQty) && startQty > 0) {
        await storageService.updateWarehouseBalance(newItem._id, startQty);
        await storageService.insertStockTransaction({
          transactionType: 'PURCHASE_IN',
          item: newItem._id,
          quantity: startQty,
          supplierName: supplier?.trim() || 'Central Warehouse Opening Setup',
          invoiceNumber: initialInvoiceNumber?.trim() || `INIT-${newItem.itemCode}`,
          performedBy: (req as any).user?._id || 'admin',
          remarks: inwardRemarks?.trim() || `Opening warehouse inventory for ${isKitFlag ? 'Kit' : 'Item'} (${startQty} ${newItem.unit})`,
          transactionDate: new Date(),
        });
      }

      const currentWarehouseQty = await storageService.getWarehouseBalance(newItem._id);

      return res.status(201).json({
        message: `${isKitFlag ? 'Kit' : 'Inventory item'} added successfully to catalog${startQty > 0 ? ` with ${startQty} units inwarded` : ''}`,
        item: {
          ...newItem,
          warehouseQty: currentWarehouseQty,
          isLowStock: currentWarehouseQty <= thresholdVal,
        },
      });
    } catch (err: any) {
      console.error('Error adding item:', err);
      return res.status(500).json({ error: 'Failed to add item.' });
    }
  },

  async updateItem(req: Request, res: Response) {
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
        barcode,
      } = req.body;

      const item = await storageService.findItemById(id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found.' });
      }

      if (category && !VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }

      const updates: any = {};
      if (itemName !== undefined) updates.itemName = itemName.trim();
      if (category !== undefined) updates.category = category;
      if (unit !== undefined) updates.unit = unit.trim();
      if (compatibleModels !== undefined) updates.compatibleModels = compatibleModels.trim();
      if (gkkType !== undefined) updates.gkkType = gkkType.trim();
      if (brand !== undefined) updates.brand = brand.trim();
      if (storageLocation !== undefined) updates.storageLocation = storageLocation.trim();
      if (description !== undefined) updates.description = description.trim();
      if (isKit !== undefined) updates.isKit = Boolean(isKit);
      if (kitComponents !== undefined) updates.kitComponents = kitComponents.trim();
      if (supplier !== undefined) updates.supplier = supplier.trim();
      if (hsnCode !== undefined) updates.hsnCode = hsnCode.trim();
      if (barcode !== undefined) updates.barcode = barcode.trim();

      // Dual Price Handling
      let priceChanged = false;
      if (oldPrice !== undefined) {
        updates.oldPrice = Number(oldPrice) || 0;
        priceChanged = true;
      }
      if (newPrice !== undefined) {
        const np = Number(newPrice) || 0;
        updates.newPrice = np;
        updates.price = np; // keep base price aligned with current box MRP
        priceChanged = true;
      } else if (price !== undefined) {
        const p = Number(price) || 0;
        updates.price = p;
        if (updates.newPrice === undefined) updates.newPrice = p;
        priceChanged = true;
      }
      if (priceNotes !== undefined) updates.priceNotes = priceNotes.trim();
      if (priceChanged) updates.priceUpdatedAt = new Date();
      
      const rawThreshold = lowStockThreshold !== undefined ? lowStockThreshold : reorderLevel;
      if (rawThreshold !== undefined) {
        const r = Number(rawThreshold);
        const thresholdVal = isNaN(r) || r < 0 ? 5 : r;
        updates.lowStockThreshold = thresholdVal;
        updates.reorderLevel = thresholdVal;
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);

      const updated = await storageService.updateItem(id, updates);
      return res.json({ message: 'Item updated successfully', item: updated });
    } catch (err: any) {
      console.error('Error updating item:', err);
      return res.status(500).json({ error: 'Failed to update item.' });
    }
  },

  // Bulk update prices across all kits in one swift call
  async bulkUpdatePrices(req: Request, res: Response) {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'updates array is required.' });
      }

      const updatedItems: any[] = [];
      for (const entry of updates) {
        if (!entry.id) continue;
        const oldP = Number(entry.oldPrice) || 0;
        const newP = Number(entry.newPrice) || 0;
        const patch: any = {
          oldPrice: oldP,
          newPrice: newP,
          price: newP, // base price synchronized with new printed MRP
          priceUpdatedAt: new Date(),
        };
        if (entry.priceNotes !== undefined) {
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
        items: updatedItems,
      });
    } catch (err: any) {
      console.error('Error bulk updating prices:', err);
      return res.status(500).json({ error: 'Failed to bulk update prices.' });
    }
  },
};
