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
  created_at: string;
  updated_at: string;
}

/**
 * Result returned by the signIn method
 */
export interface AuthSignInResult {
  success: boolean;
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
  signIn: (email: string, password: string) => Promise<AuthSignInResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
