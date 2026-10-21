import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { itemApi, stockApi } from '../services/api';
import { IItem, IStockTransaction } from '../types';
import { SystemGuideModal } from '../components/common/SystemGuideModal';
import { Modal } from '../components/common/Modal';
import { AddInventoryKitModal } from '../components/items/AddInventoryKitModal';
import {
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Calendar,
  FileText,
  Truck,
  HelpCircle,
  Search,
  Clock,
  ShieldCheck,
  Package,
  Sparkles,
  Tag,
  Monitor,
  Plus,
  Trash2,
  Check,
  CheckCheck,
  Printer,
  Scale,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';

export interface BulkInwardItem {
  item: IItem;
  quantity: number;
  remarks: string;
}

const COMMON_SUPPLIERS = [
  'Pureit Regional Depot / Central Logistics',
  'AO Smith India Factory Dispatch',
  'Central Warehouse Primary Buffer',
  'Local Authorized Distributor',
];

const INWARD_BATCH_PRESETS = [
  {
    name: 'RO 5-Stage Complete Kits Batch',
    keywords: ['Kit', 'GKK', 'Filter'],
    defaultQty: 10,
  },
  {
    name: 'Pureit GKK Replacement Pack Batch',
    keywords: ['GKK', 'One Kit', 'Germkill'],
    defaultQty: 15,
  },
  {
    name: 'Electrical & Solenoid Valves Batch',
    keywords: ['Solenoid', 'SV', 'Valve', 'Adapter'],
    defaultQty: 10,
  },
];

interface PurchasePageProps {
  defaultTab?: 'form' | 'register';
}

export const PurchasePage: React.FC<PurchasePageProps> = ({ defaultTab = 'form' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Active view: 'form' (Inward Form with full space) or 'register' (Recent Inward Register)
  const [activeTab, setActiveTab] = useState<'form' | 'register'>(() => {
    if (location.pathname === '/inward-register') return 'register';
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'register') return 'register';
    return defaultTab;
  });

  // Sync tab if URL changes
  useEffect(() => {
    if (location.pathname === '/inward-register') {
      setActiveTab('register');
    } else {
      const params = new URLSearchParams(location.search);
      if (params.get('tab') === 'register') {
        setActiveTab('register');
      } else if (params.get('tab') === 'form') {
        setActiveTab('form');
      }
    }
  }, [location.pathname, location.search]);

  const [items, setItems] = useState<IItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isAddKitModalOpen, setIsAddKitModalOpen] = useState(false);

  // Consignment / Invoice Details
  const [supplierName, setSupplierName] = useState(COMMON_SUPPLIERS[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [consignmentNote, setConsignmentNote] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [idempotencyKey, setIdempotencyKey] = useState(() => 'pur_bulk_' + crypto.randomUUID());

  // Staged Items in the Inward Manifest
  const [bulkItems, setBulkItems] = useState<BulkInwardItem[]>([]);

  // Fast Autocomplete Search Bar & Multi-Select from Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchSelectedIds, setSearchSelectedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fast Multi-SKU Paste / Comma Separated Codes
  const [multiCodeInput, setMultiCodeInput] = useState('');
  const [multiCodeQty, setMultiCodeQty] = useState(10);
  const [isMultiCodeBoxOpen, setIsMultiCodeBoxOpen] = useState(false);
  const [multiCodeFeedback, setMultiCodeFeedback] = useState<string | null>(null);

  // Interactive Bulk Catalog Selector
  const [isBulkPickerOpen, setIsBulkPickerOpen] = useState(true);
  const [pickerCategoryFilter, setPickerCategoryFilter] = useState('ALL');
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [selectedCatalogItemIds, setSelectedCatalogItemIds] = useState<Set<string>>(new Set());
  const [catalogItemQtyDrafts, setCatalogItemQtyDrafts] = useState<Record<string, number>>({});

  // Submissions & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goods Receipt Note (GRN) Printable Voucher Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [grnData, setGRNData] = useState<{
    grnNo: string;
    date: string;
    supplierName: string;
    invoiceNumber: string;
    consignmentNote?: string;
    items: Array<{
      itemCode: string;
      itemName: string;
      quantity: number;
      unit: string;
      previousStock: number;
      newStock: number;
      boxPrice: number;
      portalPrice: number;
      remarks?: string;
    }>;
    totalUnits: number;
    totalBoxValue: number;
    totalPortalValue: number;
  } | null>(null);

  // Inward History Register State & Filters
  const [inwardHistory, setInwardHistory] = useState<IStockTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [historySupplierFilter, setHistorySupplierFilter] = useState('ALL');

  // Guide Modal
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Load Catalog Items
  const loadData = async () => {
    try {
      setIsLoadingItems(true);
      const data = await itemApi.getItems({ isActive: true });
      setItems(data);

      // Check query param for default item
      const params = new URLSearchParams(window.location.search);
      const qItemId = params.get('itemId');
      if (qItemId) {
        const matched = data.find((i) => i._id === qItemId);
        if (matched && bulkItems.length === 0) {
          setBulkItems([
            {
              item: matched,
              quantity: 10,
              remarks: 'Initial shipment arrival',
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Load Recent Inward History
  const loadInwardHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const txs = await stockApi.getLedger({ type: 'PURCHASE_IN', limit: 100 });
      setInwardHistory(txs);
    } catch (err) {
      console.error('Failed to load inward history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
    loadInwardHistory();
  }, []);

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

  // Categories in Catalog
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Unique Suppliers in History
  const suppliersInHistory = useMemo(() => {
    const set = new Set<string>();
    inwardHistory.forEach((tx) => {
      if (tx.supplierName) set.add(tx.supplierName);
    });
    return Array.from(set);
  }, [inwardHistory]);

  // Filtered Catalog Items in Bulk Selector
  const filteredCatalogItems = useMemo(() => {
    return items.filter((item) => {
      if (pickerCategoryFilter !== 'ALL' && item.category !== pickerCategoryFilter) {
        return false;
      }
      if (pickerSearchQuery.trim()) {
        const q = pickerSearchQuery.toLowerCase().trim();
        return (
          item.itemCode.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.compatibleModels && item.compatibleModels.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, pickerCategoryFilter, pickerSearchQuery]);

  // Filtered Items for Fast Autocomplete Search Bar
  const filteredSearchItems = useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 12);
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.compatibleModels && item.compatibleModels.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Total Inward Calculations
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

  // Handlers for adding/modifying items in the manifest
  const handleAddItemToManifest = (item: IItem, initialQty = 10) => {
    const existingIndex = bulkItems.findIndex((b) => b.item._id === item._id);
    if (existingIndex >= 0) {
      setBulkItems((prev) =>
        prev.map((b, idx) =>
          idx === existingIndex
            ? { ...b, quantity: b.quantity + initialQty }
            : b
        )
      );
    } else {
      setBulkItems((prev) => [
        ...prev,
        {
          item,
          quantity: initialQty,
          remarks: '',
        },
      ]);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
    setError(null);
  };

  // Toggle multi-select in search dropdown
  const handleToggleSearchSelect = (itemId: string) => {
    setSearchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Add all selected from search dropdown
  const handleAddSearchSelectedToManifest = (qty = 10) => {
    const ids = Array.from(searchSelectedIds);
    if (ids.length === 0) return;

    const matchedItems = items.filter((i) => ids.includes(i._id));
    setBulkItems((prev) => {
      const map = new Map<string, BulkInwardItem>();
      prev.forEach((b) => map.set(b.item._id, b));
      matchedItems.forEach((item) => {
        if (map.has(item._id)) {
          const cur = map.get(item._id)!;
          map.set(item._id, { ...cur, quantity: cur.quantity + qty });
        } else {
          map.set(item._id, { item, quantity: qty, remarks: '' });
        }
      });
      return Array.from(map.values());
    });

    setSearchSelectedIds(new Set());
    setSearchQuery('');
    setIsSearchOpen(false);
    setError(null);
  };

  // Add all currently filtered items from search bar in 1 click
  const handleAddAllFilteredSearchToManifest = (qty = 10) => {
    if (filteredSearchItems.length === 0) return;
    setBulkItems((prev) => {
      const map = new Map<string, BulkInwardItem>();
      prev.forEach((b) => map.set(b.item._id, b));
      filteredSearchItems.forEach((item) => {
        if (map.has(item._id)) {
          const cur = map.get(item._id)!;
          map.set(item._id, { ...cur, quantity: cur.quantity + qty });
        } else {
          map.set(item._id, { item, quantity: qty, remarks: '' });
        }
      });
      return Array.from(map.values());
    });
    setSearchQuery('');
    setIsSearchOpen(false);
    setError(null);
  };

  // Multi-SKU Code Quick Input / Paste Handler
  const handleAddByMultiCodes = () => {
    if (!multiCodeInput.trim()) return;

    // Split by commas, spaces, or newlines
    const rawTokens = multiCodeInput
      .split(/[\s,\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (rawTokens.length === 0) return;

    const added: IItem[] = [];
    const notFound: string[] = [];

    rawTokens.forEach((token) => {
      const matched = items.find(
        (i) =>
          i.itemCode.toLowerCase() === token ||
          i.itemCode.toLowerCase().includes(token) ||
          i.itemName.toLowerCase().includes(token)
      );
      if (matched) {
        if (!added.some((a) => a._id === matched._id)) {
          added.push(matched);
        }
      } else {
        notFound.push(token);
      }
    });

    if (added.length > 0) {
      setBulkItems((prev) => {
        const map = new Map<string, BulkInwardItem>();
        prev.forEach((b) => map.set(b.item._id, b));
        added.forEach((item) => {
          if (map.has(item._id)) {
            const cur = map.get(item._id)!;
            map.set(item._id, { ...cur, quantity: cur.quantity + multiCodeQty });
          } else {
            map.set(item._id, { item, quantity: multiCodeQty, remarks: 'Multi-code entry' });
          }
        });
        return Array.from(map.values());
      });

      setMultiCodeFeedback(
        `Added ${added.length} SKUs (${added.length * multiCodeQty} units).${
          notFound.length > 0 ? ` Could not match: ${notFound.join(', ')}` : ''
        }`
      );
      setMultiCodeInput('');
      setTimeout(() => setMultiCodeFeedback(null), 5000);
    } else {
      setError(`No items matched the codes: ${notFound.join(', ')}`);
    }
  };

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    const clampedQty = Math.max(1, newQty);
    setBulkItems((prev) =>
      prev.map((b) => (b.item._id === itemId ? { ...b, quantity: clampedQty } : b))
    );
  };

  const handleUpdateItemRemarks = (itemId: string, remarks: string) => {
    setBulkItems((prev) =>
      prev.map((b) => (b.item._id === itemId ? { ...b, remarks } : b))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setBulkItems((prev) => prev.filter((b) => b.item._id !== itemId));
  };

  // Bulk Catalog Selector Handlers
  const handleToggleSelectCatalogItem = (itemId: string) => {
    setSelectedCatalogItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAllFilteredCatalogItems = () => {
    setSelectedCatalogItemIds((prev) => {
      const next = new Set(prev);
      filteredCatalogItems.forEach((i) => next.add(i._id));
      return next;
    });
  };

  const handleDeselectAllCatalogItems = () => {
    setSelectedCatalogItemIds(new Set());
  };

  const handleAddSelectedCatalogItemsToManifest = () => {
    if (selectedCatalogItemIds.size === 0) {
      setError('Please select at least one kit or part from the catalog.');
      return;
    }

    const itemsToAdd: BulkInwardItem[] = [];
    selectedCatalogItemIds.forEach((itemId) => {
      const match = items.find((i) => i._id === itemId);
      if (!match) return;
      const qty = catalogItemQtyDrafts[itemId] ?? 10;
      itemsToAdd.push({
        item: match,
        quantity: Math.max(1, qty),
        remarks: '',
      });
    });

    // Merge into bulkItems
    setBulkItems((prev) => {
      const map = new Map<string, BulkInwardItem>();
      prev.forEach((b) => map.set(b.item._id, b));
      itemsToAdd.forEach((b) => {
        if (map.has(b.item._id)) {
          const cur = map.get(b.item._id)!;
          map.set(b.item._id, { ...cur, quantity: cur.quantity + b.quantity });
        } else {
          map.set(b.item._id, b);
        }
      });
      return Array.from(map.values());
    });

    setSelectedCatalogItemIds(new Set());
    setError(null);
  };

  // Batch Presets
  const handleApplyPreset = (preset: (typeof INWARD_BATCH_PRESETS)[0]) => {
    const matchedItems = items.filter((item) =>
      preset.keywords.some(
        (kw) =>
          item.itemCode.toLowerCase().includes(kw.toLowerCase()) ||
          item.itemName.toLowerCase().includes(kw.toLowerCase()) ||
          (item.category && item.category.toLowerCase().includes(kw.toLowerCase()))
      )
    );

    if (matchedItems.length === 0) {
      setError(`No items in the catalog matched the keyword filter for "${preset.name}".`);
      return;
    }

    setBulkItems((prev) => {
      const map = new Map<string, BulkInwardItem>();
      prev.forEach((b) => map.set(b.item._id, b));
      matchedItems.forEach((item) => {
        if (map.has(item._id)) {
          const cur = map.get(item._id)!;
          map.set(item._id, { ...cur, quantity: cur.quantity + preset.defaultQty });
        } else {
          map.set(item._id, {
            item,
            quantity: preset.defaultQty,
            remarks: preset.name,
          });
        }
      });
      return Array.from(map.values());
    });
    setError(null);
  };

  // Batch Table Operations
  const handleAddQuantityToAll = (amount: number) => {
    setBulkItems((prev) =>
      prev.map((b) => ({
        ...b,
        quantity: b.quantity + amount,
      }))
    );
  };

  // Execute Bulk Inward Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (bulkItems.length === 0) {
      setError('Please add at least one spare part or kit to the inward shipment.');
      return;
    }

    for (const b of bulkItems) {
      if (b.quantity <= 0) {
        setError(`Quantity for [${b.item.itemCode}] must be 1 or greater.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payloadItems = bulkItems.map((b) => ({
        itemId: b.item._id,
        quantity: Number(b.quantity),
        remarks: b.remarks.trim() || undefined,
      }));

      const finalRemarks = [
        consignmentNote.trim(),
        invoiceNumber.trim() ? `Bill: ${invoiceNumber.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      // Call bulk purchase API
      await stockApi.purchaseBulk(
        {
          items: payloadItems,
          supplierName: supplierName.trim() || 'Pureit Regional Depot',
          invoiceNumber: invoiceNumber.trim() || undefined,
          remarks: finalRemarks || 'Bulk warehouse intake',
          transactionDate: transactionDate ? new Date(transactionDate).toISOString() : undefined,
        },
        idempotencyKey
      );

      // Generate GRN data
      const grnNo = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      setGRNData({
        grnNo,
        date: transactionDate
          ? new Date(transactionDate).toLocaleString('en-IN')
          : new Date().toLocaleString('en-IN'),
        supplierName: supplierName.trim() || 'Pureit Regional Depot',
        invoiceNumber: invoiceNumber.trim() || 'N/A',
        consignmentNote: consignmentNote.trim() || undefined,
        items: bulkItems.map((b) => {
          const prev = b.item.warehouseQty ?? 0;
          return {
            itemCode: b.item.itemCode,
            itemName: b.item.itemName,
            quantity: b.quantity,
            unit: b.item.unit,
            previousStock: prev,
            newStock: prev + b.quantity,
            boxPrice: b.item.newPrice ?? b.item.price ?? 0,
            portalPrice: b.item.oldPrice ?? b.item.price ?? 0,
            remarks: b.remarks,
          };
        }),
        totalUnits,
        totalBoxValue,
        totalPortalValue,
      });

      setShowGRNModal(true);

      // Reset form fields
      setBulkItems([]);
      setInvoiceNumber('');
      setConsignmentNote('');
      setSelectedCatalogItemIds(new Set());
      setIdempotencyKey('pur_bulk_' + crypto.randomUUID());

      // Reload fresh data and inward history
      await Promise.all([loadData(), loadInwardHistory()]);
    } catch (err: any) {
      console.error('Failed to submit bulk intake:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to record stock intake.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Inward History for Register View
  const filteredInwardHistory = useMemo(() => {
    return inwardHistory.filter((tx) => {
      // Date filter
      if (historyDateFilter !== 'ALL' && tx.transactionDate) {
        const txDate = new Date(tx.transactionDate);
        const now = new Date();
        if (historyDateFilter === 'TODAY') {
          if (txDate.toDateString() !== now.toDateString()) return false;
        } else if (historyDateFilter === 'WEEK') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (txDate < weekAgo) return false;
        } else if (historyDateFilter === 'MONTH') {
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (txDate < monthAgo) return false;
        }
      }

      // Supplier filter
      if (historySupplierFilter !== 'ALL') {
        if (tx.supplierName !== historySupplierFilter) return false;
      }

      // Search Query
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const item = typeof tx.item === 'object' ? tx.item : null;
        const code = (item?.itemCode || '').toLowerCase();
        const name = (item?.itemName || '').toLowerCase();
        const inv = (tx.invoiceNumber || '').toLowerCase();
        const supplier = (tx.supplierName || '').toLowerCase();
        const rem = (tx.remarks || '').toLowerCase();
        const dateStr = tx.transactionDate ? tx.transactionDate.toLowerCase() : '';
        return (
          code.includes(q) ||
          name.includes(q) ||
          inv.includes(q) ||
          supplier.includes(q) ||
          rem.includes(q) ||
          dateStr.includes(q)
        );
      }

      return true;
    });
  }, [inwardHistory, historySearch, historyDateFilter, historySupplierFilter]);

  // Total valuation of filtered register entries
  const registerTotalUnits = useMemo(() => {
    return filteredInwardHistory.reduce((acc, tx) => acc + (tx.quantity || 0), 0);
  }, [filteredInwardHistory]);

  const registerTotalValue = useMemo(() => {
    return filteredInwardHistory.reduce((acc, tx) => {
      const item = typeof tx.item === 'object' ? tx.item : null;
      const price = item?.newPrice ?? item?.price ?? 0;
      return acc + price * (tx.quantity || 0);
    }, 0);
  }, [filteredInwardHistory]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredInwardHistory.length === 0) return;
    const headers = [
      'Date',
      'Invoice / Bill No',
      'Supplier / Depot',
      'Item SKU Code',
      'Item Name',
      'Quantity',
      'Unit',
      'Box MRP (₹)',
      'Total Valuation (₹)',
      'Remarks',
    ];

    const rows = filteredInwardHistory.map((tx) => {
      const item = typeof tx.item === 'object' ? tx.item : null;
      const price = item?.newPrice ?? item?.price ?? 0;
      return [
        tx.transactionDate ? new Date(tx.transactionDate).toLocaleString('en-IN') : '',
        `"${(tx.invoiceNumber || '').replace(/"/g, '""')}"`,
        `"${(tx.supplierName || '').replace(/"/g, '""')}"`,
        `"${(item?.itemCode || '').replace(/"/g, '""')}"`,
        `"${(item?.itemName || '').replace(/"/g, '""')}"`,
        tx.quantity || 0,
        `"${(item?.unit || 'pcs').replace(/"/g, '""')}"`,
        price,
        price * (tx.quantity || 0),
        `"${(tx.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Recent_Inward_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Action to prefill item from register back into inward form
  const handleReInwardItem = (tx: IStockTransaction) => {
    const item = typeof tx.item === 'object' ? tx.item : null;
    if (!item) return;
    handleAddItemToManifest(item, tx.quantity || 10);
    setActiveTab('form');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Unified Menu Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
              <ArrowDownToLine className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">
                  {activeTab === 'form' ? 'Bulk Stock Inward (Warehouse Intake)' : 'Recent Inward Register (Shipment Log)'}
                </h2>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                  {activeTab === 'form' ? 'Multi-SKU Full Width (+IN)' : 'Date-wise Audit Register'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {activeTab === 'form'
                  ? 'Expanded, full-space workspace to search kit codes, add multiple items in bulk, and receive central inventory.'
                  : 'Official permanent date-wise register of all shipments received into central warehouse custody.'}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddKitModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-xl transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
              📦 Add New SKU to Master
            </button>

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer border border-slate-200/70"
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Guide
            </button>

            <button
              type="button"
              onClick={() => navigate('/ledger')}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
            >
              Movement Ledger <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>

        {/* PROMINENT MENU BAR TABS (Requested: "Recent Inward Register isko menu baar me set kr do...aur space badhaa do..Inventory ka") */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 flex-wrap gap-2">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('form');
                navigate('/purchase');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-white text-emerald-950 shadow-sm ring-1 ring-slate-200/60 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ArrowDownToLine className={`w-3.5 h-3.5 ${activeTab === 'form' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Stock Inward Form (Expanded)</span>
              {bulkItems.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {bulkItems.length} SKUs staged
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                navigate('/inward-register');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-emerald-950 shadow-sm ring-1 ring-slate-200/60 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'register' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Recent Inward Register</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
                {inwardHistory.length} saved
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500">
            {activeTab === 'form' ? (
              <span className="flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
                Full-width layout active: Maximum space for Inventory items &amp; kit codes
              </span>
            ) : (
              <button
                type="button"
                onClick={loadInwardHistory}
                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer transition"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingHistory ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
                Refresh Register
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Server Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start space-x-3 shadow-sm animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-sm block">Inward Intake Notice</span>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-950 font-bold ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: STOCK INWARD FORM (FULL WIDTH EXPANDED SPACE AS REQUESTED BY USER) */}
      {/* ========================================================================= */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-7">
          {/* Step 1: Shipment & Invoice Header Details (Spacious 4-column layout) */}
          <div className="p-4.5 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 rounded-2xl border border-emerald-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
              <span className="text-xs font-bold text-emerald-950 flex items-center uppercase tracking-wider">
                <Truck className="w-4 h-4 mr-1.5 text-emerald-600" />
                1. Shipment Consignment &amp; Invoice Info
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Inward Header
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Supplier / Source Depot */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Supplier / Source Depot *
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Pureit Regional Depot"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                {/* Supplier Presets */}
                <div className="mt-1.5 flex items-center flex-wrap gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Depots:</span>
                  {COMMON_SUPPLIERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSupplierName(s)}
                      className="text-[10px] bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                    >
                      {s.split('/')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bill / Invoice / Challan No */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center">
                  <FileText className="w-3 h-3 mr-1 text-slate-400" />
                  Bill / Invoice / Challan No:
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9041 / PO-8842"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Referenced on audit ledger and physical GRN copy.
                </span>
              </div>

              {/* Arrival Date & Time */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                  Inward Arrival Timestamp *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                />
              </div>

              {/* Consignment Note / Batch Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Shipment Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Restock Delivery - Carton #3"
                  value={consignmentNote}
                  onChange={(e) => setConsignmentNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Step 2: BULK MULTI-ITEM SELECTOR (Requested: "inventory v bulk me add kr ske...search krr krk kitt code se mtlb multipule itemm setect kr ske...") */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Search &amp; Select Multiple Items (Bulk Catalog Selector)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Search by kit code, part code, or model name. Select multiple items simultaneously using checkboxes or batch presets.
                </p>
              </div>

              {/* Batch Presets & Multi-Code Toggle */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsMultiCodeBoxOpen(!isMultiCodeBoxOpen)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer flex items-center ${
                    isMultiCodeBoxOpen
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3 mr-1.5 text-emerald-500" />
                  ⚡ Fast Paste Multiple Kit Codes
                </button>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Presets:</span>
                  {INWARD_BATCH_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="text-[10px] bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-md font-bold cursor-pointer transition shadow-2xs"
                    >
                      ⚡ {p.name.split('Batch')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fast Multi-Code Comma Separated Entry Box (If open) */}
            {isMultiCodeBoxOpen && (
              <div className="p-4 bg-emerald-950/5 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Enter Multiple Kit Codes (Comma, Space, or Line-separated):
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-500 font-medium">Quantity each:</span>
                    <input
                      type="number"
                      min="1"
                      value={multiCodeQty}
                      onChange={(e) => setMultiCodeQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 px-2 py-0.5 text-center text-xs font-mono font-bold bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={multiCodeInput}
                    onChange={(e) => setMultiCodeInput(e.target.value)}
                    placeholder="e.g. GBRD200, PUR-RO, GKK1, GKK2, SED-01, MEM-50, SOL-12V"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddByMultiCodes();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddByMultiCodes}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 shrink-0"
                  >
                    + Add Matching Items
                  </button>
                </div>

                {multiCodeFeedback && (
                  <p className="text-[11px] text-emerald-800 font-medium bg-emerald-100/60 p-2 rounded-lg">
                    {multiCodeFeedback}
                  </p>
                )}
              </div>
            )}

            {/* Fast SKU Code Autocomplete & Multi-Select Dropdown Bar */}
            <div className="relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type SKU / Kit code (e.g. GBRD200, PUR-RO, GKK1, Solenoid, Filter) to search and select multiple items..."
                  value={searchQuery}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  className="w-full pl-10 pr-32 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium shadow-2xs"
                />
                {searchQuery.trim() && (
                  <div className="absolute right-2.5 top-2 flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddAllFilteredSearchToManifest(10)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs cursor-pointer"
                    >
                      ⚡ Add All Matching ({filteredSearchItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Autocomplete Dropdown with Multi-Selection Checkboxes */}
              {isSearchOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto divide-y divide-slate-100">
                  <div className="p-2.5 bg-slate-50 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>
                      Matching Items ({filteredSearchItems.length}) — Click item to add, or check boxes to add in bulk:
                    </span>
                    {searchSelectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAddSearchSelectedToManifest(10)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-md cursor-pointer hover:bg-emerald-700"
                      >
                        Add Selected ({searchSelectedIds.size}) SKUs
                      </button>
                    )}
                  </div>

                  {filteredSearchItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No matching item found for &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    filteredSearchItems.map((item) => {
                      const isAlreadyAdded = bulkItems.some((b) => b.item._id === item._id);
                      const isChecked = searchSelectedIds.has(item._id);

                      return (
                        <div
                          key={item._id}
                          className="p-3 hover:bg-emerald-50/70 transition flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div className="flex items-center space-x-3 flex-1 mr-2" onClick={() => handleToggleSearchSelect(item._id)}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSearchSelect(item._id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
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
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-3 font-mono">
                                <span>
                                  Warehouse Stock:{' '}
                                  <strong className="text-slate-800">
                                    {item.warehouseQty ?? 0} {item.unit}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Box MRP:{' '}
                                  <strong className="text-emerald-700">
                                    ₹{(item.newPrice ?? item.price ?? 0).toLocaleString('en-IN')}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddItemToManifest(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 shrink-0 ${
                              isAlreadyAdded
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {isAlreadyAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                <span>+10 More</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Multi-Select Catalog Drawer Header */}
            <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-200/60">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter parts catalog below..."
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPickerCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    pickerCategoryFilter === 'ALL'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Parts ({items.length})
                </button>
                {categoriesList.map((cat) => {
                  const count = items.filter((i) => i.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPickerCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                        pickerCategoryFilter === cat
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-Select Action Bar */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleSelectAllFilteredCatalogItems}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer flex items-center"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1" />
                  Select All ({filteredCatalogItems.length})
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllCatalogItems}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Deselect All
                </button>
                {selectedCatalogItemIds.size > 0 && (
                  <span className="text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {selectedCatalogItemIds.size} SKUs selected
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddSelectedCatalogItemsToManifest}
                disabled={selectedCatalogItemIds.size === 0}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center shadow-xs ${
                  selectedCatalogItemIds.size > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Selected ({selectedCatalogItemIds.size}) to Inward Manifest
              </button>
            </div>

            {/* Interactive Catalog Multi-Select Grid (Full Width 3-4 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
              {filteredCatalogItems.map((item) => {
                const isSelected = selectedCatalogItemIds.has(item._id);
                const isAlreadyInManifest = bulkItems.some((b) => b.item._id === item._id);
                const draftQty = catalogItemQtyDrafts[item._id] ?? 10;
                const boxPrice = item.newPrice ?? item.price ?? 0;

                return (
                  <div
                    key={item._id}
                    className={`p-3 rounded-xl border transition text-xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-400'
                        : isAlreadyInManifest
                        ? 'border-teal-300 bg-teal-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start space-x-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectCatalogItem(item._id)}
                            className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
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

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                        <span>
                          Current: <strong className="font-mono text-slate-900">{item.warehouseQty ?? 0} {item.unit}</strong>
                        </span>
                        <span className="font-mono font-bold text-emerald-800">
                          ₹{boxPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Quantity & Quick Add */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-400 font-semibold">Qty:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = catalogItemQtyDrafts[item._id] ?? 10;
                            setCatalogItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: Math.max(1, cur - 5),
                            }));
                          }}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={draftQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setCatalogItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: Math.max(1, val),
                            }));
                          }}
                          className="w-12 text-center py-0.5 font-mono font-bold text-xs bg-white border border-slate-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = catalogItemQtyDrafts[item._id] ?? 10;
                            setCatalogItemQtyDrafts((prev) => ({
                              ...prev,
                              [item._id]: cur + 5,
                            }));
                          }}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddItemToManifest(item, draftQty)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isAlreadyInManifest
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                        title={isAlreadyInManifest ? 'Already staged' : 'Add to manifest'}
                      >
                        {isAlreadyInManifest ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Staged Inward Manifest Table (SPACIOUS FULL WIDTH LAYOUT) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-1 text-emerald-600" />
                3. Inward Manifest ({bulkItems.length} Distinct SKUs Staged)
              </span>

              {bulkItems.length > 0 && (
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleAddQuantityToAll(5)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium cursor-pointer"
                  >
                    +5 to All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuantityToAll(10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium cursor-pointer"
                  >
                    +10 to All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuantityToAll(25)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium cursor-pointer"
                  >
                    +25 to All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkItems([])}
                    className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                  >
                    Clear Table
                  </button>
                </div>
              )}
            </div>

            {bulkItems.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No items staged for inward yet.</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Use the <strong>Fast SKU Search</strong> or <strong>Catalog Selector</strong> above to add spare parts and kits to this intake.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="py-3 px-4">Item SKU &amp; Name</th>
                        <th className="py-3 px-3 text-center">Current Stock</th>
                        <th className="py-3 px-3 text-center">Quantity Inward</th>
                        <th className="py-3 px-3 text-center">New Balance</th>
                        <th className="py-3 px-3 text-right">Box MRP (₹)</th>
                        <th className="py-3 px-3 text-right">Portal Price (₹)</th>
                        <th className="py-3 px-3 text-right">Line Total (₹)</th>
                        <th className="py-3 px-3">Batch / Item Note</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkItems.map((b) => {
                        const curStock = b.item.warehouseQty ?? 0;
                        const newBalance = curStock + b.quantity;
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
                              {curStock} {b.item.unit}
                            </td>

                            {/* Quantity Stepper */}
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
                                  value={b.quantity}
                                  onChange={(e) =>
                                    handleUpdateItemQty(b.item._id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="w-14 text-center py-1 font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(b.item._id, b.quantity + 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* New Resulting Stock */}
                            <td className="py-3 px-3 text-center font-mono font-extrabold text-emerald-800">
                              = {newBalance} {b.item.unit}
                            </td>

                            {/* Box MRP */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                              ₹{boxPrice.toLocaleString('en-IN')}
                            </td>

                            {/* Portal Rate */}
                            <td className="py-3 px-3 text-right font-mono text-slate-500">
                              ₹{portalPrice.toLocaleString('en-IN')}
                            </td>

                            {/* Line Total */}
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-900">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </td>

                            {/* Line Remarks */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={b.remarks}
                                onChange={(e) => handleUpdateItemRemarks(b.item._id, e.target.value)}
                                placeholder="Batch / carton note..."
                                className="w-full min-w-[130px] px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-800"
                              />
                            </td>

                            {/* Remove */}
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(b.item._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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

          {/* Step 4: Executive Inward Valuation Summary Card */}
          {bulkItems.length > 0 && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                  <Scale className="w-4 h-4 mr-1.5" />
                  Shipment Summary &amp; Warehouse Inward Impact
                </span>
                <span className="text-[11px] text-slate-400">
                  Source Depot: <strong className="text-white">{supplierName}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                    <Package className="w-3 h-3 mr-1" /> Total Inward Units:
                  </span>
                  <span className="text-xl font-mono font-extrabold text-white mt-1 block">
                    +{totalUnits} Units
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Across {bulkItems.length} distinct SKUs
                  </span>
                </div>

                <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center">
                    <Tag className="w-3 h-3 mr-1" /> Total Box MRP:
                  </span>
                  <span className="text-xl font-mono font-extrabold text-emerald-300 mt-1 block">
                    ₹{totalBoxValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                    Customer charge valuation
                  </span>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                    <Monitor className="w-3 h-3 mr-1" /> Total Portal Rate:
                  </span>
                  <span className="text-xl font-mono font-extrabold text-slate-200 mt-1 block">
                    ₹{totalPortalValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Difference: +₹{totalDifference.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Warehouse Impact:
                  </span>
                  <span className="text-xs font-bold text-emerald-400 mt-1.5 block">
                    ✓ Instant Balance Credit
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Permanent audit log generated
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Actions & Submit Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setBulkItems([]);
                setInvoiceNumber('');
                setConsignmentNote('');
                setSelectedCatalogItemIds(new Set());
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Reset Inward Form
            </button>

            <button
              id="submit-bulk-purchase-btn"
              type="submit"
              disabled={isSubmitting || bulkItems.length === 0}
              className={`px-8 py-3.5 rounded-xl text-xs font-extrabold text-white transition cursor-pointer flex items-center shadow-md active:scale-95 ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : bulkItems.length === 0
                  ? 'bg-slate-700 hover:bg-slate-800 ring-2 ring-slate-400/30'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-600/25 ring-2 ring-emerald-400/30'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              {isSubmitting
                ? 'Recording Stock Intake...'
                : bulkItems.length > 0
                ? `Receive ${totalUnits} Units (${bulkItems.length} SKUs) into Central Warehouse`
                : 'Add Items to Inward Manifest'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECENT INWARD REGISTER (FULL-PAGE AUDIT REGISTER & LOG VIEW)       */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
          {/* Top KPI Cards for Recent Inward Register */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Inward Entries
              </span>
              <span className="text-2xl font-mono font-extrabold text-slate-900 mt-1 block">
                {filteredInwardHistory.length}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                From {suppliersInHistory.length} unique depots
              </span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Total Received Units
              </span>
              <span className="text-2xl font-mono font-extrabold text-emerald-900 mt-1 block">
                +{registerTotalUnits}
              </span>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">
                Spares &amp; filter kits received
              </span>
            </div>

            <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                Total Inward Valuation
              </span>
              <span className="text-2xl font-mono font-extrabold text-teal-900 mt-1 block">
                ₹{registerTotalValue.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-teal-700 mt-0.5 block">
                Calculated at Box MRP rate
              </span>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                Quick Actions
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('form');
                  navigate('/purchase');
                }}
                className="mt-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition flex items-center justify-center cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> + New Stock Inward
              </button>
            </div>
          </div>

          {/* Register Filter Controls */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU code, item name, bill no, or depot..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Date Presets */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Date:</span>
              {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((df) => (
                <button
                  key={df}
                  type="button"
                  onClick={() => setHistoryDateFilter(df)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    historyDateFilter === df
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {df === 'ALL' ? 'All Time' : df === 'TODAY' ? 'Today' : df === 'WEEK' ? 'Last 7 Days' : 'This Month'}
                </button>
              ))}
            </div>

            {/* Supplier Filter & Export Buttons */}
            <div className="flex items-center space-x-2">
              {suppliersInHistory.length > 0 && (
                <select
                  value={historySupplierFilter}
                  onChange={(e) => setHistorySupplierFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-700 font-medium"
                >
                  <option value="ALL">All Depots / Suppliers</option>
                  {suppliersInHistory.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredInwardHistory.length === 0}
                className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition flex items-center cursor-pointer shadow-2xs"
                title="Export register to CSV"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl transition cursor-pointer"
                title="Print Inward Register"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Detailed Inward Register Table */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-3">Bill / Challan No</th>
                    <th className="py-3 px-3">Supplier / Depot</th>
                    <th className="py-3 px-3">Item SKU &amp; Name</th>
                    <th className="py-3 px-3 text-center">Inward Qty</th>
                    <th className="py-3 px-3 text-right">Box MRP (₹)</th>
                    <th className="py-3 px-3 text-right">Valuation (₹)</th>
                    <th className="py-3 px-3">Consignment Remarks</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs text-slate-400">
                        Loading inward register...
                      </td>
                    </tr>
                  ) : filteredInwardHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-xs text-slate-400">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No matching inward records found in register.
                      </td>
                    </tr>
                  ) : (
                    filteredInwardHistory.map((tx) => {
                      const item = typeof tx.item === 'object' ? tx.item : null;
                      const boxPrice = item?.newPrice ?? item?.price ?? 0;
                      const lineTotal = boxPrice * (tx.quantity || 0);

                      const txDateFormatted = tx.transactionDate
                        ? `${new Date(tx.transactionDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}, ${new Date(tx.transactionDate).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Recent';

                      return (
                        <tr key={tx._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              {txDateFormatted}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-700">
                            {tx.invoiceNumber ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {tx.invoiceNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-medium text-slate-700 max-w-[160px] truncate" title={tx.supplierName}>
                            {tx.supplierName || 'Pureit Depot'}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                                {item?.itemCode || 'SKU'}
                              </span>
                              <span className="font-bold text-slate-900 truncate max-w-[200px]">
                                {item?.itemName || 'Product'}
                              </span>
                            </div>
                            {item?.category && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {item.category}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              +{tx.quantity} {item?.unit || 'pcs'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                            ₹{boxPrice.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-900">
                            ₹{lineTotal.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-[11px] text-slate-500 max-w-[180px] truncate">
                            {tx.remarks || '—'}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {item && (
                              <button
                                type="button"
                                onClick={() => handleReInwardItem(tx)}
                                className="px-2 py-1 text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md border border-teal-200 transition cursor-pointer"
                                title="Add this item to Inward Form"
                              >
                                + Re-Inward
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE GOODS RECEIPT NOTE (GRN VOUCHER) */}
      <Modal
        id="modal-grn-receipt"
        isOpen={showGRNModal}
        onClose={() => setShowGRNModal(false)}
        title="🎉 Stock Successfully Received into Central Warehouse!"
        subtitle="Physical goods intake recorded into ledger and warehouse balances credited."
        maxWidth="lg"
      >
        {grnData && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">AquaStock PUREIT OPS</h3>
                  <p className="text-[10px] text-slate-500">Warehouse Goods Receipt Note (GRN)</p>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-600">
                  GRN No: <strong className="text-slate-900">{grnData.grnNo}</strong>
                  <br />
                  Date: {grnData.date}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <strong>Supplier / Depot:</strong> {grnData.supplierName}
                </div>
                <div>
                  <strong>Bill / Invoice:</strong> {grnData.invoiceNumber}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-[11px]">
                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-600 grid grid-cols-12 gap-2 uppercase text-[10px]">
                  <div className="col-span-5">Item SKU &amp; Name</div>
                  <div className="col-span-2 text-center">Inward Qty</div>
                  <div className="col-span-2 text-center">New Balance</div>
                  <div className="col-span-3 text-right">Box MRP (₹)</div>
                </div>
                {grnData.items.map((it, idx) => (
                  <div key={idx} className="p-2 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 truncate font-medium text-slate-800">
                      [{it.itemCode}] {it.itemName}
                    </div>
                    <div className="col-span-2 text-center font-mono font-bold text-emerald-700">
                      +{it.quantity} {it.unit}
                    </div>
                    <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                      {it.newStock} {it.unit}
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-slate-800">
                      ₹{(it.boxPrice * it.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-200">
                <span>Total Received Units: {grnData.totalUnits}</span>
                <span className="font-mono text-emerald-900">
                  Total Valuation: ₹{grnData.totalBoxValue.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Dual Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-6 mt-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
                <div>
                  <div className="h-8 border-b border-dashed border-slate-300 mb-1" />
                  <span>Received By (Warehouse Storekeeper)</span>
                </div>
                <div>
                  <div className="h-8 border-b border-dashed border-slate-300 mb-1" />
                  <span>Verified By (Inventory Inward Incharge)</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowGRNModal(false)}
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
                  Print GRN / PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGRNModal(false);
                    navigate('/warehouse-stock');
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-sm"
                >
                  View Warehouse Stock →
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Interactive System Guide Modal */}
      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Add Kit or New Inventory with Complete Details Modal */}
      {isAddKitModalOpen && (
        <AddInventoryKitModal
          isOpen={isAddKitModalOpen}
          onClose={() => setIsAddKitModalOpen(false)}
          onSuccess={(_msg) => {
            loadData();
            loadInwardHistory();
          }}
        />
      )}
    </div>
  );
};
