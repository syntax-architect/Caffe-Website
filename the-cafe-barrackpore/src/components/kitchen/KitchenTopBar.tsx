import React, { useState, useEffect } from 'react';
import type { KitchenConnectionStatus, KitchenFilter } from '../../services/kitchenService';
import { unlockAudioContext, playKitchenOrderBell } from '../../services/soundService';
import { useSiteConfig } from '../../context/SiteConfigContext';

interface KitchenTopBarProps {
  connectionStatus: KitchenConnectionStatus;
  soundEnabled: boolean;
  onToggleSound: () => void;
  density: 'comfortable' | 'compact';
  onSetDensity: (d: 'comfortable' | 'compact') => void;
  filter: KitchenFilter;
  onSetFilter: (f: KitchenFilter) => void;
  totalActive: number;
  completedCount: number;
  onOpenHistory: () => void;
  onExitToDashboard: () => void;
  staffName?: string;
  staffRole?: string;
  onRefresh?: () => void;
  onSimulateTestOrder?: () => void;
}

export const KitchenTopBar: React.FC<KitchenTopBarProps> = ({
  connectionStatus,
  soundEnabled,
  onToggleSound,
  density,
  onSetDensity,
  filter,
  onSetFilter,
  totalActive,
  completedCount,
  onOpenHistory,
  onExitToDashboard,
  staffName,
  staffRole,
  onRefresh,
  onSimulateTestOrder,
}) => {
  const { logoUrl } = useSiteConfig();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[KitchenTopBar] Fullscreen request prevented:', err);
    }
  };

  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'live':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>KITCHEN LIVE</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>SYNCING...</span>
          </div>
        );
      case 'offline':
        return (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/90 text-red-300 border border-red-500/50 text-[11px] font-mono font-bold hover:bg-red-900 cursor-pointer shadow-sm"
            title="Tap to reconnect"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>OFFLINE (RETRY)</span>
          </button>
        );
    }
  };

  return (
    <header className="bg-[#0A0807] border-b border-white/[0.08] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white select-none sticky top-0 z-30 shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
      {/* LEFT SECTION: Brand Crest & Exit Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExitToDashboard}
          className="group px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-stone-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          title="Exit to Restaurant Management Dashboard"
        >
          <span className="material-symbols-outlined text-base text-[#D4AF37] group-hover:-translate-x-0.5 transition-transform">
            arrow_back
          </span>
          <span className="hidden sm:inline">Management</span>
        </button>

        <div className="flex items-center gap-2 pl-1 border-l border-white/[0.08]">
          <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/35 flex items-center justify-center p-1">
            <img src={logoUrl || "/logo.webp"} alt="Logo" className="w-full h-full object-contain filter invert" />
          </div>
          <div>
            <h1 className="font-serif text-sm font-bold tracking-[0.14em] uppercase text-white leading-none">
              Kitchen Display
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-mono text-[#D4AF37] tracking-wider uppercase">
                Station KDS-01
              </span>
              {staffName && (
                <span className="hidden xl:inline text-stone-400 font-mono text-[9px] border-l border-white/[0.1] pl-1.5">
                  {staffName} ({staffRole || 'staff'})
                </span>
              )}
            </div>
          </div>
        </div>

        {getConnectionDisplay()}
      </div>

      {/* CENTER SECTION: Filter Segmented Controller */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#14100D] border border-white/[0.06] shadow-inner">
        <button
          type="button"
          onClick={() => onSetFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-[#D4AF37] text-[#120B08] shadow-sm'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          All Tickets
        </button>
        <button
          type="button"
          onClick={() => onSetFilter('dine_in')}
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
            filter === 'dine_in'
              ? 'bg-[#D4AF37] text-[#120B08] shadow-sm'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-xs">restaurant</span>
          <span>Dine-In</span>
        </button>
        <button
          type="button"
          onClick={() => onSetFilter('takeaway')}
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
            filter === 'takeaway'
              ? 'bg-[#D4AF37] text-[#120B08] shadow-sm'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-xs">takeout_dining</span>
          <span>Takeaway</span>
        </button>
      </div>

      {/* RIGHT SECTION: Metrics, Tools & Clock */}
      <div className="flex items-center gap-3">
        {/* Ticket Volume Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <span className="text-[10px] font-mono uppercase text-stone-400">Active</span>
          <span className="font-mono font-bold text-sm text-[#F3C766]">{totalActive}</span>
          <span className="text-stone-600">|</span>
          <span className="text-[10px] font-mono uppercase text-stone-400">Done</span>
          <span className="font-mono font-bold text-sm text-emerald-400">{completedCount}</span>
        </div>

        {/* History Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-stone-300 hover:text-[#D4AF37] transition-all cursor-pointer"
          title="View recent completed tickets"
        >
          <span className="material-symbols-outlined text-lg">history</span>
        </button>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-[#D4AF37]/15 text-[#F3C766] border-[#D4AF37]/30 hover:bg-[#D4AF37]/25'
              : 'bg-white/[0.04] text-stone-500 border-white/[0.08] hover:text-stone-300'
          }`}
          title={soundEnabled ? 'Chime sound alert is ON' : 'Chime sound alert is OFF'}
        >
          <span className="material-symbols-outlined text-lg">
            {soundEnabled ? 'volume_up' : 'volume_off'}
          </span>
        </button>

        {/* Audio Speaker Test / Chime Check */}
        <button
          type="button"
          onClick={async () => {
            await unlockAudioContext();
            playKitchenOrderBell();
          }}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-[#D4AF37]/15 border border-white/[0.08] hover:border-[#D4AF37]/40 text-stone-300 hover:text-[#F3C766] transition-all cursor-pointer"
          title="Sound Check: Test brass kitchen bell ring"
          aria-label="Test kitchen chime"
        >
          <span className="material-symbols-outlined text-lg">notifications_active</span>
        </button>

        {/* Dinner Service Simulation Quick Trigger */}
        {onSimulateTestOrder && (
          <button
            type="button"
            onClick={onSimulateTestOrder}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 to-[#F3C766]/10 hover:from-[#D4AF37]/30 hover:to-[#F3C766]/20 border border-[#D4AF37]/40 text-[#F3C766] text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            title="Simulate incoming Table 07 order for dinner rush testing"
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            <span>+ Test Order</span>
          </button>
        )}

        {/* Density Toggle */}
        <button
          type="button"
          onClick={() => onSetDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-stone-300 hover:text-white transition-all cursor-pointer"
          title={`Switch to ${density === 'comfortable' ? 'Compact' : 'Comfortable'} mode`}
        >
          <span className="material-symbols-outlined text-lg">
            {density === 'comfortable' ? 'view_compact' : 'view_comfortable'}
          </span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-stone-300 hover:text-[#D4AF37] transition-all cursor-pointer"
          title={isFullscreen ? 'Exit full screen' : 'Expand full screen'}
        >
          <span className="material-symbols-outlined text-lg">
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>

        {/* Live Digital Clock */}
        <div className="hidden lg:flex flex-col items-end pl-2 border-l border-white/[0.08]">
          <span className="font-mono text-sm font-bold text-white tracking-wider leading-none">
            {currentTime}
          </span>
          <span className="text-[10px] text-stone-400 font-medium uppercase mt-0.5">
            {currentDate}
          </span>
        </div>
      </div>
    </header>
  );
};

export default KitchenTopBar;
