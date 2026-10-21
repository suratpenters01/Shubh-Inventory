import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { itemApi } from '../services/api';
import { IItem } from '../types';
import { copyTextToClipboard } from '../utils/clipboard';
import { isPartCompatibleWithModel } from '../constants/stock';
import { PriceBadge } from '../components/common/PriceBadge';
import {
  Search,
  Layers,
  Sparkles,
  ArrowDownToLine,
  Send,
  Download,
  CheckCircle2,
  Filter,
  Copy,
  Check,
  Package,
  Wrench,
  Grid3X3,
  List,
  Cpu,
  ArrowRight,
} from 'lucide-react';

export const CompatibilityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<IItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const initialCode = searchParams.get('code') || '';
  const [search, setSearch] = useState(initialCode);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'byKit' | 'byModel' | 'matrix'>('byKit');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setSearch(codeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setIsLoading(true);
        const data = await itemApi.getItems();
        setItems(data);
      } catch (err) {
        console.error('Failed to load items', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Parse distinct models and their required kits for reverse lookup
  const modelsMap = useMemo(() => {
    const rawModelSet = new Set<string>();

    items.forEach((item) => {
      if (!item.compatibleModels) return;
      item.compatibleModels
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
        .forEach((m) => {
          // Exclude generic phrases from model names list
          const lower = m.toLowerCase();
          if (!lower.includes('all standard') && !lower.includes('all new ro') && !lower.includes('all models') && !lower.includes('universal')) {
            rawModelSet.add(m);
          }
        });
    });

    const map = new Map<string, IItem[]>();
    rawModelSet.forEach((modelName) => {
      const compatibleKits = items.filter((item) => isPartCompatibleWithModel(item.compatibleModels, modelName));
      map.set(modelName, compatibleKits);
    });

    return map;
  }, [items]);

  const allModelNames = useMemo(() => {
    return Array.from(modelsMap.keys()).sort((a, b) => a.localeCompare(b));
  }, [modelsMap]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ['all', ...Array.from(set)];
  }, [items]);

  // Filtered kits for Tab 1 (byKit)
  const filteredKits = useMemo(() => {
    return items.filter((item) => {
      const q = search.trim().toLowerCase();
      const codeMatches = item.itemCode.toLowerCase().includes(q);
      const nameMatches = item.itemName.toLowerCase().includes(q);
      const modelsMatches = (item.compatibleModels || '').toLowerCase().includes(q);
      const catMatches = item.category.toLowerCase().includes(q);
      const gkkMatches = (item.gkkType || '').toLowerCase().includes(q);

      const matchesSearch = !q || codeMatches || nameMatches || modelsMatches || catMatches || gkkMatches;
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, search, selectedCategory]);

  // Filtered models for Tab 2 (byModel)
  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allModelNames;

    return allModelNames.filter((modelName) => {
      const nameMatches = modelName.toLowerCase().includes(q);
      const kits = modelsMap.get(modelName) || [];
      const kitMatches = kits.some(
        (k) =>
          k.itemCode.toLowerCase().includes(q) ||
          k.itemName.toLowerCase().includes(q) ||
          k.category.toLowerCase().includes(q)
      );
      return nameMatches || kitMatches;
    });
  }, [allModelNames, modelsMap, search]);

  // Copy code handler with fallback
  const handleCopyCode = async (code: string) => {
    await copyTextToClipboard(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  // Export Compatibility Matrix as CSV
  const handleExportCSV = () => {
    const headers = [
      'Kit Code',
      'Kit Name',
      'Category',
      'Kit Type',
      'MRP (INR)',
      'Total Compatible Models',
      'Compatible Purifier Models',
      'Current Warehouse Stock',
      'Unit',
    ];

    const rows = items.map((item) => {
      const models = item.compatibleModels
        ? item.compatibleModels.split(',').map((m) => m.trim())
        : [];
      return [
        `"${item.itemCode}"`,
        `"${item.itemName.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        `"${item.gkkType || ''}"`,
        item.price,
        models.length,
        `"${models.join('; ')}"`,
        item.warehouseQty ?? 0,
        `"${item.unit}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pureit_Kit_Model_Compatibility_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const highlightText = (text: string, q: string) => {
    if (!q.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <span key={i} className="bg-amber-200 text-zinc-950 font-bold px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                Kit &amp; Model Compatibility Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Check exactly which kit code fits into how many Pureit models, or reverse lookup kits by purifier model
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer shadow-xs active:scale-95"
            title="Download CSV of all kit compatibility"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-300" />
            Export Excel/CSV
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Kit Codes</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 font-mono tabular-nums">{items.length}</p>
          <span className="text-[11px] text-slate-400 font-medium">Pureit filter &amp; spare codes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Purifier Models</span>
          <p className="text-2xl font-extrabold text-sky-700 mt-1 font-mono tabular-nums">{allModelNames.length}</p>
          <span className="text-[11px] text-slate-400 font-medium">Unique models mapped</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">One Kit Series</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {items.filter((i) => i.category === 'One Kit').length}
          </p>
          <span className="text-[11px] text-zinc-400">Single integrated kits</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-xs font-medium text-zinc-500">GKK 1 &amp; GKK 2 Kits</span>
          <p className="text-2xl font-bold text-purple-700 mt-1">
            {items.filter((i) => i.category === 'GKK1' || i.category === 'GKK2').length}
          </p>
          <span className="text-[11px] text-zinc-400">Multi-stage filter sets</span>
        </div>
      </div>

      {/* Main Search & Mode Selector */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-3" />
          <input
            id="compatibility-search-input"
            type="text"
            placeholder="Type Kit Code (e.g. GBRC200, GCUV400, SXGS100) or Model Name (e.g. Marvella, Revito, Copper)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (searchParams.get('code')) {
                setSearchParams({});
              }
            }}
            className="w-full pl-10 pr-10 py-2.5 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setSearchParams({});
              }}
              className="absolute right-3 top-3 text-xs font-semibold text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Clickable Kit Codes Strip */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-zinc-400 text-[11px] font-medium shrink-0 flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Click Code:
          </span>
          {items.map((item) => (
            <button
              key={item._id}
              onClick={() => setSearch(item.itemCode)}
              className={`px-2 py-0.5 font-mono text-[11px] font-bold rounded shrink-0 transition cursor-pointer border ${
                search.toUpperCase() === item.itemCode.toUpperCase()
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
              }`}
            >
              {item.itemCode}
            </button>
          ))}
        </div>

        {/* Tab Selection & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center space-x-1.5 bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
            <button
              id="tab-by-kit"
              onClick={() => setActiveTab('byKit')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center ${
                activeTab === 'byKit' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 mr-1.5" />
              Kit Code → Compatible Models ({filteredKits.length})
            </button>
            <button
              id="tab-by-model"
              onClick={() => setActiveTab('byModel')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center ${
                activeTab === 'byModel' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Purifier Model → Required Kits ({filteredModels.length})
            </button>
            <button
              id="tab-matrix"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center ${
                activeTab === 'matrix' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <List className="w-3.5 h-3.5 mr-1.5 text-zinc-600" />
              Full Matrix Table
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400 mr-1 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md capitalize transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: Kit Code -> Models Breakdown */}
      {activeTab === 'byKit' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-zinc-400 bg-white rounded-xl border border-zinc-200">
              Loading compatibility directory...
            </div>
          ) : filteredKits.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 bg-white rounded-xl border border-zinc-200">
              No kit codes found matching "{search}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKits.map((item) => {
                const models = item.compatibleModels
                  ? item.compatibleModels.split(',').map((m) => m.trim())
                  : [];
                const modelCount = models.length;

                return (
                  <div
                    key={item._id}
                    className="bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 p-5 shadow-xs flex flex-col justify-between space-y-4 transition"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm font-extrabold bg-zinc-900 text-white px-2.5 py-1 rounded-md shadow-2xs tracking-wide">
                            {highlightText(item.itemCode, search)}
                          </span>
                          <button
                            onClick={() => handleCopyCode(item.itemCode)}
                            title="Copy Kit Code"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                          >
                            {copiedCode === item.itemCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Fits in {modelCount} {modelCount === 1 ? 'Model' : 'Models'}
                        </span>
                      </div>

                      {/* Item Name & Details */}
                      <h3 className="text-sm font-bold text-zinc-900 leading-snug">
                        {highlightText(item.itemName, search)}
                      </h3>

                      {/* Dual Price Highlight Strip */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                        <PriceBadge item={item} variant="pill" showDiff={true} />
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            (item.warehouseQty ?? 0) > 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                          }`}
                        >
                          Stock: {item.warehouseQty ?? 0} {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Compatible Models List */}
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 space-y-2">
                      <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center">
                        <Layers className="w-3 h-3 mr-1 text-indigo-600" />
                        Compatible Pureit Models ({modelCount}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {models.map((m, idx) => (
                          <span
                            key={idx}
                            onClick={() => setSearch(m)}
                            title={`Click to filter by ${m}`}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white text-zinc-800 border border-zinc-200 hover:border-zinc-400 transition cursor-pointer shadow-2xs"
                          >
                            {highlightText(m, search)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setActiveTab('byModel');
                          setSearch(models[0] || '');
                        }}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold flex items-center cursor-pointer"
                      >
                        Explore model kits <ArrowRight className="w-3 h-3 ml-1" />
                      </button>

                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/purchase?itemId=${item._id}`}
                          className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold transition"
                        >
                          + Add Stock
                        </Link>
                        <Link
                          to={`/issue?itemId=${item._id}`}
                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition"
                        >
                          Issue
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Purifier Model -> Required Kits (Reverse Lookup) */}
      {activeTab === 'byModel' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Reverse Model Lookup:</span> Choose or search any Pureit purifier model to see every required filter kit, GKK 1, GKK 2, or Sediment filter candle needed for servicing that model!
            </div>
          </div>

          {filteredModels.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 bg-white rounded-xl border border-zinc-200">
              No purifier models found matching "{search}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((modelName) => {
                const requiredKits = modelsMap.get(modelName) || [];

                return (
                  <div
                    key={modelName}
                    className="bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 p-5 shadow-xs flex flex-col justify-between space-y-3.5 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          Water Purifier Model
                        </span>
                        <span className="text-xs font-semibold text-zinc-500">
                          {requiredKits.length} {requiredKits.length === 1 ? 'Kit' : 'Kits'} Mapped
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-zinc-900">
                        {highlightText(modelName, search)}
                      </h3>
                    </div>

                    {/* Required Kits List */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-semibold text-zinc-500">
                        Required Filters &amp; Kits for this model:
                      </p>

                      <div className="space-y-1.5">
                        {requiredKits.map((kit) => (
                          <div
                            key={kit._id}
                            className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-white shrink-0">
                                  {kit.itemCode}
                                </span>
                                <span className="text-xs font-bold text-zinc-900 truncate">
                                  {kit.itemName}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center space-x-2">
                                <PriceBadge item={kit} variant="pill" showDiff={true} />
                              </div>
                            </div>

                            <Link
                              to={`/purchase?itemId=${kit._id}`}
                              className="px-2 py-1 bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-[11px] font-semibold rounded shrink-0 transition"
                            >
                              + Stock
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Full Comparison Matrix Table */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Complete Pureit Compatibility Matrix</h3>
            <span className="text-xs text-zinc-500">{filteredKits.length} kits listed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Kit Code</th>
                  <th className="py-3 px-4">Kit Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Models Count</th>
                  <th className="py-3 px-4">Compatible Purifier Models</th>
                  <th className="py-3 px-4 text-right">MRP (₹)</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredKits.map((item) => {
                  const models = item.compatibleModels
                    ? item.compatibleModels.split(',').map((m) => m.trim())
                    : [];

                  return (
                    <tr key={item._id} className="hover:bg-zinc-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {highlightText(item.itemCode, search)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-800 max-w-xs">
                        {highlightText(item.itemName, search)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded font-medium text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {models.length} models
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {models.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded text-[10px] font-medium"
                            >
                              {highlightText(m, search)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-zinc-900 whitespace-nowrap">
                        ₹{(item.price || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            (item.warehouseQty ?? 0) > 0 ? 'text-emerald-700' : 'text-zinc-400'
                          }`}
                        >
                          {item.warehouseQty ?? 0} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Link
                          to={`/purchase?itemId=${item._id}`}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 rounded transition"
                        >
                          + Stock
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
