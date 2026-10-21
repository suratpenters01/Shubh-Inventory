import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ItemMasterPage } from './pages/ItemMasterPage';
import { TechnicianMasterPage } from './pages/TechnicianMasterPage';
import { PurchasePage } from './pages/PurchasePage';
import { IssueStockPage } from './pages/IssueStockPage';
import { ReturnStockPage } from './pages/ReturnStockPage';
import { LogUsagePage } from './pages/LogUsagePage';
import { ReturnRequestsPage } from './pages/ReturnRequestsPage';
import { WarehouseStockPage } from './pages/WarehouseStockPage';
import { TechnicianStockMatrixPage } from './pages/TechnicianStockMatrixPage';
import { LedgerPage } from './pages/LedgerPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { MyStockPage } from './pages/MyStockPage';
import { CompatibilityPage } from './pages/CompatibilityPage';
import { StockCyclePage } from './pages/StockCyclePage';

const IndexRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/dashboard' : '/my-stock'} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Application Shell */}
            <Route element={<AppLayout />}>
              <Route index element={<IndexRedirect />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="items" element={<ItemMasterPage />} />
              <Route path="technicians" element={<TechnicianMasterPage />} />
              <Route path="purchase" element={<PurchasePage />} />
              <Route path="inward-register" element={<PurchasePage defaultTab="register" />} />
              <Route path="issue" element={<IssueStockPage />} />
              <Route path="return-stock" element={<ReturnStockPage />} />
              <Route path="return" element={<Navigate to="/return-stock" replace />} />
              <Route path="log-usage" element={<LogUsagePage />} />
              <Route path="returns" element={<ReturnRequestsPage />} />
              <Route path="warehouse-stock" element={<WarehouseStockPage />} />
              <Route path="technician-stock" element={<TechnicianStockMatrixPage />} />
              <Route path="ledger" element={<LedgerPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="stock-cycle" element={<StockCyclePage />} />
              <Route path="my-stock" element={<MyStockPage />} />
              <Route path="compatibility" element={<CompatibilityPage />} />
            </Route>

            <Route path="*" element={<IndexRedirect />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
