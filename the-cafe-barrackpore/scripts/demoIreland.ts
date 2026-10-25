import { spawn } from 'node:child_process';

process.env.VITE_DEMO_PRESET = 'IE';
process.env.VITE_RESTAURANT_COUNTRY = 'IE';
process.env.VITE_CLIENT_MODE = 'demo';
process.env.VITE_EXPERIENCE = 'clean';

console.log('☘️  [Caffè] Starting Ireland Euro Demo...');
console.log('🏛️  Restaurant: The Artisan Roast Dublin');
console.log('💶  Currency: EUR (€) | Dual VAT: 9% Food, 23% Alcohol & Soft Drinks');
console.log('📍  Location: 28 Temple Bar, Dublin 2, D02 X285, Ireland\n');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['vite', '--host'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DEMO_PRESET: 'IE',
    VITE_RESTAURANT_COUNTRY: 'IE',
    VITE_CLIENT_MODE: 'demo',
    VITE_EXPERIENCE: 'clean',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
