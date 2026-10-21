import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IItem } from '../../types';
import { Search, Check, ChevronDown, X, AlertCircle, Sparkles, Tag } from 'lucide-react';
import { PriceBadge } from './PriceBadge';

interface ItemSearchPickerProps {
  items: IItem[];
  selectedItemId: string;
  onSelectItem: (item: IItem) => void;
  isLoading?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  showWarehouseStock?: boolean;
  showTechStock?: boolean;
  techStockMap?: Record<string, number>;
}

export const ItemSearchPicker: React.FC<ItemSearchPickerProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  isLoading = false,
  label = 'Product / Item Code',
  helperText,
  required = true,
  showWarehouseStock = true,
  showTechStock = false,
  techStockMap,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [recentItemIds, setRecentItemIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recent_used_item_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 5 Most recently used items from browser storage
  const recentItems = useMemo(() => {
    return recentItemIds
      .map((id) => items.find((i) => i._id === id))
      .filter((i): i is IItem => Boolean(i))
      .slice(0, 5);
  }, [items, recentItemIds]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i._id === selectedItemId);
  }, [items, selectedItemId]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => {
        const code = (i.itemCode || '').toLowerCase();
        const name = (i.itemName || '').toLowerCase();
        const cat = (i.category || '').toLowerCase();
        const models = (i.compatibleModels || '').toLowerCase();
        const gkk = (i.gkkType || '').toLowerCase();
        return (
          code.includes(q) ||
          name.includes(q) ||
          cat.includes(q) ||
          models.includes(q) ||
          gkk.includes(q)
        );
      });
    }
    return list;
  }, [items, searchQuery, selectedCategory]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenDropdown = () => {
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSelect = (item: IItem) => {
    // Save to 5 most recently used items in browser storage
    try {
      const updated = [item._id, ...recentItemIds.filter((id) => id !== item._id)].slice(0, 5);
      setRecentItemIds(updated);
      localStorage.setItem('recent_used_item_ids', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save recent item', e);
    }
    onSelectItem(item);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      {/* Label & Details */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-800 tracking-tight">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedItem && (
          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
            SKU: {selectedItem.itemCode}
          </span>
        )}
      </div>

      {helperText && <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>}

      {/* Main Trigger Box */}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpenDropdown}
          disabled={isLoading || items.length === 0}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer shadow-2xs ${
            isOpen
              ? 'border-indigo-600 ring-2 ring-indigo-500/15 bg-white'
              : 'border-slate-300 hover:border-slate-400 bg-white'
          }`}
        >
          {selectedItem ? (
            <div className="flex items-center space-x-3 truncate">
              <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white shrink-0 shadow-2xs">
                {selectedItem.itemCode}
              </span>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate leading-snug">
                  {selectedItem.itemName}
                </p>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-600">{selectedItem.category}</span>
                  {showWarehouseStock && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={
                          (selectedItem.warehouseQty ?? 0) <= (selectedItem.lowStockThreshold || 5)
                            ? 'text-rose-600 font-bold'
                            : 'text-emerald-700 font-bold'
                        }
                      >
                        Warehouse Stock: {selectedItem.warehouseQty ?? 0} {selectedItem.unit}
                      </span>
                    </>
                  )}
                  {showTechStock && techStockMap && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-indigo-700 font-bold">
                        Technician Held: {techStockMap[selectedItem._id] ?? 0} {selectedItem.unit}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-slate-400 text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <span>
                {isLoading
                  ? 'Loading parts catalog...'
                  : 'Search by item code (e.g. PUR-RO, GBRC) or part name...'}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-1.5 shrink-0 ml-2 text-slate-400">
            <span className="text-[10px] hidden sm:inline bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-medium border border-slate-200">
              Click to select
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'
              }`}
            />
          </div>
        </button>

        {/* Dropdown Popover with Code Search & Filters */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input Bar */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Enter item code (e.g. PUR, MEM, GBRC), part name, or purifier model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition font-medium text-slate-900"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Fast Category Filter Chips */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Category:
                </span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-lg font-bold shrink-0 transition cursor-pointer text-[10px] ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 5 Most Recently Used Items Quick Bar (shown when no search query is active) */}
            {!searchQuery.trim() && selectedCategory === 'ALL' && recentItems.length > 0 && (
              <div className="p-2.5 bg-indigo-50/70 border-b border-indigo-100 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-indigo-900 uppercase tracking-wider px-1">
                  <span className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                    Recently Used Parts
                  </span>
                  <span className="text-indigo-400 font-normal lowercase">top 5</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentItems.map((rItem) => (
                    <button
                      key={'recent_' + rItem._id}
                      type="button"
                      onClick={() => handleSelect(rItem)}
                      className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white text-slate-800 transition shadow-2xs cursor-pointer group"
                    >
                      <span className="font-mono text-[10px] font-bold text-indigo-600 group-hover:text-white mr-1.5">
                        {rItem.itemCode}
                      </span>
                      <span className="truncate max-w-[130px] text-[11px]">{rItem.itemName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Item List Results */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700">No matching parts found</p>
                  <p className="text-[11px] text-slate-400">
                    No results for &quot;{searchQuery}&quot;. Check spelling or clear category filters.
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item._id === selectedItemId;
                  const warehouseStock = item.warehouseQty ?? 0;
                  const isLow = warehouseStock <= (item.lowStockThreshold || 5);

                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition cursor-pointer group ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-950 font-medium border border-indigo-200/60'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        {/* Item Code Badge */}
                        <span
                          className={`font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white'
                          } transition-colors`}
                        >
                          {item.itemCode}
                        </span>

                        <div className="truncate">
                          <p className="text-xs font-bold truncate leading-tight text-slate-900">
                            {item.itemName}
                          </p>
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-600">{item.category}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Box MRP: ₹{((item.newPrice || item.price) || 0).toLocaleString('en-IN')}
                            </span>
                            <span className="font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              Portal: ₹{((item.oldPrice || item.price) || 0).toLocaleString('en-IN')}
                            </span>
                            {item.newPrice && item.oldPrice && item.newPrice !== item.oldPrice && (
                              <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1 py-0.2 rounded border border-amber-200">
                                {item.newPrice > item.oldPrice ? `+₹${item.newPrice - item.oldPrice}` : `-₹${item.oldPrice - item.newPrice}`}
                              </span>
                            )}
                            {item.compatibleModels && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="truncate max-w-[150px] text-slate-400">
                                  {item.compatibleModels}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 ml-2">
                        {showWarehouseStock && (
                          <div className="text-right">
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                                isLow
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {warehouseStock} {item.unit}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-medium">warehouse</span>
                          </div>
                        )}

                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 px-3.5">
              <span>Showing <strong>{filteredItems.length}</strong> of {items.length} catalog items</span>
              <span className="font-mono text-[10px] text-indigo-600 font-semibold">Live SKU search active</span>
            </div>
          </div>
        )}

        {/* Selected Item Dual-Price Notification Banner */}
        {selectedItem && (
          <div className="mt-2 p-2 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-500">Dual Pricing:</span>
              <PriceBadge item={selectedItem} variant="pill" showDiff={true} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">AO Smith Portal vs Box MRP</span>
          </div>
        )}
      </div>
    </div>
  );
};
