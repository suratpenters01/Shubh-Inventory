import React, { useState, useEffect, useMemo } from 'react';
import { IItem } from '../../types';
import { itemApi } from '../../services/api';
import {
  X,
  Save,
  Tag,
  Monitor,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Percent,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface PriceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: IItem[];
  onPricesUpdated: () => void;
  singleItem?: IItem | null;
}

export const PriceManagerModal: React.FC<PriceManagerModalProps> = ({
  isOpen,
  onClose,
  items,
  onPricesUpdated,
  singleItem,
}) => {
  // If singleItem is provided, we edit only that item. Otherwise, bulk matrix mode!
  const isSingle = Boolean(singleItem);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Local draft price map: { [itemId]: { oldPrice: number; newPrice: number; priceNotes: string; isDirty: boolean } }
  const [draftPrices, setDraftPrices] = useState<
    Record<string, { oldPrice: number; newPrice: number; priceNotes: string; isDirty: boolean }>
  >({});

  // Initialize draft prices when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setSearch('');

    const targetList = singleItem ? [singleItem] : items;
    const initialDrafts: Record<
      string,
      { oldPrice: number; newPrice: number; priceNotes: string; isDirty: boolean }
    > = {};

    targetList.forEach((item) => {
      const basePrice = item.price || 0;
      const oldP = item.oldPrice !== undefined && item.oldPrice > 0 ? item.oldPrice : basePrice;
      const newP = item.newPrice !== undefined && item.newPrice > 0 ? item.newPrice : basePrice;

      initialDrafts[item._id] = {
        oldPrice: oldP,
        newPrice: newP,
        priceNotes: item.priceNotes || '',
        isDirty: false,
      };
    });

    setDraftPrices(initialDrafts);
  }, [isOpen, items, singleItem]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (singleItem) return [singleItem];

    let list = items;
    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          (i.compatibleModels && i.compatibleModels.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, selectedCategory, search, singleItem]);

  const handlePriceChange = (
    itemId: string,
    field: 'oldPrice' | 'newPrice' | 'priceNotes',
    value: any
  ) => {
    setDraftPrices((prev) => {
      const current = prev[itemId] || { oldPrice: 0, newPrice: 0, priceNotes: '', isDirty: false };
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: field === 'priceNotes' ? value : Number(value) || 0,
          isDirty: true,
        },
      };
    });
  };

  // Quick helper to apply markup to all visible items
  const handleApplyMarkup = (percent: number) => {
    setDraftPrices((prev) => {
      const next = { ...prev };
      filteredItems.forEach((item) => {
        const cur = next[item._id] || {
          oldPrice: item.oldPrice || item.price || 0,
          newPrice: item.newPrice || item.price || 0,
          priceNotes: '',
          isDirty: false,
        };
        const computedNew = Math.round(cur.oldPrice * (1 + percent / 100));
        next[item._id] = {
          ...cur,
          newPrice: computedNew,
          isDirty: true,
        };
      });
      return next;
    });
  };

  const dirtyCount = useMemo(() => {
    return Object.values(draftPrices).filter((d) => d.isDirty).length;
  }, [draftPrices]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setFeedback(null);

      const updatesToSave: Array<{
        id: string;
        oldPrice: number;
        newPrice: number;
        priceNotes?: string;
      }> = [];

      Object.entries(draftPrices).forEach(([id, draft]) => {
        if (draft.isDirty || isSingle) {
          updatesToSave.push({
            id,
            oldPrice: draft.oldPrice,
            newPrice: draft.newPrice,
            priceNotes: draft.priceNotes,
          });
        }
      });

      if (updatesToSave.length === 0) {
        setFeedback({ type: 'success', message: 'No changes detected.' });
        setIsSaving(false);
        return;
      }

      await itemApi.bulkUpdatePrices(updatesToSave);

      setFeedback({
        type: 'success',
        message: `Successfully updated ${updatesToSave.length} kit price(s)! AO Smith portal & Box MRP synchronized.`,
      });

      onPricesUpdated();

      // If single item, auto close after 1.2s
      if (isSingle) {
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // Mark drafts as not dirty
        setDraftPrices((prev) => {
          const next: typeof prev = {};
          Object.entries(prev).forEach(([k, v]) => {
            next[k] = { ...v, isDirty: false };
          });
          return next;
        });
      }
    } catch (err: any) {
      console.error('Error saving prices:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update kit prices. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          isSingle ? 'max-w-lg' : 'max-w-4xl'
        } bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-display font-extrabold text-slate-900 leading-tight">
                {isSingle ? `Update Kit Price: ${singleItem?.itemCode}` : 'Kit Price Manager (AO Smith Portal vs Box MRP)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSingle
                  ? 'Set AO Smith portal system rate and technician printed box MRP'
                  : 'Manage Old System Price (AO Smith Portal) and New Box MRP (Technician Customer Charge) across all kits'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner explaining the difference */}
        <div className="bg-sky-50/70 border-b border-sky-100 p-3 sm:px-5 text-xs text-sky-900 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-bold">
              💡 System Rule (AO Smith Portal vs Box MRP):
            </p>
            <p className="text-[11px] text-sky-800">
              • <strong>Old Price (AO Smith Portal)</strong>: Company system portal recorded rate during ticket billing.<br />
              • <strong>New Price (Box Printed MRP)</strong>: Physical kit box printed MRP collected from customer.
            </p>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bulk Filter Controls (only in multi-item mode) */}
        {!isSingle && (
          <div className="p-3 sm:px-5 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Kit Code (e.g. GBRC200)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-900"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto">
              <div className="flex items-center space-x-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Quick Markup Helpers */}
              <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Markup:</span>
                <button
                  type="button"
                  onClick={() => handleApplyMarkup(10)}
                  title="Apply +10% over portal price to all visible box MRPs"
                  className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 rounded text-slate-700 transition cursor-pointer"
                >
                  +10%
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyMarkup(15)}
                  title="Apply +15% over portal price to all visible box MRPs"
                  className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 rounded text-slate-700 transition cursor-pointer"
                >
                  +15%
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body / Table / Form */}
        <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-4">
          {isSingle && singleItem ? (
            /* Single Item Form */
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                    {singleItem.itemCode}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{singleItem.itemName}</h4>
                </div>
                {singleItem.compatibleModels && (
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    Fits: {singleItem.compatibleModels}
                  </p>
                )}
              </div>

              {(() => {
                const draft = draftPrices[singleItem._id] || {
                  oldPrice: singleItem.oldPrice || singleItem.price || 0,
                  newPrice: singleItem.newPrice || singleItem.price || 0,
                  priceNotes: singleItem.priceNotes || '',
                  isDirty: false,
                };
                const diff = draft.newPrice - draft.oldPrice;
                const percent = draft.oldPrice > 0 ? Math.round((diff / draft.oldPrice) * 100) : 0;

                return (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Old Price Input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                          <Monitor className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          AO Smith Portal Price (Old)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={draft.oldPrice}
                            onChange={(e) =>
                              handlePriceChange(singleItem._id, 'oldPrice', e.target.value)
                            }
                            className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
                            placeholder="e.g. 2800"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          System portal entry rate (recorded portal rate)
                        </p>
                      </div>

                      {/* New Price Input */}
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center">
                          <Tag className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Box Printed MRP (Customer Charge)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-emerald-600 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={draft.newPrice}
                            onChange={(e) =>
                              handlePriceChange(singleItem._id, 'newPrice', e.target.value)
                            }
                            className="w-full pl-7 pr-3 py-2 text-sm font-mono font-extrabold bg-emerald-50/50 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-950"
                            placeholder="e.g. 3100"
                          />
                        </div>
                        <p className="text-[10px] text-emerald-700 mt-1">
                          Technician customer se yeh lega
                        </p>
                      </div>
                    </div>

                    {/* Diff Preview Card */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">Difference (Box MRP - Portal):</span>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono text-sm font-extrabold ${
                            diff >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {diff >= 0 ? `+₹${diff.toLocaleString('en-IN')}` : `-₹${Math.abs(diff).toLocaleString('en-IN')}`}
                        </span>
                        {diff !== 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {diff >= 0 ? `+${percent}%` : `${percent}%`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Price Note / Remark (Optional)
                      </label>
                      <input
                        type="text"
                        value={draft.priceNotes}
                        onChange={(e) =>
                          handlePriceChange(singleItem._id, 'priceNotes', e.target.value)
                        }
                        placeholder="e.g. AO Smith portal shows ₹2,800, box MRP is ₹3,100"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-slate-900"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Bulk Table Mode */
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Kit Code &amp; Name</th>
                    <th className="py-2.5 px-3 w-36">
                      <div className="flex items-center space-x-1">
                        <Monitor className="w-3 h-3 text-slate-400" />
                        <span>Portal Price (Old)</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-40">
                      <div className="flex items-center space-x-1 text-emerald-800">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        <span>Box MRP (Customer)</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center w-28">Diff (₹)</th>
                    <th className="py-2.5 px-3">Remark / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const draft = draftPrices[item._id] || {
                      oldPrice: item.oldPrice || item.price || 0,
                      newPrice: item.newPrice || item.price || 0,
                      priceNotes: item.priceNotes || '',
                      isDirty: false,
                    };
                    const diff = draft.newPrice - draft.oldPrice;

                    return (
                      <tr
                        key={item._id}
                        className={`hover:bg-slate-50/70 transition ${
                          draft.isDirty ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {item.itemCode}
                            </span>
                            {draft.isDirty && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Edited" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{item.itemName}</p>
                        </td>

                        {/* Portal Old Price Input */}
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={draft.oldPrice}
                              onChange={(e) =>
                                handlePriceChange(item._id, 'oldPrice', e.target.value)
                              }
                              className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                            />
                          </div>
                        </td>

                        {/* Box New MRP Input */}
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-xs text-emerald-600 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={draft.newPrice}
                              onChange={(e) =>
                                handlePriceChange(item._id, 'newPrice', e.target.value)
                              }
                              className="w-full pl-6 pr-2 py-1 text-xs font-mono font-extrabold bg-emerald-50/60 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-950"
                            />
                          </div>
                        </td>

                        {/* Diff Indicator */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                              diff > 0
                                ? 'bg-amber-100 text-amber-900'
                                : diff < 0
                                ? 'bg-rose-100 text-rose-900'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {diff > 0 ? `+₹${diff}` : diff < 0 ? `-₹${Math.abs(diff)}` : '₹0'}
                          </span>
                        </td>

                        {/* Note */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={draft.priceNotes}
                            onChange={(e) =>
                              handlePriceChange(item._id, 'priceNotes', e.target.value)
                            }
                            placeholder="e.g. Portal rate diff"
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {!isSingle && (
              <span>
                {dirtyCount > 0 ? (
                  <strong className="text-amber-700 font-bold">{dirtyCount} kit(s) modified</strong>
                ) : (
                  'No pending changes'
                )}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm shadow-emerald-600/25 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving Prices...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSingle ? 'Save Prices' : `Save All Updates (${dirtyCount})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
