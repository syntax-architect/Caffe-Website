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
    <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-[#1e1510] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-2xl shadow-xl mb-4">
        ☕
      </div>
      <h3 className="text-xl font-bold font-serif text-[#f5efe6] tracking-wide">
        Kitchen is clear
      </h3>
      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
        All orders have been prepared and served. Real-time dispatch is connected and standing by for new orders from dine-in tables and takeaway.
      </p>

      {/* Action shortcuts */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleTestChime}
          className="px-3.5 py-2 rounded-lg bg-[#1a120c] hover:bg-[#251a11] text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>🔔 Test Chime Sound</span>
        </button>

        {onToggleSound && !soundEnabled && (
          <button
            type="button"
            onClick={onToggleSound}
            className="px-3.5 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-xs font-semibold text-emerald-300 border border-emerald-600/40 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>🔊 Turn Sound On</span>
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-lg bg-[#1a120c] hover:bg-[#251a11] text-xs font-semibold text-zinc-300 border border-[#2d1f16] transition-colors cursor-pointer"
          >
            <span>↻ Check Server</span>
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-zinc-400 font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Live ticket synchronization active</span>
      </div>
    </div>
  );
};
