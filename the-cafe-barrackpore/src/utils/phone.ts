/**
 * International Phone Validation & Normalization Utility
 * Standardizes phone handling to E.164 without breaking local customer workflows.
 */

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates and normalizes international or country-local phone numbers.
 * Supports:
 * - International formats: +1 212 555 0198, +44 20 7946 0958, +971 50 123 4567, +91 98301 11222
 * - Local formats when defaultCountryCode is provided:
 *   - +91 (India): 10 digits starting with 6-9
 *   - +1 (US/CA): 10 digits starting with 2-9
 *   - +44 (UK): 10-11 digits
 */
export function validatePhoneNumber(
  input: string | undefined | null,
  defaultCountryCode = '+91'
): PhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, normalized: '', error: 'Phone number is required.' };
  }

  const raw = input.trim();
  if (!raw) {
    return { valid: false, normalized: '', error: 'Phone number cannot be empty.' };
  }

  // Check for disallowed characters (only digits, +, spaces, dashes, parentheses allowed)
  if (/[^\d+\s\-()]/g.test(raw)) {
    return {
      valid: false,
      normalized: '',
      error: 'Phone number contains invalid characters.',
    };
  }

  // Strip formatting spaces, dashes, parentheses
  const cleaned = raw.replace(/[\s\-()]/g, '');

  let normalized = '';

  if (cleaned.startsWith('+')) {
    // Explicit international format (E.164)
    const digits = cleaned.slice(1);
    if (!/^\d{8,15}$/.test(digits)) {
      return {
        valid: false,
        normalized: '',
        error: 'International phone numbers must be between 8 and 15 digits.',
      };
    }
    normalized = cleaned;
  } else {
    // Local / un-prefixed number: apply default country rules
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return {
        valid: false,
        normalized: '',
        error: 'Please enter a valid phone number.',
      };
    }

    const code = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;

    if (code === '+91') {
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        normalized = `+91${digitsOnly}`;
      } else if (/^0[6-9]\d{9}$/.test(digitsOnly)) {
        normalized = `+91${digitsOnly.slice(1)}`;
      } else if (digitsOnly.startsWith('91') && digitsOnly.length === 12 && /^[6-9]/.test(digitsOnly.slice(2))) {
        normalized = `+${digitsOnly}`;
      } else {
        return {
          valid: false,
          normalized: '',
          error: 'Please enter a valid 10-digit Indian mobile number or an international number starting with +.',
        };
      }
    } else if (code === '+1') {
      if (/^[2-9]\d{9}$/.test(digitsOnly)) {
        normalized = `+1${digitsOnly}`;
      } else if (/^1[2-9]\d{9}$/.test(digitsOnly)) {
        normalized = `+${digitsOnly}`;
      } else {
        return {
          valid: false,
          normalized: '',
          error: 'Please enter a valid 10-digit North American phone number or an international number with +.',
        };
      }
    } else if (code === '+44') {
      if (/^0\d{10}$/.test(digitsOnly)) {
        normalized = `+44${digitsOnly.slice(1)}`;
      } else if (/^\d{10}$/.test(digitsOnly)) {
        normalized = `+44${digitsOnly}`;
      } else {
        normalized = `+44${digitsOnly}`;
      }
    } else if (code === '+971') {
      // UAE: 9 digits (5x xxx xxxx)
      if (/^0\d{8,9}$/.test(digitsOnly)) {
        normalized = `+971${digitsOnly.slice(1)}`;
      } else if (/^\d{8,9}$/.test(digitsOnly)) {
        normalized = `+971${digitsOnly}`;
      } else {
        normalized = `+971${digitsOnly}`;
      }
    } else if (code === '+966') {
      // Saudi Arabia: 9 digits (5x xxx xxxx)
      if (/^0\d{9}$/.test(digitsOnly)) {
        normalized = `+966${digitsOnly.slice(1)}`;
      } else if (/^\d{9}$/.test(digitsOnly)) {
        normalized = `+966${digitsOnly}`;
      } else {
        normalized = `+966${digitsOnly}`;
      }
    } else if (code === '+65') {
      // Singapore: 8 digits (no trunk prefix)
      if (/^\d{8}$/.test(digitsOnly)) {
        normalized = `+65${digitsOnly}`;
      } else {
        normalized = `+65${digitsOnly}`;
      }
    } else if (code === '+49') {
      // Germany: variable length, strip trunk 0
      if (/^0\d{9,11}$/.test(digitsOnly)) {
        normalized = `+49${digitsOnly.slice(1)}`;
      } else if (/^\d{9,11}$/.test(digitsOnly)) {
        normalized = `+49${digitsOnly}`;
      } else {
        normalized = `+49${digitsOnly}`;
      }
    } else if (code === '+33') {
      // France: 9 digits after trunk 0
      if (/^0\d{9}$/.test(digitsOnly)) {
        normalized = `+33${digitsOnly.slice(1)}`;
      } else if (/^\d{9}$/.test(digitsOnly)) {
        normalized = `+33${digitsOnly}`;
      } else {
        normalized = `+33${digitsOnly}`;
      }
    } else if (code === '+61') {
      // Australia: 9 digits after trunk 0
      if (/^0\d{9}$/.test(digitsOnly)) {
        normalized = `+61${digitsOnly.slice(1)}`;
      } else if (/^\d{9}$/.test(digitsOnly)) {
        normalized = `+61${digitsOnly}`;
      } else {
        normalized = `+61${digitsOnly}`;
      }
    } else {
      // Generic country fallback: strip leading trunk zero if present
      const coreDigits = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;
      normalized = `${code}${coreDigits}`;
    }
  }

  // Reject obvious junk sequences (e.g. 0000000000 or 1111111111)
  const digitSeq = normalized.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digitSeq)) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter a genuine phone number.',
    };
  }

  return { valid: true, normalized, error: undefined };
}

