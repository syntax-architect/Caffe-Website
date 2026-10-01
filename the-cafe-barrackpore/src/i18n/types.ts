/**
 * Internationalization Type Definitions
 * Global Restaurant Platform — i18n Translation System
 *
 * Every user-visible string in the platform flows through this type system,
 * enabling zero-code language switching for any deployment market.
 */

export type SupportedLanguage =
  | 'en'    // English (default)
  | 'ar'    // Arabic (RTL)
  | 'fr'    // French
  | 'de'    // German
  | 'es'    // Spanish
  | 'pt'    // Portuguese
  | 'ja'    // Japanese
  | 'zh'    // Chinese (Simplified)
  | 'ko'    // Korean
  | 'hi'    // Hindi
  | 'tr'    // Turkish
  | 'th';   // Thai

export type LanguageDirection = 'ltr' | 'rtl';

export interface LanguageMeta {
  code: SupportedLanguage;
  name: string;              // English name
  nativeName: string;        // Name in that language
  direction: LanguageDirection;
  flag: string;              // Emoji flag
}

/**
 * Complete translation dictionary shape.
 * Every key is a dot-path to a UI string.
 */
export interface TranslationDictionary {
  // ─── Common / Shared ───────────────────────────────
  common: {
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    close: string;
    confirm: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    yes: string;
    no: string;
    or: string;
    and: string;
    of: string;
    items: string;
    item: string;
    total: string;
    subtotal: string;
    tax: string;
    free: string;
    required: string;
    optional: string;
    viewAll: string;
    showMore: string;
    showLess: string;
    noResults: string;
    poweredBy: string;
  };

  // ─── Navigation & Header ────────────────────────────
  nav: {
    home: string;
    menu: string;
    reservations: string;
    orderOnline: string;
    gallery: string;
    ourStory: string;
    contact: string;
    staffPortal: string;
  };

  // ─── Hero Section ──────────────────────────────────
  hero: {
    viewMenu: string;
    bookTable: string;
    orderNow: string;
    scrollDown: string;
  };

  // ─── Menu & Ordering ───────────────────────────────
  menu: {
    title: string;
    searchPlaceholder: string;
    allCategories: string;
    addToCart: string;
    added: string;
    soldOut: string;
    vegetarian: string;
    nonVegetarian: string;
    vegan: string;
    glutenFree: string;
    spicy: string;
    chefSpecial: string;
    popular: string;
    new: string;
    customizeNote: string;
    specialInstructions: string;
    specialInstructionsPlaceholder: string;
  };

  // ─── Cart & Checkout ───────────────────────────────
  cart: {
    title: string;
    empty: string;
    emptyMessage: string;
    browseMenu: string;
    itemsInCart: string;
    removeItem: string;
    updateQuantity: string;
    clearCart: string;
    proceedToCheckout: string;
    orderSummary: string;
    deliveryType: string;
    dineIn: string;
    takeaway: string;
    tableNumber: string;
    guestDetails: string;
    name: string;
    namePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    specialRequests: string;
    specialRequestsPlaceholder: string;
    reviewOrder: string;
    placeOrder: string;
    placingOrder: string;
    orderPlaced: string;
    orderConfirmation: string;
    orderRef: string;
    estimatedTime: string;
    payNow: string;
    payAtCounter: string;
    paymentPending: string;
    paymentProcessing: string;
    paymentComplete: string;
    paymentFailed: string;
    whatsappConfirmation: string;
    step1: string;
    step2: string;
    step3: string;
  };

  // ─── Reservations ──────────────────────────────────
  reservations: {
    title: string;
    subtitle: string;
    date: string;
    time: string;
    guests: string;
    guestCount: string;
    selectDate: string;
    selectTime: string;
    availableSlots: string;
    noSlots: string;
    yourDetails: string;
    confirmReservation: string;
    reservationConfirmed: string;
    reservationRef: string;
    specialOccasion: string;
    birthday: string;
    anniversary: string;
    businessDinner: string;
    other: string;
    dietaryRestrictions: string;
    closed: string;
    fullyBooked: string;
  };

