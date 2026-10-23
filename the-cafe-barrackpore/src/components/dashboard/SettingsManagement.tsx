import { useI18n } from '../../i18n';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { fetchRestaurantSettings, updateRestaurantSettings } from '../../services/dashboardService';
import { RESTAURANT_PRESETS, PRESET_REGIONS } from '../../config/restaurantPresets';
import { getCountryTaxProfile } from '../../config/taxProfiles';
import { useNotification } from '../../hooks/useNotification';
import { checkPaymentHealth, sendTestPayment, type PaymentHealthStatus } from '../../services/paymentService';
import type { RestaurantSettings, RestaurantFeatureFlags } from '../../types/dashboard';
import { DEFAULT_FEATURE_FLAGS } from '../../types/dashboard';
import { PrinterSettingsSection } from './PrinterSettingsSection';
import { getLocaleForCountry } from '../../utils/currency';

const FEATURE_METADATA: Record<keyof RestaurantFeatureFlags, { label: string; desc: string; icon: string }> = {
  online_ordering: { label: 'Online Ordering', desc: 'Allows customers to order via the website', icon: 'shopping_cart' },
  delivery: { label: 'Home Delivery', desc: 'Accept customer delivery addresses and delivery fees', icon: 'moped' },
  takeaway: { label: 'Takeaway / Pickup', desc: 'Package orders for customer pickup at counter', icon: 'takeout_dining' },
  qr_table_ordering: { label: 'QR Table Ordering', desc: 'Dine-in guests order directly from table QR codes', icon: 'qr_code_scanner' },
  reservations: { label: 'Table Reservations', desc: 'Guest booking system and reservation roster', icon: 'event_seat' },
  kds: { label: 'Kitchen Display System (KDS)', desc: 'Real-time kitchen order ticket display and bump screen', icon: 'soup_kitchen' },
  pos: { label: 'POS Terminal', desc: 'Counter billing, table management, and order taking', icon: 'point_of_sale' },
  running_table_bills: { label: 'Running Table Bills', desc: 'Keep open dining table tabs and add items incrementally', icon: 'receipt' },
  split_bills: { label: 'Split Bills', desc: 'Split customer bills by seats or equal shares', icon: 'call_split' },
  cash_drawer: { label: 'Cash Drawer & Shifts', desc: 'Track opening float, cash in/out, and Z-report balancing', icon: 'payments' },
  kot_printing: { label: 'KOT & Thermal Printing', desc: 'Print 58mm/80mm kitchen tickets and guest receipts', icon: 'print' },
  discounts: { label: 'Discounts & Happy Hours', desc: 'Promotional discount codes and scheduled discounts', icon: 'local_offer' },
  tips: { label: 'Customer Tipping', desc: 'Accept server tips on checkout and bill settlement', icon: 'volunteer_activism' },
  vip_club: { label: 'VIP Club', desc: 'Guest loyalty program and exclusive member perks', icon: 'workspace_premium' },
  online_payments: { label: 'Online Card Payments', desc: 'Process Stripe & online payment gateways', icon: 'credit_card' },
  specials_banner: { label: "Chef's Specials Banner", desc: 'Display curated chef specials on homepage', icon: 'stars' },
  gallery: { label: 'Moments Photo Gallery', desc: 'Showcase ambiance and food gallery on website', icon: 'photo_library' },
  language_switcher: { label: 'Multi-Language Switcher', desc: 'Support international language translation selector', icon: 'translate' },
};

