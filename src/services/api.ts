import axios from 'axios';
import {
  IUser,
  IItem,
  IStockTransaction,
  IWarehouseBalanceItem,
  IReturnRequest,
  IReconciliationResponse,
  IDashboardStats,
  INotification,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401 Unauthorized to trigger clean logout if expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (phone: string, password: string) => {
    const res = await api.post<{ message: string; token: string; user: IUser }>('/auth/login', {
      phone,
      password,
    });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<{ user: IUser }>('/auth/me');
    return res.data;
  },
};

export const itemApi = {
  getItems: async (params?: { category?: string; search?: string; isActive?: boolean }) => {
    const res = await api.get<{ items: IItem[] }>('/items', { params });
    return res.data.items;
  },
  addItem: async (data: {
    itemCode: string;
    itemName: string;
    category: string;
    unit?: string;
    price?: number;
    gkkType?: string;
    compatibleModels?: string;
    lowStockThreshold?: number;
    reorderLevel?: number;
  }) => {
    const res = await api.post<{ message: string; item: IItem }>('/items', data);
    return res.data;
  },
  updateItem: async (id: string, data: Partial<IItem>) => {
    const res = await api.put<{ message: string; item: IItem }>(`/items/${id}`, data);
    return res.data;
  },
  updateItemPrice: async (
    id: string,
    data: { oldPrice: number; newPrice: number; priceNotes?: string }
  ) => {
    const res = await api.put<{ message: string; item: IItem }>(`/items/${id}/prices`, data);
    return res.data;
  },
  bulkUpdatePrices: async (
    updates: Array<{ id: string; oldPrice: number; newPrice: number; priceNotes?: string }>
  ) => {
    const res = await api.post<{ message: string; updatedCount: number; items: IItem[] }>(
      '/items/bulk-update-prices',
      { updates }
    );
    return res.data;
  },
};

export const technicianApi = {
  getTechnicians: async () => {
    const res = await api.get<{ technicians: IUser[] }>('/technicians');
    return res.data.technicians;
  },
  addTechnician: async (data: {
    name: string;
    phone: string;
    password: string;
    area?: string;
    employeeCode?: string;
    email?: string;
    notes?: string;
  }) => {
    const res = await api.post<{ message: string; technician: IUser }>('/admin/technicians', data);
    return res.data;
  },
  updateTechnician: async (
    id: string,
    data: {
      name?: string;
      phone?: string;
      area?: string;
      employeeCode?: string;
      email?: string;
      notes?: string;
      isActive?: boolean;
      password?: string;
    }
  ) => {
    const res = await api.put<{ message: string; technician: IUser }>(`/admin/technicians/${id}`, data);
    return res.data;
  },
  resetPassword: async (id: string, password: string) => {
    const res = await api.post<{ message: string }>(`/admin/technicians/${id}/reset-password`, { password });
    return res.data;
  },
  toggleStatus: async (id: string) => {
    const res = await api.post<{ message: string; isActive: boolean; technician: IUser }>(
      `/admin/technicians/${id}/toggle-status`
    );
    return res.data;
  },
  deleteTechnician: async (id: string) => {
    const res = await api.delete<{ message: string; deleted?: boolean; deactivated?: boolean }>(
      `/admin/technicians/${id}`
    );
    return res.data;
  },
};

