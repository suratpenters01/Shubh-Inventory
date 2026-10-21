import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { stockApi, reportApi } from '../services/api';
import { IWarehouseBalanceItem } from '../types';
import { CategoryBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Warehouse,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Search,
  CheckCircle2,
  Trash2,
  RefreshCw,
  RotateCcw,
  Layers,
  Sparkles,
  Download,
  FileSpreadsheet,
  Tag,
  Plus,
} from 'lucide-react';
import { exportInventoryToCsv } from '../utils/csvExport';
import { PriceBadge } from '../components/common/PriceBadge';
import { PriceManagerModal } from '../components/items/PriceManagerModal';
import { AddInventoryKitModal } from '../components/items/AddInventoryKitModal';

export const WarehouseStockPage: React.FC = () => {
  const [balances, setBalances] = useState<IWarehouseBalanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isAddKitModalOpen, setIsAddKitModalOpen] = useState(false);

  // Price Manager Modal state
  const [isPriceManagerOpen, setIsPriceManagerOpen] = useState(false);
  const [priceEditingItem, setPriceEditingItem] = useState<any>(null);

  // Damage write-off modal
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [selectedDamageItem, setSelectedDamageItem] = useState<IWarehouseBalanceItem | null>(null);
  const [damageQty, setDamageQty] = useState('1');
  const [damageReason, setDamageReason] = useState('Transit leakage / damaged housing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchWarehouseStock = async () => {
    try {
      setIsLoading(true);
      const list = await stockApi.getWarehouseBalances();
      setBalances(list);
    } catch (err) {
      console.error('Failed to load warehouse balances', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouseStock();
  }, []);

  const openDamageModal = (entry: IWarehouseBalanceItem) => {
    setSelectedDamageItem(entry);
    setDamageQty('1');
    setDamageReason('Transit crack / damaged packaging');
    setDamageModalOpen(true);
  };

  const handleDamageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDamageItem) return;
    setIsProcessing(true);
    setAlertMsg(null);
    try {
      await stockApi.recordDamageWriteoff({
        itemId: selectedDamageItem.item._id,
        quantity: Number(damageQty),
        reason: damageReason.trim(),
      });
      setDamageModalOpen(false);
      setAlertMsg({
        type: 'success',
        text: `✓ Recorded damage write-off of ${damageQty} ${selectedDamageItem.item.unit} (${selectedDamageItem.item.itemName}).`,
      });
      fetchWarehouseStock();
    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to record damage write-off.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZeroAllStock = async () => {
    if (!window.confirm('Are you sure you want to reset all warehouse stock balances to 0? All item quantities will be set to 0 for a fresh physical stock audit.')) {
      return;
    }
    try {
      setIsResetting(true);
      await reportApi.resetZeroStock();
      await fetchWarehouseStock();
      setAlertMsg({
        type: 'success',
        text: '✓ All warehouse stock balances have been reset to 0. You can now begin fresh inward entries.',
      });
    } catch {
      setAlertMsg({
        type: 'error',
        text: 'Failed to reset stock.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportInventoryCsv = () => {
    const items = balances.map((b) => ({
      ...b.item,
      warehouseQty: b.quantity,
    }));
    exportInventoryToCsv(items, balances);
    setAlertMsg({
      type: 'success',
      text: `✓ Current inventory audit exported to CSV for ${balances.length} SKUs!`,
    });
  };

  const filtered = balances.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.item.itemName.toLowerCase().includes(q) ||
      b.item.itemCode.toLowerCase().includes(q) ||
      (b.item.compatibleModels || '').toLowerCase().includes(q) ||
      (b.item.category || '').toLowerCase().includes(q) ||
      (b.item.gkkType || '').toLowerCase().includes(q);
    const threshold = b.item.lowStockThreshold ?? b.item.reorderLevel ?? 5;
    const isLow = b.quantity <= threshold;
    return onlyLowStock ? matchesSearch && isLow : matchesSearch;
  });

  const lowStockCount = balances.filter(
    (b) => b.quantity <= (b.item.lowStockThreshold ?? b.item.reorderLevel ?? 5)
  ).length;
  const totalUnits = balances.reduce((sum, b) => sum + b.quantity, 0);
  const totalValuation = balances.reduce(
    (sum, b) => sum + b.quantity * (b.item.newPrice || b.item.price || 0),
    0
  );
  const totalPortalValuation = balances.reduce(
    (sum, b) => sum + b.quantity * (b.item.oldPrice || b.item.price || 0),
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <Warehouse className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                  Central Warehouse Stock
                </h2>
                <span className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md">
                  Live Stock
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Live inventory tracking of warehouse spare parts, Box MRP vs Portal valuation, and low-stock alerts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="warehouse-kit-prices-btn"
            type="button"
            onClick={() => {
              setPriceEditingItem(null);
              setIsPriceManagerOpen(true);
            }}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-600/25 active:scale-95 cursor-pointer"
            title="Bulk update Portal Price and Box Printed MRP"
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            ⚡ Update Kit Prices
          </button>

          <button
            id="zero-all-stock-btn"
            onClick={handleZeroAllStock}
            disabled={isResetting}
            className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Reset all warehouse balances to 0 for fresh inventory counting"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Zeroing Stock...' : 'Set All Stock to 0'}
          </button>

          <button
            id="export-inventory-csv-btn"
            onClick={handleExportInventoryCsv}
            title="Export full inventory balances, valuation and thresholds to CSV for auditing"
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
            Export CSV
          </button>

          <button
            id="open-add-kit-inventory-wh-btn"
            type="button"
            onClick={() => setIsAddKitModalOpen(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm shadow-sky-600/25 active:scale-95 cursor-pointer"
            title="Add a new Kit (SV Kit, GKK1, GKK2) or spare part with initial warehouse stock"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            📦 + Add Kit / Inventory
          </button>

          <Link
            to="/purchase"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-sm shadow-emerald-700/25 active:scale-95 cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
            + Stock Inward
          </Link>
          <Link
            to="/issue"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm shadow-sky-600/25 active:scale-95 cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
            → Issue to Tech
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards with styled borders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Warehouse Units</span>
          <p className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tabular-nums">{totalUnits} <span className="text-xs font-normal text-slate-500 font-sans">units</span></p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">{balances.length} active Pureit SKUs in warehouse</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Stock Valuation (Dual Rate)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Box Printed MRP (Customer):</span>
              <p className="text-2xl font-extrabold text-emerald-800 font-mono tabular-nums">₹{totalValuation.toLocaleString('en-IN')}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-medium text-slate-500 block">Portal Rate (System):</span>
              <p className="text-sm font-bold text-slate-700 font-mono tabular-nums">₹{totalPortalValuation.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Difference: +₹{(totalValuation - totalPortalValuation).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Items</span>
          <p className={`text-3xl font-extrabold mt-1 font-mono tabular-nums ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{lowStockCount} <span className="text-xs font-normal text-slate-500 font-sans">critical SKUs</span></p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Inventory below reorder safety threshold</p>
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{alertMsg.text}</span>
          <button
            onClick={() => setAlertMsg(null)}
            className="text-xs underline font-bold ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Control Bar in Inglish */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Item code (e.g. GBRC200) ya Purifier Model likhein..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white text-slate-900 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                id="toggle-low-stock"
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Show Low Stock Only ({lowStockCount})</span>
            </label>

            <Link
              to="/compatibility"
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition shrink-0"
              title="Open full Model Compatibility Directory"
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Model Directory
            </Link>

            <div className="text-xs text-slate-500 pl-3 border-l border-slate-200 hidden sm:block font-medium">
              Total Units: <span className="font-mono font-bold text-slate-900">{totalUnits}</span>
            </div>
          </div>
        </div>

        {/* Quick Kit Code Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] pt-1 border-t border-slate-100 scrollbar-none">
          <span className="text-slate-400 font-bold shrink-0 flex items-center text-[10px] uppercase tracking-wider">
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Quick Codes:
          </span>
          {['GBRC200', 'GBRD200', 'GPRB500', 'GPRA500', 'GCRX200', 'GCUV400', 'GEAS100', 'RGKK100', 'SXGS100', 'WRDR200'].map(
            (code) => (
              <button
                key={code}
                type="button"
                onClick={() => setSearch(search === code ? '' : code)}
                className={`px-2.5 py-0.5 font-mono text-[10px] font-extrabold rounded-md shrink-0 transition cursor-pointer border ${
                  search.toUpperCase() === code
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {code}
              </button>
            )
          )}
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
              <tr>
                <th className="py-3 px-4">Item SKU</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Pricing (Box MRP vs Portal)</th>
                <th className="py-3 px-4">Warehouse Stock</th>
                <th className="py-3 px-4">Stock Valuation (₹)</th>
                <th className="py-3 px-4">Min Limit (Alert)</th>
                <th className="py-3 px-4">Health Status</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-medium">Refreshing warehouse stock...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No items match the active filters or search query.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const threshold = entry.item.lowStockThreshold ?? entry.item.reorderLevel ?? 5;
                  const isLow = entry.quantity <= threshold;
                  const effectivePrice = entry.item.newPrice || entry.item.price || 0;
                  const lineValuation = entry.quantity * effectivePrice;

                  return (
                    <tr
                      key={entry.item._id}
                      className={`hover:bg-slate-50/80 transition ${
                        isLow ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                        {entry.item.itemCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{entry.item.itemName}</p>
                        {entry.item.compatibleModels && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs font-medium">
                            {entry.item.compatibleModels}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <CategoryBadge category={entry.item.category} />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <PriceBadge item={entry.item} variant="pill" showDiff={true} />
                          <button
                            type="button"
                            onClick={() => {
                              setPriceEditingItem(entry.item);
                              setIsPriceManagerOpen(true);
                            }}
                            title={`Update Box MRP & Portal Price for ${entry.item.itemCode}`}
                            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-sm font-extrabold font-mono ${
                            isLow ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {entry.quantity} {entry.item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-800 font-mono">
                        ₹{lineValuation.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono font-medium">
                        {threshold} {entry.item.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Safe
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/purchase?itemId=${entry.item._id}`}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition border border-emerald-200/60"
                            title="Add stock to warehouse"
                          >
                            + Inward
                          </Link>
                          <Link
                            to="/issue"
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition border border-indigo-200/60"
                            title="Issue to field technician"
                          >
                            → Issue
                          </Link>
                          <button
                            onClick={() => openDamageModal(entry)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Write-off damaged unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Damage Write-off Modal */}
      <Modal
        id="modal-damage-writeoff"
        isOpen={damageModalOpen}
        onClose={() => setDamageModalOpen(false)}
        title="Record Damaged Stock Write-off"
        subtitle="Deduct damaged, leaked, or broken items from warehouse stock"
        maxWidth="md"
      >
        <form onSubmit={handleDamageSubmit} className="space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl text-xs border border-slate-200">
            <span className="text-slate-500 font-medium">Selected Item:</span>
            <p className="font-bold text-slate-900 mt-0.5">
              [{selectedDamageItem?.item.itemCode}] {selectedDamageItem?.item.itemName}
            </p>
            <p className="text-slate-500 mt-1">
              Current Warehouse Stock: {selectedDamageItem?.quantity} {selectedDamageItem?.item.unit}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Damaged Quantity to Write-Off *
            </label>
            <input
              type="number"
              min="0.01"
              max={selectedDamageItem?.quantity || 1}
              step="any"
              required
              value={damageQty}
              onChange={(e) => setDamageQty(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Damage / Disposal Reason *</label>
            <textarea
              rows={2}
              required
              value={damageReason}
              onChange={(e) => setDamageReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 text-slate-900 font-medium"
            />
          </div>

          <p className="text-[11px] text-slate-500">
            * This records a <code>DAMAGE_WRITEOFF</code> transaction in the ledger for full audit compliance.
          </p>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDamageModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isProcessing ? 'Writing off...' : 'Confirm Write-Off'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Kit Price Manager Modal (Single or Bulk) */}
      {isPriceManagerOpen && (
        <PriceManagerModal
          isOpen={isPriceManagerOpen}
          onClose={() => {
            setIsPriceManagerOpen(false);
            setPriceEditingItem(null);
          }}
          items={balances.map((b) => b.item)}
          singleItem={priceEditingItem}
          onPricesUpdated={fetchWarehouseStock}
        />
      )}

      {/* Add Kit or New Inventory with All Details Modal */}
      {isAddKitModalOpen && (
        <AddInventoryKitModal
          isOpen={isAddKitModalOpen}
          onClose={() => setIsAddKitModalOpen(false)}
          onSuccess={(_msg) => {
            fetchWarehouseStock();
          }}
        />
      )}
    </div>
  );
};
