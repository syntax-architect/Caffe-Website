/**
 * POS Station Thermal Printer Configuration Store
 * Commercial Grade — Local Storage Persistence & Hardware Capabilities Detection
 */

export type PrintTargetType = 'browser' | 'webusb' | 'webserial' | 'network';
export type ThermalPaperWidth = '80mm' | '58mm';

export interface SinglePrinterConfig {
  name: string;
  enabled: boolean;
  target: PrintTargetType;
  paperWidth: ThermalPaperWidth;
  networkIp?: string;
  networkPort?: number;
  bridgeUrl?: string;
  serialBaudRate?: number;
  autoCut: boolean;
  openCashDrawer?: boolean;
  cashDrawerPin?: 0 | 1;
  categories?: string[];
}

export interface StationPrinterConfig {
  receipt: SinglePrinterConfig;
  kitchen: SinglePrinterConfig;
  bar: SinglePrinterConfig;
  enableCategoryRouting: boolean;
  bridgeHealthUrl: string;
}

export interface BrowserPrinterCapabilities {
  hasWebUsb: boolean;
  hasWebSerial: boolean;
  isIosSafari: boolean;
  isAndroid: boolean;
  isChromeOrEdge: boolean;
  recommendedTarget: PrintTargetType;
  notice?: string;
}

const SETTINGS_KEY = 'caffe_station_printer_settings_v1';

export const DEFAULT_PRINTER_CONFIG: StationPrinterConfig = {
  receipt: {
    name: 'Counter Receipt & Bill Printer',
    enabled: true,
    target: 'browser',
    paperWidth: '80mm',
    networkIp: '192.168.1.200',
    networkPort: 9100,
    bridgeUrl: 'http://localhost:9123',
    serialBaudRate: 9600,
    autoCut: true,
    openCashDrawer: true,
    cashDrawerPin: 0,
  },
  kitchen: {
    name: 'Kitchen Hot Line Printer',
    enabled: true,
    target: 'browser',
    paperWidth: '80mm',
    networkIp: '192.168.1.201',
    networkPort: 9100,
    bridgeUrl: 'http://localhost:9123',
    serialBaudRate: 9600,
    autoCut: true,
    categories: ['burgers-pizzas', 'starters-momos', 'mains-platters', 'soups-salads', 'kitchen', 'food'],
  },
  bar: {
    name: 'Bar & Sips Beverage Printer',
    enabled: false, // Disabled by default until restaurant enables 2nd station
    target: 'browser',
    paperWidth: '58mm',
    networkIp: '192.168.1.202',
    networkPort: 9100,
    bridgeUrl: 'http://localhost:9123',
    serialBaudRate: 9600,
    autoCut: true,
    categories: ['sips-desserts', 'beverages', 'drinks', 'coffee', 'mocktails', 'bar'],
  },
  enableCategoryRouting: false,
  bridgeHealthUrl: 'http://localhost:9123/health',
};

export const DEFAULT_STATION_PRINTER_SETTINGS = DEFAULT_PRINTER_CONFIG;

/**
 * Detects client browser hardware capabilities (WebUSB, Web Serial, OS limits)
 */
export function detectPrinterCapabilities(): BrowserPrinterCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      hasWebUsb: false,
      hasWebSerial: false,
      isIosSafari: false,
      isAndroid: false,
      isChromeOrEdge: false,
      recommendedTarget: 'browser',
    };
  }

  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isChromeOrEdge = /Chrome|Edg/i.test(ua) && !/Firefox/i.test(ua) && !isIos;
  const hasWebUsb = Boolean('usb' in navigator && (navigator as any).usb);
  const hasWebSerial = Boolean('serial' in navigator && (navigator as any).serial);

  let recommendedTarget: PrintTargetType = 'browser';
  let notice: string | undefined;

  if (isIos) {
    recommendedTarget = 'browser';
    notice =
      'iOS Safari Limit: Apple WebKit does not support WebUSB or Web Serial APIs. On iPad/iPhone POS terminals, please use Browser Print (AirPrint / CUPS) or the LAN Print Bridge.';
  } else if (hasWebUsb || hasWebSerial) {
    recommendedTarget = hasWebUsb ? 'webusb' : 'webserial';
  } else {
    recommendedTarget = 'browser';
    notice =
      'Direct USB/Serial printing is not available in this browser. Please use Google Chrome or Microsoft Edge on Windows/Mac/Linux/Android, or use Browser Print.';
  }

  return {
    hasWebUsb,
    hasWebSerial,
    isIosSafari: isIos,
    isAndroid,
    isChromeOrEdge,
    recommendedTarget,
    notice,
  };
}

/**
 * Loads current station printer configuration from localStorage
 */
export function getStationPrinterSettings(): StationPrinterConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_PRINTER_CONFIG;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PRINTER_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRINTER_CONFIG,
      ...parsed,
      receipt: { ...DEFAULT_PRINTER_CONFIG.receipt, ...(parsed.receipt || {}) },
      kitchen: { ...DEFAULT_PRINTER_CONFIG.kitchen, ...(parsed.kitchen || {}) },
      bar: { ...DEFAULT_PRINTER_CONFIG.bar, ...(parsed.bar || {}) },
    };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

/**
 * Persists station printer configuration to localStorage
 */
export function saveStationPrinterSettings(config: StationPrinterConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('[printerSettings] Failed to save printer settings to localStorage:', err);
  }
}

/**
 * Determines whether an item belongs to the Kitchen or Bar printer based on category routing
 */
export function routeItemToStation(
  categoryOrName: string,
  config: StationPrinterConfig = getStationPrinterSettings()
): 'kitchen' | 'bar' {
  if (!config.enableCategoryRouting || !config.bar.enabled) {
    return 'kitchen';
  }

  const norm = categoryOrName.toLowerCase().trim();
  const barCategories = (config.bar.categories || []).map((c) => c.toLowerCase().trim());

  const isBar = barCategories.some(
    (c) => norm === c || norm.includes(c) || c.includes(norm)
  );

  return isBar ? 'bar' : 'kitchen';
}
