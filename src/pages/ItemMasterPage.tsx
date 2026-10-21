import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { itemApi, reportApi } from '../services/api';
import { IItem, ItemCategory } from '../types';
import { CategoryBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Sparkles,
  IndianRupee,
  RotateCcw,
  Layers,
  Sliders,
  Download,
  Tag,
} from 'lucide-react';
import { exportInventoryToCsv } from '../utils/csvExport';
import { PriceBadge } from '../components/common/PriceBadge';
import { PriceManagerModal } from '../components/items/PriceManagerModal';
import { AddInventoryKitModal } from '../components/items/AddInventoryKitModal';

const CATEGORIES: ItemCategory[] = [
  'One Kit',
  'GKK1',
  'GKK2',
  'SF',
  'UV Lamp',
  'Mineral Cartridge',
  'Spare Part',
  'Other',
];

export const ItemMasterPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<IItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IItem | null>(null);

  // Price Manager Modal state
  const [isPriceManagerOpen, setIsPriceManagerOpen] = useState(false);
  const [priceEditingItem, setPriceEditingItem] = useState<IItem | null>(null);

  useEffect(() => {
    if (searchParams.get('tab') === 'prices') {
      setIsPriceManagerOpen(true);
    }
  }, [searchParams]);

  // Quick Threshold adjust modal state
  const [isQuickThresholdOpen, setIsQuickThresholdOpen] = useState(false);
  const [quickThresholdItem, setQuickThresholdItem] = useState<IItem | null>(null);
  const [quickThresholdInput, setQuickThresholdInput] = useState<number>(5);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    category: 'One Kit' as ItemCategory,
    unit: 'kit',
    price: 0,
    oldPrice: 0,
    newPrice: 0,
    priceNotes: '',
    gkkType: 'One Kit',
    compatibleModels: '',
    brand: 'A.O. Smith',
    storageLocation: '',
    description: '',
    isKit: true,
    kitComponents: '',
    supplier: '',
    hsnCode: '84212190',
    barcode: '',
    lowStockThreshold: 5,
    reorderLevel: 5,
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const data = await itemApi.getItems({
        search: search || undefined,
        category: selectedCategory || undefined,
      });
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 150);
    return () => clearTimeout(timer);
  }, [search, selectedCategory]);

  const handleResetCatalog = async () => {
    if (!window.confirm('This will purge any old/dummy data and reload the authentic Live Pureit Catalog (20 SKUs). Proceed?')) {
      return;
    }
    try {
      setIsResetting(true);
      setActionFeedback(null);
      await reportApi.resetLiveCatalog();
      setActionFeedback('✓ Live Pureit Catalog restored! All dummy items removed and 20 official SKUs loaded.');
      await fetchItems();
    } catch (err: any) {
      setActionFeedback('Failed to reset catalog.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSetZeroStock = async () => {
    if (!window.confirm('Do you want to reset all item stocks to zero (0)? This sets all stock quantities to 0 so you can record fresh inventory.')) {
      return;
    }
    try {
      setIsResetting(true);
      setActionFeedback(null);
      await reportApi.resetZeroStock();
      setActionFeedback('✓ All stock set to zero (0)! You can now record fresh purchases into the warehouse.');
      await fetchItems();
    } catch (err: any) {
      setActionFeedback('Failed to reset all stock to zero.');
    } finally {
      setIsResetting(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      itemCode: '',
      itemName: '',
      category: 'One Kit',
      unit: 'kit',
      price: 0,
      oldPrice: 0,
      newPrice: 0,
      priceNotes: '',
      gkkType: 'One Kit',
      compatibleModels: '',
      brand: 'A.O. Smith',
      storageLocation: '',
      description: '',
      isKit: true,
      kitComponents: '',
      supplier: '',
      hsnCode: '84212190',
      barcode: '',
      lowStockThreshold: 5,
      reorderLevel: 5,
      isActive: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: IItem) => {
    setEditingItem(item);
    const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
    const baseP = item.price ?? 0;
    const oldP = item.oldPrice !== undefined && item.oldPrice > 0 ? item.oldPrice : baseP;
    const newP = item.newPrice !== undefined && item.newPrice > 0 ? item.newPrice : baseP;

    setFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit || 'pcs',
      price: baseP,
      oldPrice: oldP,
      newPrice: newP,
      priceNotes: item.priceNotes || '',
      gkkType: item.gkkType || '',
      compatibleModels: item.compatibleModels || '',
      brand: item.brand || 'A.O. Smith',
      storageLocation: item.storageLocation || '',
      description: item.description || '',
      isKit: Boolean(item.isKit || item.category === 'One Kit'),
      kitComponents: item.kitComponents || '',
      supplier: item.supplier || '',
      hsnCode: item.hsnCode || '84212190',
      barcode: item.barcode || '',
      lowStockThreshold: threshold,
      reorderLevel: threshold,
      isActive: item.isActive !== false,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openQuickThresholdModal = (item: IItem) => {
    setQuickThresholdItem(item);
    setQuickThresholdInput(item.lowStockThreshold ?? item.reorderLevel ?? 5);
    setIsQuickThresholdOpen(true);
  };

  const handleQuickThresholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThresholdItem) return;
    try {
      setIsQuickSaving(true);
      await itemApi.updateItem(quickThresholdItem._id, {
        lowStockThreshold: quickThresholdInput,
        reorderLevel: quickThresholdInput,
      });
      setIsQuickThresholdOpen(false);
      setActionFeedback(`✓ Low Stock Threshold for ${quickThresholdItem.itemCode} updated to ${quickThresholdInput} ${quickThresholdItem.unit}.`);
      await fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update low stock threshold.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleExportCatalogCsv = () => {
    if (!items || items.length === 0) return;
    exportInventoryToCsv(items);
    setActionFeedback(`✓ Exported ${items.length} catalog items and low stock thresholds to CSV!`);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      await itemApi.addItem(formData);
      setIsAddModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add item to catalog.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setFormError(null);
    setIsSaving(true);
    try {
      await itemApi.updateItem(editingItem._id, formData);
      setIsEditModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to update item.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">Live Item Master Catalog</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
              <Sparkles className="w-3 h-3 mr-1 text-sky-600" />
              Pureit Official
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Official GKK Kits (One Kit, GKK1, GKK2), Sediment Filters, UV Lamps, and Genuine Spare Parts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                id="zero-all-stock-catalog-btn"
                onClick={handleSetZeroStock}
                disabled={isResetting}
                title="Reset all stock balances to 0 for physical counting"
                className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Zeroing...' : 'Set All Stock to 0'}
              </button>

              <button
                id="reset-live-catalog-btn"
                onClick={handleResetCatalog}
                disabled={isResetting}
                title="Purge any obsolete/dummy data and reload the 20 official Pureit SKUs"
                className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 transition cursor-pointer disabled:opacity-50 border border-slate-200/70"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Reloading...' : 'Reload Live Catalog'}
              </button>

              <button
                id="export-catalog-csv-btn"
                onClick={handleExportCatalogCsv}
                title="Export entire item catalog and low stock thresholds to CSV"
                className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 transition cursor-pointer border border-slate-200/70 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Export Catalog CSV
              </button>

              <button
                id="manage-kit-prices-btn"
                type="button"
                onClick={() => {
                  setPriceEditingItem(null);
                  setIsPriceManagerOpen(true);
                }}
                className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/25 active:scale-95 cursor-pointer"
                title="Bulk update Portal Price and Box Printed MRP"
              >
                <Tag className="w-3.5 h-3.5 mr-1.5" />
                ⚡ Update Kit Prices
              </button>

              <button
                id="add-kit-inventory-modal-btn"
                onClick={openAddModal}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition shadow-md shadow-sky-600/25 active:scale-95 cursor-pointer"
                title="Add a new Kit (SV Kit, GKK1, GKK2, One Kit) or inventory part"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                📦 Add Kit / New Inventory
              </button>
            </>
          )}
        </div>
      </div>

      {/* Admin Action Callout Banner for Adding Kits & Inventory */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-sky-50 via-indigo-50/40 to-emerald-50/40 border border-sky-200/90 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 shadow-2xs">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/25 shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Admin Panel Kit &amp; Inventory Manager
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Dual Pricing &amp; BOM Inward
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Add new Kits (such as <strong>Solenoid Valve SV Kit, GKK1, GKK2, One Kit</strong>) or spare parts with Dual Pricing (Portal vs Box MRP), Purifier Model compatibility, and initial warehouse stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/25 transition cursor-pointer shrink-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            + Add Kit / Inventory
          </button>
        </div>
      )}

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              id="item-search-input"
              type="text"
              placeholder="Search by Kit Code (e.g. GBRC200) or Model (e.g. Marvella)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === ''
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <Link
              to="/compatibility"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shrink-0"
              title="Open full Model Compatibility Directory"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Compatibility Matrix
            </Link>

            <label className="flex items-center space-x-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-50 shrink-0">
              <input
                id="toggle-only-low-stock-master"
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className={onlyLowStock ? 'text-rose-700 font-bold' : 'text-zinc-700'}>
                Below Min Threshold Only
              </span>
            </label>
          </div>
        </div>

        {/* Quick Kit Code Pills for 1-click hard search */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] pt-1 border-t border-zinc-100 no-scrollbar">
          <span className="text-zinc-400 font-medium shrink-0 flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Quick Codes:
          </span>
          {['GBRC200', 'GBRD200', 'GPRB500', 'GPRA500', 'GCRX200', 'GCUV400', 'GEAS100', 'RGKK100', 'SXGS100', 'WRDR200'].map(
            (code) => (
              <button
                key={code}
                type="button"
                onClick={() => setSearch(search === code ? '' : code)}
                className={`px-2 py-0.5 font-mono text-[11px] font-bold rounded shrink-0 transition cursor-pointer border ${
                  search.toUpperCase() === code
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                }`}
              >
                {code}
              </button>
            )
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Item Code</th>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4">Category / Kit Type</th>
                <th className="py-3 px-4">
                  <div className="flex flex-col">
                    <span>Dual Pricing (₹)</span>
                    <span className="text-[10px] text-zinc-400 font-normal lowercase">Box MRP vs AO Smith Portal</span>
                  </div>
                </th>
                <th className="py-3 px-4">Warehouse Stock</th>
                <th className="py-3 px-4" title="Minimum warehouse balance before reorder warning triggers">
                  <div className="flex items-center space-x-1">
                    <span>Low Stock Threshold</span>
                    <span className="text-[10px] text-zinc-400 font-normal lowercase">(min)</span>
                  </div>
                </th>
                <th className="py-3 px-4">Compatible Water Purifiers</th>
                <th className="py-3 px-4">Status</th>
                {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-10 text-center text-zinc-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading item catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-zinc-400">
                    No items found matching your filters.
                  </td>
                </tr>
              ) : (
                items
                  .filter((item) => {
                    if (onlyLowStock) {
                      const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
                      return (item.warehouseQty ?? 0) <= threshold;
                    }
                    return true;
                  })
                  .map((item) => {
                    const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
                    const isLow = (item.warehouseQty ?? 0) <= threshold;

                    return (
                      <tr key={item._id} className="hover:bg-zinc-50/70 transition">
                        <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span>{item.itemCode}</span>
                            {(item.isKit || item.category === 'One Kit' || item.category.includes('Kit')) && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                📦 Kit
                              </span>
                            )}
                          </div>
                          {item.brand && (
                            <span className="block text-[10px] font-medium text-slate-500 font-sans mt-0.5">
                              {item.brand}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-zinc-900">{item.itemName}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
                            <span className="text-zinc-400">Unit: {item.unit}</span>
                            {item.storageLocation && (
                              <span className="text-slate-600 font-medium bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                                📍 {item.storageLocation}
                              </span>
                            )}
                            {item.kitComponents && (
                              <span className="text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.2 rounded text-[10px]" title={item.kitComponents}>
                                🧩 BOM Included
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <CategoryBadge category={item.category} />
                          {item.gkkType && item.gkkType !== item.category && (
                            <span className="block text-[10px] text-zinc-500 mt-0.5 font-mono">
                              {item.gkkType}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-900">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <PriceBadge item={item} variant="pill" showDiff={true} />
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setPriceEditingItem(item)}
                                title={`Edit Portal & Box MRP for ${item.itemCode}`}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded transition cursor-pointer"
                              >
                                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`font-bold ${
                                isLow ? 'text-red-600' : 'text-zinc-900'
                              }`}
                            >
                              {item.warehouseQty ?? 0} {item.unit}
                            </span>
                            {isLow && (
                              <span
                                title="Stock is at or below defined minimum threshold"
                                className="text-red-500 bg-red-50 p-0.5 rounded"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-700">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold">
                              {threshold} {item.unit}
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => openQuickThresholdModal(item)}
                                title={`Adjust minimum threshold for ${item.itemCode}`}
                                className="text-zinc-400 hover:text-zinc-900 p-1 rounded hover:bg-zinc-100 transition cursor-pointer"
                              >
                                <Sliders className="w-3 h-3 text-zinc-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      <td className="py-3.5 px-4 max-w-sm text-zinc-600">
                        {item.compatibleModels ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                                {item.compatibleModels.split(',').length} models
                              </span>
                              <Link
                                to={`/compatibility?code=${encodeURIComponent(item.itemCode)}`}
                                className="text-[11px] font-medium text-indigo-600 hover:underline inline-flex items-center"
                              >
                                View list →
                              </Link>
                            </div>
                            <span className="line-clamp-2 text-[11px] text-zinc-500" title={item.compatibleModels}>
                              {item.compatibleModels}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isActive !== false ? (
                          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium">
                            <CheckCircle className="w-3 h-3 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded text-[11px] font-medium">
                            <XCircle className="w-3 h-3 mr-1" /> Inactive
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => setPriceEditingItem(item)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                              title="Edit Portal Price & Box MRP"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`edit-item-${item.itemCode}`}
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition cursor-pointer"
                              title="Edit Item Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Kit or New Inventory with Complete Details Modal */}
      {isAddModalOpen && (
        <AddInventoryKitModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(msg) => {
            setActionFeedback(msg || '✓ New Kit / Inventory item successfully added to catalog!');
            fetchItems();
          }}
        />
      )}

      {/* Edit Item Modal */}
      <Modal
        id="modal-edit-item"
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Item: ${editingItem?.itemCode}`}
        subtitle="Update name, low stock threshold, or active status"
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Item Name</label>
            <input
              type="text"
              required
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Unit of Measure</label>
              <input
                type="text"
                placeholder="kit, pcs, set"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Brand / Make</label>
              <input
                type="text"
                placeholder="e.g. A.O. Smith, Pureit, Kent"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Warehouse Storage Location</label>
              <input
                type="text"
                placeholder="e.g. Rack A-02, Shelf 3"
                value={formData.storageLocation}
                onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Dual Pricing Section */}
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
              🏷️ Dual Pricing (Portal vs Box Printing MRP)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  AO Smith Portal Price (Old Rate) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.oldPrice || ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFormData({ ...formData, oldPrice: v, price: formData.newPrice || v });
                  }}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-indigo-600 text-slate-900"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Portal system entry rate</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800">
                  Box Printed MRP (Customer Charge) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.newPrice || ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFormData({ ...formData, newPrice: v, price: v });
                  }}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg font-mono font-extrabold focus:ring-2 focus:ring-emerald-600 text-emerald-950"
                />
                <span className="text-[10px] text-emerald-700 mt-0.5 block">Price charged to customer on-site</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                Low Stock Threshold (Min Units) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.lowStockThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, lowStockThreshold: val, reorderLevel: val });
                }}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Minimum warehouse units before low stock warning triggers
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">GKK Kit Type / Variant</label>
              <input
                type="text"
                value={formData.gkkType}
                onChange={(e) => setFormData({ ...formData, gkkType: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Compatible Purifier Models</label>
            <textarea
              rows={2}
              value={formData.compatibleModels}
              onChange={(e) => setFormData({ ...formData, compatibleModels: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Included Kit Components / BOM</label>
            <textarea
              rows={2}
              placeholder="e.g. 1x Solenoid Valve 24V, 2x Connectors, 1x Teflon Tape"
              value={formData.kitComponents}
              onChange={(e) => setFormData({ ...formData, kitComponents: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Supplier / Vendor</label>
              <input
                type="text"
                placeholder="e.g. A.O. Smith India Private Limited"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">HSN Code</label>
              <input
                type="text"
                placeholder="e.g. 84212190"
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-medium text-zinc-700">
              Item is Active and available for stock transactions
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-edit-item-btn"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Threshold Modal */}
      <Modal
        id="modal-quick-threshold-master"
        isOpen={isQuickThresholdOpen}
        onClose={() => setIsQuickThresholdOpen(false)}
        title={`Set Low Stock Threshold: ${quickThresholdItem?.itemCode}`}
        subtitle="Define minimum required warehouse units for low stock alerts"
        maxWidth="md"
      >
        {quickThresholdItem && (
          <form onSubmit={handleQuickThresholdSubmit} className="space-y-4">
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1 text-xs">
              <p className="font-semibold text-zinc-900">{quickThresholdItem.itemName}</p>
              <p className="text-zinc-500">
                Current Warehouse Stock:{' '}
                <strong className="text-zinc-900">
                  {quickThresholdItem.warehouseQty ?? 0} {quickThresholdItem.unit}
                </strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                Low Stock Threshold (Minimum Units)
              </label>
              <input
                type="number"
                min="0"
                required
                value={quickThresholdInput}
                onChange={(e) => setQuickThresholdInput(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-bold bg-white border border-zinc-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                When warehouse balance is at or below this threshold, a low stock alert will be shown on the Dashboard and Stock pages.
              </p>
            </div>

            {/* Quick preset chips */}
            <div className="flex items-center space-x-2 pt-1 text-xs">
              <span className="text-zinc-500 font-medium text-[11px]">Presets:</span>
              {[2, 4, 5, 6, 10, 15].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuickThresholdInput(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    quickThresholdInput === preset
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsQuickThresholdOpen(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isQuickSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {isQuickSaving ? 'Saving...' : 'Update Threshold'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk & Single Price Manager Modal */}
      <PriceManagerModal
        isOpen={isPriceManagerOpen || Boolean(priceEditingItem)}
        onClose={() => {
          setIsPriceManagerOpen(false);
          setPriceEditingItem(null);
        }}
        singleItem={priceEditingItem}
        items={items}
        onPricesUpdated={fetchItems}
      />
    </div>
  );
};
