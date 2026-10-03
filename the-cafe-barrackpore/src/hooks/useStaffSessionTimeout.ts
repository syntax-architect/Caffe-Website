import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useStaffSessionTimeout() {
  const { isAuthenticated, isActiveStaff, signOut } = useAuth();
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef<number>(Date.now());

  const handleSignOutTimeout = useCallback(async () => {
    try {
      await signOut();
      window.location.href = '/staff/login?reason=timeout';
    } catch {
      window.location.href = '/staff/login?reason=timeout';
    }
  }, [signOut]);

  const resetTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (isAuthenticated && isActiveStaff) {
      timeoutIdRef.current = setTimeout(handleSignOutTimeout, INACTIVITY_TIMEOUT_MS);
    }
  }, [isAuthenticated, isActiveStaff, handleSignOutTimeout]);

  useEffect(() => {
    if (!isAuthenticated || !isActiveStaff) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      return;
    }

    // Set initial timer
    resetTimer();

    // Attach passive activity listeners with throttling
    let lastThrottle = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastThrottle > 2000) { // Throttle resets to once every 2 seconds
        lastThrottle = now;
        resetTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    events.forEach((evt) => {
      window.addEventListener(evt, throttledReset, { passive: true });
    });

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      events.forEach((evt) => {
        window.removeEventListener(evt, throttledReset);
      });
    };
  }, [isAuthenticated, isActiveStaff, resetTimer]);
}
