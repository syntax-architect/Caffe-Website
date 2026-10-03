import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { isStaffAccountLocked, recordStaffLoginFailure, resetStaffLoginFailures } from '../../utils/security';
import { useSiteConfig } from '../../context/SiteConfigContext';

export const StaffLoginPage: React.FC = () => {
  const { logoUrl } = useSiteConfig();
  const { signIn, verifyMfaCode, isMfaAwaiting, isLoading, isAuthenticated, isActiveStaff } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA / MFA States
  const [totpCode, setTotpCode] = useState('');
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Lockout countdown state
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Forgot Password Modal/View States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Check URL params for session timeout notice
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'timeout') {
        setErrorMessage('Session timed out after 30 minutes of inactivity. Please sign in again.');
      }
    }
  }, []);

  // Monitor lockout countdown
  useEffect(() => {
    if (!email) return;
    const lock = isStaffAccountLocked(email);
    setLockoutRemaining(lock.remainingSeconds);

    if (lock.remainingSeconds > 0) {
      const timer = setInterval(() => {
        const updated = isStaffAccountLocked(email);
        setLockoutRemaining(updated.remainingSeconds);
        if (!updated.locked) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [email]);

  // If already logged in with active staff profile, redirect to staff dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && isActiveStaff && !isMfaAwaiting) {
      window.location.href = '/staff/dashboard';
    }
  }, [isLoading, isAuthenticated, isActiveStaff, isMfaAwaiting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    // Check account lockout
    const lockout = isStaffAccountLocked(cleanEmail);
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingSeconds / 60);
      setErrorMessage(
        `Security Lockout: Account temporarily locked due to repeated failed login attempts. Please wait ${mins} minute(s) before trying again.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(cleanEmail, password);
      if (!result.success) {
        const failRecord = recordStaffLoginFailure(cleanEmail);
        if (failRecord.locked) {
          const mins = Math.ceil(failRecord.remainingSeconds / 60);
          setErrorMessage(
            `Account locked due to 5 consecutive failed attempts. For security, please wait ${mins} minutes or reset your password.`
          );
        } else {
          setErrorMessage(
            `${result.error || 'Authentication failed.'} (${failRecord.remainingAttempts} attempt(s) remaining before security lockout).`
          );
        }
      } else {
        resetStaffLoginFailures(cleanEmail);
        if (!result.mfaRequired) {
          window.location.href = '/staff/dashboard';
        }
      }
    } catch {
      setErrorMessage('An unexpected authentication error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);

    if (!totpCode.trim() || totpCode.trim().length !== 6) {
      setMfaError('Please enter the 6-digit authenticator code from your device.');
      return;
    }

    setIsMfaSubmitting(true);
    try {
      const result = await verifyMfaCode(totpCode.trim());
      if (!result.success) {
        setMfaError(result.error || 'Verification failed. Please check your authenticator code.');
      } else {
        window.location.href = '/staff/dashboard';
      }
    } catch {
      setMfaError('An unexpected error occurred during two-factor verification.');
    } finally {
      setIsMfaSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErrorMessage(null);
    setResetSuccessMessage(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setResetErrorMessage('Authentication service is not configured. Please contact the administrator.');
      return;
    }

    setIsResetSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        setResetErrorMessage(error.message || 'Failed to send password recovery instructions.');
      } else {
        setResetSuccessMessage('Recovery instructions have been sent to your email. Please check your inbox.');
      }
    } catch (err: any) {
      setResetErrorMessage(err.message || 'An unexpected error occurred while requesting password reset.');
    } finally {
      setIsResetSubmitting(false);
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
        <div className="p-2 sm:p-2.5 rounded-[2.25rem] bg-gradient-to-b from-white/[0.09] via-white/[0.03] to-white/[0.01] border border-white/[0.08] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <div className="rounded-[calc(2.25rem-0.625rem)] bg-[#120F0D]/95 border border-white/[0.05] p-6 sm:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] relative overflow-hidden">
            <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

            {/* Brand Crest & Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-5 group">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#1F1914] to-[#0A0807] border border-[#D4AF37]/40 flex items-center justify-center p-3.5 shadow-[0_0_30px_rgba(212,175,55,0.18)] transition-transform duration-500 group-hover:scale-105">
                  <img
                    src={logoUrl || "/logo.webp"}
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
                {isMfaAwaiting
                  ? 'Two-factor authenticator verification required for terminal access.'
                  : isForgotPassword
                  ? 'Request password recovery instructions for your staff account.'
                  : 'Secure management terminal for owners, floor managers & kitchen stations.'}
              </p>
            </div>

            {/* Lockout Warning */}
            {lockoutRemaining > 0 && !isMfaAwaiting && (
              <div className="mb-6 p-4 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start gap-3 shadow-md">
                <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5">
                  timer
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">Terminal Temporarily Locked</p>
                  <p className="text-amber-200/90 text-[11px] mt-0.5">
                    Repeated login failures recorded. Terminal unlocked in{' '}
                    <strong className="text-white font-mono">{Math.floor(lockoutRemaining / 60)}m {lockoutRemaining % 60}s</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && !isForgotPassword && !isMfaAwaiting && (
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

            {isMfaAwaiting ? (
              /* Two-Factor Authentication Prompt (Supabase MFA) */
              <form onSubmit={handleMfaSubmit} className="space-y-5">
                {mfaError && (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs leading-relaxed flex items-start gap-3 shadow-md"
                  >
                    <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">
                      security_update_warning
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-red-300">2FA Challenge Error</p>
                      <p className="text-red-200/90 text-[11px] mt-0.5">{mfaError}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="totp-code"
                    className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold mb-1.5"
                  >
                    6-Digit Authenticator Code
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                      pin
                    </span>
                    <input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                      autoFocus
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      disabled={isMfaSubmitting}
                      className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-center tracking-[0.5em] font-mono text-lg text-white placeholder:text-stone-700 focus:outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-2 text-center">
                    Enter the code generated by Google Authenticator, 1Password, or Authy.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isMfaSubmitting || totpCode.length !== 6}
                  className="w-full group mt-2 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(212,175,55,0.3)] active:scale-[0.98]"
                >
                  {isMfaSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120B08] border-t-transparent rounded-full animate-spin" />
                      <span>Verifying TOTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Enter Terminal</span>
                      <span className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full py-2 text-xs text-stone-400 hover:text-white transition-colors text-center"
                >
                  Cancel and Return to Login
                </button>
              </form>
            ) : isForgotPassword ? (
              /* Forgot Password Form */
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetSuccessMessage && (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs leading-relaxed flex items-start gap-3 shadow-md"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-base shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-300">Reset Email Dispatched</p>
                      <p className="text-emerald-200/90 text-[11px] mt-0.5">{resetSuccessMessage}</p>
                    </div>
                  </div>
                )}

                {resetErrorMessage && (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs leading-relaxed flex items-start gap-3 shadow-md"
                  >
                    <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">
                      error
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-red-300">Recovery Error</p>
                      <p className="text-red-200/90 text-[11px] mt-0.5">{resetErrorMessage}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold mb-1.5"
                  >
                    Staff Work Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                      mail
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="staff@thecafebarrackpore.com"
                      disabled={isResetSubmitting}
                      className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isResetSubmitting}
                  className="w-full group mt-2 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(212,175,55,0.3)] active:scale-[0.98]"
                >
                  {isResetSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120B08] border-t-transparent rounded-full animate-spin" />
                      <span>Sending Instructions...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <span className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full py-2 text-xs text-stone-400 hover:text-white transition-colors text-center"
                >
                  Return to Staff Login
                </button>
              </form>
            ) : (
              /* Standard Staff Login Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold mb-1.5"
                  >
                    Staff Work Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                      mail
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@thecafebarrackpore.com"
                      disabled={isSubmitting || lockoutRemaining > 0}
                      className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-[11px] uppercase tracking-wider text-stone-300 font-semibold"
                    >
                      Terminal Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[11px] text-[#D4AF37] hover:underline hover:text-[#F3C766] transition-colors"
                    >
                      Forgot Credentials?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
                      lock
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={isSubmitting || lockoutRemaining > 0}
                      className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || lockoutRemaining > 0}
                  className="w-full group mt-2 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(212,175,55,0.3)] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120B08] border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating Terminal...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Operations Terminal</span>
                      <span className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Terminal Security Badge Footer */}
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-400">shield</span>
                <span>Protected by Supabase RBAC & 2FA</span>
              </span>
              <span className="font-mono text-[10px]">TLS 1.3 / EAL2</span>
            </div>
          </div>
        </div>
      </main>

      {/* Terminal Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full text-center py-4 text-xs text-stone-500">
        <p>© {new Date().getFullYear()} The Café Barrackpore. All rights reserved. Authorized staff personnel only.</p>
      </footer>
    </div>
  );
};

export default StaffLoginPage;
