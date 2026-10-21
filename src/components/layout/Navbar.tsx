import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, RefreshCw, Search, Menu, X, HelpCircle, Shield, Wrench, Sparkles, Tag } from 'lucide-react';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { SystemGuideModal } from '../common/SystemGuideModal';
import { NotificationBell } from '../notifications/NotificationBell';
import { PriceManagerModal } from '../items/PriceManagerModal';
import { itemApi } from '../../services/api';
import { IItem } from '../../types';

interface NavbarProps {
  onRefresh?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
}) => {
  const { user, logout, quickLogin } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [navbarItems, setNavbarItems] = useState<IItem[]>([]);

  const handleOpenPriceManager = async () => {
    try {
      const data = await itemApi.getItems();
      setNavbarItems(data);
    } catch {
      // fallback
    }
    setIsPriceModalOpen(true);
  };

  // Platform detection for search shortcut: Cmd+K on Mac, Ctrl+K on Windows/Linux
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
  const searchShortcutText = isMac ? '⌘K' : 'Ctrl+K';

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 gap-2 sm:gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Left: Hamburger (mobile) + Brand Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 shrink-0">
          {onToggleMobileMenu && (
            <button
              id="mobile-menu-toggle-btn"
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Toggle Menu"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <div className="relative group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-700 text-white flex items-center justify-center font-display font-bold text-xs tracking-wider shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              AQ
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-200"></span>
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-base font-display font-extrabold text-slate-900 leading-tight tracking-tight">
                AquaStock
              </h1>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md hidden sm:inline-block tracking-wide">
                PUREIT OPS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
              Field Service &amp; Spare Parts Ledger
            </p>
          </div>
        </div>

        {/* Global Search Bar with Inglish search prompt */}
        <div className="flex-1 max-w-xs lg:max-w-sm xl:max-w-md mx-2 hidden md:block">
          <button
            id="nav-global-search-btn"
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 hover:border-slate-300 text-slate-500 hover:text-slate-900 px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer shadow-xs group"
          >
            <div className="flex items-center space-x-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition shrink-0" />
              <span className="truncate font-medium text-slate-600">
                Item code (e.g. PUR-RO) ya model...
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0 ml-2">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200/90 rounded-md text-slate-600 shadow-2xs font-semibold">
                {searchShortcutText}
              </kbd>
            </div>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Mobile search icon */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Search Item Codes"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Kit Rates Quick Finder & Updater */}
          <button
            type="button"
            id="nav-kit-rates-btn"
            onClick={handleOpenPriceManager}
            title="Kit Price Finder & Bulk Updater (AO Smith Portal vs Box MRP)"
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 border border-amber-500/25 transition cursor-pointer shadow-2xs shrink-0"
          >
            <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Kit Rates <span className="hidden xl:inline text-amber-700 font-normal">(Old/New)</span></span>
          </button>

          {/* System Guide Trigger */}
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            title="System Operations & User Guide"
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 border border-emerald-500/20 transition cursor-pointer shadow-2xs shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold">Guide <span className="hidden 2xl:inline text-emerald-700 font-normal">(User Manual)</span></span>
          </button>

          {onRefresh && (
            <button
              id="nav-refresh-btn"
              onClick={onRefresh}
              title="Refresh Data"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Real-Time Live Notification Center */}
          <NotificationBell />

          {/* Quick Demo Switcher with clear Inglish labels - Render only in Development */}
          {import.meta.env.DEV && (
            <div className="hidden xl:flex items-center bg-slate-100/90 p-0.5 rounded-xl text-xs border border-slate-200/90 shadow-2xs shrink-0">
              <button
                id="switch-admin-btn"
                onClick={() => quickLogin('admin')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                  user?.role === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3 h-3 text-sky-400" />
                <span>Admin</span>
              </button>
              <button
                id="switch-tech-btn"
                onClick={() => quickLogin('technician', '9876500001')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                  user?.role === 'technician'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-3 h-3 text-emerald-400" />
                <span>Tech</span>
              </button>
            </div>
          )}

          {/* User Profile Pill */}
          {user && (
            <div className="flex items-center space-x-2 pl-2 sm:pl-3 border-l border-slate-200 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight max-w-[130px] truncate">{user.name}</p>
                <div className="flex items-center justify-end space-x-1 mt-0.5">
                  {user.role === 'admin' ? (
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/60 px-1.5 py-0.2 rounded">
                      Warehouse Admin
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded">
                      Field Tech
                    </span>
                  )}
                </div>
              </div>

              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-950 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-slate-100">
                {user.name.charAt(0).toUpperCase()}
              </div>

              <button
                id="user-logout-btn"
                onClick={logout}
                title="Sign Out (Logout)"
                className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* System Guide Modal */}
      <SystemGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Kit Price Manager & Finder Dialog */}
      {isPriceModalOpen && (
        <PriceManagerModal
          isOpen={isPriceModalOpen}
          onClose={() => setIsPriceModalOpen(false)}
          items={navbarItems}
          onPricesUpdated={() => {
            onRefresh?.();
            handleOpenPriceManager();
          }}
        />
      )}
    </>
  );
};
