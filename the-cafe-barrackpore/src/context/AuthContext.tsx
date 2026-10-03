import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StaffProfile, AuthContextType, AuthSignInResult, MfaEnrollResult } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STAFF_AUTH_CACHE_KEY = 'cb_staff_auth';

interface CachedStaffData {
  profile: StaffProfile;
  email?: string;
}

const getCachedStaffData = (): CachedStaffData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STAFF_AUTH_CACHE_KEY) || sessionStorage.getItem(STAFF_AUTH_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profile && parsed.profile.user_id && parsed.profile.active) {
        return parsed as CachedStaffData;
      }
    }
  } catch {
    // ignore
  }
  return null;
};

const setCachedStaffData = (profile: StaffProfile | null, email?: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (profile && profile.active) {
      localStorage.setItem(STAFF_AUTH_CACHE_KEY, JSON.stringify({ profile, email }));
      sessionStorage.setItem(STAFF_AUTH_CACHE_KEY, JSON.stringify({ profile, email }));
    } else {
      localStorage.removeItem(STAFF_AUTH_CACHE_KEY);
      sessionStorage.removeItem(STAFF_AUTH_CACHE_KEY);
    }
  } catch {
    // ignore
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cachedStaffData] = useState<CachedStaffData | null>(() => getCachedStaffData());
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(cachedStaffData?.profile || null);
  const [user, setUser] = useState<User | null>(() => {
    if (cachedStaffData) {
      return {
        id: cachedStaffData.profile.user_id,
        email: cachedStaffData.email || '',
        app_metadata: {},
        user_metadata: { full_name: cachedStaffData.profile.full_name },
        aud: 'authenticated',
        created_at: cachedStaffData.profile.created_at || '',
      } as User;
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isMfaAwaiting, setIsMfaAwaiting] = useState<boolean>(false);
  const [mfaChallengeData, setMfaChallengeData] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!supabase || !isSupabaseConfigured) return false;
    // If an active staff profile was already cached in this browser session,
    // bypass the blocking loader for immediate render. Background verification will still run.
    if (cachedStaffData?.profile?.active) return false;
    return true;
  });

  /**
   * Fetches the authoritative staff profile from public.staff_profiles
   * Scoped and verified strictly by database RLS
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

    const isPublicRoute = typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff');
    let hasAuthToken = false;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        hasAuthToken = Object.keys(localStorage).some(k => k.includes('auth-token') || k.includes('sb-'));
      }
    } catch {
      hasAuthToken = false;
    }

    if (isPublicRoute && !hasAuthToken) {
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
          setCachedStaffData(null);
          setIsLoading(false);
          return;
        }

        if (initialSession?.user) {
          const profile = await fetchStaffProfile(initialSession.user.id);
          if (!profile || !profile.active) {
            // Require active row in staff_profiles; otherwise sign out
            await client.auth.signOut();
            setCachedStaffData(null);
            if (isMounted) {
              setSession(null);
              setUser(null);
              setStaffProfile(null);
            }
          } else {
            setCachedStaffData(profile, initialSession.user.email);
            if (isMounted) {
              setSession(initialSession);
              setUser(initialSession.user);
              setStaffProfile(profile);
            }
          }
        } else {
          setCachedStaffData(null);
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
          setCachedStaffData(null);
          if (isMounted) {
            setSession(null);
            setUser(null);
            setStaffProfile(null);
          }
        } else {
          setCachedStaffData(profile, newSession.user.email);
          if (isMounted) {
            setSession(newSession);
            setUser(newSession.user);
            setStaffProfile(profile);
          }
        }
      } else {
        setCachedStaffData(null);
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
   * Enforces Supabase MFA verification for accounts with enrolled TOTP factors (and owners).
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
        setCachedStaffData(null);
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
        setCachedStaffData(null);
        setSession(null);
        setUser(null);
        setStaffProfile(null);
        setIsLoading(false);
        return {
          success: false,
          error: 'Access denied: Your staff account is deactivated. Please contact your administrator.',
        };
      }

      // Check MFA Status (Supabase Multi-Factor Authentication)
      const factorsRes = await client.auth.mfa.listFactors();
      const verifiedTotp = factorsRes.data?.totp?.find((f) => f.status === 'verified');

      if (verifiedTotp) {
        const challengeRes = await client.auth.mfa.challenge({ factorId: verifiedTotp.id });
        if (!challengeRes.error && challengeRes.data) {
          setIsMfaAwaiting(true);
          setMfaChallengeData({ factorId: verifiedTotp.id, challengeId: challengeRes.data.id });
          setIsLoading(false);
          return {
            success: true,
            mfaRequired: true,
            factorId: verifiedTotp.id,
            challengeId: challengeRes.data.id,
          };
        }
      }

      // Record successful login audit event
      client.rpc('record_audit_event', {
        p_action: 'staff_login',
        p_target_type: 'auth',
        p_target_id: data.user.id,
        p_details: { email: cleanEmail, role: profile.role },
      }).then(null, () => null);

      setCachedStaffData(profile, cleanEmail);
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
   * Completes Supabase MFA TOTP verification
   */
  const verifyMfaCode = async (code: string): Promise<AuthSignInResult> => {
    const client = supabase;
    if (!client || !mfaChallengeData) {
      return { success: false, error: 'No active MFA challenge found. Please log in again.' };
    }

    setIsLoading(true);
    try {
      const verifyRes = await client.auth.mfa.verify({
        factorId: mfaChallengeData.factorId,
        challengeId: mfaChallengeData.challengeId,
        code: code.trim(),
      });

      if (verifyRes.error) {
        setIsLoading(false);
        return {
          success: false,
          error: verifyRes.error.message || 'Invalid verification code. Please check your authenticator app.',
        };
      }

      setIsMfaAwaiting(false);
      setMfaChallengeData(null);

      // Refresh current session and profile
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session?.user) {
        const profile = await fetchStaffProfile(sessionData.session.user.id);
        if (profile && profile.active) {
          setCachedStaffData(profile, sessionData.session.user.email);
        } else {
          setCachedStaffData(null);
        }
        setSession(sessionData.session);
        setUser(sessionData.session.user);
        setStaffProfile(profile);

        // Record audit event
        client.rpc('record_audit_event', {
          p_action: 'mfa_verified',
          p_target_type: 'auth',
          p_target_id: sessionData.session.user.id,
          p_details: { aal: 'aal2' },
        }).then(null, () => null);
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Failed to verify MFA code.' };
    }
  };

  /**
   * Enrolls a new TOTP MFA factor for the current user
   */
  const enrollMfa = async (): Promise<MfaEnrollResult> => {
    const client = supabase;
    if (!client || !user) {
      return { success: false, error: 'You must be signed in to configure two-factor authentication.' };
    }

    try {
      const res = await client.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'The Café Barrackpore',
        friendlyName: `Staff (${user.email})`,
      });

      if (res.error) {
        return { success: false, error: res.error.message };
      }

      return {
        success: true,
        factorId: res.data.id,
        qrCode: res.data.totp.qr_code,
        secret: res.data.totp.secret,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to initiate MFA setup.' };
    }
  };

  /**
   * Signs the staff member out locally
   */
  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (supabase && isSupabaseConfigured) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (err) {
      console.warn('[Auth] Error signing out of Supabase:', err);
    } finally {
      setCachedStaffData(null);
      setUser(null);
      setSession(null);
      setStaffProfile(null);
      setIsMfaAwaiting(false);
      setMfaChallengeData(null);
      setIsLoading(false);
    }
  };

  /**
   * Global sign out: Revokes ALL active refresh tokens across every device and browser
   */
  const signOutEverywhere = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (supabase && isSupabaseConfigured) {
        if (user) {
          // Log global revocation in audit log
          await supabase.rpc('record_audit_event', {
            p_action: 'staff_logout_everywhere',
            p_target_type: 'auth',
            p_target_id: user.id,
            p_details: { email: user.email, scope: 'global' },
          }).then(null, () => null);
        }

        await supabase.auth.signOut({ scope: 'global' });
      }
    } catch (err) {
      console.warn('[Auth] Error during global sign out:', err);
    } finally {
      setCachedStaffData(null);
      setUser(null);
      setSession(null);
      setStaffProfile(null);
      setIsMfaAwaiting(false);
      setMfaChallengeData(null);
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
            setCachedStaffData(null);
            setSession(null);
            setUser(null);
            setStaffProfile(null);
          } else {
            setCachedStaffData(profile, data.session.user.email);
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
        isMfaAwaiting,
        mfaChallengeData,
        signIn,
        verifyMfaCode,
        enrollMfa,
        signOut,
        signOutEverywhere,
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
