const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoDir = path.resolve(__dirname, '..');
const publicFont = path.join(repoDir, 'public', 'fonts', 'material-symbols-outlined.woff2');
const distFont = path.join(repoDir, 'dist', 'fonts', 'material-symbols-outlined.woff2');

console.log('=== MATERIAL SYMBOLS FONT VERIFICATION ===');

const fontExists = fs.existsSync(publicFont);
const fileSize = fontExists ? fs.statSync(publicFont).size : 0;
const isValidSubset = fontExists && fileSize > 10000 && fileSize < 500000;

// If a valid pre-compiled subset exists and we are not explicitly forcing a rebuild, use it!
if (isValidSubset && process.env.FORCE_FONT_SUBSET !== '1') {
  console.log(`[OK] High-performance subset font verified: public/fonts/material-symbols-outlined.woff2 (${(fileSize / 1024).toFixed(2)} KB)`);
  
  // Sync to dist if dist/fonts exists
  const distFontsDir = path.dirname(distFont);
  if (fs.existsSync(distFontsDir)) {
    fs.copyFileSync(publicFont, distFont);
    console.log(`[OK] Synced subset font to dist/fonts/material-symbols-outlined.woff2`);
  }
  process.exit(0);
}

// Otherwise, attempt to execute subsetFont.py with Python
console.log('[INFO] Rebuilding font subset via Python pipeline...');
const pythonCmds = ['python3', 'python', 'py'];
let pythonExecuted = false;

for (const cmd of pythonCmds) {
  try {
    const res = spawnSync(cmd, ['scripts/subsetFont.py'], {
      cwd: repoDir,
      stdio: 'inherit',
      env: process.env
    });
    if (res.status === 0) {
      pythonExecuted = true;
      break;
    }
  } catch (e) {
    // try next command
  }
}

if (!pythonExecuted && !isValidSubset) {
  console.error('[ERROR] Failed to execute Python font subset pipeline and no valid subset font exists.');
  process.exit(1);
} else if (!pythonExecuted && isValidSubset) {
  console.log(`[OK] Python not available; using existing subset font (${(fileSize / 1024).toFixed(2)} KB).`);
  process.exit(0);
}
