import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { itemApi, technicianApi, stockApi } from '../services/api';
import { IItem, IUser } from '../types';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import { Modal } from '../components/common/Modal';
import { LAST_TECH_STORAGE_KEY } from '../constants/stock';
import {
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
  Package,
  Sparkles,
  Warehouse,
  Check,
  Printer,
  FileText,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowUpRight,
  Scale,
  RefreshCw,
  Info,
  Clock,
  CheckCheck,
  SlidersHorizontal,
  Monitor,
  Filter,
} from 'lucide-react';

export interface BulkReturnItem {
  item: IItem;
  quantity: number;
  condition: 'GOOD' | 'DEFECTIVE';
  reason: string;
}

const COMMON_RETURN_REASONS = [
  'Unused / Surplus Stock Return',
  'Defective / Damaged Part (Quarantine)',
  'Customer Ticket Cancelled',
  'Incorrect Model / Specification Mismatch',
  'Old Part Replaced On-Site',
  'Technician Route Clearance / Handover',
];

const RETURN_BATCH_PRESETS = [
  {
    name: 'Unused / Surplus Kit Handover',
    reason: 'Unused / Surplus Stock Return',
    condition: 'GOOD' as const,
  },
  {
    name: 'Weekly Van Stock Clearance',
    reason: 'Technician Route Clearance / Handover',
    condition: 'GOOD' as const,
  },
  {
    name: 'Customer Cancelled Ticket Return',
    reason: 'Customer Ticket Cancelled',
    condition: 'GOOD' as const,
  },
  {
    name: 'Defective / Damaged Parts Quarantine',
    reason: 'Defective / Damaged Part (Quarantine)',
    condition: 'DEFECTIVE' as const,
  },
  {
    name: 'Pureit GKK Replacement Pack Return',
    reason: 'Unused / Surplus Stock Return',
    condition: 'GOOD' as const,
  },
];

