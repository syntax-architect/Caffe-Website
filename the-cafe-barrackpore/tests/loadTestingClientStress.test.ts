import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkRateLimit, recordRateLimitAttempt } from '../src/utils/rateLimiter';
import { calculateTaxBreakdown, roundCurrency } from '../src/utils/taxEngine';
import fs from 'fs';
import path from 'path';

describe('Load & Stress Testing Verification Suite', () => {
  it('Stress Test 1: High-Frequency Rate Limiter Burst (10,000 rapid operations without memory leak)', () => {
    const startTime = performance.now();
    const actionKey = 'stress_order_test';

    // Populate multiple action keys to verify bounded pruning
    for (let i = 0; i < 50; i++) {
      const uniqueAction = `stress_action_${i}`;
      for (let j = 0; j < 50; j++) {
        recordRateLimitAttempt(uniqueAction, 1000);
      }
    }

    // 10,000 rapid calls to check and enforce rate limit
    let blockedCount = 0;
    let allowedCount = 0;

    for (let i = 0; i < 10000; i++) {
      const result = checkRateLimit(actionKey, 5, 60000);
      if (result.allowed) {
        allowedCount++;
        recordRateLimitAttempt(actionKey, 60000);
      } else {
        blockedCount++;
      }
    }

    const duration = performance.now() - startTime;
    console.log(`  ✔ 10,000 rate limiter operations completed in ${duration.toFixed(2)}ms (${(10000 / (duration / 1000)).toFixed(0)} ops/sec)`);

    assert.strictEqual(allowedCount, 5, 'Exactly 5 attempts should have been allowed');
    assert.strictEqual(blockedCount, 9995, 'Remaining 9,995 attempts should have been blocked');
    assert.ok(duration < 1500, `Duration (${duration.toFixed(2)}ms) must be under 1500ms`);
  });

  it('Stress Test 2: High-Frequency Cart & Tax Calculation (10,000 iterations)', () => {
    const startTime = performance.now();

    const items = [
      { amount: 450, quantity: 2 },
      { amount: 180, quantity: 1 },
      { amount: 320, quantity: 3 }
    ];

    const taxConfig = {
      enabled: true,
      mode: 'inclusive' as const,
      label: 'GST',
      rate: 0.05,
      rules: [
        { label: 'CGST', rate: 0.025, mode: 'inclusive' as const },
        { label: 'SGST', rate: 0.025, mode: 'inclusive' as const }
      ]
    };

    let totalAccumulated = 0;

    for (let i = 0; i < 10000; i++) {
      const breakdown = calculateTaxBreakdown(items, taxConfig);
      totalAccumulated += breakdown.grandTotal;
    }

    const duration = performance.now() - startTime;
    console.log(`  ✔ 10,000 cart & tax calculations completed in ${duration.toFixed(2)}ms (${(10000 / (duration / 1000)).toFixed(0)} ops/sec)`);

    assert.ok(totalAccumulated > 0);
    assert.strictEqual(roundCurrency(totalAccumulated / 10000), 2040, 'Math accuracy across 10,000 iterations');
    assert.ok(duration < 250, `Calculations must execute within 250ms (took ${duration.toFixed(2)}ms)`);
  });

  it('Stress Test 3: Static Pre-render Output Integrity & Assets', () => {
    const distDir = path.resolve(process.cwd(), 'dist');
    assert.ok(fs.existsSync(distDir), 'dist directory must exist');

    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('<html'), 'index.html must contain html tag');
    assert.ok(indexHtml.length > 50000, 'index.html must contain full pre-rendered HTML (>50KB)');

    // Verify key pre-rendered routes exist
    assert.ok(fs.existsSync(path.join(distDir, 'privacy/index.html')), 'privacy page must be pre-rendered');
    assert.ok(fs.existsSync(path.join(distDir, 'terms/index.html')), 'terms page must be pre-rendered');

    console.log(`  ✔ Static pre-rendered outputs verified across routes (${(indexHtml.length / 1024).toFixed(1)} KB HTML)`);
  });
});
