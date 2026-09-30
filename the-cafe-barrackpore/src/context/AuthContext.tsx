import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StaffProfile, AuthContextType, AuthSignInResult } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  /**
   * Fetches the authoritative staff profile from public.staff_profiles
   */
  const fetchStaffProfile = useCallback(async (userId: string): Promise<StaffProfile | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error fetching staff profile:', error.message);
        return null;
      }

      return data as StaffProfile | null;
    } catch (err) {
      console.error('[Auth] Unexpected error fetching staff profile:', err);
      return null;
    }
  }, []);

  /**
   * Initializes auth state and attaches listener
   */
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    // 1. Fetch initial session
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[Auth] Error retrieving initial session:', error.message);
          setIsLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const profile = await fetchStaffProfile(initialSession.user.id);
          if (isMounted) {
            setStaffProfile(profile && profile.active ? profile : null);
          }
        }
        if (isMounted) {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[Auth] Failed to initialize session:', err);
          setIsLoading(false);
        }
      });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const profile = await fetchStaffProfile(newSession.user.id);
        if (isMounted) {
          setStaffProfile(profile && profile.active ? profile : null);
        }
      } else {
        if (isMounted) {
          setStaffProfile(null);
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchStaffProfile]);

  /**
   * Sign in using Supabase Auth, followed by strict staff profile verification
   */
  const signIn = async (email: string, password: string): Promise<AuthSignInResult> => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase is not configured. Staff authentication requires a connected database.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setIsLoading(false);
        // Translate raw error into friendly message
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { success: false, error: 'Invalid email or password. Please try again.' };
        }
        if (error.message.toLowerCase().includes('rate limit')) {
          return { success: false, error: 'Too many login attempts. Please wait a moment and try again.' };
        }
        return { success: false, error: 'Sign in failed. Please verify your credentials or contact management.' };
      }

      if (!data.user) {
        setIsLoading(false);
        return { success: false, error: 'No user account returned from authentication.' };
      }

      // Authoritative staff profile check
      const profile = await fetchStaffProfile(data.user.id);

      if (!profile) {
        // User exists in auth.users, but is not an authorized staff member
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setStaffProfile(null);
        setIsLoading(false);
        return {
          success: false,
          error: 'Your account does not currently have staff access. Please speak to your manager.',
        };
      }

      if (!profile.active) {
        // Staff account exists but has been deactivated
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setStaffProfile(null);
        setIsLoading(false);
        return {
          success: false,
          error: 'Your staff account is currently deactivated. Please contact the administrator.',
        };
      }

      setStaffProfile(profile);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error('[Auth] Unexpected error during sign in:', err);
      setIsLoading(false);
      return {
        success: false,
        error: 'An unexpected connection error occurred. Please try again.',
      };
    }
  };

  /**
   * Signs the staff member out and resets state
   */
  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[Auth] Error signing out of Supabase:', err);
    } finally {
      setUser(null);
      setSession(null);
      setStaffProfile(null);
      setIsLoading(false);
    }
  };

  /**
   * Refreshes the active session
   */
  const refreshSession = async (): Promise<void> => {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        if (data.session.user) {
          const profile = await fetchStaffProfile(data.session.user.id);
          setStaffProfile(profile && profile.active ? profile : null);
        }
      }
    } catch (err) {
      console.warn('[Auth] Error refreshing session:', err);
    }
  };

  const isAuthenticated = Boolean(session && user);
  const isActiveStaff = Boolean(isAuthenticated && staffProfile && staffProfile.active);
  const role = staffProfile?.role ?? null;
  const isOwner = isActiveStaff && role === 'owner';
  const isManager = isActiveStaff && (role === 'owner' || role === 'manager');
  const isStaff = isActiveStaff;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        staffProfile,
        isLoading,
        isAuthenticated,
        isActiveStaff,
        role,
        isOwner,
        isManager,
        isStaff,
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
