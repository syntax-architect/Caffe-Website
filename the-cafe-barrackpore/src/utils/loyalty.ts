/**
 * Digital Loyalty Stamp & Customer Retention Engine
 * 100% Client-Side Native — $0.00 Monthly Running Cost
 * Tracks dining stamps based on customer phone number, unlocks rewards at 5 orders,
 * and drives 5-star Google Reviews and repeat visits.
 */

import { clientDetails } from '../config/client';

export interface CustomerLoyaltyProfile {
  phone: string;
  name: string;
  stamps: number; // 0 to 5 (or rollover)
  totalVisits: number;
  unlockedRewards: Array<{
    id: string;
    label: string;
    rewardText: string;
    unlockedAt: string;
    redeemed: boolean;
  }>;
  lastVisitAt: string;
}

const STORAGE_KEY = 'cafe_customer_loyalty_data';
const STAMPS_PER_REWARD = 5;

/**
 * Loads all loyalty records from persistent local storage
 */
function getAllLoyaltyProfiles(): Record<string, CustomerLoyaltyProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves all loyalty records to local storage
 */
function saveAllLoyaltyProfiles(data: Record<string, CustomerLoyaltyProfile>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/**
 * Normalizes phone numbers for loyalty lookup
 */
function sanitizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Retrieves the loyalty profile for a customer phone number
 */
export function getLoyaltyProfile(phone?: string | null): CustomerLoyaltyProfile | null {
  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) return null;

  const all = getAllLoyaltyProfiles();
  return all[cleanPhone] || {
    phone: cleanPhone,
    name: '',
    stamps: 0,
    totalVisits: 0,
    unlockedRewards: [],
    lastVisitAt: new Date().toISOString(),
  };
}

/**
 * Records an order visit and awards a stamp
 */
export function awardOrderStamp(
  phone: string,
  customerName: string
): { profile: CustomerLoyaltyProfile; isNewRewardUnlocked: boolean } {
  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      profile: {
        phone: '',
        name: customerName,
        stamps: 0,
        totalVisits: 0,
        unlockedRewards: [],
        lastVisitAt: new Date().toISOString(),
      },
      isNewRewardUnlocked: false,
    };
  }

  const all = getAllLoyaltyProfiles();
  const existing = all[cleanPhone] || {
    phone: cleanPhone,
    name: customerName,
    stamps: 0,
    totalVisits: 0,
    unlockedRewards: [],
    lastVisitAt: new Date().toISOString(),
  };

  const newVisits = existing.totalVisits + 1;
  const newStamps = (existing.stamps + 1) % STAMPS_PER_REWARD;
  const isRewardUnlocked = (existing.stamps + 1) >= STAMPS_PER_REWARD;

  const unlockedRewards = [...(existing.unlockedRewards || [])];
  if (isRewardUnlocked) {
    unlockedRewards.push({
      id: `rew-${Date.now()}`,
      label: '5-Stamp Milestone Reward',
      rewardText: 'Complimentary Artisanal Beverage or Signature Dessert',
      unlockedAt: new Date().toISOString(),
      redeemed: false,
    });
  }

  const updated: CustomerLoyaltyProfile = {
    ...existing,
    name: customerName || existing.name,
    stamps: newStamps,
    totalVisits: newVisits,
    unlockedRewards,
    lastVisitAt: new Date().toISOString(),
  };

  all[cleanPhone] = updated;
  saveAllLoyaltyProfiles(all);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cafe:loyalty-updated', { detail: updated }));
  }

  return { profile: updated, isNewRewardUnlocked: isRewardUnlocked };
}

/**
 * Returns the Google Review link for the cafe
 */
export function getGoogleReviewUrl(): string {
  return clientDetails.googleMapsLink || 'https://maps.google.com';
}
