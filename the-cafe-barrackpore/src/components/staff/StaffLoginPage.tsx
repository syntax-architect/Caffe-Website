import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';

export const StaffLoginPage: React.FC = () => {
  const { signIn, isLoading, isAuthenticated, isActiveStaff } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in with active staff profile, redirect to staff dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && isActiveStaff) {
      window.location.href = '/staff/dashboard';
    }
  }, [isLoading, isAuthenticated, isActiveStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMessage(
        'Database connection is not configured. Staff authentication requires valid Supabase environment variables.'
      );
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
      } else {
        window.location.href = '/staff/dashboard';
      }
    } catch {
      setErrorMessage('An unexpected error occurred during sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between p-4 sm:p-8 font-body-md selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pt-4">
        <a href="/" className="inline-flex items-center gap-2 text-xs font-medium text-outline hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Public Website
        </a>
        <span className="text-[11px] uppercase tracking-widest text-primary/80 font-serif border border-primary/20 rounded-full px-3 py-1 bg-primary/5">
          Restricted Staff Access
        </span>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-12 bg-surface-container border border-outline-variant/50 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Gold Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-3 mb-4 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
            <img src="/logo.webp" alt="The Café Barrackpore" className="w-full h-full object-contain filter invert" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif uppercase tracking-[0.18em] text-primary">
            The Café Barrackpore
          </h1>
          <p className="text-on-surface/80 text-xs sm:text-sm font-semibold tracking-wider uppercase mt-1">
            Staff Portal Login
          </p>
          <p className="text-outline text-xs mt-1">
            Authorized personnel only • Secure terminal access
          </p>
        </div>

        {/* Supabase Demo Mode Warning */}
        {!isSupabaseConfigured && (
          <div
            role="status"
            className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-3"
          >
            <span className="material-symbols-outlined text-amber-400 text-lg shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-amber-300 mb-1">Supabase Not Configured (Demo Mode)</p>
              <p className="text-amber-200/80">
                Staff authentication requires valid <code className="text-amber-300">VITE_SUPABASE_URL</code> and <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code>.
                Public customer ordering and WhatsApp dispatch continue to work normally.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-error/10 border border-error/30 text-error text-xs leading-relaxed flex items-start gap-2.5"
          >
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error_outline</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs uppercase tracking-wider text-outline font-semibold mb-1.5">
              Staff Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                mail
              </span>
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@thecafebarrackpore.com"
                disabled={isSubmitting || !isSupabaseConfigured}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs uppercase tracking-wider text-outline font-semibold mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                lock
              </span>
              <input
                id="staff-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSubmitting || !isSupabaseConfigured}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isSupabaseConfigured}
            className="w-full mt-2 py-3 px-6 rounded-full bg-primary text-on-primary font-semibold text-sm hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">login</span>
                <span>Sign In to Terminal</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <p className="mt-8 text-center text-[11px] text-outline/60 leading-normal">
          Staff accounts are provisioned by restaurant administration.
          Self-registration is disabled for security.
        </p>
      </main>

      {/* Footer */}
      <footer className="text-center text-outline/40 text-xs py-4">
        The Café Barrackpore • Staff Access & Operations Terminal
      </footer>
    </div>
  );
};

export default StaffLoginPage;
