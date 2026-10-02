import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StaffProfile, AuthContextType, AuthSignInResult } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!supabase || !isSupabaseConfigured) return false;
    return true;
  });

  /**
   * Fetches the authoritative staff profile from public.staff_profiles
   */
  const fetchStaffProfile = useCallback(async (userId: string): Promise<StaffProfile | null> => {
    const client = supabase;
    if (!client) return null;
    try {
      const { data, error } = await client
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
   * Ensures users have an active row in staff_profiles; otherwise signs them out.
   */
  useEffect(() => {
    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Fetch initial session
    client.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[Auth] Error retrieving initial session:', error.message);
          setIsLoading(false);
          return;
        }

        if (initialSession?.user) {
          const profile = await fetchStaffProfile(initialSession.user.id);
          if (!profile || !profile.active) {
            // Require active row in staff_profiles; otherwise sign out
            await client.auth.signOut();
            if (isMounted) {
              setSession(null);
              setUser(null);
              setStaffProfile(null);
            }
          } else {
            if (isMounted) {
              setSession(initialSession);
              setUser(initialSession.user);
              setStaffProfile(profile);
            }
          }
        } else {
          if (isMounted) {
            setSession(null);
            setUser(null);
            setStaffProfile(null);
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
    } = client.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      if (newSession?.user) {
        const profile = await fetchStaffProfile(newSession.user.id);
        if (!profile || !profile.active) {
          await client.auth.signOut();
          if (isMounted) {
            setSession(null);
            setUser(null);
            setStaffProfile(null);
          }
        } else {
          if (isMounted) {
            setSession(newSession);
            setUser(newSession.user);
            setStaffProfile(profile);
          }
        }
      } else {
        if (isMounted) {
          setSession(null);
          setUser(null);
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
   * Sign in strictly using supabase.auth.signInWithPassword AND verified active staff_profiles record.
   * Otherwise sign out and return an error.
   */
  const signIn = async (email: string, password: string): Promise<AuthSignInResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!cleanPassword) {
      return { success: false, error: 'Please enter your password.' };
    }

    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      return {
        success: false,
        error: 'Authentication service is not configured. Please verify database connection settings.',
      };
    }

    setIsLoading(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setIsLoading(false);
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { success: false, error: 'Invalid email or password.' };
        }
        if (error.message.toLowerCase().includes('rate limit')) {
          return { success: false, error: 'Too many login attempts. Please wait a moment and try again.' };
        }
        return { success: false, error: error.message || 'Authentication failed. Please verify your credentials.' };
      }

      if (!data.user) {
        setIsLoading(false);
        return { success: false, error: 'Authentication failed: No user account returned.' };
      }

      // Check authoritative public.staff_profiles table
      const profile = await fetchStaffProfile(data.user.id);

      if (!profile) {
        // Sign out immediately if no staff profile exists
        await client.auth.signOut();
        setSession(null);
        setUser(null);
        setStaffProfile(null);
        setIsLoading(false);
        return {
          success: false,
          error: 'Access denied: No staff profile found for this account. Please speak to your manager.',
        };
      }

      if (!profile.active) {
        // Sign out immediately if deactivated
        await client.auth.signOut();
        setSession(null);
        setUser(null);
        setStaffProfile(null);
        setIsLoading(false);
        return {
          success: false,
          error: 'Access denied: Your staff account is deactivated. Please contact your administrator.',
        };
      }

      setSession(data.session);
      setUser(data.user);
      setStaffProfile(profile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('[Auth] Unexpected error during sign in:', err);
      setIsLoading(false);
      return {
        success: false,
        error: err.message || 'An unexpected connection error occurred. Please try again.',
      };
    }
  };

  /**
   * Signs the staff member out and resets state
   */
  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (supabase && isSupabaseConfigured) {
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
          if (!profile || !profile.active) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setStaffProfile(null);
          } else {
            setStaffProfile(profile);
          }
        }
      }
    } catch (err) {
      console.warn('[Auth] Error refreshing session:', err);
    }
  };

  const isAuthenticated = Boolean(user);
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