export const stockApi = {
  recordPurchase: async (
    data: {
      itemId: string;
      quantity: number;
      supplierName?: string;
      invoiceNumber?: string;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/purchase', data, { headers });
    return res.data;
  },
  purchaseBulk: async (
    data: {
      items: Array<{ itemId: string; quantity: number; remarks?: string }>;
      supplierName?: string;
      invoiceNumber?: string;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/purchase-bulk', data, { headers });
    return res.data;
  },
  issueStock: async (
    data: {
      itemId: string;
      technicianId: string;
      quantity: number;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/issue', data, { headers });
    return res.data;
  },
  issueBulk: async (
    data: {
      technicianId: string;
      items: Array<{ itemId: string; quantity: number; remarks?: string }>;
      kitName?: string;
      kitAmount?: number;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/issue-bulk', data, { headers });
    return res.data;
  },
  returnBulk: async (
    data: {
      technicianId: string;
      items: Array<{ itemId: string; quantity: number; reason?: string }>;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/return-bulk', data, { headers });
    return res.data;
  },
  logUsage: async (
    data: {
      itemId: string;
      technicianId?: string;
      quantity: number;
      caseId?: string;
      siteName?: string;
      jobReference?: string;
      remarks?: string;
      transactionDate?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/usage', data, { headers });
    return res.data;
  },
  recordDamageWriteoff: async (data: {
    itemId: string;
    quantity: number;
    reason?: string;
    remarks?: string;
  }) => {
    const res = await api.post('/stock/damage-writeoff', data);
    return res.data;
  },
  submitReturnRequest: async (
    data: { itemId: string; quantity: number; reason: string },
    idempotencyKey?: string
  ) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const res = await api.post('/stock/return-request', data, { headers });
    return res.data;
  },
  getReturnRequests: async (status?: string) => {
    const res = await api.get<{ returnRequests: IReturnRequest[] }>('/stock/return-requests', {
      params: { status },
    });
    return res.data.returnRequests;
  },
  confirmReturnRequest: async (id: string) => {
    const res = await api.put(`/stock/return-request/${id}/confirm`);
    return res.data;
  },
  rejectReturnRequest: async (id: string, reason?: string) => {
    const res = await api.put(`/stock/return-request/${id}/reject`, { reason });
    return res.data;
  },
  getWarehouseBalances: async () => {
    const res = await api.get<{ balances: IWarehouseBalanceItem[] }>('/stock/warehouse-balance');
    return res.data.balances;
  },
  getTechnicianBalance: async (technicianId: string) => {
    const res = await api.get<{
      technician: { id: string; name: string; phone: string };
      balances: Array<{ item: IItem; quantity: number }>;
    }>(`/stock/technician-balance/${technicianId}`);
    return res.data;
  },
  getTechnicianBalanceMatrix: async () => {
    const res = await api.get<{
      technicians: IUser[];
      items: IItem[];
      matrix: Array<{
        item: IItem;
        warehouseQty: number;
        techBalances: Record<string, number>;
        totalHeldByTechs: number;
      }>;
    }>('/stock/technician-balance');
    return res.data;
  },
  getLedger: async (params?: {
    itemId?: string;
    technicianId?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }) => {
    const res = await api.get<{ transactions: IStockTransaction[] }>('/stock/ledger', { params });
    return res.data.transactions;
  },
};

export const reportApi = {
  resetZeroStock: async () => {
    const res = await api.post<IReconciliationResponse>('/reports/reset-zero-stock');
    return res.data;
  },
  resetLiveCatalog: async () => {
    const res = await api.post<IReconciliationResponse>('/reports/reset-live-catalog');
    return res.data;
  },
  getReconciliation: async () => {
    const res = await api.get<IReconciliationResponse>('/reports/reconciliation');
    return res.data;
  },
  recalculateAndVerify: async (resync = true) => {
    const res = await api.post<IReconciliationResponse>('/reports/reconciliation/recalculate', {
      resync,
    });
    return res.data;
  },
  getLowStock: async () => {
    const res = await api.get<{ count: number; items: any[] }>('/reports/low-stock');
    return res.data;
  },
  getDashboardStats: async () => {
    const res = await api.get<IDashboardStats>('/reports/dashboard-stats');
    return res.data;
  },
  exportInventoryCsvUrl: () => '/api/reports/export/inventory-csv',
  exportLedgerCsvUrl: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return `/api/reports/export/ledger-csv${qs ? `?${qs}` : ''}`;
  },
};

export const notificationApi = {
  getNotifications: async () => {
    try {
      const res = await api.get<{ notifications: INotification[]; unreadCount: number }>('/notifications');
      return res.data || { notifications: [], unreadCount: 0 };
    } catch {
      return { notifications: [], unreadCount: 0 };
    }
  },
  markAsRead: async (id: string) => {
    try {
      const res = await api.put<{ success: boolean }>(`/notifications/${id}/read`);
      return res.data;
    } catch {
      return { success: true };
    }
  },
  markAllAsRead: async () => {
    try {
      const res = await api.put<{ success: boolean; markedCount: number }>('/notifications/mark-all-read');
      return res.data;
    } catch {
      return { success: true, markedCount: 0 };
    }
  },
  clearNotifications: async () => {
    try {
      const res = await api.delete<{ success: boolean }>('/notifications/clear');
      return res.data;
    } catch {
      return { success: true };
    }
  },
};

export default api;
