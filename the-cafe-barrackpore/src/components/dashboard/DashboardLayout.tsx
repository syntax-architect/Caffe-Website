import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStaffSessionTimeout } from '../../hooks/useStaffSessionTimeout';
import { useNotification } from '../../hooks/useNotification';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { formatRestaurantDateTime } from '../../utils/datetime';

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
  const { staffProfile, role, signOut, signOutEverywhere, isOwner, isManager } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  const { restaurantConfig, logoUrl } = useSiteConfig();

  // Enforce automatic 30-minute inactivity logout on staff screens
  useStaffSessionTimeout();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Live digital clock in restaurant timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        formatRestaurantDateTime(now, restaurantConfig.timezone, restaurantConfig.locale)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [restaurantConfig.timezone, restaurantConfig.locale]);

  const navItems = [
    { label: 'Overview', path: '/staff/dashboard', icon: 'dashboard', access: true },
    { label: 'Kitchen KDS', path: '/staff/kitchen', icon: 'soup_kitchen', access: true, badge: 'Live' },
    { label: 'Orders', path: '/staff/orders', icon: 'receipt_long', access: true },
    { label: 'Reservations', path: '/staff/reservations', icon: 'event_seat', access: true },
    { label: 'Tables & QR', path: '/staff/tables', icon: 'qr_code_2', access: true },
    { label: 'Menu Availability', path: '/staff/menu', icon: 'menu_book', access: true },
    { label: 'Website Content', path: '/staff/content', icon: 'auto_stories', access: true },
    { label: 'Customers', path: '/staff/customers', icon: 'contact_page', access: isOwner || isManager },
    { label: 'Discounts & Happy Hour', path: '/staff/discounts', icon: 'local_offer', access: isOwner || isManager },
    { label: 'Staff Roster', path: '/staff/staff', icon: 'group', access: isOwner || isManager },
    { label: 'Security Audit', path: '/staff/audit', icon: 'shield', access: isOwner || isManager },
    { label: 'Settings', path: '/staff/settings', icon: 'tune', access: isOwner },
  ].filter((item) => item.access);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/staff/login';
  };

  const handleSignOutEverywhere = async () => {
    if (window.confirm('Revoke all sessions and sign out across every browser and device?')) {
      await signOutEverywhere();
      window.location.href = '/staff/login';
    }
  };

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  const roleBadgeStyles = {
    owner: 'bg-[#D4AF37]/15 text-[#F3C766] border-[#D4AF37]/30',
    manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    staff: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
  }[role || 'staff'];

  return (
    <div className="min-h-screen bg-[#080706] text-[#F3EFEA] flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37]/30 selection:text-[#FFF7E6]">
      {/* Mobile / Tablet Top Header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#110E0C]/90 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-200 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center p-1">
              <img src={logoUrl || "/logo.webp"} alt="Logo" className="w-full h-full object-contain filter invert" />
            </div>
            <span className="font-serif text-sm font-bold tracking-wider text-[#D4AF37] uppercase">
              The Café
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-200 transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
            )}
          </button>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeStyles}`}>
            {role || 'staff'}
          </span>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop & Mobile Slide-over) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-68 bg-[#110E0C]/98 lg:bg-[#0D0B0A] border-r border-white/[0.08] flex flex-col justify-between transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl' : '-translate-x-full'
        } lg:static lg:h-screen lg:shrink-0`}
      >
        {/* Brand Header with Double-Bezel Logo Plate */}
        <div className="p-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <div className="w-10 h-10 rounded-[calc(1rem-0.25rem)] bg-gradient-to-br from-[#1C1713] to-[#0A0807] border border-[#D4AF37]/35 flex items-center justify-center p-2 shadow-inner">
                <img
                  src={logoUrl || "/logo.webp"}
                  alt="The Café Barrackpore"
                  className="w-full h-full object-contain filter invert contrast-125"
                />
              </div>
            </div>
            <div>
              <p className="font-serif text-sm font-bold tracking-[0.14em] uppercase text-white leading-tight">
                The Café
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider">
                  Terminal Online
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== '/staff/dashboard' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`w-full group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 text-left cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#120B08] shadow-[0_4px_16px_rgba(212,175,55,0.25)] font-bold'
                    : 'text-stone-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-lg shrink-0 transition-transform ${
                    isActive ? 'text-[#120B08]' : 'text-stone-400 group-hover:text-[#D4AF37]'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
                      isActive
                        ? 'bg-black/20 text-[#120B08] font-bold'
                        : 'bg-[#D4AF37]/20 text-[#F3C766] border border-[#D4AF37]/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#120B08] shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Staff Card & Sign Out */}
        <div className="p-4 border-t border-white/[0.07] bg-[#0A0807]/60">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#F3C766] font-bold text-xs uppercase shadow-inner">
              {staffProfile?.full_name ? staffProfile.full_name.charAt(0) : 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-red-950/40 hover:text-red-300 hover:border-red-500/40 border border-white/[0.08] text-[11px] font-semibold text-stone-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
            <button
              type="button"
              onClick={handleSignOutEverywhere}
              title="Sign Out Everywhere (Revoke All Active Sessions)"
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-red-950/40 hover:text-red-300 hover:border-red-500/40 border border-white/[0.08] text-stone-400 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-base">lock_reset</span>
            </button>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Public Website in New Window"
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-stone-400 hover:text-[#D4AF37] transition-colors shrink-0"
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
          className="fixed inset-0 z-30 bg-black/80 backdrop-blur-md lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-[#0A0807]/80 backdrop-blur-xl border-b border-white/[0.07] sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-400 mb-0.5">
              <span>Operations Terminal</span>
              <span>/</span>
              <span className="text-[#D4AF37] font-semibold">{title}</span>
            </div>
            <h1 className="text-xl font-serif font-bold text-white tracking-wide">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-stone-300 font-mono">
              <span className="material-symbols-outlined text-sm text-[#D4AF37]">schedule</span>
              <span>{currentTime || 'Syncing clock...'}</span>
            </div>

            {/* Database & Service Status Indicator */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-stone-300">
                {isSupabaseConfigured ? 'Live Database' : 'Demo Mode'}
              </span>
            </div>

            {/* Notification Center Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-stone-200 hover:text-[#D4AF37] transition-colors"
                aria-label="View notifications"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#D4AF37] text-[#120B08] rounded-full min-w-[18px] text-center shadow">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-88 bg-[#14100D] border border-white/[0.1] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 z-50 backdrop-blur-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D4AF37] text-base">notifications</span>
                      <p className="text-xs font-bold uppercase tracking-wider text-white">Notifications</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[10px] text-[#D4AF37] hover:underline"
                      >
                        Mark all read
                      </button>
                      <span className="text-stone-600">•</span>
                      <button
                        type="button"
                        onClick={clearNotifications}
                        className="text-[10px] text-stone-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto py-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8">
                        <span className="material-symbols-outlined text-2xl text-stone-600 mb-1">done_all</span>
                        <p className="text-xs text-stone-400">All notifications caught up</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-3 rounded-xl text-xs transition-colors cursor-pointer ${
                            n.read
                              ? 'bg-white/[0.02] text-stone-400 hover:bg-white/[0.05]'
                              : 'bg-white/[0.06] text-white border border-[#D4AF37]/30 hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11px] text-[#F3C766]">{n.title}</span>
                            <span className="text-[10px] text-stone-500 font-mono">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] mt-1 text-stone-300 leading-normal">{n.message}</p>
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile Sticky Quick-Dock for easy thumb navigation */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0E0C0A]/95 backdrop-blur-xl border-t border-white/[0.08] px-3 py-2 z-20 flex items-center justify-around">
          <button
            type="button"
            onClick={() => onNavigate('/staff/dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors ${
              currentPath === '/staff/dashboard' ? 'text-[#D4AF37]' : 'text-stone-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/staff/kitchen')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors ${
              currentPath.startsWith('/staff/kitchen') ? 'text-[#D4AF37]' : 'text-stone-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">soup_kitchen</span>
            <span>KDS</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/staff/orders')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors ${
              currentPath.startsWith('/staff/orders') ? 'text-[#D4AF37]' : 'text-stone-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">receipt_long</span>
            <span>Orders</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/staff/reservations')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors ${
              currentPath.startsWith('/staff/reservations') ? 'text-[#D4AF37]' : 'text-stone-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">event_seat</span>
            <span>Tables</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
