/**
 * Thermal Receipt & Kitchen Order Ticket (KOT) Print Engine
 * Commercial Grade — Supports 80mm & 58mm POS Receipt Printers
 * Supports Native Browser Print (@page CSS), Direct WebUSB, Direct Web Serial, and Local LAN Print Bridge
 * Zero External Paid Dependencies — 100% Native Architecture
 */

import { clientDetails } from '../config/client';
import type { KitchenOrder } from '../services/kitchenService';
import type { OrderRecord, OrderType } from '../types/order';
import type { ZReportData } from '../types/billing';
import {
  getStationPrinterSettings,
  routeItemToStation,
  type SinglePrinterConfig,
  type ThermalPaperWidth,
  type PrintTargetType,
} from '../config/printerSettings';
import { createEscPos, sanitizeThermalText } from './escpos';
import { dispatchPrintJob, type PrintDispatchResult } from './printerTransports';
import { getCurrencySymbol } from './currency';

export interface PrintReceiptOptions {
  currency?: string;
  paperWidth?: ThermalPaperWidth;
  target?: PrintTargetType;
  station?: 'receipt' | 'kitchen' | 'bar';
  stationName?: string;
  isReprint?: boolean;
  isDuplicate?: boolean;
  autoCut?: boolean;
  openCashDrawer?: boolean;
  cashDrawerPin?: 0 | 1;
  qrData?: string;
  upiVpa?: string;
  tipAmount?: number;
  taxLabel?: string;
  taxRate?: number;
  taxRules?: Array<{ label: string; rate: number; amount?: number }>;
  taxId?: string;
  taxIdLabel?: string;
  ratesAsOf?: string;
  serviceChargeAmount?: number;
  serviceChargeLabel?: string;
  discountAmount?: number;
  discountCode?: string;
  businessName?: string;
  address?: string;
  phone?: string;
  website?: string;
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
  discount_code?: string | null;
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
  category?: string;
  category_id?: string;
  isNew?: boolean;
  isAdded?: boolean;
  status?: string;
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
function formatCurrency(amount?: number | null, currency = 'INR'): string {
  const symbol = (currency.length <= 4 && !/^[A-Z]{3}$/.test(currency)) ? currency : getCurrencySymbol(currency);
  if (amount === undefined || amount === null) return `${symbol}0.00`;
  return `${symbol}${amount.toFixed(2)}`;
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
 * Generates Base Thermal CSS Styles for @page Browser Print
 */
function getThermalStyles(paperWidth: ThermalPaperWidth = '80mm'): string {
  const printableWidth = paperWidth === '58mm' ? '48mm' : '72mm';
  const fontSize = paperWidth === '58mm' ? '11px' : '13px';
  const headerSize = paperWidth === '58mm' ? '14px' : '17px';
  const tableBadgeSize = paperWidth === '58mm' ? '17px' : '21px';

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
      padding: 6px 4px 20px 4px;
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
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .reprint-banner {
      background: #000;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1px;
      text-align: center;
      padding: 4px;
      margin-bottom: 6px;
      border-radius: 3px;
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
    .item-marker {
      background: #000;
      color: #fff;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 2px;
      margin-left: 4px;
      vertical-align: middle;
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
    .qr-container {
      text-align: center;
      margin: 10px 0 6px 0;
    }
    .qr-container img {
      width: ${paperWidth === '58mm' ? '120px' : '150px'};
      height: ${paperWidth === '58mm' ? '120px' : '150px'};
      margin: 0 auto;
      display: block;
    }
    .footer {
      font-size: 0.85em;
      text-align: center;
      margin-top: 10px;
    }
  `;
}

// -----------------------------------------------------------------------------
// 1. KITCHEN ORDER TICKET (KOT)
// -----------------------------------------------------------------------------

/**
 * Builds ESC/POS Byte Array for Kitchen / Bar Order Ticket (KOT)
 */
export function buildKotEscPos(
  order: AnyPrintableOrder,
  items: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): Uint8Array {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = options.businessName || clientDetails.businessName || 'The Cafe';
  const isReprint = Boolean(options.isReprint || options.isDuplicate);
  const isDineIn = order.order_type === 'dine_in';
  const tableDisplay = isDineIn ? `TABLE #${order.table_number || 'N/A'}` : '*** TAKEAWAY ***';
  const timestamp = formatTicketDateTime(order.created_at);
  const stationTitle = options.stationName ? `${options.stationName.toUpperCase()} KOT` : 'KITCHEN ORDER TICKET';

  const builder = createEscPos(paperWidth)
    .init()
    .align('center');

  // Duplicate / Reprint Banner
  if (isReprint) {
    builder
      .invert(true)
      .bold(true)
      .line(' *** DUPLICATE / REPRINT *** ')
      .invert(false)
      .bold(false)
      .feed(1);
  }

  // Header
  builder
    .bold(true)
    .text(restaurantName)
    .feed(1)
    .size('double-height')
    .line(stationTitle)
    .size('normal')
    .badge(tableDisplay)
    .divider()
    .align('left');

  // Metadata
  builder
    .row(`KOT Ref: ${order.order_ref}`, isDineIn ? 'Dine-In' : 'Takeaway')
    .row(`Time: ${timestamp}`, `Guest: ${sanitizeThermalText(order.customer_name || 'Guest')}`);

  if (options.stationName) {
    builder.row('Station:', options.stationName);
  }

  builder.doubleDivider();

  // Items
  for (const item of items) {
    const isNewMarker = item.isNew || item.isAdded || item.status === 'added' ? ' [NEW/ADDED]' : '';
    builder.threeColumn(`${item.quantity}x`, `${item.item_name}${isNewMarker}`, '');

    if (item.selected_options && typeof item.selected_options === 'object') {
      const opts = Object.entries(item.selected_options)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (opts) {
        builder.line(`   * ${opts}`);
      }
    }
  }

  builder.divider();

  // Special Instructions
  const specialRequests = order.special_requests || (order as any).notes;
  if (specialRequests && specialRequests.trim()) {
    builder.box(specialRequests.trim(), 'Special Chef Note');
  }

  // Footer & Item Count
  const totalCount = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  builder
    .align('center')
    .bold(true)
    .line(`=== END OF KOT (${totalCount} TOTAL ITEMS) ===`)
    .bold(false);

  if (isReprint) {
    builder.feed(1).invert(true).line(' *** DUPLICATE - DO NOT RE-PREPARE *** ').invert(false);
  }

  if (options.autoCut !== false) {
    builder.cut(false, 4);
  } else {
    builder.feed(3);
  }

  return builder.build();
}

/**
 * Builds HTML representation for KOT Browser Print
 */
export function buildKotHtml(
  order: AnyPrintableOrder,
  items: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): string {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = options.businessName || clientDetails.businessName || 'The Cafe';
  const isReprint = Boolean(options.isReprint || options.isDuplicate);
  const isDineIn = order.order_type === 'dine_in';
  const tableDisplay = isDineIn ? `TABLE #${order.table_number || 'N/A'}` : '*** TAKEAWAY ***';
  const timestamp = formatTicketDateTime(order.created_at);
  const stationTitle = options.stationName ? `${options.stationName.toUpperCase()} KOT` : 'KITCHEN ORDER TICKET';

  const itemsHtml = items.map((item) => {
    let optionsText = '';
    if (item.selected_options && typeof item.selected_options === 'object') {
      const opts = Object.entries(item.selected_options)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (opts) optionsText = `<div class="item-options">* ${sanitizeText(opts)}</div>`;
    }

    const isNew = item.isNew || item.isAdded || item.status === 'added';

    return `
      <div class="item-block">
        <div class="item-row">
          <span class="item-qty">${item.quantity}x</span>
          <span class="item-name">
            ${sanitizeText(item.item_name)}
            ${isNew ? '<span class="item-marker">NEW/ADDED</span>' : ''}
          </span>
        </div>
        ${optionsText}
      </div>
    `;
  }).join('');

  const specialRequests = order.special_requests || (order as any).notes;
  const chefNotesHtml = specialRequests && specialRequests.trim()
    ? `
      <div class="note-box">
        <div style="font-size: 0.8em; text-transform: uppercase;">SPECIAL CHEF INSTRUCTION:</div>
        <div>"${sanitizeText(specialRequests)}"</div>
      </div>
    `
    : '';

  const totalCount = items.reduce((sum, it) => sum + (it.quantity || 1), 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>KOT - ${order.order_ref}</title>
        <style>${getThermalStyles(paperWidth)}</style>
      </head>
      <body>
        ${isReprint ? '<div class="reprint-banner">*** DUPLICATE / REPRINT ***</div>' : ''}
        <div class="text-center">
          <div style="font-size: 0.9em; font-weight: bold; text-transform: uppercase;">${sanitizeText(restaurantName)}</div>
          <div class="title">${stationTitle}</div>
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
          === END OF KOT (${totalCount} TOTAL ITEMS) ===
        </div>
        ${isReprint ? '<div class="reprint-banner" style="margin-top: 8px;">*** DUPLICATE - DO NOT RE-PREPARE ***</div>' : ''}
      </body>
    </html>
  `;
}

/**
 * Dispatches Kitchen Order Ticket (KOT)
 * Routes automatically by category to Kitchen and Bar if enabled.
 */
export async function printKitchenKOT(
  order: AnyPrintableOrder,
  customItems?: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): Promise<PrintDispatchResult[]> {
  const stationSettings = getStationPrinterSettings();
  const allItems = resolveItems(order, customItems);
  const results: PrintDispatchResult[] = [];

  // Category Routing: Split into Kitchen vs Bar
  if (stationSettings.enableCategoryRouting && stationSettings.bar.enabled && !options.station) {
    const kitchenItems: AnyPrintableItem[] = [];
    const barItems: AnyPrintableItem[] = [];

    for (const it of allItems) {
      const catKey = it.category || it.category_id || it.item_name;
      const targetStation = routeItemToStation(catKey, stationSettings);
      if (targetStation === 'bar') {
        barItems.push(it);
      } else {
        kitchenItems.push(it);
      }
    }

    // 1. Print Kitchen Ticket
    if (kitchenItems.length > 0) {
      const targetConfig = stationSettings.kitchen;
      const paperWidth = options.paperWidth || targetConfig.paperWidth;
      const opts: PrintReceiptOptions = { ...options, paperWidth, stationName: 'Kitchen' };
      const escpos = buildKotEscPos(order, kitchenItems, opts);
      const html = buildKotHtml(order, kitchenItems, opts);
      const res = await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
      results.push(res);
    }

    // 2. Print Bar Ticket
    if (barItems.length > 0) {
      const targetConfig = stationSettings.bar;
      const paperWidth = options.paperWidth || targetConfig.paperWidth;
      const opts: PrintReceiptOptions = { ...options, paperWidth, stationName: 'Bar & Sips' };
      const escpos = buildKotEscPos(order, barItems, opts);
      const html = buildKotHtml(order, barItems, opts);
      const res = await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
      results.push(res);
    }

    return results;
  }

  // Unified Single Ticket Dispatch
  const targetConfig =
    options.station === 'bar'
      ? stationSettings.bar
      : options.station === 'kitchen'
      ? stationSettings.kitchen
      : stationSettings.kitchen.enabled
      ? stationSettings.kitchen
      : stationSettings.receipt;

  const paperWidth = options.paperWidth || targetConfig.paperWidth || '80mm';
  const opts: PrintReceiptOptions = { ...options, paperWidth };
  const escpos = buildKotEscPos(order, allItems, opts);
  const html = buildKotHtml(order, allItems, opts);

  const res = await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
  results.push(res);
  return results;
}

// -----------------------------------------------------------------------------
// 2. CUSTOMER BILL & TAX INVOICE
// -----------------------------------------------------------------------------

/**
 * Builds ESC/POS Byte Array for Customer Bill / Tax Invoice
 */
export function buildBillEscPos(
  order: AnyPrintableOrder,
  items: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): Uint8Array {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = options.businessName || clientDetails.businessName || 'The Cafe';
  const address = options.address || clientDetails.address || '';
  const phone = options.phone || clientDetails.displayPhone || clientDetails.phone || '';
  const website = options.website || clientDetails.staffDomain || 'thecafebarrackpore.com';
  const isDineIn = order.order_type === 'dine_in';
  const timestamp = formatTicketDateTime(order.created_at);

  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + (item.line_total || ((item.unit_price || 0) * item.quantity)), 0);
  const total = order.total ?? subtotal;
  const discount = options.discountAmount ?? (('discount_amount' in order && order.discount_amount) ? order.discount_amount : 0);
  const tipAmount = options.tipAmount ?? 0;
  const serviceCharge = options.serviceChargeAmount ?? 0;
  const currencySymbol = ('currency' in order && order.currency === 'USD') ? '$' : 'Rs. ';

  const isPaid = order.payment_status === 'paid' || Boolean(('paid_at' in order && order.paid_at));
  const paymentStatusDisplay = isPaid ? 'PAID' : 'PAYMENT DUE AT COUNTER';

  const builder = createEscPos(paperWidth)
    .init()
    .align('center')
    .bold(true)
    .size('double-height')
    .line(restaurantName)
    .size('normal')
    .bold(false);

  if (address) builder.line(address);
  if (phone) builder.line(`Phone: ${phone}`);
  if (options.taxId) builder.line(`${options.taxIdLabel || 'GSTIN'}: ${options.taxId}`);

  builder
    .feed(1)
    .bold(true)
    .line('TAX INVOICE / GUEST BILL')
    .bold(false)
    .divider()
    .align('left');

  // Metadata
  builder
    .row(`Bill Ref: ${order.order_ref}`, isDineIn ? `Table ${order.table_number || '--'}` : 'Takeaway')
    .row(`Date: ${timestamp}`, `Guest: ${sanitizeThermalText(order.customer_name || 'Guest')}`);

  if (order.customer_phone) {
    builder.line(`Phone: ${order.customer_phone}`);
  }

  builder.doubleDivider();

  // Columns header
  builder
    .bold(true)
    .threeColumn('QTY', 'ITEM', 'AMOUNT')
    .bold(false)
    .divider();

  // Item Lines
  for (const item of items) {
    const unitPrice = item.unit_price || 0;
    const lineTotal = item.line_total || (unitPrice * item.quantity);
    builder.threeColumn(`${item.quantity}x`, item.item_name, `${currencySymbol}${lineTotal.toFixed(2)}`);
  }

  builder.divider();

  // Subtotal
  builder.row('Subtotal', `${currencySymbol}${subtotal.toFixed(2)}`);

  // Discount
  if (discount > 0) {
    const discLabel = options.discountCode ? `Discount (${options.discountCode})` : 'Discount';
    builder.row(discLabel, `-${currencySymbol}${discount.toFixed(2)}`);
  }

  // Tax Breakdown
  if (options.taxRules && options.taxRules.length > 0) {
    for (const rule of options.taxRules) {
      const amt = rule.amount !== undefined ? rule.amount : (subtotal * rule.rate);
      builder.row(`${rule.label} (${(rule.rate * 100).toFixed(1)}%)`, `${currencySymbol}${amt.toFixed(2)}`);
    }
  } else if (options.taxRate && options.taxRate > 0) {
    const taxAmt = (order as any).tax_amount ?? (order as any).tax ?? (subtotal * options.taxRate);
    builder.row(`${options.taxLabel || 'Tax'} (${(options.taxRate * 100).toFixed(1)}%)`, `${currencySymbol}${taxAmt.toFixed(2)}`);
  }

  if (options.ratesAsOf) {
    builder.row('Rates as of', options.ratesAsOf);
  }

  // Service Charge
  if (serviceCharge > 0) {
    builder.row(options.serviceChargeLabel || 'Service Charge', `${currencySymbol}${serviceCharge.toFixed(2)}`);
  }

  // Tips
  if (tipAmount > 0) {
    builder.row('Staff Gratuity / Tip', `${currencySymbol}${tipAmount.toFixed(2)}`);
  }

  builder.doubleDivider();

  // Total Due / Paid
  builder
    .size('double-height')
    .bold(true)
    .row('TOTAL DUE', `${currencySymbol}${total.toFixed(2)}`)
    .size('normal')
    .bold(false)
    .divider();

  // Settlement Details
  builder.row('Status:', paymentStatusDisplay);
  const orderAny = order as any;
  if (orderAny.payment_provider) {
    builder.row('Method:', String(orderAny.payment_provider).toUpperCase());
  }

  // QR Code Generation
  const upiId = options.upiVpa || 'thecafe@upi';
  const qrString = options.qrData || (!isPaid ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(restaurantName)}&am=${total}&cu=INR&tn=${order.order_ref}` : `https://${website}/order-success?ref=${order.order_ref}`);

  builder
    .feed(1)
    .align('center')
    .text(!isPaid ? 'SCAN TO PAY VIA ANY UPI APP' : 'SCAN FOR DIGITAL RECEIPT & REVIEW')
    .feed(1)
    .qr(qrString)
    .feed(1);

  // Footer
  builder
    .align('center')
    .line('Thank you for dining with us!')
    .line('Please visit us again.')
    .line(`Visit: https://${website}`)
    .feed(1);

  // Cash Drawer Kick Pulse (if cash settlement enabled and payment is counter/cash)
  const isCash = !isPaid || orderAny.payment_provider === 'counter' || orderAny.payment_provider === 'cash';
  if (options.openCashDrawer || (isCash && options.openCashDrawer !== false)) {
    builder.cashDrawerPulse(options.cashDrawerPin || 0);
  }

  if (options.autoCut !== false) {
    builder.cut(false, 4);
  } else {
    builder.feed(3);
  }

  return builder.build();
}

/**
 * Builds HTML representation for Customer Bill Browser Print
 */
export function buildBillHtml(
  order: AnyPrintableOrder,
  items: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): string {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = options.businessName || clientDetails.businessName || 'The Cafe';
  const address = options.address || clientDetails.address || '';
  const phone = options.phone || clientDetails.displayPhone || clientDetails.phone || '';
  const website = options.website || clientDetails.staffDomain || 'thecafebarrackpore.com';
  const isDineIn = order.order_type === 'dine_in';
  const timestamp = formatTicketDateTime(order.created_at);

  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + (item.line_total || ((item.unit_price || 0) * item.quantity)), 0);
  const total = order.total ?? subtotal;
  const discount = options.discountAmount ?? (('discount_amount' in order && order.discount_amount) ? order.discount_amount : 0);
  const tipAmount = options.tipAmount ?? 0;
  const serviceCharge = options.serviceChargeAmount ?? 0;
  const currencySymbol = 'currency' in order && order.currency ? getCurrencySymbol(order.currency) : (options.currency ? getCurrencySymbol(options.currency) : '$');

  const isPaid = order.payment_status === 'paid' || Boolean(('paid_at' in order && order.paid_at));
  const paymentStatusDisplay = isPaid ? 'PAID' : 'PAYMENT DUE AT COUNTER';

  const itemsHtml = items.map((item) => {
    const unitPrice = item.unit_price || 0;
    const lineTotal = item.line_total || (unitPrice * item.quantity);

    return `
      <div class="item-row" style="font-weight: normal; font-size: 0.95em;">
        <span style="min-width: 22px;">${item.quantity}x</span>
        <span style="flex: 1; padding: 0 4px;">${sanitizeText(item.item_name)}</span>
        <span style="text-align: right; min-width: 55px;">${formatCurrency(lineTotal, currencySymbol)}</span>
      </div>
    `;
  }).join('');

  // Tax Rows
  let taxRowsHtml = '';
  if (options.taxRules && options.taxRules.length > 0) {
    taxRowsHtml = options.taxRules.map((rule) => {
      const amt = rule.amount !== undefined ? rule.amount : (subtotal * rule.rate);
      return `
        <div class="row">
          <span>${sanitizeText(rule.label)} (${(rule.rate * 100).toFixed(1)}%)</span>
          <span>${formatCurrency(amt, currencySymbol)}</span>
        </div>
      `;
    }).join('');
  } else if (options.taxRate && options.taxRate > 0) {
    const taxAmt = (order as any).tax_amount ?? (order as any).tax ?? (subtotal * options.taxRate);
    taxRowsHtml = `
      <div class="row">
        <span>${sanitizeText(options.taxLabel || 'Tax')} (${(options.taxRate * 100).toFixed(1)}%)</span>
        <span>${formatCurrency(taxAmt, currencySymbol)}</span>
      </div>
    `;
  }

  if (options.ratesAsOf) {
    taxRowsHtml += `
      <div class="row" style="font-size: 8px; color: #777; font-style: italic;">
        <span>Rates as of</span>
        <span>${options.ratesAsOf}</span>
      </div>
    `;
  }

  // QR Code URL
  const upiId = options.upiVpa || 'thecafe@upi';
  const qrString = options.qrData || (!isPaid ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(restaurantName)}&am=${total}&cu=INR&tn=${order.order_ref}` : `https://${website}/order-success?ref=${order.order_ref}`);
  const qrImgUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrString)}&size=160&margin=1`;

  return `
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
          ${options.taxId ? `<div style="font-size: 0.8em; color: #333;">${sanitizeText(options.taxIdLabel || 'GSTIN')}: ${sanitizeText(options.taxId)}</div>` : ''}
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
          <span>${formatCurrency(subtotal, currencySymbol)}</span>
        </div>

        ${discount > 0 ? `
          <div class="row" style="color: #222;">
            <span>${options.discountCode ? `Discount (${sanitizeText(options.discountCode)})` : 'Discount'}</span>
            <span>-${formatCurrency(discount, currencySymbol)}</span>
          </div>
        ` : ''}

        ${taxRowsHtml}

        ${serviceCharge > 0 ? `
          <div class="row">
            <span>${sanitizeText(options.serviceChargeLabel || 'Service Charge')}</span>
            <span>${formatCurrency(serviceCharge, currencySymbol)}</span>
          </div>
        ` : ''}

        ${tipAmount > 0 ? `
          <div class="row">
            <span>Staff Gratuity / Tip</span>
            <span>${formatCurrency(tipAmount, currencySymbol)}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>

        <div class="row bold" style="font-size: 1.15em; margin: 4px 0;">
          <span>TOTAL DUE</span>
          <span>${formatCurrency(total, currencySymbol)}</span>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Status:</span>
          <strong>${paymentStatusDisplay}</strong>
        </div>
        ${('payment_provider' in order && order.payment_provider) ? `<div class="row"><span>Method:</span><span>${order.payment_provider}</span></div>` : ''}

        <div class="qr-container">
          <div style="font-size: 0.75em; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">
            ${!isPaid ? 'Scan to Pay via any UPI App' : 'Scan for Digital Bill & Review'}
          </div>
          <img src="${qrImgUrl}" alt="QR Code" />
        </div>

        <div class="footer">
          <div>Thank you for dining with us!</div>
          <div>Please visit us again.</div>
          <div style="margin-top: 4px; font-size: 0.8em; color: #555;">GST Inclusive • Powered by Caffe OS</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Dispatches Customer Bill / Tax Invoice
 */
export async function printCustomerReceipt(
  order: AnyPrintableOrder,
  customItems?: AnyPrintableItem[],
  options: PrintReceiptOptions = {}
): Promise<PrintDispatchResult> {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = stationSettings.receipt;
  const items = resolveItems(order, customItems);

  const paperWidth = options.paperWidth || targetConfig.paperWidth || '80mm';
  const openCashDrawer = options.openCashDrawer ?? targetConfig.openCashDrawer ?? true;
  const opts: PrintReceiptOptions = {
    ...options,
    paperWidth,
    openCashDrawer,
    cashDrawerPin: targetConfig.cashDrawerPin || 0,
  };

  const escpos = buildBillEscPos(order, items, opts);
  const html = buildBillHtml(order, items, opts);

  return await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
}

// -----------------------------------------------------------------------------
// 3. CASH DRAWER KICK PULSE
// -----------------------------------------------------------------------------

/**
 * Sends ESC/POS Cash Drawer Kick Pulse command immediately
 */
export async function kickCashDrawer(
  printerConfig?: SinglePrinterConfig
): Promise<PrintDispatchResult> {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = printerConfig || stationSettings.receipt;
  const pin = targetConfig.cashDrawerPin || 0;

  const builder = createEscPos(targetConfig.paperWidth || '80mm')
    .cashDrawerPulse(pin, 25, 250);

  const escpos = builder.build();

  // If target is network bridge, use dedicated /drawer endpoint
  if (targetConfig.target === 'network') {
    const bridgeUrl = (targetConfig.bridgeUrl || 'http://localhost:9123').replace(/\/+$/, '');
    try {
      const res = await fetch(`${bridgeUrl}/drawer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: targetConfig.networkIp || '192.168.1.200',
          printerPort: targetConfig.networkPort || 9100,
          pin,
        }),
      });
      if (res.ok) {
        return { success: true, targetUsed: 'network', message: 'Cash drawer kick pulse sent via bridge.' };
      }
    } catch {
      // Fallback to raw ESC/POS dispatch below
    }
  }

  // HTML print dialog cannot kick a drawer; return clear message
  if (targetConfig.target === 'browser') {
    return {
      success: false,
      targetUsed: 'browser',
      message: 'Browser Print cannot send hardware drawer kick pulses. Configure WebUSB, Web Serial, or Network Bridge.',
    };
  }

  return await dispatchPrintJob({
    targetConfig,
    rawEscPos: escpos,
    htmlContent: '<html><body>Drawer Kick Test</body></html>',
    allowFallback: false,
  });
}

