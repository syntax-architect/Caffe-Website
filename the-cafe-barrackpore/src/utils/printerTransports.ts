/**
 * Thermal Printer Hardware Transports (Browser, WebUSB, Web Serial, LAN Bridge)
 * Commercial Grade — Zero External Libraries
 */

import type { SinglePrinterConfig } from '../config/printerSettings';

export interface PrintDispatchResult {
  success: boolean;
  targetUsed: 'browser' | 'webusb' | 'webserial' | 'network';
  message?: string;
  error?: string;
  fallbackUsed?: boolean;
}

// In-memory active handles for the current browser session
let cachedUsbDevice: any = null;
let cachedSerialPort: any = null;

/**
 * Converts a Uint8Array into a Base64 string safely
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Executes standard native browser thermal printing via hidden iframe
 */
export async function sendBrowserPrint(htmlContent: string): Promise<PrintDispatchResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      success: false,
      targetUsed: 'browser',
      error: 'Cannot print in non-browser environment.',
    };
  }

  return new Promise((resolve) => {
    try {
      const existing = document.getElementById('thermal-print-frame');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        resolve({
          success: false,
          targetUsed: 'browser',
          error: 'Failed to access print iframe document.',
        });
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({
            success: true,
            targetUsed: 'browser',
            message: 'Browser thermal print dialog dispatched.',
          });
        } catch (err: any) {
          resolve({
            success: false,
            targetUsed: 'browser',
            error: err?.message || 'Failed to trigger browser print dialog.',
          });
        } finally {
          setTimeout(() => iframe.remove(), 4000);
        }
      }, 350);
    } catch (err: any) {
      resolve({
        success: false,
        targetUsed: 'browser',
        error: err?.message || 'Unexpected browser print error.',
      });
    }
  });
}

/**
 * Connects and pairs with a USB Thermal Printer via WebUSB
 */
export async function connectWebUsbPrinter(): Promise<{ success: boolean; device?: any; error?: string }> {
  if (typeof navigator === 'undefined' || !('usb' in navigator) || !(navigator as any).usb) {
    return {
      success: false,
      error:
        'WebUSB is not supported in this browser. Please use Google Chrome or Microsoft Edge on Desktop/Android, or switch to Browser Print.',
    };
  }

  try {
    // Request device with printer class (7) or generic filter
    const device = await (navigator as any).usb.requestDevice({
      filters: [{ classCode: 7 }],
    }).catch(async () => {
      // Fallback: prompt with no class filter if standard class 7 is not advertised by vendor
      return await (navigator as any).usb.requestDevice({ filters: [] });
    });

    if (!device) {
      return { success: false, error: 'No printer device selected.' };
    }

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    cachedUsbDevice = device;
    return { success: true, device };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'User cancelled USB printer pairing or access was denied.',
    };
  }
}

/**
 * Sends raw ESC/POS bytes directly over WebUSB
 */
