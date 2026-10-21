import React from 'react';
import { ItemCategory, TransactionType, ReturnStatus } from '../../types';

export const CategoryBadge: React.FC<{ category: ItemCategory | string }> = ({ category }) => {
  const styles: Record<string, string> = {
    'One Kit': 'bg-purple-50 text-purple-700 border-purple-200',
    GKK1: 'bg-amber-50 text-amber-800 border-amber-200',
    GKK2: 'bg-orange-50 text-orange-800 border-orange-200',
    SF: 'bg-blue-50 text-blue-700 border-blue-200',
    'UV Lamp': 'bg-violet-50 text-violet-700 border-violet-200',
    'Mineral Cartridge': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Spare Part': 'bg-zinc-100 text-zinc-700 border-zinc-200',
    Other: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  };

  const current = styles[category] || 'bg-zinc-100 text-zinc-700 border-zinc-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${current}`}
    >
      {category}
    </span>
  );
};

export const TransactionTypeBadge: React.FC<{ type: TransactionType | string }> = ({ type }) => {
  const configs: Record<string, { label: string; className: string; sign: string }> = {
    PURCHASE_IN: {
      label: 'Purchase In',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      sign: '+',
    },
    ISSUE_TO_TECH: {
      label: 'Issued to Tech',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      sign: '→',
    },
    USAGE_AT_SITE: {
      label: 'Used On-Site',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
      sign: '✓',
    },
    RETURN_TO_WAREHOUSE: {
      label: 'Returned to WH',
      className: 'bg-teal-50 text-teal-700 border-teal-200',
      sign: '↩',
    },
    DAMAGE_WRITEOFF: {
      label: 'Damage Write-off',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      sign: '✕',
    },
    ADJUSTMENT: {
      label: 'Audit Adjustment',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      sign: '±',
    },
  };

  const cfg = configs[type] || {
    label: type,
    className: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    sign: '•',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${cfg.className}`}
    >
      <span className="font-bold mr-1">{cfg.sign}</span>
      {cfg.label}
    </span>
  );
};

export const ReturnStatusBadge: React.FC<{ status: ReturnStatus | string }> = ({ status }) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const current = styles[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${current}`}
    >
      {status}
    </span>
  );
};