// -----------------------------------------------------------------------------
// 4. FINANCIAL Z-REPORT (DAILY / SHIFT CASH DRAWER & TENDERS SUMMARY)
// -----------------------------------------------------------------------------

/**
 * Builds ESC/POS Byte Array for Z-Report thermal printing
 */
export function buildZReportEscPos(
  zReport: ZReportData,
  options: PrintReceiptOptions = {}
): Uint8Array {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = zReport.restaurantName || clientDetails.businessName || 'The Cafe';
  const currencySymbol = 'Rs. ';

  const builder = createEscPos(paperWidth)
    .init()
    .align('center')
    .bold(true)
    .size('double-height')
    .line(restaurantName)
    .size('normal')
    .line('DAILY FINANCIAL Z-REPORT')
    .bold(false)
    .divider()
    .align('left');

  builder
    .row(`Shift #: ${zReport.shiftNumber}`, `Txns: ${zReport.totalTransactionCount}`)
    .row(`Opened: ${formatTicketDateTime(zReport.openedAt)}`, '')
    .row(`Closed: ${formatTicketDateTime(zReport.closedAt)}`, '')
    .row(`Opened By: ${sanitizeThermalText(zReport.openedByName)}`, '')
    .row(`Closed By: ${sanitizeThermalText(zReport.closedByName)}`, '')
    .divider();

  // Cash Drawer Section
  builder
    .bold(true)
    .line('CASH DRAWER RECONCILIATION:')
    .bold(false)
    .row('Opening Float:', `${currencySymbol}${zReport.openingFloat.toFixed(2)}`)
    .row('Cash Sales:', `${currencySymbol}${zReport.cashSales.toFixed(2)}`)
    .row('Cash In (Paid In):', `+${currencySymbol}${zReport.cashInTotal.toFixed(2)}`)
    .row('Cash Out (Paid Out):', `-${currencySymbol}${zReport.cashOutTotal.toFixed(2)}`)
    .row('Cash Refunds:', `-${currencySymbol}${zReport.cashRefunds.toFixed(2)}`)
    .divider()
    .bold(true)
    .row('Expected in Drawer:', `${currencySymbol}${zReport.expectedCashInDrawer.toFixed(2)}`)
    .row('Counted in Drawer:', `${currencySymbol}${zReport.countedCashInDrawer.toFixed(2)}`)
    .row(
      'Difference (Variance):',
      `${zReport.variance >= 0 ? '+' : ''}${currencySymbol}${zReport.variance.toFixed(2)} ${zReport.variance === 0 ? '(EXACT)' : zReport.variance > 0 ? '(OVER)' : '(SHORT)'}`
    )
    .bold(false)
    .divider();

  // Tenders Section
  builder
    .bold(true)
    .line('SALES BY TENDER TYPE:')
    .bold(false)
    .row(`Cash (${zReport.tenderCounts.cash}x):`, `${currencySymbol}${zReport.tenderBreakdown.cash.toFixed(2)}`)
    .row(`Card (${zReport.tenderCounts.card}x):`, `${currencySymbol}${zReport.tenderBreakdown.card.toFixed(2)}`)
    .row(`UPI (${zReport.tenderCounts.upi}x):`, `${currencySymbol}${zReport.tenderBreakdown.upi.toFixed(2)}`)
    .row(`Stripe (${zReport.tenderCounts.stripe}x):`, `${currencySymbol}${zReport.tenderBreakdown.stripe.toFixed(2)}`)
    .row(`Other (${zReport.tenderCounts.other}x):`, `${currencySymbol}${zReport.tenderBreakdown.other.toFixed(2)}`)
    .divider();

  // Sales Totals Section
  builder
    .bold(true)
    .line('FINANCIAL TOTALS:')
    .bold(false)
    .row('Gross Sales:', `${currencySymbol}${zReport.totalGrossSales.toFixed(2)}`)
    .row('Taxes (GST):', `${currencySymbol}${zReport.totalTaxes.toFixed(2)}`)
    .row('Net Sales:', `${currencySymbol}${zReport.totalNetSales.toFixed(2)}`)
    .row('Tips Collected:', `${currencySymbol}${zReport.totalTips.toFixed(2)}`)
    .row('Discounts Given:', `-${currencySymbol}${zReport.totalDiscounts.toFixed(2)}`)
    .row('Voids & Refunds:', `-${currencySymbol}${(zReport.totalVoids + zReport.totalRefunds).toFixed(2)}`)
    .divider()
    .feed(1)
    .line('Manager Signature: _______________________')
    .feed(1)
    .align('center')
    .bold(true)
    .line('=== END OF Z-REPORT ===')
    .bold(false)
    .cut(false, 3);

  return builder.build();
}

