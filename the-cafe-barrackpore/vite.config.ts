import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function canonicalConfigPlugin() {
  const domain = 'thecafebarrackpore.com';
  const origin = `https://${domain}`.replace(/\/+$/, '');
  return {
    name: 'canonical-config-plugin',
    transformIndexHtml(html: string) {
      return html.replace(/https:\/\/thecafebarrackpore\.com/g, origin);
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), canonicalConfigPlugin()],
  server: {
    port: 5175,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* *; frame-ancestors *;",
    },
  },
  preview: {
    port: 4173,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* https://checkout.razorpay.com https://cdn.razorpay.com https://js.stripe.com https://challenges.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://api.stripe.com https://maps.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com https://*.ingest.sentry.io https://*.sentry.io; frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; block-all-mixed-content; upgrade-insecure-requests;",
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('@supabase')) return 'vendor-supabase';
            if (normalized.includes('lenis')) return 'vendor-lenis';
            if (normalized.includes('react-dom') || normalized.includes('react/') || normalized.includes('scheduler')) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  }
})
