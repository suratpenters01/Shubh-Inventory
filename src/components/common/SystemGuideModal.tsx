import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardCheck,
  RotateCcw,
  Scale,
  ShieldCheck,
  CheckCircle2,
  Package,
  Layers,
  ScrollText,
  Warehouse,
} from 'lucide-react';

interface SystemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemGuideModal: React.FC<SystemGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'workflows' | 'menus' | 'audit'>('workflows');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-white font-bold">
              <HelpCircle className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 id="system-guide-title" className="text-base font-extrabold tracking-tight">
                  AquaStock User Manual &amp; Operations Guide
                </h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-semibold border border-indigo-400/30">
                  Standard Operating Procedures
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Complete operational guide from stock intake and technician kit assignment to on-site usage and inventory audit.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold space-x-2 shrink-0">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'workflows'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <span>Step-by-Step Workflows</span>
          </button>
          <button
            onClick={() => setActiveTab('menus')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'menus'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <span>Navigation Directory</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero Loophole Audit</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-slate-700 text-xs leading-relaxed">
          {/* TAB 1: WORKFLOWS */}
          {activeTab === 'workflows' && (
            <div className="space-y-6">
              {/* Step 1: Stock Inward */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center">
                      <ArrowDownToLine className="w-4 h-4 mr-1.5 text-emerald-600" />
                      How to Receive New Stock into Warehouse? (Stock Inward)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      When a new shipment of spare parts or purifier kits arrives from a vendor or factory:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step A: Search Item Code</p>
                    <p className="text-slate-500">
                      Navigate to <strong>Stock Inward (+)</strong> in the sidebar. Search and select the part SKU (such as <code>PUR-RO-GKK1-01</code> or <code>GBRC200</code>).
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step B: Quantity &amp; Date</p>
                    <p className="text-slate-500">
                      Enter the received quantity. Fill in supplier name, invoice/challan number, and delivery date (backdated entries are permitted).
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step C: Save to Ledger</p>
                    <p className="text-slate-500">
                      Click <strong>Confirm Stock Inward Entry</strong>. Stock is immediately added to warehouse balance and locked into the ledger.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Issue to Technician */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center">
                      <ArrowUpRight className="w-4 h-4 mr-1.5 text-indigo-600" />
                      How to Issue Kits &amp; Stock to Field Technicians? (Issue Stock)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      When dispatching bulk kits, replenishment batches, or spare parts to field engineers:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step A: Select Technician &amp; Kit</p>
                    <p className="text-slate-500">
                      Open <strong>Issue to Tech</strong>. Choose the target technician, enter the Kit/Batch Name, and specify or auto-calculate the Kit Amount.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step B: Add Spare Parts</p>
                    <p className="text-slate-500">
                      Search and add items to the batch or load a 1-click Quick Preset (e.g. RO 5-Stage Complete Kit). Set quantities.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step C: Confirm &amp; Print Slip</p>
                    <p className="text-slate-500">
                      Review the pop-up summary and confirm. A formal Transfer Voucher Slip will appear immediately with print capabilities.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Site Usage */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center">
                      <ClipboardCheck className="w-4 h-4 mr-1.5 text-sky-600" />
                      How to Log On-Site Installation Usage? (Log Site Usage)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      When a technician installs a part or filter in a customer purifier:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step A: 8-Digit CRM Case ID</p>
                    <p className="text-slate-500">
                      Go to <strong>Log Site Usage</strong>. Enter the customer&apos;s 8-digit CRM Case ID (e.g. <code>10293847</code>) and service completion date.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step B: Part Selection</p>
                    <p className="text-slate-500">
                      Select the installed part. The technician must physically hold this SKU in their stock bag.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Step C: Deduct &amp; Record</p>
                    <p className="text-slate-500">
                      Confirming the job deducts the item from the technician&apos;s balance and links the consumption to the customer ticket history.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4: Returns */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center">
                      <RotateCcw className="w-4 h-4 mr-1.5 text-amber-600" />
                      How to Return Unused or Surplus Stock? (Stock Cycle &amp; Returns)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      When unused or defective stock is returned to the warehouse to conclude a stock cycle:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">1. Bulk Return / Bag Clearance</p>
                    <p className="text-slate-500">
                      Switch to <strong>Return to Warehouse</strong> mode on the Issue page, or click &quot;Load All Held Items&quot; to credit returned pieces back to the central warehouse.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">2. Carry Forward or Fresh Cycle</p>
                    <p className="text-slate-500">
                      Under the <strong>Stock Cycle &amp; Reconciliation</strong> tab, view remaining stock in the technician&apos;s bag, retain active inventory, and issue fresh kits for the next operational cycle.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL MENUS DIRECTORY */}
          {activeTab === 'menus' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <Warehouse className="w-4 h-4 text-indigo-600" />
                  <span>Warehouse Stock</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Live central warehouse inventory levels, Box MRP vs Portal valuation, low stock thresholds, and damage write-offs.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                  <span>Stock Inward (+)</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Record supplier shipments, factory deliveries, and vendor invoices directly into the central warehouse inventory.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                  <span>Issue Stock / Kits</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Dispatch kits and spare parts to technicians with kit name, valuation, confirmation popups, and printable vouchers.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <ClipboardCheck className="w-4 h-4 text-sky-600" />
                  <span>Log Site Usage</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Record spare parts installed on customer service calls with 8-digit CRM Case IDs, deducting from technician bags.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <ScrollText className="w-4 h-4 text-slate-700" />
                  <span>Movement Ledger</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Immutable date-wise transaction audit trail recording Inward, Issue, Site Usage, and Return events.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Reconciliation Audit</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Zero-loophole physical verification ensuring Opening Stock + Inwards - Outwards = Current Stock without drift.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>Catalog &amp; Pricing Master</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Complete master list of Pureit filters, membranes, pumps, and kits with dual pricing and low stock safety levels.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Purifier Models Compatibility</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Instant lookup matching customer purifier models (Copper RO, Mineral RO, Marvella) to required kits and cartridges.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ZERO LOOPHOLE AUDIT */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Zero-Loophole Guarantee - Complete Accountability for Every Unit</span>
                </div>
                <p className="text-emerald-800 text-[11px]">
                  Every spare part in the AquaStock system is tracked with complete mathematical integrity. No item can be added or removed without an audited ledger event:
                </p>
              </div>

              <div className="space-y-2.5 text-[11px]">
                <div className="flex items-start space-x-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">1. Double-Entry Stock Movement:</strong>
                    <p className="text-slate-600">
                      When items are issued from the warehouse, the quantity is deducted from the warehouse and credited to the technician simultaneously. Stock cannot disappear in transit.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">2. Negative Stock Protection:</strong>
                    <p className="text-slate-600">
                      Transactions cannot exceed available stock. The server strictly enforces invariants and blocks negative quantities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">3. Date-Wise Ledger &amp; Auditing:</strong>
                    <p className="text-slate-600">
                      Every transaction logs invoice number, supplier, technician, and customer site details with a permanent timestamp, ready for 1-click CSV export at month-end.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Use <strong>Ctrl + K</strong> at any time to instantly search catalog items and purifier models.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
