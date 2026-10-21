import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { itemApi } from '../../services/api';
import { ItemCategory } from '../../types';
import {
  Package,
  Layers,
  Wrench,
  Tag,
  Warehouse,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldCheck,
  Building,
  MapPin,
  FileText,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface AddInventoryKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

const CATEGORIES: ItemCategory[] = [
  'One Kit',
  'GKK1',
  'GKK2',
  'SF',
  'UV Lamp',
  'Mineral Cartridge',
  'Spare Part',
  'Other',
];

const BRANDS = [
  'A.O. Smith',
  'Pureit / Unilever',
  'Kent RO',
  'Aquaguard / Eureka Forbes',
  'Livpure',
  'Havells',
  'Universal / Multi-Brand',
];

export const AddInventoryKitModal: React.FC<AddInventoryKitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'kit' | 'part'>('kit');

  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    category: 'One Kit' as ItemCategory,
    isKit: true,
    brand: 'A.O. Smith',
    gkkType: 'SV Kit',
    unit: 'kit',
    oldPrice: 0,
    newPrice: 0,
    priceNotes: '',
    compatibleModels: '',
    kitComponents: '',
    storageLocation: '',
    description: '',
    lowStockThreshold: 5,
    reorderLevel: 5,
    hsnCode: '84212190',
    barcode: '',
    // Initial Stock Inward
    addInitialStock: true,
    initialStock: 10,
    supplier: 'A.O. Smith India Private Limited',
    initialInvoiceNumber: 'INV-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
    inwardRemarks: 'Initial opening stock entry during kit setup',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Preset Templates
  const handleApplyTemplate = (type: 'sv-kit' | 'gkk1' | 'gkk2' | 'onekit' | 'sf' | 'clear') => {
    setErrorMessage(null);
    if (type === 'clear') {
      setFormData((prev) => ({
        ...prev,
        itemCode: '',
        itemName: '',
        category: 'One Kit',
        isKit: true,
        gkkType: '',
        unit: 'kit',
        oldPrice: 0,
        newPrice: 0,
        priceNotes: '',
        compatibleModels: '',
        kitComponents: '',
        storageLocation: '',
        description: '',
        initialStock: 0,
      }));
      return;
    }

    if (type === 'sv-kit') {
      setActiveTab('kit');
      setFormData((prev) => ({
        ...prev,
        itemCode: 'SV-KIT-01',
        itemName: 'Solenoid Valve (SV) Kit with 1/4" Push Connectors & Clamp',
        category: 'Spare Part',
        isKit: true,
        brand: 'A.O. Smith',
        gkkType: 'SV Kit',
        unit: 'kit',
        oldPrice: 850,
        newPrice: 1100,
        priceNotes: 'AO Smith Portal Rate: ₹850 | Box Printed MRP (Tech Charge): ₹1,100',
        compatibleModels: 'ProPlanet P7, Z8, Green RO, X8, Elegance Series',
        kitComponents: '• 1x 24V DC High Pressure Solenoid Valve\n• 2x 1/4" Quick Push-Fit Elbow Connectors\n• 1x Heavy Duty Mounting Bracket & Screws\n• 1x Teflon Seal Tape Roll',
        storageLocation: 'Rack A-02, Shelf 1',
        description: 'Original A.O. Smith Solenoid Valve repair kit for RO purifier automatic shut-off and leakage prevention.',
        lowStockThreshold: 5,
        reorderLevel: 5,
        addInitialStock: true,
        initialStock: 15,
        supplier: 'A.O. Smith Authorized Depot',
      }));
    } else if (type === 'gkk1') {
      setActiveTab('kit');
      setFormData((prev) => ({
        ...prev,
        itemCode: 'GKK1-REV-01',
        itemName: 'Pureit Revito Germkill Kit 1 (Sediment + Pre-Carbon)',
        category: 'GKK1',
        isKit: true,
        brand: 'Pureit / Unilever',
        gkkType: 'GKK 1',
        unit: 'kit',
        oldPrice: 2600,
        newPrice: 2900,
        priceNotes: 'AO Smith / Portal System Rate: ₹2,600 | Customer Charge (Box MRP): ₹2,900',
        compatibleModels: 'Revito Series (8 Stage), Revito Series (One piece)',
        kitComponents: '• 1x High Quality Sediment Filter Cartridge\n• 1x Activated Pre-Carbon Block Cartridge',
        storageLocation: 'Rack B-01, Shelf 3',
        description: 'Stage 1 & Stage 2 replacement germkill kit for Pureit Revito water purifiers.',
        lowStockThreshold: 5,
        reorderLevel: 5,
        addInitialStock: true,
        initialStock: 20,
        supplier: 'Pureit Authorized Distributor',
      }));
    } else if (type === 'gkk2') {
      setActiveTab('kit');
      setFormData((prev) => ({
        ...prev,
        itemCode: 'GKK2-REV-01',
        itemName: 'Pureit Revito Germkill Kit 2 (Post-Carbon + Mineral + Micro-Mesh)',
        category: 'GKK2',
        isKit: true,
        brand: 'Pureit / Unilever',
        gkkType: 'GKK 2',
        unit: 'kit',
        oldPrice: 3100,
        newPrice: 3500,
        priceNotes: 'Company Portal Rate: ₹3,100 | Box Printed MRP (Tech Charge): ₹3,500',
        compatibleModels: 'Revito Series (8 Stage), Revito Series (ESF)',
        kitComponents: '• 1x Post-Carbon Filter Cartridge\n• 1x Mineral Enhancer Cartridge\n• 1x Micro-Filtration Mesh Screen',
        storageLocation: 'Rack B-02, Shelf 2',
        description: 'Complete Stage 3 Germkill replenishment for Pureit Revito purifiers.',
        lowStockThreshold: 4,
        reorderLevel: 4,
        addInitialStock: true,
        initialStock: 15,
        supplier: 'Pureit Authorized Distributor',
      }));
    } else if (type === 'onekit') {
      setActiveTab('kit');
      setFormData((prev) => ({
        ...prev,
        itemCode: 'ONEKIT-PRO-01',
        itemName: '1-Year Complete Comprehensive Germkill Service Kit',
        category: 'One Kit',
        isKit: true,
        brand: 'A.O. Smith',
        gkkType: 'One Kit',
        unit: 'kit',
        oldPrice: 3800,
        newPrice: 4200,
        priceNotes: 'AO Smith Portal Rate: ₹3,800 | Box Printed MRP: ₹4,200',
        compatibleModels: 'ProPlanet P7, Z8, Green RO, Vital Series',
        kitComponents: '• 1x Pre-Sediment Filter\n• 1x Carbon Block Filter\n• 1x Post-Carbon Inline\n• 1x Mineral Booster\n• 1x RO Membrane 80 GPD',
        storageLocation: 'Rack C-01, Shelf 1',
        description: 'All-in-one comprehensive annual kit containing all replacement cartridges and membranes.',
        lowStockThreshold: 5,
        reorderLevel: 5,
        addInitialStock: true,
        initialStock: 12,
        supplier: 'A.O. Smith India Private Limited',
      }));
    } else if (type === 'sf') {
      setActiveTab('part');
      setFormData((prev) => ({
        ...prev,
        itemCode: 'SF-10-PP',
        itemName: '10-inch Spun Polypropylene Sediment Filter (Pre-Filter)',
        category: 'SF',
        isKit: false,
        brand: 'Universal / Multi-Brand',
        gkkType: 'Pre-Filter SF',
        unit: 'pcs',
        oldPrice: 220,
        newPrice: 350,
        priceNotes: 'Portal / System Rate: ₹220 | Customer Box MRP: ₹350',
        compatibleModels: 'All standard 10-inch external pre-filter bowls',
        kitComponents: '1x 5 Micron Spun PP Filter Cartridge',
        storageLocation: 'Rack D-01, Bin 10',
        description: 'High capacity 5 micron sediment pre-filter for blocking rust, mud, and suspended solids.',
        lowStockThreshold: 10,
        reorderLevel: 10,
        addInitialStock: true,
        initialStock: 50,
        supplier: 'Industrial Polymer Products Depot',
      }));
    }
  };

  const handleTabChange = (tab: 'kit' | 'part') => {
    setActiveTab(tab);
    setFormData((prev) => ({
      ...prev,
      isKit: tab === 'kit',
      unit: tab === 'kit' ? 'kit' : 'pcs',
      category: tab === 'kit' ? 'One Kit' : 'Spare Part',
    }));
  };

  const calculateMargin = () => {
    const oldP = Number(formData.oldPrice) || 0;
    const newP = Number(formData.newPrice) || 0;
    const diff = newP - oldP;
    const percent = oldP > 0 ? Math.round((diff / oldP) * 100) : 0;
    return { diff, percent };
  };

  const margin = calculateMargin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.itemCode.trim()) {
      setErrorMessage('SKU Code is required (e.g. SV-KIT-01).');
      return;
    }
    if (!formData.itemName.trim()) {
      setErrorMessage('Kit / Item Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        itemCode: formData.itemCode.trim().toUpperCase(),
        itemName: formData.itemName.trim(),
        category: formData.category,
        isKit: formData.isKit,
        brand: formData.brand,
        gkkType: formData.gkkType.trim(),
        unit: formData.unit.trim() || (formData.isKit ? 'kit' : 'pcs'),
        oldPrice: Number(formData.oldPrice) || 0,
        newPrice: Number(formData.newPrice) || 0,
        price: Number(formData.newPrice) || Number(formData.oldPrice) || 0,
        priceNotes: formData.priceNotes.trim(),
        compatibleModels: formData.compatibleModels.trim(),
        kitComponents: formData.kitComponents.trim(),
        storageLocation: formData.storageLocation.trim(),
        description: formData.description.trim(),
        lowStockThreshold: Number(formData.lowStockThreshold) || 5,
        reorderLevel: Number(formData.reorderLevel) || 5,
        hsnCode: formData.hsnCode.trim(),
        barcode: formData.barcode.trim(),
        // Initial inventory inward
        initialStock: formData.addInitialStock ? Number(formData.initialStock) || 0 : 0,
        supplier: formData.supplier.trim(),
        initialInvoiceNumber: formData.initialInvoiceNumber.trim(),
        inwardRemarks: formData.inwardRemarks.trim(),
      };

      const res = await itemApi.addItem(payload);
      onSuccess(res?.message || `✓ ${formData.isKit ? 'Kit' : 'Inventory item'} '${formData.itemCode}' successfully added to catalog!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to add item/kit to catalog.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      id="modal-add-kit-inventory"
      isOpen={isOpen}
      onClose={onClose}
      title="Add Kit or New Inventory with Complete Details"
      subtitle="Define new Service Kits (SV Kit, GKK1, GKK2), Filters or Spares with dual pricing, BOM components, and direct warehouse inward stock."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Type Selector & Quick Preset Banner */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => handleTabChange('kit')}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'kit'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                📦 Service Kit / Combo Pack
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('part')}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'part'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 mr-1.5" />
                🔧 Single Spare / Filter / Part
              </button>
            </div>

            {/* Quick Fill Label */}
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ⚡ Quick Fill Presets:
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleApplyTemplate('sv-kit')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
            >
              ⚡ Solenoid Valve (SV) Kit
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('gkk1')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100 transition cursor-pointer"
            >
              ⚡ GKK-1 Filter Kit
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('gkk2')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 hover:bg-indigo-100 transition cursor-pointer"
            >
              ⚡ GKK-2 Filter Kit
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('onekit')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
            >
              ⚡ One Kit (Complete 1-Yr)
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('sf')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              ⚡ Pre-Sediment Filter (SF)
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('clear')}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer ml-auto"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Section 1: Identification & Basic Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold text-[11px] flex items-center justify-center">1</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {activeTab === 'kit' ? 'Kit Identification & Master Details' : 'Item Identification & Master Details'}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Item SKU Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SV-KIT-01, GKK-301"
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden uppercase"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Unique identification code</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                {activeTab === 'kit' ? 'Kit Name / Title *' : 'Item / Part Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={activeTab === 'kit' ? 'e.g. Solenoid Valve SV Kit with Push Connectors & Clamp' : 'e.g. Activated Post Carbon Inline Filter 10"'}
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Brand / Manufacturer</label>
              <select
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Kit Variant / Subtype</label>
              <input
                type="text"
                placeholder="e.g. SV Kit, GKK 1, One Kit"
                value={formData.gkkType}
                onChange={(e) => setFormData({ ...formData, gkkType: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Unit of Measure</label>
              <input
                type="text"
                placeholder="kit, pcs, set, box"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Dual Pricing (Old Rate vs Box MRP) */}
        <div className="bg-emerald-50/40 border border-emerald-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center">2</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                Dual Pricing &amp; Billing (Old Rate vs New Box MRP)
              </h4>
            </div>
            {margin.diff !== 0 && (
              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                margin.diff > 0
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {margin.diff > 0 ? `+₹${margin.diff} (+${margin.percent}%) Difference` : `-₹${Math.abs(margin.diff)} Difference`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <label className="block text-xs font-bold text-slate-700">
                AO Smith / Company Portal Price (Old Rate) (₹)
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 2600"
                value={formData.oldPrice || ''}
                onChange={(e) => setFormData({ ...formData, oldPrice: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Recorded system rate logged on company portal.
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs">
              <label className="block text-xs font-extrabold text-emerald-900">
                Box Printed MRP (Technician Customer Charge) (₹) *
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 2900"
                value={formData.newPrice || ''}
                onChange={(e) => setFormData({ ...formData, newPrice: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-sm bg-emerald-50/50 border border-emerald-400 rounded-xl font-mono font-extrabold text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-emerald-700 mt-1 block font-medium">
                Physical box printed price collected from customer on-site.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Pricing Instructions / Notes for Technicians</label>
            <input
              type="text"
              placeholder="e.g. Charge customer ₹2,900 as per Box Printed MRP, log ₹2,600 in portal"
              value={formData.priceNotes}
              onChange={(e) => setFormData({ ...formData, priceNotes: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Section 3: Compatibility & Included Kit Components */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold text-[11px] flex items-center justify-center">3</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Compatibility Models &amp; Included Kit Components (BOM)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Compatible RO Purifier Models
              </label>
              <textarea
                rows={3}
                placeholder="e.g. ProPlanet P7, Z8, Green RO, X8, Kent Grand Plus, Aquaguard Magna..."
                value={formData.compatibleModels}
                onChange={(e) => setFormData({ ...formData, compatibleModels: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Comma separated list of water purifier models</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Included Kit Components / Bill of Materials (BOM)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. 1x Solenoid Valve 24V DC, 2x Push Connectors 1/4 inch, 1x Mounting Bracket..."
                value={formData.kitComponents}
                onChange={(e) => setFormData({ ...formData, kitComponents: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Items packed inside this kit</span>
            </div>
          </div>
        </div>

        {/* Section 4: Initial Inventory Inward into Central Warehouse */}
        <div className="bg-sky-50/40 border border-sky-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-sky-200/60 pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold text-[11px] flex items-center justify-center">4</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-950 flex items-center">
                <Warehouse className="w-3.5 h-3.5 mr-1.5 text-sky-700" />
                Initial Inventory Stocking (Direct Warehouse Inward)
              </h4>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.addInitialStock}
                onChange={(e) => setFormData({ ...formData, addInitialStock: e.target.checked })}
                className="rounded-sm text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-sky-900">Inward Initial Stock Now</span>
            </label>
          </div>

          {formData.addInitialStock ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-sky-200">
                  <label className="block text-xs font-bold text-sky-950">
                    Initial Quantity (Inward Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required={formData.addInitialStock}
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 text-sm bg-sky-50/50 border border-sky-300 rounded-xl font-mono font-extrabold text-sky-950 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-sky-700 mt-1 block">Directly added to Central Warehouse balance</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Storage Bin / Rack Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A-02, Shelf 3, Bin 12"
                    value={formData.storageLocation}
                    onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Physical warehouse shelf or bin</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Supplier / Source Depot
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A.O. Smith India / Central Depot"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Vendor or company supply hub</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Purchase Invoice / PO Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-901"
                    value={formData.initialInvoiceNumber}
                    onChange={(e) => setFormData({ ...formData, initialInvoiceNumber: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Inward Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Initial warehouse setup kit stock"
                    value={formData.inwardRemarks}
                    onChange={(e) => setFormData({ ...formData, inwardRemarks: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Item will be created in catalog with 0 initial warehouse stock. You can inward stock later from Stock Inward page.
            </p>
          )}
        </div>

        {/* Section 5: Inventory Controls & Tax */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold text-[11px] flex items-center justify-center">5</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Threshold Warnings &amp; Tax / HSN Code
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Low Stock Alert Threshold *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.lowStockThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, lowStockThreshold: val, reorderLevel: val });
                }}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Alert triggers below this</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Reorder Level Target</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">HSN / GST Code</label>
              <input
                type="text"
                placeholder="e.g. 84212190"
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Barcode / EAN (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 890123456789"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Modal footer actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="save-full-kit-inventory-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition shadow-md shadow-sky-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isSubmitting ? 'Saving to Catalog & Inwarding...' : `Save ${formData.isKit ? 'Kit' : 'Inventory'} with All Details`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