export const ReturnStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<IItem[]>([]);
  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected technician & their current held stock
  const [selectedTechId, setSelectedTechId] = useState('');
  const [techBalancesMap, setTechBalancesMap] = useState<Record<string, number>>({});
  const [isLoadingTechBalance, setIsLoadingTechBalance] = useState(false);

  // Return Batch Header state (Mirroring Kit Issue name & valuation)
  const [returnBatchName, setReturnBatchName] = useState('');
  const [globalReturnReason, setGlobalReturnReason] = useState(COMMON_RETURN_REASONS[0]);
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [customReturnAmount, setCustomReturnAmount] = useState<string>('');
  const [isCustomAmountSet, setIsCustomAmountSet] = useState(false);

  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `ret_bulk_${crypto.randomUUID()}`
  );

  // Items chosen for return manifest
  const [bulkItems, setBulkItems] = useState<BulkReturnItem[]>([]);

  // Bulk Multi-Select Picker State for Technician's Bag
  const [bagSearchQuery, setBagSearchQuery] = useState('');
  const [bagCategoryFilter, setBagCategoryFilter] = useState('ALL');
  const [selectedBagItemIds, setSelectedBagItemIds] = useState<Set<string>>(new Set());
  const [bagItemQtyDrafts, setBagItemQtyDrafts] = useState<Record<string, number>>({});
  const [bagItemConditionDrafts, setBagItemConditionDrafts] = useState<Record<string, 'GOOD' | 'DEFECTIVE'>>({});

  // Fast Autocomplete Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Modals & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voucher Receipt Modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherData, setVoucherData] = useState<{
    voucherNo: string;
    date: string;
    technicianName: string;
    technicianPhone: string;
    returnBatchName?: string;
    items: Array<{
      itemCode: string;
      itemName: string;
      quantity: number;
      unit: string;
      condition: string;
      boxPrice: number;
      portalPrice: number;
      reason: string;
    }>;
    totalUnits: number;
    totalBoxValue: number;
    totalPortalValue: number;
    remarks?: string;
  } | null>(null);

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Load Technicians & Items
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        setIsLoading(true);
        const [techData, itemData] = await Promise.all([
          technicianApi.getTechnicians(),
          itemApi.getItems(),
        ]);
        setTechnicians(techData);
        setItems(itemData);

        const urlTechId = searchParams.get('techId');
        const lastTechId = localStorage.getItem(LAST_TECH_STORAGE_KEY);
        const validTechId =
          urlTechId && techData.some((t: IUser) => t._id === urlTechId)
            ? urlTechId
            : lastTechId && techData.some((t: IUser) => t._id === lastTechId)
            ? lastTechId
            : techData[0]?._id || '';

        if (validTechId) {
          setSelectedTechId(validTechId);
        }
      } catch (err) {
        console.error('Failed to load master data', err);
        setError('Failed to load technicians or catalog items.');
      } finally {
        setIsLoading(false);
      }
    };
    loadMasterData();
  }, [searchParams]);

  // Load selected technician's live balance whenever selected technician changes
  useEffect(() => {
    if (!selectedTechId) {
      setTechBalancesMap({});
      setBulkItems([]);
      setSelectedBagItemIds(new Set());
      setBagItemQtyDrafts({});
      return;
    }

    const fetchTechStock = async () => {
      try {
        setIsLoadingTechBalance(true);
        const res = await stockApi.getTechnicianBalance(selectedTechId);
        const map: Record<string, number> = {};
        res.balances.forEach((b: any) => {
          map[b.item._id] = b.quantity;
        });
        setTechBalancesMap(map);

        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set('techId', selectedTechId);
          return p;
        });
        localStorage.setItem(LAST_TECH_STORAGE_KEY, selectedTechId);

        // Pre-fill return batch name if empty
        const techObj = technicians.find((t) => t._id === selectedTechId);
        if (techObj && !returnBatchName) {
          setReturnBatchName(`${techObj.name} - Warehouse Return`);
        }
      } catch (err) {
        console.error('Failed to fetch technician balance', err);
      } finally {
        setIsLoadingTechBalance(false);
      }
    };

    fetchTechStock();
  }, [selectedTechId, technicians, setSearchParams]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedTech = useMemo(
    () => technicians.find((t) => t._id === selectedTechId),
    [technicians, selectedTechId]
  );

  // Total held units in technician's bag
  const totalHeldByTech = useMemo(
    () => Object.values(techBalancesMap).reduce((sum, q) => sum + (q > 0 ? q : 0), 0),
    [techBalancesMap]
  );

  // Valuation of total stock in technician's bag
  const totalHeldValuation = useMemo(() => {
    return Object.entries(techBalancesMap).reduce((sum, [itemId, qty]) => {
      if (qty <= 0) return sum;
      const it = items.find((i) => i._id === itemId);
      const price = it?.newPrice ?? it?.price ?? 0;
      return sum + price * qty;
    }, 0);
  }, [techBalancesMap, items]);

  // List of all items currently held in technician's bag
  const heldItemsList = useMemo(() => {
    return items
      .filter((i) => (techBalancesMap[i._id] ?? 0) > 0)
      .map((item) => ({
        item,
        heldQty: techBalancesMap[item._id] ?? 0,
      }));
  }, [items, techBalancesMap]);

  // Categories present in held items
  const heldCategories = useMemo(() => {
    const set = new Set<string>();
    heldItemsList.forEach((h) => {
      if (h.item.category) set.add(h.item.category);
    });
    return Array.from(set);
  }, [heldItemsList]);

  // Filtered items in the Bulk Bag Selector
  const filteredBagItems = useMemo(() => {
    return heldItemsList.filter(({ item }) => {
      if (bagCategoryFilter !== 'ALL' && item.category !== bagCategoryFilter) {
        return false;
      }
      if (bagSearchQuery.trim()) {
        const q = bagSearchQuery.toLowerCase().trim();
        return (
          item.itemCode.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [heldItemsList, bagCategoryFilter, bagSearchQuery]);

  // Filtered items in autocomplete search: ONLY search within items held in this technician's bag!
  const filteredSearchItems = useMemo(() => {
    const heldItems = heldItemsList.map((h) => h.item);
    if (!searchQuery.trim()) return heldItems;
    const q = searchQuery.toLowerCase().trim();
    return heldItems.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.compatibleModels && item.compatibleModels.toLowerCase().includes(q))
    );
  }, [heldItemsList, searchQuery]);

  // Total return metrics
  const totalUnits = useMemo(
    () => bulkItems.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0),
    [bulkItems]
  );

  const totalBoxValue = useMemo(() => {
    return bulkItems.reduce((acc, b) => {
      const p = b.item.newPrice ?? b.item.price ?? 0;
      return acc + p * (Number(b.quantity) || 0);
    }, 0);
  }, [bulkItems]);

  const totalPortalValue = useMemo(() => {
    return bulkItems.reduce((acc, b) => {
      const p = b.item.oldPrice ?? b.item.price ?? 0;
      return acc + p * (Number(b.quantity) || 0);
    }, 0);
  }, [bulkItems]);

  const totalDifference = useMemo(() => {
    return totalBoxValue - totalPortalValue;
  }, [totalBoxValue, totalPortalValue]);

  // Breakdown of Good vs Defective items
  const goodUnitsCount = useMemo(
    () => bulkItems.filter((b) => b.condition === 'GOOD').reduce((acc, b) => acc + b.quantity, 0),
    [bulkItems]
  );
  const defectiveUnitsCount = useMemo(
    () => bulkItems.filter((b) => b.condition === 'DEFECTIVE').reduce((acc, b) => acc + b.quantity, 0),
    [bulkItems]
  );

  // Handlers for managing items in the return table
  const handleAddItem = (item: IItem, initialQty = 1) => {
    const heldQty = techBalancesMap[item._id] ?? 0;
    if (heldQty <= 0) {
      setValidationAlert(
        `[${item.itemCode}] ${item.itemName} is not in ${selectedTech?.name || 'this technician'}'s bag (Balance: 0). You can only return items held by the technician.`
      );
      return;
    }
    const existingIndex = bulkItems.findIndex((b) => b.item._id === item._id);

    if (existingIndex >= 0) {
      setBulkItems((prev) =>
        prev.map((b, idx) =>
          idx === existingIndex
            ? {
                ...b,
                quantity: Math.min(heldQty, b.quantity + initialQty),
              }
            : b
        )
      );
    } else {
      setBulkItems((prev) => [
        ...prev,
        {
          item,
          quantity: Math.min(heldQty, initialQty),
          condition: 'GOOD',
          reason: globalReturnReason,
        },
      ]);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
    setValidationAlert(null);
  };

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    const held = techBalancesMap[itemId] ?? 0;
    const clampedQty = Math.max(1, held > 0 ? Math.min(held, newQty) : newQty);
    setBulkItems((prev) =>
      prev.map((b) => (b.item._id === itemId ? { ...b, quantity: clampedQty } : b))
    );
  };

  const handleUpdateItemCondition = (itemId: string, condition: 'GOOD' | 'DEFECTIVE') => {
    setBulkItems((prev) =>
      prev.map((b) =>
        b.item._id === itemId
          ? {
              ...b,
              condition,
              reason:
                condition === 'DEFECTIVE'
                  ? 'Defective / Damaged Part (Quarantine)'
                  : b.reason,
            }
          : b
      )
    );
  };

  const handleUpdateItemReason = (itemId: string, reason: string) => {
    setBulkItems((prev) =>
      prev.map((b) => (b.item._id === itemId ? { ...b, reason } : b))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setBulkItems((prev) => prev.filter((b) => b.item._id !== itemId));
  };

  // 1-Click Load Entire Bag into Return Table
  const handleLoadEntireBag = () => {
    if (heldItemsList.length === 0) {
      setValidationAlert('This technician currently has 0 items in their bag.');
      return;
    }
    const allItems: BulkReturnItem[] = heldItemsList.map(({ item, heldQty }) => ({
      item,
      quantity: heldQty,
      condition: 'GOOD',
      reason: globalReturnReason,
    }));
    setBulkItems(allItems);
    setValidationAlert(null);
  };

  // Bulk Multi-Select Handlers
  const handleToggleSelectBagItem = (itemId: string) => {
    setSelectedBagItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAllFilteredBagItems = () => {
    setSelectedBagItemIds((prev) => {
      const next = new Set(prev);
      filteredBagItems.forEach(({ item }) => next.add(item._id));
      return next;
    });
  };

  const handleDeselectAllBagItems = () => {
    setSelectedBagItemIds(new Set());
  };

  const handleAddSelectedBagItemsToManifest = () => {
    if (selectedBagItemIds.size === 0) {
      setValidationAlert('Please select at least one item from the technician’s bag using checkboxes.');
      return;
    }

    const itemsToAdd: BulkReturnItem[] = [];
    selectedBagItemIds.forEach((itemId) => {
      const match = heldItemsList.find((h) => h.item._id === itemId);
      if (!match) return;

      const qty = bagItemQtyDrafts[itemId] ?? match.heldQty;
      const condition = bagItemConditionDrafts[itemId] ?? 'GOOD';
      const reason =
        condition === 'DEFECTIVE'
          ? 'Defective / Damaged Part (Quarantine)'
          : globalReturnReason;

      itemsToAdd.push({
        item: match.item,
        quantity: Math.min(match.heldQty, Math.max(1, qty)),
        condition,
        reason,
      });
    });

    // Merge into bulkItems
    setBulkItems((prev) => {
      const map = new Map<string, BulkReturnItem>();
      prev.forEach((b) => map.set(b.item._id, b));
      itemsToAdd.forEach((b) => map.set(b.item._id, b));
      return Array.from(map.values());
    });

    setSelectedBagItemIds(new Set());
    setValidationAlert(null);
  };

  // Preset Selector
  const handleApplyPreset = (preset: (typeof RETURN_BATCH_PRESETS)[0]) => {
    setReturnBatchName(`${selectedTech?.name || 'Technician'} - ${preset.name}`);
    setGlobalReturnReason(preset.reason);
    setBulkItems((prev) =>
      prev.map((b) => ({
        ...b,
        condition: preset.condition,
        reason: preset.reason,
      }))
    );
  };

  // Batch Table Operations
  const handleMarkAllGood = () => {
    setBulkItems((prev) =>
      prev.map((b) => ({
        ...b,
        condition: 'GOOD',
        reason: 'Unused / Surplus Stock Return',
      }))
    );
  };

  const handleMarkAllDefective = () => {
    setBulkItems((prev) =>
      prev.map((b) => ({
        ...b,
        condition: 'DEFECTIVE',
        reason: 'Defective / Damaged Part (Quarantine)',
      }))
    );
  };

  // Validation before opening confirm modal
  const handleInitiateSubmit = () => {
    setError(null);
    setValidationAlert(null);

    if (!selectedTechId) {
      setValidationAlert('Please select a field technician who is returning the stock.');
      return;
    }

    if (bulkItems.length === 0) {
      setValidationAlert(
        'The return manifest is empty! Please select items from the technician’s bag to return.'
      );
      return;
    }

    // Validate quantities against held bag stock
    for (const b of bulkItems) {
      const held = techBalancesMap[b.item._id] ?? 0;
      if (b.quantity <= 0) {
        setValidationAlert(`Quantity for ${b.item.itemCode} must be at least 1.`);
        return;
      }
      if (b.quantity > held) {
        setValidationAlert(
          `Requested return of ${b.quantity} for [${b.item.itemCode}] exceeds technician's held stock (${held} held).`
        );
        return;
      }
    }

    setShowConfirmModal(true);
  };

  // Execute Bulk Return API call
  const handleExecuteReturn = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setError(null);

    try {
      const payloadItems = bulkItems.map((b) => ({
        itemId: b.item._id,
        quantity: b.quantity,
        reason: `${b.condition === 'DEFECTIVE' ? '[DEFECTIVE] ' : ''}${b.reason.trim()}`,
      }));

      const finalRemarks = [
        returnBatchName.trim() ? `Batch: ${returnBatchName.trim()}` : '',
        isCustomAmountSet && customReturnAmount ? `Agreed Valuation: ₹${customReturnAmount}` : '',
        globalRemarks.trim(),
      ]
        .filter(Boolean)
        .join(' | ');

      await stockApi.returnBulk(
        {
          technicianId: selectedTechId,
          items: payloadItems,
          remarks: finalRemarks || 'Bulk warehouse return',
          transactionDate: transactionDate ? new Date(transactionDate).toISOString() : undefined,
        },
        idempotencyKey
      );

      // Create Voucher data for instant receipt display
      const vNo = `MRR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      setVoucherData({
        voucherNo: vNo,
        date: transactionDate ? new Date(transactionDate).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
        technicianName: selectedTech?.name || 'Technician',
        technicianPhone: selectedTech?.phone || '',
        returnBatchName: returnBatchName.trim() || 'Warehouse Return Handover',
        items: bulkItems.map((b) => ({
          itemCode: b.item.itemCode,
          itemName: b.item.itemName,
          quantity: b.quantity,
          unit: b.item.unit,
          condition: b.condition === 'DEFECTIVE' ? 'Defective / Damaged' : 'Good / Reusable',
          boxPrice: b.item.newPrice ?? b.item.price ?? 0,
          portalPrice: b.item.oldPrice ?? b.item.price ?? 0,
          reason: b.reason,
        })),
        totalUnits,
        totalBoxValue: isCustomAmountSet && customReturnAmount ? Number(customReturnAmount) : totalBoxValue,
        totalPortalValue,
        remarks: finalRemarks,
      });

      setShowVoucherModal(true);

      // Reset form
      setBulkItems([]);
      setReturnBatchName('');
      setGlobalRemarks('');
      setCustomReturnAmount('');
      setIsCustomAmountSet(false);
      setSelectedBagItemIds(new Set());
      setIdempotencyKey(`ret_bulk_${crypto.randomUUID()}`);

      // Refresh technician balance
      const balRes = await stockApi.getTechnicianBalance(selectedTechId);
      const newMap: Record<string, number> = {};
      balRes.balances.forEach((b: any) => {
        newMap[b.item._id] = b.quantity;
      });
      setTechBalancesMap(newMap);
    } catch (err: any) {
      console.error('Error executing bulk return', err);
      setError(
        err.response?.data?.error || 'Failed to process bulk return. Please check items and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <div className="w-9 h-9 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading bulk return portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Unified Mode Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-700 shadow-teal-600/20 text-white flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">
                Bulk Stock &amp; Kit Return to Warehouse
              </h2>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                Warehouse Inward (⟲)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Receive unused spare kits, excess van stock, or defective parts back from field technicians into central warehouse custody.
            </p>
          </div>
        </div>

        {/* Linked Action Tabs */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto shrink-0 flex-wrap gap-1">
          <Link
            to={selectedTechId ? `/issue?techId=${selectedTechId}` : '/issue'}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer"
            title="Switch to Outward Issue Form"
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-sky-600" />
            Issue Kit / Stock (→)
          </Link>

          <button
            type="button"
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center bg-teal-600 text-white shadow-xs cursor-default"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Return to Warehouse (⟲)
          </button>

          <Link
            to={selectedTechId ? `/stock-cycle?techId=${selectedTechId}` : '/stock-cycle'}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70 cursor-pointer"
            title="Open dedicated Technician Stock Cycle & Settlement (Kit Hisaab)"
          >
            <Scale className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Stock Cycle Hisaab →
          </Link>

          <Link
            to="/returns"
            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer"
            title="Pending field return requests"
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Requests
          </Link>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-white transition cursor-pointer"
            title="User Manual Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Validation & Server Error Banners */}
      {validationAlert && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start space-x-3 shadow-sm animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Attention:</span> {validationAlert}
          </div>
          <button
            type="button"
            onClick={() => setValidationAlert(null)}
            className="text-amber-700 hover:text-amber-950 font-bold ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start space-x-3 shadow-sm animate-in fade-in duration-150">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-sm block">Return Error</span>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-950 font-bold ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1: Technician Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-teal-600" />
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Select Returning Field Technician
            </label>
          </div>

          {selectedTech && (
            <div className="text-[11px] text-slate-600 font-medium flex items-center space-x-3">
              <span>
                Phone: <strong className="text-slate-800">{selectedTech.phone}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Current Bag Stock:{' '}
                <strong className="text-teal-700 font-mono font-bold">
                  {totalHeldByTech} units
                </strong>{' '}
                (₹{totalHeldValuation.toLocaleString('en-IN')})
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
                  setValidationAlert(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t.phone} {t.area ? `· [${t.area}]` : ''}
                  </p>
                </div>
                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Return Form Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
        {/* Step 2: Return Batch & Kit Assignment Details (Mirroring Kit Issue name & valuation) */}
        <div className="p-4 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-slate-50 rounded-2xl border border-teal-200/80 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-teal-100">
            <span className="text-xs font-bold text-teal-950 flex items-center uppercase tracking-wider">
              <Briefcase className="w-4 h-4 mr-1.5 text-teal-600" />
              2. Return Batch &amp; Handover Details
            </span>
            <span className="text-[11px] font-semibold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md">
              Warehouse Inward Receipt (MRR)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Return Batch Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Return Batch / Kit Name:
              </label>
              <input
                type="text"
                placeholder="e.g. Weekly Van Stock Return / Surplus Kit Handover"
                value={returnBatchName}
                onChange={(e) => setReturnBatchName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              />
              {/* Presets */}
              <div className="mt-2 flex items-center flex-wrap gap-1">
                <span className="text-[10px] text-slate-400 font-semibold">Presets:</span>
                {RETURN_BATCH_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[10px] bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md font-medium cursor-pointer transition"
                  >
                    {p.name.split('(')[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Kit Valuation / Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Return Valuation (₹):
                </label>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomReturnAmount(totalBoxValue.toString());
                      setIsCustomAmountSet(false);
                    }}
                    className="text-teal-700 hover:underline font-semibold cursor-pointer"
                  >
                    Box MRP (₹{totalBoxValue.toLocaleString('en-IN')})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomReturnAmount(totalPortalValue.toString());
                      setIsCustomAmountSet(true);
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
                  value={isCustomAmountSet ? customReturnAmount : totalBoxValue}
                  onChange={(e) => {
                    setCustomReturnAmount(e.target.value);
                    setIsCustomAmountSet(true);
                  }}
                  className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold text-slate-900"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {isCustomAmountSet
                  ? '✓ Custom return valuation entered.'
                  : 'Live calculated based on Box MRP of returned items.'}
              </p>
            </div>

            {/* Handover Date & Timestamp */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Return Date &amp; Time:
              </label>
              <input
                type="datetime-local"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Official handover timestamp for audit trail.
              </span>
            </div>
          </div>
        </div>

        {/* Step 3: BULK MULTI-ITEM SELECTOR (The key feature requested by user!) */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Select Multiple Items from Technician's Bag (Bulk Selection)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedTech?.name || 'Technician'} currently holds{' '}
                <strong className="text-slate-900 font-bold">{heldItemsList.length} distinct spare parts</strong> ({totalHeldByTech} units). Check items to add them in bulk.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleLoadEntireBag}
                disabled={heldItemsList.length === 0}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs flex items-center ${
                  heldItemsList.length > 0
                    ? 'bg-teal-700 text-white hover:bg-teal-800 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title="Stage every single item currently in technician's bag for return"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                ⚡ Load All Held Items ({totalHeldByTech} Units)
              </button>
            </div>
          </div>

          {/* Bag Items Search & Category Filter Pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter parts in bag (e.g. GKK, UV Lamp, RO Membrane)..."
                value={bagSearchQuery}
                onChange={(e) => setBagSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
              <button
                type="button"
                onClick={() => setBagCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                  bagCategoryFilter === 'ALL'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Held ({heldItemsList.length})
              </button>
              {heldCategories.map((cat) => {
                const count = heldItemsList.filter((h) => h.item.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBagCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      bagCategoryFilter === cat
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSelectAllFilteredBagItems}
                className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer flex items-center"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Select All ({filteredBagItems.length})
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAllBagItems}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Deselect All
              </button>
              {selectedBagItemIds.size > 0 && (
                <span className="text-[11px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {selectedBagItemIds.size} items selected
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleAddSelectedBagItemsToManifest}
                disabled={selectedBagItemIds.size === 0}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center shadow-xs ${
                  selectedBagItemIds.size > 0
                    ? 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Selected ({selectedBagItemIds.size}) to Return Table
              </button>
            </div>
          </div>

          {/* Interactive Bag Items Grid */}
          {heldItemsList.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white space-y-1">
              <Package className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Technician’s bag is currently empty.</p>
              <p className="text-[11px] text-slate-400">
                No spare parts are currently recorded under {selectedTech?.name || 'this technician'}.
              </p>
            </div>
          ) : filteredBagItems.length === 0 ? (
            <div className="p-4 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              No held items match the filter or search query.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1">
              {filteredBagItems.map(({ item, heldQty }) => {
                const isSelected = selectedBagItemIds.has(item._id);
                const isAlreadyInManifest = bulkItems.some((b) => b.item._id === item._id);
                const draftQty = bagItemQtyDrafts[item._id] ?? heldQty;
                const draftCondition = bagItemConditionDrafts[item._id] ?? 'GOOD';
                const boxPrice = item.newPrice ?? item.price ?? 0;
                const portalPrice = item.oldPrice ?? item.price ?? 0;

                return (
                  <div
                    key={item._id}
                    className={`p-3 rounded-xl border transition text-xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-400'
                        : isAlreadyInManifest
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Checkbox & SKU Header */}
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start space-x-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectBagItem(item._id)}
                            className="w-4 h-4 mt-0.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                          />
                          <div className="truncate">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-[10px] mr-1">
                              {item.itemCode}
                            </span>
                            <span className="font-bold text-slate-900 text-xs block truncate mt-0.5">
                              {item.itemName}
                            </span>
                          </div>
                        </label>
                        {item.category && (
                          <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>

                      {/* Stock in bag & Pricing */}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                        <span>
                          Held in Bag: <strong className="font-mono text-teal-700 font-bold">{heldQty} {item.unit}</strong>
                        </span>
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-800">₹{boxPrice.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-slate-400 block">Box MRP</span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Condition Controls on the card */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = bagItemQtyDrafts[item._id] ?? heldQty;
                            setBagItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: Math.max(1, cur - 1),
                            }));
                          }}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={heldQty}
                          value={draftQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setBagItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: Math.min(heldQty, Math.max(1, val)),
                            }));
                          }}
                          className="w-10 text-center py-0.5 font-mono font-bold text-xs bg-white border border-slate-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = bagItemQtyDrafts[item._id] ?? heldQty;
                            setBagItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: Math.min(heldQty, cur + 1),
                            }));
                          }}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBagItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: heldQty,
                            }))
                          }
                          className="text-[9px] font-bold text-teal-700 hover:underline px-0.5"
                          title="Set to max held qty"
                        >
                          Max
                        </button>
                      </div>

                      <select
                        value={draftCondition}
                        onChange={(e) =>
                          setBagItemConditionDrafts((prev) => ({
                            ...prev,
                            [item._id]: e.target.value as any,
                          }))
                        }
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          draftCondition === 'GOOD'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <option value="GOOD">Good</option>
                        <option value="DEFECTIVE">Defective</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleAddItem(item, draftQty)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isAlreadyInManifest
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                        title={isAlreadyInManifest ? 'In Manifest' : 'Add to manifest'}
                      >
                        {isAlreadyInManifest ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fast Autocomplete Search Bar (Only searches parts in this technician's bag) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Search Part in {selectedTech?.name || 'Technician'}&apos;s Bag ({heldItemsList.length} Held SKUs)
          </label>
          <div className="relative" ref={searchContainerRef}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  heldItemsList.length === 0
                    ? `${selectedTech?.name || 'Technician'} has 0 items in bag...`
                    : `Search part code or name in ${selectedTech?.name || 'technician'}'s bag (${heldItemsList.length} SKUs held)...`
                }
                disabled={heldItemsList.length === 0}
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                className={`w-full pl-10 pr-4 py-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 font-medium ${
                  heldItemsList.length === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredSearchItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching parts found in {selectedTech?.name || 'this technician'}&apos;s bag.
                  </div>
                ) : (
                  filteredSearchItems.map((item) => {
                    const heldTech = techBalancesMap[item._id] ?? 0;
                    const isAlreadyAdded = bulkItems.some((b) => b.item._id === item._id);

                    return (
                      <div
                        key={item._id}
                        onClick={() => handleAddItem(item)}
                        className="p-3 hover:bg-teal-50/60 cursor-pointer transition flex items-center justify-between text-xs"
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
                              Held in Bag:{' '}
                              <strong className="font-mono text-teal-700 font-bold">
                                {heldTech} {item.unit}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Box MRP:{' '}
                              <strong className="font-mono text-slate-800">
                                ₹{(item.newPrice ?? item.price ?? 0).toLocaleString('en-IN')}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <button
                            type="button"
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center ${
                              isAlreadyAdded
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-teal-600 text-white hover:bg-teal-700'
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

        {/* Step 4: Staged Return Manifest Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
              <FileText className="w-4 h-4 mr-1 text-teal-600" />
              4. Return Manifest ({bulkItems.length} Distinct Items Staged)
            </span>

            {bulkItems.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={handleMarkAllGood}
                  className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-medium cursor-pointer"
                >
                  Mark All Good (Restock)
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllDefective}
                  className="px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-medium cursor-pointer"
                >
                  Mark All Defective (Quarantine)
                </button>
                <button
                  type="button"
                  onClick={() => setBulkItems([])}
                  className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {bulkItems.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <Package className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No items selected for return yet.</p>
              <p className="text-[11px] text-slate-400">
                Use the <strong>Bulk Selector checkboxes</strong> above or click <strong>"Load All Held Items"</strong> to stage parts.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Item SKU &amp; Name</th>
                      <th className="py-3 px-3 text-center">In Bag Qty</th>
                      <th className="py-3 px-3 text-center">Return Qty</th>
                      <th className="py-3 px-3">Condition</th>
                      <th className="py-3 px-3 text-right">Box MRP (₹)</th>
                      <th className="py-3 px-3 text-right">Portal Price (₹)</th>
                      <th className="py-3 px-3 text-right">Line Total (₹)</th>
                      <th className="py-3 px-3">Return Reason</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkItems.map((b) => {
                      const heldQty = techBalancesMap[b.item._id] ?? 0;
                      const boxPrice = b.item.newPrice ?? b.item.price ?? 0;
                      const portalPrice = b.item.oldPrice ?? b.item.price ?? 0;
                      const lineTotal = boxPrice * b.quantity;

                      return (
                        <tr key={b.item._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                              {b.item.itemCode}
                            </span>
                            <span className="font-bold text-slate-900">{b.item.itemName}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {b.item.category}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                            {heldQty} {b.item.unit}
                          </td>

                          {/* Return Qty with +/- and Max */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(b.item._id, b.quantity - 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={heldQty}
                                value={b.quantity}
                                onChange={(e) =>
                                  handleUpdateItemQty(b.item._id, parseInt(e.target.value, 10) || 1)
                                }
                                className="w-14 text-center py-1 font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(b.item._id, b.quantity + 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                              {heldQty > 0 && b.quantity !== heldQty && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(b.item._id, heldQty)}
                                  className="text-[9px] font-bold text-teal-700 hover:underline px-1"
                                  title="Return all held units of this item"
                                >
                                  Max
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Condition Selector */}
                          <td className="py-3 px-3">
                            <select
                              value={b.condition}
                              onChange={(e) =>
                                handleUpdateItemCondition(b.item._id, e.target.value as any)
                              }
                              className={`px-2 py-1 text-[11px] font-bold rounded-lg border focus:ring-2 focus:ring-teal-500 ${
                                b.condition === 'GOOD'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              <option value="GOOD">🟢 Good / Reusable</option>
                              <option value="DEFECTIVE">🔴 Defective / Damaged</option>
                            </select>
                          </td>

                          {/* Box MRP */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                            ₹{boxPrice.toLocaleString('en-IN')}
                          </td>

                          {/* Portal Price */}
                          <td className="py-3 px-3 text-right font-mono text-slate-500">
                            ₹{portalPrice.toLocaleString('en-IN')}
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-teal-800">
                            ₹{lineTotal.toLocaleString('en-IN')}
                          </td>

                          {/* Reason */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={b.reason}
                              onChange={(e) => handleUpdateItemReason(b.item._id, e.target.value)}
                              placeholder="Reason..."
                              className="w-full min-w-[140px] px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-800"
                            />
                          </td>

                          {/* Delete */}
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(b.item._id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

        {/* Step 5: Valuation & Audit Summary Card (Luxury Dark Card matching Issue Stock) */}
        {bulkItems.length > 0 && (
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center">
                <Scale className="w-4 h-4 mr-1.5" />
                Return Summary &amp; Warehouse Inward Impact
              </span>
              <span className="text-[11px] text-slate-400">
                Returning Tech: <strong className="text-white">{selectedTech?.name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                  <Package className="w-3 h-3 mr-1" /> Total Return Units:
                </span>
                <span className="text-lg font-mono font-extrabold text-white mt-0.5 block">
                  {totalUnits} Units
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Across {bulkItems.length} distinct parts
                </span>
              </div>

              <div className="bg-teal-950/40 p-3 rounded-xl border border-teal-500/30">
                <span className="text-[10px] uppercase font-bold text-teal-400 block flex items-center">
                  <Tag className="w-3 h-3 mr-1" /> Total Box MRP:
                </span>
                <span className="text-lg font-mono font-extrabold text-teal-300 mt-0.5 block">
                  ₹{totalBoxValue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-teal-400/80 block mt-0.5">
                  Customer rate valuation
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

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Condition Split:
                </span>
                <div className="text-[11px] font-bold mt-1 space-y-0.5">
                  <span className="text-emerald-400 block">🟢 {goodUnitsCount} Good Units</span>
                  <span className="text-rose-400 block">🔴 {defectiveUnitsCount} Defective Units</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Remarks */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Storekeeper Handover Remarks / Physical Inspection Notes <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Physical stock inspected and verified by warehouse storekeeper. Seal intact."
            value={globalRemarks}
            onChange={(e) => setGlobalRemarks(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 text-slate-800"
          />
        </div>

        {/* Submit Actions Bar */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setBulkItems([]);
              setReturnBatchName('');
              setGlobalRemarks('');
              setCustomReturnAmount('');
              setIsCustomAmountSet(false);
              setSelectedBagItemIds(new Set());
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            Reset Form
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3.5 py-2 rounded-xl flex items-center shrink-0">
              <User className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              <span>
                Returning Tech:{' '}
                <strong className="text-slate-900 ml-1">{selectedTech?.name || 'Technician'}</strong>
              </span>
            </div>

            <button
              id="submit-bulk-return-btn"
              type="button"
              onClick={handleInitiateSubmit}
              disabled={isSubmitting}
              className={`px-6 py-3 rounded-xl text-xs font-extrabold text-white transition cursor-pointer flex items-center shadow-md active:scale-95 shrink-0 ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : bulkItems.length === 0
                  ? 'bg-slate-700 hover:bg-slate-800 ring-2 ring-slate-400/30'
                  : 'bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 shadow-teal-600/25 ring-2 ring-teal-400/30'
              }`}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isSubmitting
                ? 'Processing Return...'
                : bulkItems.length > 0
                ? `Receive ${totalUnits} Units (₹${totalBoxValue.toLocaleString('en-IN')}) into Warehouse`
                : 'Select Items to Return'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: REVIEW & CONFIRMATION POP-UP */}
      <Modal
        id="modal-confirm-return"
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="📋 Confirm Warehouse Stock Return"
        subtitle={`Receiving stock from ${selectedTech?.name || 'Technician'} into Central Warehouse`}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-800 block">Batch / Handover Name</span>
              <p className="text-sm font-bold text-teal-950 mt-0.5">
                {returnBatchName.trim() || 'Standard Field Stock Return'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-teal-800 block">Total Returned Value</span>
              <p className="text-base font-extrabold font-mono text-teal-950 mt-0.5">
                ₹{totalBoxValue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
            <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-600 grid grid-cols-12 gap-2 uppercase text-[10px]">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-4 text-right">Condition &amp; Total</div>
            </div>
            {bulkItems.map((b) => (
              <div key={b.item._id} className="p-2.5 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6 truncate">
                  <span className="font-bold text-slate-800">[{b.item.itemCode}] {b.item.itemName}</span>
                  <span className="text-[10px] text-slate-400 block truncate">{b.reason}</span>
                </div>
                <div className="col-span-2 text-center font-mono font-bold text-teal-700">
                  +{b.quantity} {b.item.unit}
                </div>
                <div className="col-span-4 text-right">
                  <span className="font-mono font-bold text-slate-900 block">
                    ₹{((b.item.newPrice ?? b.item.price ?? 0) * b.quantity).toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block ${
                      b.condition === 'GOOD'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {b.condition === 'GOOD' ? 'Good' : 'Defective'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-[11px]">
            ⚠️ This will deduct {totalUnits} units from {selectedTech?.name}'s held bag and restore them into the central warehouse inventory immediately.
          </p>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteReturn}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition cursor-pointer shadow-sm"
            >
              {isSubmitting ? 'Processing...' : 'Confirm & Receive into Warehouse'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: PRINTABLE RETURN VOUCHER / RECEIPT (MRR) */}
      <Modal
        id="modal-return-voucher"
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        title="🎉 Return Successfully Received!"
        subtitle="Stock has been received into warehouse inventory and deducted from the technician's balance."
        maxWidth="lg"
      >
        {voucherData && (
          <div className="space-y-4 py-2 text-xs">
            {/* Printable Receipt Area */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">AquaStock PUREIT OPS</h3>
                  <p className="text-[10px] text-slate-500">Warehouse Material Return Receipt (MRR)</p>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-600">
                  Voucher: <strong className="text-slate-900">{voucherData.voucherNo}</strong>
                  <br />
                  Date: {voucherData.date}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <strong>Technician:</strong> {voucherData.technicianName} ({voucherData.technicianPhone})
                </div>
                <div>
                  <strong>Batch:</strong> {voucherData.returnBatchName}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-[11px]">
                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-600 grid grid-cols-12 gap-2 uppercase text-[10px]">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Condition</div>
                  <div className="col-span-3 text-right">Box MRP (₹)</div>
                </div>
                {voucherData.items.map((it, idx) => (
                  <div key={idx} className="p-2 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 truncate font-medium text-slate-800">
                      [{it.itemCode}] {it.itemName}
                    </div>
                    <div className="col-span-2 text-center font-mono font-bold text-teal-700">
                      +{it.quantity} {it.unit}
                    </div>
                    <div className="col-span-2 text-center text-[10px] text-slate-500 font-medium">
                      {it.condition}
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-slate-800">
                      ₹{(it.boxPrice * it.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-200">
                <span>Total Received Units: {voucherData.totalUnits}</span>
                <span className="font-mono text-teal-900">
                  Total Valuation: ₹{voucherData.totalBoxValue.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Dual Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-6 mt-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
                <div>
                  <div className="h-8 border-b border-dashed border-slate-300 mb-1" />
                  <span>Returned By (Technician: {voucherData.technicianName})</span>
                </div>
                <div>
                  <div className="h-8 border-b border-dashed border-slate-300 mb-1" />
                  <span>Received By (Warehouse Storekeeper)</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer flex items-center"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Receipt / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Guide Modal */}
      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
