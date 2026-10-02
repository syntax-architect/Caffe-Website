/**
 * Core Reservation data models for The Café Barrackpore.
 */

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface CreateReservationPayload {
  reservation_ref?: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  special_requests?: string | null;
  restaurant_id?: string;
  captcha_token?: string;
}

export interface ReservationRecord {
  id: string;
  reservation_ref: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  special_requests: string | null;
  status: ReservationStatus;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  reservationRef: string;
  isDemoMode?: boolean;
  error?: string;
}
