import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const StaffDashboardPlaceholder: React.FC = () => {
  const { user, staffProfile, signOut, role } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/staff/login';
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between font-body-md selection:bg-primary-container selection:text-on-primary-container">
      {/* Staff Header */}
      <header className="border-b border-outline-variant/30 bg-surface-container/60 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-2">
              <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain filter invert" />
            </div>
            <div>
              <p className="text-xs font-serif uppercase tracking-[0.18em] text-primary">The Café Barrackpore</p>
              <p className="text-[10px] text-outline uppercase tracking-wider">Staff Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Session
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 text-xs font-semibold text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-4xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        {/* Verification Card */}
        <div className="bg-surface-container border border-outline-variant/50 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
            <span className="material-symbols-outlined text-base">verified_user</span>
            Phase 1F Staff Access Verified
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif text-on-surface font-bold tracking-tight mb-2">
            Welcome, {staffProfile?.full_name || 'Staff Member'}
          </h1>
          <p className="text-outline text-sm leading-relaxed mb-8 max-w-xl">
            You are securely authenticated into The Café Barrackpore staff foundation.
            Your role is authorized for terminal access.
          </p>

          {/* Profile Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/40">
              <p className="text-[11px] uppercase tracking-wider text-outline font-semibold mb-1">Staff Role</p>
              <p className="text-base font-bold text-primary uppercase font-serif">
                {role || 'staff'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/40">
              <p className="text-[11px] uppercase tracking-wider text-outline font-semibold mb-1">Account Status</p>
              <p className="text-base font-bold text-emerald-400">
                Active
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/40">
              <p className="text-[11px] uppercase tracking-wider text-outline font-semibold mb-1">Account Email</p>
              <p className="text-xs font-mono text-on-surface truncate">
                {user?.email || 'N/A'}
              </p>
            </div>
          </div>

          {/* Notice about Phase 2 Scope */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-outline leading-relaxed flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
            <div>
              <p className="font-semibold text-primary mb-0.5">Staff Foundation Active</p>
              <p>
                In accordance with Phase 1F scope, full operational interfaces (Order Management, Kitchen Display System, and Table Management)
                will be implemented in Phase 2. The database schema, RLS policies, and authenticated session pipeline are fully in place.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-outline-variant/30 flex flex-wrap gap-4 items-center justify-between">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-outline hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">home</span>
              View Customer Website
            </a>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-semibold text-xs hover:bg-primary-hover active:scale-95 transition-all shadow-md"
            >
              End Session & Sign Out
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/20 py-4 text-center text-outline/50 text-xs">
        The Café Barrackpore • Internal Staff Foundation
      </footer>
    </div>
  );
};

export default StaffDashboardPlaceholder;
