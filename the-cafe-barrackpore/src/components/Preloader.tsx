import React from 'react';

/**
 * Preloader component:
 * Bypassed in production to prevent blocking First Contentful Paint (FCP) and Largest Contentful Paint (LCP).
 * Static pre-rendering delivers immediate painted HTML without requiring an artificial loading delay.
 */
export const Preloader: React.FC = () => {
  return null;
};
