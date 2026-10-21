import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stockApi } from '../services/api';
import { IItem, IStockTransaction } from '../types';
import { CategoryBadge, TransactionTypeBadge } from '../components/common/Badge';
import { PriceBadge } from '../components/common/PriceBadge';
import {
  Briefcase,
  ClipboardCheck,
  RotateCcw,
  Package,
  Search,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const MyStockPage: React.FC = () => {
  const { user } = useAuth();
  const [heldBalances, setHeldBalances] = useState<Array<{ item: IItem; quantity: number }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<IStockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMyStock = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [stockRes, ledgerRes] = await Promise.all([
        stockApi.getTechnicianBalance(user._id),
        stockApi.getLedger({ technicianId: user._id, limit: 20 }),
      ]);
      setHeldBalances(stockRes.balances);
      setRecentTransactions(ledgerRes);
    } catch (err) {
      console.error('Failed to load technician stock', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStock();
  }, [user]);

  const activeItems = heldBalances.filter((b) => b.quantity > 0);
  const totalUnits = activeItems.reduce((sum, b) => sum + b.quantity, 0);

  const filteredItems = activeItems.filter(
    (b) =>
      b.item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      b.item.itemCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                My Hand Stock (Field Custody)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Spare parts, RO membranes, and filter cartridges currently carried in your vehicle / kit bag
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            id="my-stock-log-usage-btn"
            to="/log-usage"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition shadow-sm shadow-sky-600/25 active:scale-95 cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
            Log Site Usage
          </Link>
          <Link
            id="my-stock-return-btn"
            to="/returns"
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-800 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            Return Stock
          </Link>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Technician In-Charge</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{user?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{user?.phone}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Spare Units Held</p>
          <p className="text-3xl font-extrabold text-sky-700 mt-1 font-mono tabular-nums">{totalUnits} <span className="text-xs font-normal text-slate-500 font-sans">units</span></p>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Across {activeItems.length} distinct SKUs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stock Status</p>
          <div className="flex items-center space-x-1.5 mt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800">
              Synced with Central Ledger
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">All movements recorded immutably</p>
        </div>
      </div>

      {/* Held Stock Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Items Carried in Your Custody</h3>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search carried parts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white font-medium transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Box MRP vs Portal Rate</th>
                <th className="py-3 px-4 text-center">Quantity Carried</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading your inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-semibold text-zinc-700">No stock currently held in your bag.</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Request warehouse manager to issue filters or parts to your account.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(({ item, quantity }) => (
                  <tr key={item._id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900">
                      {item.itemCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900">{item.itemName}</p>
                      {item.compatibleModels && (
                        <p className="text-[11px] text-zinc-400 truncate max-w-xs">
                          {item.compatibleModels}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <CategoryBadge category={item.category} />
                    </td>
                    <td className="py-3.5 px-4">
                      <PriceBadge item={item} variant="pill" showDiff={true} />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
                        {quantity} {item.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to="/log-usage"
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-md transition"
                        >
                          Use on Site
                        </Link>
                        <Link
                          to="/returns"
                          className="px-2.5 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md transition"
                        >
                          Return
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent History for this Technician */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900">Your Recent Field Movements</h3>

        {recentTransactions.length === 0 ? (
          <p className="text-xs text-zinc-400 py-4 text-center">No recent movements recorded.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentTransactions.slice(0, 8).map((tx) => {
              const item = typeof tx.item === 'object' ? tx.item : null;

              return (
                <div
                  key={tx._id}
                  className="py-3 flex items-center justify-between text-xs hover:bg-zinc-50/50 px-2 rounded-lg transition"
                >
                  <div className="flex items-center space-x-3">
                    <TransactionTypeBadge type={tx.transactionType} />
                    <div>
                      <p className="font-semibold text-zinc-900">{item?.itemName || 'Item'}</p>
                      <p className="text-[11px] text-zinc-500">
                        {tx.transactionType === 'USAGE_AT_SITE' && `Installed at: ${tx.siteName}`}
                        {tx.transactionType === 'ISSUE_TO_TECH' && `Received from Warehouse`}
                        {tx.transactionType === 'RETURN_TO_WAREHOUSE' && `Handed back to Warehouse`}
                        {tx.jobReference && ` • Ticket: ${tx.jobReference}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-zinc-900">
                      {tx.quantity} {item?.unit || 'pcs'}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(tx.transactionDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
