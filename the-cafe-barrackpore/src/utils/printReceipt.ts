/**
 * Thermal Receipt & Kitchen Order Ticket (KOT) Print Engine
 * Commercial Grade — Supports 80mm & 58mm POS Receipt Printers
 * Zero Cost — 100% Client-Side Native Web Printing
 */

import { clientDetails } from '../config/client';
import type { KitchenOrder } from '../services/kitchenService';
import type { OrderRecord, OrderType } from '../types/order';

export interface PrintReceiptOptions {
  paperWidth?: '80mm' | '58mm';
  copies?: number;
  stationName?: string;
  autoPrint?: boolean;
}

export interface PrintableOrderData {
  order_ref: string;
  order_type: OrderType | string;
  table_number?: string | null;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  special_requests?: string | null;
  notes?: string | null;
  subtotal?: number;
  total?: number;
  total_amount?: number;
  tax_amount?: number;
  payment_status?: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  paid_at?: string | null;
  discount_amount?: number | null;
  currency?: string;
  items?: AnyPrintableItem[];
}

export type AnyPrintableOrder = KitchenOrder | OrderRecord | PrintableOrderData;
export type AnyPrintableItem = {
  id?: string;
  item_name: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
  selected_options?: Record<string, unknown>;
};

/**
 * Strips HTML and sanitizes text for thermal printer output
 */
