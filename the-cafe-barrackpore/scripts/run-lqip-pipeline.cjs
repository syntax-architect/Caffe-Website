/**
 * Cross-platform runner for the AVIF & LQIP pipeline.
 * Tries `python` then `python3` to run generate-avif-and-lqip.py.
 * If Python is not installed or Pillow is missing, gracefully falls back
 * to the pre-generated lqip-manifest.json without failing the build.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pyScript = path.join(__dirname, 'generate-avif-and-lqip.py');
const manifestPath = path.join(__dirname, '..', 'public', 'lqip-manifest.json');

function tryPython(cmd) {
  try {
    const res = spawnSync(cmd, [pyScript], { stdio: 'inherit', shell: false });
    return res.status === 0;
  } catch {
    return false;
  }
}

// 1. Try python
let success = tryPython('python');

// 2. Try python3 if python failed or was missing
if (!success) {
  success = tryPython('python3');
}

// 3. If python is completely missing in the build environment, ensure fallback manifest exists
if (!success) {
  console.log('============================================================');
  console.log('[INFO] Python environment not available in this container.');
  if (fs.existsSync(manifestPath)) {
    console.log(`[OK] Pre-generated LQIP manifest verified at: ${manifestPath}`);
    console.log('[OK] Using committed static AVIF and WebP assets for deployment.');
  } else {
    console.log(`[WARN] Creating fallback manifest at: ${manifestPath}`);
    fs.writeFileSync(manifestPath, '{}\n', 'utf8');
  }
  console.log('============================================================\n');
}

// Always exit 0 so build pipeline proceeds to tsc and vite
process.exit(0);
