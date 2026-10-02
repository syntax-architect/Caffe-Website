import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { fetchRestaurantSettings, updateRestaurantSettings } from '../../services/dashboardService';
import { RESTAURANT_PRESETS, PRESET_REGIONS } from '../../config/restaurantPresets';
import { getCountryTaxProfile } from '../../config/taxProfiles';
import { useNotification } from '../../hooks/useNotification';
import { checkPaymentHealth, sendTestPayment, type PaymentHealthStatus } from '../../services/paymentService';
import type { RestaurantSettings } from '../../types/dashboard';

export const SettingsManagement: React.FC = () => {
  const { user, isOwner } = useAuth();
  const { addNotification } = useNotification();
  const { updateRestaurantConfig } = useSiteConfig();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Form Fields - Operations
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isOrderingEnabled, setIsOrderingEnabled] = useState(true);
  const [isBookingEnabled, setIsBookingEnabled] = useState(true);
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [banner, setBanner] = useState('');

  // Form Fields - Localization & International
  const [country, setCountry] = useState('IN');
  const [currency, setCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [locale, setLocale] = useState('en-IN');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxMode, setTaxMode] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [taxLabel, setTaxLabel] = useState('GST');
  const [taxRatePercent, setTaxRatePercent] = useState('5.0');
  const [dietarySystem, setDietarySystem] = useState<'india' | 'international'>('india');
  const [primaryContactMethod, setPrimaryContactMethod] = useState<'whatsapp' | 'phone' | 'email'>('whatsapp');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Form Fields - Service Charge
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState('0');
  const [serviceChargeLabel, setServiceChargeLabel] = useState('Service Charge');
  const [serviceChargeTaxable, setServiceChargeTaxable] = useState(false);

  // Form Fields - Payment Architecture
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'razorpay' | 'none' | 'demo'>('none');
  const [paymentMode, setPaymentMode] = useState<'disabled' | 'online' | 'optional'>('disabled');
  const [allowPayAtCounter, setAllowPayAtCounter] = useState(true);
  const [healthStatus, setHealthStatus] = useState<PaymentHealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Tax Legal Note (informational)
  const [taxLegalNote, setTaxLegalNote] = useState('');

  const refreshPaymentHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const status = await checkPaymentHealth();
      setHealthStatus(status);
    } catch {
      // ignore
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleSendTestPayment = async () => {
    if (!isOwner || isSendingTest) return;
    setIsSendingTest(true);
    try {
      const res = await sendTestPayment(paymentProvider as any, 100, currency);
      if (res.success) {
        addNotification('success', 'Test Payment Sent', res.message || 'Test payment registered successfully.');
      } else {
        addNotification('error', 'Test Payment Failed', res.error || 'Failed to send test payment.');
      }
    } catch (err: any) {
      addNotification('error', 'Test Payment Error', err.message || 'Unexpected error.');
    } finally {
      setIsSendingTest(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchRestaurantSettings()
      .then((data) => {
        if (!isMounted) return;
        setBusinessName(data.business_name || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setIsOrderingEnabled(data.is_ordering_enabled ?? true);
        setIsBookingEnabled(data.is_table_booking_enabled ?? true);
        setOpeningTime(data.opening_time || '');
        setClosingTime(data.closing_time || '');
        setBanner(data.announcement_banner || '');

        // Localization fields
        setCountry(data.country || 'IN');
        setCurrency(data.currency || 'INR');
        setCurrencySymbol(data.currency_symbol || '₹');
        setLocale(data.locale || 'en-IN');
        setTimezone(data.timezone || 'Asia/Kolkata');
        setPhoneCountryCode(data.phone_country_code || '+91');
        setTaxEnabled(data.tax_enabled ?? true);
        setTaxMode(data.tax_mode || 'inclusive');
        setTaxLabel(data.tax_label || 'GST');
        setTaxRatePercent(((data.tax_rate ?? 0.05) * 100).toString());
        setDietarySystem(data.dietary_system || 'india');
        setPrimaryContactMethod(data.primary_contact_method || 'whatsapp');
        setEmail(data.email || '');
        setCity(data.city || '');
        setStateRegion(data.state_region || '');
        setPostalCode(data.postal_code || '');

        // Payment fields
        setPaymentsEnabled(data.payments_enabled ?? data.payment_enabled ?? false);
        setPaymentProvider((data.payment_provider as any) || 'none');
        setPaymentMode((data.payment_mode as any) || 'disabled');
        setAllowPayAtCounter(data.allow_pay_at_counter ?? true);

        refreshPaymentHealth();

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

  const applyCountryPreset = (presetKey: string) => {
    const preset = RESTAURANT_PRESETS[presetKey];
    if (!preset) return;

    // Apply localization preset
    setCountry(preset.country);
    setCurrency(preset.currency);
    setCurrencySymbol(preset.currencySymbol);
    setLocale(preset.locale);
    setTimezone(preset.timezone);
    setPhoneCountryCode(preset.phoneCountryCode);
    setDietarySystem(preset.dietarySystem);
    setPrimaryContactMethod(preset.primaryContactMethod);

    // Apply country-specific tax profile from the researched tax registry
    const taxProfile = getCountryTaxProfile(presetKey);
    setTaxEnabled(taxProfile.config.enabled);
    setTaxLabel(taxProfile.config.label);
    setTaxRatePercent((taxProfile.config.rate * 100).toString());
    setTaxMode(taxProfile.config.mode);
    setTaxLegalNote(taxProfile.legalNote);

    // Apply service charge from tax profile
    if (taxProfile.config.serviceCharge) {
      setServiceChargeEnabled(taxProfile.config.serviceCharge.enabled);
      setServiceChargeRate((taxProfile.config.serviceCharge.rate * 100).toString());
      setServiceChargeLabel(taxProfile.config.serviceCharge.label);
      setServiceChargeTaxable(taxProfile.config.serviceCharge.taxable);
    } else {
      setServiceChargeEnabled(false);
      setServiceChargeRate('0');
    }

    if (!city || city === 'Barrackpore') setCity(preset.addressSample.city);
    if (!stateRegion || stateRegion === 'West Bengal') setStateRegion(preset.addressSample.region);
    if (!postalCode || postalCode === '700120') setPostalCode(preset.addressSample.postalCode);

    if (preset.payments) {
      setPaymentsEnabled(preset.payments.enabled);
      setPaymentProvider(preset.payments.provider as any);
      setPaymentMode(preset.payments.mode);
      setAllowPayAtCounter(preset.payments.allow_pay_at_counter ?? true);
    }

    addNotification('info', `Preset Applied: ${preset.name}`, `Loaded ${taxProfile.config.label} ${taxProfile.config.rate > 0 ? (taxProfile.config.rate * 100) + '%' : ''} tax config for ${preset.name}.`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      addNotification('warning', 'Permission Denied', 'Only owners can update restaurant settings.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedTaxRate = parseFloat(taxRatePercent) / 100;
      const validTaxRate = isNaN(parsedTaxRate) || parsedTaxRate < 0 ? 0.05 : parsedTaxRate;

      const updated: RestaurantSettings = {
        business_name: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        is_ordering_enabled: isOrderingEnabled,
        is_table_booking_enabled: isBookingEnabled,
        opening_time: openingTime.trim(),
        closing_time: closingTime.trim(),
        announcement_banner: banner.trim() || null,
        country: country.trim(),
        currency: currency.trim(),
        currency_symbol: currencySymbol.trim(),
        locale: locale.trim(),
        timezone: timezone.trim(),
        phone_country_code: phoneCountryCode.trim(),
        tax_enabled: taxEnabled,
        tax_mode: taxMode,
        tax_label: taxLabel.trim(),
        tax_rate: validTaxRate,
        dietary_system: dietarySystem,
        primary_contact_method: primaryContactMethod,
        email: email.trim() || null,
        city: city.trim() || null,
        state_region: stateRegion.trim() || null,
        postal_code: postalCode.trim() || null,
        payment_enabled: paymentsEnabled,
        payments_enabled: paymentsEnabled,
        payment_provider: paymentProvider,
        payment_mode: paymentMode,
        allow_pay_at_counter: allowPayAtCounter,
        service_charge_enabled: serviceChargeEnabled,
        service_charge_rate: parseFloat(serviceChargeRate) / 100 || 0,
        service_charge_label: serviceChargeLabel.trim() || 'Service Charge',
        service_charge_taxable: serviceChargeTaxable,
        service_charge_optional: false,
      };

      const res = await updateRestaurantSettings(updated);
      if (res.success) {
        const parsedScRate = parseFloat(serviceChargeRate) / 100 || 0;
        await updateRestaurantConfig({
          country: updated.country,
          businessName: updated.business_name,
          currency: updated.currency,
          currencySymbol: updated.currency_symbol,
          locale: updated.locale,
          timezone: updated.timezone,
          phoneCountryCode: updated.phone_country_code,
          openingTime: updated.opening_time,
          closingTime: updated.closing_time,
          isOrderingEnabled: updated.is_ordering_enabled,
          isTableBookingEnabled: updated.is_table_booking_enabled,
          announcementBanner: updated.announcement_banner,
          tax: {
            enabled: updated.tax_enabled ?? true,
            mode: updated.tax_mode || 'inclusive',
            label: updated.tax_label || 'GST',
            rate: updated.tax_rate ?? 0.05,
            serviceCharge: serviceChargeEnabled ? {
              enabled: true,
              label: serviceChargeLabel.trim() || 'Service Charge',
              rate: parsedScRate,
              taxable: serviceChargeTaxable,
              optional: false,
            } : undefined,
          },
          dietary: {
            system: updated.dietary_system || 'india',
          },
          contact: {
            primaryMethod: updated.primary_contact_method || 'whatsapp',
            phone: updated.phone,
            displayPhone: updated.phone,
            whatsapp: updated.phone,
            email: updated.email || 'contact@thecafe.com',
          },
          address: {
            line1: updated.address,
            city: updated.city || '',
            region: updated.state_region || '',
            postalCode: updated.postal_code || '',
            country: updated.country === 'IN' ? 'India' : updated.country || '',
          },
          payments: {
            enabled: paymentsEnabled,
            provider: paymentProvider,
            mode: paymentMode,
            payments_enabled: paymentsEnabled,
            allow_pay_at_counter: allowPayAtCounter,
          },
        });

        await refreshPaymentHealth();
        addNotification('success', 'Settings Saved', 'Operational and payment gateway settings updated.');
      } else {
        addNotification('error', 'Update Failed', res.error || 'Failed to update settings.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      addNotification('error', 'Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      addNotification('error', 'Validation Error', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      addNotification('error', 'Validation Error', 'Passwords do not match. Please verify both fields.');
      return;
    }
    if (!supabase || !isSupabaseConfigured) {
      addNotification('error', 'Service Unavailable', 'Authentication service is not configured.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        addNotification('error', 'Password Change Failed', error.message);
      } else {
        addNotification('success', 'Password Updated', 'Your security password has been changed successfully.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      addNotification('error', 'Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Master Command & Localization Hub
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Restaurant Configuration
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Configure global localization presets, live dining and ordering toggles, digital payment gateways, and operational hours.
          </p>
        </div>

        {isOwner && (
          <div className="px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>Proprietor Authorized</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 font-mono text-xs">Loading operational manifest...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: MASTER SERVICE TOGGLES */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Operational Gates
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white mt-0.5">Master Service Switches</h3>
                </div>
                <span className="text-xs text-zinc-500 font-mono">Immediate live effect</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Online Ordering Toggle */}
                <div
                  onClick={() => isOwner && setIsOrderingEnabled(!isOrderingEnabled)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isOrderingEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-white/[0.02] border-white/[0.06] opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                        isOrderingEnabled ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Online Ordering (QR & Web)</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {isOrderingEnabled ? 'Accepting guest orders actively' : 'Ordering paused across portal'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isOrderingEnabled}
                    disabled={!isOwner}
                    onChange={(e) => setIsOrderingEnabled(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                {/* Table Reservations Toggle */}
                <div
                  onClick={() => isOwner && setIsBookingEnabled(!isBookingEnabled)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isBookingEnabled
                      ? 'bg-sky-950/20 border-sky-500/30 hover:border-sky-500/50'
                      : 'bg-white/[0.02] border-white/[0.06] opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                        isBookingEnabled ? 'bg-sky-400 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'bg-zinc-600'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Table Reservations</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {isBookingEnabled ? 'Accepting booking requests' : 'Reservations closed for rush hour'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isBookingEnabled}
                    disabled={!isOwner}
                    onChange={(e) => setIsBookingEnabled(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: GLOBAL LOCALIZATION & COUNTRY PRESETS */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Global Standards
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white mt-0.5">
                    International Localization & Presets
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Select a national deployment preset to configure currency, tax rules, and local address standards.
                  </p>
                </div>
              </div>

              {/* Interactive Country Preset Selector — 20 Markets */}
              {isOwner && (
                <div className="space-y-4 pt-1">
                  {Object.entries(PRESET_REGIONS).map(([regionName, countryCodes]) => (
                    <div key={regionName}>
                      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-2">
                        {regionName}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                        {countryCodes.map((code) => {
                          const preset = RESTAURANT_PRESETS[code];
                          if (!preset) return null;
                          const isSelected = country === code;
                          const flagMap: Record<string, string> = {
                            IN: '🇮🇳', AU: '🇦🇺', NZ: '🇳🇿', SG: '🇸🇬', JP: '🇯🇵', TH: '🇹🇭',
                            US: '🇺🇸', CA: '🇨🇦', MX: '🇲🇽',
                            GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', NL: '🇳🇱', TR: '🇹🇷',
                            AE: '🇦🇪', SA: '🇸🇦', QA: '🇶🇦', ZA: '🇿🇦',
                          };
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => applyCountryPreset(code)}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-gradient-to-b from-[#D4AF37]/20 to-[#D4AF37]/5 border-[#D4AF37] shadow-[0_4px_20px_rgba(212,175,55,0.2)]'
                                  : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-zinc-400 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xl">{flagMap[code] || '🏳️'}</span>
                                <span
                                  className={`font-mono text-xs font-bold ${
                                    isSelected ? 'text-[#D4AF37]' : 'text-zinc-500'
                                  }`}
                                >
                                  {preset.currencySymbol}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white truncate">{preset.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                  {preset.taxLabel} {preset.taxRate > 0 ? `${Math.round(preset.taxRate * 100)}%` : ''}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Localization Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Country Code (ISO 3166)
                  </label>
                  <input
                    type="text"
                    value={country}
                    disabled={!isOwner}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Currency Code (ISO 4217)
                  </label>
                  <input
                    type="text"
                    value={currency}
                    disabled={!isOwner}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currencySymbol}
                    disabled={!isOwner}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Display Locale
                  </label>
                  <input
                    type="text"
                    value={locale}
                    disabled={!isOwner}
                    onChange={(e) => setLocale(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Restaurant Timezone (IANA)
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    disabled={!isOwner}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Default Calling Code
                  </label>
                  <input
                    type="text"
                    value={phoneCountryCode}
                    disabled={!isOwner}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Tax Engine Configuration */}
              <div className="pt-6 border-t border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Tax Engine & Calculation Rules</h4>
                    <p className="text-[11px] text-zinc-400">Apply inclusive VAT/GST or checkout sales tax addition.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="tax-active-toggle" className="text-xs text-zinc-400 font-mono">Tax Active</label>
                    <input
                      id="tax-active-toggle"
                      type="checkbox"
                      checked={taxEnabled}
                      disabled={!isOwner}
                      onChange={(e) => setTaxEnabled(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#D4AF37] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Display Mode
                    </label>
                    <select
                      value={taxMode}
                      disabled={!isOwner}
                      onChange={(e) => setTaxMode(e.target.value as 'inclusive' | 'exclusive')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="inclusive" className="bg-[#120F0D]">Inclusive (Prices already include tax)</option>
                      <option value="exclusive" className="bg-[#120F0D]">Exclusive (Added at guest checkout)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Tax Label
                    </label>
                    <input
                      type="text"
                      value={taxLabel}
                      disabled={!isOwner}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="GST, VAT, Sales Tax"
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={taxRatePercent}
                      disabled={!isOwner}
                      onChange={(e) => setTaxRatePercent(e.target.value)}
                      placeholder="5.0"
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Tax Legal Advisory Note */}
                {taxLegalNote && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 text-xs mt-0.5">⚖</span>
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 font-bold mb-1">Tax Advisory</p>
                        <p className="text-[11px] text-amber-200/70 leading-relaxed">{taxLegalNote}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge Configuration */}
              <div className="pt-6 border-t border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Service Charge</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Common in Singapore (10%), UAE (10%), France (15%), Thailand (10%)
                    </p>
                  </div>
                  <div
                    onClick={() => isOwner && setServiceChargeEnabled(!serviceChargeEnabled)}
                    className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ${
                      serviceChargeEnabled ? 'bg-[#D4AF37]' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        serviceChargeEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {serviceChargeEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        Service Charge Label
                      </label>
                      <input
                        type="text"
                        value={serviceChargeLabel}
                        disabled={!isOwner}
                        onChange={(e) => setServiceChargeLabel(e.target.value)}
                        placeholder="Service Charge"
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={serviceChargeRate}
                        disabled={!isOwner}
                        onChange={(e) => setServiceChargeRate(e.target.value)}
                        placeholder="10"
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={serviceChargeTaxable}
                          disabled={!isOwner}
                          onChange={(e) => setServiceChargeTaxable(e.target.checked)}
                          className="w-4 h-4 rounded accent-[#D4AF37] cursor-pointer"
                        />
                        <span className="text-xs text-zinc-300">Taxable (tax applies on service charge)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Dietary & Concierge Preferences */}
              <div className="pt-6 border-t border-white/[0.06] space-y-4">
                <h4 className="font-bold text-white text-sm">Dietary Presentation & Guest Channel</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Dietary Standard
                    </label>
                    <select
                      value={dietarySystem}
                      disabled={!isOwner}
                      onChange={(e) => setDietarySystem(e.target.value as 'india' | 'international')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="india" className="bg-[#120F0D]">Indian Standard (FSSAI Veg/Non-Veg Dot Symbols)</option>
                      <option value="international" className="bg-[#120F0D]">International Standard (Vegan & Dietary Badges)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Primary Customer Concierge Channel
                    </label>
                    <select
                      value={primaryContactMethod}
                      disabled={!isOwner}
                      onChange={(e) => setPrimaryContactMethod(e.target.value as 'whatsapp' | 'phone' | 'email')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="whatsapp" className="bg-[#120F0D]">WhatsApp Concierge (Instant Chat Dispatch)</option>
                      <option value="phone" className="bg-[#120F0D]">Voice Phone Hotline (Telephone Dispatch)</option>
                      <option value="email" className="bg-[#120F0D]">Email Concierge (Formal Confirmations)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: PAYMENT ARCHITECTURE & CHECKOUT */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Transaction Gateway
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white mt-0.5">
                    Payment Architecture & Checkout
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure customer digital payments via Razorpay (India UPI/cards) or Stripe (Global). Edge Function secrets hold all API credentials securely.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor="payment-enabled-toggle" className="text-xs text-zinc-400 font-mono">
                    Payments Active
                  </label>
                  <input
                    id="payment-enabled-toggle"
                    type="checkbox"
                    checked={paymentsEnabled}
                    disabled={!isOwner}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setPaymentsEnabled(checked);
                      if (!checked) setPaymentMode('disabled');
                      else if (paymentMode === 'disabled') setPaymentMode('online');
                    }}
                    className="w-5 h-5 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>
              </div>

              {/* Gateway Health & Connection Status */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Gateway Status:</span>
                    {paymentProvider === 'none' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        Disabled (None)
                      </span>
                    ) : paymentProvider === 'demo' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-950/40 text-amber-300 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Simulator Active (Dev Only)
                      </span>
                    ) : healthStatus?.providers[paymentProvider]?.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-950/40 text-rose-300 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        Not connected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCheckingHealth}
                      onClick={refreshPaymentHealth}
                      className="px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Check gateway secrets presence in Supabase Edge Functions"
                    >
                      <span className={`material-symbols-outlined text-sm ${isCheckingHealth ? 'animate-spin' : ''}`}>
                        refresh
                      </span>
                      {isCheckingHealth ? 'Checking...' : 'Check Status'}
                    </button>

                    <button
                      type="button"
                      disabled={!isOwner || isSendingTest || paymentProvider === 'none'}
                      onClick={handleSendTestPayment}
                      className="px-3.5 py-1.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-xs text-[#D4AF37] font-mono font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Simulate a small test payment to verify edge functions"
                    >
                      <span className={`material-symbols-outlined text-sm ${isSendingTest ? 'animate-spin' : ''}`}>
                        {isSendingTest ? 'progress_activity' : 'send'}
                      </span>
                      {isSendingTest ? 'Sending...' : 'Send Test Payment'}
                    </button>
                  </div>
                </div>

                {/* Secret Presence Details (Booleans Only - Zero Secret Leakage) */}
                {paymentProvider === 'razorpay' && (
                  <div className="pt-2 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">RAZORPAY_KEY_ID:</span>
                      <span className={healthStatus?.providers.razorpay.hasKeyId ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.razorpay.hasKeyId ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">RAZORPAY_KEY_SECRET:</span>
                      <span className={healthStatus?.providers.razorpay.hasKeySecret ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.razorpay.hasKeySecret ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">WEBHOOK_SECRET:</span>
                      <span className={healthStatus?.providers.razorpay.hasWebhookSecret ? 'text-emerald-400' : 'text-amber-400'}>
                        {healthStatus?.providers.razorpay.hasWebhookSecret ? '✓ Configured' : '○ Optional'}
                      </span>
                    </div>
                  </div>
                )}

                {paymentProvider === 'stripe' && (
                  <div className="pt-2 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">STRIPE_SECRET_KEY:</span>
                      <span className={healthStatus?.providers.stripe.hasSecretKey ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.stripe.hasSecretKey ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">STRIPE_WEBHOOK_SECRET:</span>
                      <span className={healthStatus?.providers.stripe.hasWebhookSecret ? 'text-emerald-400' : 'text-amber-400'}>
                        {healthStatus?.providers.stripe.hasWebhookSecret ? '✓ Configured' : '○ Optional'}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-zinc-500 font-mono">
                  🔒 Security Policy: Secret keys live strictly in Supabase Edge Function secrets. They are never stored in the database or returned to the browser.
                </p>
              </div>

              {/* Provider Selection Cards */}
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-2">
                  Active Payment Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'none', title: 'None / Counter Only', sub: 'In-person cash or counter payment', icon: 'money_off' },
                    { id: 'razorpay', title: 'Razorpay', sub: 'India UPI, Net Banking & Wallets', icon: 'account_balance' },
                    { id: 'stripe', title: 'Stripe', sub: 'Global Cards, Apple & Google Pay', icon: 'credit_card' },
                    ...(import.meta.env.DEV ? [{ id: 'demo', title: 'Demo Simulator', sub: 'Local Testing & Dev Demonstration', icon: 'science' }] : []),
                  ].map((p) => {
                    const isSelected = paymentProvider === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => isOwner && setPaymentProvider(p.id as any)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-b from-[#D4AF37]/20 to-[#D4AF37]/5 border-[#D4AF37] shadow-[0_4px_20px_rgba(212,175,55,0.2)]'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={`material-symbols-outlined text-2xl ${isSelected ? 'text-[#D4AF37]' : 'text-zinc-500'}`}>
                            {p.icon}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]' : 'bg-transparent'}`} />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{p.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{p.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Allow Pay At Counter Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                <div>
                  <h4 className="font-bold text-white text-sm">Allow Pay at Counter</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Permits guests to settle with cash or card at the counter/table, and provides a recovery option if an online payment fails.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowPayAtCounter}
                  disabled={!isOwner}
                  onChange={(e) => setAllowPayAtCounter(e.target.checked)}
                  className="w-5 h-5 rounded accent-[#D4AF37] cursor-pointer"
                />
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Checkout Requirement Policy
                </label>
                <select
                  value={paymentMode}
                  disabled={!isOwner}
                  onChange={(e) => setPaymentMode(e.target.value as 'disabled' | 'online' | 'optional')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="disabled" className="bg-[#120F0D]">Disabled (Pay at counter / manual verification only)</option>
                  <option value="online" className="bg-[#120F0D]">Online Required (Customer must complete digital payment)</option>
                  <option value="optional" className="bg-[#120F0D]">Optional (Customer chooses Pay Online or Pay at Counter)</option>
                </select>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  In optional mode, customers can pay via UPI/Card immediately or pay the server at the counter/table upon delivery.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: OPERATING HOURS & LOCATION */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                Premises & Hours
              </span>
              <h3 className="font-serif text-lg font-bold text-white">Operational Hours & Location</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Opening Time
                  </label>
                  <input
                    type="text"
                    value={openingTime}
                    disabled={!isOwner}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    placeholder="e.g. 11:00 AM"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Closing Time
                  </label>
                  <input
                    type="text"
                    value={closingTime}
                    disabled={!isOwner}
                    onChange={(e) => setClosingTime(e.target.value)}
                    placeholder="e.g. 11:00 PM"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Restaurant Phone / WhatsApp Hotline
                  </label>
                  <input
                    type="text"
                    value={phone}
                    disabled={!isOwner}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Business Legal Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    disabled={!isOwner}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    disabled={!isOwner}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    City / Locality
                  </label>
                  <input
                    type="text"
                    value={city}
                    disabled={!isOwner}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Barrackpore, London, New York"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    State / Province / Region
                  </label>
                  <input
                    type="text"
                    value={stateRegion}
                    disabled={!isOwner}
                    onChange={(e) => setStateRegion(e.target.value)}
                    placeholder="e.g. West Bengal, NY, Ontario"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Postal / ZIP Code
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    disabled={!isOwner}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Concierge / Support Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled={!isOwner}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. concierge@thecafe.com"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: ANNOUNCEMENT BANNER */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                Customer Notice
              </span>
              <h3 className="font-serif text-lg font-bold text-white">Top Announcement Banner</h3>
              <p className="text-xs text-zinc-400">
                Display a priority announcement at the very top of the customer website.
              </p>

              <textarea
                rows={2}
                value={banner}
                disabled={!isOwner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="e.g. Special weekend degustation menu featuring artisanal wood-fired sourdough pizzas."
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] resize-none"
              />
            </div>
          </div>

          {/* SECTION 6: SECURITY & PASSWORD MANAGEMENT */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Security Credentials
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white mt-0.5">Change Staff Password</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
                  <span className="material-symbols-outlined text-sm text-emerald-400">shield</span>
                  <span>{user?.email || 'Logged In Account'}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Update your personal staff access password. Passwords must be at least 6 characters long.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    New Security Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      disabled={isUpdatingPassword}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white transition-colors"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={isUpdatingPassword}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-md"
                >
                  {isUpdatingPassword ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#070605] border-t-transparent rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* STICKY SAVE BAR */}
          {isOwner && (
            <div className="sticky bottom-4 z-30 p-1 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
              <div className="p-3 sm:p-4 rounded-[calc(1rem-0.125rem)] bg-[#070605] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-zinc-300">
                    Proprietor authentication verified &amp; ready to commit
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_10px_25px_rgba(212,175,55,0.4)] active:scale-95 transition-all cursor-pointer"
                >
                  {isSaving ? 'Committing Changes...' : 'Save Restaurant Settings'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default SettingsManagement;
