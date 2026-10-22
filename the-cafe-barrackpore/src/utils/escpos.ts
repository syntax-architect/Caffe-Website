/**
 * ESC/POS Command Builder for Thermal Receipt Printers
 * Commercial Grade — Supports 80mm & 58mm POS Printers
 * Zero External / Paid Dependencies — 100% Native TypedArrays
 */

export type PaperWidth = '80mm' | '58mm';
export type Alignment = 'left' | 'center' | 'right';
export type TextSize = 'normal' | 'double-height' | 'double-width' | 'double';

// Character widths for standard Font A (12x24)
export const PAPER_COLUMNS: Record<PaperWidth, number> = {
  '80mm': 48,
  '58mm': 32,
};

// Common ESC/POS Byte Constants
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

/**
 * Strips unsupported non-ASCII characters or normalizes currency symbols for thermal codepages
 */
export function sanitizeThermalText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/₹\s*/g, 'Rs. ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[•]/g, '*')
    .replace(/[…]/g, '...')
    .replace(/×/g, 'x')
    .trim();
}

/**
 * Formats a two-column row with left text left-aligned and right text right-aligned
 */
export function formatTwoColumns(left: string, right: string, columns = 48): string {
  const cleanLeft = sanitizeThermalText(left);
  const cleanRight = sanitizeThermalText(right);
  const rightLen = cleanRight.length;
  const maxLeftLen = columns - rightLen - 1;
  if (maxLeftLen <= 0) {
    return `${cleanLeft}\n${cleanRight.padStart(columns, ' ')}`;
  }
  const fitted = cleanLeft.length > maxLeftLen ? cleanLeft.substring(0, maxLeftLen) : cleanLeft;
  const padding = ' '.repeat(Math.max(1, columns - fitted.length - rightLen));
  return fitted + padding + cleanRight;
}

/**
 * Formats a three-column row (Qty, Item, Total)
 */
export function formatThreeColumns(
  col1: string,
  col2: string,
  col3: string,
  columns = 48,
  col1Width = 4,
  col3Width = 9
): string {
  const c1Raw = sanitizeThermalText(col1);
  const c3Raw = sanitizeThermalText(col3);
  const c1W = Math.max(col1Width, c1Raw.length);
  const c3W = Math.max(col3Width, c3Raw.length);
  const c1 = c1Raw.padEnd(c1W, ' ');
  const c3 = c3Raw.padStart(c3W, ' ');
  const availableForCol2 = Math.max(4, columns - c1W - c3W - 2);
  const c2Raw = sanitizeThermalText(col2);
  const fitted = c2Raw.length > availableForCol2 ? c2Raw.substring(0, availableForCol2) : c2Raw;
  const col2Padded = fitted.padEnd(availableForCol2, ' ');
  return `${c1} ${col2Padded} ${c3}`;
}

/**
 * Fluent ESC/POS Command Stream Builder
 */
export class EscPosBuilder {
  private buffer: number[] = [];
  public readonly paperWidth: PaperWidth;
  public readonly columns: number;
  private encoder: TextEncoder;

  constructor(paperWidth: PaperWidth = '80mm') {
    this.paperWidth = paperWidth;
    this.columns = PAPER_COLUMNS[paperWidth] || 48;
    this.encoder = new TextEncoder();
  }