  // ─── QR Ordering ───────────────────────────────────
  qr: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    scanToOrder: string;
    tableLabel: string;
    viewMenuButton: string;
    orderForTable: string;
  };

  // ─── Footer ────────────────────────────────────────
  footer: {
    openingHours: string;
    findUs: string;
    followUs: string;
    privacyPolicy: string;
    termsOfService: string;
    allRightsReserved: string;
    madeWith: string;
  };

  // ─── Staff Portal ──────────────────────────────────
  staff: {
    login: {
      title: string;
      subtitle: string;
      emailLabel: string;
      emailPlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      signIn: string;
      signingIn: string;
      autoFill: string;
      forgotPassword: string;
      invalidCredentials: string;
      operationsTerminal: string;
    };
    dashboard: {
      title: string;
      overview: string;
      orders: string;
      reservations: string;
      menu: string;
      tables: string;
      staff: string;
      settings: string;
      content: string;
      kitchen: string;
      signOut: string;
      welcome: string;
    };
    orders: {
      title: string;
      newOrder: string;
      pending: string;
      preparing: string;
      ready: string;
      completed: string;
      cancelled: string;
      refunded: string;
      totalOrders: string;
      todayRevenue: string;
      avgTicket: string;
      markPreparing: string;
      markReady: string;
      markCompleted: string;
      issueRefund: string;
    };
    kitchen: {
      title: string;
      newTickets: string;
      inProgress: string;
      readyToServe: string;
      bumpTicket: string;
      recallTicket: string;
      urgentLabel: string;
      rushLabel: string;
      modifierLabel: string;
      allergyAlert: string;
      clearAll: string;
      soundOn: string;
      soundOff: string;
    };
    tables: {
      title: string;
      addTable: string;
      editTable: string;
      deleteTable: string;
      tableNumber: string;
      capacity: string;
      zone: string;
      status: string;
      available: string;
      occupied: string;
      reserved: string;
      generateQR: string;
      printQR: string;
    };
    settings: {
      title: string;
      businessInfo: string;
      localization: string;
      operations: string;
      payments: string;
      taxConfig: string;
      countryPreset: string;
      applyPreset: string;
      saveChanges: string;
      saving: string;
      saved: string;
    };
  };

  // ─── Notifications ─────────────────────────────────
  notifications: {
    orderReceived: string;
    orderReady: string;
    reservationConfirmed: string;
    settingsSaved: string;
    errorOccurred: string;
    networkError: string;
    permissionDenied: string;
  };

  // ─── Accessibility ─────────────────────────────────
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    openCart: string;
    closeCart: string;
    increaseQuantity: string;
    decreaseQuantity: string;
    removeFromCart: string;
    scrollToTop: string;
  };
}

/**
 * Language metadata registry — used for language picker UI
 */
export const LANGUAGE_META: Record<SupportedLanguage, LanguageMeta> = {
  en: { code: 'en', name: 'English',              nativeName: 'English',      direction: 'ltr', flag: '🇬🇧' },
  ar: { code: 'ar', name: 'Arabic',               nativeName: 'العربية',       direction: 'rtl', flag: '🇸🇦' },
  fr: { code: 'fr', name: 'French',               nativeName: 'Français',     direction: 'ltr', flag: '🇫🇷' },
  de: { code: 'de', name: 'German',               nativeName: 'Deutsch',      direction: 'ltr', flag: '🇩🇪' },
  es: { code: 'es', name: 'Spanish',              nativeName: 'Español',      direction: 'ltr', flag: '🇪🇸' },
  pt: { code: 'pt', name: 'Portuguese',           nativeName: 'Português',    direction: 'ltr', flag: '🇵🇹' },
  ja: { code: 'ja', name: 'Japanese',             nativeName: '日本語',         direction: 'ltr', flag: '🇯🇵' },
  zh: { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文',       direction: 'ltr', flag: '🇨🇳' },
  ko: { code: 'ko', name: 'Korean',               nativeName: '한국어',         direction: 'ltr', flag: '🇰🇷' },
  hi: { code: 'hi', name: 'Hindi',                nativeName: 'हिन्दी',         direction: 'ltr', flag: '🇮🇳' },
  tr: { code: 'tr', name: 'Turkish',              nativeName: 'Türkçe',       direction: 'ltr', flag: '🇹🇷' },
  th: { code: 'th', name: 'Thai',                 nativeName: 'ไทย',           direction: 'ltr', flag: '🇹🇭' },
};
