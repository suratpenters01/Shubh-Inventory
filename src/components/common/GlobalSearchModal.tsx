import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemApi } from '../../services/api';
import { IItem } from '../../types';
import { PriceBadge } from './PriceBadge';
import { PriceManagerModal } from '../items/PriceManagerModal';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  X,
  ArrowRight,
  Package,
  Layers,
  ArrowDownToLine,
  Send,
  Sparkles,
  ExternalLink,
  Tag,
  Edit2,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const QUICK_CODES = [
  'GBRC200',
  'GBRD200',
  'GPRB500',
  'GPRA500',
  'GCRX200',
  'GCUV400',
  'GEAS100',
  'RGKK100',
  'SXGS100',
  'WRDR200',
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<IItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingPriceItem, setEditingPriceItem] = useState<IItem | null>(null);
  const [isBulkPriceOpen, setIsBulkPriceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadItems = () => {
    setIsLoading(true);
    itemApi
      .getItems()
      .then((res) => setItems(res))
      .catch((err) => console.error('Failed to load items for search', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Load all catalog items if not loaded yet
      if (items.length === 0) {
        loadItems();
      }
    }
  }, [isOpen, initialQuery]);

  // Hardcore search logic
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return items.slice(0, 8); // show top 8 items initially
    }

    const q = query.trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);

    return items
      .map((item) => {
        const code = item.itemCode.toLowerCase();
        const name = item.itemName.toLowerCase();
        const models = (item.compatibleModels || '').toLowerCase();
        const category = item.category.toLowerCase();
        const gkkType = (item.gkkType || '').toLowerCase();

        let score = 0;

        // Exact code match = highest score
        if (code === q) score += 100;
        else if (code.startsWith(q)) score += 60;
        else if (code.includes(q)) score += 40;

        // Model match = high score
        if (models.includes(q)) score += 50;

        // Name match
        if (name.includes(q)) score += 30;

        // Category / GKK type match
        if (category.includes(q) || gkkType.includes(q)) score += 25;

        // Multi-token match
        const allMatched = qTokens.every(
          (token) =>
            code.includes(token) ||
            name.includes(token) ||
            models.includes(token) ||
            category.includes(token)
        );

        if (allMatched) score += 20;

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }, [items, query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        if (searchResults[selectedIndex]) {
          e.preventDefault();
          handleSelect(searchResults[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex]);

  const handleSelect = (item: IItem) => {
    onClose();
    navigate(`/compatibility?code=${encodeURIComponent(item.itemCode)}`);
  };

  const highlightMatch = (text: string, searchVal: string) => {
    if (!searchVal.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchVal.toLowerCase() ? (
        <span key={i} className="bg-amber-200 text-zinc-950 font-bold px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search SKU (e.g. GBRC200) or Purifier Model (e.g. Marvella, Revito)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
            ESC
          </span>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <span className="text-slate-400 font-bold shrink-0 flex items-center text-[10px] uppercase tracking-wider">
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Quick Codes:
          </span>
          {QUICK_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setQuery(code)}
              className="px-2 py-0.5 font-mono font-bold text-[10px] rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0 transition cursor-pointer shadow-2xs"
            >
              {code}
            </button>
          ))}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsBulkPriceOpen(true)}
              className="px-2.5 py-0.5 font-bold text-[10px] rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 transition cursor-pointer shadow-2xs ml-auto flex items-center"
              title="Bulk update AO Smith Portal Price and Box MRP for all kits"
            >
              <Sparkles className="w-2.5 h-2.5 mr-1 text-emerald-600" />
              ⚡ Update All Kit Prices
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">Loading catalog items...</div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">No items found matching "{query}"</p>
              <p className="text-slate-400">Try searching for code like GBR, GCU, SXG or model Revito, Marvella.</p>
            </div>
          ) : (
            searchResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const modelsList = item.compatibleModels
                ? item.compatibleModels.split(',').map((m) => m.trim())
                : [];

              return (
                <div
                  key={item._id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl transition cursor-pointer flex flex-col space-y-2 ${
                    isSelected ? 'bg-sky-50/70 border border-sky-200/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-2xs">
                        {highlightMatch(item.itemCode, query)}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">
                        {highlightMatch(item.itemName, query)}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <PriceBadge item={item} variant="pill" showDiff={true} />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          (item.warehouseQty ?? 0) > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        Stock: {item.warehouseQty ?? 0} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Dual Price Quick Explainer Banner */}
                  <div className="bg-emerald-50/40 border border-emerald-200/60 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                          🏷️ Box Printed MRP (Tech Charge):
                        </span>
                        <span className="text-xs font-extrabold font-mono text-emerald-900">
                          ₹{((item.newPrice || item.price) || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] uppercase font-medium text-slate-500 block">
                          💻 AO Smith Portal (Old Rate):
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-700">
                          ₹{((item.oldPrice || item.price) || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {item.newPrice && item.oldPrice && item.newPrice !== item.oldPrice && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                        Diff: +₹{Math.abs(item.newPrice - item.oldPrice)}
                      </span>
                    )}
                  </div>

                  {/* Compatible Models Breakdown */}
                  <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between font-bold text-slate-500 mb-1.5">
                      <span className="flex items-center">
                        <Layers className="w-3 h-3 mr-1 text-sky-600" />
                        Fits in {modelsList.length} Pureit Models:
                      </span>
                      <span className="text-[10px] text-sky-600 hover:underline flex items-center font-bold">
                        View compatibility matrix <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {modelsList.map((model, mIdx) => (
                        <span
                          key={mIdx}
                          className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200/60"
                        >
                          {highlightMatch(model, query)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center justify-end space-x-2 pt-1 text-[11px]">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPriceItem(item);
                        }}
                        className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg font-bold transition cursor-pointer flex items-center"
                        title="Update Portal Price and Box MRP for this kit"
                      >
                        <Edit2 className="w-3 h-3 mr-1 text-amber-600" />
                        Edit Price
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        navigate(`/purchase?itemId=${item._id}`);
                      }}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg font-bold transition cursor-pointer flex items-center"
                    >
                      <ArrowDownToLine className="w-3 h-3 mr-1" />
                      + Add Stock
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        navigate(`/issue?itemId=${item._id}`);
                      }}
                      className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60 rounded-lg font-bold transition cursor-pointer flex items-center"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Issue Stock
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span>
              Use <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">↓</kbd> to navigate
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Enter</kbd> to select
            </span>
          </div>
          <button
            onClick={() => {
              onClose();
              navigate('/compatibility');
            }}
            className="text-sky-600 hover:underline font-bold flex items-center cursor-pointer"
          >
            Open Full Compatibility Directory <ExternalLink className="w-3 h-3 ml-1" />
          </button>
        </div>
      </div>

      {/* Single Item Price Edit Modal */}
      {editingPriceItem && (
        <PriceManagerModal
          isOpen={Boolean(editingPriceItem)}
          onClose={() => setEditingPriceItem(null)}
          singleItem={editingPriceItem}
          items={items}
          onPricesUpdated={loadItems}
        />
      )}

      {/* Bulk Price Manager Modal across all kits */}
      {isBulkPriceOpen && (
        <PriceManagerModal
          isOpen={isBulkPriceOpen}
          onClose={() => setIsBulkPriceOpen(false)}
          items={items}
          onPricesUpdated={loadItems}
        />
      )}
    </div>
  );
};
