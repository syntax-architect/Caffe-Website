import type { User, Session } from '@supabase/supabase-js';

/**
 * Allowed staff roles for The Café Barrackpore
 */
export type StaffRole = 'owner' | 'manager' | 'staff';

/**
 * Profile record stored in public.staff_profiles
 */
export interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  restaurant_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Result returned by the signIn method
 */
export interface AuthSignInResult {
  success: boolean;
  error?: string;
  mfaRequired?: boolean;
  factorId?: string;
  challengeId?: string;
}

export interface MfaEnrollResult {
  success: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}

/**
 * Interface for AuthContext state and methods
 */
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  staffProfile: StaffProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isActiveStaff: boolean;
  role: StaffRole | null;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isMfaAwaiting: boolean;
  mfaChallengeData: { factorId: string; challengeId: string } | null;
  signIn: (email: string, password: string) => Promise<AuthSignInResult>;
  verifyMfaCode: (code: string) => Promise<AuthSignInResult>;
  enrollMfa: () => Promise<MfaEnrollResult>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
