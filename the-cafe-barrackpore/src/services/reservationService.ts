import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CreateReservationPayload, ReservationResult } from '../types/reservation';
import { generateClientReservationRef } from '../utils/orderCalculations';
import { validatePhoneNumber } from '../utils/phone';
import { enforceRateLimit } from '../utils/rateLimiter';
import { verifyTurnstileToken } from '../utils/security';

/**
 * Validates reservation payload prior to submission.
 */
export const validateReservationPayload = (
  payload: CreateReservationPayload
): { valid: boolean; error?: string } => {
  if (!payload) {
    return { valid: false, error: 'Reservation details are missing.' };
  }

  const name = payload.customer_name?.trim();
  if (!name || name.length < 2) {
    return { valid: false, error: 'Please enter a valid full name (minimum 2 characters).' };
  }

  const phoneValidation = validatePhoneNumber(payload.customer_phone);
  if (!phoneValidation.valid) {
    return { valid: false, error: phoneValidation.error || 'Please enter a valid phone number.' };
  }

  if (!payload.reservation_date || !payload.reservation_date.trim()) {
    return { valid: false, error: 'Please select a reservation date.' };
  }

  // Validate date format YYYY-MM-DD
  const dateObj = new Date(payload.reservation_date);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Please provide a valid reservation date.' };
  }

  if (!payload.reservation_time || !payload.reservation_time.trim()) {
    return { valid: false, error: 'Please select a reservation time.' };
  }

  const partySize = Number(payload.party_size);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return { valid: false, error: 'Party size must be between 1 and 20 guests for online booking.' };
  }

  return { valid: true };
};

/**
 * Creates a table reservation in Supabase with atomic fallback.
 * If Supabase is unconfigured, gracefully falls back to local demo mode.
 */
export const createReservation = async (
  payload: CreateReservationPayload
): Promise<ReservationResult> => {
  let reservationRef = payload.reservation_ref?.trim() || generateClientReservationRef();

  // 0. Rate limiting enforcement (5 reservations / 60 seconds)
  const rateLimit = enforceRateLimit('reservation');
  if (!rateLimit.allowed) {
    return {
      success: false,
      reservationRef,
      error: rateLimit.error || 'Too many reservation attempts. Please wait a moment before trying again.',
    };
  }

  // 0b. Server-side / Edge Turnstile CAPTCHA and IP/Phone rate check
  const captchaVerification = await verifyTurnstileToken('reservation', payload.captcha_token, payload.customer_phone);
  if (!captchaVerification.success) {
    return {
      success: false,
      reservationRef,
      error: captchaVerification.error || 'Security verification failed.',
    };
  }

  // 1. Validation
  const validation = validateReservationPayload(payload);

  if (!validation.valid) {
    return {
      success: false,
      reservationRef,
      error: validation.error || 'Invalid reservation data.',
    };
  }

  const phoneValidation = validatePhoneNumber(payload.customer_phone);
  const normalizedPhone = phoneValidation.valid ? phoneValidation.normalized : payload.customer_phone.trim();
  const restaurantId = payload.restaurant_id || 'the-cafe-barrackpore';

  // 2. Demo mode / unconfigured Supabase handling (strictly restricted to DEV environment)
  if (!isSupabaseConfigured || !supabase) {
    const proc = (globalThis as any).process;
    const isDev = typeof import.meta !== 'undefined' && import.meta.env
      ? Boolean(import.meta.env.DEV)
      : (proc ? proc.env?.NODE_ENV !== 'production' : false);
    if (!isDev) {
      return {
        success: false,
        reservationRef,
        error: 'Reservation system is temporarily unavailable. Database connection is not configured.',
      };
    }
    console.info(
      '[reservationService] Supabase not configured. Operating in local demo mode with reference:',
      reservationRef
    );
    return {
      success: true,
      reservationRef,
      isDemoMode: true,
    };
  }

  // 3. Database submission with collision retry
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Attempt 1: Call atomic RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_reservation_atomic', {
        p_reservation: {
          reservation_ref: reservationRef,
          restaurant_id: restaurantId,
          customer_name: payload.customer_name.trim(),
          customer_phone: normalizedPhone,
          reservation_date: payload.reservation_date,
          reservation_time: payload.reservation_time.trim(),
          party_size: Math.floor(Number(payload.party_size)),
          special_requests: payload.special_requests?.trim() || null,
          status: 'pending',
          source: 'website',
        },
      });

      if (!rpcError && rpcData?.reservation_id) {
        return {
          success: true,
          reservationId: rpcData.reservation_id,
          reservationRef: rpcData.reservation_ref || reservationRef,
        };
      }

      // Check for unique collision on reservation_ref (code 23505)
      if (rpcError && rpcError.code === '23505') {
        reservationRef = generateClientReservationRef();
        continue;
      }

      if (rpcError) {
        return {
          success: false,
          reservationRef,
          error: rpcError.message || 'Failed to submit reservation.',
        };
      }
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        console.error('[reservationService] Supabase reservation error:', err);
        return {
          success: false,
          reservationRef,
          error:
            'Online reservation registration is temporarily unavailable. You can still confirm directly via WhatsApp.',
        };
      }
    }
  }

  return {
    success: false,
    reservationRef,
    error:
      'Online reservation registration is temporarily unavailable. You can still confirm directly via WhatsApp.',
  };
};