  /**
   * Initializes printer, resets formatting to defaults
   */
  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @
    return this;
  }

  /**
   * Text justification
   */
  align(align: Alignment): this {
    const val = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.buffer.push(ESC, 0x61, val); // ESC a n
    return this;
  }

  /**
   * Bold mode toggle
   */
  bold(enable = true): this {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  /**
   * Underline mode
   */
  underline(enable: boolean | 1 | 2 = true): this {
    const val = typeof enable === 'number' ? enable : enable ? 1 : 0;
    this.buffer.push(ESC, 0x2D, val); // ESC - n
    return this;
  }

  /**
   * Invert (white on black)
   */
  invert(enable = true): this {
    this.buffer.push(GS, 0x42, enable ? 1 : 0); // GS B n
    return this;
  }

  /**
   * Character size scaling
   */
  size(size: TextSize = 'normal'): this {
    let val = 0x00;
    switch (size) {
      case 'double-height':
        val = 0x01; // 2x height, 1x width
        break;
      case 'double-width':
        val = 0x10; // 1x height, 2x width
        break;
      case 'double':
        val = 0x11; // 2x height, 2x width
        break;
      case 'normal':
      default:
        val = 0x00;
        break;
    }
    this.buffer.push(GS, 0x21, val); // GS ! n
    return this;
  }

  /**
   * Appends raw text bytes
   */
  text(str: string): this {
    const sanitized = sanitizeThermalText(str);
    const bytes = this.encoder.encode(sanitized);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  /**
   * Appends text followed by a newline (LF)
   */
  line(str = ''): this {
    if (str) this.text(str);
    this.buffer.push(LF);
    return this;
  }

  /**
   * Feeds N lines
   */
  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  /**
   * Prints a horizontal dividing line across full roll width
   */
  divider(char = '-'): this {
    const lineStr = char.charAt(0).repeat(this.columns);
    return this.line(lineStr);
  }

  /**
   * Prints a prominent double dividing line across full roll width
   */
  doubleDivider(): this {
    return this.divider('=');
  }

  /**
   * Two-column layout with left text left-aligned and right text right-aligned
   */
  row(left: string, right: string): this {
    const cleanLeft = sanitizeThermalText(left);
    const cleanRight = sanitizeThermalText(right);
    const rightLen = cleanRight.length;
    const maxLeftLen = this.columns - rightLen - 1;

    if (maxLeftLen <= 0) {
      // Very long right text; wrap to two lines
      this.line(cleanLeft);
      this.align('right').line(cleanRight).align('left');
      return this;
    }

    if (cleanLeft.length > maxLeftLen) {
      // Wrap left text into chunks
      const firstLineLeft = cleanLeft.substring(0, maxLeftLen);
      const remainingLeft = cleanLeft.substring(maxLeftLen);
      const padding = ' '.repeat(Math.max(1, this.columns - firstLineLeft.length - rightLen));
      this.line(firstLineLeft + padding + cleanRight);
      this.line(remainingLeft);
    } else {
      const padding = ' '.repeat(Math.max(1, this.columns - cleanLeft.length - rightLen));
      this.line(cleanLeft + padding + cleanRight);
    }

    return this;
  }

  /**
   * Three-column layout (e.g., [Qty 4] [Item Name 28] [Price 16])
   */
  threeColumn(
    col1: string,
    col2: string,
    col3: string,
    col1Width = 4,
    col3Width = 9
  ): this {
    const c1Raw = sanitizeThermalText(col1);
    const c3Raw = sanitizeThermalText(col3);
    const c1W = Math.max(col1Width, c1Raw.length);
    const c3W = Math.max(col3Width, c3Raw.length);
    const c1 = c1Raw.padEnd(c1W, ' ');
    const c3 = c3Raw.padStart(c3W, ' ');
    const availableForCol2 = Math.max(4, this.columns - c1W - c3W - 2);

    const c2 = sanitizeThermalText(col2);
    if (c2.length > availableForCol2) {
      let breakIdx = c2.lastIndexOf(' ', availableForCol2);
      if (breakIdx <= 0) breakIdx = availableForCol2;
      const firstChunk = c2.substring(0, breakIdx).padEnd(availableForCol2, ' ');
      const rest = c2.substring(breakIdx).trimStart();
      this.line(`${c1} ${firstChunk} ${c3}`);
      this.line(`${' '.repeat(c1W + 1)}${rest}`);
    } else {
      const col2Padded = c2.padEnd(availableForCol2, ' ');
      this.line(`${c1} ${col2Padded} ${c3}`);
    }

    return this;
  }

  /**
   * Prints an inverted highlight badge (e.g. [ TABLE #12 ] or [ DUPLICATE ])
   */
  badge(text: string): this {
    const clean = `  ${sanitizeThermalText(text).toUpperCase()}  `;
    this.align('center').invert(true).bold(true).size('double-height').line(clean).size('normal').invert(false).bold(false).align('left');
    return this;
  }

  /**
   * Prints a boxed note (e.g. Chef Special Instructions)
   */
  box(note: string, title?: string): this {
    const cleanNote = sanitizeThermalText(note);
    const innerWidth = this.columns - 4;
    const topBar = `┌${'─'.repeat(this.columns - 2)}┐`;
    const bottomBar = `└${'─'.repeat(this.columns - 2)}┘`;

    this.line(topBar);
    if (title) {
      const cleanTitle = ` ${sanitizeThermalText(title).toUpperCase()} `.padEnd(innerWidth, ' ');
      this.bold(true).line(`│ ${cleanTitle.substring(0, innerWidth)} │`).bold(false);
      this.line(`├${'─'.repeat(this.columns - 2)}┤`);
    }

    // Split note into lines that fit innerWidth
    let remaining = cleanNote;
    while (remaining.length > 0) {
      const chunk = remaining.substring(0, innerWidth).padEnd(innerWidth, ' ');
      this.line(`│ ${chunk} │`);
      remaining = remaining.substring(innerWidth);
    }

    this.line(bottomBar);
    return this;
  }

  /**
   * Generates native Epson Model 2 QR Code commands
   * @param data Content string (e.g. UPI payment URL, receipt URL)
   * @param size Dot size (1..16, defaults to 5 for 80mm, 4 for 58mm)
   */
  qr(data: string, size?: number): this {
    if (!data) return this;
    const moduleSize = size || (this.paperWidth === '80mm' ? 5 : 4);
    const dataBytes = this.encoder.encode(data);
    const dataLen = dataBytes.length;

    // 1. Select QR Model (Model 2 = 0x32)
    // GS ( k 4 0 49 65 50 0
    this.buffer.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);

    // 2. Set Module Size (1 - 16 dots)
    // GS ( k 3 0 49 67 size
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, moduleSize)));

    // 3. Set Error Correction Level (49 = 'M' ~15%)
    // GS ( k 3 0 49 69 49
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 49);

    // 4. Store Data in Symbol Storage Area
    // GS ( k pL pH 49 80 48 <data>
    const storeLen = dataLen + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;
    this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < dataBytes.length; i++) {
      this.buffer.push(dataBytes[i]);
    }

    // 5. Print the QR symbol
    // GS ( k 3 0 49 81 48
    this.align('center');
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.feed(1);
    this.align('left');

    return this;
  }

  /**
   * Alias for qr()
   */
  qrCode(data: string, size?: number): this {
    return this.qr(data, size);
  }

  /**
   * Cash Drawer Kick Pulse command
   * Standard ESC/POS Pulse: ESC p m t1 t2
   * @param pin Pin 2 (0) or Pin 5 (1) of the RJ11/RJ12 drawer port
   * @param onTime Pulse duration in units of 2ms (25 = 50ms)
   * @param offTime Off duration in units of 2ms (250 = 500ms)
   */
  cashDrawerPulse(pin: 0 | 1 = 0, onTime = 25, offTime = 250): this {
    this.buffer.push(ESC, 0x70, pin === 1 ? 1 : 0, onTime, offTime);
    return this;
  }

  /**
   * Paper Cut command
   * @param partial Whether to leave a small paper bridge tab (partial cut)
   * @param feedLines Number of lines to feed before cutting (so text is clear of the print head)
   */
  cut(partial = false, feedLines = 4): this {
    this.feed(feedLines);
    if (partial) {
      this.buffer.push(GS, 0x56, 0x42, 0x00); // GS V 66 0 (partial cut)
    } else {
      this.buffer.push(GS, 0x56, 0x00); // GS V 0 (full cut)
    }
    return this;
  }

  /**
   * Injects raw byte array
   */
  raw(bytes: number[] | Uint8Array): this {
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  /**
   * Builds and returns the compiled binary ESC/POS stream
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Convenience builder helper
 */
export function createEscPos(paperWidth: PaperWidth = '80mm'): EscPosBuilder {
  return new EscPosBuilder(paperWidth);
}
