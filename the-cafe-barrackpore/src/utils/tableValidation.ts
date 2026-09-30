export interface TableValidationResult {
  isValid: boolean;
  tableNumber: string | null;
  normalized: string | null;
  rawInput: string | null;
  error?: string;
}

/**
 * Validates and normalizes table query parameter.
 * Normalizes '7' -> '07', '01' -> '01', etc.
 * Rejects non-digits, negative values, 0, and numbers > 99.
 */
export const validateAndNormalizeTableNumber = (raw: string | null | undefined): TableValidationResult => {
  if (raw === null || raw === undefined) {
    return { isValid: false, tableNumber: null, normalized: null, rawInput: null };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { isValid: false, tableNumber: null, normalized: null, rawInput: raw, error: 'Table number cannot be empty.' };
  }

  // Allow only 1 or 2 digits
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { isValid: false, tableNumber: null, normalized: null, rawInput: raw, error: 'Invalid table QR code.' };
  }

  const num = parseInt(trimmed, 10);
  if (num < 1 || num > 99) {
    return { isValid: false, tableNumber: null, normalized: null, rawInput: raw, error: 'Table number must be between 01 and 99.' };
  }

  const normalized = num.toString().padStart(2, '0');
  return {
    isValid: true,
    tableNumber: normalized,
    normalized,
    rawInput: raw,
  };
};
