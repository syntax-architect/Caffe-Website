import React, { lazy, Suspense } from 'react';
import { TableProvider } from './context/TableContext';
import { AuthProvider } from './context/AuthContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { I18nProvider } from './i18n';

import App from './App';
const QROrderingPage = lazy(() => import('./components/QROrderingPage').then(m => ({ default: m.QROrderingPage })));
const QRCodeGenerator = lazy(() => import('./components/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator })));
const StaffLoginPage = lazy(() => import('./components/staff/StaffLoginPage').then(m => ({ default: m.StaffLoginPage })));
const ResetPasswordPage = lazy(() => import('./components/staff/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
import { ProtectedRoute } from './components/staff/ProtectedRoute';
const StaffApp = lazy(() => import('./components/staff/StaffApp').then(m => ({ default: m.StaffApp })));
const PrivacyPolicyPage = lazy(() => import('./components/legal/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./components/legal/TermsPage').then(m => ({ default: m.TermsPage })));

import { MetaTags } from './components/MetaTags';

const BrandedLoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-[#0F0B08] flex flex-col items-center justify-center p-6 text-stone-200">
    <div className="relative w-12 h-12 mb-4">
      <div className="w-12 h-12 rounded-full border-2 border-stone-800 border-t-[#D4AF37] animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
      </div>
    </div>
    <p className="font-serif text-[#D4AF37] tracking-[0.25em] text-xs uppercase font-medium">
      The Café Barrackpore
    </p>
  </div>
);

export const Root: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  // Redirect legacy /kitchen route to authenticated /staff/kitchen
  if (pathname === '/kitchen' && typeof window !== 'undefined') {
    window.location.replace('/staff/kitchen');
    return null;
  }

  const isPrivacyRoute = pathname === '/privacy' || pathname === '/privacy-policy';
  const isTermsRoute = pathname === '/terms' || pathname === '/terms-of-service';
  const isResetPassword = pathname === '/reset-password';
  const isStaffLogin = pathname === '/staff/login';
  const isStaffRoute = pathname.startsWith('/staff');
  const isGeneratorRoute = pathname === '/qr-generator' || (pathname === '/qr' && searchParams.get('generate') === 'true');
  const isQRRoute = pathname === '/qr';

  return (
    <I18nProvider>
      <SiteConfigProvider>
        <MetaTags pathname={pathname} />
        {isStaffRoute || isStaffLogin || isResetPassword ? (
          <AuthProvider>
            <Suspense fallback={<BrandedLoadingFallback />}>
              {isResetPassword ? (
                <ResetPasswordPage />
              ) : isStaffLogin ? (
                <StaffLoginPage />
              ) : (
                <ProtectedRoute>
                  <StaffApp />
                </ProtectedRoute>
              )}
            </Suspense>
          </AuthProvider>
        ) : isPrivacyRoute ? (
          <Suspense fallback={<BrandedLoadingFallback />}>
            <PrivacyPolicyPage />
          </Suspense>
        ) : isTermsRoute ? (
          <Suspense fallback={<BrandedLoadingFallback />}>
            <TermsPage />
          </Suspense>
        ) : isGeneratorRoute ? (
          <Suspense fallback={<BrandedLoadingFallback />}>
            <QRCodeGenerator />
          </Suspense>
        ) : isQRRoute ? (
          <Suspense fallback={<BrandedLoadingFallback />}>
            <TableProvider>
              <QROrderingPage />
            </TableProvider>
          </Suspense>
        ) : (
          <TableProvider>
            <App />
          </TableProvider>
        )}
      </SiteConfigProvider>
    </I18nProvider>
  );
};

export default Root;
