import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { itemApi, technicianApi, stockApi } from '../services/api';
import { IItem, IUser, IStockTransaction } from '../types';
import { Modal } from '../components/common/Modal';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import { LAST_TECH_STORAGE_KEY } from '../constants/stock';
import {
  Scale,
  User,
  Plus,
  RotateCcw,
  CheckCheck,
  Package,
  ArrowUpRight,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Download,
  Tag,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';

export const StockCyclePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [items, setItems] = useState<IItem[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Cycle data
  const [techBalancesMap, setTechBalancesMap] = useState<Record<string, number>>({});
  const [cycleIssues, setCycleIssues] = useState<IStockTransaction[]>([]);
  const [cycleUsages, setCycleUsages] = useState<IStockTransaction[]>([]);
  const [cycleReturns, setCycleReturns] = useState<IStockTransaction[]>([]);

  // Active view tab in the page
  const [activeTab, setActiveTab] = useState<'bag' | 'issued' | 'usages' | 'returns'>('bag');

  // Settlement & Statement Modals
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementOption, setSettlementOption] = useState<'retain' | 'return_all'>('retain');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [settlementSuccess, setSettlementSuccess] = useState<string | null>(null);

  const [showStatementModal, setShowStatementModal] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Return single item modal / action
  const [returningItem, setReturningItem] = useState<{ item: IItem; maxQty: number } | null>(null);
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('Unused / Surplus Stock Return');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState<string | null>(null);

  // Load Technicians & Items
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const [techRes, itemRes] = await Promise.all([
          technicianApi.getTechnicians(),
          itemApi.getItems(),
        ]);
        setTechnicians(techRes);
        setItems(itemRes);

        const urlTechId = searchParams.get('techId');
        const lastTechId = localStorage.getItem(LAST_TECH_STORAGE_KEY);
        const validId =
          urlTechId && techRes.some((t: IUser) => t._id === urlTechId)
            ? urlTechId
            : lastTechId && techRes.some((t: IUser) => t._id === lastTechId)
            ? lastTechId
            : techRes[0]?._id || '';

        setSelectedTechId(validId);
      } catch (err) {
        console.error('Failed to load initial master data', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [searchParams]);

  // Load tech-specific cycle ledger & balance whenever selected technician changes
  const fetchTechCycleData = async (techId: string) => {
    if (!techId) return;
    try {
      setIsLoadingData(true);
      const [balRes, ledgerRes] = await Promise.all([
        stockApi.getTechnicianBalance(techId),
        stockApi.getLedger({ technicianId: techId, limit: 200 }),
      ]);

      // Construct balance map
      const map: Record<string, number> = {};
      balRes.balances.forEach((b) => {
        map[b.item._id] = b.quantity;
      });
      setTechBalancesMap(map);

      // Filter transactions into Issued, Usages, Returns
      const issues = ledgerRes.filter((t) => t.transactionType === 'ISSUE_TO_TECH');
      const usages = ledgerRes.filter((t) => t.transactionType === 'USAGE_AT_SITE');
      const returns = ledgerRes.filter((t) => t.transactionType === 'RETURN_TO_WAREHOUSE');

      setCycleIssues(issues);
      setCycleUsages(usages);
      setCycleReturns(returns);
    } catch (err) {
      console.error('Failed to fetch tech cycle data', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedTechId) {
      fetchTechCycleData(selectedTechId);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('techId', selectedTechId);
        return p;
      });
      localStorage.setItem(LAST_TECH_STORAGE_KEY, selectedTechId);
    }
  }, [selectedTechId, setSearchParams]);

  const selectedTech = useMemo(
    () => technicians.find((t) => t._id === selectedTechId),
    [technicians, selectedTechId]
  );

  // Cycle totals calculations
  const totalHeldByTech = useMemo(
    () => Object.values(techBalancesMap).reduce((sum, q) => sum + (q > 0 ? q : 0), 0),
    [techBalancesMap]
  );

  const totalHeldBoxValue = useMemo(() => {
    return Object.entries(techBalancesMap).reduce((sum, [itemId, qty]) => {
      if (qty <= 0) return sum;
      const it = items.find((i) => i._id === itemId);
      const price = it?.newPrice ?? it?.price ?? 0;
      return sum + price * qty;
    }, 0);
  }, [techBalancesMap, items]);

  const totalIssuedQty = useMemo(
    () => cycleIssues.reduce((sum, tx) => sum + tx.quantity, 0),
    [cycleIssues]
  );

  const totalInstalledQty = useMemo(
    () => cycleUsages.reduce((sum, tx) => sum + tx.quantity, 0),
    [cycleUsages]
  );

  const totalReturnedQty = useMemo(
    () => cycleReturns.reduce((sum, tx) => sum + tx.quantity, 0),
    [cycleReturns]
  );

  // Formula Check: Total Accounted = Installed + In Bag + Returned
  const totalAccountedQty = totalInstalledQty + totalHeldByTech + totalReturnedQty;
  const isBalanced = totalIssuedQty === totalAccountedQty || totalIssuedQty === 0;

  // Single item return handler
  const handleExecuteSingleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningItem || !selectedTechId) return;

    const parsedQty = parseInt(returnQty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > returningItem.maxQty) {
      alert(`Please enter a valid quantity between 1 and ${returningItem.maxQty}`);
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await stockApi.returnBulk({
        technicianId: selectedTechId,
        items: [
          {
            itemId: returningItem.item._id,
            quantity: parsedQty,
            reason: returnReason,
          },
        ],
        remarks: `Cycle return: ${returnReason}`,
      });

      setReturnFeedback(
        `✓ Returned ${parsedQty} ${returningItem.item.unit} of ${returningItem.item.itemName} to central warehouse.`
      );
      setReturningItem(null);
      setReturnQty('1');
      await fetchTechCycleData(selectedTechId);
      setTimeout(() => setReturnFeedback(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Bulk return all held items to warehouse
  const handleReturnAllItems = async () => {
    const itemsToReturn = Object.entries(techBalancesMap)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantity: qty,
        reason: 'Cycle close: Unused surplus return',
      }));

    if (itemsToReturn.length === 0) {
      alert('Technician currently holds 0 items in their bag.');
      return;
    }

    if (
      !window.confirm(
        `Return all ${totalHeldByTech} units held by ${selectedTech?.name} back to the warehouse?`
      )
    ) {
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await stockApi.returnBulk({
        technicianId: selectedTechId,
        items: itemsToReturn,
        remarks: 'Bulk cycle settlement return of all bag stock',
      });
      setReturnFeedback(
        `✓ Successfully returned all ${totalHeldByTech} units to warehouse.`
      );
      await fetchTechCycleData(selectedTechId);
      setTimeout(() => setReturnFeedback(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process bulk return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Close & Settle Cycle
  const handleConfirmSettlement = async () => {
    try {
      setIsSettling(true);

      if (settlementOption === 'return_all' && totalHeldByTech > 0) {
        // Return remaining items to warehouse
        const itemsToReturn = Object.entries(techBalancesMap)
          .filter(([_, qty]) => qty > 0)
          .map(([itemId, qty]) => ({
            itemId,
            quantity: qty,
            reason: 'Cycle settlement return to warehouse',
          }));

        await stockApi.returnBulk({
          technicianId: selectedTechId,
          items: itemsToReturn,
          remarks: `Cycle settlement: ${settlementNotes || 'All surplus returned to warehouse'}`,
        });
      }

      setSettlementSuccess(
        `✓ Stock cycle for ${selectedTech?.name} successfully settled! ${
          settlementOption === 'retain'
            ? `${totalHeldByTech} units carried forward into fresh cycle.`
            : 'All items returned to warehouse. Fresh cycle initiated.'
        }`
      );
      setShowSettleModal(false);
      setSettlementNotes('');
      await fetchTechCycleData(selectedTechId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to finalize cycle settlement.');
    } finally {
      setIsSettling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading technician stock cycles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-700 shadow-indigo-600/20 text-white flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">
                Technician Stock Cycle &amp; Settlement
              </h2>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                Field Hisaab
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Complete stock cycle: Kits issued from warehouse, client site installations, bag stock &amp; warehouse returns.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Guide
          </button>

          <button
            type="button"
            onClick={() => setShowStatementModal(true)}
            disabled={!selectedTech}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Print Statement
          </button>

          <button
            type="button"
            onClick={() => setShowSettleModal(true)}
            disabled={!selectedTech}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition cursor-pointer shadow-sm shadow-emerald-600/20"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Close &amp; Settle Cycle
          </button>

          <Link
            to={selectedTechId ? `/issue?techId=${selectedTechId}` : '/issue'}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 rounded-xl transition cursor-pointer shadow-sm shadow-sky-600/20"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Issue New Kit / Stock
          </Link>
        </div>
      </div>

      {/* Technician Selector Card */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-indigo-600" />
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Select Field Technician for Stock Cycle Review
            </label>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500">
            {selectedTech && (
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5" />
                Active Field Staff · {selectedTech.area || 'All Areas'}
              </span>
            )}
          </div>
        </div>

        <select
          id="stock-cycle-tech-select"
          value={selectedTechId}
          onChange={(e) => setSelectedTechId(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 transition"
        >
          {technicians.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name} ({t.phone}) {t.area ? `· [${t.area}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Feedback Alerts */}
      {settlementSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-950 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{settlementSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSettlementSuccess(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {returnFeedback && (
        <div className="p-4 bg-teal-50 border border-teal-300 rounded-2xl text-xs text-teal-950 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            <span className="font-semibold">{returnFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setReturnFeedback(null)}
            className="text-teal-700 hover:text-teal-950 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4-Stage Lifecycle KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stage 1: Issued */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-sky-700">1. Kits Issued</span>
            <span className="text-[10px] bg-sky-50 text-sky-800 font-bold px-1.5 py-0.2 rounded">Inward (+)</span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900">
            {totalIssuedQty} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {cycleIssues.length} kit &amp; part transfers from warehouse
          </p>
        </div>

        {/* Stage 2: Installed on Site */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-700">2. Installed on Sites</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Customer (-)</span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-emerald-700">
            {totalInstalledQty} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Consumed on {cycleUsages.length} verified CRM tickets
          </p>
        </div>

        {/* Stage 3: Current Bag Stock */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-indigo-700">3. Held in Bag</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.2 rounded">In Hand (=)</span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-indigo-900">
            {totalHeldByTech} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Valued at ₹{totalHeldBoxValue.toLocaleString('en-IN')} (Box MRP)
          </p>
        </div>

        {/* Stage 4: Returned */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-teal-700">4. Returned</span>
            <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-1.5 py-0.2 rounded">Warehouse (⟲)</span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-teal-800">
            {totalReturnedQty} <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Surplus &amp; replaced parts accepted in warehouse
          </p>
        </div>
      </div>

      {/* Cycle Reconciliation Formula Banner */}
      <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
        isBalanced
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          : 'bg-amber-50/80 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isBalanced ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold flex items-center space-x-1.5">
              <span>{isBalanced ? 'Cycle Balanced & Reconciled' : 'Cycle Balance Note'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/70 border border-current">
                Issued = Installed + In Bag + Returned
              </span>
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
              {totalIssuedQty} Issued = {totalInstalledQty} Installed + {totalHeldByTech} In Bag + {totalReturnedQty} Returned.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchTechCycleData(selectedTechId)}
            className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 transition cursor-pointer flex items-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${isLoadingData ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation for Detailed Cycle Inspection */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-4 pt-2 overflow-x-auto gap-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('bag')}
            className={`pb-3 pt-1 px-3 text-xs font-bold border-b-2 transition-all flex items-center cursor-pointer shrink-0 ${
              activeTab === 'bag'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            1. Items in Bag ({Object.values(techBalancesMap).filter((q) => q > 0).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('issued')}
            className={`pb-3 pt-1 px-3 text-xs font-bold border-b-2 transition-all flex items-center cursor-pointer shrink-0 ${
              activeTab === 'issued'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
            2. Kits Issued ({cycleIssues.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usages')}
            className={`pb-3 pt-1 px-3 text-xs font-bold border-b-2 transition-all flex items-center cursor-pointer shrink-0 ${
              activeTab === 'usages'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            3. Client Installations ({cycleUsages.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`pb-3 pt-1 px-3 text-xs font-bold border-b-2 transition-all flex items-center cursor-pointer shrink-0 ${
              activeTab === 'returns'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            4. Warehouse Returns ({cycleReturns.length})
          </button>
        </div>

        {/* Tab 1 Content: Items Held In Bag */}
        {activeTab === 'bag' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center">
                  <Package className="w-4 h-4 mr-2 text-indigo-600" />
                  Live Items Held In Technician's Bag
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Parts the technician can retain for pending customer visits, or return to warehouse to settle.
                </p>
              </div>

              {totalHeldByTech > 0 && (
                <button
                  type="button"
                  onClick={handleReturnAllItems}
                  disabled={isSubmittingReturn}
                  className="px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 transition cursor-pointer self-start sm:self-auto"
                >
                  ⚡ Return All ({totalHeldByTech} Units) to Warehouse
                </button>
              )}
            </div>

            {totalHeldByTech === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">Technician holds 0 units in their field bag.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dispatch fresh bulk kits from the warehouse to start their next route.
                </p>
                <Link
                  to={`/issue?techId=${selectedTechId}`}
                  className="mt-3 inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Issue Kit / Stock to {selectedTech?.name}
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Item SKU</th>
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-center">In Bag Qty</th>
                      <th className="py-2.5 px-4 text-right">Box MRP (₹)</th>
                      <th className="py-2.5 px-4 text-right">Total Value</th>
                      <th className="py-2.5 px-4 text-right">Cycle Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(techBalancesMap)
                      .filter(([_, qty]) => qty > 0)
                      .map(([itemId, qty]) => {
                        const item = items.find((i) => i._id === itemId);
                        if (!item) return null;
                        const boxPrice = item.newPrice ?? item.price ?? 0;
                        const lineVal = boxPrice * qty;

                        return (
                          <tr key={itemId} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {item.itemCode}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">{item.itemName}</td>
                            <td className="py-3 px-4 text-slate-500">{item.category}</td>
                            <td className="py-3 px-4 text-center font-mono font-extrabold text-indigo-700 text-sm">
                              {qty} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              ₹{boxPrice.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-800">
                              ₹{lineVal.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setReturningItem({
                                    item,
                                    maxQty: qty,
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer"
                              >
                                Return to Warehouse
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Kits & Stock Issued */}
        {activeTab === 'issued' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Warehouse Issue &amp; Dispatch History</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record of kits and batches issued from central warehouse to this technician.
                </p>
              </div>
              <Link
                to={`/issue?techId=${selectedTechId}`}
                className="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition cursor-pointer"
              >
                + Issue Another Kit
              </Link>
            </div>

            {cycleIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No issue records found for this technician yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Item / Kit Name</th>
                      <th className="py-2.5 px-4 text-center">Quantity</th>
                      <th className="py-2.5 px-4">Remarks / Kit Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cycleIssues.map((tx) => {
                      const it = typeof tx.item === 'object' ? (tx.item as IItem) : null;
                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                            {new Date(tx.transactionDate).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{it?.itemName || 'Item'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{it?.itemCode}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-sky-700">
                            +{tx.quantity} {it?.unit || 'units'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {tx.remarks || tx.invoiceNumber || 'Warehouse Dispatch'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3 Content: Customer Installations */}
        {activeTab === 'usages' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Customer Site Installations (Jobs Recorded)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Parts deducted upon verified customer installation against CRM ticket numbers.
                </p>
              </div>
              <Link
                to="/log-usage"
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition cursor-pointer"
              >
                + Log Site Usage
              </Link>
            </div>

            {cycleUsages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No customer usage recorded for this technician yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Part Installed</th>
                      <th className="py-2.5 px-4 text-center">Qty Installed</th>
                      <th className="py-2.5 px-4">CRM Case / Job #</th>
                      <th className="py-2.5 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cycleUsages.map((tx) => {
                      const it = typeof tx.item === 'object' ? (tx.item as IItem) : null;
                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                            {new Date(tx.transactionDate).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{it?.itemName || 'Item'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{it?.itemCode}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                            -{tx.quantity} {it?.unit || 'units'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {tx.jobReference ? `Case #${tx.jobReference}` : tx.siteName || 'Customer Job'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {tx.remarks || 'Installed at customer location'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4 Content: Warehouse Returns */}
        {activeTab === 'returns' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Warehouse Return History</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Surplus or defective parts returned by technician back to the warehouse.
                </p>
              </div>
            </div>

            {cycleReturns.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No warehouse returns recorded for this technician yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Returned Item</th>
                      <th className="py-2.5 px-4 text-center">Quantity</th>
                      <th className="py-2.5 px-4">Return Reason</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cycleReturns.map((tx) => {
                      const it = typeof tx.item === 'object' ? (tx.item as IItem) : null;
                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                            {new Date(tx.transactionDate).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{it?.itemName || 'Item'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{it?.itemCode}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-teal-800">
                            +{tx.quantity} {it?.unit || 'units'}
                          </td>
                          <td className="py-3 px-4 font-medium text-amber-800">
                            {tx.reason || 'Surplus Return'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {tx.remarks || 'Returned to warehouse stock'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single Item Return Modal */}
      {returningItem && (
        <Modal
          id="modal-single-return"
          isOpen={true}
          onClose={() => setReturningItem(null)}
          title={`Return ${returningItem.item.itemName} to Warehouse`}
          subtitle={`Technician currently holds ${returningItem.maxQty} ${returningItem.item.unit} in hand.`}
        >
          <form onSubmit={handleExecuteSingleReturn} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p>
                <strong>Item SKU:</strong> <span className="font-mono font-bold">{returningItem.item.itemCode}</span>
              </p>
              <p>
                <strong>Technician:</strong> {selectedTech?.name}
              </p>
              <p>
                <strong>Max Returnable:</strong> {returningItem.maxQty} {returningItem.item.unit}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity to Return ({returningItem.item.unit}) *
              </label>
              <input
                type="number"
                min="1"
                max={returningItem.maxQty}
                required
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Return Reason *</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 font-medium text-slate-900"
              >
                <option value="Unused / Surplus Stock Return">Unused / Surplus Stock Return</option>
                <option value="Defective / Damaged Part Return">Defective / Damaged Part Return</option>
                <option value="Customer Ticket Cancelled">Customer Ticket Cancelled</option>
                <option value="Incorrect Model / Specification">Incorrect Model / Specification</option>
                <option value="Old Part Replaced On-Site">Old Part Replaced On-Site</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReturningItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReturn}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-sm"
              >
                {isSubmittingReturn ? 'Processing...' : 'Confirm Return to Warehouse'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Settle & Close Cycle Modal */}
      <Modal
        id="modal-settle-cycle"
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        title={`Close & Settle Stock Cycle: ${selectedTech?.name}`}
        subtitle="Finalize cycle hisaab and choose whether to retain bag inventory or return surplus to warehouse."
      >
        <div className="space-y-4 text-xs">
          {/* Summary Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Issued</span>
              <p className="text-base font-extrabold font-mono text-slate-900 mt-0.5">{totalIssuedQty}</p>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 font-bold uppercase block">Installed</span>
              <p className="text-base font-extrabold font-mono text-emerald-700 mt-0.5">{totalInstalledQty}</p>
            </div>
            <div>
              <span className="text-[10px] text-indigo-600 font-bold uppercase block">Remaining in Bag</span>
              <p className="text-base font-extrabold font-mono text-indigo-900 mt-0.5">{totalHeldByTech}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-slate-800">
              What should happen to the {totalHeldByTech} units currently in bag?
            </label>

            <div className="space-y-2">
              <label className="flex items-start p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="settlementOption"
                  checked={settlementOption === 'retain'}
                  onChange={() => setSettlementOption('retain')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 mr-3"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Option A: Retain held stock in bag (Carry forward into next cycle)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Technician keeps needed stock in their bag for tomorrow's appointments. Opening balance of new cycle will be {totalHeldByTech} units.
                  </span>
                </div>
              </label>

              <label className="flex items-start p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="settlementOption"
                  checked={settlementOption === 'return_all'}
                  onChange={() => setSettlementOption('return_all')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 mr-3"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Option B: Return all remaining stock to warehouse
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    All {totalHeldByTech} units will be automatically returned to central warehouse inventory. Technician bag balance resets to 0.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Settlement Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Weekly cycle complete, customer billings reconciled."
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowSettleModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSettlement}
              disabled={isSettling}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition cursor-pointer shadow-sm"
            >
              {isSettling ? 'Settling...' : 'Confirm & Finalize Settlement'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Printable Statement Modal */}
      <Modal
        id="modal-statement"
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        title="Technician Stock Cycle Statement (Hisaab Slip)"
        subtitle="Official audit voucher of all kit transfers, installations, and remaining balances."
      >
        <div className="space-y-4 text-xs">
          {/* Printable Header */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">AquaStock PUREIT OPS</h3>
                <p className="text-[10px] text-slate-500">Technician Stock Cycle Settlement Voucher</p>
              </div>
              <div className="text-right text-[11px] font-mono text-slate-600">
                Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <strong>Technician:</strong> {selectedTech?.name} ({selectedTech?.phone})
              </div>
              <div>
                <strong>Territory:</strong> {selectedTech?.area || 'All Service Areas'}
              </div>
            </div>
          </div>

          {/* Statement Figures */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
              <span className="text-[10px] font-bold text-sky-800 uppercase block">1. Total Issued</span>
              <p className="text-base font-extrabold font-mono text-sky-950 mt-0.5">{totalIssuedQty}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">2. Installed</span>
              <p className="text-base font-extrabold font-mono text-emerald-950 mt-0.5">{totalInstalledQty}</p>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-800 uppercase block">3. In Bag Stock</span>
              <p className="text-base font-extrabold font-mono text-indigo-950 mt-0.5">{totalHeldByTech}</p>
            </div>
            <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200">
              <span className="text-[10px] font-bold text-teal-800 uppercase block">4. Returned</span>
              <p className="text-base font-extrabold font-mono text-teal-950 mt-0.5">{totalReturnedQty}</p>
            </div>
          </div>

          {/* Bag Stock Breakdown List */}
          <div>
            <h5 className="font-bold text-slate-900 mb-1.5">Held Inventory Detail</h5>
            {totalHeldByTech === 0 ? (
              <p className="text-slate-400 italic">No inventory held in bag.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-[11px]">
                <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-600 grid grid-cols-12 gap-2 uppercase text-[10px]">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-4 text-right">Box MRP (₹)</div>
                </div>
                {Object.entries(techBalancesMap)
                  .filter(([_, q]) => q > 0)
                  .map(([itemId, q]) => {
                    const it = items.find((i) => i._id === itemId);
                    if (!it) return null;
                    const price = it.newPrice ?? it.price ?? 0;
                    return (
                      <div key={itemId} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6 font-bold text-slate-800 truncate">
                          [{it.itemCode}] {it.itemName}
                        </div>
                        <div className="col-span-2 text-center font-mono font-bold text-indigo-700">
                          {q} {it.unit}
                        </div>
                        <div className="col-span-4 text-right font-mono font-bold text-emerald-800">
                          ₹{(price * q).toLocaleString('en-IN')}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Signatures for physical accountability */}
          <div className="grid grid-cols-2 gap-4 pt-6 mt-4 border-t border-slate-200 text-center text-[11px] text-slate-500">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 mb-1" />
              <span>Technician Signature ({selectedTech?.name})</span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 mb-1" />
              <span>Warehouse Manager Signature</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowStatementModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-sm flex items-center"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Slip / Save PDF
            </button>
          </div>
        </div>
      </Modal>

      {/* Operations User Guide */}
      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
