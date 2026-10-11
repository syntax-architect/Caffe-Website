import React, { useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const emptySubscribe = () => () => {};
const useIsMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

interface SectionRevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header';
}

/**
 * SectionReveal: Consistent, restrained viewport reveal pattern
 * - Gentle upward movement of ~16-24px
 * - Smooth opacity transition
 * - Single viewport trigger
 * - SSR-friendly (fully visible on server render / pre-render)
 * - Honors prefers-reduced-motion
 */
export const SectionReveal: React.FC<SectionRevealProps> = ({
  children,
  delay = 0,
  y = 20,
  className = '',
  as = 'div',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isMounted = useIsMounted();

  // During SSR and before hydration, render plain semantic element to prevent SEO cloaking
  // or flash of hidden content
  if (!isMounted || shouldReduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1] as const,
      }}
      className={className}
    >
      {children}
    </MotionTag>
  );
};

interface SectionRevealGroupProps {
  children: React.ReactNode;
  staggerMs?: number;
  className?: string;
  y?: number;
}

/**
 * SectionRevealGroup: Staggers related children by ~60-100ms
 */
export const SectionRevealGroup: React.FC<SectionRevealGroupProps> = ({
  children,
  staggerMs = 80,
  className = '',
  y = 20,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isMounted = useIsMounted();

  if (!isMounted || shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerMs / 1000,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className={className}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return (
          <motion.div variants={itemVariants} className="w-full">
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
};
