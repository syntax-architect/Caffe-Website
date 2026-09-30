import React, { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoading, isAuthenticated, isActiveStaff, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/staff/login';
    }
  }, [isLoading, isAuthenticated]);

  // Loading State - Prevents authentication flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 font-body-md">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="font-serif text-primary tracking-widest text-sm uppercase">
          Verifying Staff Credentials...
        </p>
      </div>
    );
  }

  // Unauthenticated - Handled by redirect effect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 text-center font-body-md">
        <p className="text-outline text-sm mb-4">Redirecting to Staff Login...</p>
        <a
          href="/staff/login"
          className="px-6 py-2 rounded-full bg-primary text-on-primary font-semibold text-xs tracking-wider uppercase"
        >
          Go to Login
        </a>
      </div>
    );
  }

  // Authenticated but no active staff profile found
  if (!isActiveStaff) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 text-center font-body-md">
        <div className="max-w-md w-full bg-surface-container border border-outline-variant/60 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 text-error flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-serif text-on-surface font-semibold mb-2">
            Access Restricted
          </h2>
          <p className="text-outline text-sm leading-relaxed mb-6">
            Your account does not currently have active staff access. Please contact your restaurant manager or administrator.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => signOut().then(() => { window.location.href = '/staff/login'; })}
              className="flex-1 py-2.5 px-4 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 text-xs font-semibold text-on-surface transition-colors"
            >
              Sign Out
            </button>
            <a
              href="/"
              className="flex-1 py-2.5 px-4 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-semibold transition-colors flex items-center justify-center"
            >
              Public Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Active Staff Member - Authorized
  return <>{children}</>;
};

export default ProtectedRoute;
