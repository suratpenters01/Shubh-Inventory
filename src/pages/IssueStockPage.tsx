import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { itemApi, technicianApi, stockApi } from '../services/api';
import { IItem, IUser, IStockTransaction } from '../types';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import { Modal } from '../components/common/Modal';
import { LARGE_QUANTITY_THRESHOLD, LAST_TECH_STORAGE_KEY } from '../constants/stock';
import {
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  HelpCircle,
  ArrowRight,
  User,
  Plus,
  Trash2,
  Search,
  Tag,
  Monitor,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
  Warehouse,
  Check,
  ChevronDown,
  Info,
  Printer,
  Scale,
  FileText,
  Clock,
  History,
  CheckCheck,
  BadgePercent,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';

interface BulkTransferItem {
  item: IItem;
  quantity: number;
  remarks: string;
}

type TransferMode = 'ISSUE' | 'RETURN' | 'CYCLE';

const COMMON_RETURN_REASONS = [
  'Unused / Surplus Stock Return',
  'Defective / Damaged Part Return',
  'Customer Ticket Cancelled',
  'Incorrect Model / Specification',
  'Old Part Replaced On-Site',
  'Technician Resignation / Handover',
];

// Preset Kit definitions for 1-click loading into the table
interface KitPreset {
  id: string;
  name: string;
  description: string;
  categoryFilter?: string;
  itemKeyword: string[];
  defaultQty: number;
}

const POPULAR_KIT_PRESETS: KitPreset[] = [
  {
    id: 'ro-complete-kit',
    name: 'Pureit RO 5-Stage Complete Kit',
    description: 'Pre-Filter, Carbon, Sediment & RO GKK Kit bundle for comprehensive service',
    itemKeyword: ['Kit', 'GKK', 'Filter'],
    defaultQty: 1,
  },
  {
    id: 'gkk-replacement-pack',
    name: 'Pureit Germkill (One Kit / GKK Pack)',
    description: 'Authentic Pureit GKK 1, GKK 2 or One Kit cartridges for purifier overhaul',
    itemKeyword: ['Germkill', 'One Kit', 'GKK'],
    defaultQty: 2,
  },
  {
    id: 'sv-electrical-kit',
    name: 'Solenoid Valve (SV) & Connectors Kit',
    description: '24V Solenoid valve, push-fit connectors, and teflon tape for leak repair',
    itemKeyword: ['Solenoid', 'SV', 'Valve'],
    defaultQty: 2,
  },
  {
    id: 'general-service-batch',
    name: 'Technician Weekly Field Van Batch',
    description: 'High-frequency consumable spare parts for weekly customer calls',
    itemKeyword: ['Filter', 'Cartridge', 'Kit'],
    defaultQty: 3,
  },
];

export const IssueStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: ISSUE (Central Warehouse -> Tech) or RETURN (Tech -> Warehouse)
  const queryMode = searchParams.get('mode')?.toUpperCase();
  const initialMode: TransferMode = queryMode === 'RETURN' ? 'RETURN' : 'ISSUE';
  const [mode, setMode] = useState<TransferMode>(initialMode);

  // If user opens ?mode=return or ?mode=cycle, redirect to dedicated pages
  useEffect(() => {
    const m = searchParams.get('mode')?.toUpperCase();
    const techId = searchParams.get('techId');
    if (m === 'RETURN') {
      navigate(techId ? `/return-stock?techId=${techId}` : '/return-stock', { replace: true });
    } else if (m === 'CYCLE') {
      navigate(techId ? `/stock-cycle?techId=${techId}` : '/stock-cycle', { replace: true });
    }
  }, [searchParams, navigate]);

  const [items, setItems] = useState<IItem[]>([]);
  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTechId, setSelectedTechId] = useState('');
  const [bulkItems, setBulkItems] = useState<BulkTransferItem[]>([]);
  const [techBalancesMap, setTechBalancesMap] = useState<Record<string, number>>({});

  // Kit Name & Kit Amount state for Issue Mode
  const [kitName, setKitName] = useState('');
  const [kitAmount, setKitAmount] = useState<string>('');
  const [isKitAmountCustom, setIsKitAmountCustom] = useState(false);

  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `${mode === 'RETURN' ? 'ret' : 'iss'}_bulk_${crypto.randomUUID()}`
  );

  // Search picker state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Modals & User Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLargeQtyModal, setShowLargeQtyModal] = useState(false);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Success Receipt / Voucher Modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherData, setVoucherData] = useState<{
    voucherNo: string;
    mode: TransferMode;
    date: string;
    technicianName: string;
    kitName?: string;
    kitAmount?: number;
    items: Array<{
      itemCode: string;
      itemName: string;
      quantity: number;
      unit: string;
      portalPrice: number;
      boxPrice: number;
    }>;
    totalUnits: number;
    totalBoxValue: number;
    totalPortalValue: number;
    remarks?: string;
  } | null>(null);

  // Stock Cycle & Reconciliation History state (for CYCLE mode)
  const [cycleUsages, setCycleUsages] = useState<IStockTransaction[]>([]);
  const [cycleIssues, setCycleIssues] = useState<IStockTransaction[]>([]);
  const [isLoadingCycle, setIsLoadingCycle] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Sync mode changes with URL query parameter
  const handleModeChange = (newMode: TransferMode) => {
    setMode(newMode);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('mode', newMode.toLowerCase());
      return p;
    });
    setError(null);
    setValidationAlert(null);
    setIdempotencyKey(`${newMode === 'RETURN' ? 'ret' : 'iss'}_bulk_${crypto.randomUUID()}`);
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const [itemsData, techsData] = await Promise.all([
          itemApi.getItems({ isActive: true }),
          technicianApi.getTechnicians(),
        ]);
        setItems(itemsData);
        setTechnicians(techsData);

        const queryTechId = searchParams.get('techId');
        const queryItemId = searchParams.get('itemId');

        const storedTechId = localStorage.getItem(LAST_TECH_STORAGE_KEY);
        let resolvedTechId = '';
        if (queryTechId && techsData.some((t) => t._id === queryTechId)) {
          resolvedTechId = queryTechId;
          localStorage.setItem(LAST_TECH_STORAGE_KEY, queryTechId);
        } else if (storedTechId && techsData.some((t) => t._id === storedTechId)) {
          resolvedTechId = storedTechId;
        } else if (techsData.length > 0) {
          resolvedTechId = techsData[0]._id;
          localStorage.setItem(LAST_TECH_STORAGE_KEY, techsData[0]._id);
        }
        setSelectedTechId(resolvedTechId);

        // Pre-populate with queryItemId if provided
        if (queryItemId) {
          const itemMatch = itemsData.find((i) => i._id === queryItemId);
          if (itemMatch) {
            setBulkItems([{ item: itemMatch, quantity: 1, remarks: '' }]);
          }
        }
      } catch (err) {
        console.error('Failed to load initial issue data', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Fetch technician balances whenever selected technician changes
  useEffect(() => {
    const fetchTechStock = async () => {
      if (!selectedTechId) {
        setTechBalancesMap({});
        return;
      }
      try {
        const res = await stockApi.getTechnicianBalance(selectedTechId);
        const map: Record<string, number> = {};
        res.balances.forEach((b) => {
          map[b.item._id] = b.quantity;
        });
        setTechBalancesMap(map);
      } catch {
        setTechBalancesMap({});
      }
    };
    fetchTechStock();
  }, [selectedTechId]);

  // Load technician cycle reconciliation history (when in CYCLE mode or tech changes)
  useEffect(() => {
    const loadCycleHistory = async () => {
      if (!selectedTechId || mode !== 'CYCLE') return;
      try {
        setIsLoadingCycle(true);
        const [usageRes, issueRes] = await Promise.all([
          stockApi.getLedger({ technicianId: selectedTechId, type: 'USAGE_AT_SITE', limit: 15 }),
          stockApi.getLedger({ technicianId: selectedTechId, type: 'ISSUE_TO_TECH', limit: 15 }),
        ]);
        setCycleUsages(usageRes || []);
        setCycleIssues(issueRes || []);
      } catch (err) {
        console.error('Failed to load technician cycle ledger history', err);
      } finally {
        setIsLoadingCycle(false);
      }
    };
    loadCycleHistory();
  }, [selectedTechId, mode]);

  const selectedTech = technicians.find((t) => t._id === selectedTechId);

  // Compute live totals
  const { totalUnits, totalBoxValue, totalPortalValue, totalDifference } = useMemo(() => {
    let units = 0;
    let boxVal = 0;
    let portalVal = 0;

    bulkItems.forEach((b) => {
      const q = b.quantity || 0;
      units += q;
      const boxPrice = b.item.newPrice ?? b.item.price ?? 0;
      const portalPrice = b.item.oldPrice ?? b.item.price ?? 0;
      boxVal += boxPrice * q;
      portalVal += portalPrice * q;
    });

    return {
      totalUnits: units,
      totalBoxValue: boxVal,
      totalPortalValue: portalVal,
      totalDifference: boxVal - portalVal,
    };
  }, [bulkItems]);

  // Auto-sync kitAmount unless user explicitly customized it
  useEffect(() => {
    if (!isKitAmountCustom && mode === 'ISSUE') {
      if (totalBoxValue > 0) {
        setKitAmount(totalBoxValue.toString());
      } else {
        setKitAmount('');
      }
    }
  }, [totalBoxValue, isKitAmountCustom, mode]);

  // Stock validity checking
  const stockErrors = useMemo(() => {
    const errs: Array<{ itemId: string; message: string }> = [];
    bulkItems.forEach((b) => {
      if (b.quantity <= 0) {
        errs.push({ itemId: b.item._id, message: `${b.item.itemCode}: Quantity must be at least 1.` });
      }
      if (mode === 'ISSUE') {
        const availableWh = b.item.warehouseQty ?? 0;
        if (b.quantity > availableWh) {
          errs.push({
            itemId: b.item._id,
            message: `${b.item.itemCode}: Requested ${b.quantity} exceeds Warehouse stock (${availableWh} available).`,
          });
        }
      } else if (mode === 'RETURN') {
        const techBalance = techBalancesMap[b.item._id] ?? 0;
        if (b.quantity > techBalance) {
          errs.push({
            itemId: b.item._id,
            message: `${b.item.itemCode}: Return ${b.quantity} exceeds Technician stock (${techBalance} held).`,
          });
        }
      }
    });
    return errs;
  }, [bulkItems, mode, techBalancesMap]);

  // Add Item to table
  const handleAddItem = (item: IItem) => {
    const existingIndex = bulkItems.findIndex((b) => b.item._id === item._id);
    if (existingIndex >= 0) {
      setBulkItems((prev) =>
        prev.map((b, i) => (i === existingIndex ? { ...b, quantity: b.quantity + 1 } : b))
      );
    } else {
      setBulkItems((prev) => [
        ...prev,
        {
          item,
          quantity: 1,
          remarks:
            mode === 'RETURN'
              ? 'Unused / Surplus Stock Return'
              : kitName
              ? `Included in ${kitName}`
              : '',
        },
      ]);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
    setValidationAlert(null);
  };

  // Quick Preset Kit Loader
  const handleLoadKitPreset = (preset: KitPreset) => {
    setKitName(preset.name);
    // Find matching catalog items
    const matches = items.filter((item) =>
      preset.itemKeyword.some(
        (kw) =>
          item.itemName.toLowerCase().includes(kw.toLowerCase()) ||
          item.itemCode.toLowerCase().includes(kw.toLowerCase()) ||
          (item.category && item.category.toLowerCase().includes(kw.toLowerCase()))
      )
    );

    if (matches.length === 0) {
      // Fallback: take first 2 active items
      const fallback = items.slice(0, 2);
      setBulkItems(
        fallback.map((it) => ({
          item: it,
          quantity: preset.defaultQty,
          remarks: `Part of ${preset.name}`,
        }))
      );
    } else {
      // Load top 3-4 matches
      const selected = matches.slice(0, 4);
      setBulkItems(
        selected.map((it) => ({
          item: it,
          quantity: preset.defaultQty,
          remarks: `Part of ${preset.name}`,
        }))
      );
    }
    setValidationAlert(null);
  };

  // Populate all technician held items for quick return
  const handlePopulateAllTechItemsForReturn = () => {
    const list: BulkTransferItem[] = [];
    Object.entries(techBalancesMap).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const itemMatch = items.find((i) => i._id === itemId);
        if (itemMatch) {
          list.push({
            item: itemMatch,
            quantity: qty,
            remarks: 'Technician excess bag clearance return',
          });
        }
      }
    });
    if (list.length > 0) {
      setBulkItems(list);
      setValidationAlert(null);
    } else {
      setValidationAlert('This technician currently does not hold any spare parts.');
    }
  };

  // Update item quantity in table
  const handleUpdateQuantity = (index: number, newQty: number) => {
    setBulkItems((prev) =>
      prev.map((b, i) => (i === index ? { ...b, quantity: Math.max(1, newQty) } : b))
    );
  };

  // Update remarks for a line item
  const handleUpdateRemarks = (index: number, remarks: string) => {
    setBulkItems((prev) => prev.map((b, i) => (i === index ? { ...b, remarks } : b)));
  };

  // Remove item from table
  const handleRemoveItem = (index: number) => {
    setBulkItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Filter items in dropdown picker
  const filteredSearchItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items.slice(0, 8);
    }
    const q = searchQuery.toLowerCase();
    return items
      .filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          it.itemCode.toLowerCase().includes(q) ||
          (it.category && it.category.toLowerCase().includes(q)) ||
          (it.compatibleModels && it.compatibleModels.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [items, searchQuery]);

  // Click Submit Button Handler (Always Interactive & Responsive)
  const handleInitiateSubmit = () => {
    setValidationAlert(null);
    setError(null);

    if (!selectedTechId) {
      setValidationAlert('Please select a field technician first.');
      return;
    }

    if (bulkItems.length === 0) {
      setValidationAlert(
        mode === 'ISSUE'
          ? 'The table is empty! Please search and add spare parts above, or select a kit from "Quick Presets".'
          : 'The table is empty! Please add items to return, or click "Load All Held Items".'
      );
      return;
    }

    if (stockErrors.length > 0) {
      setValidationAlert(
        `Please verify stock limits: ${stockErrors.map((e) => e.message).join('; ')}`
      );
      return;
    }

    if (totalUnits >= LARGE_QUANTITY_THRESHOLD) {
      setShowLargeQtyModal(true);
      return;
    }

    // Open clean Review & Confirmation Popup Modal
    setShowConfirmModal(true);
  };

  // Execute Bulk Transfer
  const executeBulkTransfer = async () => {
    setShowConfirmModal(false);
    setShowLargeQtyModal(false);
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setValidationAlert(null);

    try {
      const formattedItems = bulkItems.map((b) => ({
        itemId: b.item._id,
        quantity: b.quantity,
        ...(mode === 'RETURN'
          ? { reason: b.remarks || 'Surplus stock return' }
          : { remarks: b.remarks }),
      }));

      const dateIso = transactionDate ? new Date(transactionDate).toISOString() : undefined;
      const parsedKitAmount =
        kitAmount && !isNaN(Number(kitAmount)) ? Number(kitAmount) : totalBoxValue;

      let res: any;
      if (mode === 'ISSUE') {
        res = await stockApi.issueBulk(
          {
            technicianId: selectedTechId,
            items: formattedItems,
            kitName: kitName.trim() || undefined,
            kitAmount: parsedKitAmount > 0 ? parsedKitAmount : undefined,
            remarks: globalRemarks.trim() || undefined,
            transactionDate: dateIso,
          },
          idempotencyKey
        );
      } else {
        res = await stockApi.returnBulk(
          {
            technicianId: selectedTechId,
            items: formattedItems,
            remarks: globalRemarks.trim() || undefined,
            transactionDate: dateIso,
          },
          idempotencyKey
        );
      }

      // Generate Official Voucher Slip Data
      const generatedVoucherNo = `${mode === 'ISSUE' ? 'ISS' : 'RET'}-${new Date()
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      setVoucherData({
        voucherNo: generatedVoucherNo,
        mode,
        date: new Date(transactionDate || Date.now()).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        technicianName: selectedTech?.name || 'Field Technician',
        kitName: kitName.trim() || undefined,
        kitAmount: parsedKitAmount > 0 ? parsedKitAmount : undefined,
        items: bulkItems.map((b) => ({
          itemCode: b.item.itemCode,
          itemName: b.item.itemName,
          quantity: b.quantity,
          unit: b.item.unit || 'pcs',
          boxPrice: b.item.newPrice ?? b.item.price ?? 0,
          portalPrice: b.item.oldPrice ?? b.item.price ?? 0,
        })),
        totalUnits,
        totalBoxValue,
        totalPortalValue,
        remarks: globalRemarks.trim() || undefined,
      });

      // Show Voucher Modal Pop-Up immediately
      setShowVoucherModal(true);

      // Reset Table state for next transfer
      setBulkItems([]);
      setKitName('');
      setKitAmount('');
      setIsKitAmountCustom(false);
      setGlobalRemarks('');
      setIdempotencyKey(`${mode === 'RETURN' ? 'ret' : 'iss'}_bulk_${crypto.randomUUID()}`);

      // Refresh catalog and technician balance
      const [updatedItems, updatedTechRes] = await Promise.all([
        itemApi.getItems({ isActive: true }),
        stockApi.getTechnicianBalance(selectedTechId),
      ]);
      setItems(updatedItems);
      const map: Record<string, number> = {};
      updatedTechRes.balances.forEach((b) => {
        map[b.item._id] = b.quantity;
      });
      setTechBalancesMap(map);
    } catch (err: any) {
      setError(
        err.response?.data?.error || `Failed to process bulk ${mode.toLowerCase()} transfer.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count how many items technician currently holds
  const totalHeldByTech = useMemo(() => {
    return Object.values(techBalancesMap).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  }, [techBalancesMap]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Printable Style Sheet for Voucher */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-voucher, #printable-voucher * {
            visibility: visible;
          }
          #printable-voucher {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header with Mode Toggle: ISSUE, RETURN, CYCLE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md transition-all ${
              mode === 'ISSUE'
                ? 'bg-gradient-to-tr from-sky-500 to-blue-700 shadow-sky-500/20'
                : mode === 'RETURN'
                ? 'bg-gradient-to-tr from-amber-500 to-emerald-700 shadow-amber-500/20'
                : 'bg-gradient-to-tr from-indigo-500 to-purple-700 shadow-indigo-500/20'
            }`}
          >
            {mode === 'ISSUE' ? (
              <ArrowUpRight className="w-6 h-6 text-white" />
            ) : mode === 'RETURN' ? (
              <RotateCcw className="w-6 h-6 text-white" />
            ) : (
              <Scale className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">
                {mode === 'ISSUE'
                  ? 'Bulk Stock & Kit Issue to Field Technician'
                  : mode === 'RETURN'
                  ? 'Bulk Stock Return from Technician to Warehouse'
                  : 'Technician Stock Cycle & Field Reconciliation'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {mode === 'ISSUE'
                ? 'Assign bulk kits & spare parts from warehouse, and record kit name and value.'
                : mode === 'RETURN'
                ? 'Receive unused or defective parts back into central warehouse in bulk.'
                : 'Complete stock cycle: Kits issued, customer site installations, returns, and current balance.'}
            </p>
          </div>
        </div>

        {/* Mode Switcher & Dedicated Stock Cycle Link */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto shrink-0 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => handleModeChange('ISSUE')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer ${
              mode === 'ISSUE'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
            Issue Kit / Stock to Tech
          </button>
          <Link
            to={selectedTechId ? `/return-stock?techId=${selectedTechId}` : '/return-stock'}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 cursor-pointer"
            title="Open Bulk Stock & Kit Return Form (Tech to Warehouse)"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1 text-teal-600" />
            Return to Warehouse (⟲)
          </Link>
          <Link
            to={selectedTechId ? `/stock-cycle?techId=${selectedTechId}` : '/stock-cycle'}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70 cursor-pointer"
            title="Open dedicated Technician Stock Cycle & Settlement (Kit Hisaab)"
          >
            <Scale className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Stock Cycle &amp; Settlement →
          </Link>
        </div>
      </div>

      {/* Validation Alert (Instant User Feedback) */}
      {validationAlert && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5 shadow-sm animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Notice:</span> {validationAlert}
          </div>
          <button
            type="button"
            onClick={() => setValidationAlert(null)}
            className="text-amber-700 hover:text-amber-950 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Server Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-rose-900">Transfer Error</h4>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Technician Selector Card (Universal for all modes) */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-indigo-600" />
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Field Technician Selection
            </label>
          </div>
          {selectedTech && (
            <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-3">
              <span>
                Phone: <strong className="text-slate-700">{selectedTech.phone}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Current Bag Stock:{' '}
                <strong className="text-indigo-600 font-mono font-bold">
                  {totalHeldByTech} units
                </strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {technicians.map((t) => {
            const isSelected = t._id === selectedTechId;
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => {
                  setSelectedTechId(t._id);
                  localStorage.setItem(LAST_TECH_STORAGE_KEY, t._id);
                  setValidationAlert(null);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.phone}</p>
                </div>
                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* MODE 1 & 2: ISSUE OR RETURN BULK FORM                                                     */}
      {/* ========================================================================================= */}
      {mode !== 'CYCLE' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
          {/* KIT & BATCH INFORMATION (Only in Issue Mode) */}
          {mode === 'ISSUE' && (
            <div className="p-4 bg-gradient-to-r from-sky-50/70 via-indigo-50/50 to-blue-50/70 rounded-2xl border border-sky-200/80 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                <span className="text-xs font-bold text-sky-950 flex items-center uppercase tracking-wider">
                  <Briefcase className="w-4 h-4 mr-1.5 text-sky-600" />
                  Kit &amp; Batch Assignment
                </span>
                <span className="text-[11px] font-semibold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md">
                  Warehouse Outward Record
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Kit Name Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kit / Batch Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pureit RO 5-Stage Service Kit #1 / Van Batch"
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                  {/* Preset Suggestions */}
                  <div className="mt-2 flex items-center flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold">Quick Presets:</span>
                    {POPULAR_KIT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleLoadKitPreset(p)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white text-sky-700 border border-sky-200 rounded-md hover:bg-sky-100 hover:border-sky-300 transition cursor-pointer"
                        title={p.description}
                      >
                        ⚡ {p.name.split('(')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kit Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Total Kit Amount (₹):
                    </label>
                    <div className="flex items-center space-x-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setKitAmount(totalBoxValue.toString());
                          setIsKitAmountCustom(false);
                        }}
                        className="text-sky-700 hover:underline font-semibold cursor-pointer"
                      >
                        Auto MRP (₹{totalBoxValue.toLocaleString('en-IN')})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setKitAmount(totalPortalValue.toString());
                          setIsKitAmountCustom(true);
                        }}
                        className="text-indigo-700 hover:underline font-semibold cursor-pointer"
                      >
                        Portal (₹{totalPortalValue.toLocaleString('en-IN')})
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 3500"
                      value={kitAmount}
                      onChange={(e) => {
                        setKitAmount(e.target.value);
                        setIsKitAmountCustom(true);
                      }}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isKitAmountCustom
                      ? '✓ Custom kit value set. This kit amount will be recorded in the ledger and technician balance.'
                      : 'Live auto-calculated based on Box MRP of selected items.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Return Helper (Only in Return Mode) */}
          {mode === 'RETURN' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-emerald-950 flex items-center">
                  <RotateCcw className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Technician Bag Clearance / Excess Return
                </h4>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  This technician currently holds a total of{' '}
                  <strong className="font-mono">{totalHeldByTech} units</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePopulateAllTechItemsForReturn}
                className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-xl transition cursor-pointer shadow-xs shrink-0"
              >
                ⚡ Load All Held Items to Return
              </button>
            </div>
          )}

          {/* SEARCH & ADD SPARE PARTS */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              {mode === 'ISSUE'
                ? 'Add Spare Parts / Filters to Bulk Kit'
                : 'Search Items to Return to Central Warehouse'}
            </label>

            <div className="relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search item code, name, category, or compatible model (e.g. GKK, SV, Pureit)..."
                  value={searchQuery}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white font-medium transition"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {isSearchOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {filteredSearchItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching items found.
                    </div>
                  ) : (
                    filteredSearchItems.map((item) => {
                      const availWh = item.warehouseQty ?? 0;
                      const heldTech = techBalancesMap[item._id] ?? 0;
                      const isAlreadyAdded = bulkItems.some((b) => b.item._id === item._id);

                      return (
                        <div
                          key={item._id}
                          onClick={() => handleAddItem(item)}
                          className="p-3 hover:bg-sky-50/60 cursor-pointer transition flex items-center justify-between text-xs"
                        >
                          <div className="pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                {item.itemCode}
                              </span>
                              <span className="font-semibold text-slate-800">{item.itemName}</span>
                              {item.category && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-3">
                              <span>
                                Warehouse Stock:{' '}
                                <strong
                                  className={`font-mono ${
                                    availWh > 0 ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {availWh} {item.unit}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Tech Holds:{' '}
                                <strong className="font-mono text-indigo-700">{heldTech}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 shrink-0">
                            <div className="text-right">
                              <div className="font-bold text-emerald-800 font-mono text-xs">
                                ₹{(item.newPrice ?? item.price ?? 0).toLocaleString('en-IN')}
                                <span className="text-[10px] text-slate-400 block">Box MRP</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`p-1.5 rounded-lg text-xs font-bold flex items-center ${
                                isAlreadyAdded
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-sky-600 text-white hover:bg-sky-700'
                              }`}
                            >
                              {isAlreadyAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BULK ITEMS TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Selected Items for Transfer ({bulkItems.length} Distinct Items)
              </span>
              {bulkItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkItems([])}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                >
                  Clear Table
                </button>
              )}
            </div>

            {bulkItems.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  No spare parts have been added to the table yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Search for items above or click a Quick Preset to load parts.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
                <div className="bg-slate-50 px-4 py-2.5 text-[11px] font-bold text-slate-600 grid grid-cols-12 gap-2 uppercase tracking-wider">
                  <div className="col-span-5 sm:col-span-4">Item Details</div>
                  <div className="col-span-2 text-center">Available</div>
                  <div className="col-span-3 sm:col-span-2 text-center">Quantity</div>
                  <div className="hidden sm:block sm:col-span-3 text-right">Line Pricing</div>
                  <div className="col-span-2 sm:col-span-1 text-center">Action</div>
                </div>

                {bulkItems.map((b, idx) => {
                  const availWh = b.item.warehouseQty ?? 0;
                  const heldTech = techBalancesMap[b.item._id] ?? 0;
                  const boxPrice = b.item.newPrice ?? b.item.price ?? 0;
                  const portalPrice = b.item.oldPrice ?? b.item.price ?? 0;
                  const lineBoxTotal = boxPrice * b.quantity;
                  const linePortalTotal = portalPrice * b.quantity;

                  const isError =
                    mode === 'ISSUE'
                      ? b.quantity > availWh
                      : b.quantity > heldTech;

                  return (
                    <div
                      key={b.item._id}
                      className={`p-3.5 grid grid-cols-12 gap-2 items-center text-xs transition ${
                        isError ? 'bg-rose-50/70' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Item Details */}
                      <div className="col-span-5 sm:col-span-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {b.item.itemCode}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {b.item.itemName}
                          </span>
                        </div>
                        {/* Line remarks / reason input */}
                        <input
                          type="text"
                          placeholder={
                            mode === 'ISSUE' ? 'Batch / Kit note...' : 'Return reason...'
                          }
                          value={b.remarks}
                          onChange={(e) => handleUpdateRemarks(idx, e.target.value)}
                          className="mt-1 w-full text-[11px] px-2 py-0.5 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 text-slate-700"
                        />
                      </div>

                      {/* Available Stock */}
                      <div className="col-span-2 text-center">
                        <span className="font-mono font-bold text-slate-800 text-[11px] block">
                          {mode === 'ISSUE' ? availWh : heldTech} {b.item.unit}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">
                          {mode === 'ISSUE' ? 'in Warehouse' : 'held by Tech'}
                        </span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="col-span-3 sm:col-span-2 flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, b.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={b.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(idx, parseInt(e.target.value) || 1)
                          }
                          className={`w-12 text-center py-1 font-mono font-bold text-xs rounded border ${
                            isError
                              ? 'border-rose-500 bg-rose-50 text-rose-900'
                              : 'border-slate-300 bg-white text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, b.quantity + 1)}
                          className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Pricing */}
                      <div className="hidden sm:block sm:col-span-3 text-right">
                        <div className="font-mono font-bold text-emerald-800 text-xs">
                          ₹{lineBoxTotal.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">Box MRP</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          ₹{linePortalTotal.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">Portal</span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-2 sm:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GLOBAL REMARKS & DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Transaction Date &amp; Time:
              </label>
              <input
                type="datetime-local"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Global Transaction Note / Dispatch Remarks:
              </label>
              <input
                type="text"
                placeholder={
                  mode === 'ISSUE'
                    ? 'e.g. Field service kit dispatch / Technician bag replenishment'
                    : 'e.g. Unused surplus clearance return'
                }
                value={globalRemarks}
                onChange={(e) => setGlobalRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>

          {/* LIVE SUMMARY BANNER */}
          {bulkItems.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <span className="font-bold flex items-center text-slate-200">
                  <Sparkles className="w-4 h-4 mr-1.5 text-amber-400" />
                  Live Bulk Valuation Summary
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-200 border border-indigo-700/50">
                  {mode === 'ISSUE' ? 'Warehouse → Technician' : 'Technician → Warehouse'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Distinct Items
                  </span>
                  <span className="text-lg font-mono font-extrabold text-white mt-0.5 block">
                    {bulkItems.length} Items
                  </span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Quantity
                  </span>
                  <span className="text-lg font-mono font-extrabold text-white mt-0.5 block">
                    {totalUnits} Units
                  </span>
                </div>

                <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center">
                    <Tag className="w-3 h-3 mr-1" /> Total Box MRP:
                  </span>
                  <span className="text-lg font-mono font-extrabold text-emerald-300 mt-0.5 block">
                    ₹{totalBoxValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                    Customer rate total
                  </span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                    <Monitor className="w-3 h-3 mr-1" /> Total Portal Rate:
                  </span>
                  <span className="text-lg font-mono font-extrabold text-slate-200 mt-0.5 block">
                    ₹{totalPortalValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Margin: +₹{totalDifference.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ACTIONS & ACTIVE SUBMIT BUTTON */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setBulkItems([]);
                setKitName('');
                setKitAmount('');
                setGlobalRemarks('');
                setError(null);
                setValidationAlert(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Reset Form
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <div className="text-xs font-semibold text-slate-600 bg-slate-100/90 border border-slate-200/90 px-3.5 py-2 rounded-xl flex items-center shrink-0">
                <User className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                <span>
                  {mode === 'ISSUE' ? 'Target Tech:' : 'Return from:'}{' '}
                  <strong className="text-slate-900 ml-1">{selectedTech?.name || 'Technician'}</strong>
                </span>
              </div>

              {/* Active & Vibrant Submit Button (Always clickable with instant feedback) */}
              <button
                id="submit-bulk-btn"
                type="button"
                onClick={handleInitiateSubmit}
                disabled={isSubmitting}
                className={`px-6 py-3 rounded-xl text-xs font-extrabold text-white transition cursor-pointer flex items-center shadow-md active:scale-95 shrink-0 ${
                  isSubmitting
                    ? 'bg-slate-400 cursor-not-allowed'
                    : bulkItems.length === 0
                    ? 'bg-slate-700 hover:bg-slate-800 ring-2 ring-slate-400/30'
                    : mode === 'ISSUE'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 shadow-sky-600/25 ring-2 ring-sky-400/30'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-600/25 ring-2 ring-emerald-400/30'
                }`}
              >
                {mode === 'ISSUE' ? (
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                {isSubmitting
                  ? 'Processing Transfer...'
                  : mode === 'ISSUE'
                  ? kitName
                    ? `Issue Kit "${kitName}" (${totalUnits} Units) to ${selectedTech?.name || 'Tech'}`
                    : bulkItems.length > 0
                    ? `Issue ${bulkItems.length} Items (${totalUnits} Units) to ${selectedTech?.name || 'Tech'}`
                    : `Issue Stock / Kit to ${selectedTech?.name || 'Tech'}`
                  : `Return ${bulkItems.length} Items (${totalUnits} Units) to Warehouse`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODE 3: REDIRECT / BANNER TO DEDICATED STOCK CYCLE PAGE                                   */}
      {/* ========================================================================================= */}
      {mode === 'CYCLE' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-8 text-center space-y-3">
          <Scale className="w-10 h-10 text-indigo-600 mx-auto" />
          <h3 className="text-base font-extrabold text-indigo-950">
            Technician Stock Cycle &amp; Settlement
          </h3>
          <p className="text-xs text-indigo-800 max-w-lg mx-auto">
            Full lifecycle accounting is now managed on the dedicated Stock Cycle page: review warehouse kit issues, customer site installations, remaining bag stock, and close/settle cycles.
          </p>
          <Link
            to={selectedTechId ? `/stock-cycle?techId=${selectedTechId}` : '/stock-cycle'}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-sm"
          >
            Open Dedicated Stock Cycle Page →
          </Link>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 1: REVIEW & CONFIRMATION POP-UP (Before Transfer Execution)                          */}
      {/* ========================================================================================= */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={
          mode === 'ISSUE'
            ? '📋 Kit & Stock Dispatch Confirmation'
            : '📋 Stock Return Confirmation'
        }
        subtitle={`Technician: ${selectedTech?.name || 'Selected Technician'}`}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2 text-xs">
          {mode === 'ISSUE' && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-800 block">
                  Kit / Batch Name:
                </span>
                <span className="font-bold text-sky-950 text-sm">
                  {kitName.trim() || 'Standard Field Stock Batch'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-sky-800 block">
                  Assigned Kit Amount:
                </span>
                <span className="font-mono font-extrabold text-sky-950 text-base">
                  ₹{Number(kitAmount || totalBoxValue).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Items Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
            <div className="bg-slate-50 px-3 py-2 font-bold text-slate-600 grid grid-cols-12 gap-2 text-[10px] uppercase">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-4 text-right">Box MRP</div>
            </div>
            {bulkItems.map((b) => (
              <div key={b.item._id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6 truncate font-medium text-slate-800">
                  <span className="font-mono font-bold text-slate-600 mr-1">{b.item.itemCode}:</span>
                  {b.item.itemName}
                </div>
                <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                  {b.quantity} {b.item.unit}
                </div>
                <div className="col-span-4 text-right font-mono font-bold text-emerald-800">
                  ₹{((b.item.newPrice ?? b.item.price ?? 0) * b.quantity).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          {/* Grand Totals */}
          <div className="bg-slate-100 p-3 rounded-xl flex items-center justify-between font-bold text-slate-800">
            <span>
              Total Units: <strong className="font-mono text-indigo-700">{totalUnits} units</strong>{' '}
              ({bulkItems.length} items)
            </span>
            <span>
              Total MRP Value:{' '}
              <strong className="font-mono text-emerald-700">
                ₹{totalBoxValue.toLocaleString('en-IN')}
              </strong>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={executeBulkTransfer}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-md disabled:opacity-50 ${
                mode === 'ISSUE'
                  ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/25'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
              }`}
            >
              {isSubmitting
                ? 'Processing...'
                : mode === 'ISSUE'
                ? `Confirm & Issue ${totalUnits} Units Now`
                : `Confirm & Return ${totalUnits} Units to Warehouse`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================================= */}
      {/* MODAL 2: SUCCESS RECEIPT / VOUCHER POP-UP (Displayed immediately on successful submit)     */}
      {/* ========================================================================================= */}
      <Modal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        title="🎉 Transfer Successful!"
        subtitle={`Voucher No: ${voucherData?.voucherNo || 'VOUCHER'}`}
        maxWidth="lg"
      >
        {voucherData && (
          <div className="space-y-4 py-2 text-xs" id="printable-voucher">
            {/* Success Green Banner */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-emerald-950">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-extrabold text-sm text-emerald-900">
                  {voucherData.mode === 'ISSUE'
                    ? 'Kit & Stock Successfully Issued to Technician!'
                    : 'Stock Successfully Returned to Central Warehouse!'}
                </h4>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Technician: <strong>{voucherData.technicianName}</strong> • Date:{' '}
                  <strong>{voucherData.date}</strong>
                </p>
                {voucherData.kitName && (
                  <p className="text-[11px] text-emerald-900 font-bold mt-1">
                    Kit Name: {voucherData.kitName}{' '}
                    {voucherData.kitAmount ? `• Amount: ₹${voucherData.kitAmount.toLocaleString('en-IN')}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Voucher Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 grid grid-cols-12 gap-2 text-[10px] uppercase">
                <div className="col-span-5">Spare Part</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Box MRP</div>
                <div className="col-span-3 text-right">Total (₹)</div>
              </div>

              {voucherData.items.map((it, i) => (
                <div key={i} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 font-medium text-slate-800 truncate">
                    <span className="font-mono font-bold mr-1 text-slate-600">{it.itemCode}</span>
                    {it.itemName}
                  </div>
                  <div className="col-span-2 text-center font-mono font-bold text-indigo-700">
                    {it.quantity} {it.unit}
                  </div>
                  <div className="col-span-2 text-right font-mono text-slate-600">
                    ₹{it.boxPrice.toLocaleString('en-IN')}
                  </div>
                  <div className="col-span-3 text-right font-mono font-bold text-emerald-800">
                    ₹{(it.boxPrice * it.quantity).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            {/* Voucher Summary Badges */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Units
                </span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  {voucherData.totalUnits} Units
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                  Total Box Value
                </span>
                <span className="font-mono font-extrabold text-emerald-900 text-sm">
                  ₹{voucherData.totalBoxValue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200">
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">
                  Portal Value
                </span>
                <span className="font-mono font-extrabold text-indigo-900 text-sm">
                  ₹{voucherData.totalPortalValue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action Buttons in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Print Voucher Slip
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoucherModal(false);
                    handleModeChange('CYCLE');
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer flex items-center"
                >
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  View Stock Cycle History
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVoucherModal(false);
                    // Form is already reset and ready for next batch!
                  }}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition cursor-pointer shadow-md"
                >
                  ➕ Issue Another Kit / Fresh Batch
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal for Large Quantity (>= 100) */}
      <Modal
        isOpen={showLargeQtyModal}
        onClose={() => setShowLargeQtyModal(false)}
        title="⚠️ Large Quantity Confirmation Alert"
        subtitle={`Threshold: ${LARGE_QUANTITY_THRESHOLD}+ units`}
        maxWidth="md"
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">
                You are entering a large batch quantity of {totalUnits} total units.
              </p>
              <p className="mt-1 text-amber-800">
                Mode: <span className="font-semibold">{mode === 'ISSUE' ? 'Issue to Tech' : 'Return from Tech'}</span>
                <br />
                Technician: <span className="font-semibold text-slate-900">{selectedTech?.name}</span>
                <br />
                Distinct Items: <span className="font-semibold">{bulkItems.length}</span>
                <br />
                Total Box MRP Value: <span className="font-semibold">₹{totalBoxValue.toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>
          <p className="text-slate-600">
            Are you sure you want to proceed with transferring this large stock quantity?
          </p>
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowLargeQtyModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={executeBulkTransfer}
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Processing Transfer...' : `Yes, Transfer ${totalUnits} Units`}
            </button>
          </div>
        </div>
      </Modal>

      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