function sanitizeText(str?: string | null): string {
  if (!str) return '';
  return str.replace(/[<>&"']/g, '').trim();
}

/**
 * Formats currency amount
 */
function formatCurrency(amount?: number | null, currency = '₹'): string {
  if (amount === undefined || amount === null) return `${currency}0.00`;
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Formats a Date/Time stamp for thermal tickets
 */
function formatTicketDateTime(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Extracts items array from order or separate items list
 */
function resolveItems(
  order: AnyPrintableOrder,
  customItems?: AnyPrintableItem[]
): AnyPrintableItem[] {
  if (customItems && customItems.length > 0) return customItems;
  if ('items' in order && Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }
  return [];
}

/**
 * Creates an isolated hidden iframe and prints the HTML payload
 */
function executeThermalPrint(htmlContent: string): void {
  if (typeof window === 'undefined') return;

  // Remove any stale print iframes
  const existingFrame = document.getElementById('thermal-print-frame');
  if (existingFrame) existingFrame.remove();

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
    console.error('[printReceipt] Failed to access print iframe document.');
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Allow styles & fonts to render before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('[printReceipt] Native print dialog trigger:', err);
    } finally {
      // Clean up iframe after print dialog closes
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }
  }, 350);
}

/**
 * Generates Base Thermal CSS Styles
 */
function getThermalStyles(paperWidth: '80mm' | '58mm' = '80mm'): string {
  const printableWidth = paperWidth === '58mm' ? '48mm' : '72mm';
  const fontSize = paperWidth === '58mm' ? '11px' : '13px';
  const headerSize = paperWidth === '58mm' ? '14px' : '17px';
  const tableBadgeSize = paperWidth === '58mm' ? '18px' : '22px';

  return `
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, system-ui;
      font-size: ${fontSize};
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: ${printableWidth};
      margin: 0 auto;
      padding: 8px 4px 24px 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    .title {
      font-size: ${headerSize};
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .table-badge {
      background: #000;
      color: #fff;
      font-size: ${tableBadgeSize};
      font-weight: bold;
      padding: 4px 8px;
      margin: 6px 0;
      display: inline-block;
      text-transform: uppercase;
      border-radius: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 4px 0;
    }
    .item-qty {
      font-size: 1.15em;
      font-weight: bold;
      min-width: 28px;
    }
    .item-name {
      flex: 1;
      font-weight: bold;
      padding: 0 4px;
    }
    .item-options {
      font-size: 0.9em;
      color: #333;
      padding-left: 28px;
      font-style: italic;
      margin-top: 1px;
    }
    .note-box {
      border: 1.5px solid #000;
      padding: 4px 6px;
      margin: 6px 0;
      font-weight: bold;
    }
    .footer {
      font-size: 0.85em;
      text-align: center;
      margin-top: 10px;
    }
  `;
}

/**
 * 1. PRINTS KITCHEN ORDER TICKET (KOT)
 * Formatted for Line Cooks, Chefs, and Expeditors
 */
export function printKitchenKOT(
  order: AnyPrintableOrder,
  customItems?: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): void {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = clientDetails.businessName || 'The Cafe';
  const items = resolveItems(order, customItems);
  const isDineIn = order.order_type === 'dine_in';
  const tableDisplay = isDineIn
    ? `TABLE #${order.table_number || 'N/A'}`
    : '*** TAKEAWAY ***';
  const timestamp = formatTicketDateTime(order.created_at);

  const itemsHtml = items.map((item) => {
    let optionsText = '';
    if (item.selected_options && typeof item.selected_options === 'object') {
      const opts = Object.entries(item.selected_options)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (opts) optionsText = `<div class="item-options">* ${sanitizeText(opts)}</div>`;
    }

    return `
      <div class="item-block">
        <div class="item-row">
          <span class="item-qty">${item.quantity}x</span>
          <span class="item-name">${sanitizeText(item.item_name)}</span>
        </div>
        ${optionsText}
      </div>
    `;
  }).join('');

  const chefNotesHtml = order.special_requests && order.special_requests.trim()
    ? `
      <div class="note-box">
        <div style="font-size: 0.8em; text-transform: uppercase;">SPECIAL CHEF INSTRUCTION:</div>
        <div>"${sanitizeText(order.special_requests)}"</div>
      </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>KOT - ${order.order_ref}</title>
        <style>${getThermalStyles(paperWidth)}</style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 0.9em; font-weight: bold; text-transform: uppercase;">${sanitizeText(restaurantName)}</div>
          <div class="title">KITCHEN ORDER TICKET</div>
          <div class="table-badge">${tableDisplay}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>KOT Ref: <strong class="bold">${order.order_ref}</strong></span>
          <span>${isDineIn ? 'Dine-In' : 'Takeaway'}</span>
        </div>
        <div class="row">
          <span>Time: ${timestamp}</span>
          <span>Guest: ${sanitizeText(order.customer_name || 'Guest')}</span>
        </div>
        ${options.stationName ? `<div class="row"><span>Station:</span><strong>${options.stationName}</strong></div>` : ''}

        <div class="double-divider"></div>

        <div style="margin: 4px 0;">
          ${itemsHtml}
        </div>

        ${chefNotesHtml}

        <div class="divider"></div>
        <div class="text-center bold" style="font-size: 0.85em; margin-top: 4px;">
          === END OF KOT (${items.reduce((s, i) => s + (i.quantity || 1), 0)} TOTAL ITEMS) ===
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(html);
}

/**
 * 2. PRINTS GUEST TAX RECEIPT / INVOICE
 * Formatted for Customers with GST/Tax, discounts, payment status
 */
export function printCustomerReceipt(
  order: AnyPrintableOrder,
  customItems?: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): void {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = clientDetails.businessName || 'The Cafe';
  const address = clientDetails.address || '';
  const phone = clientDetails.displayPhone || clientDetails.phone || '';
  const items = resolveItems(order, customItems);
  const isDineIn = order.order_type === 'dine_in';
  const timestamp = formatTicketDateTime(order.created_at);

  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + (item.line_total || ((item.unit_price || 0) * item.quantity)), 0);
  const total = order.total ?? subtotal;
  const discount = ('discount_amount' in order && order.discount_amount) ? order.discount_amount : 0;
  const currency = ('currency' in order && order.currency === 'USD') ? '$' : '₹';

  const itemsHtml = items.map((item) => {
    const unitPrice = item.unit_price || 0;
    const lineTotal = item.line_total || (unitPrice * item.quantity);

    return `
      <div class="item-row" style="font-weight: normal; font-size: 0.95em;">
        <span style="min-width: 22px;">${item.quantity}x</span>
        <span style="flex: 1; padding: 0 4px;">${sanitizeText(item.item_name)}</span>
        <span style="text-align: right; min-width: 55px;">${formatCurrency(lineTotal, currency)}</span>
      </div>
    `;
  }).join('');

  const paymentStatusDisplay = (order.payment_status === 'paid' || ('paid_at' in order && order.paid_at))
    ? 'PAID'
    : 'PAYMENT DUE AT COUNTER';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${order.order_ref}</title>
        <style>${getThermalStyles(paperWidth)}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${sanitizeText(restaurantName)}</div>
          ${address ? `<div style="font-size: 0.85em; color: #333;">${sanitizeText(address)}</div>` : ''}
          ${phone ? `<div style="font-size: 0.85em; color: #333;">Phone: ${sanitizeText(phone)}</div>` : ''}
          <div style="font-weight: bold; margin-top: 4px; text-transform: uppercase;">TAX INVOICE / GUEST BILL</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Bill Ref: <strong>${order.order_ref}</strong></span>
          <span>${isDineIn ? `Table ${order.table_number || '--'}` : 'Takeaway'}</span>
        </div>
        <div class="row">
          <span>Date: ${timestamp}</span>
        </div>
        <div class="row">
          <span>Guest: ${sanitizeText(order.customer_name || 'Guest')}</span>
          ${order.customer_phone ? `<span>Ph: ${sanitizeText(order.customer_phone)}</span>` : ''}
        </div>

        <div class="double-divider"></div>

        <div class="row bold" style="font-size: 0.9em; margin-bottom: 4px;">
          <span>QTY & ITEM</span>
          <span>AMOUNT</span>
        </div>
        <div class="divider"></div>

        <div>${itemsHtml}</div>

        <div class="divider"></div>

        <div class="row">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal, currency)}</span>
        </div>

        ${discount > 0 ? `
          <div class="row" style="color: #222;">
            <span>Discount</span>
            <span>-${formatCurrency(discount, currency)}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>

        <div class="row bold" style="font-size: 1.15em; margin: 4px 0;">
          <span>TOTAL DUE</span>
          <span>${formatCurrency(total, currency)}</span>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Status:</span>
          <strong>${paymentStatusDisplay}</strong>
        </div>
        ${('payment_provider' in order && order.payment_provider) ? `<div class="row"><span>Method:</span><span>${order.payment_provider}</span></div>` : ''}

        <div class="footer">
          <div>Thank you for dining with us!</div>
          <div>Please visit us again.</div>
          <div style="margin-top: 4px; font-size: 0.8em; color: #555;">GST Inclusive • Powered by Caffe OS</div>
        </div>
      </body>
    </html>
  `;

  executeThermalPrint(html);
}
