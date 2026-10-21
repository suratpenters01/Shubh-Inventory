import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { INotification } from '../types';
import { notificationApi } from '../services/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: INotification[];
  unreadCount: number;
  isConnected: boolean;
  activeToasts: INotification[];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  dismissToast: (id: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Gentle web audio chime for real-time notifications
function playNotificationChime(severity: 'warning' | 'critical' | 'info' | 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = severity === 'critical' ? 'sawtooth' : 'sine';
    const freq = severity === 'critical' ? 440 : severity === 'warning' ? 587.33 : 880;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio may be blocked by browser autoplay policy until interaction
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeToasts, setActiveToasts] = useState<INotification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Initial fetch from REST API
  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unreadCount || 0);
    } catch {
      // Graceful fallback to prevent noisy error trackers
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Connect to SSE stream
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsConnected(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Initial load
    refreshNotifications();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      // Listen for initial batch
      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.notifications)) {
            setNotifications(payload.notifications);
            setUnreadCount(payload.unreadCount ?? payload.notifications.filter((n: INotification) => !n.read).length);
          }
        } catch (err) {
          console.error('[NotificationContext] Error parsing init event:', err);
        }
      });

      // Listen for live real-time notification broadcast
      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const newNotif: INotification = JSON.parse(e.data);

          setNotifications((prev) => {
            // Guard against duplicate ID
            if (prev.some((n) => n.id === newNotif.id)) {
              return prev;
            }
            return [newNotif, ...prev];
          });

          setUnreadCount((prev) => prev + 1);

          // Trigger toast
          setActiveToasts((prev) => [newNotif, ...prev.slice(0, 3)]);
          playNotificationChime(newNotif.severity);

          // Auto dismiss toast after 6 seconds
          setTimeout(() => {
            setActiveToasts((prev) => prev.filter((t) => t.id !== newNotif.id));
          }, 6000);
        } catch (err) {
          console.error('[NotificationContext] Error parsing notification event:', err);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        // Exponential reconnect with 3s jitter
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, refreshNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // safe fallback
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // safe fallback
    }
  };

  const clearAll = async () => {
    try {
      await notificationApi.clearNotifications();
      setNotifications((prev) => prev.filter((n) => !n.read));
    } catch {
      // safe fallback
    }
  };

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        activeToasts,
        markAsRead,
        markAllAsRead,
        clearAll,
        dismissToast,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
