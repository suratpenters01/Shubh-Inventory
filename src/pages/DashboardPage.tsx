import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../services/api';
import { IDashboardStats, IStockTransaction, IReconciliationResponse } from '../types';
import { StatCard } from '../components/common/StatCard';
import { TransactionTypeBadge } from '../components/common/Badge';
import { LowStockWidget } from '../components/dashboard/LowStockWidget';
import { Modal } from '../components/common/Modal';
import {
  Package,
  Warehouse,
  Users,
  AlertTriangle,
  RotateCcw,
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardCheck,
  Scale,
  Calendar,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<IDashboardStats | null>(null);
  const [reconData, setReconData] = useState<IReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const downloadReportEndpoint = async (endpoint: string, fallbackFilename: string) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to generate export file.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportInventory = async () => {
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadReportEndpoint('/api/reports/export/inventory-csv', `pureit_inventory_audit_${dateStr}.csv`);
      setExportSuccessMsg('✓ Inventory CSV audit file downloaded successfully!');
      setTimeout(() => setExportSuccessMsg(null), 3500);
    } catch {
      alert('Failed to export inventory CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLedger = async () => {
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadReportEndpoint('/api/reports/export/ledger-csv', `pureit_ledger_audit_${dateStr}.csv`);
      setExportSuccessMsg('✓ Full Ledger CSV audit report downloaded successfully!');
      setTimeout(() => setExportSuccessMsg(null), 3500);
    } catch {
      alert('Failed to export ledger CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllBundle = async () => {
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadReportEndpoint('/api/reports/export/inventory-csv', `pureit_inventory_audit_${dateStr}.csv`);
      await new Promise((resolve) => setTimeout(resolve, 600));
      await downloadReportEndpoint('/api/reports/export/ledger-csv', `pureit_ledger_audit_${dateStr}.csv`);
      setExportSuccessMsg('✓ Both Inventory & Ledger CSV files downloaded successfully!');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch {
      alert('Failed to export audit bundle.');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const [res, recon] = await Promise.all([
        reportApi.getDashboardStats(),
        reportApi.getReconciliation().catch(() => null),
      ]);
      setData(res);
      setReconData(recon);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading live operations dashboard...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    totalItems: 0,
    totalWarehouseQty: 0,
    activeTechnicians: 0,
    lowStockCount: 0,
    pendingReturnsCount: 0,
  };

  const chartData = data?.issuesPerTechnicianChartData || [];
  const recentTx = data?.recentActivity || [];
  const barColors = ['#0284c7', '#0ea5e9', '#38bdf8', '#10b981', '#6366f1'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar with Clear Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
              Operations Overview
            </h2>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md">
              Live Stock &amp; Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Warehouse balance, technician issues, and movement ledger live status.
          </p>
        </div>

        {/* 4 Clear Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            id="dash-quick-purchase-btn"
            to="/purchase"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-600/25 active:scale-95 cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
            + Stock Inward
          </Link>

          <Link
            id="dash-quick-issue-btn"
            to="/issue"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm shadow-sky-600/25 active:scale-95 cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
            → Issue to Tech
          </Link>

          <Link
            id="dash-quick-usage-btn"
            to="/log-usage"
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 transition active:scale-95 cursor-pointer border border-slate-200/70"
          >
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            ✓ Log Usage
          </Link>

          <button
            type="button"
            id="dash-export-audit-csv-btn"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer active:scale-95 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid with Themed Colors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <StatCard
          id="stat-card-items"
          title="Catalog SKUs"
          value={summary.totalItems}
          subtitle="Total pureit parts & kits"
          color="slate"
          icon={<Package className="w-4 h-4 text-slate-600" />}
        />
        <StatCard
          id="stat-card-wh-qty"
          title="Warehouse Stock"
          value={`${summary.totalWarehouseQty}`}
          subtitle="Available warehouse units"
          color="sky"
          icon={<Warehouse className="w-4 h-4 text-sky-600" />}
        />
        <StatCard
          id="stat-card-techs"
          title="Field Technicians"
          value={summary.activeTechnicians}
          subtitle="Active team members"
          color="sky"
          icon={<Users className="w-4 h-4 text-sky-600" />}
        />
        <StatCard
          id="stat-card-low-stock"
          title="Low Stock Alert"
          value={summary.lowStockCount}
          subtitle="Units below threshold"
          color="rose"
          highlight={summary.lowStockCount > 0}
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        />
        <StatCard
          id="stat-card-pending-returns"
          title="Return Requests"
          value={summary.pendingReturnsCount}
          subtitle="Approval pending"
          color="amber"
          icon={<RotateCcw className="w-4 h-4 text-amber-600" />}
        />
      </div>

      {/* Zero Loophole Invariant Banner: connected to real reconciliation result */}
      {summary.totalWarehouseQty === 0 && recentTx.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 ring-4 ring-amber-100"></div>
            <p className="truncate">
              <strong className="font-semibold text-slate-800">No inventory data yet</strong> - begin by recording a Stock Inward entry.
            </p>
          </div>
          <Link
            to="/purchase"
            className="text-indigo-600 hover:text-indigo-800 font-bold underline shrink-0 text-[11px]"
          >
            + Record Stock Inward →
          </Link>
        </div>
      ) : reconData?.summary.overallSystemStatus === 'DISCREPANCY_DETECTED' || (reconData && reconData.summary.mismatchedCount > 0) ? (
        <div className="bg-rose-50/80 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-900 shadow-2xs">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ring-4 ring-rose-100"></div>
            <p className="truncate">
              <strong className="font-bold">Zero-Loophole Discrepancy:</strong> Variance detected across {reconData.summary.mismatchedCount} item{reconData.summary.mismatchedCount > 1 ? 's' : ''} (Variance: {reconData.items.reduce((acc, i) => acc + Math.abs(i.variance), 0)} units).
            </p>
          </div>
          <Link
            to="/reconciliation"
            className="text-rose-800 hover:text-rose-950 font-bold underline shrink-0 text-[11px]"
          >
            Audit &amp; Resync →
          </Link>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-100"></div>
            <p className="truncate">
              <strong className="font-bold">Zero-Loophole Verified:</strong> Warehouse Stock + Technician Hand Stock + Site Usage = Total Inward. Zero units unaccounted for.
            </p>
          </div>
          <Link
            to="/reconciliation"
            className="text-emerald-800 hover:text-emerald-950 font-bold underline shrink-0 text-[11px]"
          >
            Check Reconciliation Audit →
          </Link>
        </div>
      )}

      {/* Low Stock Alerts Widget */}
      <LowStockWidget
        items={data?.lowStockItems || []}
        isLoading={isLoading}
        onRefresh={fetchStats}
        onItemUpdated={fetchStats}
      />

      {/* Charts & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Issues per Technician Chart */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Stock Issued This Month per Technician
              </h3>
              <p className="text-xs text-slate-500">
                Total parts transferred per technician during this month
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center border border-slate-200">
              <Calendar className="w-3 h-3 mr-1 text-slate-500" /> This Month
            </span>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="technician"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                    }}
                    formatter={(val: any) => [`${val} units`, 'Total Issued']}
                  />
                  <Bar dataKey="issuedQuantity" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No stock issue transactions recorded this month.
              </div>
            )}
          </div>
        </div>

        {/* Recent Ledger Activity */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Movements</h3>
              <p className="text-xs text-slate-500">Latest movement ledger entries</p>
            </div>
            <Link to="/ledger" className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center">
              View All Ledger →
            </Link>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-64 pr-1">
            {recentTx.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No transactions recorded yet.</p>
            ) : (
              recentTx.map((tx: IStockTransaction) => {
                const item = typeof tx.item === 'object' ? tx.item : null;
                const tech = typeof tx.technician === 'object' ? tx.technician : null;

                return (
                  <div
                    key={tx._id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between text-xs transition"
                  >
                    <div className="space-y-0.5 truncate mr-2">
                      <div className="flex items-center space-x-1.5">
                        <TransactionTypeBadge type={tx.transactionType} />
                        <span className="font-bold text-slate-900 truncate">
                          {item?.itemName || 'Item'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {tx.transactionType === 'PURCHASE_IN' && `Inward (${tx.supplierName || 'Direct Vendor'})`}
                        {tx.transactionType === 'ISSUE_TO_TECH' && `Technician: ${tech?.name || 'Assigned'}`}
                        {tx.transactionType === 'USAGE_AT_SITE' && (tx.jobReference ? `Case ID: ${tx.jobReference}` : `Usage: ${tx.siteName || 'On-Site'}`)}
                        {tx.transactionType === 'RETURN_TO_WAREHOUSE' && `Returned by ${tech?.name || 'Tech'}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-slate-900 tabular-nums font-mono text-sm">
                        {tx.quantity} {item?.unit || 'pcs'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Audit Export Modal */}
      <Modal
        id="modal-audit-export-dash"
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Data to CSV (Excel Report)"
        subtitle="Download standard CSV spreadsheets for physical auditing, reconciliation, and reporting"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          {exportSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-between">
              <span>{exportSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setExportSuccessMsg(null)}
                className="font-bold text-emerald-900 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {/* Option 1: Inventory */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Current Inventory Snapshot</p>
                <p className="text-[11px] text-slate-500">
                  Full list of items with warehouse balance, alert thresholds, and dual pricing.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-inventory-modal"
                onClick={handleExportInventory}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
              >
                {isExporting ? 'Exporting...' : 'Export Inventory'}
              </button>
            </div>

            {/* Option 2: Full Ledger */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Complete Transaction Ledger</p>
                <p className="text-[11px] text-slate-500">
                  Detailed transaction register: Inward shipments, issues to techs, site usage, and returns.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-ledger-modal"
                onClick={handleExportLedger}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
              >
                {isExporting ? 'Exporting...' : 'Export Ledger'}
              </button>
            </div>

            {/* Option 3: Bundle */}
            <div className="p-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Download Both (Full Audit Bundle)</p>
                <p className="text-[11px] text-slate-500">
                  Export both inventory stock balances and full transaction ledger into CSV files together.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-bundle-modal"
                onClick={handleExportAllBundle}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                Download Both
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
