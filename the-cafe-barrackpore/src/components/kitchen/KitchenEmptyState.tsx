import React from 'react';
import { playKitchenChime, unlockAudioContext } from '../../services/kitchenService';

interface KitchenEmptyStateProps {
  onRefresh?: () => void;
  soundEnabled: boolean;
  onToggleSound?: () => void;
}

export const KitchenEmptyState: React.FC<KitchenEmptyStateProps> = ({
  onRefresh,
  soundEnabled,
  onToggleSound,
}) => {
  const handleTestChime = async () => {
    await unlockAudioContext();
    playKitchenChime();
  };

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-white/[0.1] via-white/[0.03] to-transparent border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] max-w-lg w-full">
        <div className="p-8 sm:p-10 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] flex flex-col items-center text-center">
          {/* Hardware Icon Disc with Brass Glow */}
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] text-3xl shadow-[0_0_30px_rgba(212,175,55,0.2)] mb-5">
            <span className="material-symbols-outlined text-4xl">restaurant</span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#120F0D] animate-pulse" />
          </div>

          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
            Active Station Standby
          </span>
          <h3 className="text-2xl font-serif font-black text-white tracking-tight mt-1">
            Kitchen Rail is Clear
          </h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-sm">
            All guest orders have been prepared and delivered to dining covers or takeaway. Real-time optical dispatch is standing by for new tickets.
          </p>

          {/* Action shortcuts */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={handleTestChime}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono font-bold text-[#D4AF37] border border-[#D4AF37]/30 transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:scale-105"
            >
              <span className="material-symbols-outlined text-base">notifications_active</span>
              <span>Test Audio Chime</span>
            </button>

            {onToggleSound && !soundEnabled && (
              <button
                type="button"
                onClick={onToggleSound}
                className="px-4 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-xs font-mono font-bold text-emerald-300 border border-emerald-500/40 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">volume_up</span>
                <span>Enable Sound Alert</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-xs font-mono font-bold text-zinc-400 hover:text-white border border-white/[0.06] transition-colors cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">sync</span>
                <span>Check Dispatch</span>
              </button>
            )}
          </div>

          <div className="mt-8 flex items-center gap-2 text-[10px] text-zinc-500 font-mono pt-4 border-t border-white/[0.06] w-full justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time optical ticket sync active • 0 latency</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenEmptyState;
