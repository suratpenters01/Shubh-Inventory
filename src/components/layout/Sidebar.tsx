import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../services/api';
import {
  LayoutDashboard,
  Package,
  Users,
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardCheck,
  RotateCcw,
  Warehouse,
  Grid3X3,
  ScrollText,
  Scale,
  Briefcase,
  AlertTriangle,
  Layers,
  X,
  ShieldCheck,
  Tag,
  Clock,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  lowStockCount?: number;
  pendingReturnsCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lowStockCount = 0,
  pendingReturnsCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [reconStatus, setReconStatus] = useState<{
    isMatched: boolean;
    differenceText: string;
  }>({ isMatched: true, differenceText: 'Matched ✓' });

  useEffect(() => {
    let isMounted = true;
    const checkReconciliation = async () => {
      try {
        const res = await reportApi.getReconciliation();
        if (!isMounted) return;
        const mismatchedCount = res.summary.mismatchedCount;
        const totalVariance = res.items?.reduce((acc, i) => acc + Math.abs(i.variance), 0) || 0;
        if (mismatchedCount === 0 && totalVariance === 0) {
          setReconStatus({ isMatched: true, differenceText: 'Matched ✓' });
        } else {
          setReconStatus({
            isMatched: false,
            differenceText: `Diff: ${totalVariance > 0 ? totalVariance : mismatchedCount}`,
          });
        }
      } catch {
        // Fallback default
      }
    };
    checkReconciliation();
    const interval = setInterval(checkReconciliation, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
      isActive
        ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold shadow-md shadow-sky-600/25 ring-1 ring-sky-500/20'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
    }`;

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between p-3 sm:p-4">
      <div className="space-y-5">
        {/* Mobile Header with close button */}
        <div className="flex md:hidden items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-display font-bold text-xs shadow-xs">
              AQ
            </div>
            <span className="font-display font-extrabold text-sm text-slate-900">AquaStock Menu</span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Technician Workspace View */}
        {!isAdmin && (
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Technician Workspace
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200/60">
                Field
              </span>
            </div>
            <NavLink
              id="side-link-my-stock"
              to="/my-stock"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Briefcase className="w-4 h-4" />
                <span>My Hand Stock</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal">Bag Stock</span>
            </NavLink>
            <NavLink
              id="side-link-log-usage"
              to="/log-usage"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <ClipboardCheck className="w-4 h-4" />
                <span>Log Site Usage</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal">Usage</span>
            </NavLink>
            <NavLink
              id="side-link-returns"
              to="/returns"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <RotateCcw className="w-4 h-4" />
                <span>Return Requests</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal">Returns</span>
            </NavLink>
            <NavLink
              id="side-link-items"
              to="/items"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Package className="w-4 h-4" />
                <span>Spares &amp; Kits</span>
              </div>
            </NavLink>
            <NavLink
              id="side-link-compatibility"
              to="/compatibility"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Layers className="w-4 h-4" />
                <span>Model Compatibility</span>
              </div>
            </NavLink>
          </div>
        )}

        {/* Admin Section 1: Warehouse Operations */}
        {isAdmin && (
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Operations (Warehouse)
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded border border-indigo-200/60">
                Core
              </span>
            </div>
            <NavLink
              id="side-link-dashboard"
              to="/dashboard"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </div>
              <span className="text-[10px] opacity-70 font-normal">Overview</span>
            </NavLink>
            <NavLink
              id="side-link-warehouse"
              to="/warehouse-stock"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Warehouse className="w-4 h-4" />
                <span>Warehouse Stock</span>
              </div>
              {lowStockCount > 0 ? (
                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-full flex items-center">
                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                  {lowStockCount}
                </span>
              ) : (
                <span className="text-[10px] opacity-70 font-normal">Warehouse</span>
              )}
            </NavLink>
            <NavLink
              id="side-link-purchase"
              to="/purchase"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                <span>Stock Inward (+)</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                + Inward
              </span>
            </NavLink>
            <NavLink
              id="side-link-inward-register"
              to="/inward-register"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Inward Register</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded-full">
                Register
              </span>
            </NavLink>
            <NavLink
              id="side-link-issue"
              to="/issue"
              end
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <ArrowUpRight className="w-4 h-4 text-sky-600" />
                <span>Issue to Tech (→)</span>
              </div>
              <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.2 rounded-full">
                Outward
              </span>
            </NavLink>
            <NavLink
              id="side-link-return-stock"
              to="/return-stock"
              end
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <RotateCcw className="w-4 h-4 text-teal-600" />
                <span>Return to Warehouse (⟲)</span>
              </div>
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded-full">
                Bulk Inward
              </span>
            </NavLink>
            <NavLink
              id="side-link-admin-returns"
              to="/returns"
              end
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Pending Return Requests</span>
              </div>
              {pendingReturnsCount > 0 ? (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">
                  {pendingReturnsCount}
                </span>
              ) : (
                <span className="text-[10px] opacity-70 font-normal">Approvals</span>
              )}
            </NavLink>
          </div>
        )}

        {/* Admin Section 2: Field & Tracking */}
        {isAdmin && (
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Field &amp; Settlement
              </span>
            </div>
            <NavLink
              id="side-link-tech-matrix"
              to="/technician-stock"
              end
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Grid3X3 className="w-4 h-4" />
                <span>Tech Stock Matrix</span>
              </div>
              <span className="text-[10px] opacity-70 font-normal">All Techs</span>
            </NavLink>
            <NavLink
              id="side-link-stock-cycle"
              to="/stock-cycle"
              end
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Scale className="w-4 h-4 text-indigo-500" />
                <span>Stock Cycle &amp; Settlement</span>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full">
                Kit Cycle
              </span>
            </NavLink>
            <NavLink
              id="side-link-admin-usage"
              to="/log-usage"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <ClipboardCheck className="w-4 h-4" />
                <span>Log Site Usage</span>
              </div>
              <span className="text-[10px] opacity-70 font-normal">Site Log</span>
            </NavLink>
            <NavLink
              id="side-link-reconciliation"
              to="/reconciliation"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>Reconciliation Audit</span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded">
                Check
              </span>
            </NavLink>
            <NavLink
              id="side-link-ledger"
              to="/ledger"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <ScrollText className="w-4 h-4" />
                <span>Movement Ledger</span>
              </div>
              <span className="text-[10px] opacity-70 font-normal">History</span>
            </NavLink>
          </div>
        )}

        {/* Master Catalogs */}
        <div className="space-y-1">
          <div className="px-3 pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Catalogs (Master Data)
            </span>
          </div>
          <NavLink
            id="side-link-items"
            to="/items"
            className={linkClass}
            onClick={handleLinkClick}
          >
            <div className="flex items-center space-x-2.5">
              <Package className="w-4 h-4" />
              <span>Catalog &amp; Min Stock</span>
            </div>
            <span className="text-[10px] opacity-70 font-normal">Parts List</span>
          </NavLink>
          <NavLink
            id="side-link-kit-prices"
            to="/items?tab=prices"
            className={linkClass}
            onClick={handleLinkClick}
          >
            <div className="flex items-center space-x-2.5">
              <Tag className="w-4 h-4 text-emerald-500" />
              <span>Kit Price Manager</span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
              Old/New
            </span>
          </NavLink>
          <NavLink
            id="side-link-compatibility"
            to="/compatibility"
            className={linkClass}
            onClick={handleLinkClick}
          >
            <div className="flex items-center space-x-2.5">
              <Layers className="w-4 h-4" />
              <span>Purifier Models Finder</span>
            </div>
            <span className="text-[10px] opacity-70 font-normal">Compatibility</span>
          </NavLink>
          {isAdmin && (
            <NavLink
              id="side-link-technicians"
              to="/technicians"
              className={linkClass}
              onClick={handleLinkClick}
            >
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4" />
                <span>Technicians Master</span>
              </div>
              <span className="text-[10px] opacity-70 font-normal">Team</span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Clean quiet footer */}
      <div className="pt-4 border-t border-slate-200 px-2 space-y-1">
        <NavLink
          to="/reconciliation"
          onClick={handleLinkClick}
          className={`p-2 rounded-lg text-[11px] flex items-center justify-between transition cursor-pointer ${
            reconStatus.isMatched
              ? 'bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 hover:bg-emerald-100'
              : 'bg-rose-50/70 border border-rose-200/60 text-rose-800 hover:bg-rose-100'
          }`}
        >
          <span className="flex items-center font-semibold">
            <span
              className={`w-2 h-2 rounded-full mr-2 inline-block animate-pulse ${
                reconStatus.isMatched ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            ></span>
            Zero-Loophole Audit
          </span>
          <span
            className={`text-[10px] font-bold ${
              reconStatus.isMatched ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {reconStatus.differenceText}
          </span>
        </NavLink>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white/90 backdrop-blur-xl border-r border-slate-200/90 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto shrink-0 shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 md:hidden backdrop-blur-2xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Slide-in Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform md:hidden transition-transform duration-200 ease-in-out shadow-2xl overflow-y-auto ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </div>
    </>
  );
};
