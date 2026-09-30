import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { isSupabaseConfigured } from '../../lib/supabase';

export interface DashboardLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
  title,
  subtitle,
}) => {
  const { staffProfile, role, signOut, isOwner, isManager } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Live digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: 'Overview', path: '/staff/dashboard', icon: 'dashboard', access: true },
    { label: 'Kitchen KDS', path: '/staff/kitchen', icon: 'soup_kitchen', access: true },
    { label: 'Orders', path: '/staff/orders', icon: 'receipt_long', access: true },
    { label: 'Reservations', path: '/staff/reservations', icon: 'event_seat', access: true },
    { label: 'Tables & QR', path: '/staff/tables', icon: 'qr_code_2', access: true },
    { label: 'Menu', path: '/staff/menu', icon: 'menu_book', access: true },
    { label: 'Website Content', path: '/staff/content', icon: 'auto_stories', access: true },
    { label: 'Staff Roster', path: '/staff/staff', icon: 'group', access: isOwner || isManager },
    { label: 'Settings', path: '/staff/settings', icon: 'tune', access: isOwner },
  ].filter((item) => item.access);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/staff/login';
  };

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  const roleBadgeStyles = {
    owner: 'bg-primary/15 text-primary border-primary/30',
    manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    staff: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
  }[role || 'staff'];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col lg:flex-row font-body-md selection:bg-primary-container selection:text-on-primary-container">
      {/* Mobile / Tablet Top Header */}
      <header className="lg:hidden flex items-center justify-between p-4 bg-surface-container border-b border-outline-variant/40 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:text-primary transition-colors"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Logo" className="w-7 h-7 object-contain filter invert" />
            <span className="font-serif text-sm font-bold tracking-wider text-primary uppercase">
              The Café
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl bg-surface-container-high text-on-surface hover:text-primary transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            )}
          </button>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeStyles}`}>
            {role || 'staff'}
          </span>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-container/95 lg:bg-surface-container border-r border-outline-variant/40 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl backdrop-blur-md' : '-translate-x-full'
        } lg:static lg:h-screen lg:shrink-0`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-2 shadow-inner">
              <img src="/logo.webp" alt="The Café Barrackpore" className="w-full h-full object-contain filter invert" />
            </div>
            <div>
              <p className="font-serif text-sm font-bold tracking-[0.16em] uppercase text-primary leading-tight">
                The Café
              </p>
              <p className="text-[10px] text-outline uppercase tracking-wider">
                Management Terminal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.path || (item.path !== '/staff/dashboard' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-xs font-semibold tracking-wide transition-all text-left ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/15'
                    : 'text-on-surface/80 hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-on-primary ml-auto shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Staff Card & Sign Out */}
        <div className="p-4 border-t border-outline-variant/30 bg-surface-container-high/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs uppercase">
              {staffProfile?.full_name ? staffProfile.full_name.charAt(0) : 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-surface truncate leading-tight">
                {staffProfile?.full_name || 'Staff Member'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${roleBadgeStyles}`}>
                  {role || 'staff'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-semibold text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Public Website in New Tab"
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-outline hover:text-primary transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-surface-container/60 backdrop-blur border-b border-outline-variant/30 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-outline mb-0.5">
              <span>Terminal</span>
              <span>/</span>
              <span className="text-primary font-semibold">{title}</span>
            </div>
            <h1 className="text-xl font-serif font-bold text-on-surface tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-outline mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/40 text-xs text-outline font-medium">
              <span className="material-symbols-outlined text-sm text-primary">schedule</span>
              <span>{currentTime || 'Synchronizing...'}</span>
            </div>

            {/* Database & Service Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/40 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-outline">
                {isSupabaseConfigured ? 'Live Service' : 'Demo Mode'}
              </span>
            </div>

            {/* Notification Center Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-on-surface hover:text-primary transition-colors"
                aria-label="View notifications"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary text-on-primary rounded-full min-w-[18px] text-center shadow">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-container-high border border-outline-variant/60 rounded-2xl shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface">Notifications</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={clearNotifications}
                        className="text-[10px] text-outline hover:text-on-surface"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto py-2 space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-outline text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                            n.read ? 'bg-surface-container/50 text-outline' : 'bg-surface-container text-on-surface border border-primary/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11px] text-primary">{n.title}</span>
                            <span className="text-[10px] text-outline">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] mt-0.5 opacity-90 leading-tight">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
