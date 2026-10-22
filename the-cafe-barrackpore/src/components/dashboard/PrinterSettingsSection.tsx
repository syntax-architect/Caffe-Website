import React, { useState, useEffect } from 'react';
import {
  getStationPrinterSettings,
  saveStationPrinterSettings,
  detectPrinterCapabilities,
  type StationPrinterConfig,
  type BrowserPrinterCapabilities,
  type PrintTargetType,
  type ThermalPaperWidth,
} from '../../config/printerSettings';
import { printTestPage, kickCashDrawer } from '../../utils/printReceipt';
import { connectWebUsbPrinter, connectWebSerialPrinter, checkPrintBridgeHealth } from '../../utils/printerTransports';
import { useNotification } from '../../hooks/useNotification';

export const PrinterSettingsSection: React.FC = () => {
  const { addNotification } = useNotification();
  const [config, setConfig] = useState<StationPrinterConfig>(() => getStationPrinterSettings());
  const [capabilities, setCapabilities] = useState<BrowserPrinterCapabilities>(() => detectPrinterCapabilities());
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [bridgeMessage, setBridgeMessage] = useState<string>('');
  const [isTestingPrint, setIsTestingPrint] = useState<string | null>(null);

  useEffect(() => {
    setCapabilities(detectPrinterCapabilities());
  }, []);

  const handleSave = () => {
    saveStationPrinterSettings(config);
    addNotification('success', 'Hardware Settings Saved', 'Thermal printer station profiles saved successfully.');
  };

  const handleTestPrint = async (station: 'receipt' | 'kitchen' | 'bar') => {
    setIsTestingPrint(station);
    try {
      const res = await printTestPage(station);
      if (res.success) {
        addNotification(
          'success',
          'Test Page Dispatched',
          res.message || `Test page sent to ${station.toUpperCase()} printer (${res.targetUsed}).`
        );
      } else {
        addNotification(
          'error',
          'Test Print Failed',
          res.error || 'Failed to print test page. Check connection or fallback to Browser Print.'
        );
      }
    } catch (err: any) {
      addNotification('error', 'Print Error', err?.message || 'Unexpected printing error.');
    } finally {
      setIsTestingPrint(null);
    }
  };

  const handleTestDrawerKick = async () => {
    setIsTestingPrint('drawer');
    try {
      const res = await kickCashDrawer(config.receipt);
      if (res.success) {
        addNotification('success', 'Cash Drawer Fired', res.message || 'Drawer kick pulse dispatched.');
      } else {
        addNotification('warning', 'Drawer Kick Notice', res.message || res.error || 'Could not pulse cash drawer.');
      }
    } catch (err: any) {
      addNotification('error', 'Drawer Error', err?.message || 'Failed to trigger cash drawer.');
    } finally {
      setIsTestingPrint(null);
    }
  };

  const handleCheckBridge = async () => {
    setBridgeStatus('checking');
    const result = await checkPrintBridgeHealth(config.receipt.bridgeUrl || 'http://localhost:9123');
    if (result.online) {
      setBridgeStatus('online');
      setBridgeMessage(`Bridge v${result.version} online and listening.`);
      addNotification('success', 'Print Bridge Connected', `Local bridge v${result.version} is active.`);
    } else {
      setBridgeStatus('offline');
      setBridgeMessage(result.error || 'Bridge unreachable.');
      addNotification(
        'error',
        'Print Bridge Unreachable',
        'Make sure to run: node scripts/print-bridge.mjs on your POS host computer.'
      );
    }
  };

  const handlePairUsb = async () => {
    const res = await connectWebUsbPrinter();
    if (res.success) {
      addNotification('success', 'USB Printer Paired', `Connected to ${res.device?.productName || 'USB Thermal Printer'}.`);
    } else {
      addNotification('error', 'USB Pairing Failed', res.error || 'Failed to pair USB printer.');
    }
  };

  const handlePairSerial = async () => {
    const res = await connectWebSerialPrinter(config.receipt.serialBaudRate || 9600);
    if (res.success) {
      addNotification('success', 'Serial Port Opened', 'Successfully opened serial COM printer port.');
    } else {
      addNotification('error', 'Serial Port Failed', res.error || 'Failed to open serial port.');
    }
  };

  return (
    <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
      <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Hardware POS Architecture
            </span>
            <h3 className="font-serif text-lg font-bold text-white mt-0.5">
              Thermal Receipt &amp; KOT Printers (58mm / 80mm)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Configure receipt billing printers, multi-station kitchen tickets (KOT), cash drawer pulse, and LAN printing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#120B08] font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Save Printer Setup
            </button>
          </div>
        </div>

        {/* Browser Hardware Capabilities Bar */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Client Browser Hardware Support:
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  capabilities.hasWebUsb
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
                title="Direct USB device transfer via Google Chrome or Microsoft Edge"
              >
                <span className="material-symbols-outlined text-xs">usb</span>
                WebUSB: {capabilities.hasWebUsb ? 'Supported' : 'Unavailable'}
              </span>

              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  capabilities.hasWebSerial
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
                title="Direct RS232 / COM port serial stream"
              >
                <span className="material-symbols-outlined text-xs">cable</span>
                Web Serial: {capabilities.hasWebSerial ? 'Supported' : 'Unavailable'}
              </span>

              <button
                type="button"
                onClick={handleCheckBridge}
                disabled={bridgeStatus === 'checking'}
                className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-600/40 transition-colors flex items-center gap-1 cursor-pointer"
                title="Verify connection to local LAN print bridge on port 9123"
              >
                <span className="material-symbols-outlined text-xs">router</span>
                <span>
                  LAN Bridge:{' '}
                  {bridgeStatus === 'checking'
                    ? 'Checking...'
                    : bridgeStatus === 'online'
                    ? 'Online'
                    : bridgeStatus === 'offline'
                    ? 'Offline'
                    : 'Ping Bridge'}
                </span>
              </button>
            </div>
          </div>

          {/* iOS Safari Platform Alert */}
          {capabilities.isIosSafari && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5">info</span>
              <div>
                <strong className="font-semibold block text-amber-300 mb-0.5">
                  Apple iOS / iPadOS Safari Compatibility Note:
                </strong>
                Apple WebKit does not support WebUSB or Web Serial. For iPad/iPhone POS terminals, please use{' '}
                <strong className="text-white">Browser Print</strong> (AirPrint / CUPS) or the{' '}
                <strong className="text-white">Local LAN Print Bridge</strong> running on a Mac/PC/Raspberry Pi on port 9100.
              </div>
            </div>
          )}

          {bridgeMessage && (
            <p className="text-[11px] font-mono text-zinc-400 pt-1">
              Bridge Status: {bridgeMessage}
            </p>
          )}
        </div>

        {/* PRINTER STATION 1: CUSTOMER RECEIPT & BILL PRINTER */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 text-[#F3C766] flex items-center justify-center">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Receipt &amp; Customer Bill Printer</h4>
                <p className="text-[11px] text-zinc-400">Prints guest checks, tax invoices, GST breakdowns &amp; UPI QR.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestPrint('receipt')}
                disabled={isTestingPrint !== null}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                {isTestingPrint === 'receipt' ? 'Printing...' : 'Print Test Page'}
              </button>

              <button
                type="button"
                onClick={handleTestDrawerKick}
                disabled={isTestingPrint !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Send pulse to cash drawer RJ11/RJ12 port"
              >
                <span className="material-symbols-outlined text-sm">point_of_sale</span>
                {isTestingPrint === 'drawer' ? 'Pulsing...' : 'Test Drawer Kick'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Target Transport */}
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                Print Target Transport
              </label>
              <select
                value={config.receipt.target}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    receipt: { ...config.receipt, target: e.target.value as PrintTargetType },
                  })
                }
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="browser">Browser Print (CSS @page — Universal)</option>
                <option value="webusb">Direct WebUSB (Chrome / Edge)</option>
                <option value="webserial">Direct Web Serial (RS232 / USB-COM)</option>
                <option value="network">LAN Network Bridge (Port 9100 RAW)</option>
              </select>
            </div>

            {/* Paper Width */}
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                Thermal Roll Width
              </label>
              <select
                value={config.receipt.paperWidth}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    receipt: { ...config.receipt, paperWidth: e.target.value as ThermalPaperWidth },
                  })
                }
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="80mm">80mm Roll (Standard POS — 48 Cols)</option>
                <option value="58mm">58mm Roll (Compact / Mobile — 32 Cols)</option>
              </select>
            </div>

            {/* Network IP / Port */}
            {config.receipt.target === 'network' && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Printer IP Address
                  </label>
                  <input
                    type="text"
                    value={config.receipt.networkIp || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        receipt: { ...config.receipt, networkIp: e.target.value },
                      })
                    }
                    placeholder="192.168.1.200"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Port (RAW ESC/POS)
                  </label>
                  <input
                    type="number"
                    value={config.receipt.networkPort || 9100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        receipt: { ...config.receipt, networkPort: parseInt(e.target.value, 10) || 9100 },
                      })
                    }
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </>
            )}

            {/* Serial Baud Rate */}
            {config.receipt.target === 'webserial' && (
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Serial Baud Rate
                </label>
                <div className="flex gap-2">
                  <select
                    value={config.receipt.serialBaudRate || 9600}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        receipt: { ...config.receipt, serialBaudRate: parseInt(e.target.value, 10) || 9600 },
                      })
                    }
                    className="flex-1 bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value={9600}>9600 bps</option>
                    <option value={19200}>19200 bps</option>
                    <option value={38400}>38400 bps</option>
                    <option value={115200}>115200 bps</option>
                  </select>
                  <button
                    type="button"
                    onClick={handlePairSerial}
                    className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white transition-colors"
                  >
                    Pair
                  </button>
                </div>
              </div>
            )}

            {/* WebUSB Pair Button */}
            {config.receipt.target === 'webusb' && (
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  USB Connection
                </label>
                <button
                  type="button"
                  onClick={handlePairUsb}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">usb</span>
                  Pair USB Printer
                </button>
              </div>
            )}
          </div>

          {/* Additional Receipt Options */}
          <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-zinc-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.receipt.autoCut}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    receipt: { ...config.receipt, autoCut: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded bg-[#070605] border-white/20 text-[#D4AF37] focus:ring-0"
              />
              <span>Auto-cut roll after receipt</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.receipt.openCashDrawer ?? true}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    receipt: { ...config.receipt, openCashDrawer: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded bg-[#070605] border-white/20 text-[#D4AF37] focus:ring-0"
              />
              <span>Kick cash drawer on cash settlement</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Drawer Pin:</span>
              <select
                value={config.receipt.cashDrawerPin || 0}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    receipt: { ...config.receipt, cashDrawerPin: (parseInt(e.target.value, 10) as 0 | 1) || 0 },
                  })
                }
                className="bg-[#070605] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white font-mono"
              >
                <option value={0}>Pin 2 (Standard)</option>
                <option value={1}>Pin 5 (Alternative)</option>
              </select>
            </div>
          </div>
        </div>

        {/* PRINTER STATION 2: KITCHEN HOT LINE KOT PRINTER */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">soup_kitchen</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Kitchen KOT Printer</h4>
                <p className="text-[11px] text-zinc-400">Prints food tickets, cook instructions, item modifications &amp; timers.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestPrint('kitchen')}
                disabled={isTestingPrint !== null}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                {isTestingPrint === 'kitchen' ? 'Printing...' : 'Print Kitchen Test KOT'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                Print Target Transport
              </label>
              <select
                value={config.kitchen.target}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    kitchen: { ...config.kitchen, target: e.target.value as PrintTargetType },
                  })
                }
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="browser">Browser Print (Universal Fallback)</option>
                <option value="webusb">Direct WebUSB (Chrome / Edge)</option>
                <option value="webserial">Direct Web Serial</option>
                <option value="network">LAN Network Bridge (Port 9100 RAW)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                Thermal Roll Width
              </label>
              <select
                value={config.kitchen.paperWidth}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    kitchen: { ...config.kitchen, paperWidth: e.target.value as ThermalPaperWidth },
                  })
                }
                className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="80mm">80mm Roll (Wide / Line Cook — 48 Cols)</option>
                <option value="58mm">58mm Roll (Compact — 32 Cols)</option>
              </select>
            </div>

            {config.kitchen.target === 'network' && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Kitchen Printer IP
                  </label>
                  <input
                    type="text"
                    value={config.kitchen.networkIp || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        kitchen: { ...config.kitchen, networkIp: e.target.value },
                      })
                    }
                    placeholder="192.168.1.201"
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Port
                  </label>
                  <input
                    type="number"
                    value={config.kitchen.networkPort || 9100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        kitchen: { ...config.kitchen, networkPort: parseInt(e.target.value, 10) || 9100 },
                      })
                    }
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* PRINTER STATION 3: BAR & SIPS BEVERAGE PRINTER */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">local_cafe</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Bar &amp; Sips Beverage Printer</h4>
                <p className="text-[11px] text-zinc-400">Routes drink orders, espresso bar tickets &amp; mocktails to a separate station.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-300">
                <input
                  type="checkbox"
                  checked={config.bar.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bar: { ...config.bar, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded bg-[#070605] border-white/20 text-[#D4AF37] focus:ring-0"
                />
                <span>Enable Bar Station</span>
              </label>

              {config.bar.enabled && (
                <button
                  type="button"
                  onClick={() => handleTestPrint('bar')}
                  disabled={isTestingPrint !== null}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  {isTestingPrint === 'bar' ? 'Printing...' : 'Print Bar Test KOT'}
                </button>
              )}
            </div>
          </div>

          {config.bar.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Print Target Transport
                </label>
                <select
                  value={config.bar.target}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bar: { ...config.bar, target: e.target.value as PrintTargetType },
                    })
                  }
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="browser">Browser Print (Universal Fallback)</option>
                  <option value="webusb">Direct WebUSB (Chrome / Edge)</option>
                  <option value="webserial">Direct Web Serial</option>
                  <option value="network">LAN Network Bridge (Port 9100 RAW)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Thermal Roll Width
                </label>
                <select
                  value={config.bar.paperWidth}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bar: { ...config.bar, paperWidth: e.target.value as ThermalPaperWidth },
                    })
                  }
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="58mm">58mm Roll (Compact Bar Slip)</option>
                  <option value="80mm">80mm Roll (Standard)</option>
                </select>
              </div>

              {config.bar.target === 'network' && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Bar Printer IP
                    </label>
                    <input
                      type="text"
                      value={config.bar.networkIp || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          bar: { ...config.bar, networkIp: e.target.value },
                        })
                      }
                      placeholder="192.168.1.202"
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Port
                    </label>
                    <input
                      type="number"
                      value={config.bar.networkPort || 9100}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          bar: { ...config.bar, networkPort: parseInt(e.target.value, 10) || 9100 },
                        })
                      }
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* MULTI-STATION CATEGORY ROUTING TOGGLE */}
        {config.bar.enabled && (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                Automatic Item Category Routing (Kitchen vs Bar)
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                When printing an order with both food and drinks, splits items and prints to respective station printers simultaneously.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableCategoryRouting}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    enableCategoryRouting: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrinterSettingsSection;
