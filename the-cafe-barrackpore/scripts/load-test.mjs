import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function runCliAutocannon(args) {
  return new Promise((resolve, reject) => {
    const cmd = `npx autocannon -j ${args.join(' ')}`;
    exec(cmd, { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(err);
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (parseErr) {
        console.error('Failed to parse autocannon stdout:', stdout, stderr);
        reject(parseErr);
      }
    });
  });
}

function formatResult(name, res) {
  const rps = Math.round(res.requests.average);
  const dataMB = Number((res.throughput.total / 1024 / 1024).toFixed(2));
  const dataRate = (res.throughput.average / 1024 / 1024).toFixed(2);

  console.log(`\n======================================================`);
  console.log(`  BENCHMARK: ${name}`);
  console.log(`======================================================`);
  console.log(`Target URL:      ${res.url}`);
  console.log(`Connections:     ${res.connections}`);
  console.log(`Duration:        ${res.duration}s`);
  console.log(`Total Requests:  ${res.requests.total}`);
  console.log(`Throughput:      ${rps} req/sec`);
  console.log(`Data Transferred:${dataMB} MB (${dataRate} MB/s)`);
  console.log(`Errors:          ${res.errors}`);
  console.log(`Timeouts:        ${res.timeouts}`);
  console.log(`Non-2xx / Resets:${res.non2xx}`);
  console.log(`Latency (p50):   ${res.latency.p50} ms`);
  console.log(`Latency (p90):   ${res.latency.p90} ms`);
  console.log(`Latency (p97.5): ${res.latency.p97_5} ms`);
  console.log(`Latency (p99):   ${res.latency.p99} ms`);
  console.log(`Latency (Avg):   ${res.latency.average.toFixed(2)} ms`);
  console.log(`Latency (Max):   ${res.latency.max} ms`);
  console.log(`======================================================\n`);

  return {
    name,
    connections: res.connections,
    duration: res.duration,
    totalRequests: res.requests.total,
    rps,
    errors: res.errors,
    timeouts: res.timeouts,
    non2xx: res.non2xx,
    latency: {
      p50: res.latency.p50,
      p90: res.latency.p90,
      p97_5: res.latency.p97_5,
      p99: res.latency.p99,
      avg: Number(res.latency.average.toFixed(2)),
      max: res.latency.max
    },
    dataMB
  };
}

// Fetch the ETag of the root page for 304 conditional request testing
function fetchEtag(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.headers['etag'] || '');
    }).on('error', () => resolve(''));
  });
}

// Find first CSS and JS assets in dist/assets for realistic bundle load tests
function findAssetPaths() {
  const assetsDir = path.join(rootDir, 'dist/assets');
  let cssPath = '/';
  let jsPath = '/';
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const cssFile = files.find(f => f.endsWith('.css'));
    const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
    if (cssFile) cssPath = `/assets/${cssFile}`;
    if (jsFile) jsPath = `/assets/${jsFile}`;
  }
  return { cssPath, jsPath };
}

