import React from 'react';
import { IItem } from '../../types';
import { Tag, Monitor, TrendingUp, HelpCircle } from 'lucide-react';

interface PriceBadgeProps {
  item?: Partial<IItem>;
  oldPrice?: number;
  newPrice?: number;
  price?: number;
  variant?: 'inline' | 'stacked' | 'detailed' | 'pill';
  showDiff?: boolean;
  className?: string;
}

export const PriceBadge: React.FC<PriceBadgeProps> = ({
  item,
  oldPrice: propOld,
  newPrice: propNew,
  price: propPrice,
  variant = 'inline',
  showDiff = true,
  className = '',
}) => {
  // Resolve effective prices
  const fallback = item?.price ?? propPrice ?? 0;
  const oldVal = propOld !== undefined ? propOld : (item?.oldPrice !== undefined && item.oldPrice > 0 ? item.oldPrice : fallback);
  const newVal = propNew !== undefined ? propNew : (item?.newPrice !== undefined && item.newPrice > 0 ? item.newPrice : fallback);

  const diff = newVal - oldVal;
  const percentDiff = oldVal > 0 ? Math.round((diff / oldVal) * 100) : 0;

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        {/* Box MRP (Tech Customer Charge) */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
          title="Box Printed MRP: Rate charged to customer by field technician"
        >
          <Tag className="w-2.5 h-2.5 mr-1 text-emerald-600" />
          <span className="text-[9px] uppercase font-bold text-emerald-600 mr-1">Box MRP:</span>
          ₹{newVal.toLocaleString('en-IN')}
        </span>

        {/* Portal Price (AO Smith System) */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-300"
          title="AO Smith / Company Portal Price: System entry rate recorded on company portal"
        >
          <Monitor className="w-2.5 h-2.5 mr-1 text-slate-500" />
          <span className="text-[9px] uppercase font-medium text-slate-500 mr-1">Portal:</span>
          ₹{oldVal.toLocaleString('en-IN')}
        </span>

        {showDiff && diff !== 0 && (
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
              diff > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
            title="Difference between Box MRP and Portal Price"
          >
            {diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col space-y-1 ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center">
            <Tag className="w-3 h-3 mr-1 text-emerald-600" />
            Box MRP (Tech Charge):
          </span>
          <span className="text-xs font-extrabold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            ₹{newVal.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-medium text-slate-500 flex items-center">
            <Monitor className="w-3 h-3 mr-1 text-slate-400" />
            AO Smith Portal (Old):
          </span>
          <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ₹{oldVal.toLocaleString('en-IN')}
          </span>
        </div>

        {showDiff && diff !== 0 && (
          <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-100">
            <span className="text-slate-400 font-medium">Difference:</span>
            <span
              className={`font-mono font-bold ${
                diff > 0 ? 'text-amber-700' : 'text-rose-600'
              }`}
            >
              {diff > 0 ? `+₹${diff.toLocaleString('en-IN')} (+${percentDiff}%)` : `-₹${Math.abs(diff).toLocaleString('en-IN')}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`p-3 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center">
            <Tag className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Dual Pricing Guide (Portal vs Box MRP)
          </span>
          {diff !== 0 && (
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              {diff > 0 ? `Diff: +₹${diff} (+${percentDiff}%)` : `Diff: -₹${Math.abs(diff)}`}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Customer Charge Price */}
          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200/80">
            <span className="block text-[10px] uppercase font-bold text-emerald-800 flex items-center">
              🏷️ Box Printing MRP
            </span>
            <span className="block text-base font-extrabold font-mono text-emerald-900 mt-0.5">
              ₹{newVal.toLocaleString('en-IN')}
            </span>
            <span className="block text-[10px] text-emerald-700 font-medium mt-0.5">
              Collected from customer on site
            </span>
          </div>

          {/* System Portal Price */}
          <div className="p-2 bg-slate-100 rounded-lg border border-slate-200">
            <span className="block text-[10px] uppercase font-bold text-slate-700 flex items-center">
              💻 AO Smith Portal
            </span>
            <span className="block text-base font-bold font-mono text-slate-800 mt-0.5">
              ₹{oldVal.toLocaleString('en-IN')}
            </span>
            <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
              System portal booking rate
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default Inline Variant
  return (
    <div className={`inline-flex items-center space-x-2 text-xs flex-wrap ${className}`}>
      {/* Box MRP */}
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300"
        title="Box Printed MRP (Technician charges this amount to customer)"
      >
        <Tag className="w-3 h-3 mr-1 text-emerald-600" />
        <span className="text-[10px] uppercase font-bold text-emerald-700 mr-1">Box MRP:</span>
        ₹{newVal.toLocaleString('en-IN')}
      </span>

      {/* Portal Price */}
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300"
        title="AO Smith / Company Portal Price (Portal recorded rate)"
      >
        <Monitor className="w-3 h-3 mr-1 text-slate-500" />
        <span className="text-[10px] uppercase font-medium text-slate-500 mr-1">Portal:</span>
        ₹{oldVal.toLocaleString('en-IN')}
      </span>

      {showDiff && diff !== 0 && (
        <span
          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            diff > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          title="Price difference between Box MRP and Portal"
        >
          {diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
        </span>
      )}
    </div>
  );
};
