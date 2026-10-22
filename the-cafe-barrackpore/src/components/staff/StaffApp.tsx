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
import { CustomersManagement } from '../dashboard/CustomersManagement';
import { DiscountsManagement } from '../dashboard/DiscountsManagement';
import { AuditLogManagement } from '../dashboard/AuditLogManagement';
import { POSManagement } from '../dashboard/POSManagement';
import { CashDrawerManagement } from '../dashboard/CashDrawerManagement';
import { useSiteConfig } from '../../context/SiteConfigContext';

// Route-level code-splitting for Kitchen Display System
const KitchenDisplayApp = lazy(() =>
  import('../kitchen/KitchenDisplayApp').then((m) => ({ default: m.KitchenDisplayApp }))
);

const FeatureDisabledCard: React.FC<{ feature: string; description: string }> = ({ feature, description }) => (
  <div className="py-20 text-center text-xs text-outline max-w-md mx-auto">
    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
      <span className="material-symbols-outlined text-2xl">power_off</span>
    </div>
    <p className="font-semibold text-base text-on-surface">{feature} is Disabled</p>
    <p className="mt-1 text-zinc-400 leading-relaxed">{description}</p>
    <p className="mt-3 text-[11px] font-mono text-zinc-500">The restaurant owner can re-enable this capability in Settings &gt; Features.</p>
  </div>
);

export const StaffApp: React.FC = () => {
  const { isOwner, isManager } = useAuth();
  const { features } = useSiteConfig();

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
    '/staff/pos': {
      title: 'Staff POS Terminal',
      subtitle: 'Counter billing, running table bills, table operations, and KOT dispatch',
    },
    '/staff/drawer': {
      title: 'Cash Drawer & Shifts',
      subtitle: 'Opening floats, cash in/out reason logs, shift closure balancing, and Z-reports',
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
    '/staff/customers': {
      title: 'Customer Directory',
      subtitle: 'Guest profiles, ordering frequency, and opt-in marketing consent',
    },
    '/staff/discounts': {
      title: 'Discounts & Happy Hours',
      subtitle: 'Promotional coupon codes and scheduled happy-hour price discounts',
    },
    '/staff/staff': {
      title: 'Staff Roster',
      subtitle: 'Terminal account access and operational role assignments',
    },
    '/staff/audit': {
      title: 'Security Audit Log',
      subtitle: 'Immutable record of staff logins, price updates, refunds, and permission changes',
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
      case '/staff/pos':
        if (features?.pos === false) {
          return (
            <FeatureDisabledCard
              feature="POS Counter Billing"
              description="POS terminal billing is disabled in restaurant feature toggles."
            />
          );
        }
        return <POSManagement />;
      case '/staff/drawer':
        if (features?.pos === false || features?.cash_drawer === false) {
          return (
            <FeatureDisabledCard
              feature="Cash Drawer & Shifts"
              description="Cash drawer & shift tracking is disabled in restaurant feature toggles (requires POS)."
            />
          );
        }
        return <CashDrawerManagement />;
      case '/staff/orders':
        return <OrdersManagement />;
      case '/staff/reservations':
        if (features?.reservations === false) {
          return (
            <FeatureDisabledCard
              feature="Table Reservations"
              description="Reservation booking management is disabled in restaurant feature toggles."
            />
          );
        }
        return <ReservationsManagement />;
      case '/staff/tables':
        if (features?.qr_table_ordering === false) {
          return (
            <FeatureDisabledCard
              feature="Dining Tables & QR Codes"
              description="QR Table Ordering is disabled in restaurant feature toggles."
            />
          );
        }
        return <TablesManagement />;
      case '/staff/menu':
        return <MenuManagement />;
      case '/staff/content':
        return <ContentManagement />;
      case '/staff/customers':
        if (!isOwner && !isManager) {
          return (
            <div className="py-16 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-3xl mb-2 text-amber-400 block">lock</span>
              <p className="font-semibold text-sm text-on-surface">Customer Directory Restricted</p>
              <p className="mt-1">Only restaurant owners and managers have access to customer data.</p>
            </div>
          );
        }
        return <CustomersManagement />;
      case '/staff/discounts':
        if (features?.discounts === false) {
          return (
            <FeatureDisabledCard
              feature="Discounts & Happy Hours"
              description="Discount codes and promotional coupons are disabled in restaurant feature toggles."
            />
          );
        }
        if (!isOwner && !isManager) {
          return (
            <div className="py-16 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-3xl mb-2 text-amber-400 block">lock</span>
              <p className="font-semibold text-sm text-on-surface">Discount Management Restricted</p>
              <p className="mt-1">Only restaurant owners and managers can configure promotional codes.</p>
            </div>
          );
        }
        return <DiscountsManagement />;
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
      case '/staff/audit':
        if (!isOwner && !isManager) {
          return (
            <div className="py-16 text-center text-xs text-outline">
              <span className="material-symbols-outlined text-3xl mb-2 text-amber-400 block">lock</span>
              <p className="font-semibold text-sm text-on-surface">Security Audit Log Restricted</p>
              <p className="mt-1">Only restaurant owners and managers can inspect the security audit trail.</p>
            </div>
          );
        }
        return <AuditLogManagement />;
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
    if (features?.kds === false) {
      return (
        <div className="min-h-screen bg-[#0d0805] flex items-center justify-center p-6">
          <FeatureDisabledCard
            feature="Kitchen Display System (KDS)"
            description="The live kitchen display system is currently disabled in restaurant feature toggles."
          />
        </div>
      );
    }
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
