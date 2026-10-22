#!/usr/bin/env node

/**
 * Caffe OS Local LAN Thermal Print Bridge
 * Commercial Grade — Lightweight, Zero-Dependency Network Printer Proxy
 * Enables Web Apps to print directly to RAW Port 9100 ESC/POS Printers over LAN.
 *
 * Usage:
 *   node scripts/print-bridge.mjs [--port 9123] [--host 0.0.0.0]
 */

import http from 'http';
import net from 'net';

const args = process.argv.slice(2);
let PORT = 9123;
let HOST = '0.0.0.0';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10) || 9123;
    i++;
  } else if (args[i] === '--host' && args[i + 1]) {
    HOST = args[i + 1];
    i++;
  }
}

if (process.env.BRIDGE_PORT) {
  PORT = parseInt(process.env.BRIDGE_PORT, 10) || PORT;
}

/**
 * Sends a raw binary buffer to a remote TCP thermal printer
 */
function sendToPrinter(printerIp, printerPort, buffer, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        reject(new Error(`Connection to printer ${printerIp}:${printerPort} timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    socket.connect(printerPort, printerIp, () => {
      socket.write(buffer, () => {
        socket.end();
      });
    });

    socket.on('close', () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({ success: true, bytesSent: buffer.length });
      }
    });

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(`Printer socket error (${printerIp}:${printerPort}): ${err.message}`));
      }
    });
  });
}

const server = http.createServer((req, res) => {
  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health check endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        bridgeVersion: '1.0.0',
        port: PORT,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Raw ESC/POS print endpoint
  if (url.pathname === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Max 5MB print job safety limit
      if (body.length > 5 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Payload exceeds 5MB limit.' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const printerIp = payload.printerIp || '192.168.1.200';
        const printerPort = parseInt(payload.printerPort, 10) || 9100;
        const base64Data = payload.data;

        if (!base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing base64 data field.' }));
          return;
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const result = await sendToPrinter(printerIp, printerPort, buffer);

        console.log(`[PrintBridge] Dispatched ${buffer.length} bytes to ${printerIp}:${printerPort}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        console.error('[PrintBridge] Error dispatching print job:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Cash drawer kick pulse endpoint
  if (url.pathname === '/drawer' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const printerIp = payload.printerIp || '192.168.1.200';
        const printerPort = parseInt(payload.printerPort, 10) || 9100;
        const pin = payload.pin === 1 ? 1 : 0;

        // Standard ESC/POS Pulse: ESC p m t1 t2
        const pulseBuffer = Buffer.from([0x1B, 0x70, pin, 0x19, 0xFA]);
        await sendToPrinter(printerIp, printerPort, pulseBuffer);

        console.log(`[PrintBridge] Triggered cash drawer kick on ${printerIp}:${printerPort}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Cash drawer pulse sent.' }));
      } catch (err) {
        console.error('[PrintBridge] Error triggering drawer pulse:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found. Available: /health, /print, /drawer' }));
});

server.listen(PORT, HOST, () => {
  console.log('================================================================');
  console.log(`🖨️  Caffe OS Thermal Print Bridge v1.0.0`);
  console.log(`Listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Network Thermal Printer Proxy for Port 9100 (ESC/POS RAW)`);
  console.log(`Endpoints:`);
  console.log(`  - GET  /health (Check bridge status)`);
  console.log(`  - POST /print  (Proxy base64 ESC/POS payload to IP:9100)`);
  console.log(`  - POST /drawer (Trigger cash drawer pulse)`);
  console.log('================================================================');
});
