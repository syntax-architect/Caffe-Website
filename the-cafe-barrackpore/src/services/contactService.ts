/**
 * Contact & Guest Inquiry Service
 * Commercial Multi-Client Operating System
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { checkRateLimit } from '../utils/rateLimiter';
import { verifyTurnstileToken } from '../utils/security';
import { clientDetails } from '../config/client';
import DOMPurify from 'dompurify';

export type InquirySubject = 'general' | 'event' | 'catering' | 'feedback';

export interface ContactInquiryPayload {
  name: string;
  phone: string;
  email?: string;
  subject: InquirySubject;
  message: string;
  captchaToken?: string;
  verified_token?: string;
  restaurant_id?: string;
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

function sanitizeInput(str: string): string {
  if (!str) return '';
  if (typeof window !== 'undefined') {
    try {
      if (typeof (DOMPurify as any)?.sanitize === 'function') {
        return (DOMPurify as any).sanitize(str);
      }
      if (typeof DOMPurify === 'function') {
        return (DOMPurify as any)(window).sanitize(str);
      }
    } catch {
      // Fallback to regex sanitizer below
    }
  }
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[<>]/g, '');
}

/**
 * Validates and submits a guest contact inquiry via Supabase RPC with Turnstile token consumption.
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
  const cleanName = sanitizeInput(payload.name.trim());
  const cleanPhone = payload.phone.replace(/[^0-9+]/g, '').trim();
  const cleanEmail = payload.email ? sanitizeInput(payload.email.trim()) : '';
  const cleanMessage = sanitizeInput(payload.message.trim());

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

  // 3. Require Turnstile Token
  const rawToken = (payload.captchaToken || payload.verified_token || '').trim();
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  if (!rawToken && !isDev && isSupabaseConfigured) {
    return {
      success: false,
      error: 'Security verification failed. Please complete the CAPTCHA challenge before submitting.',
    };
  }

  // 4. Verify Turnstile Token via Edge Function if configured
  let verifiedToken = payload.verified_token || '';
  if (isSupabaseConfigured && rawToken && !verifiedToken) {
    const verification = await verifyTurnstileToken('contact', rawToken, cleanPhone);
    if (!verification.success) {
      return {
        success: false,
        error: verification.error || 'Security verification failed. Please try again.',
      };
    }
    verifiedToken = verification.verified_token || rawToken;
  } else if (!verifiedToken && isDev) {
    verifiedToken = 'cf_dev_pass_token';
  }

  // 5. Generate Reference Number from Client Config
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const inquiryPrefix = clientDetails.inquiryPrefix || 'INQ-2026';
  let inquiryRef = `${inquiryPrefix}-${randomSuffix}`;

  // 6. Database Persistence via RPC
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error: dbError } = await supabase.rpc('submit_contact_inquiry', {
        payload: {
          restaurant_id: payload.restaurant_id || clientDetails.shortName || 'the-cafe-barrackpore',
          inquiry_ref: inquiryRef,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail || null,
          subject: payload.subject,
          message: cleanMessage,
        },
        verified_token: verifiedToken,
      });

      if (dbError) {
        console.error('[contactService] Supabase submit_contact_inquiry RPC error:', dbError);
        return {
          success: false,
          error: dbError.message || 'Failed to submit inquiry. Please try again.',
        };
      }

      if (!data || data.success === false) {
        return {
          success: false,
          error: data?.error || 'Failed to submit inquiry. Please try again.',
        };
      }

      if (data.inquiry_ref) {
        inquiryRef = data.inquiry_ref;
      }
    } catch (err: any) {
      console.error('[contactService] Supabase submit_contact_inquiry exception:', err);
      return {
        success: false,
        error: err?.message || 'A network error occurred while submitting your inquiry.',
      };
    }
  } else {
    if (!isDev) {
      return {
        success: false,
        error: 'Inquiry service is temporarily unavailable.',
      };
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
  whatsappNumber: string,
  businessName?: string
): string {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const subjectName = SUBJECT_LABELS[payload.subject] || payload.subject;
  const restaurantName = businessName || clientDetails.businessName;
  const greeting = clientDetails.conciergeWhatsAppGreeting
    ? clientDetails.conciergeWhatsAppGreeting.replace(/\{businessName\}/g, restaurantName)
    : `Hello ${restaurantName} Concierge! ☕`;

  const text =
    `${greeting}\n\n` +
    `*Inquiry Ref:* ${inquiryRef}\n` +
    `*Guest:* ${payload.name}\n` +
    `*Phone:* ${payload.phone}\n` +
    (payload.email ? `*Email:* ${payload.email}\n` : '') +
    `*Subject:* ${subjectName}\n\n` +
    `*Message:* ${payload.message}`;

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}
