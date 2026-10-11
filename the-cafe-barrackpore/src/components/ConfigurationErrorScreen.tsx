import React from 'react';

export const ConfigurationErrorScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0E0906] flex flex-col items-center justify-center p-6 text-center text-on-surface font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]">
      <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.25)]">
        <span className="material-symbols-outlined text-3xl">cloud_off</span>
      </div>

      <span className="font-mono text-xs uppercase tracking-widest text-red-400 font-bold mb-2">
        System Configuration Required
      </span>

      <h1 className="font-serif text-3xl sm:text-4xl text-white font-normal mb-3">
        Backend Service Unconfigured
      </h1>

      <p className="font-sans text-sm text-zinc-400 max-w-lg mb-6 leading-relaxed font-light">
        This production deployment requires active Supabase credentials to handle live dining operations, menu orders, and guest reservations securely. Demo mode and simulated order confirmations are strictly disabled in production builds.
      </p>

      <div className="p-5 rounded-2xl bg-[#140D09] border border-white/10 text-xs text-zinc-300 max-w-md w-full text-left font-mono space-y-2.5 shadow-xl">
        <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-[11px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">settings</span>
          <span>Required Environment Variables</span>
        </div>
        <div className="space-y-1.5 text-zinc-400 text-[11px]">
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <code className="text-zinc-200">VITE_SUPABASE_URL</code>
            <span className="text-red-400">Missing</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <code className="text-zinc-200">VITE_SUPABASE_ANON_KEY</code>
            <span className="text-red-400">Missing</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600 mt-8 font-mono">
        Configure the environment variables in your deployment dashboard and rebuild the application.
      </p>
    </div>
  );
};

export default ConfigurationErrorScreen;
