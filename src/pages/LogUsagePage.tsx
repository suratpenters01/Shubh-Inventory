import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itemApi, technicianApi, stockApi } from '../services/api';
import { IItem, IUser } from '../types';
import { ItemSearchPicker } from '../components/common/ItemSearchPicker';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import { Modal } from '../components/common/Modal';
import { LARGE_QUANTITY_THRESHOLD, LAST_TECH_STORAGE_KEY } from '../constants/stock';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  FileText,
  User,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Hash,
  Wrench,
  Package,
  Tag,
  Monitor,
  Sparkles,
} from 'lucide-react';

export const LogUsagePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>(user?.role === 'technician' ? user._id : '');
  const [techHeldItems, setTechHeldItems] = useState<Array<{ item: IItem; quantity: number }>>([]);
  const [catalogItems, setCatalogItems] = useState<IItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [caseId, setCaseId] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [remarks, setRemarks] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => 'usg_' + crypto.randomUUID());

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLargeQtyModal, setShowLargeQtyModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Load technicians if admin and remember last selected
  useEffect(() => {
    const loadTechs = async () => {
      if (isAdmin) {
        try {
          const list = await technicianApi.getTechnicians();
          setTechnicians(list);
          const storedTechId = localStorage.getItem(LAST_TECH_STORAGE_KEY);
          // Stale storage handling: silently ignore deleted/deactivated IDs
          if (storedTechId && list.some((t) => t._id === storedTechId)) {
            setSelectedTechId(storedTechId);
          } else if (list.length > 0) {
            setSelectedTechId(list[0]._id);
            localStorage.setItem(LAST_TECH_STORAGE_KEY, list[0]._id);
          } else {
            setSelectedTechId('');
          }
        } catch (err) {
          console.error(err);
        }
      } else if (user) {
        setSelectedTechId(user._id);
      }
      setIsLoading(false);
    };
    loadTechs();
  }, [isAdmin, user]);

  // Toggle to show all catalog if user explicitly wants to bypass bag filter
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  // List of only items currently held in this technician's bag (quantity > 0)
  const heldItems = useMemo(() => {
    return techHeldItems
      .filter((b) => (b.quantity || 0) > 0)
      .map((b) => b.item);
  }, [techHeldItems]);

  // Whenever selectedTechId changes, fetch their held stock
  useEffect(() => {
    const fetchTechStock = async () => {
      if (!selectedTechId) return;
      try {
        const [res, catalog] = await Promise.all([
          stockApi.getTechnicianBalance(selectedTechId),
          itemApi.getItems({ isActive: true }),
        ]);

        setCatalogItems(catalog);
        setTechHeldItems(res.balances);

        // Strictly pick from items the technician actually has in hand
        const withStock = res.balances.filter((b) => (b.quantity || 0) > 0);
        if (withStock.length > 0) {
          // Keep current selection if still held by new tech, otherwise pick first held item
          if (!withStock.some((b) => b.item._id === selectedItemId)) {
            setSelectedItemId(withStock[0].item._id);
          }
        } else {
          // Technician has 0 stock in bag
          setSelectedItemId('');
        }
      } catch (err) {
        console.error('Failed to load tech stock', err);
      }
    };
    fetchTechStock();
  }, [selectedTechId]);

  // Map of tech stock per item id
  const techStockMap: Record<string, number> = {};
  techHeldItems.forEach((b) => {
    techStockMap[b.item._id] = b.quantity;
  });

  const activeHeldItem = techHeldItems.find((b) => b.item._id === selectedItemId);
  const selectedItem = catalogItems.find((i) => i._id === selectedItemId) || activeHeldItem?.item;
  const currentTechQty = techStockMap[selectedItemId] ?? 0;
  const parsedQty = Number(quantity) || 0;
  const selectedTech = technicians.find((t) => t._id === selectedTechId) || (user?.role === 'technician' ? user : undefined);
  const isInsufficientStock = parsedQty > currentTechQty;
  const expectedRemaining = Math.max(0, currentTechQty - parsedQty);

  // Items to present in search picker: strictly held items by default, or all catalog if toggled
  const itemsForPicker = showAllCatalog ? catalogItems : heldItems;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return; // Strict idempotency guard against double-enter
    setError(null);
    setSuccessMsg(null);

    if (!selectedItemId || !selectedTechId) {
      setError('Please select a technician and the installed spare part.');
      return;
    }

    const cleanCaseId = caseId.trim();
    if (!cleanCaseId || !/^\d{8}$/.test(cleanCaseId)) {
      setError('Case ID must be an 8-digit number (e.g. 10293847).');
      return;
    }

    if (parsedQty <= 0) {
      setError('Consumed quantity must be 1 or greater.');
      return;
    }

    if (isInsufficientStock) {
      setError(
        `Technician holds only ${currentTechQty} ${selectedItem?.unit || 'units'}. You cannot deduct ${parsedQty} units.`
      );
      return;
    }

    // Confirmation for large quantity (>= 100) using in-app modal (never window.confirm)
    if (parsedQty >= LARGE_QUANTITY_THRESHOLD && !showLargeQtyModal) {
      setShowLargeQtyModal(true);
      return;
    }

    await executeUsage();
  };

  const executeUsage = async () => {
    setShowLargeQtyModal(false);
    if (isSubmitting) return;
    setIsSubmitting(true);
    const cleanCaseId = caseId.trim();
    try {
      await stockApi.logUsage(
        {
          itemId: selectedItemId,
          technicianId: isAdmin ? selectedTechId : undefined,
          quantity: parsedQty,
          caseId: cleanCaseId,
          jobReference: cleanCaseId,
          siteName: `Case #${cleanCaseId}`,
          remarks: remarks.trim() || undefined,
          transactionDate: transactionDate ? new Date(transactionDate).toISOString() : undefined,
        },
        idempotencyKey
      );

      setSuccessMsg(
        `✓ Installation recorded for Case #${cleanCaseId}: ${parsedQty} ${selectedItem?.unit} [${selectedItem?.itemCode}]. Technician stock remaining: ${expectedRemaining} ${selectedItem?.unit}.`
      );

      // Reset fields and regenerate idempotency key for next entry
      setQuantity('');
      setCaseId('');
      setRemarks('');
      setIdempotencyKey('usg_' + crypto.randomUUID());

      // Refresh technician balance
      const res = await stockApi.getTechnicianBalance(selectedTechId);
      setTechHeldItems(res.balances);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record site usage.');
      // NOTE: idempotencyKey is intentionally retained so retry uses the EXACT SAME key!
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">
                Log Site Usage &amp; Consumption
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Record parts installed in customer purifiers with CRM Case ID, and deduct from technician bag balance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="inline-flex items-center px-3.5 py-2 text-xs font-bold bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 rounded-xl transition cursor-pointer border border-slate-200/70"
        >
          <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
          Guide
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-sm">{successMsg}</span>
            </div>
            <div className="flex items-center space-x-3 pt-1 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => navigate('/ledger')}
                className="font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center cursor-pointer text-xs"
              >
                View Movement Ledger Entry <ArrowRight className="w-3 h-3 ml-1" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Admin: Technician Selector */}
          {isAdmin && (
            <div className="p-4.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center">
                <User className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Select Field Technician *
              </label>
              <select
                required
                value={selectedTechId}
                onChange={(e) => {
                  setSelectedTechId(e.target.value);
                  localStorage.setItem(LAST_TECH_STORAGE_KEY, e.target.value);
                }}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-semibold text-slate-900"
              >
                {technicians.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.phone}) {t.area ? `[${t.area}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 1: Item Code Search Picker (Only Technician Held Items by Default) */}
          <div className="p-4.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                  01
                </span>
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  Installed Part / Kit SKU ({selectedTech?.name || 'Technician'})
                </span>
              </div>

              {/* Toggle: Only Bag Stock vs All Catalog */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-500 font-medium">Filter:</span>
                <button
                  type="button"
                  onClick={() => setShowAllCatalog(false)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    !showAllCatalog
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Bag Stock Only ({heldItems.length} SKUs)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllCatalog(true)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    showAllCatalog
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Catalog ({catalogItems.length})
                </button>
              </div>
            </div>

            {/* Empty Bag Warning Banner if selected technician holds 0 parts */}
            {!showAllCatalog && heldItems.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                      Bag Is Empty — 0 Spare Parts in Hand
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      <strong>{selectedTech?.name || 'Selected Technician'}</strong> ke paas filhaal koi spare part ya kit nahi hai (Bag stock: 0 units).
                      Site par part lagane ke liye pehle Central Warehouse se issue karein.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(selectedTechId ? `/issue?techId=${selectedTechId}` : '/issue')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center cursor-pointer shadow-2xs"
                  >
                    <Package className="w-3.5 h-3.5 mr-1" />
                    → Issue Stock to {selectedTech?.name || 'Technician'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllCatalog(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                  >
                    View All Catalog Parts
                  </button>
                </div>
              </div>
            )}

            {/* Quick Bag Selection Chips (Click to select instantly!) */}
            {heldItems.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700 flex items-center">
                    <Package className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    Held in {selectedTech?.name || 'Technician'}&apos;s Bag ({heldItems.length} SKUs in hand — Click to select):
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Total: {Object.values(techStockMap).reduce((a, b) => a + (b > 0 ? b : 0), 0)} units
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  {heldItems.map((item) => {
                    const heldQty = techStockMap[item._id] ?? 0;
                    const isSelected = selectedItemId === item._id;
                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => setSelectedItemId(item._id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50'
                        }`}
                      >
                        <span className="font-mono text-[10px] font-bold px-1 py-0.2 rounded bg-black/10">
                          {item.itemCode}
                        </span>
                        <span className="truncate max-w-[140px]">{item.itemName}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {heldQty} {item.unit || 'pcs'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ItemSearchPicker
              items={itemsForPicker}
              selectedItemId={selectedItemId}
              onSelectItem={(item) => setSelectedItemId(item._id)}
              isLoading={isLoading}
              label={
                showAllCatalog
                  ? 'All Catalog Items (Warehouse Master)'
                  : `Held Bag Inventory (${heldItems.length} Items Available)`
              }
              helperText={
                showAllCatalog
                  ? 'Showing all catalog items across warehouse master'
                  : `Showing only spare parts currently held in ${selectedTech?.name || 'technician'}'s van / kit bag`
              }
              showTechStock
              techStockMap={techStockMap}
              required
            />

            {/* Live Available Technician Stock Indicator (Shown immediately after item is chosen) */}
            {selectedItem && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
                  currentTechQty === 0
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : currentTechQty <= 2
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      currentTechQty === 0
                        ? 'bg-rose-500 ring-4 ring-rose-100'
                        : currentTechQty <= 2
                        ? 'bg-amber-500 ring-4 ring-amber-100'
                        : 'bg-emerald-500 ring-4 ring-emerald-100'
                    }`}
                  ></div>
                  <div>
                    <span className="font-bold text-slate-800">
                      Live Available Technician Stock:
                    </span>{' '}
                    <span className="font-extrabold font-mono text-sm ml-1">
                      {currentTechQty} {selectedItem.unit || 'units'}
                    </span>
                    {currentTechQty === 0 ? (
                      <span className="text-[11px] block text-rose-700 font-semibold mt-0.5">
                        Technician holds 0 units of this part — Submit is disabled. Please issue from warehouse first.
                      </span>
                    ) : (
                      <span className="text-[11px] block text-slate-500 mt-0.5">
                        Units available in technician van/kit bag.
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    currentTechQty === 0
                      ? 'bg-rose-100 text-rose-800'
                      : currentTechQty <= 2
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {currentTechQty === 0 ? 'Out of Hand Stock' : `${currentTechQty} In Hand`}
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Service Date & 8-Digit Case ID */}
          <div className="p-4.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                02
              </span>
              <span className="text-xs font-bold text-slate-900 tracking-tight">
                Service Date &amp; Case ID (8-Digit Case Number)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Service Completion Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-medium text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Case ID *
                  </label>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                    8 Digits
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  placeholder="e.g. 10293847"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-mono font-bold text-slate-900 tracking-wider placeholder:tracking-normal placeholder:font-normal"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {caseId.length}/8 digits {caseId.length === 8 ? '✓' : '(8-digit CRM Case Number)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Installed ({selectedItem?.unit || 'units'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentTechQty}
                  step="1"
                  required
                  placeholder="e.g. 1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm font-extrabold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-mono text-slate-900"
                />
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Currently held by technician: {currentTechQty} {selectedItem?.unit || 'units'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purifier Model / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pureit Copper RO GKK replacement"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Enter must NOT submit while typing in a multi-line box / textarea
                      if (e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                        return;
                      }
                      e.preventDefault();
                      if (!isSubmitting) {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>
            </div>

            {/* Customer Billing & Portal Pricing Reference */}
            {selectedItem && (
              <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-50/90 via-sky-50/50 to-slate-50 rounded-xl border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-emerald-200/50">
                  <span className="font-bold text-slate-800 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Customer Billing &amp; Portal Verification Rate
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    Box MRP vs Portal Rate
                  </span>
                </div>

                {(() => {
                  const baseP = selectedItem.price || 0;
                  const oldP = selectedItem.oldPrice !== undefined && selectedItem.oldPrice > 0 ? selectedItem.oldPrice : baseP;
                  const newP = selectedItem.newPrice !== undefined && selectedItem.newPrice > 0 ? selectedItem.newPrice : baseP;
                  const qtyNum = Math.max(1, Number(quantity) || 1);
                  const diff = newP - oldP;

                  return (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Customer Bill Amount (Box MRP) */}
                        <div className="bg-white p-2.5 rounded-lg border border-emerald-300 shadow-2xs">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 flex items-center">
                            <Tag className="w-3 h-3 mr-1 text-emerald-600" />
                            Customer Bill Amount (Box Printed MRP):
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-sm font-extrabold font-mono text-emerald-950">
                              ₹{newP.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] font-normal text-slate-500">/ {selectedItem.unit || 'kit'}</span>
                            </span>
                            {Number(quantity) > 0 && (
                              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Total Bill: ₹{(qtyNum * newP).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* System Portal Rate (Old Price) */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-300 shadow-2xs">
                          <span className="text-[10px] uppercase font-medium text-slate-600 flex items-center">
                            <Monitor className="w-3 h-3 mr-1 text-slate-500" />
                            AO Smith Portal Rate (Old System Rate):
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-sm font-bold font-mono text-slate-800">
                              ₹{oldP.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] font-normal text-slate-400">/ {selectedItem.unit || 'kit'}</span>
                            </span>
                            {Number(quantity) > 0 && (
                              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                Portal Val: ₹{(qtyNum * oldP).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                        <span>
                          💳 <strong>Customer Bill Rule:</strong> Always bill customer based on Box Printed MRP (₹{newP}).
                        </span>
                        {diff !== 0 && (
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 shrink-0 ml-2">
                            Diff: +₹{diff.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setQuantity('');
                setCaseId('');
                setRemarks('');
                setIdempotencyKey('usg_' + crypto.randomUUID());
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Reset Form
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              {/* Selected technician clearly visible next to submit button */}
              <div className="text-xs font-semibold text-slate-600 bg-slate-100/90 border border-slate-200 px-3 py-2 rounded-xl flex items-center shrink-0">
                <User className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Technician: <span className="font-extrabold text-slate-900 ml-1">{selectedTech?.name || user?.name || 'Not selected'}</span>
              </div>

              <button
                id="submit-usage-btn"
                type="submit"
                disabled={
                  isSubmitting ||
                  parsedQty <= 0 ||
                  isInsufficientStock ||
                  !selectedItemId ||
                  caseId.length !== 8
                }
                className="px-6 py-3 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer flex items-center shadow-xs active:scale-95 shrink-0"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                {isSubmitting
                  ? 'Recording Consumption...'
                  : `Confirm Site Usage (${selectedTech?.name || 'Technician'})`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* In-App Confirmation Modal for Large Quantity (>= 100) */}
      <Modal
        isOpen={showLargeQtyModal}
        onClose={() => setShowLargeQtyModal(false)}
        title="⚠️ Large Quantity Confirmation Alert"
        subtitle={`Threshold: ${LARGE_QUANTITY_THRESHOLD}+ units`}
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">
                You are entering a large quantity of {parsedQty} units.
              </p>
              <p className="mt-1 text-amber-800">
                Part: <span className="font-semibold text-slate-900">{selectedItem?.itemName} ({selectedItem?.itemCode})</span>
                <br />
                Case ID: <span className="font-semibold font-mono text-slate-900">#{caseId}</span>
                <br />
                Technician: <span className="font-semibold text-slate-900">{selectedTech?.name || user?.name}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Are you sure this large quantity was consumed in the customer purifier service?
          </p>
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowLargeQtyModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={executeUsage}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Recording...' : `Yes, Log ${parsedQty} Units`}
            </button>
          </div>
        </div>
      </Modal>

      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
