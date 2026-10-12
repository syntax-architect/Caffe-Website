import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml']);

// Security headers matching production _headers specification
const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'X-XSS-Protection': '1; mode=block'
};

// In-memory cache for ultra-high throughput zero-disk-I/O serving
const fileCache = new Map();
const urlRouteMap = new Map();

function getCacheControl(relativePath, ext) {
  if (ext === '.html') {
    return 'public, max-age=0, must-revalidate';
  }
  if (relativePath.startsWith('/assets/') || relativePath.startsWith('/fonts/') || relativePath.startsWith('/frames/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (relativePath.startsWith('/images/')) {
    return 'public, max-age=2592000, stale-while-revalidate=86400';
  }
  return 'public, max-age=86400';
}

function indexDirectory(dir, baseRoute = '') {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const route = `${baseRoute}/${entry.name}`;

    if (entry.isDirectory()) {
      indexDirectory(fullPath, route);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const raw = fs.readFileSync(fullPath);
      const etag = `"${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}"`;
      const cacheControl = getCacheControl(route, ext);

      let gzipped = null;
      let brotli = null;

      if (COMPRESSIBLE.has(ext)) {
        try {
          gzipped = zlib.gzipSync(raw, { level: 9 });
        } catch {}
        try {
          brotli = zlib.brotliCompressSync(raw, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 9
            }
          });
        } catch {}
      }

      const fileRecord = {
        raw,
        gzipped,
        brotli,
        etag,
        contentType,
        cacheControl
      };

      fileCache.set(fullPath, fileRecord);
      urlRouteMap.set(route, fileRecord);

      // Route aliases for clean URLs
      if (entry.name === 'index.html') {
        urlRouteMap.set(baseRoute || '/', fileRecord);
        urlRouteMap.set((baseRoute || '') + '/', fileRecord);
      } else if (ext === '.html') {
        const withoutExt = route.slice(0, -5);
        urlRouteMap.set(withoutExt, fileRecord);
      }
    }
  }
}

// Pre-index the entire distribution tree into memory on startup
indexDirectory(distDir);

const spaIndex = urlRouteMap.get('/') || fileCache.get(path.join(distDir, 'index.html'));

const server = http.createServer((req, res) => {
  // Support GET and HEAD methods
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain', ...BASE_SECURITY_HEADERS });
    res.end('Method Not Allowed');
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  let record = urlRouteMap.get(reqPath);

  if (!record) {
    if (reqPath.endsWith('/')) {
      record = urlRouteMap.get(reqPath.slice(0, -1)) || urlRouteMap.get(reqPath + 'index.html');
    } else if (!path.extname(reqPath)) {
      record = urlRouteMap.get(reqPath + '.html') || urlRouteMap.get(reqPath + '/index.html');
    }
  }

  // SPA fallback for routes without file extension
  if (!record) {
    if (path.extname(reqPath) && path.extname(reqPath) !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...BASE_SECURITY_HEADERS });
      res.end('Not Found');
      return;
    }
    record = spaIndex;
  }

  if (!record) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...BASE_SECURITY_HEADERS });
    res.end('Not Found');
    return;
  }

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch) {
    const cleanHeader = ifNoneMatch.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
    const cleanEtag = record.etag.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
    if (cleanHeader === cleanEtag || ifNoneMatch === record.etag || ifNoneMatch === '*' || ifNoneMatch.includes(cleanEtag)) {
      res.writeHead(304, {
        ETag: record.etag,
        'Cache-Control': record.cacheControl,
        ...BASE_SECURITY_HEADERS
      });
      res.end();
      return;
    }
  }

  const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();
  let body = record.raw;
  let contentEncoding = null;

  if (record.brotli && acceptEncoding.includes('br')) {
    body = record.brotli;
    contentEncoding = 'br';
  } else if (record.gzipped && acceptEncoding.includes('gzip')) {
    body = record.gzipped;
    contentEncoding = 'gzip';
  }

  const headers = {
    'Content-Type': record.contentType,
    'Content-Length': body.length,
    'Cache-Control': record.cacheControl,
    ETag: record.etag,
    Vary: 'Accept-Encoding',
    ...BASE_SECURITY_HEADERS
  };

  if (contentEncoding) {
    headers['Content-Encoding'] = contentEncoding;
  }

  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(body);
  }
});

// High-concurrency socket and connection settings
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxHeadersCount = 100;

const PORT = 4173;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`READY: http://127.0.0.1:${PORT} [In-Memory High-Performance Static Engine Loaded]`);
});
