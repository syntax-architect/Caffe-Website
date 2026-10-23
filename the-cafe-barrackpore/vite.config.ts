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
