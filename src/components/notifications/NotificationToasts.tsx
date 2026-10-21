import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { INotification } from '../../types';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownToLine,
  X,
  Bell,
  ArrowRight,
} from 'lucide-react';

export const NotificationToasts: React.FC = () => {
  const navigate = useNavigate();
  const { activeToasts, dismissToast, markAsRead } = useNotifications();

  if (activeToasts.length === 0) return null;

  const handleClickToast = async (notif: INotification) => {
    await markAsRead(notif.id);
    dismissToast(notif.id);
    if (notif.actionLink) {
      navigate(notif.actionLink);
    }
  };

  const getBorderAndBg = (severity: INotification['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-rose-300 bg-rose-50/95 text-rose-950 shadow-rose-500/10';
      case 'warning':
        return 'border-amber-300 bg-amber-50/95 text-amber-950 shadow-amber-500/10';
      case 'success':
        return 'border-emerald-300 bg-emerald-50/95 text-emerald-950 shadow-emerald-500/10';
      default:
        return 'border-sky-300 bg-sky-50/95 text-sky-950 shadow-sky-500/10';
    }
  };

  const getIcon = (type: INotification['type'], severity: INotification['severity']) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'RETURN_PENDING':
        return <RotateCcw className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'RETURN_CONFIRMED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'RETURN_REJECTED':
        return <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'STOCK_ISSUED':
        return <ArrowUpRight className="w-5 h-5 text-sky-600 shrink-0" />;
      case 'STOCK_INWARD':
        return <ArrowDownToLine className="w-5 h-5 text-emerald-600 shrink-0" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-full pointer-events-none">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md flex items-start space-x-3 transition-all transform animate-in slide-in-from-right-8 duration-200 ${getBorderAndBg(
            toast.severity
          )}`}
        >
          {getIcon(toast.type, toast.severity)}

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-md border border-black/5">
                Real-Time Alert
              </span>
              <span className="text-[10px] text-slate-500">Just now</span>
            </div>

            <h4 className="text-xs font-bold font-display leading-tight">{toast.title}</h4>
            <p className="text-[11px] text-slate-700 leading-relaxed">{toast.message}</p>

            {toast.actionLink && (
              <div className="pt-1.5 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => handleClickToast(toast)}
                  className="inline-flex items-center text-xs font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                >
                  <span>Check Now</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition cursor-pointer shrink-0"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
