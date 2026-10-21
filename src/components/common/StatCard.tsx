import React from 'react';

interface StatCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    label: string;
    positive?: boolean;
  };
  highlight?: boolean;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon,
  trend,
  highlight,
  color = 'sky',
}) => {
  const colorMap = {
    indigo: {
      accentGlow: 'hover:border-indigo-300',
      iconBg: 'bg-gradient-to-tr from-indigo-500/10 to-indigo-500/20 text-indigo-600 border border-indigo-200/60',
      barBg: 'bg-indigo-600',
    },
    emerald: {
      accentGlow: 'hover:border-emerald-300',
      iconBg: 'bg-gradient-to-tr from-emerald-500/10 to-emerald-500/20 text-emerald-600 border border-emerald-200/60',
      barBg: 'bg-emerald-600',
    },
    amber: {
      accentGlow: 'hover:border-amber-300',
      iconBg: 'bg-gradient-to-tr from-amber-500/10 to-amber-500/20 text-amber-600 border border-amber-200/60',
      barBg: 'bg-amber-600',
    },
    rose: {
      accentGlow: 'hover:border-rose-300',
      iconBg: 'bg-gradient-to-tr from-rose-500/10 to-rose-500/20 text-rose-600 border border-rose-200/60',
      barBg: 'bg-rose-600',
    },
    sky: {
      accentGlow: 'hover:border-sky-300',
      iconBg: 'bg-gradient-to-tr from-sky-500/10 to-sky-500/20 text-sky-600 border border-sky-200/60',
      barBg: 'bg-sky-600',
    },
    slate: {
      accentGlow: 'hover:border-slate-300',
      iconBg: 'bg-gradient-to-tr from-slate-500/10 to-slate-500/20 text-slate-700 border border-slate-200/60',
      barBg: 'bg-slate-700',
    },
  };

  const scheme = colorMap[color] || colorMap.sky;

  return (
    <div
      id={id}
      className={`relative overflow-hidden bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)] hover:shadow-lg hover:-translate-y-0.5 ${scheme.accentGlow} group ${
        highlight
          ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/15'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 tracking-tight">{title}</p>
        {icon && (
          <div className={`p-2.5 rounded-xl ${scheme.iconBg} transition-transform group-hover:scale-110 shadow-2xs`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums">
          {value}
        </p>
        {trend && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
              trend.positive
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                : 'text-amber-700 bg-amber-50 border border-amber-200/80'
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-400 mt-1.5 flex items-center font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
};
