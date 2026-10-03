import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-framer';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lenis')) return 'vendor-lenis';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            if (id.includes('qrcode')) return 'vendor-qrcode';
            return 'vendor';
          }
        }
      }
    }
  }
})
