import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { INotification } from '../../types';
import {
  Bell,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownToLine,
  Check,
  Trash2,
  Wifi,
  WifiOff,
  ExternalLink,
} from 'lucide-react';

function formatRelativeTime(dateString: string): string {
  try {
    const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

function getNotificationIcon(type: INotification['type'], severity: INotification['severity']) {
  switch (type) {
    case 'LOW_STOCK':
      return (
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            severity === 'critical'
              ? 'bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-amber-100 text-amber-700 border border-amber-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    case 'RETURN_PENDING':
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
          <RotateCcw className="w-4 h-4" />
        </div>
      );
    case 'RETURN_CONFIRMED':
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    case 'RETURN_REJECTED':
      return (
        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
          <XCircle className="w-4 h-4" />
        </div>
      );
    case 'STOCK_ISSUED':
      return (
        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      );
    case 'STOCK_INWARD':
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
          <ArrowDownToLine className="w-4 h-4" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </div>
      );
  }
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearAll } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayedNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = async (notif: INotification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    if (notif.actionLink) {
      setIsOpen(false);
      navigate(notif.actionLink);
    }
  };

  return (
    <div className="relative shrink-0" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        id="navbar-notification-bell"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition cursor-pointer ${
          isOpen
            ? 'bg-sky-50 text-sky-700 border-sky-200 shadow-2xs'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent'
        }`}
        title={`Notifications (${unreadCount} unread)`}
        aria-label="Open notifications menu"
      >
        <Bell className="w-4 h-4" />

        {/* Live SSE Pulse Ping */}
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-2xs ring-2 ring-white animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : isConnected ? (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"
            title="Real-Time Live Connected"
          />
        ) : null}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-2xl z-50 overflow-hidden transform animate-in fade-in-0 zoom-in-95 origin-top-right">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-display font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {/* Connection Indicator */}
            <div className="flex items-center space-x-1 text-[10px] font-medium">
              {isConnected ? (
                <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Live SSE
                </span>
              ) : (
                <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-bold">
                  <WifiOff className="w-2.5 h-2.5 mr-1 text-amber-600" />
                  Reconnecting
                </span>
              )}
            </div>
          </div>

          {/* Subbar: Filters & Mark all read */}
          <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-xs bg-white">
            <div className="flex items-center space-x-1 bg-slate-100/80 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  filter === 'unread'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="flex items-center space-x-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] text-sky-700 hover:text-sky-900 font-bold hover:underline flex items-center cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <Check className="w-3 h-3 mr-0.5" />
                  Mark read
                </button>
              )}
              {notifications.some((n) => n.read) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Clear read alerts"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications Scroll List */}
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-slate-700">No {filter === 'unread' ? 'unread ' : ''}alerts right now</p>
                <p className="text-[11px] text-slate-400">
                  Stock levels and technician returns are running smoothly.
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start space-x-3 transition cursor-pointer ${
                    notif.read ? 'hover:bg-slate-50/80 bg-white' : 'bg-sky-50/40 hover:bg-sky-50/70'
                  }`}
                >
                  {getNotificationIcon(notif.type, notif.severity)}

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          notif.read ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.actionLink && (
                      <div className="pt-1 flex items-center text-[10px] font-bold text-sky-700 hover:text-sky-900">
                        <span>View Details</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-1" />
                      </div>
                    )}
                  </div>

                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