export const SettingsManagement: React.FC = () => {
  const { t } = useI18n(); void t;
  const { user, isOwner } = useAuth();
  const { addNotification } = useNotification();
  const { restaurantConfig, updateRestaurantConfig } = useSiteConfig();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'features' | 'operations' | 'localization' | 'payments' | 'printers'>('all');

  const [features, setFeatures] = useState<RestaurantFeatureFlags>(() => {
    return restaurantConfig?.features || DEFAULT_FEATURE_FLAGS;
  });

  const handleToggleFeature = async (key: keyof RestaurantFeatureFlags) => {
    if (!isOwner) return;
    const nextVal = !features[key];
    const updatedFeatures = { ...features, [key]: nextVal };
    if (key === 'online_ordering') setIsOrderingEnabled(nextVal);
    if (key === 'reservations') setIsBookingEnabled(nextVal);
    if (key === 'online_payments') setPaymentsEnabled(nextVal);

    setFeatures(updatedFeatures);
    await updateRestaurantConfig({
      features: updatedFeatures,
      isOrderingEnabled: key === 'online_ordering' ? nextVal : isOrderingEnabled,
      isTableBookingEnabled: key === 'reservations' ? nextVal : isBookingEnabled,
    });
    addNotification('info', `Feature Updated`, `${FEATURE_METADATA[key]?.label || key} is now ${nextVal ? 'ENABLED' : 'DISABLED'}.`);
  };

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
  const [locale, setLocale] = useState(() => getLocaleForCountry('IN', 'INR'));
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxMode, setTaxMode] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [taxLabel, setTaxLabel] = useState('GST');
  const [taxRatePercent, setTaxRatePercent] = useState('0.0');
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

  // Owner Notifications & Customer Engagement
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [ownerNotificationPhone, setOwnerNotificationPhone] = useState('');
  const [ownerNotificationEmail, setOwnerNotificationEmail] = useState('');
  const [ownerNotificationMethod, setOwnerNotificationMethod] = useState<'email' | 'whatsapp' | 'both' | 'none'>('none');
  const [lowStockAlertThreshold, setLowStockAlertThreshold] = useState('5');

  // Custom Country Setup Wizard State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCountryCode, setCustomCountryCode] = useState('');
  const [customCountryName, setCustomCountryName] = useState('');
  const [customCurrency, setCustomCurrency] = useState('');
  const [customCurrencySymbol, setCustomCurrencySymbol] = useState('');
  const [customCurrencyDecimals, setCustomCurrencyDecimals] = useState('2');
  const [customTaxRate, setCustomTaxRate] = useState('10.0');
  const [customTaxMode, setCustomTaxMode] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [customFoodRate, setCustomFoodRate] = useState('');
  const [customAlcoholRate, setCustomAlcoholRate] = useState('');
  const [customTaxLabel, setCustomTaxLabel] = useState('VAT');
  const [customTaxIdLabel, setCustomTaxIdLabel] = useState('VAT ID');
  const [customTaxIdFormat, setCustomTaxIdFormat] = useState('');
  const [customServiceCharge, setCustomServiceCharge] = useState('0');
  const [customServiceChargeTaxable, setCustomServiceChargeTaxable] = useState(false);
  const [customAccountantName, setCustomAccountantName] = useState('');
  const [customAccountantLicense, setCustomAccountantLicense] = useState('');
  const [customAccountantConfirmed, setCustomAccountantConfirmed] = useState(false);

  const handleSaveCustomCountry = () => {
    if (!customCountryCode || !customCountryName) return;
    setCountry(customCountryCode.toUpperCase());
    setCurrency(customCurrency || 'USD');
    setCurrencySymbol(customCurrencySymbol || '$');
    setTaxLabel(customTaxLabel || 'Tax');
    setTaxRatePercent(customTaxRate || '0');
    setTaxMode(customTaxMode);
    setShowCustomModal(false);
    addNotification('success', 'Custom Country Applied', `Custom profile for ${customCountryName} applied.`);
  };

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
        setLocale(data.locale || getLocaleForCountry(data.country, data.currency));
        setTimezone(data.timezone || 'Asia/Kolkata');
        setPhoneCountryCode(data.phone_country_code || '+91');
        setTaxEnabled(data.tax_enabled ?? true);
        setTaxMode(data.tax_mode || 'inclusive');
        setTaxLabel(data.tax_label || 'GST');
        setTaxRatePercent(((data.tax_rate ?? 0.0) * 100).toString());
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

        // Owner notification & engagement fields
        setGoogleReviewLink(data.google_review_link || '');
        setOwnerNotificationPhone(data.owner_notification_phone || data.phone || '');
        setOwnerNotificationEmail(data.owner_notification_email || data.email || '');
        setOwnerNotificationMethod(data.owner_notification_method || 'none');
        setLowStockAlertThreshold(String(data.low_stock_alert_threshold ?? 5));

        refreshPaymentHealth();

        if (data.features) {
          setFeatures({ ...DEFAULT_FEATURE_FLAGS, ...data.features });
        }

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
        google_review_link: googleReviewLink.trim() || null,
        owner_notification_phone: ownerNotificationPhone.trim() || null,
        owner_notification_email: ownerNotificationEmail.trim() || null,
        owner_notification_method: ownerNotificationMethod,
        low_stock_alert_threshold: parseInt(lowStockAlertThreshold, 10) || 5,
        features: features,
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
          features: features,
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
            <span>{t('staff.dashboard.proprietor_authorized', 'Proprietor Authorized')}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 font-mono text-xs">{t('staff.dashboard.loading_operational_manifest', 'Loading operational manifest...')}</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* SETTINGS SUBTABS (Direct navigation to Features, Localization, etc.) */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              All Settings
            </button>
            <button
              type="button"
              data-testid="tab-features"
              onClick={() => setActiveTab('features')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                activeTab === 'features'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">toggle_on</span>
              <span>{t('staff.dashboard.features_18_toggles', 'Features (18 Toggles)')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'operations'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Operations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('localization')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'localization'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Localization & Tax
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'payments'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Payments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('printers')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'printers'
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Thermal Printers
            </button>
          </div>

          {/* SECTION: MODULAR FEATURE TOGGLES (18 CAPABILITIES) */}
          {(activeTab === 'all' || activeTab === 'features') && (
            <div id="features-section" className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
              <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                      Settings &gt; Features
                    </span>
                    <h3 className="font-serif text-lg font-bold text-white mt-0.5">
                      Modular Feature Switchboard (18 Capabilities)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-mono">
                      {Object.values(features).filter(Boolean).length} / 18 Active
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                      Zero-Downtime Hot Toggle
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Toggle individual restaurant capabilities on or off with immediate cross-tab effect. When a feature is disabled, its navigation routes and customer buttons hide instantly, and open operations remain safely protected.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {(Object.keys(FEATURE_METADATA) as Array<keyof RestaurantFeatureFlags>).map((key) => {
                    const meta = FEATURE_METADATA[key];
                    const isEnabled = features[key];
                    return (
                      <div
                        key={key}
                        data-testid={`feature-card-${key}`}
                        onClick={() => handleToggleFeature(key)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isEnabled
                            ? 'bg-[#181310] border-[#D4AF37]/30 hover:border-[#D4AF37]/60 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                            : 'bg-white/[0.015] border-white/[0.05] opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isEnabled
                                ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white tracking-wide">{meta.label}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{meta.desc}</p>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            data-testid={`feature-toggle-${key}`}
                            checked={isEnabled}
                            disabled={!isOwner}
                            onChange={() => handleToggleFeature(key)}
                            className="sr-only peer"
                          />
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              isEnabled ? 'bg-[#D4AF37]' : 'bg-zinc-700'
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                isEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: MASTER SERVICE TOGGLES */}
          {(activeTab === 'all' || activeTab === 'operations') && (
            <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
              <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                      Operational Gates
                    </span>
                    <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.master_service_switches', 'Master Service Switches')}</h3>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{t('staff.dashboard.immediate_live_effect', 'Immediate live effect')}</span>
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
                      <p className="text-sm font-bold text-white">{t('staff.dashboard.online_ordering_qr_web', 'Online Ordering (QR & Web)')}</p>
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
                      <p className="text-sm font-bold text-white">{t('staff.dashboard.table_reservations', 'Table Reservations')}</p>
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
          )}

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
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>{t('staff.dashboard.custom_country_setup_wizard', '+ Custom Country Setup Wizard')}</span>
                  </button>
                )}
              </div>

              {/* Interactive Country Preset Selector — 44 Markets */}
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
                            IE: '🇮🇪', GB: '🇬🇧', US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺', NZ: '🇳🇿', SG: '🇸🇬', AE: '🇦🇪',
                            DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', PT: '🇵🇹', BE: '🇧🇪', AT: '🇦🇹',
                            SE: '🇸🇪', DK: '🇩🇰', NO: '🇳🇴', CH: '🇨🇭', PL: '🇵🇱',
                            IN: '🇮🇳', JP: '🇯🇵', KR: '🇰🇷', TH: '🇹🇭', MY: '🇲🇾', ID: '🇮🇩', PH: '🇵🇭', VN: '🇻🇳',
                            HK: '🇭🇰', SA: '🇸🇦', QA: '🇶🇦', KW: '🇰🇼', BH: '🇧🇭', TR: '🇹🇷', IL: '🇮🇱',
                            ZA: '🇿🇦', NG: '🇳🇬', KE: '🇰🇪', EG: '🇪🇬', MX: '🇲🇽', BR: '🇧🇷', CL: '🇨🇱', CO: '🇨🇴',
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
                    <h4 className="font-bold text-white text-sm">{t('staff.dashboard.tax_engine_calculation_rules', 'Tax Engine & Calculation Rules')}</h4>
                    <p className="text-[11px] text-zinc-400">{t('staff.dashboard.apply_inclusive_vat_gst_or_che', 'Apply inclusive VAT/GST or checkout sales tax addition.')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="tax-active-toggle" className="text-xs text-zinc-400 font-mono">{t('staff.dashboard.tax_active', 'Tax Active')}</label>
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
                      <option value="inclusive" className="bg-[#120F0D]">{t('staff.dashboard.inclusive_prices_already_inclu', 'Inclusive (Prices already include tax)')}</option>
                      <option value="exclusive" className="bg-[#120F0D]">{t('staff.dashboard.exclusive_added_at_guest_check', 'Exclusive (Added at guest checkout)')}</option>
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
                      placeholder={t('staff.dashboard.gst_vat_sales_tax', 'GST, VAT, Sales Tax')}
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
                        <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 font-bold mb-1">{t('staff.dashboard.tax_advisory', 'Tax Advisory')}</p>
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
                    <h4 className="font-bold text-white text-sm">{t('staff.dashboard.service_charge', 'Service Charge')}</h4>
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
                        placeholder={t('staff.dashboard.service_charge', 'Service Charge')}
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
                        <span className="text-xs text-zinc-300">{t('staff.dashboard.taxable_tax_applies_on_service', 'Taxable (tax applies on service charge)')}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Dietary & Concierge Preferences */}
              <div className="pt-6 border-t border-white/[0.06] space-y-4">
                <h4 className="font-bold text-white text-sm">{t('staff.dashboard.dietary_presentation_guest_cha', 'Dietary Presentation & Guest Channel')}</h4>
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
                      <option value="india" className="bg-[#120F0D]">{t('staff.dashboard.indian_standard_fssai_veg_non_', 'Indian Standard (FSSAI Veg/Non-Veg Dot Symbols)')}</option>
                      <option value="international" className="bg-[#120F0D]">{t('staff.dashboard.international_standard_vegan_d', 'International Standard (Vegan & Dietary Badges)')}</option>
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
                      <option value="whatsapp" className="bg-[#120F0D]">{t('staff.dashboard.whatsapp_concierge_instant_cha', 'WhatsApp Concierge (Instant Chat Dispatch)')}</option>
                      <option value="phone" className="bg-[#120F0D]">{t('staff.dashboard.voice_phone_hotline_telephone_', 'Voice Phone Hotline (Telephone Dispatch)')}</option>
                      <option value="email" className="bg-[#120F0D]">{t('staff.dashboard.email_concierge_formal_confirm', 'Email Concierge (Formal Confirmations)')}</option>
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
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('staff.dashboard.gateway_status', 'Gateway Status:')}</span>
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
                      <span className="text-zinc-400">{t('staff.dashboard.razorpay_key_id', 'RAZORPAY_KEY_ID:')}</span>
                      <span className={healthStatus?.providers.razorpay.hasKeyId ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.razorpay.hasKeyId ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">{t('staff.dashboard.razorpay_key_secret', 'RAZORPAY_KEY_SECRET:')}</span>
                      <span className={healthStatus?.providers.razorpay.hasKeySecret ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.razorpay.hasKeySecret ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">{t('staff.dashboard.webhook_secret', 'WEBHOOK_SECRET:')}</span>
                      <span className={healthStatus?.providers.razorpay.hasWebhookSecret ? 'text-emerald-400' : 'text-amber-400'}>
                        {healthStatus?.providers.razorpay.hasWebhookSecret ? '✓ Configured' : '○ Optional'}
                      </span>
                    </div>
                  </div>
                )}

                {paymentProvider === 'stripe' && (
                  <div className="pt-2 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">{t('staff.dashboard.stripe_secret_key', 'STRIPE_SECRET_KEY:')}</span>
                      <span className={healthStatus?.providers.stripe.hasSecretKey ? 'text-emerald-400' : 'text-rose-400'}>
                        {healthStatus?.providers.stripe.hasSecretKey ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                      <span className="text-zinc-400">{t('staff.dashboard.stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET:')}</span>
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
                  <h4 className="font-bold text-white text-sm">{t('staff.dashboard.allow_pay_at_counter', 'Allow Pay at Counter')}</h4>
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
                  <option value="disabled" className="bg-[#120F0D]">{t('staff.dashboard.disabled_pay_at_counter_manual', 'Disabled (Pay at counter / manual verification only)')}</option>
                  <option value="online" className="bg-[#120F0D]">{t('staff.dashboard.online_required_customer_must_', 'Online Required (Customer must complete digital payment)')}</option>
                  <option value="optional" className="bg-[#120F0D]">{t('staff.dashboard.optional_customer_chooses_pay_', 'Optional (Customer chooses Pay Online or Pay at Counter)')}</option>
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
              <h3 className="font-serif text-lg font-bold text-white">{t('staff.dashboard.operational_hours_location', 'Operational Hours & Location')}</h3>

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
                    placeholder={t('staff.dashboard.e_g_barrackpore_london_new_yor', 'e.g. Barrackpore, London, New York')}
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
                    placeholder={t('staff.dashboard.e_g_west_bengal_ny_ontario', 'e.g. West Bengal, NY, Ontario')}
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
                    placeholder={t('staff.dashboard.e_g_concierge_thecafe_com', 'e.g. concierge@thecafe.com')}
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
              <h3 className="font-serif text-lg font-bold text-white">{t('staff.dashboard.top_announcement_banner', 'Top Announcement Banner')}</h3>
              <p className="text-xs text-zinc-400">
                Display a priority announcement at the very top of the customer website.
              </p>

              <textarea
                rows={2}
                value={banner}
                disabled={!isOwner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder={t('staff.dashboard.e_g_special_weekend_degustatio', 'e.g. Special weekend degustation menu featuring artisanal wood-fired sourdough pizzas.')}
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] resize-none"
              />
            </div>
          </div>

          {/* SECTION 6: OWNER REPORTS, NOTIFICATIONS & ENGAGEMENT */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                  Owner Operations
                </span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">
                  Daily Sales Summaries, Alerts & Reviews
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Configure automated end-of-day sales digests, low-stock threshold alerts, and customer review links.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Digest Channel */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Daily Sales Summary Channel
                  </label>
                  <select
                    value={ownerNotificationMethod}
                    disabled={!isOwner}
                    onChange={(e) => setOwnerNotificationMethod(e.target.value as any)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                  >
                    <option value="none">{t('staff.dashboard.disabled_no_daily_digest', 'Disabled (No daily digest)')}</option>
                    <option value="email">{t('staff.dashboard.email_only', 'Email Only')}</option>
                    <option value="whatsapp">{t('staff.dashboard.whatsapp_only', 'WhatsApp Only')}</option>
                    <option value="both">{t('staff.dashboard.both_whatsapp_email', 'Both WhatsApp & Email')}</option>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">{t('staff.dashboard.dispatches_daily_at_closing_ti', 'Dispatches daily at closing time with gross revenue, tickets, and top items.')}</p>
                </div>

                {/* Low Stock Alert Threshold */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Low-Stock Alert Threshold
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={lowStockAlertThreshold}
                      disabled={!isOwner}
                      onChange={(e) => setLowStockAlertThreshold(e.target.value)}
                      placeholder="5"
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-mono text-zinc-500">{t('staff.dashboard.units', 'units')}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">{t('staff.dashboard.items_at_or_below_this_count_a', 'Items at or below this count appear in dashboard stock alerts.')}</p>
                </div>

                {/* Owner WhatsApp Phone */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Owner WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={ownerNotificationPhone}
                    disabled={!isOwner}
                    onChange={(e) => setOwnerNotificationPhone(e.target.value)}
                    placeholder="+918420507105"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">{t('staff.dashboard.target_mobile_number_for_autom', 'Target mobile number for automated WhatsApp sales digests.')}</p>
                </div>

                {/* Owner Notification Email */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Owner Report Email
                  </label>
                  <input
                    type="email"
                    value={ownerNotificationEmail}
                    disabled={!isOwner}
                    onChange={(e) => setOwnerNotificationEmail(e.target.value)}
                    placeholder={t('staff.dashboard.owner_thecafe_com', 'owner@thecafe.com')}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">{t('staff.dashboard.target_email_inbox_for_daily_s', 'Target email inbox for daily sales summary attachments.')}</p>
                </div>
              </div>

              {/* Google Review URL */}
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400">star</span>
                  <span>{t('staff.dashboard.google_review_link_customer_po', 'Google Review Link (Customer Post-Order Prompt)')}</span>
                </label>
                <input
                  type="url"
                  value={googleReviewLink}
                  disabled={!isOwner}
                  onChange={(e) => setGoogleReviewLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Shown to diners on the checkout confirmation screen after their order is successfully received.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 7: HARDWARE & THERMAL PRINTER STATIONS */}
          <PrinterSettingsSection />

          {/* SECTION 8: SECURITY & PASSWORD MANAGEMENT */}
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Security Credentials
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.change_staff_password', 'Change Staff Password')}</h3>
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
                      placeholder={t('staff.dashboard.minimum_6_characters', 'Minimum 6 characters')}
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
                    placeholder={t('staff.dashboard.re_enter_new_password', 'Re-enter new password')}
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
                      <span>{t('staff.dashboard.updating', 'Updating...')}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      <span>{t('staff.dashboard.update_password', 'Update Password')}</span>
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
      {/* CUSTOM COUNTRY SETUP WIZARD MODAL */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#120F0D] border border-[#D4AF37]/30 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌐</span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Manual Jurisdiction Setup
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-white mt-1">
                  Custom Country Tax Setup Wizard
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure a custom jurisdiction not present in the master registry. Requires certified accountant confirmation to go live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Country Code (ISO 3166-1 alpha-2) *
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={customCountryCode}
                  onChange={(e) => setCustomCountryCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BR, AR, IS"
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Country Name *
                </label>
                <input
                  type="text"
                  value={customCountryName}
                  onChange={(e) => setCustomCountryName(e.target.value)}
                  placeholder={t('staff.dashboard.e_g_brazil_argentina_iceland', 'e.g. Brazil, Argentina, Iceland')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Currency Code (ISO 4217)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={customCurrency}
                  onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                  placeholder={t('staff.dashboard.e_g_brl_ars_isk', 'e.g. BRL, ARS, ISK')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Currency Symbol & Decimals
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customCurrencySymbol}
                    onChange={(e) => setCustomCurrencySymbol(e.target.value)}
                    placeholder="e.g. R$, $, kr"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                  <select
                    value={customCurrencyDecimals}
                    onChange={(e) => setCustomCurrencyDecimals(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="0">{t('staff.dashboard.0_decimals', '0 decimals')}</option>
                    <option value="2">{t('staff.dashboard.2_decimals', '2 decimals')}</option>
                    <option value="3">{t('staff.dashboard.3_decimals', '3 decimals')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Standard Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={customTaxRate}
                  onChange={(e) => setCustomTaxRate(e.target.value)}
                  placeholder="e.g. 19.0"
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Tax Calculation Mode
                </label>
                <select
                  value={customTaxMode}
                  onChange={(e) => setCustomTaxMode(e.target.value as 'inclusive' | 'exclusive')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="inclusive">{t('staff.dashboard.inclusive_prices_include_tax', 'Inclusive (Prices include tax)')}</option>
                  <option value="exclusive">{t('staff.dashboard.exclusive_added_at_checkout', 'Exclusive (Added at checkout)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Food Reduced Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={customFoodRate}
                  onChange={(e) => setCustomFoodRate(e.target.value)}
                  placeholder={t('staff.dashboard.e_g_7_0_or_leave_empty', 'e.g. 7.0 or leave empty')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Alcohol Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={customAlcoholRate}
                  onChange={(e) => setCustomAlcoholRate(e.target.value)}
                  placeholder={t('staff.dashboard.e_g_23_0_or_leave_empty', 'e.g. 23.0 or leave empty')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Tax Label
                </label>
                <input
                  type="text"
                  value={customTaxLabel}
                  onChange={(e) => setCustomTaxLabel(e.target.value)}
                  placeholder={t('staff.dashboard.vat_iva_gst_sales_tax', 'VAT, IVA, GST, Sales Tax')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Tax ID Label & Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customTaxIdLabel}
                    onChange={(e) => setCustomTaxIdLabel(e.target.value)}
                    placeholder={t('staff.dashboard.e_g_cnpj_rfc_nif', 'e.g. CNPJ, RFC, NIF')}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <input
                    type="text"
                    value={customTaxIdFormat}
                    onChange={(e) => setCustomTaxIdFormat(e.target.value)}
                    placeholder={t('staff.dashboard.e_g_xx_xxx_xxx_xxxx_xx', 'e.g. XX.XXX.XXX/XXXX-XX')}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Service Charge Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={customServiceCharge}
                  onChange={(e) => setCustomServiceCharge(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customServiceChargeTaxable}
                    onChange={(e) => setCustomServiceChargeTaxable(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#D4AF37] cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300">{t('staff.dashboard.service_charge_is_taxable', 'Service charge is taxable')}</span>
                </label>
              </div>
            </div>

            {/* Accountant Sign-off in Wizard */}
            <div className="p-4 rounded-2xl bg-black/40 border border-[#D4AF37]/30 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚖</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Certified Accountant / Tax Advisor Sign-off (Mandatory)
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Under the platform honesty rules, custom jurisdictions must be verified by a certified accountant before live ordering can be unlocked.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={customAccountantName}
                  onChange={(e) => setCustomAccountantName(e.target.value)}
                  placeholder={t('staff.dashboard.accountant_full_name_or_firm', 'Accountant full name or firm')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
                <input
                  type="text"
                  value={customAccountantLicense}
                  onChange={(e) => setCustomAccountantLicense(e.target.value)}
                  placeholder={t('staff.dashboard.cpa_ca_license_or_registration', 'CPA / CA license or registration #')}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={customAccountantConfirmed}
                  onChange={(e) => setCustomAccountantConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#D4AF37] cursor-pointer mt-0.5"
                />
                <span className="text-[11px] text-zinc-300">
                  I confirm that a licensed accountant has approved these tax rates, category splits, and invoice compliance rules for live restaurant operations.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomCountry}
                disabled={!customCountryCode || !customCountryName || !customAccountantConfirmed}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                Apply Custom Country Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsManagement;
