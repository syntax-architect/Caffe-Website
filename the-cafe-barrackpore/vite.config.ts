import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/');
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/scheduler/') ||
              normalized.includes('/react-is/')
            ) {
              return 'vendor-react';
            }
            if (
              normalized.includes('framer-motion') ||
              normalized.includes('motion-dom') ||
              normalized.includes('motion-utils')
            ) {
              return 'vendor-framer';
            }
            if (normalized.includes('@supabase')) return 'vendor-supabase';
            if (normalized.includes('lenis')) return 'vendor-lenis';
            if (normalized.includes('dompurify')) return 'vendor-dompurify';
            if (normalized.includes('qrcode')) return 'vendor-qrcode';
            return 'vendor';
          }
        }
      }
    }
  }
})
