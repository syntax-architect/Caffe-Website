import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CreateReservationPayload, ReservationResult } from '../types/reservation';
import { generateClientReservationRef } from '../utils/orderCalculations';

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

  const cleanPhone = payload.customer_phone?.replace(/\D/g, '') || '';
  if (!cleanPhone || cleanPhone.length < 10) {
    return { valid: false, error: 'Please enter a valid 10-digit mobile number.' };
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
  // 1. Validation
  const validation = validateReservationPayload(payload);
  let reservationRef = payload.reservation_ref?.trim() || generateClientReservationRef();

  if (!validation.valid) {
    return {
      success: false,
      reservationRef,
      error: validation.error || 'Invalid reservation data.',
    };
  }

  const cleanPhone = payload.customer_phone.replace(/\D/g, '');

  // 2. Demo mode / unconfigured Supabase handling
  if (!isSupabaseConfigured || !supabase) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : true;
    if (isDev) {
      console.info(
        '[reservationService] Supabase not configured. Operating in local demo mode with reference:',
        reservationRef
      );
    }
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
          customer_name: payload.customer_name.trim(),
          customer_phone: cleanPhone,
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

      // Attempt 2: Direct insert fallback (if RPC is not yet applied)
      const { data: insertData, error: insertError } = await supabase
        .from('reservations')
        .insert({
          reservation_ref: reservationRef,
          customer_name: payload.customer_name.trim(),
          customer_phone: cleanPhone,
          reservation_date: payload.reservation_date,
          reservation_time: payload.reservation_time.trim(),
          party_size: Math.floor(Number(payload.party_size)),
          special_requests: payload.special_requests?.trim() || null,
          status: 'pending',
          source: 'website',
        })
        .select('id, reservation_ref')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          reservationRef = generateClientReservationRef();
          continue;
        }
        throw insertError;
      }

      return {
        success: true,
        reservationId: insertData.id,
        reservationRef: insertData.reservation_ref,
      };
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
