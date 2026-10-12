/**
 * Contact & Guest Inquiry Service
 * The Café Barrackpore — Commercial Multi-Client Operating System
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { checkRateLimit } from '../utils/rateLimiter';
import DOMPurify from 'dompurify';

export type InquirySubject = 'general' | 'event' | 'catering' | 'feedback';

export interface ContactInquiryPayload {
  name: string;
  phone: string;
  email?: string;
  subject: InquirySubject;
  message: string;
  captchaToken?: string;
}

export interface ContactInquiryResult {
  success: boolean;
  inquiryRef?: string;
  isDemoMode?: boolean;
  error?: string;
}

const SUBJECT_LABELS: Record<InquirySubject, string> = {
  general: 'General Dining Question',
  event: 'Private Event & Banqueting',
  catering: 'Gourmet Catering Inquiry',
  feedback: 'Guest Experience Feedback',
};

/**
 * Validates and submits a guest contact inquiry.
 */
export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<ContactInquiryResult> {
  // 1. Anti-spam sliding window rate limiter (max 3 inquiries per 60 seconds)
  const isRateAllowed = checkRateLimit('contact_inquiry', 3, 60000);
  if (!isRateAllowed) {
    return {
      success: false,
      error: 'Too many messages sent. Please wait a moment before sending another inquiry.',
    };
  }

  // 2. Strict Input Validation & Sanitization
  const cleanName = DOMPurify.sanitize(payload.name.trim());
  const cleanPhone = payload.phone.replace(/[^0-9+]/g, '').trim();
  const cleanEmail = payload.email ? DOMPurify.sanitize(payload.email.trim()) : '';
  const cleanMessage = DOMPurify.sanitize(payload.message.trim());

  if (cleanName.length < 2) {
    return { success: false, error: 'Please provide your name (minimum 2 characters).' };
  }

  const phoneDigits = cleanPhone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return { success: false, error: 'Please enter a valid phone number (minimum 10 digits).' };
  }

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  if (cleanMessage.length < 10) {
    return { success: false, error: 'Please write a message with at least 10 characters.' };
  }

  // Generate Reference Number
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const inquiryRef = `INQ-2026-${randomSuffix}`;

  // 3. Database Persistence if Supabase is configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { error: dbError } = await supabase.from('contact_inquiries').insert([
        {
          inquiry_ref: inquiryRef,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail || null,
          subject: payload.subject,
          message: cleanMessage,
          created_at: new Date().toISOString(),
        },
      ]);

      if (dbError) {
        console.warn('[contactService] Supabase insert warning (falling back to direct concierge):', dbError.message);
      }
    } catch (err) {
      console.warn('[contactService] Supabase unexpected error:', err);
    }
  }

  // Record in local session for instant verification
  if (typeof window !== 'undefined') {
    try {
      const history = JSON.parse(sessionStorage.getItem('guest_inquiries') || '[]');
      history.push({ inquiryRef, payload, timestamp: Date.now() });
      sessionStorage.setItem('guest_inquiries', JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }

  return {
    success: true,
    inquiryRef,
    isDemoMode: !isSupabaseConfigured,
  };
}

/**
 * Builds a direct WhatsApp pre-filled concierge message link.
 */
export function buildWhatsAppInquiryUrl(
  payload: ContactInquiryPayload,
  inquiryRef: string,
  whatsappNumber: string
): string {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const subjectName = SUBJECT_LABELS[payload.subject] || payload.subject;

  const text =
    `Hello The Café Barrackpore Concierge! ☕\n\n` +
    `*Inquiry Ref:* ${inquiryRef}\n` +
    `*Guest:* ${payload.name}\n` +
    `*Phone:* ${payload.phone}\n` +
    (payload.email ? `*Email:* ${payload.email}\n` : '') +
    `*Subject:* ${subjectName}\n\n` +
    `*Message:* ${payload.message}`;

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}
