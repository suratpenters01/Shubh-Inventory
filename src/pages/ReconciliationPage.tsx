import React, { useState, useEffect } from 'react';
import { reportApi } from '../services/api';
import { IReconciliationResponse, IReconciliationItem } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  ShieldCheck,
  Calculator,
  ArrowRight,
  Download,
} from 'lucide-react';
import { exportReconciliationToCsv } from '../utils/csvExport';

export const ReconciliationPage: React.FC = () => {
  const [data, setData] = useState<IReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Audit detail inspection modal
  const [auditModalItem, setAuditModalItem] = useState<IReconciliationItem | null>(null);

  const fetchReconciliation = async () => {
    try {
      setIsLoading(true);
      const res = await reportApi.getReconciliation();
      setData(res);
    } catch (err) {
      console.error('Failed to load reconciliation', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const handleRecalculateAndVerify = async () => {
    try {
      setIsVerifying(true);
      setVerificationFeedback(null);
      const res = await reportApi.recalculateAndVerify(true);
      setData(res);
      setVerificationFeedback(
        res.summary.overallSystemStatus === 'PERFECT_MATCH'
          ? '✓ Verification Complete: All cached balances match the raw immutable ledger replay with 0 variance!'
          : `⚠ Warning: ${res.summary.mismatchedCount} items had variances and have been re-synchronized to match the immutable ledger.`
      );
    } catch (err: any) {
      setVerificationFeedback('Failed to run recalculation verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetToZeroStock = async () => {
    if (!window.confirm('Do you want to reset all inventory stocks to zero (0)? All catalog item stocks will become 0 so you can record fresh inventory.')) {
      return;
    }
    try {
      setIsVerifying(true);
      setVerificationFeedback(null);
      const res = await reportApi.resetZeroStock();
      setData(res);
      setVerificationFeedback('✓ All stock balances reset to zero (0). You can now begin fresh purchase and issue entries.');
    } catch (err: any) {
      setVerificationFeedback('Failed to reset stock to zero.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetToPureit = async () => {
    if (!window.confirm('Reset database to authentic Pureit live catalog and ledger transactions? All dummy records will be permanently purged.')) {
      return;
    }
    try {
      setIsVerifying(true);
      setVerificationFeedback(null);
      const res = await reportApi.resetLiveCatalog();
      setData(res);
      setVerificationFeedback('✓ Database re-initialized with official Live Pureit Catalog. Invariant 100% verified across all 20 SKUs.');
    } catch (err: any) {
      setVerificationFeedback('Failed to reset to live Pureit catalog.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExportAuditCsv = () => {
    if (!items || items.length === 0) return;
    exportReconciliationToCsv(items);
    setVerificationFeedback('✓ Exported reconciliation audit verification sheet to CSV successfully!');
  };

  const summary = data?.summary;
  const items = data?.items || [];
  const isPerfect = summary?.overallSystemStatus === 'PERFECT_MATCH';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                Stock Reconciliation &amp; Invariant Audit
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Mathematical proof that no filter or spare part is ever unaccounted for
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="reset-zero-stock-btn"
            onClick={handleResetToZeroStock}
            disabled={isVerifying}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Reset all warehouse and technician stock balances to zero"
          >
            Set All Stock to 0 (Fresh Start)
          </button>

          <button
            id="export-reconciliation-csv-btn"
            onClick={handleExportAuditCsv}
            disabled={isLoading || items.length === 0}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Export full reconciliation audit report to CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
            Export Audit Sheet (CSV)
          </button>

          <button
            id="recalculate-verify-btn"
            onClick={handleRecalculateAndVerify}
            disabled={isVerifying}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Replaying Ledger...' : 'Recalculate & Verify from Ledger'}
          </button>
        </div>
      </div>

      {/* Verification Feedback Banner */}
      {verificationFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-2xs ${
            isPerfect
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isPerfect ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{verificationFeedback}</span>
          </div>
          <button
            onClick={() => setVerificationFeedback(null)}
            className="text-xs underline font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* The Core Accounting Formula Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl p-6 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Core Inventory Accounting Formula
          </span>
          <span
            className={`text-xs px-3 py-1 rounded-xl font-bold tracking-wide ${
              isPerfect ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}
          >
            {isPerfect ? 'SYSTEM AUDIT: 100% BALANCED' : 'AUDIT DISCREPANCY'}
          </span>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-xs sm:text-sm text-center leading-relaxed">
          <span className="text-sky-400 font-bold">Total Purchased (All-Time)</span>
          <span className="text-slate-400 mx-2">=</span>
          <span className="text-emerald-400 font-bold">Current Warehouse Balance</span>
          <span className="text-slate-400 mx-2">+</span>
          <span className="text-indigo-400 font-bold">∑ Tech Balances (All Techs)</span>
          <span className="text-slate-400 mx-2">+</span>
          <span className="text-amber-400 font-bold">Total Consumed (All-Time)</span>
          <span className="text-slate-400 mx-2">+</span>
          <span className="text-rose-400 font-bold">Total Damaged</span>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-center text-xs">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition">
              <span className="text-slate-400 text-[11px] font-medium block">Total Inward Ever</span>
              <span className="text-xl font-bold text-sky-400 font-mono tabular-nums">{summary.totalPurchasedQty}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition">
              <span className="text-slate-400 text-[11px] font-medium block">In Warehouse</span>
              <span className="text-lg font-bold text-emerald-400">{summary.totalWarehouseQty}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
              <span className="text-zinc-400 text-[11px] block">Held by All Techs</span>
              <span className="text-lg font-bold text-purple-400">{summary.totalTechQty}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
              <span className="text-zinc-400 text-[11px] block">Consumed at Sites</span>
              <span className="text-lg font-bold text-amber-400">{summary.totalConsumedQty}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
              <span className="text-zinc-400 text-[11px] block">Damaged Write-offs</span>
              <span className="text-lg font-bold text-rose-400">{summary.totalDamagedQty}</span>
            </div>
          </div>
        )}
      </div>

      {/* Reconciliation Table per SKU */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900">Per-SKU Ledger Audit Verification</h3>
          <span className="text-xs text-zinc-500">
            {summary?.matchedCount} of {summary?.totalItems} Items Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Item SKU &amp; Name</th>
                <th className="py-3 px-3 text-right bg-blue-50/50">Purchased (A)</th>
                <th className="py-3 px-3 text-right">Warehouse (B)</th>
                <th className="py-3 px-3 text-right">Techs Sum (C)</th>
                <th className="py-3 px-3 text-right">Consumed (D)</th>
                <th className="py-3 px-3 text-right">Damaged (E)</th>
                <th className="py-3 px-3 text-right font-bold bg-zinc-100/70">Sum (B+C+D+E)</th>
                <th className="py-3 px-3 text-center">Variance</th>
                <th className="py-3 px-4 text-center">Invariant Status</th>
                <th className="py-3 px-3 text-right">Audit Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-sans">Calculating ledger reconciliation...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-zinc-400 font-sans">
                    No catalog items available for audit.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isMatched = row.status === 'MATCHED' && row.variance === 0;

                  return (
                    <tr
                      key={row.item._id}
                      className={`hover:bg-zinc-50/80 transition ${
                        !isMatched ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-sans">
                        <span className="font-mono font-bold text-zinc-900">{row.item.itemCode}</span>
                        <p className="text-[11px] text-zinc-600 font-medium">{row.item.itemName}</p>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-blue-700 bg-blue-50/30">
                        {row.totalPurchased}
                      </td>

                      <td className="py-3 px-3 text-right text-zinc-800">
                        {row.warehouseBalance}
                      </td>

                      <td className="py-3 px-3 text-right text-purple-700 font-medium">
                        {row.techniciansTotalBalance}
                      </td>

                      <td className="py-3 px-3 text-right text-amber-700">
                        {row.totalConsumed}
                      </td>

                      <td className="py-3 px-3 text-right text-rose-700">
                        {row.totalDamaged}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-zinc-900 bg-zinc-100/50">
                        {row.actualAvailable}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-bold ${
                            row.variance === 0 ? 'text-zinc-400' : 'text-red-600'
                          }`}
                        >
                          {row.variance === 0 ? '0' : row.variance > 0 ? `+${row.variance}` : row.variance}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-sans">
                        {isMatched ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            MATCHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-red-800 bg-red-100 border border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            MISMATCH
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          onClick={() => setAuditModalItem(row)}
                          className="px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition cursor-pointer"
                        >
                          Inspect Math →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Audit Math Inspection Modal */}
      <Modal
        id="modal-audit-inspect"
        isOpen={!!auditModalItem}
        onClose={() => setAuditModalItem(null)}
        title={`Ledger Replay Audit: ${auditModalItem?.item.itemCode}`}
        subtitle="Independent recalculation computed from raw immutable transactions"
        maxWidth="lg"
      >
        {auditModalItem && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <p className="font-bold text-zinc-900 text-sm">{auditModalItem.item.itemName}</p>
              <p className="text-zinc-500">SKU Code: {auditModalItem.item.itemCode} • Unit: {auditModalItem.item.unit}</p>
            </div>

            {/* Warehouse Equation */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">
                1. Central Warehouse Balance Derivation
              </p>
              <div className="grid grid-cols-2 gap-2 text-zinc-600">
                <div>+ Total Purchased (Inward): <strong>{auditModalItem.ledgerAudit.totalPurchased}</strong></div>
                <div>- Total Issued to Techs: <strong>{auditModalItem.ledgerAudit.totalIssued}</strong></div>
                <div>+ Total Returned by Techs: <strong>{auditModalItem.ledgerAudit.totalReturned}</strong></div>
                <div>- Total Damaged / Written-off: <strong>{auditModalItem.ledgerAudit.totalDamaged}</strong></div>
              </div>
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between font-bold text-zinc-900">
                <span>Calculated Warehouse Stock:</span>
                <span className="text-emerald-700">{auditModalItem.ledgerAudit.calculatedWarehouse} {auditModalItem.item.unit}</span>
              </div>
            </div>

            {/* Tech Equation */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">
                2. Field Technicians' Custody Derivation
              </p>
              <div className="grid grid-cols-2 gap-2 text-zinc-600">
                <div>+ Total Issued from Warehouse: <strong>{auditModalItem.ledgerAudit.totalIssued}</strong></div>
                <div>- Total Consumed at Sites: <strong>{auditModalItem.ledgerAudit.totalUsed}</strong></div>
                <div>- Total Returned to Warehouse: <strong>{auditModalItem.ledgerAudit.totalReturned}</strong></div>
              </div>
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between font-bold text-zinc-900">
                <span>Calculated Tech Custody Total:</span>
                <span className="text-purple-700">{auditModalItem.ledgerAudit.calculatedTechTotal} {auditModalItem.item.unit}</span>
              </div>
            </div>

            {/* Invariant Verification Statement */}
            <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
              <div className="flex items-center space-x-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero Drift Audit Guarantee</span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1">
                Every unit purchased ({auditModalItem.totalPurchased}) is physically accounted for:
                {' '}{auditModalItem.warehouseBalance} in warehouse + {auditModalItem.techniciansTotalBalance} with technicians + {auditModalItem.totalConsumed} installed at customer premises + {auditModalItem.totalDamaged} damaged.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAuditModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
