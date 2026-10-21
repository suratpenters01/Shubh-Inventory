import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ILowStockItem } from '../../types';
import { Modal } from '../common/Modal';
import { itemApi } from '../../services/api';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  AlertTriangle,
  ArrowDownToLine,
  Sliders,
  CheckCircle2,
  Search,
  RefreshCw,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface LowStockWidgetProps {
  items: ILowStockItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onItemUpdated?: () => void;
}

interface ReorderRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  current: number;
  minimum: number;
  suggestedQty: number; // minimum - current (editable)
}

export const LowStockWidget: React.FC<LowStockWidgetProps> = ({
  items = [],
  isLoading = false,
  onRefresh,
  onItemUpdated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Row selection state for reordering
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reorder List Modal state
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderRows, setReorderRows] = useState<ReorderRow[]>([]);
  const [copiedText, setCopiedText] = useState(false);

  // Quick Threshold Modal state
  const [editingItem, setEditingItem] = useState<ILowStockItem | null>(null);
  const [thresholdInput, setThresholdInput] = useState<number>(5);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [thresholdSuccessMsg, setThresholdSuccessMsg] = useState<string | null>(null);

  const totalAlerts = items.length;

  // Filter items by search
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      item.itemCode.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q) ||
      (item.compatibleModels || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  });

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i._id)));
    }
  };

  const handleOpenReorderList = () => {
    const targets = filteredItems.filter((i) =>
      selectedIds.size > 0 ? selectedIds.has(i._id) : true
    );

    const rows: ReorderRow[] = targets.map((item) => {
      const cur = item.warehouseQty ?? 0;
      const min = item.lowStockThreshold ?? item.reorderLevel ?? 5;
      const diff = Math.max(1, min - cur);
      return {
        id: item._id,
        code: item.itemCode,
        name: item.itemName,
        unit: item.unit || 'units',
        current: cur,
        minimum: min,
        suggestedQty: diff,
      };
    });

    setReorderRows(rows);
    setCopiedText(false);
    setIsReorderModalOpen(true);
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    setReorderRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, suggestedQty: Math.max(1, newQty) } : r))
    );
  };

  const getReorderShareText = () => {
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    let text = `*AquaStock - Spare Parts Reorder Indent*\nDate: ${dateStr}\n\n`;
    reorderRows.forEach((r, idx) => {
      text += `${idx + 1}. [${r.code}] ${r.name}\n   Indent Quantity: ${r.suggestedQty} ${r.unit} (Current: ${r.current}, Min: ${r.minimum})\n`;
    });
    text += `\nTotal Items: ${reorderRows.length}\nPlease confirm dispatch schedule.`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      const ok = await copyTextToClipboard(getReorderShareText());
      if (ok) {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2200);
      }
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleOpenThresholdModal = (item: ILowStockItem) => {
    setEditingItem(item);
    setThresholdInput(item.lowStockThreshold ?? item.reorderLevel ?? 5);
    setThresholdSuccessMsg(null);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setIsSavingThreshold(true);
      await itemApi.updateItem(editingItem._id, {
        lowStockThreshold: thresholdInput,
        reorderLevel: thresholdInput,
      });

      setThresholdSuccessMsg(
        `✓ Threshold updated to ${thresholdInput} ${editingItem.unit || 'units'}.`
      );
      setTimeout(() => {
        setEditingItem(null);
        if (onItemUpdated) onItemUpdated();
      }, 600);
    } catch (err) {
      console.error('Failed to update threshold', err);
    } finally {
      setIsSavingThreshold(false);
    }
  };

  // If no items are below threshold, render a clean, reassuring notification
  if (totalAlerts === 0 && !isLoading) {
    return (
      <div
        id="dashboard-low-stock-widget"
        className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] flex items-center justify-between"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Inventory Safety: All SKUs Above Minimum Threshold
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              No parts currently require replenishment. Central warehouse buffer is healthy.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Refresh alerts"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <Link
            to="/items"
            className="text-xs text-sky-700 hover:text-sky-900 font-bold px-3 py-1.5 rounded-xl border border-sky-200/70 bg-sky-50/60 hover:bg-sky-50 transition shadow-2xs"
          >
            Adjust Thresholds →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      id="dashboard-low-stock-widget"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] overflow-hidden"
    >
      {/* Header with Reorder list trigger */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500/15 via-rose-500/10 to-amber-500/10 border border-rose-200/70 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-display font-bold text-slate-900">Low Stock Alerts</h3>
              <span className="text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/70 px-2.5 py-0.5 rounded-full">
                {totalAlerts} items
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Items at or below defined minimum safety threshold in warehouse
            </p>
          </div>
        </div>

        {/* Search & Actions with Reorder list button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SKU or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
            />
          </div>

          <button
            type="button"
            id="reorder-list-btn"
            onClick={handleOpenReorderList}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl transition shadow-sm shadow-sky-600/20 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Generate suggested reorder indent"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Reorder List {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredItems.length})`}
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200/90 bg-white transition cursor-pointer shadow-2xs"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <Link
            to="/items"
            className="hidden sm:inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50 bg-white rounded-xl transition shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Min Thresholds
          </Link>
        </div>
      </div>

      {/* Select All Subbar */}
      {filteredItems.length > 0 && (
        <div className="bg-slate-50/90 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <label className="flex items-center space-x-2.5 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-bold">
              Select All ({selectedIds.size} of {filteredItems.length} selected)
            </span>
          </label>

          <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
            Tick items to create a vendor procurement indent
          </span>
        </div>
      )}

      {/* Low Stock Items List with row checkboxes */}
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400 font-medium">
            No items match your search.
          </p>
        ) : (
          filteredItems.map((item) => {
            const qty = item.warehouseQty ?? 0;
            const threshold = item.lowStockThreshold ?? item.reorderLevel ?? 5;
            const isZero = qty === 0;
            const isChecked = selectedIds.has(item._id);

            return (
              <div
                key={item._id}
                className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isChecked ? 'bg-sky-50/50' : 'hover:bg-slate-50/80'
                }`}
              >
                {/* Checkbox & Item Details */}
                <div className="flex items-start sm:items-center space-x-3.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelectRow(item._id)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer mt-0.5 sm:mt-0"
                    aria-label={`Select ${item.itemCode} for reorder list`}
                  />

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded-md tracking-tight">
                        {item.itemCode}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.itemName}
                      </span>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md shrink-0">
                        {item.category}
                      </span>
                    </div>
                    {item.compatibleModels && (
                      <p className="text-[11px] text-slate-500 truncate font-medium">
                        Fits: <span className="text-slate-600">{item.compatibleModels}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Stock metrics & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pl-7 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs font-extrabold font-mono tabular-nums ${
                          isZero ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {qty} {item.unit || 'units'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        / Min {threshold}
                      </span>
                    </div>
                    {isZero ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-md mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        <span>Out of Stock</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md mt-0.5">
                        Need {Math.max(1, threshold - qty)} to replenish
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenThresholdModal(item)}
                      title="Adjust minimum threshold"
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition cursor-pointer shadow-2xs hover:border-slate-300"
                    >
                      Edit Min
                    </button>

                    <Link
                      to={`/purchase?itemId=${item._id}`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition shadow-sm shadow-sky-600/20 active:scale-95"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                      Inward
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reorder List Modal (NO PRICES - Suggested Qty = Min - Current, Editable) */}
      <Modal
        id="modal-reorder-list"
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        title="Suggested Reorder Indent List"
        subtitle={`Showing ${reorderRows.length} parts below minimum safety limit (Suggested Quantity = Minimum - Current)`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between">
            <span className="font-semibold text-slate-800">
              Edit quantities directly and share via WhatsApp or copy:
            </span>
            <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md font-bold">
              {reorderRows.length} SKUs
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {reorderRows.map((row) => (
              <div
                key={row.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/50"
              >
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                      {row.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {row.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                    <span>Current: <strong className="text-slate-800 font-mono">{row.current} {row.unit}</strong></span>
                    <span>·</span>
                    <span>Min Safety Limit: <strong className="text-slate-800 font-mono">{row.minimum} {row.unit}</strong></span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <label className="text-xs font-semibold text-slate-600">
                    Suggested Indent:
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      value={row.suggestedQty}
                      onChange={(e) => handleUpdateQty(row.id, parseInt(e.target.value) || 1)}
                      className="w-20 px-2.5 py-1 text-xs font-extrabold font-mono text-indigo-900 bg-indigo-50/60 border border-indigo-200 rounded-lg text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                    />
                    <span className="text-xs font-medium text-slate-500">{row.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons: Copy Text & Share on WhatsApp (No Prices) */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400 font-medium">
              * Rates and prices are excluded as per supply requisitions.
            </span>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer shadow-2xs"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Copy Text
                  </>
                )}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(getReorderShareText())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Share on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Threshold Modal */}
      <Modal
        id="modal-quick-threshold"
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={`Set Low Stock Minimum: ${editingItem?.itemCode || ''}`}
        subtitle={`Adjust the warning threshold level for ${editingItem?.itemName || ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveThreshold} className="space-y-4">
          {thresholdSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {thresholdSuccessMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Minimum Required Warehouse Units
            </label>
            <input
              type="number"
              min="0"
              max="9999"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3.5 py-2.5 text-sm font-bold font-mono text-slate-900 bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
              autoFocus
              required
            />
            <p className="text-[11px] text-slate-500 font-medium">
              When warehouse balance drops to or below this number, it will be flagged for reorder.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingThreshold}
              className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-600/20 active:scale-95"
            >
              {isSavingThreshold ? 'Saving...' : 'Save Minimum'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
