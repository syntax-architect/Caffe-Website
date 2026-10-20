import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* *; frame-ancestors *;",
    },
  },
  build: {
    emptyOutDir: true,
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
