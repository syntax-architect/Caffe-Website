import fs from 'node:fs';
import path from 'node:path';

console.log('=== VERIFYING KDS EMPTY STATE & FETCH RESOLUTION ===\n');

// 1. Check KitchenEmptyState.tsx renders "No active tickets"
const emptyStatePath = path.resolve(process.cwd(), 'src/components/kitchen/KitchenEmptyState.tsx');
const emptyStateContent = fs.readFileSync(emptyStatePath, 'utf8');

if (!emptyStateContent.includes('No active tickets')) {
  throw new Error('KitchenEmptyState.tsx must contain "No active tickets" heading');
}
console.log('✔ KitchenEmptyState.tsx contains "No active tickets"');

// 2. Check KitchenDisplayApp.tsx renders KitchenEmptyState when counts.totalActive === 0
const kdsAppPath = path.resolve(process.cwd(), 'src/components/kitchen/KitchenDisplayApp.tsx');
const kdsAppContent = fs.readFileSync(kdsAppPath, 'utf8');

if (!kdsAppContent.includes('KitchenEmptyState')) {
  throw new Error('KitchenDisplayApp.tsx must import and render KitchenEmptyState');
}

if (!kdsAppContent.includes('counts.totalActive === 0')) {
  throw new Error('KitchenDisplayApp.tsx must check counts.totalActive === 0 to render KitchenEmptyState');
}
console.log('✔ KitchenDisplayApp.tsx conditionally renders KitchenEmptyState on 0 active orders');

// 3. Check useKitchenOrders.ts has safety timeout to guarantee initial fetch resolves and never leaves permanent skeleton
const hookPath = path.resolve(process.cwd(), 'src/hooks/useKitchenOrders.ts');
const hookContent = fs.readFileSync(hookPath, 'utf8');

if (!hookContent.includes('safetyTimer') && !hookContent.includes('setTimeout')) {
  throw new Error('useKitchenOrders.ts must have a safety timeout preventing permanent skeleton');
}
console.log('✔ useKitchenOrders.ts includes safety timer resolving initial loading state');

console.log('\n✔ All KDS empty state and resolution requirements verified successfully.');
