import React, { lazy, Suspense } from 'react';
import { TableProvider } from './context/TableContext';
import { AuthProvider } from './context/AuthContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { I18nProvider } from './i18n';

const App = lazy(() => import('./App'));
const QROrderingPage = lazy(() => import('./components/QROrderingPage').then(m => ({ default: m.QROrderingPage })));
const QRCodeGenerator = lazy(() => import('./components/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator })));
const StaffLoginPage = lazy(() => import('./components/staff/StaffLoginPage').then(m => ({ default: m.StaffLoginPage })));
const ProtectedRoute = lazy(() => import('./components/staff/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));
const StaffApp = lazy(() => import('./components/staff/StaffApp').then(m => ({ default: m.StaffApp })));

export const Root: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const isStaffLogin = pathname === '/staff/login';
  const isStaffRoute = pathname.startsWith('/staff');
  const isGeneratorRoute = pathname === '/qr-generator' || (pathname === '/qr' && searchParams.get('generate') === 'true');
  const isQRRoute = pathname === '/qr';

  return (
    <I18nProvider>
      <SiteConfigProvider>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
            {isStaffLogin ? (
              <StaffLoginPage />
            ) : isStaffRoute ? (
              <ProtectedRoute>
                <StaffApp />
              </ProtectedRoute>
            ) : isGeneratorRoute ? (
              <QRCodeGenerator />
            ) : isQRRoute ? (
              <TableProvider>
                <QROrderingPage />
              </TableProvider>
            ) : (
              <TableProvider>
                <App />
              </TableProvider>
            )}
          </Suspense>
        </AuthProvider>
      </SiteConfigProvider>
    </I18nProvider>
  );
};

export default Root;