async function main() {
  console.log('Starting high-performance in-memory server on port ' + PORT + '...');
  const serverProc = spawn('node', ['scripts/serve.mjs'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProc.stderr.on('data', (d) => console.error('Server stderr:', d.toString()));

  // Wait for server ready
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timed out')), 10000);
    serverProc.stdout.on('data', (d) => {
      if (d.toString().includes('READY:')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  console.log(`Server online at ${BASE_URL}. Initiating load testing battery...\n`);

  const { cssPath, jsPath } = findAssetPaths();
  const rootEtag = await fetchEtag(`${BASE_URL}/`);
  console.log(`Detected root ETag: ${rootEtag}`);
  console.log(`Detected Critical CSS: ${cssPath}`);
  console.log(`Detected Entry JS: ${jsPath}\n`);

  const results = [];

  try {
    // Test 1: Moderate Concurrency (50 connections, 8s) - HTML Root
    console.log('Running Test 1: 50 Concurrent Connections (HTML root with Brotli/Gzip)...');
    const r1 = await runCliAutocannon([
      '-c', '50',
      '-d', '8',
      '-H', 'Accept-Encoding=gzip,deflate,br',
      `${BASE_URL}/`
    ]);
    results.push(formatResult('HTML Root - 50 Concurrency (Brotli/Gzip)', r1));

    // Test 2: Peak Concurrency (100 connections, 8s) - HTML Root
    console.log('Running Test 2: 100 Concurrent Connections (HTML root with Brotli/Gzip)...');
    const r2 = await runCliAutocannon([
      '-c', '100',
      '-d', '8',
      '-H', 'Accept-Encoding=gzip,deflate,br',
      `${BASE_URL}/`
    ]);
    results.push(formatResult('HTML Root - 100 Concurrency (Brotli/Gzip)', r2));

    // Test 3: High-Stress Spike (250 connections, 8s) - HTML Root
    console.log('Running Test 3: 250 Concurrent Connections (Spike Stress)...');
    const r3 = await runCliAutocannon([
      '-c', '250',
      '-d', '8',
      '-H', 'Accept-Encoding=gzip,deflate,br',
      `${BASE_URL}/`
    ]);
    results.push(formatResult('HTML Root - 250 Concurrency (Spike Stress)', r3));

    // Test 4: Extreme Spike Surge (500 connections, 8s) - HTML Root
    console.log('Running Test 4: 500 Concurrent Connections (Extreme Surge)...');
    const r4 = await runCliAutocannon([
      '-c', '500',
      '-d', '8',
      '-H', 'Accept-Encoding=gzip,deflate,br',
      `${BASE_URL}/`
    ]);
    results.push(formatResult('HTML Root - 500 Concurrency (Extreme Surge)', r4));

    // Test 5: Critical CSS Delivery (100 connections, 8s)
    if (cssPath !== '/') {
      console.log('Running Test 5: Critical CSS Bundle (100 Concurrency)...');
      const r5 = await runCliAutocannon([
        '-c', '100',
        '-d', '8',
        '-H', 'Accept-Encoding=gzip,deflate,br',
        `${BASE_URL}${cssPath}`
      ]);
      results.push(formatResult('Critical CSS Bundle - 100 Concurrency', r5));
    }

    // Test 6: Entry JS Bundle Delivery (100 connections, 8s)
    if (jsPath !== '/') {
      console.log('Running Test 6: Entry JS Bundle (100 Concurrency)...');
      const r6 = await runCliAutocannon([
        '-c', '100',
        '-d', '8',
        '-H', 'Accept-Encoding=gzip,deflate,br',
        `${BASE_URL}${jsPath}`
      ]);
      results.push(formatResult('Entry JS Bundle - 100 Concurrency', r6));
    }

    // Test 7: Static Font High-Throughput (100 connections, 8s)
    console.log('Running Test 7: Static Font Asset (100 Concurrency)...');
    const r7 = await runCliAutocannon([
      '-c', '100',
      '-d', '8',
      '-H', 'Accept-Encoding=gzip,deflate,br',
      `${BASE_URL}/fonts/playfair-normal-600.woff2`
    ]);
    results.push(formatResult('Static Font Asset - 100 Concurrency', r7));

    // Test 8: Conditional Request / ETag 304 Validation (250 connections, 8s)
    if (rootEtag) {
      console.log('Running Test 8: ETag 304 Validation (250 Concurrency, Zero-Payload)...');
      const r8 = await runCliAutocannon([
        '-c', '250',
        '-d', '8',
        '-H', `If-None-Match=${rootEtag}`,
        `${BASE_URL}/`
      ]);
      results.push(formatResult('Conditional Request (304 Not Modified) - 250 Concurrency', r8));
    }

    console.log('\n======================================================');
    console.log('             LOAD TESTING SUMMARY MATRIX              ');
    console.log('======================================================');
    console.table(results.map(r => ({
      Scenario: r.name,
      Conns: r.connections,
      Requests: r.totalRequests,
      RPS: r.rps,
      'p50 (ms)': r.latency.p50,
      'p99 (ms)': r.latency.p99,
      'Max (ms)': r.latency.max,
      Errors: r.errors,
      Timeouts: r.timeouts,
      'Data (MB)': r.dataMB
    })));

    // Save report to disk for documentation and verification
    const reportSummary = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      results
    };
    fs.writeFileSync(path.join(rootDir, 'load-test-report.json'), JSON.stringify(reportSummary, null, 2));
    console.log('\nReport written to load-test-report.json');

  } catch (err) {
    console.error('Load testing error:', err);
  } finally {
    serverProc.kill();
    console.log('\nServer terminated. Load testing battery complete.');
  }
}

main();
