import React, { useState, useEffect, useMemo } from 'react';
import { stockApi, itemApi, technicianApi } from '../services/api';
import { IStockTransaction, IItem, IUser, TransactionType } from '../types';
import { TransactionTypeBadge } from '../components/common/Badge';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import {
  ScrollText,
  Filter,
  Search,
  Calendar,
  User,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Check,
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardCheck,
  RotateCcw,
  HelpCircle,
  X,
  FileText,
} from 'lucide-react';
import { exportLedgerToCsv } from '../utils/csvExport';

export const LedgerPage: React.FC = () => {
  const [transactions, setTransactions] = useState<IStockTransaction[]>([]);
  const [items, setItems] = useState<IItem[]>([]);
  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Category Tab: ALL | INWARD | ISSUE | USAGE | RETURN
  const [activeTab, setActiveTab] = useState<'ALL' | 'INWARD' | 'ISSUE' | 'USAGE' | 'RETURN'>('ALL');

  // Filters
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const fetchFilters = async () => {
    try {
      const [itemsData, techsData] = await Promise.all([
        itemApi.getItems(),
        technicianApi.getTechnicians(),
      ]);
      setItems(itemsData);
      setTechnicians(techsData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLedger = async () => {
    try {
      setIsLoading(true);
      const data = await stockApi.getLedger({
        itemId: selectedItemId || undefined,
        technicianId: selectedTechId || undefined,
        limit: 500,
      });
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load ledger', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [selectedItemId, selectedTechId]);

  // Tab to TransactionType mapping
  const matchesTab = (txType: TransactionType): boolean => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'INWARD') return txType === 'PURCHASE_IN';
    if (activeTab === 'ISSUE') return txType === 'ISSUE_TO_TECH';
    if (activeTab === 'USAGE') return txType === 'USAGE_AT_SITE';
    if (activeTab === 'RETURN') return txType === 'RETURN_TO_WAREHOUSE';
    return true;
  };

  // Date filtering logic
  const matchesDate = (txDateStr: string): boolean => {
    if (dateRangePreset === 'all') return true;
    const txTime = new Date(txDateStr).getTime();
    const now = new Date();

    if (dateRangePreset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return txTime >= todayStart;
    }

    if (dateRangePreset === '7days') {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return txTime >= sevenDaysAgo;
    }

    if (dateRangePreset === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return txTime >= monthStart;
    }

    if (dateRangePreset === 'custom') {
      if (customFromDate) {
        const from = new Date(customFromDate).getTime();
        if (txTime < from) return false;
      }
      if (customToDate) {
        const to = new Date(customToDate).getTime() + 24 * 60 * 60 * 1000;
        if (txTime > to) return false;
      }
      return true;
    }

    return true;
  };

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Tab check
      if (!matchesTab(tx.transactionType)) return false;

      // 2. Date check
      if (!matchesDate(tx.transactionDate)) return false;

      // 3. Search query check (Code, Name, Tech, Site, Invoice, Ticket, Remarks)
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const item = typeof tx.item === 'object' ? tx.item : null;
      const tech = typeof tx.technician === 'object' ? tx.technician : null;

      return (
        (item?.itemCode.toLowerCase().includes(s) ?? false) ||
        (item?.itemName.toLowerCase().includes(s) ?? false) ||
        (tech?.name.toLowerCase().includes(s) ?? false) ||
        (tx.siteName?.toLowerCase().includes(s) ?? false) ||
        (tx.jobReference?.toLowerCase().includes(s) ?? false) ||
        (tx.invoiceNumber?.toLowerCase().includes(s) ?? false) ||
        (tx.supplierName?.toLowerCase().includes(s) ?? false) ||
        (tx.remarks?.toLowerCase().includes(s) ?? false)
      );
    });
  }, [transactions, activeTab, dateRangePreset, customFromDate, customToDate, search]);

  // Aggregate KPI Calculations
  const stats = useMemo(() => {
    let totalInward = 0;
    let totalIssued = 0;
    let totalConsumed = 0;
    let totalReturned = 0;

    transactions.forEach((tx) => {
      if (tx.transactionType === 'PURCHASE_IN') totalInward += tx.quantity;
      if (tx.transactionType === 'ISSUE_TO_TECH') totalIssued += tx.quantity;
      if (tx.transactionType === 'USAGE_AT_SITE') totalConsumed += tx.quantity;
      if (tx.transactionType === 'RETURN_TO_WAREHOUSE') totalReturned += tx.quantity;
    });

    return { totalInward, totalIssued, totalConsumed, totalReturned };
  }, [transactions]);

  const handleExportFiltered = () => {
    exportLedgerToCsv(filtered, filtered.length === transactions.length ? 'all' : 'filtered');
    setExportFeedback(`✓ Exported ${filtered.length} ledger transactions to CSV!`);
    setTimeout(() => setExportFeedback(null), 3500);
  };

  const handleExportAll = () => {
    exportLedgerToCsv(transactions, 'full_audit');
    setExportFeedback(`✓ Exported entire ledger (${transactions.length} records) to CSV!`);
    setTimeout(() => setExportFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                Aawak-Jaawak Movement Ledger
              </h2>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/80 flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                Zero-Loophole Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Complete date-wise register of every spare part inward (+IN) and outward (-OUT) movement with CSV exports.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 rounded-xl transition cursor-pointer border border-slate-200/70"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Guide (User Manual)
          </button>

          {filtered.length !== transactions.length && (
            <button
              type="button"
              id="export-all-ledger-btn"
              onClick={handleExportAll}
              title="Export all unfiltered ledger transactions"
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 rounded-xl transition cursor-pointer border border-slate-200/70"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
              Full Ledger ({transactions.length})
            </button>
          )}

          <button
            type="button"
            id="export-ledger-csv-btn"
            onClick={handleExportFiltered}
            title="Export transactions to CSV file for external audit"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition cursor-pointer shadow-md shadow-sky-600/25 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-sky-200" />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {exportFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between">
          <span>{exportFeedback}</span>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="font-bold text-emerald-800 hover:text-emerald-950 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Movement Summary Cards (Inward vs Outward) with colored accent borders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold flex items-center text-slate-700">
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Total Inward (+ Aaya)
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-emerald-700">
            +{stats.totalInward} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Warehouse inward receipts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-t-4 border-t-indigo-500 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold flex items-center text-slate-700">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Issued to Tech
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-indigo-700">
            {stats.totalIssued} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Technician kit replenishment</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-t-4 border-t-amber-500 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold flex items-center text-slate-700">
              <ClipboardCheck className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Site Consumed
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-amber-700">
            {stats.totalConsumed} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Installed in customer purifiers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-t-4 border-t-teal-500 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold flex items-center text-slate-700">
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-teal-600" />
              Returned Stock
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-teal-700">
            +{stats.totalReturned} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Returned by technicians to warehouse</span>
        </div>
      </div>

      {/* Movement Category Segmented Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Movements
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INWARD')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer shrink-0 flex items-center ${
            activeTab === 'INWARD'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50'
          }`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          Stock Inward (+ Inward)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ISSUE')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer shrink-0 flex items-center ${
            activeTab === 'ISSUE'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          Issued to Tech (→ Outward)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('USAGE')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer shrink-0 flex items-center ${
            activeTab === 'USAGE'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
          Site Usage (✓ Installed)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RETURN')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer shrink-0 flex items-center ${
            activeTab === 'RETURN'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-teal-50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-teal-300" />
          Returns (⟲ Returned)
        </button>
      </div>

      {/* Date & Search Filters Panel in Inglish */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* SKU Code & Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Item code (e.g. PUR-01), Model, Tech, Site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white text-slate-900 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Presets */}
          <div>
            <select
              value={dateRangePreset}
              onChange={(e: any) => setDateRangePreset(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white font-semibold text-slate-800"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Item Filter by Dropdown */}
          <div>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white font-medium text-slate-800"
            >
              <option value="">All Spares &amp; Kits</option>
              {items.map((i) => (
                <option key={i._id} value={i._id}>
                  [{i.itemCode}] {i.itemName}
                </option>
              ))}
            </select>
          </div>

          {/* Technician Filter */}
          <div>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white font-medium text-slate-800"
            >
              <option value="">All Field Technicians</option>
              {technicians.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (Shown if "custom" selected) */}
        {dateRangePreset === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">Select Date Range:</span>
            <div className="flex items-center space-x-2">
              <label className="text-slate-500 font-medium">From:</label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-slate-500 font-medium">To:</label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
              />
            </div>
            {(customFromDate || customToDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomFromDate('');
                  setCustomToDate('');
                }}
                className="text-indigo-600 hover:text-indigo-900 underline text-xs font-semibold"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Total <strong className="text-slate-900 font-bold">{filtered.length}</strong> recorded movements found
          </span>
          {(search || selectedItemId || selectedTechId || dateRangePreset !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedItemId('');
                setSelectedTechId('');
                setDateRangePreset('all');
                setCustomFromDate('');
                setCustomToDate('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
            >
              Reset All Filters (Clear)
            </button>
          )}
        </div>
      </div>

      {/* Date-wise Movements Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
              <tr>
                <th className="py-3 px-4">Date &amp; Time (Taarikh)</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Item Code &amp; Name</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Party / Tech / Site</th>
                <th className="py-3 px-4">Bill / Ticket Reference</th>
                <th className="py-3 px-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-medium">Loading ledger entries...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-1">
                    <p className="font-bold text-slate-700">No records found</p>
                    <p className="text-[11px] text-slate-400">
                      No transactions match the selected filters or search query. Try resetting filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const item = typeof tx.item === 'object' ? tx.item : null;
                  const tech = typeof tx.technician === 'object' ? tx.technician : null;
                  const performer = typeof tx.performedBy === 'object' ? tx.performedBy : null;

                  const isInward =
                    tx.transactionType === 'PURCHASE_IN' ||
                    tx.transactionType === 'RETURN_TO_WAREHOUSE';

                  return (
                    <tr key={tx._id} className="hover:bg-slate-50/80 transition">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <p className="font-bold text-slate-900">
                          {new Date(tx.transactionDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-sans">
                          {new Date(tx.transactionDate).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>

                      {/* Movement Type Badge */}
                      <td className="py-3.5 px-4">
                        <TransactionTypeBadge type={tx.transactionType} />
                      </td>

                      {/* Item Code & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-white shrink-0">
                            {item?.itemCode || 'SKU'}
                          </span>
                          <span className="font-bold text-slate-900">
                            {item?.itemName || 'Item'}
                          </span>
                        </div>
                        {item?.category && (
                          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                            Category: {item.category}
                          </span>
                        )}
                      </td>

                      {/* Quantity with Clean Bold +/- Color */}
                      <td className="py-3.5 px-4 text-right font-bold text-sm">
                        <span
                          className={`px-2.5 py-0.5 rounded-md inline-block font-mono ${
                            tx.transactionType === 'PURCHASE_IN'
                              ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                              : tx.transactionType === 'RETURN_TO_WAREHOUSE'
                              ? 'text-teal-800 bg-teal-50 border border-teal-200'
                              : tx.transactionType === 'ISSUE_TO_TECH'
                              ? 'text-indigo-800 bg-indigo-50 border border-indigo-200'
                              : 'text-amber-800 bg-amber-50 border border-amber-200'
                          }`}
                        >
                          {isInward ? '+' : '-'}
                          {tx.quantity} {item?.unit || 'pcs'}
                        </span>
                      </td>

                      {/* Custody / Destination */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                        {tx.transactionType === 'PURCHASE_IN' && (
                          <div>
                            <span className="text-slate-400 font-medium text-[11px]">Kahan Se Aaya:</span>{' '}
                            <span className="font-bold text-emerald-950">
                              {tx.supplierName &&
                              tx.supplierName !== 'Direct Supplier' &&
                              tx.supplierName !== 'Direct Inward'
                                ? tx.supplierName
                                : 'Direct Warehouse Inward'}
                            </span>
                          </div>
                        )}
                        {tx.transactionType === 'ISSUE_TO_TECH' && (
                          <div>
                            <span className="text-slate-400 font-medium text-[11px]">Technician:</span>{' '}
                            <span className="font-bold text-indigo-900">
                              {tech?.name || 'Field Technician'}
                            </span>
                          </div>
                        )}
                        {tx.transactionType === 'USAGE_AT_SITE' && (
                          <div>
                            <span className="text-slate-400 font-medium text-[11px]">Usage Ref:</span>{' '}
                            <span className="font-bold text-slate-900">{tx.siteName || (tx.jobReference ? `Case #${tx.jobReference}` : 'On-Site Service')}</span>
                            {tech && (
                              <p className="text-[10px] text-slate-400 font-medium">Technician: {tech.name}</p>
                            )}
                          </div>
                        )}
                        {tx.transactionType === 'RETURN_TO_WAREHOUSE' && (
                          <div>
                            <span className="text-slate-400 font-medium text-[11px]">Returned by:</span>{' '}
                            <span className="font-bold text-teal-900">
                              {tech?.name || 'Technician'}
                            </span>
                          </div>
                        )}
                        {tx.transactionType === 'DAMAGE_WRITEOFF' && (
                          <span className="text-rose-700 font-bold">
                            {tx.reason || 'Damaged stock write-off'}
                          </span>
                        )}
                      </td>

                      {/* Reference / Invoice / Ticket */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {tx.jobReference && (
                          <p className="font-mono text-[11px] font-bold text-indigo-700">
                            {tx.transactionType === 'USAGE_AT_SITE' ? `Case ID: ${tx.jobReference}` : `Ticket: ${tx.jobReference}`}
                          </p>
                        )}
                        {tx.invoiceNumber && (
                          <p className="font-mono text-[11px] text-slate-800 font-semibold">
                            Bill: {tx.invoiceNumber}
                          </p>
                        )}
                        {tx.remarks && (
                          <p className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            &quot;{tx.remarks}&quot;
                          </p>
                        )}
                        {!tx.jobReference && !tx.invoiceNumber && !tx.remarks && '—'}
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-semibold text-slate-800">
                            {performer?.name || 'System Admin'}
                          </span>
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

      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
