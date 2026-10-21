import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { reportApi } from '../../services/api';
import { NotificationToasts } from '../notifications/NotificationToasts';

export const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<{ lowStockCount: number; pendingReturnsCount: number }>({
    lowStockCount: 0,
    pendingReturnsCount: 0,
  });

  // Auto-close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchBadgeCounts = async () => {
    try {
      const res = await reportApi.getDashboardStats();
      setStats({
        lowStockCount: res.summary.lowStockCount,
        pendingReturnsCount: res.summary.pendingReturnsCount,
      });
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (user) {
      fetchBadgeCounts();
    }
  }, [user, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-zinc-500 font-medium">Loading AquaStock system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-900 antialiased selection:bg-sky-500 selection:text-white">
      <Navbar
        onRefresh={fetchBadgeCounts}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />
      <NotificationToasts />
      <div className="flex flex-1 relative">
        <Sidebar
          lowStockCount={stats.lowStockCount}
          pendingReturnsCount={stats.pendingReturnsCount}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
