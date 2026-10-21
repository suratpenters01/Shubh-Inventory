import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stockApi } from '../services/api';
import { IUser, IItem } from '../types';
import { CategoryBadge } from '../components/common/Badge';
import { PriceBadge } from '../components/common/PriceBadge';
import { Grid3X3, Users, User, ArrowUpRight, Search, CheckCircle2 } from 'lucide-react';

export const TechnicianStockMatrixPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTechFilter = searchParams.get('techId') || 'ALL';

  const [matrixData, setMatrixData] = useState<{
    technicians: IUser[];
    items: IItem[];
    matrix: Array<{
      item: IItem;
      warehouseQty: number;
      techBalances: Record<string, number>;
      totalHeldByTechs: number;
    }>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMatrix = async () => {
    try {
      setIsLoading(true);
      const res = await stockApi.getTechnicianBalanceMatrix();
      setMatrixData(res);
    } catch (err) {
      console.error('Failed to load technician matrix', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const technicians = matrixData?.technicians || [];
  const matrix = matrixData?.matrix || [];

  const filteredMatrix = matrix.filter((row) => {
    const matchesSearch =
      row.item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      row.item.itemCode.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTechFilter !== 'ALL') {
      return (row.techBalances[activeTechFilter] ?? 0) > 0;
    }
    return true;
  });

  const selectedTechObj = technicians.find((t) => t._id === activeTechFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <Grid3X3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                Technician Stock Matrix
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Live cross-tabulation of spare parts &amp; filters held across all field personnel
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 font-medium">
          Field Custody Sum: <span className="font-bold font-mono text-slate-900 ml-1">
            {matrix.reduce((sum, r) => sum + r.totalHeldByTechs, 0)} units
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search items in matrix..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white font-medium transition"
          />
        </div>

        {/* Technician Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSearchParams({})}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTechFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90'
            }`}
          >
            All Technicians ({technicians.length})
          </button>
          {technicians.map((t) => (
            <button
              key={t._id}
              onClick={() => setSearchParams({ techId: t._id })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTechFilter === t._id
                  ? 'bg-sky-600 text-white shadow-xs shadow-sky-600/25'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {activeTechFilter !== 'ALL' && selectedTechObj && (
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs">
          <span className="text-sky-900 font-medium">
            Filtering stock currently carried by: <strong className="font-bold text-sky-950">{selectedTechObj.name}</strong> ({selectedTechObj.phone})
          </span>
          <button
            onClick={() => setSearchParams({})}
            className="text-sky-700 hover:text-sky-900 underline font-bold cursor-pointer"
          >
            Reset to All Technicians
          </button>
        </div>
      )}

      {/* Cross-Tab Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10">Item Code &amp; Name</th>
                <th className="py-3 px-3 text-center bg-slate-100/80 border-r border-slate-200">
                  WH Stock
                </th>

                {/* Technician Columns */}
                {technicians.map((tech) => (
                  <th
                    key={tech._id}
                    className={`py-3 px-3 text-center transition ${
                      activeTechFilter === tech._id
                        ? 'bg-sky-100 text-sky-950 font-bold'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-zinc-800">{tech.name}</span>
                      <span className="text-[10px] text-zinc-400 font-normal lowercase">
                        {tech.phone.slice(-4)}
                      </span>
                    </div>
                  </th>
                ))}

                <th className="py-3 px-4 text-center font-bold text-zinc-900 bg-zinc-100/70 border-l border-zinc-200">
                  Total in Field
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={technicians.length + 3} className="py-12 text-center text-zinc-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Building technician inventory matrix...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={technicians.length + 3} className="py-8 text-center text-zinc-400">
                    No items found matching the selected technician or search filter.
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((row) => (
                  <tr key={row.item._id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3.5 px-4 sticky left-0 bg-white z-10 border-r border-zinc-100">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-semibold text-zinc-900">{row.item.itemCode}</span>
                        <CategoryBadge category={row.item.category} />
                      </div>
                      <p className="font-medium text-zinc-800 text-[11px] mt-0.5">{row.item.itemName}</p>
                      <div className="mt-1">
                        <PriceBadge item={row.item} variant="pill" showDiff={true} />
                      </div>
                    </td>

                    {/* Warehouse stock cell */}
                    <td className="py-3.5 px-3 text-center bg-zinc-50/50 font-semibold text-zinc-700 border-r border-zinc-200">
                      {row.warehouseQty} <span className="text-[10px] text-zinc-400 font-normal">{row.item.unit}</span>
                    </td>

                    {/* Per-technician cells */}
                    {technicians.map((tech) => {
                      const qty = row.techBalances[tech._id] ?? 0;
                      const hasStock = qty > 0;

                      return (
                        <td
                          key={tech._id}
                          className={`py-3.5 px-3 text-center transition ${
                            activeTechFilter === tech._id ? 'bg-blue-50/50 font-bold' : ''
                          }`}
                        >
                          {hasStock ? (
                            <span className="inline-flex items-center justify-center font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60 shadow-2xs">
                              {qty}
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-mono text-xs">—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total in Field */}
                    <td className="py-3.5 px-4 text-center font-bold text-zinc-900 bg-zinc-50/50 border-l border-zinc-200">
                      <span className="text-xs text-purple-700 font-bold">
                        {row.totalHeldByTechs}
                      </span>{' '}
                      <span className="text-[10px] text-zinc-400 font-normal">{row.item.unit}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
