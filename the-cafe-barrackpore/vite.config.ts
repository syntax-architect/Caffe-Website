import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function sanityDevMiddlewarePlugin(): Plugin {
  return {
    name: 'sanity-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/sanity-mutate', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { docType, target, payload } = JSON.parse(body || '{}');
              const token = process.env.SANITY_WRITE_TOKEN;
              const projectId = process.env.SANITY_PROJECT_ID || 'vob0hoxy';
              const dataset = process.env.SANITY_DATASET || 'production';

              if (token) {
                let mutations: any[] = [];
                if (docType === 'siteConfig') {
                  mutations = [
                    {
                      patch: {
                        query: '*[_type == "siteConfig"][0]',
                        set: {
                          [`${target}Data`]: payload,
                          updatedAt: new Date().toISOString(),
                        },
                      },
                    },
                  ];
                } else if (docType === 'menuItem') {
                  mutations = [
                    {
                      createOrReplace: {
                        _id: target,
                        _type: 'menuItem',
                        name: payload.name,
                        price: payload.price,
                        description: payload.description,
                        dietType: payload.diet === 'nv' ? 'non-veg' : payload.diet === 'vegan' ? 'vegan' : 'veg',
                        popular: payload.tag === 'Bestseller',
                      },
                    },
                  ];
                }

                await fetch(
                  `https://${projectId}.api.sanity.io/v2024-01-01/data/mutate/${dataset}`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ mutations }),
                  }
                );
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, mode: token ? 'server_sanity' : 'local_persistence' }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sanityDevMiddlewarePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-framer';
            if (id.includes('@sanity')) return 'vendor-sanity';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lenis')) return 'vendor-lenis';
            return 'vendor';
          }
        }
      }
    }
  }
})
