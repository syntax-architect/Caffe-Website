import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { NotificationProvider } from '../../context/NotificationContext';
import { DashboardLayout } from '../dashboard/DashboardLayout';
import { DashboardOverview } from '../dashboard/DashboardOverview';
import { OrdersManagement } from '../dashboard/OrdersManagement';
import { ReservationsManagement } from '../dashboard/ReservationsManagement';
import { TablesManagement } from '../dashboard/TablesManagement';
import { MenuManagement } from '../dashboard/MenuManagement';
import { ContentManagement } from '../dashboard/ContentManagement';
import { StaffManagement } from '../dashboard/StaffManagement';
import { SettingsManagement } from '../dashboard/SettingsManagement';

// Route-level code-splitting for Kitchen Display System
const KitchenDisplayApp = lazy(() =>
  import('../kitchen/KitchenDisplayApp').then((m) => ({ default: m.KitchenDisplayApp }))
);

export const StaffApp: React.FC = () => {
  const { isOwner, isManager } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.replace(/\/$/, '');
      return p === '/staff' ? '/staff/dashboard' : p;
    }
    return '/staff/dashboard';
  });

  // Listen to popstate for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/\/$/, '');
      setCurrentPath(p === '/staff' ? '/staff/dashboard' : p);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Metadata for layout header
  const routeMeta: Record<string, { title: string; subtitle: string }> = {
    '/staff/dashboard': {
      title: 'Hospitality Overview',
      subtitle: 'Live floor monitoring, order intake, and dining bookings',
    },
    '/staff/orders': {
      title: 'Order Management',
      subtitle: 'Operational dispatch, status tracking, and kitchen ticket details',
    },
    '/staff/reservations': {
      title: 'Table Bookings',
      subtitle: 'Guest reservation roster, schedule, and party arrangements',
    },
    '/staff/tables': {
      title: 'Dining Tables & QR Codes',
      subtitle: 'Floor capacity, table layout, and printable QR ordering cards',
    },
    '/staff/menu': {
      title: 'Menu Catalog',
      subtitle: 'Food & beverage items, operational sold-out controls, and pricing',
    },
    '/staff/content': {
      title: 'Website Content',
      subtitle: 'Customer-facing homepage headlines, stories, and ambiance photography',
    },
    '/staff/staff': {
      title: 'Staff Roster',
      subtitle: 'Terminal account access and operational role assignments',
    },
    '/staff/settings': {
      title: 'Operations Settings',
      subtitle: 'Restaurant parameters, hotline numbers, and service toggles',
    },
  };

  const meta = routeMeta[currentPath] || {
    title: 'Restaurant Operations',
    subtitle: 'Management terminal',
  };

  const renderContent = () => {
    switch (currentPath) {
      case '/staff/orders':
        return <OrdersManagement />;
      case '/staff/reservations':
        return <ReservationsManagement />;
      case '/staff/tables':
        return <TablesManagement />;
      case '/staff/menu':
        return <MenuManagement />;
      case '/staff/content':
        return <ContentManagement />;
      case '/staff/staff':
        if (!isOwner && !isManager) {
          return (
            <div className="py-16 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-3xl mb-2 text-amber-400 block">lock</span>
              <p className="font-semibold text-sm text-on-surface">Staff Roster Restricted</p>
              <p className="mt-1">Only restaurant owners and managers have access to the staff roster.</p>
            </div>
          );
        }
        return <StaffManagement />;
      case '/staff/settings':
        if (!isOwner) {
          return (
            <div className="py-16 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-3xl mb-2 text-amber-400 block">lock</span>
              <p className="font-semibold text-sm text-on-surface">Operations Settings Restricted</p>
              <p className="mt-1">Only the restaurant proprietor (Owner) can update core restaurant settings.</p>
            </div>
          );
        }
        return <SettingsManagement />;
      case '/staff/dashboard':
      default:
        return <DashboardOverview onNavigate={handleNavigate} />;
    }
  };

  // Dedicated Kitchen Display System (Standalone Fullscreen Operations Console)
  if (currentPath === '/staff/kitchen') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0d0805] text-[#D4AF37] flex flex-col items-center justify-center font-mono select-none">
            <div className="w-12 h-12 rounded-2xl bg-[#1e1510] border border-[#D4AF37]/30 flex items-center justify-center text-xl mb-3 shadow-lg">
              ⚡
            </div>
            <span className="text-xs uppercase tracking-widest font-bold">
              Loading Kitchen Display System...
            </span>
          </div>
        }
      >
        <KitchenDisplayApp onExit={() => handleNavigate('/staff/dashboard')} />
      </Suspense>
    );
  }

  return (
    <NotificationProvider>
      <DashboardLayout
        currentPath={currentPath}
        onNavigate={handleNavigate}
        title={meta.title}
        subtitle={meta.subtitle}
      >
        {renderContent()}
      </DashboardLayout>
    </NotificationProvider>
  );
};

export default StaffApp;
