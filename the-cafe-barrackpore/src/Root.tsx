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
const ProtectedRoute = lazy(() => import('./components/staff/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));
const StaffApp = lazy(() => import('./components/staff/StaffApp').then(m => ({ default: m.StaffApp })));
const PrivacyPolicyPage = lazy(() => import('./components/legal/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./components/legal/TermsPage').then(m => ({ default: m.TermsPage })));

import { MetaTags } from './components/MetaTags';

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
            {isResetPassword ? (
              <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
                <ResetPasswordPage />
              </Suspense>
            ) : isStaffLogin ? (
              <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
                <StaffLoginPage />
              </Suspense>
            ) : (
              <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
                <ProtectedRoute>
                  <StaffApp />
                </ProtectedRoute>
              </Suspense>
            )}
          </AuthProvider>
        ) : isPrivacyRoute ? (
          <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
            <PrivacyPolicyPage />
          </Suspense>
        ) : isTermsRoute ? (
          <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
            <TermsPage />
          </Suspense>
        ) : isGeneratorRoute ? (
          <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
            <QRCodeGenerator />
          </Suspense>
        ) : isQRRoute ? (
          <Suspense fallback={<div className="min-h-screen bg-[#120c08] flex items-center justify-center text-[#D4AF37] font-serif">Loading...</div>}>
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