export async function sendWebUsbPrint(
  data: Uint8Array,
  _targetConfig: SinglePrinterConfig
): Promise<PrintDispatchResult> {
  void _targetConfig;
  if (typeof navigator === 'undefined' || !('usb' in navigator) || !(navigator as any).usb) {
    return {
      success: false,
      targetUsed: 'webusb',
      error:
        'WebUSB is not supported in this browser (iOS Safari, Firefox). Use Chrome/Edge or Browser Print.',
    };
  }

  try {
    let device = cachedUsbDevice;

    // Check if previously paired device is still connected and open
    if (!device || !device.opened) {
      const devices = await (navigator as any).usb.getDevices();
      if (devices.length > 0) {
        device = devices[0];
        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }
        cachedUsbDevice = device;
      } else {
        const connectRes = await connectWebUsbPrinter();
        if (!connectRes.success || !connectRes.device) {
          return {
            success: false,
            targetUsed: 'webusb',
            error: connectRes.error || 'Failed to connect to USB printer.',
          };
        }
        device = connectRes.device;
      }
    }

    // Locate bulk OUT endpoint
    let outEndpoint = 1;
    let interfaceNumber = 0;

    const interfaces = device.configuration?.interfaces || [];
    for (const iface of interfaces) {
      for (const alt of iface.alternates || []) {
        for (const ep of alt.endpoints || []) {
          if (ep.direction === 'out') {
            outEndpoint = ep.endpointNumber;
            interfaceNumber = iface.interfaceNumber;
            break;
          }
        }
      }
    }

    try {
      await device.claimInterface(interfaceNumber);
    } catch {
      // Interface might already be claimed
    }

    const transferResult = await device.transferOut(outEndpoint, data);
    if (transferResult.status === 'ok') {
      return {
        success: true,
        targetUsed: 'webusb',
        message: `Direct USB print job dispatched (${data.byteLength} bytes).`,
      };
    } else {
      return {
        success: false,
        targetUsed: 'webusb',
        error: `USB transfer finished with status: ${transferResult.status}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      targetUsed: 'webusb',
      error: err?.message || 'Failed to send data to USB printer.',
    };
  }
}

/**
 * Connects and pairs with a Serial Thermal Printer via Web Serial API
 */
export async function connectWebSerialPrinter(
  baudRate = 9600
): Promise<{ success: boolean; port?: any; error?: string }> {
  if (typeof navigator === 'undefined' || !('serial' in navigator) || !(navigator as any).serial) {
    return {
      success: false,
      error:
        'Web Serial API is not supported in this browser. Please use Chrome or Edge on Desktop/Android, or switch to Browser Print.',
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate });
    cachedSerialPort = port;
    return { success: true, port };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'User cancelled serial port selection or port was busy.',
    };
  }
}

/**
 * Sends raw ESC/POS bytes directly over Web Serial (RS232 / USB-COM)
 */
export async function sendWebSerialPrint(
  data: Uint8Array,
  targetConfig: SinglePrinterConfig
): Promise<PrintDispatchResult> {
  if (typeof navigator === 'undefined' || !('serial' in navigator) || !(navigator as any).serial) {
    return {
      success: false,
      targetUsed: 'webserial',
      error:
        'Web Serial API is not supported in this browser (iOS Safari, Firefox). Use Chrome/Edge or Browser Print.',
    };
  }

  try {
    let port = cachedSerialPort;

    if (!port || !port.writable) {
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) {
        port = ports[0];
        try {
          await port.open({ baudRate: targetConfig.serialBaudRate || 9600 });
        } catch {
          // May already be open
        }
        cachedSerialPort = port;
      } else {
        const conn = await connectWebSerialPrinter(targetConfig.serialBaudRate || 9600);
        if (!conn.success || !conn.port) {
          return {
            success: false,
            targetUsed: 'webserial',
            error: conn.error || 'Failed to open serial printer port.',
          };
        }
        port = conn.port;
      }
    }

    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();

    return {
      success: true,
      targetUsed: 'webserial',
      message: `Direct serial print job dispatched (${data.byteLength} bytes).`,
    };
  } catch (err: any) {
    return {
      success: false,
      targetUsed: 'webserial',
      error: err?.message || 'Failed to write bytes to serial printer port.',
    };
  }
}

/**
 * Sends raw ESC/POS bytes to a Network Printer (port 9100) via local LAN Print Bridge
 */
export async function sendNetworkBridgePrint(
  data: Uint8Array,
  targetConfig: SinglePrinterConfig
): Promise<PrintDispatchResult> {
  const bridgeUrl = (targetConfig.bridgeUrl || 'http://localhost:9123').replace(/\/+$/, '');
  const printerIp = targetConfig.networkIp || '192.168.1.200';
  const printerPort = targetConfig.networkPort || 9100;

  try {
    const base64Data = uint8ArrayToBase64(data);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${bridgeUrl}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printerIp,
        printerPort,
        data: base64Data,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        targetUsed: 'network',
        error: `Print Bridge responded with HTTP ${response.status}: ${errText}`,
      };
    }

    await response.json();
    return {
      success: true,
      targetUsed: 'network',
      message: `Network print job dispatched to ${printerIp}:${printerPort} via Print Bridge.`,
    };
  } catch (err: any) {
    const isOffline = err.name === 'AbortError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
    return {
      success: false,
      targetUsed: 'network',
      error: isOffline
        ? `Cannot reach local Print Bridge at ${bridgeUrl}. Please verify the bridge script is running (node scripts/print-bridge.mjs) or check printer IP ${printerIp}.`
        : err?.message || 'Failed to dispatch print job to network bridge.',
    };
  }
}

/**
 * Checks the health and availability of the local LAN Print Bridge
 */
export async function checkPrintBridgeHealth(bridgeUrl = 'http://localhost:9123'): Promise<{
  online: boolean;
  version?: string;
  error?: string;
}> {
  const cleanUrl = bridgeUrl.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${cleanUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return { online: true, version: data.bridgeVersion || '1.0.0' };
    }
    return { online: false, error: `Bridge returned HTTP ${res.status}` };
  } catch (err: any) {
    return {
      online: false,
      error: `Bridge unreachable at ${cleanUrl}. Run 'node scripts/print-bridge.mjs' on the POS host.`,
    };
  }
}

/**
 * Universal Print Dispatcher: Routes print job to requested transport with automatic fallback
 */
export async function dispatchPrintJob(params: {
  targetConfig: SinglePrinterConfig;
  rawEscPos?: Uint8Array;
  htmlContent: string;
  allowFallback?: boolean;
}): Promise<PrintDispatchResult> {
  const { targetConfig, rawEscPos, htmlContent, allowFallback = true } = params;
  const target = targetConfig.target;

  // 1. Direct Browser Print
  if (target === 'browser' || !rawEscPos) {
    return await sendBrowserPrint(htmlContent);
  }

  // 2. WebUSB
  if (target === 'webusb') {
    const result = await sendWebUsbPrint(rawEscPos, targetConfig);
    if (!result.success && allowFallback) {
      console.warn('[printerTransports] WebUSB print failed, falling back to Browser Print:', result.error);
      const fallback = await sendBrowserPrint(htmlContent);
      return {
        ...fallback,
        fallbackUsed: true,
        message: `WebUSB unavailable (${result.error}). Dispatched via Browser Print dialog.`,
      };
    }
    return result;
  }

  // 3. Web Serial
  if (target === 'webserial') {
    const result = await sendWebSerialPrint(rawEscPos, targetConfig);
    if (!result.success && allowFallback) {
      console.warn('[printerTransports] Web Serial print failed, falling back to Browser Print:', result.error);
      const fallback = await sendBrowserPrint(htmlContent);
      return {
        ...fallback,
        fallbackUsed: true,
        message: `Web Serial unavailable (${result.error}). Dispatched via Browser Print dialog.`,
      };
    }
    return result;
  }

  // 4. Network Print Bridge
  if (target === 'network') {
    const result = await sendNetworkBridgePrint(rawEscPos, targetConfig);
    if (!result.success && allowFallback) {
      console.warn('[printerTransports] Network bridge print failed, falling back to Browser Print:', result.error);
      const fallback = await sendBrowserPrint(htmlContent);
      return {
        ...fallback,
        fallbackUsed: true,
        message: `Network print bridge error (${result.error}). Dispatched via Browser Print dialog.`,
      };
    }
    return result;
  }

  // Default fallback
  return await sendBrowserPrint(htmlContent);
}
