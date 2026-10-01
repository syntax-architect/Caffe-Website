import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StaffProfile, AuthContextType, AuthSignInResult, StaffRole } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialDemoAuth = (): { user: User | null; session: Session | null; profile: StaffProfile | null } => {
  if (typeof window === 'undefined') {
    return { user: null, session: null, profile: null };
  }
  try {
    const saved = localStorage.getItem('cafe_demo_auth_active');
    if (saved) {
      const profile = JSON.parse(saved);
      if (profile && profile.active) {
        const mockUser = {
          id: profile.user_id || 'demo-user-1',
          email: profile.email || 'admin@gmail.com',
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: { full_name: profile.full_name || 'Restaurant Administrator' },
          created_at: new Date().toISOString(),
        } as User;
        const mockSession = {
          access_token: 'demo-token',
          token_type: 'bearer',
          user: mockUser,
        } as Session;
        return { user: mockUser, session: mockSession, profile };
      }
    }
  } catch {
    // ignore
  }
  return { user: null, session: null, profile: null };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialDemo] = useState(getInitialDemoAuth);
  const [user, setUser] = useState<User | null>(initialDemo.user);
  const [session, setSession] = useState<Session | null>(initialDemo.session);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(initialDemo.profile);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // If demo/admin credentials exist in localStorage, immediately grant access without spinner
    if (initialDemo.user && initialDemo.profile) return false;
    if (!supabase || !isSupabaseConfigured) return false;
    return true;
  });

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

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          const profile = await fetchStaffProfile(initialSession.user.id);
          if (isMounted) {
            setStaffProfile(profile && profile.active ? profile : null);
          }
        } else {
          // If no active Supabase session, check if admin/demo auth is stored in localStorage
          const saved = typeof window !== 'undefined' ? localStorage.getItem('cafe_demo_auth_active') : null;
          if (saved) {
            try {
              const profile = JSON.parse(saved);
              if (profile && profile.active) {
                const mockUser = {
                  id: profile.user_id || 'demo-user-1',
                  email: profile.email || 'admin@gmail.com',
                  aud: 'authenticated',
                  app_metadata: {},
                  user_metadata: { full_name: profile.full_name || 'Restaurant Administrator' },
                  created_at: new Date().toISOString(),
                } as User;
                const mockSession = {
                  access_token: 'demo-token',
                  token_type: 'bearer',
                  user: mockUser,
                } as Session;
                if (isMounted) {
                  setUser(mockUser);
                  setSession(mockSession);
                  setStaffProfile(profile);
                }
              }
            } catch {
              // ignore
            }
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

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        const profile = await fetchStaffProfile(newSession.user.id);
        if (isMounted) {
          setStaffProfile(profile && profile.active ? profile : null);
        }
      } else {
        const hasDemo = typeof window !== 'undefined' && localStorage.getItem('cafe_demo_auth_active');
        if (!hasDemo && isMounted) {
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
   * Demo mode sign-in for frictionless local testing and client evaluation
   */
  const signInDemo = useCallback((demoRole: StaffRole = 'owner', demoEmail: string = 'admin@gmail.com') => {
    const demoProfile: StaffProfile = {
      id: 'demo-staff-1',
      user_id: 'demo-user-1',
      full_name: demoRole === 'owner' ? 'Restaurant Administrator' : demoRole === 'manager' ? 'Shift Manager' : 'Kitchen Head',
      role: demoRole,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mockUser = {
      id: 'demo-user-1',
      email: demoEmail,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { full_name: demoProfile.full_name },
      created_at: new Date().toISOString(),
    } as User;
    const mockSession = {
      access_token: 'demo-token',
      token_type: 'bearer',
      user: mockUser,
    } as Session;

    setUser(mockUser);
    setSession(mockSession);
    setStaffProfile(demoProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cafe_demo_auth_active', JSON.stringify({ ...demoProfile, email: demoEmail }));
    }
  }, []);

  /**
   * Sign in using Supabase Auth, with direct support for admin@gmail.com / admin123
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

    // Direct Administrator Credentials Override: admin@gmail.com / admin123
    if (
      (cleanEmail === 'admin@gmail.com' || cleanEmail === 'admin@thecafebarrackpore.com') &&
      cleanPassword === 'admin123'
    ) {
      signInDemo('owner', cleanEmail);
      setIsLoading(false);
      return { success: true };
    }

    if (!supabase || !isSupabaseConfigured) {
      return {
        success: false,
        error: 'Invalid credentials. For staff access, enter email: admin@gmail.com and password: admin123',
      };
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setIsLoading(false);
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { success: false, error: 'Invalid email or password. Use admin@gmail.com and pass: admin123' };
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cafe_demo_auth_active');
      }
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
          setStaffProfile(profile && profile.active ? profile : null);
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
        signInDemo,
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