/**
 * Builds HTML for Z-Report (Browser / Modal / Thermal Fallback)
 */
export function buildZReportHtml(
  zReport: ZReportData,
  options: PrintReceiptOptions = {}
): string {
  const paperWidth = options.paperWidth || '80mm';
  const restaurantName = zReport.restaurantName || clientDetails.businessName || 'The Cafe';
  const currencySymbol = zReport.currency ? getCurrencySymbol(zReport.currency) : (options.currency ? getCurrencySymbol(options.currency) : '$');

  const varianceText = zReport.variance === 0
    ? `${currencySymbol}0.00 (EXACT)`
    : `${zReport.variance > 0 ? '+' : ''}${currencySymbol}${zReport.variance.toFixed(2)} (${zReport.variance > 0 ? 'OVER' : 'SHORT'})`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Z-Report - Shift ${zReport.shiftNumber}</title>
        <style>${getThermalStyles(paperWidth)}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${sanitizeText(restaurantName)}</div>
          <div style="font-weight: bold; margin-top: 4px; text-transform: uppercase;">DAILY FINANCIAL Z-REPORT</div>
          <div style="font-size: 0.9em; margin-top: 2px;">Shift #${zReport.shiftNumber} • Total Txns: ${zReport.totalTransactionCount}</div>
        </div>

        <div class="divider"></div>

        <div class="row"><span>Opened:</span><span>${formatTicketDateTime(zReport.openedAt)}</span></div>
        <div class="row"><span>Closed:</span><span>${formatTicketDateTime(zReport.closedAt)}</span></div>
        <div class="row"><span>Opened By:</span><span>${sanitizeText(zReport.openedByName)}</span></div>
        <div class="row"><span>Closed By:</span><span>${sanitizeText(zReport.closedByName)}</span></div>

        <div class="double-divider"></div>

        <div class="bold" style="font-size: 0.95em; margin: 4px 0 2px 0;">CASH DRAWER RECONCILIATION</div>
        <div class="divider"></div>
        <div class="row"><span>Opening Float</span><span>${formatCurrency(zReport.openingFloat, currencySymbol)}</span></div>
        <div class="row"><span>Cash Sales</span><span>${formatCurrency(zReport.cashSales, currencySymbol)}</span></div>
        <div class="row"><span>Cash In (Paid In)</span><span>+${formatCurrency(zReport.cashInTotal, currencySymbol)}</span></div>
        <div class="row"><span>Cash Out (Paid Out)</span><span>-${formatCurrency(zReport.cashOutTotal, currencySymbol)}</span></div>
        <div class="row"><span>Cash Refunds</span><span>-${formatCurrency(zReport.cashRefunds, currencySymbol)}</span></div>
        
        <div class="divider"></div>
        <div class="row bold"><span>Expected in Drawer</span><span>${formatCurrency(zReport.expectedCashInDrawer, currencySymbol)}</span></div>
        <div class="row bold"><span>Counted in Drawer</span><span>${formatCurrency(zReport.countedCashInDrawer, currencySymbol)}</span></div>
        <div class="row bold" style="color: ${zReport.variance < 0 ? '#b91c1c' : zReport.variance > 0 ? '#15803d' : '#000'};">
          <span>Difference (Variance)</span>
          <span>${varianceText}</span>
        </div>

        <div class="double-divider"></div>

        <div class="bold" style="font-size: 0.95em; margin: 4px 0 2px 0;">SALES BY TENDER TYPE</div>
        <div class="divider"></div>
        <div class="row"><span>Cash (${zReport.tenderCounts.cash} txns)</span><span>${formatCurrency(zReport.tenderBreakdown.cash, currencySymbol)}</span></div>
        <div class="row"><span>Card (${zReport.tenderCounts.card} txns)</span><span>${formatCurrency(zReport.tenderBreakdown.card, currencySymbol)}</span></div>
        <div class="row"><span>UPI (${zReport.tenderCounts.upi} txns)</span><span>${formatCurrency(zReport.tenderBreakdown.upi, currencySymbol)}</span></div>
        <div class="row"><span>Stripe (${zReport.tenderCounts.stripe} txns)</span><span>${formatCurrency(zReport.tenderBreakdown.stripe, currencySymbol)}</span></div>
        <div class="row"><span>Other (${zReport.tenderCounts.other} txns)</span><span>${formatCurrency(zReport.tenderBreakdown.other, currencySymbol)}</span></div>

        <div class="double-divider"></div>

        <div class="bold" style="font-size: 0.95em; margin: 4px 0 2px 0;">FINANCIAL REVENUE TOTALS</div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 1.05em;"><span>Gross Sales</span><span>${formatCurrency(zReport.totalGrossSales, currencySymbol)}</span></div>
        <div class="row"><span>Taxes</span><span>${formatCurrency(zReport.totalTaxes, currencySymbol)}</span></div>
        <div class="row bold"><span>Net Sales</span><span>${formatCurrency(zReport.totalNetSales, currencySymbol)}</span></div>
        <div class="row"><span>Tips Collected</span><span>${formatCurrency(zReport.totalTips, currencySymbol)}</span></div>
        <div class="row"><span>Discounts Given</span><span>-${formatCurrency(zReport.totalDiscounts, currencySymbol)}</span></div>
        <div class="row"><span>Voids & Refunds</span><span>-${formatCurrency(zReport.totalVoids + zReport.totalRefunds, currencySymbol)}</span></div>

        <div class="divider"></div>
        <div style="margin-top: 16px; margin-bottom: 8px;">
          <div>Manager Signature: _______________________</div>
        </div>

        <div class="footer text-center" style="font-size: 0.8em; margin-top: 8px;">
          <div>Generated: ${formatTicketDateTime(zReport.generatedAt)}</div>
          <div class="bold" style="margin-top: 4px;">=== END OF Z-REPORT ===</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 4. DISPATCH PRINT FOR FINANCIAL Z-REPORT
 */
export async function printZReport(
  zReport: ZReportData,
  options: PrintReceiptOptions = {}
): Promise<PrintDispatchResult> {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = stationSettings.receipt;
  const paperWidth = options.paperWidth || targetConfig.paperWidth || '80mm';

  const escpos = buildZReportEscPos(zReport, { ...options, paperWidth });
  const html = buildZReportHtml(zReport, { ...options, paperWidth });

  return await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
}

// -----------------------------------------------------------------------------
// 5. PRINTER TEST PAGE
// -----------------------------------------------------------------------------

/**
 * Builds ESC/POS Byte Array for Hardware Test Slip
 */
export function buildTestSlipEscPos(
  paperWidth: ThermalPaperWidth = '80mm',
  station: 'receipt' | 'kitchen' | 'bar' = 'receipt'
): Uint8Array {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = stationSettings[station];
  const cols = paperWidth === '58mm' ? 32 : 48;
  const restaurantName = clientDetails.businessName || 'The Cafe';

  const builder = createEscPos(paperWidth)
    .init()
    .align('center')
    .bold(true)
    .size('double')
    .line(restaurantName)
    .size('normal')
    .bold(false)
    .line(`HARDWARE DIAGNOSTIC TEST`)
    .line(`Station: ${station.toUpperCase()} (${targetConfig.name})`)
    .line(`Roll Width: ${paperWidth} (${cols} Columns)`)
    .line(`Target: ${targetConfig.target.toUpperCase()}`)
    .divider()
    .align('left');

  // 1. Column Ruler
  builder.bold(true).line('COLUMN RULER:').bold(false);
  let ruler1 = '';
  let ruler2 = '';
  for (let i = 1; i <= cols; i++) {
    ruler1 += i % 10 === 0 ? Math.floor(i / 10).toString() : ' ';
    ruler2 += (i % 10).toString();
  }
  builder.line(ruler1).line(ruler2).divider();

  // 2. Font Styles Test
  builder.bold(true).line('FONT FORMATTING TESTS:').bold(false);
  builder.line('Normal Text Style');
  builder.bold(true).line('Bold Text Enabled').bold(false);
  builder.underline(true).line('Underlined Text Enabled').underline(false);
  builder.invert(true).line(' Inverted Text (White on Black) ').invert(false);

  // 3. Sizes
  builder.feed(1);
  builder.bold(true).line('SIZE SCALING TESTS:').bold(false);
  builder.size('double-height').line('Double Height').size('normal');
  builder.size('double-width').line('Double Width').size('normal');
  builder.size('double').line('Double Both').size('normal');
  builder.divider();

  // 4. Alignments
  builder.align('left').line('Left Aligned Text');
  builder.align('center').line('Center Aligned Text');
  builder.align('right').line('Right Aligned Text');
  builder.align('left').divider();

  // 5. Financial 2-Column and 3-Column
  builder.bold(true).line('FINANCIAL COLUMNS:').bold(false);
  builder.row('Chicken Club Sandwich', 'Rs. 240.00');
  builder.row('Iced Caramel Macchiato', 'Rs. 180.00');
  builder.row('CGST 2.5% + SGST 2.5%', 'Rs. 21.00');
  builder.row('Total Paid via Cash', 'Rs. 441.00');
  builder.divider();

  // 6. QR Code
  builder.align('center').line('QR CODE DIAGNOSTIC:');
  builder.qr(`https://thecafebarrackpore.com?test=thermal_pos_${Date.now()}`);

  builder
    .feed(1)
    .bold(true)
    .line(`=== TEST PAGE COMPLETE ===`)
    .bold(false);

  // Auto-cut
  builder.cut(false, 4);

  return builder.build();
}

/**
 * Builds HTML for Printer Test Slip
 */
export function buildTestSlipHtml(
  paperWidth: ThermalPaperWidth = '80mm',
  station: 'receipt' | 'kitchen' | 'bar' = 'receipt'
): string {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = stationSettings[station];
  const cols = paperWidth === '58mm' ? 32 : 48;
  const restaurantName = clientDetails.businessName || 'The Cafe';

  let ruler1 = '';
  let ruler2 = '';
  for (let i = 1; i <= cols; i++) {
    ruler1 += i % 10 === 0 ? Math.floor(i / 10).toString() : ' ';
    ruler2 += (i % 10).toString();
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Printer Test Page - ${station}</title>
        <style>${getThermalStyles(paperWidth)}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${sanitizeText(restaurantName)}</div>
          <div style="font-weight: bold; margin: 4px 0;">HARDWARE DIAGNOSTIC TEST</div>
          <div>Station: ${station.toUpperCase()} (${sanitizeText(targetConfig.name)})</div>
          <div>Paper Width: ${paperWidth} (${cols} Columns)</div>
          <div>Target: ${targetConfig.target.toUpperCase()}</div>
        </div>
        <div class="divider"></div>
        <div style="font-family: monospace; white-space: pre;">${ruler1}\n${ruler2}</div>
        <div class="divider"></div>
        <div>Normal Text Style</div>
        <div class="bold">Bold Text Style</div>
        <div style="text-decoration: underline;">Underlined Text Style</div>
        <div style="background: #000; color: #fff; padding: 2px;">Inverted Text Style</div>
        <div class="divider"></div>
        <div class="row"><span>Chicken Club Sandwich</span><span>Rs. 240.00</span></div>
        <div class="row"><span>Iced Caramel Macchiato</span><span>Rs. 180.00</span></div>
        <div class="double-divider"></div>
        <div class="row bold"><span>TOTAL PAID</span><span>Rs. 420.00</span></div>
        <div class="qr-container">
          <img src="https://quickchart.io/qr?text=https%3A%2F%2Fthecafebarrackpore.com&size=160" alt="QR" />
        </div>
        <div class="footer bold">=== TEST PAGE PASSED ===</div>
      </body>
    </html>
  `;
}

/**
 * Generates and prints a complete printer diagnostic test page
 */
export async function printTestPage(
  station: 'receipt' | 'kitchen' | 'bar' = 'receipt',
  overrideWidth?: ThermalPaperWidth
): Promise<PrintDispatchResult> {
  const stationSettings = getStationPrinterSettings();
  const targetConfig = stationSettings[station];
  const paperWidth = overrideWidth || targetConfig.paperWidth || '80mm';

  const escpos = buildTestSlipEscPos(paperWidth, station);
  const html = buildTestSlipHtml(paperWidth, station);

  return await dispatchPrintJob({ targetConfig, rawEscPos: escpos, htmlContent: html });
}

/**
 * Triggers an ESC/POS Cash Drawer Kick Pulse and logs the drawer open event to the audit log.
 */
export async function triggerCashDrawerKick(params?: {
  shiftId?: string;
  reason?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}): Promise<{ success: boolean; message?: string }> {
  if (params?.shiftId) {
    try {
      const { recordDrawerOpen } = await import('../services/cashDrawerService');
      await recordDrawerOpen({
        shiftId: params.shiftId,
        reason: params.reason || 'Hardware Cash Drawer Kick Pulse',
        actorId: params.actorId || 'cashier',
        actorName: params.actorName || 'Staff Cashier',
        actorRole: params.actorRole || 'cashier',
      });
    } catch (e) {
      console.warn('[printReceipt] Failed to log drawer open:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('http://localhost:9100/drawer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return { success: true, message: 'Cash drawer kick pulse sent to hardware printer.' };
      }
    } catch {
      // Local bridge not running; fallback gracefully
    }
  }

  return { success: true, message: 'Cash drawer open recorded.' };
}
