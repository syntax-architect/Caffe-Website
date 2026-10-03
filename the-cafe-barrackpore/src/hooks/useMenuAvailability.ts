import { useState, useEffect, useCallback } from 'react';
import {
  fetchAvailabilityMap,
  getLocalAvailabilityMap,
  setMenuItemAvailability,
  isItemAvailable as checkIsAvailable,
  AVAILABILITY_EVENT,
} from '../services/menuAvailabilityService';

export function useMenuAvailability() {
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>(
    getLocalAvailabilityMap
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const load = () => {
      fetchAvailabilityMap().then((map) => {
        if (!isMounted) return;
        setAvailabilityMap(map);
        setIsLoading(false);
      });
    };

    const isPublicPage = typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff');
    if (isPublicPage) {
      const scheduleLoad = () => {
        if (!isMounted) return;
        fetchAvailabilityMap().then((map) => {
          if (!isMounted) return;
          setAvailabilityMap((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(map)) return prev;
            return map;
          });
          setIsLoading(false);
        });
      };
      window.addEventListener('scroll', scheduleLoad, { once: true, passive: true });
      window.addEventListener('pointerdown', scheduleLoad, { once: true, passive: true });
      setTimeout(scheduleLoad, 8000);
    } else {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to cross-tab storage changes and custom events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cafe_menu_availability' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setAvailabilityMap(parsed);
        } catch {
          // ignore
        }
      }
    };

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<Record<string, boolean>>;
      if (custom.detail) {
        setAvailabilityMap(custom.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AVAILABILITY_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AVAILABILITY_EVENT, handleCustomEvent);
    };
  }, []);

  const isAvailable = useCallback(
    (itemId: string): boolean => {
      return checkIsAvailable(itemId, availabilityMap);
    },
    [availabilityMap]
  );

  const toggleAvailability = useCallback(
    async (itemId: string, nextAvailable: boolean, reason?: string) => {
      const res = await setMenuItemAvailability(itemId, nextAvailable, reason);
      if (res.success) {
        setAvailabilityMap((prev) => ({
          ...prev,
          [itemId]: nextAvailable,
        }));
      }
      return res;
    },
    []
  );

  const refreshAvailability = useCallback(async () => {
    setIsLoading(true);
    const map = await fetchAvailabilityMap();
    setAvailabilityMap(map);
    setIsLoading(false);
  }, []);

  return {
    availabilityMap,
    isAvailable,
    toggleAvailability,
    refreshAvailability,
    isLoading,
  };
}