/**
 * Formats a normalized E.164 phone into a clean readable display format.
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const clean = phone.trim();

  // India: +91 98301 11222
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  // US / Canada: +1 (212) 555-0198
  if (clean.startsWith('+1') && clean.length === 12) {
    return `+1 (${clean.slice(2, 5)}) ${clean.slice(5, 8)}-${clean.slice(8)}`;
  }
  // UK: +44 20 7946 0958
  if (clean.startsWith('+44') && clean.length >= 12) {
    return `+44 ${clean.slice(3, 5)} ${clean.slice(5, 9)} ${clean.slice(9)}`;
  }
  // UAE: +971 50 123 4567
  if (clean.startsWith('+971') && clean.length === 13) {
    return `+971 ${clean.slice(4, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }
  // Saudi Arabia: +966 50 123 4567
  if (clean.startsWith('+966') && clean.length === 13) {
    return `+966 ${clean.slice(4, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }
  // Singapore: +65 9123 4567
  if (clean.startsWith('+65') && clean.length === 11) {
    return `+65 ${clean.slice(3, 7)} ${clean.slice(7)}`;
  }
  // Germany: +49 30 1234 5678
  if (clean.startsWith('+49') && clean.length >= 12) {
    return `+49 ${clean.slice(3, 5)} ${clean.slice(5, 9)} ${clean.slice(9)}`;
  }
  // France: +33 1 23 45 67 89
  if (clean.startsWith('+33') && clean.length === 12) {
    return `+33 ${clean.slice(3, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)} ${clean.slice(10)}`;
  }
  // Australia: +61 4 1234 5678
  if (clean.startsWith('+61') && clean.length === 12) {
    return `+61 ${clean.slice(3, 4)} ${clean.slice(4, 8)} ${clean.slice(8)}`;
  }

  return clean;
}

/**
 * Extracts digits only for WhatsApp wa.me links.
 */
export function cleanPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}
