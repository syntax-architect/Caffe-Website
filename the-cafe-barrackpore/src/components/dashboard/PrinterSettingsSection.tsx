import { useI18n } from '../../i18n';
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
  const { t } = useI18n(); void t;
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
    addNotification('success', t('staff.printer.hardware_settings_saved', 'Hardware Settings Saved'), t('staff.printer.profiles_saved_desc', 'Thermal printer station profiles saved successfully.'));
  };

  const handleTestPrint = async (station: 'receipt' | 'kitchen' | 'bar') => {
    setIsTestingPrint(station);
    try {
      const res = await printTestPage(station);
      if (res.success) {
        addNotification(
          'success',
          t('staff.printer.test_page_dispatched', 'Test Page Dispatched'),
          res.message || `Test page sent to ${station.toUpperCase()} printer (${res.targetUsed}).`
        );
      } else {
        addNotification(
          'error',
          t('staff.printer.test_print_failed', 'Test Print Failed'),
          res.error || t('staff.printer.failed_print_test_page', 'Failed to print test page. Check connection or fallback to Browser Print.')
        );
      }
    } catch (err: any) {
      addNotification('error', t('staff.printer.print_error', 'Print Error'), err?.message || t('staff.printer.unexpected_print_error', 'Unexpected printing error.'));
    } finally {
      setIsTestingPrint(null);
    }
  };

  const handleTestDrawerKick = async () => {
    setIsTestingPrint('drawer');
    try {
      const res = await kickCashDrawer(config.receipt);
      if (res.success) {
        addNotification('success', t('staff.printer.drawer_fired', 'Cash Drawer Fired'), res.message || t('staff.printer.drawer_pulse_dispatched', 'Drawer kick pulse dispatched.'));
      } else {
        addNotification('warning', t('staff.printer.drawer_notice', 'Drawer Kick Notice'), res.message || res.error || t('staff.printer.could_not_pulse_drawer', 'Could not pulse cash drawer.'));
      }
    } catch (err: any) {
      addNotification('error', t('staff.printer.drawer_error', 'Drawer Error'), err?.message || t('staff.printer.failed_trigger_drawer', 'Failed to trigger cash drawer.'));
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
      addNotification('success', t('staff.printer.bridge_connected', 'Print Bridge Connected'), t('staff.printer.local_bridge_active', 'Local bridge v{ver} is active.').replace('{ver}', result.version || '1.0.0'));
    } else {
      setBridgeStatus('offline');
      setBridgeMessage(result.error || t('staff.printer.bridge_unreachable_msg', 'Bridge unreachable.'));
      addNotification(
        'error',
        t('staff.printer.bridge_unreachable', 'Print Bridge Unreachable'),
        t('staff.printer.make_sure_run_bridge', 'Make sure to run: node scripts/print-bridge.mjs on your POS host computer.')
      );
    }
  };

  const handlePairUsb = async () => {
    const res = await connectWebUsbPrinter();
    if (res.success) {
      addNotification('success', t('staff.printer.usb_paired', 'USB Printer Paired'), t('staff.printer.connected_to_usb', 'Connected to {name}.').replace('{name}', res.device?.productName || t('staff.printer.usb_thermal_printer', 'USB Thermal Printer')));
    } else {
      addNotification('error', t('staff.printer.usb_failed', 'USB Pairing Failed'), res.error || t('staff.printer.failed_pair_usb', 'Failed to pair USB printer.'));
    }
  };

  const handlePairSerial = async () => {
    const res = await connectWebSerialPrinter(config.receipt.serialBaudRate || 9600);
    if (res.success) {
      addNotification('success', t('staff.printer.serial_opened', 'Serial Port Opened'), t('staff.printer.serial_opened_desc', 'Successfully opened serial COM printer port.'));
    } else {
      addNotification('error', t('staff.printer.serial_failed', 'Serial Port Failed'), res.error || t('staff.printer.failed_open_serial', 'Failed to open serial port.'));
    }
  };

  return (
    <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
      <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              {t('staff.printers.hardware_pos_architecture', 'Hardware POS Architecture')}
            </span>
            <h3 className="font-serif text-lg font-bold text-white mt-0.5">
              Thermal Receipt & KOT Printers (58mm / 80mm)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {t('staff.printers.configure_receipt_billing_printe', 'Configure receipt billing printers, multi-station kitchen tickets (KOT), cash drawer pulse, and LAN printing.')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#120B08] font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {t('staff.printers.save_printer_setup', 'Save Printer Setup')}
            </button>
          </div>
        </div>

        {/* Browser Hardware Capabilities Bar */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              {t('staff.printers.client_browser_hardware_support', 'Client Browser Hardware Support:')}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  capabilities.hasWebUsb
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
                title={t('staff.printers.direct_usb_device_transfer_via_g', 'Direct USB device transfer via Google Chrome or Microsoft Edge')}
              >
                <span className="material-symbols-outlined text-xs">usb</span>
                WebUSB: {capabilities.hasWebUsb ? t('staff.printers.supported', 'Supported') : t('staff.printers.unavailable', 'Unavailable')}
              </span>

              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                  capabilities.hasWebSerial
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
                title={t('staff.printers.direct_rs232_com_port_serial_str', 'Direct RS232 / COM port serial stream')}
              >
                <span className="material-symbols-outlined text-xs">cable</span>
                Web Serial: {capabilities.hasWebSerial ? t('staff.printers.supported', 'Supported') : t('staff.printers.unavailable', 'Unavailable')}
              </span>

              <button
                type="button"
                onClick={handleCheckBridge}
                disabled={bridgeStatus === 'checking'}
                className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-600/40 transition-colors flex items-center gap-1 cursor-pointer"
                title={t('staff.printers.verify_connection_to_local_lan_p', 'Verify connection to local LAN print bridge on port 9123')}
              >
                <span className="material-symbols-outlined text-xs">router</span>
                <span>
                  {t('staff.printer.lan_bridge', 'LAN Bridge')}:{' '}
                  {bridgeStatus === 'checking'
                    ? t('staff.printer.checking', 'Checking...')
                    : bridgeStatus === 'online'
                    ? t('staff.printer.online', 'Online')
                    : bridgeStatus === 'offline'
                    ? t('staff.printer.offline', 'Offline')
                    : t('staff.printer.ping_bridge', 'Ping Bridge')}
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
                <strong className="text-white">{t('staff.dashboard.browser_print', 'Browser Print')}</strong> (AirPrint / CUPS) or the{' '}
                <strong className="text-white">{t('staff.dashboard.local_lan_print_bridge', 'Local LAN Print Bridge')}</strong> running on a Mac/PC/Raspberry Pi on port 9100.
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
                <h4 className="text-sm font-bold text-white">{t('staff.dashboard.receipt_amp_customer_bill_prin', 'Receipt & Customer Bill Printer')}</h4>
                <p className="text-[11px] text-zinc-400">{t('staff.dashboard.prints_guest_checks_tax_invoic', 'Prints guest checks, tax invoices, GST breakdowns & UPI QR.')}</p>
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
                {isTestingPrint === 'receipt' ? t('staff.printer.printing', 'Printing...') : t('staff.printer.print_test_page', 'Print Test Page')}
              </button>

              <button
                type="button"
                onClick={handleTestDrawerKick}
                disabled={isTestingPrint !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={t('staff.printers.send_pulse_to_cash_drawer_rj11_r', 'Send pulse to cash drawer RJ11/RJ12 port')}
              >
                <span className="material-symbols-outlined text-sm">point_of_sale</span>
                {isTestingPrint === 'drawer' ? t('staff.printer.pulsing', 'Pulsing...') : t('staff.printer.test_drawer_kick', 'Test Drawer Kick')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Target Transport */}
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                {t('staff.printers.print_target_transport', 'Print Target Transport')}
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
                <option value="browser">{t('staff.dashboard.browser_print_css_page_univers', 'Browser Print (CSS @page — Universal)')}</option>
                <option value="webusb">{t('staff.dashboard.direct_webusb_chrome_edge', 'Direct WebUSB (Chrome / Edge)')}</option>
                <option value="webserial">{t('staff.dashboard.direct_web_serial_rs232_usb_co', 'Direct Web Serial (RS232 / USB-COM)')}</option>
                <option value="network">{t('staff.dashboard.lan_network_bridge_port_9100_r', 'LAN Network Bridge (Port 9100 RAW)')}</option>
              </select>
            </div>

            {/* Paper Width */}
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                {t('staff.printers.thermal_roll_width', 'Thermal Roll Width')}
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
                <option value="80mm">{t('staff.dashboard.80mm_roll_standard_pos_48_cols', '80mm Roll (Standard POS — 48 Cols)')}</option>
                <option value="58mm">{t('staff.dashboard.58mm_roll_compact_mobile_32_co', '58mm Roll (Compact / Mobile — 32 Cols)')}</option>
              </select>
            </div>

            {/* Network IP / Port */}
            {config.receipt.target === 'network' && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.printers.printer_ip_address', 'Printer IP Address')}
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
                  {t('staff.printers.serial_baud_rate', 'Serial Baud Rate')}
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
                    <option value={9600}>{t('staff.dashboard.9600_bps', '9600 bps')}</option>
                    <option value={19200}>{t('staff.dashboard.19200_bps', '19200 bps')}</option>
                    <option value={38400}>{t('staff.dashboard.38400_bps', '38400 bps')}</option>
                    <option value={115200}>{t('staff.dashboard.115200_bps', '115200 bps')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={handlePairSerial}
                    className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white transition-colors"
                  >
                    {t('staff.printers.pair', 'Pair')}
                  </button>
                </div>
              </div>
            )}

            {/* WebUSB Pair Button */}
            {config.receipt.target === 'webusb' && (
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  {t('staff.printers.usb_connection', 'USB Connection')}
                </label>
                <button
                  type="button"
                  onClick={handlePairUsb}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">usb</span>
                  {t('staff.printers.pair_usb_printer', 'Pair USB Printer')}
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
              <span>{t('staff.dashboard.auto_cut_roll_after_receipt', 'Auto-cut roll after receipt')}</span>
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
              <span>{t('staff.dashboard.kick_cash_drawer_on_cash_settl', 'Kick cash drawer on cash settlement')}</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">{t('staff.dashboard.drawer_pin', 'Drawer Pin:')}</span>
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
                <option value={0}>{t('staff.dashboard.pin_2_standard', 'Pin 2 (Standard)')}</option>
                <option value={1}>{t('staff.dashboard.pin_5_alternative', 'Pin 5 (Alternative)')}</option>
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
                <h4 className="text-sm font-bold text-white">{t('staff.dashboard.kitchen_kot_printer', 'Kitchen KOT Printer')}</h4>
                <p className="text-[11px] text-zinc-400">{t('staff.dashboard.prints_food_tickets_cook_instr', 'Prints food tickets, cook instructions, item modifications & timers.')}</p>
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
                {isTestingPrint === 'kitchen' ? t('staff.printer.printing', 'Printing...') : t('staff.printer.print_kitchen_test_kot', 'Print Kitchen Test KOT')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                {t('staff.printers.print_target_transport', 'Print Target Transport')}
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
                <option value="browser">{t('staff.dashboard.browser_print_universal_fallba', 'Browser Print (Universal Fallback)')}</option>
                <option value="webusb">{t('staff.dashboard.direct_webusb_chrome_edge', 'Direct WebUSB (Chrome / Edge)')}</option>
                <option value="webserial">{t('staff.dashboard.direct_web_serial', 'Direct Web Serial')}</option>
                <option value="network">{t('staff.dashboard.lan_network_bridge_port_9100_r', 'LAN Network Bridge (Port 9100 RAW)')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                {t('staff.printers.thermal_roll_width', 'Thermal Roll Width')}
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
                <option value="80mm">{t('staff.dashboard.80mm_roll_wide_line_cook_48_co', '80mm Roll (Wide / Line Cook — 48 Cols)')}</option>
                <option value="58mm">{t('staff.dashboard.58mm_roll_compact_32_cols', '58mm Roll (Compact — 32 Cols)')}</option>
              </select>
            </div>

            {config.kitchen.target === 'network' && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.printers.kitchen_printer_ip', 'Kitchen Printer IP')}
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
                    {t('staff.printers.port', 'Port')}
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
                <h4 className="text-sm font-bold text-white">{t('staff.dashboard.bar_amp_sips_beverage_printer', 'Bar & Sips Beverage Printer')}</h4>
                <p className="text-[11px] text-zinc-400">{t('staff.dashboard.routes_drink_orders_espresso_b', 'Routes drink orders, espresso bar tickets & mocktails to a separate station.')}</p>
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
                <span>{t('staff.dashboard.enable_bar_station', 'Enable Bar Station')}</span>
              </label>

              {config.bar.enabled && (
                <button
                  type="button"
                  onClick={() => handleTestPrint('bar')}
                  disabled={isTestingPrint !== null}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  {isTestingPrint === 'bar' ? t('staff.printer.printing', 'Printing...') : t('staff.printer.print_bar_test_kot', 'Print Bar Test KOT')}
                </button>
              )}
            </div>
          </div>

          {config.bar.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  {t('staff.printers.print_target_transport', 'Print Target Transport')}
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
                  <option value="browser">{t('staff.dashboard.browser_print_universal_fallba', 'Browser Print (Universal Fallback)')}</option>
                  <option value="webusb">{t('staff.dashboard.direct_webusb_chrome_edge', 'Direct WebUSB (Chrome / Edge)')}</option>
                  <option value="webserial">{t('staff.dashboard.direct_web_serial', 'Direct Web Serial')}</option>
                  <option value="network">{t('staff.dashboard.lan_network_bridge_port_9100_r', 'LAN Network Bridge (Port 9100 RAW)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  {t('staff.printers.thermal_roll_width', 'Thermal Roll Width')}
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
                  <option value="58mm">{t('staff.dashboard.58mm_roll_compact_bar_slip', '58mm Roll (Compact Bar Slip)')}</option>
                  <option value="80mm">{t('staff.dashboard.80mm_roll_standard', '80mm Roll (Standard)')}</option>
                </select>
              </div>

              {config.bar.target === 'network' && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      {t('staff.printers.bar_printer_ip', 'Bar Printer IP')}
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
                      {t('staff.printers.port', 'Port')}
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
                {t('staff.printers.automatic_item_category_routing_', 'Automatic Item Category Routing (Kitchen vs Bar)')}
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t('staff.printers.when_printing_an_order_with_both', 'When printing an order with both food and drinks, splits items and prints to respective station printers simultaneously.')}
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
