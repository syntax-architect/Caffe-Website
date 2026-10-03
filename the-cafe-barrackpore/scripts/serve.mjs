import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
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
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml']);

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath.endsWith('/')) {
    reqPath += 'index.html';
  } else if (!path.extname(reqPath)) {
    const directFile = path.join(distDir, reqPath + '.html');
    if (fs.existsSync(directFile)) {
      reqPath = reqPath + '.html';
    } else {
      reqPath = path.join(reqPath, 'index.html');
    }
  }

  let filePath = path.join(distDir, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (path.extname(reqPath) && path.extname(reqPath) !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  let content = fs.readFileSync(filePath);

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('gzip')) {
    const gzipped = zlib.gzipSync(content);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Content-Length': gzipped.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(gzipped);
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(content);
  }
});

const PORT = 4173;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`READY: http://127.0.0.1:${PORT}`);
});
