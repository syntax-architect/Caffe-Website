import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, '../lighthouse-report.json');

const serverProc = spawn('node', ['scripts/serve.mjs'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'pipe']
});

serverProc.stdout.on('data', (chunk) => {
  const msg = chunk.toString();
  if (msg.includes('READY:')) {
    console.log('Static server ready. Starting Lighthouse mobile audit...');
    try {
      execSync(
        `npx lighthouse http://127.0.0.1:4173 --form-factor=mobile --output=json --output-path="${reportPath}" --save-assets --chrome-flags="--headless=new --no-sandbox" --quiet`,
        { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
      );

      if (fs.existsSync(reportPath)) {
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const categories = data.categories;
        console.log('\n======================================================');
        console.log('            LIGHTHOUSE MOBILE AUDIT RESULTS           ');
        console.log('======================================================');
        console.log(`Performance:    ${Math.round(categories.performance.score * 100)} / 100`);
        console.log(`Accessibility:  ${Math.round(categories.accessibility.score * 100)} / 100`);
        console.log(`Best Practices: ${Math.round(categories['best-practices'].score * 100)} / 100`);
        console.log(`SEO:            ${Math.round(categories.seo.score * 100)} / 100`);
        console.log('======================================================\n');

        const audits = data.audits;
        console.log('Core Web Vitals & Key Metrics:');
        console.log(`- First Contentful Paint (FCP): ${audits['first-contentful-paint']?.displayValue}`);
        console.log(`- Largest Contentful Paint (LCP): ${audits['largest-contentful-paint']?.displayValue}`);
        console.log(`- Total Blocking Time (TBT):     ${audits['total-blocking-time']?.displayValue}`);
        console.log(`- Cumulative Layout Shift (CLS): ${audits['cumulative-layout-shift']?.displayValue}`);
        console.log(`- Speed Index:                  ${audits['speed-index']?.displayValue}`);

        const failedA11y = Object.values(audits).filter(a => a.score !== null && a.score < 1 && categories.accessibility.auditRefs?.some(r => r.id === a.id));
        if (failedA11y.length > 0) {
          console.log('\nAccessibility Opportunities:');
          failedA11y.forEach(a => console.log(`- [${a.id}] ${a.title}`));
        }

        const failedSeo = Object.values(audits).filter(a => a.score !== null && a.score < 1 && categories.seo.auditRefs?.some(r => r.id === a.id));
        if (failedSeo.length > 0) {
          console.log('\nSEO Opportunities:');
          failedSeo.forEach(a => console.log(`- [${a.id}] ${a.title}`));
        }
      }
    } catch (err) {
      console.error('Lighthouse execution error:', err.message);
    } finally {
      serverProc.kill();
      process.exit(0);
    }
  }
});

serverProc.stderr.on('data', (chunk) => {
  console.error('Server error:', chunk.toString());
});

serverProc.on('exit', () => {
  process.exit(0);
});
