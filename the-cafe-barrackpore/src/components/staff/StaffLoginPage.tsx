import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { StaffRole } from '../../types/auth';

export const StaffLoginPage: React.FC = () => {
  const { signIn, isLoading, isAuthenticated, isActiveStaff, signInDemo } = useAuth();

  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<StaffRole>('owner');

  // If already logged in with active staff profile, redirect to staff dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && isActiveStaff) {
      window.location.href = '/staff/dashboard';
    }
  }, [isLoading, isAuthenticated, isActiveStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
      } else {
        window.location.href = '/staff/dashboard';
      }
    } catch {
      setErrorMessage('An unexpected authentication error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchDemo = (role: StaffRole, targetPath: string = '/staff/dashboard') => {
    if (signInDemo) {
      signInDemo(role);
      window.location.href = targetPath;
    }
  };

  return (
    <div className="min-h-screen bg-[#070605] text-[#F3EFEA] flex flex-col justify-between p-4 sm:p-8 font-sans relative overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-[#FFF7E6]">
      {/* Background Ambient Lighting Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] bg-[#D4AF37]/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[30rem] h-[30rem] bg-[#E58A1F]/8 rounded-full blur-[160px]" />
        <div className="absolute -bottom-20 left-1/3 w-[28rem] h-[28rem] bg-[#D4AF37]/5 rounded-full blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full pt-2 sm:pt-4">
        <a
          href="/"
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-stone-300 hover:text-white transition-all duration-300"
        >
          <span className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-stone-400 group-hover:text-[#D4AF37] group-hover:-translate-x-0.5 transition-transform">
            <span className="material-symbols-outlined text-[13px]">arrow_back</span>
          </span>
          <span>Back to Dining Room</span>
        </a>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4AF37] px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25">
            Operations Terminal
          </span>
        </div>
      </header>

      {/* Main Login Double-Bezel Card */}
      <main className="relative z-10 max-w-lg w-full mx-auto my-auto py-8">
        {/* Outer Hardware Shell */}
        <div className="p-2 sm:p-2.5 rounded-[2.25rem] bg-gradient-to-b from-white/[0.09] via-white/[0.03] to-white/[0.01] border border-white/[0.08] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          {/* Inner Core */}
          <div className="rounded-[calc(2.25rem-0.625rem)] bg-[#120F0D]/95 border border-white/[0.05] p-6 sm:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] relative overflow-hidden">
            {/* Subtle Top Gold Highlight Line */}
            <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

            {/* Brand Crest & Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-5 group">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#1F1914] to-[#0A0807] border border-[#D4AF37]/40 flex items-center justify-center p-3.5 shadow-[0_0_30px_rgba(212,175,55,0.18)] transition-transform duration-500 group-hover:scale-105">
                  <img
                    src="/logo.webp"
                    alt="The Café Barrackpore"
                    className="w-full h-full object-contain filter invert contrast-125"
                  />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#D4AF37] text-[#120B08] flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-[14px] font-bold">verified_user</span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[#D4AF37] font-semibold mb-1">
                Hospitality Operations Portal
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-[0.06em] text-white">
                The Café Barrackpore
              </h1>
              <p className="text-stone-400 text-xs sm:text-sm mt-1 max-w-xs leading-relaxed">
                Secure management terminal for owners, floor managers & kitchen stations.
              </p>
            </div>

            {/* Demo Mode 1-Click Launchpad (If Supabase is not configured or in evaluation) */}
            {!isSupabaseConfigured && (
              <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1C1610] to-[#120E0A] border border-[#D4AF37]/30 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#D4AF37] text-lg">auto_awesome</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#F3C766]">
                      Demo Evaluation Mode
                    </span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/15 px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
                    Zero Setup Required
                  </span>
                </div>

                <p className="text-stone-300 text-xs leading-relaxed mb-4">
                  Explore the full restaurant management suite with simulated orders, table bookings, and live kitchen dispatch:
                </p>

                {/* Role Switcher Pills */}
                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-black/40 border border-white/[0.06] mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDemoRole('owner')}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all ${
                      selectedDemoRole === 'owner'
                        ? 'bg-[#D4AF37] text-[#120B08] font-bold shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDemoRole('manager')}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all ${
                      selectedDemoRole === 'manager'
                        ? 'bg-[#D4AF37] text-[#120B08] font-bold shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDemoRole('staff')}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all ${
                      selectedDemoRole === 'staff'
                        ? 'bg-[#D4AF37] text-[#120B08] font-bold shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Kitchen
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo(selectedDemoRole, '/staff/dashboard')}
                    className="flex-1 group py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.25)] active:scale-[0.98]"
                  >
                    <span>Launch Terminal ({selectedDemoRole.toUpperCase()})</span>
                    <span className="w-5 h-5 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo('staff', '/staff/kds')}
                    className="py-3 px-4 rounded-xl border border-white/[0.12] hover:border-[#D4AF37]/50 bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 hover:text-[#D4AF37] font-semibold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]"
                    title="Launch Kitchen Display System full screen"
                  >
                    <span className="material-symbols-outlined text-base">soup_kitchen</span>
                    <span>Live KDS</span>
                  </button>
                </div>
              </div>
            )}

            {/* Credentials Quick-Reference Pill */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-[#D4AF37]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs mb-6">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <span className="material-symbols-outlined text-base">key</span>
                </span>
                <div>
                  <p className="font-mono text-[11px] text-zinc-200">
                    Email: <span className="font-bold text-[#D4AF37]">admin@gmail.com</span>
                  </p>
                  <p className="font-mono text-[11px] text-zinc-200">
                    Password: <span className="font-bold text-[#D4AF37]">admin123</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@gmail.com');
                  setPassword('admin123');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Auto-Fill
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs leading-relaxed flex items-start gap-3 shadow-md"
              >
                <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-red-300">Sign In Issue</p>
                  <p className="text-red-200/90 text-[11px] mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Credentials Sign In Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="staff-email"
                  className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold mb-1.5 flex items-center justify-between"
                >
                  <span>Staff Work Email</span>
                  <span className="text-[10px] text-stone-500 font-normal">SSO / Password</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                    mail
                  </span>
                  <input
                    id="staff-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                    disabled={isSubmitting}
                    className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold mb-1.5 flex items-center justify-between"
                >
                  <span>Security Credential</span>
                  <span className="text-[10px] text-stone-500 font-normal">Encrypted</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                    lock
                  </span>
                  <input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin123"
                    disabled={isSubmitting}
                    className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none transition-all disabled:opacity-50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit CTA with Button-in-Button architecture */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full group mt-2 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(212,175,55,0.3)] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#120B08] border-t-transparent rounded-full animate-spin" />
                    <span>Authorizing Terminal...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate Session</span>
                    <span className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Terminal Security Meta */}
            <div className="mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-emerald-500">lock</span>
                <span>256-bit TLS Enforced</span>
              </span>
              <span>Hardware Auth Ready</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-stone-500 text-xs py-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>The Café Barrackpore • Enterprise Hospitality Suite</span>
        <span className="hidden sm:inline text-stone-600">•</span>
        <span>Cantonment, Riverside Road, Barrackpore</span>
      </footer>
    </div>
  );
};

export default StaffLoginPage;
