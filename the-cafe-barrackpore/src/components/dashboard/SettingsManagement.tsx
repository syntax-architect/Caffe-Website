import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchRestaurantSettings, updateRestaurantSettings } from '../../services/dashboardService';
import { useNotification } from '../../hooks/useNotification';
import type { RestaurantSettings } from '../../types/dashboard';

export const SettingsManagement: React.FC = () => {
  const { isOwner } = useAuth();
  const { addNotification } = useNotification();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isOrderingEnabled, setIsOrderingEnabled] = useState(true);
  const [isBookingEnabled, setIsBookingEnabled] = useState(true);
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchRestaurantSettings()
      .then((data) => {
        if (!isMounted) return;
        setBusinessName(data.business_name);
        setPhone(data.phone);
        setAddress(data.address);
        setIsOrderingEnabled(data.is_ordering_enabled);
        setIsBookingEnabled(data.is_table_booking_enabled);
        setOpeningTime(data.opening_time);
        setClosingTime(data.closing_time);
        setBanner(data.announcement_banner || '');
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load settings:', err);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      addNotification('warning', 'Permission Denied', 'Only owners can update restaurant settings.');
      return;
    }

    setIsSaving(true);
    try {
      const updated: RestaurantSettings = {
        business_name: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        is_ordering_enabled: isOrderingEnabled,
        is_table_booking_enabled: isBookingEnabled,
        opening_time: openingTime.trim(),
        closing_time: closingTime.trim(),
        announcement_banner: banner.trim() || null,
      };

      const res = await updateRestaurantSettings(updated);
      if (res.success) {
        addNotification('success', 'Settings Saved', 'Operational parameters have been updated.');
      } else {
        addNotification('error', 'Update Failed', res.error || 'Failed to update settings.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-serif font-bold text-on-surface">Restaurant Settings & Operations</h2>
        <p className="text-xs text-outline mt-0.5">
          Configure business details, operational service toggles, working hours, and announcements.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-outline text-xs">Loading restaurant settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Service Toggles Card */}
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">Customer Service Toggles</h3>
            <p className="text-xs text-outline leading-relaxed">
              Instantly enable or disable online ordering or table reservations during rush hours or private events.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-on-surface">Online Ordering (QR & Web)</p>
                  <p className="text-[11px] text-outline mt-0.5">Allow customers to submit new food orders</p>
                </div>
                <input
                  type="checkbox"
                  checked={isOrderingEnabled}
                  disabled={!isOwner}
                  onChange={(e) => setIsOrderingEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-0 bg-surface-container"
                />
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-on-surface">Table Reservations</p>
                  <p className="text-[11px] text-outline mt-0.5">Accept online dining reservations</p>
                </div>
                <input
                  type="checkbox"
                  checked={isBookingEnabled}
                  disabled={!isOwner}
                  onChange={(e) => setIsBookingEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-0 bg-surface-container"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours & Contact */}
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">Operational Hours & Location</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1">
                  Opening Time
                </label>
                <input
                  type="text"
                  value={openingTime}
                  disabled={!isOwner}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1">
                  Closing Time
                </label>
                <input
                  type="text"
                  value={closingTime}
                  disabled={!isOwner}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1">
                  Restaurant Phone / WhatsApp Hotline
                </label>
                <input
                  type="text"
                  value={phone}
                  disabled={!isOwner}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1">
                  Business Legal Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  disabled={!isOwner}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  disabled={!isOwner}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Announcement Banner */}
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">Top Announcement Banner</h3>
            <p className="text-xs text-outline leading-relaxed">
              Display an alert or greeting at the top of the customer website (e.g. Festival Greetings or Holiday Timings).
            </p>

            <textarea
              rows={2}
              value={banner}
              disabled={!isOwner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="e.g. Join us this Sunday for live acoustic jazz and artisanal wood-fired pizzas."
              className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
            />

            {isOwner && (
              <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2.5 px-6 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all shadow"
                >
                  {isSaving ? 'Saving Settings...' : 'Save Restaurant Settings'}
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

export default SettingsManagement;
