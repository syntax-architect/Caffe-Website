import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { DashboardNotification } from '../types/dashboard';

interface NotificationContextType {
  notifications: DashboardNotification[];
  unreadCount: number;
  addNotification: (type: 'success' | 'warning' | 'info' | 'error', title: string, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([
    {
      id: 'initial-welcome',
      type: 'info',
      title: 'Terminal Ready',
      message: 'Dashboard initialized for The Café Barrackpore.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
    },
  ]);

  const [toasts, setToasts] = useState<DashboardNotification[]>([]);
  const toastTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Clear all pending toast timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const addNotification = useCallback(
    (type: 'success' | 'warning' | 'info' | 'error', title: string, message: string) => {
      const newNotif: DashboardNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type,
        title,
        message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]); // keep max 50
      setToasts((prev) => [...prev, newNotif]);

      // Auto dismiss toast after 4.5 seconds
      const timerId = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newNotif.id));
        toastTimersRef.current.delete(timerId);
      }, 4500);
      toastTimersRef.current.add(timerId);
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}

      {/* Floating Operational Toasts */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => {
          const typeStyles = {
            success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100',
            warning: 'bg-amber-950/90 border-amber-500/40 text-amber-100',
            error: 'bg-red-950/90 border-red-500/40 text-red-100',
            info: 'bg-stone-900/90 border-primary/40 text-stone-100',
          }[toast.type];

          const icon = {
            success: 'check_circle',
            warning: 'warning',
            error: 'error',
            info: 'info',
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`p-3.5 rounded-2xl border backdrop-blur-md shadow-2xl flex items-start gap-3 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${typeStyles}`}
            >
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
                {icon}
              </span>
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold">{toast.title}</p>
                <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="opacity-60 hover:opacity-100 text-xs shrink-0"
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
