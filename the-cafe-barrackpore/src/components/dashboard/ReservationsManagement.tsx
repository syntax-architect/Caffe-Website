import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchReservations, updateReservationStatus } from '../../services/dashboardService';
import { useNotification } from '../../hooks/useNotification';
import type { ReservationRecord, ReservationStatus } from '../../types/reservation';

export const ReservationsManagement: React.FC = () => {
  const { addNotification } = useNotification();

  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selectedView, setSelectedView] = useState<'today' | 'upcoming' | 'all'>('today');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected reservation for inspection drawer
  const [activeRes, setActiveRes] = useState<ReservationRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const loadReservations = useCallback(async () => {
    try {
      const data = await fetchReservations({
        view: selectedView,
        status: selectedStatus,
        search: searchQuery,
      });
      setReservations(data);
    } catch (err) {
      console.error('Error loading reservations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedView, selectedStatus, searchQuery]);

  useEffect(() => {
    let isMounted = true;
    fetchReservations({
      view: selectedView,
      status: selectedStatus,
      search: searchQuery,
    }).then((data) => {
      if (isMounted) {
        setReservations(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedView, selectedStatus, searchQuery]);

  const handleStatusChange = async (resId: string, newStatus: ReservationStatus) => {
    setIsUpdating(true);
    try {
      const res = await updateReservationStatus(resId, newStatus);
      if (res.success) {
        addNotification('success', 'Reservation Updated', `Reservation marked as ${newStatus.toUpperCase()}`);
        if (activeRes && activeRes.id === resId) {
          setActiveRes({ ...activeRes, status: newStatus });
        }
        await loadReservations();
      } else {
        addNotification('error', 'Update Failed', res.error || 'Could not update reservation.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to update reservation status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending Review',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          dot: 'bg-sky-400',
        };
      case 'seated':
        return {
          label: 'Seated Now',
          classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'completed':
        return {
          label: 'Completed',
          classes: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30',
          dot: 'bg-zinc-500',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      case 'no_show':
        return {
          label: 'No-Show',
          classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          dot: 'bg-purple-400',
        };
      default:
        return {
          label: status,
          classes: 'bg-zinc-800 text-zinc-400 border-zinc-700',
          dot: 'bg-zinc-500',
        };
    }
  };

  // Stat metrics
  const pendingCount = useMemo(() => reservations.filter((r) => r.status === 'pending').length, [reservations]);
  const seatedCount = useMemo(() => reservations.filter((r) => r.status === 'seated').length, [reservations]);
  const confirmedCount = useMemo(() => reservations.filter((r) => r.status === 'confirmed').length, [reservations]);
  const totalGuests = useMemo(() => reservations.reduce((sum, r) => sum + (r.party_size || 0), 0), [reservations]);

  const handleWhatsAppGuest = (res: ReservationRecord) => {
    const cleanPhone = (res.customer_phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${res.customer_name}, this is The Café Barrackpore regarding your table reservation ${res.reservation_ref} for ${res.party_size} guests on ${res.reservation_date} at ${res.reservation_time}. We look forward to welcoming you!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Floor Reservations & Concierge Dispatch
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Guest Reservations
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Manage table bookings, guest arrivals, seating status, and send instant WhatsApp concierge confirmations.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReservations}
          className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          <span>Refresh Bookings</span>
        </button>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Pending Review</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-amber-400 mt-0.5">{pendingCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-sky-400">Confirmed</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-sky-400 mt-0.5">{confirmedCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Seated Now</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-400 mt-0.5">{seatedCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">Expected Covers</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#D4AF37] mt-0.5">{totalGuests} guests</p>
          </div>
        </div>
      </div>

      {/* SEARCH AND VIEW SELECTORS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search by ref, guest name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className="bg-[#120F0D] p-1 rounded-xl border border-white/[0.08] flex items-center gap-1 self-start sm:self-auto">
          {(['today', 'upcoming', 'all'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setSelectedView(view)}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg font-bold transition-all cursor-pointer ${
                selectedView === view
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* STATUS FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs border-b border-white/[0.06]">
        {['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setSelectedStatus(status)}
            className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedStatus === status
                ? 'bg-[#D4AF37] text-[#070605] shadow-[0_4px_12px_rgba(212,175,55,0.25)]'
                : 'bg-[#120F0D] text-zinc-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* RESERVATIONS DATA DISPLAY */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 font-mono text-xs">Loading reservation ledger...</div>
      ) : reservations.length === 0 ? (
        <div className="p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="py-20 text-center rounded-[calc(2rem-0.375rem)] bg-[#120F0D] flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 text-zinc-600">event_seat</span>
            <p className="font-serif font-bold text-base text-white">No reservations found</p>
            <p className="text-xs text-zinc-500 mt-1">No booking records match the selected view and filter criteria.</p>
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {reservations.map((res) => {
              const badge = getStatusBadge(res.status);
              return (
                <div
                  key={res.id}
                  onClick={() => setActiveRes(res)}
                  className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.08] cursor-pointer hover:border-[#D4AF37]/40 transition-all"
                >
                  <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#D4AF37]">{res.reservation_ref}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.classes}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="font-bold text-white text-sm">{res.customer_name}</p>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{res.customer_phone}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-zinc-200">
                        {res.party_size} Guests
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/[0.06]">
                      <span className="font-mono">{res.reservation_date}</span>
                      <span className="font-mono font-bold text-white">{res.reservation_time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= md) */}
          <div className="hidden md:block p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl overflow-hidden">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-zinc-400 text-[10px] font-mono uppercase tracking-[0.16em]">
                    <th className="py-4 px-6 font-bold">Booking Ref</th>
                    <th className="py-4 px-4 font-bold">Guest Profile</th>
                    <th className="py-4 px-4 font-bold">Schedule</th>
                    <th className="py-4 px-4 font-bold">Covers</th>
                    <th className="py-4 px-4 font-bold">Special Notes</th>
                    <th className="py-4 px-4 font-bold">Status</th>
                    <th className="py-4 px-6 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {reservations.map((res) => {
                    const badge = getStatusBadge(res.status);
                    return (
                      <tr
                        key={res.id}
                        onClick={() => setActiveRes(res)}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <td className="py-4 px-6 font-mono font-bold text-[#D4AF37]">{res.reservation_ref}</td>

                        <td className="py-4 px-4">
                          <p className="font-bold text-white">{res.customer_name}</p>
                          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{res.customer_phone}</p>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <p className="font-medium text-white">{res.reservation_date}</p>
                          <p className="font-mono text-[11px] text-[#D4AF37] mt-0.5">{res.reservation_time}</p>
                        </td>

                        <td className="py-4 px-4 font-mono font-bold text-white">
                          {res.party_size} guests
                        </td>

                        <td className="py-4 px-4 text-zinc-400 max-w-[200px] truncate">
                          {res.special_requests || '—'}
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.classes}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRes(res);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Concierge
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SLIDE-OVER CONCIERGE INSPECTION DRAWER */}
      {activeRes && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setActiveRes(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-[#0F0B09] border-l border-white/[0.1] h-full shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-y-auto p-6 sm:p-8 z-10 animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-white/[0.06] mb-6">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Concierge Ledger
                  </span>
                  <h3 className="text-2xl font-mono font-black text-white mt-0.5">
                    {activeRes.reservation_ref}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRes(null)}
                  className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Status & Quick Action Card */}
              <div className="p-4 rounded-2xl bg-[#120F0D] border border-white/[0.08] mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Current Status</span>
                  {(() => {
                    const badge = getStatusBadge(activeRes.status);
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${badge.classes}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Status Transition Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
                  {activeRes.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'confirmed')}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-xs shadow transition-all cursor-pointer"
                      >
                        Confirm Booking
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'cancelled')}
                        className="py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {activeRes.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'seated')}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow transition-all cursor-pointer"
                      >
                        Mark Guests Seated
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'no_show')}
                        className="py-2.5 px-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        No-Show
                      </button>
                    </>
                  )}

                  {activeRes.status === 'seated' && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(activeRes.id, 'completed')}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Complete Dining Service
                    </button>
                  )}
                </div>
              </div>

              {/* Guest Profile Card */}
              <div className="p-5 rounded-2xl bg-[#120F0D] border border-white/[0.08] mb-6 space-y-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                  Primary Guest Contact
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-serif font-black text-white">{activeRes.customer_name}</h4>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">{activeRes.customer_phone}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Source: {activeRes.source || 'Website'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppGuest(activeRes)}
                      className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center justify-center cursor-pointer"
                      title="Open WhatsApp Concierge Chat"
                    >
                      <span className="material-symbols-outlined text-lg">chat</span>
                    </button>
                    <a
                      href={`tel:${activeRes.customer_phone}`}
                      className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors flex items-center justify-center"
                      title="Call Guest Phone"
                    >
                      <span className="material-symbols-outlined text-lg">call</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.06] text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Date</span>
                    <p className="font-bold text-white mt-0.5">{activeRes.reservation_date}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Time Slot</span>
                    <p className="font-mono font-bold text-[#D4AF37] mt-0.5">{activeRes.reservation_time}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Party Size</span>
                    <p className="font-bold text-white mt-0.5">{activeRes.party_size} guests</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Booked On</span>
                    <p className="font-mono text-zinc-300 mt-0.5">
                      {new Date(activeRes.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>

                {activeRes.special_requests && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                      Special Guest Notes
                    </span>
                    <p className="text-xs text-zinc-300 mt-1 italic leading-relaxed">
                      "{activeRes.special_requests}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleWhatsAppGuest(activeRes)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base font-bold">send</span>
                <span>Send WhatsApp Confirmation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationsManagement;
