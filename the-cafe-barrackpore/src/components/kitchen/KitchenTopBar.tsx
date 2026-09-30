import React, { useState, useEffect } from 'react';
import type { KitchenConnectionStatus, KitchenFilter } from '../../services/kitchenService';

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
}) => {
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-700/50 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Kitchen Live</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/70 text-amber-300 border border-amber-600/50 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Reconnecting...</span>
          </div>
        );
      case 'offline':
        return (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 text-red-300 border border-red-600/50 text-[11px] font-mono font-bold hover:bg-red-900 cursor-pointer"
            title="Tap to reconnect"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Offline (Tap to Retry)</span>
          </button>
        );
    }
  };

  return (
    <header className="bg-[#120c08] border-b border-[#261a13] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[#f5efe6] select-none sticky top-0 z-30 shadow-md">
      {/* LEFT: BRAND & BADGE */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-[#D4AF37] text-[#120c08] font-mono text-[11px] font-black tracking-widest px-2.5 py-1 rounded shadow-sm">
            KDS
          </span>
          <div>
            <h1 className="text-sm sm:text-base font-serif font-black tracking-wider text-[#f5efe6] leading-none">
              The Café Barrackpore
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono mt-0.5">
              Kitchen Display System
            </p>
          </div>
        </div>

        {/* CONNECTION INDICATOR */}
        <div className="hidden sm:block">{getConnectionDisplay()}</div>
      </div>

      {/* CENTER: LIVE CLOCK & ACTIVE COUNT */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-center">
          <div className="font-mono text-base font-black tracking-wider text-[#f5efe6] leading-none">
            {currentTime}
          </div>
          <div className="text-[10px] text-zinc-400 font-medium tracking-wide mt-0.5">
            {currentDate}
          </div>
        </div>

        {/* ACTIVE WORKLOAD SUMMARY */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1a110b] border border-[#2d1f16] text-xs font-mono">
          <span className="text-zinc-400">Active Queue:</span>
          <span className="font-black text-[#D4AF37] text-sm">{totalActive}</span>
        </div>
      </div>

      {/* RIGHT: OPERATIONAL CONTROLS & ACTIONS */}
      <div className="flex items-center flex-wrap gap-2">
        {/* FILTERS */}
        <div className="flex items-center bg-[#170f0b] p-0.5 rounded-lg border border-[#2d1f16]">
          {(['all', 'dine_in', 'takeaway'] as KitchenFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onSetFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-md transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-[#D4AF37] text-[#120c08] shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'dine_in' ? 'Dine-In' : 'Takeaway'}
            </button>
          ))}
        </div>

        {/* SOUND TOGGLE */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            soundEnabled
              ? 'bg-[#1e1510] text-[#D4AF37] border-[#D4AF37]/50 hover:bg-[#281c15]'
              : 'bg-[#170f0b] text-zinc-500 border-[#2d1f16] hover:text-zinc-300'
          }`}
          title={soundEnabled ? 'Kitchen chime sound is ON' : 'Enable kitchen alert chime'}
          aria-label={soundEnabled ? 'Mute kitchen sound' : 'Enable kitchen sound'}
        >
          {soundEnabled ? (
            <>
              <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3a1 1 0 00-1 1v12a1 1 0 001.707.707L14.414 13H17a1 1 0 001-1V8a1 1 0 00-1-1h-2.586l-3.707-3.707A1 1 0 0010 3z" />
                <path d="M18.364 4.636a9 9 0 010 12.728l-1.414-1.414a7 7 0 000-9.9l1.414-1.414z" />
              </svg>
              <span>Sound On</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Muted</span>
            </>
          )}
        </button>

        {/* DENSITY TOGGLE */}
        <button
          type="button"
          onClick={() => onSetDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
          className="hidden sm:flex items-center px-2 py-1 rounded-lg text-xs font-mono font-medium text-zinc-400 bg-[#170f0b] border border-[#2d1f16] hover:text-white transition-colors cursor-pointer"
          title={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} ticket layout`}
        >
          {density === 'comfortable' ? 'Compact' : 'Normal'}
        </button>

        {/* FULLSCREEN */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-[#170f0b] border border-[#2d1f16] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          )}
        </button>

        {/* HISTORY DRAWER TOGGLE */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-300 bg-[#1a110b] border border-[#2d1f16] hover:bg-[#261a13] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          title="View recent completed orders"
        >
          <span>History</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400">
            {completedCount}
          </span>
        </button>

        {/* EXIT TO DASHBOARD */}
        <button
          type="button"
          onClick={onExitToDashboard}
          className="px-3 py-1 rounded-lg text-xs font-bold text-[#D4AF37] bg-[#1e1510] border border-[#D4AF37]/30 hover:bg-[#2d1f16] transition-colors flex items-center gap-1 cursor-pointer"
          title="Return to Staff Dashboard"
        >
          <span>Dashboard →</span>
        </button>

        {/* STAFF AVATAR / PROFILE */}
        {staffName && (
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-[#261a13] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-zinc-300 truncate max-w-[90px]">{staffName}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-mono">({staffRole})</span>
          </div>
        )}
      </div>
    </header>
  );
};
