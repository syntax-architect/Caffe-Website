import fs from 'node:fs';
import path from 'node:path';

console.log('=== VERIFYING CTA ICON CONSISTENCY FOR BOOK/RESERVE A TABLE ===\n');

const filesToCheck = [
  'src/components/Header.tsx',
  'src/components/Hero.tsx',
  'src/components/Footer.tsx',
  'src/components/MobileActionDock.tsx',
  'src/components/ReservationDrawer.tsx',
];

let failed = false;

for (const relPath of filesToCheck) {
  const fullPath = path.resolve(process.cwd(), relPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Verify that table_restaurant is NOT used for table reservation triggers
  if (relPath.includes('Footer.tsx') || relPath.includes('Header.tsx')) {
    if (content.includes("table_restaurant") && (content.includes("isTableBookingEnabled") || content.includes("Reserve a Table") || content.includes("Book a Table"))) {
      // Check if table_restaurant is used in a booking context
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('table_restaurant') && (lines[Math.max(0, idx - 5)].includes('Booking') || lines[Math.max(0, idx - 1)].includes('Booking'))) {
          console.error(`❌ [${relPath}:${idx + 1}] Found "table_restaurant" in reservation CTA: ${l.trim()}`);
          failed = true;
        }
      });
    }
  }

  // Ensure calendar_today is present in reservation CTAs
  if (!content.includes('calendar_today')) {
    console.error(`❌ [${relPath}] Missing "calendar_today" icon for reservation CTA!`);
    failed = true;
  } else {
    console.log(`✔ [${relPath}] Uses "calendar_today" for reservation CTA`);
  }
}

if (failed) {
  throw new Error('CTA icon consistency check failed.');
}

console.log('\n✔ All reservation CTA buttons consistently use calendar_today icon.');
