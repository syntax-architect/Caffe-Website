import React, { useState, useEffect, useCallback } from 'react';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'confirmed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'seated':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'completed':
        return 'bg-stone-500/15 text-stone-300 border-stone-500/30';
      case 'cancelled':
      case 'no_show':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      default:
        return 'bg-stone-500/15 text-stone-300 border-stone-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search by ref, guest name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-10 pr-4 py-2 text-xs text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* View Tabs & Refresh */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-container p-1 rounded-xl border border-outline-variant/60 flex items-center gap-1">
            {(['today', 'upcoming', 'all'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setSelectedView(view)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  selectedView === view
                    ? 'bg-primary text-on-primary shadow'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadReservations}
            className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-outline hover:text-on-surface transition-colors"
            title="Refresh Reservations"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/* Status Filter Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant/30 scrollbar-none text-xs">
        {['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setSelectedStatus(status)}
            className={`px-3 py-1 rounded-full font-semibold capitalize whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-outline hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Reservations Table */}
      <div className="bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-outline text-xs">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="py-20 text-center text-outline text-xs flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-40">event_seat</span>
            <p className="font-semibold text-sm text-on-surface">No reservations scheduled</p>
            <p className="text-[11px] mt-1 max-w-sm">
              No booking requests found for the selected view and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-high/40 text-outline text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Guest Name</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">Party</th>
                  <th className="py-3 px-4 font-semibold">Notes</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {reservations.map((res) => (
                  <tr
                    key={res.id}
                    onClick={() => setActiveRes(res)}
                    className="hover:bg-surface-container-high/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-primary">{res.reservation_ref}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{res.customer_name}</p>
                      <p className="text-[10px] text-outline font-mono">{res.customer_phone}</p>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface font-medium whitespace-nowrap">
                      {res.reservation_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">{res.reservation_time}</td>
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {res.party_size} guests
                    </td>
                    <td className="py-3.5 px-4 text-outline max-w-[180px] truncate">
                      {res.special_requests || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(res.status)}`}>
                        {res.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRes(res);
                        }}
                        className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-semibold text-primary transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reservation Detail Drawer */}
      {activeRes && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setActiveRes(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-surface-container-high h-full shadow-2xl border-l border-outline-variant/40 flex flex-col justify-between overflow-y-auto p-6 sm:p-8 z-10 animate-in slide-in-from-right duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-outline font-semibold">Table Reservation</span>
                  <h3 className="text-xl font-mono font-bold text-primary mt-0.5">{activeRes.reservation_ref}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRes(null)}
                  className="p-2 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                  aria-label="Close drawer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Status and Action Buttons */}
              <div className="mb-6 p-4 rounded-2xl bg-surface-container border border-outline-variant/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-outline uppercase tracking-wider font-semibold">Booking Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(activeRes.status)}`}>
                    {activeRes.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
                  {activeRes.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'confirmed')}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow"
                      >
                        Confirm Booking
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'cancelled')}
                        className="py-2 px-3 rounded-xl bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 font-semibold text-xs transition-colors"
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
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow"
                      >
                        Mark Guests Seated
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(activeRes.id, 'no_show')}
                        className="py-2 px-3 rounded-xl bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 border border-amber-500/30 font-semibold text-xs transition-colors"
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
                      className="w-full py-2.5 px-3 rounded-xl bg-stone-700 hover:bg-stone-800 text-white font-semibold text-xs transition-colors shadow"
                    >
                      Complete Table Service
                    </button>
                  )}

                  {activeRes.status === 'completed' && (
                    <p className="text-[11px] text-emerald-400 font-semibold py-1">
                      ✔ Reservation completed and table freed.
                    </p>
                  )}

                  {activeRes.status === 'cancelled' && (
                    <p className="text-[11px] text-red-400 font-semibold py-1">
                      ✖ Reservation was cancelled.
                    </p>
                  )}

                  {activeRes.status === 'no_show' && (
                    <p className="text-[11px] text-amber-400 font-semibold py-1">
                      ⚠ Guest did not arrive for the reservation.
                    </p>
                  )}
                </div>
              </div>

              {/* Guest & Booking Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Guest</span>
                  <p className="text-xs font-bold text-on-surface mt-0.5">{activeRes.customer_name}</p>
                  <p className="text-xs text-primary font-mono mt-0.5">{activeRes.customer_phone}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Party Size</span>
                  <p className="text-xs font-bold text-on-surface mt-0.5">{activeRes.party_size} Guests</p>
                  <p className="text-[10px] text-outline mt-0.5">Booking ID: {activeRes.id.slice(0, 8)}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Scheduled Date</span>
                  <p className="text-xs font-bold text-on-surface mt-0.5">{activeRes.reservation_date}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Scheduled Time</span>
                  <p className="text-xs font-mono font-bold text-primary mt-0.5">{activeRes.reservation_time}</p>
                </div>
              </div>

              {/* Special Requests */}
              {activeRes.special_requests && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block mb-1">Guest Notes & Preferences</span>
                  <p className="leading-relaxed">{activeRes.special_requests}</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-outline-variant/30 mt-6 flex gap-3">
              <a
                href={`https://wa.me/91${activeRes.customer_phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(activeRes.customer_name)},%20regarding%20your%20table%20reservation%20${activeRes.reservation_ref}%20at%20The%20Café%20Barrackpore:`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                Message Guest
              </a>

              <button
                type="button"
                onClick={() => setActiveRes(null)}
                className="py-2.5 px-6 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/40 text-xs font-semibold text-on-surface transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationsManagement;
