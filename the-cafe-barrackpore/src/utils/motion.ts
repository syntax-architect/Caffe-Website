/**
 * Shared Restaurant Engine Motion System
 *
 * Centralizes cinematic animation timing, curves, and variants across
 * desktop and touch platforms with strict reduced-motion accessibility.
 */

import type { Variants } from 'framer-motion';

/**
 * Standard easing curves for editorial and interaction animations.
 */
export const EASING = {
  /** Signature editorial curve: swift acceleration with luxurious smooth deceleration */
  editorial: [0.16, 1, 0.3, 1] as const,
  /** Responsive exit easing */
  exit: [0.4, 0, 0.2, 1] as const,
  /** Gentle spring for tactile micro-interactions */
  springGentle: { type: 'spring', stiffness: 380, damping: 28 } as const,
  /** Snappy spring for quick taps */
  springSnappy: { type: 'spring', stiffness: 500, damping: 30 } as const,
} as const;

/**
 * Standard durations in seconds.
 */
export const DURATION = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.4,
  slow: 0.7,
  deliberate: 1.0,
  settle: 1.4,
} as const;

/**
 * Hero entrance sequence choreography timing constants (seconds).
 */
export const HERO_CHOREOGRAPHY = {
  maskDuration: 1.2,
  bgSettling: {
    fromScale: 1.04,
    toScale: 1.00,
    duration: 1.4,
  },
  delays: {
    eyebrow: 0.15,
    headline1: 0.28,
    headline2: 0.42,
    copy: 0.65,
    actions: 0.85,
    footer: 1.05,
  },
  mobileDelays: {
    eyebrow: 0.08,
    headline1: 0.16,
    headline2: 0.26,
    copy: 0.40,
    actions: 0.55,
    footer: 0.70,
  },
} as const;

/**
 * Resolves animation variants, simplifying or eliminating transform/scale
 * when the user requests reduced motion (`prefers-reduced-motion: reduce`).
 */
export function resolveReducedMotion<T extends Variants>(
  variants: T,
  shouldReduceMotion = false
): T {
  if (!shouldReduceMotion) return variants;

  const accessibleVariants: Record<string, any> = {};

  for (const [key, val] of Object.entries(variants)) {
    if (typeof val === 'function') {
      accessibleVariants[key] = (custom: any) => {
        const resolved = (val as (custom: any) => any)(custom);
        return {
          opacity: typeof resolved === 'object' && resolved !== null ? (resolved.opacity ?? 1) : 1,
          transition: { duration: DURATION.instant, ease: 'linear' },
        };
      };
    } else if (typeof val === 'object' && val !== null) {
      const resolved = val as Record<string, any>;
      accessibleVariants[key] = {
        opacity: resolved.opacity ?? 1,
        transition: { duration: DURATION.instant, ease: 'linear' },
      };
    } else {
      accessibleVariants[key] = val;
    }
  }

  return accessibleVariants as T;
}

/**
 * Editorial content reveal: subtle vertical rise with opacity fade.
 */
export function fadeSlideUp(
  distance = 20,
  delay = 0,
  duration: number = DURATION.normal
): Variants {
  return {
    initial: { opacity: 0, y: distance },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        delay,
        ease: EASING.editorial,
      },
    },
    exit: {
      opacity: 0,
      y: -Math.round(distance / 2),
      transition: {
        duration: DURATION.fast,
        ease: EASING.exit,
      },
    },
  };
}

/**
 * Container variant for staggered children reveals.
 */
export function staggerContainer(
  staggerChildren = 0.08,
  delayChildren = 0
): Variants {
  return {
    initial: {},
    animate: {
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}

/**
 * Tactile touch/click micro-interaction feedback.
 */
export const touchFeedback = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { duration: DURATION.fast, ease: EASING.editorial },
};

/**
 * Direction-aware chapter transition variants for OurStory.
 */
export const chapterTransitionVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? 14 : -14,
  }),
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.editorial,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? -14 : 14,
    transition: {
      duration: DURATION.fast,
      ease: EASING.exit,
    },
  }),
};

/**
 * Smooth cinematic image cross-fade with subtle Ken Burns scale settle.
 */
export const cinematicImageVariants: Variants = {
  initial: { opacity: 0, scale: 1.03 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      opacity: { duration: DURATION.slow, ease: 'easeInOut' },
      scale: { duration: DURATION.settle, ease: EASING.editorial },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: DURATION.normal,
      ease: EASING.exit,
    },
  },
};
