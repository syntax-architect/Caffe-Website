import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qypceuzyqupepttibqvi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU'
);

async function check() {
  const { data, error } = await supabase.from('site_content').select('*');
  if (error) {
    console.error('Error fetching site_content:', error);
  } else {
    console.log('SITE_CONTENT ROWS COUNT:', data?.length);
    for (const r of data || []) {
      console.log(`KEY: ${r.key}`);
      console.log('VALUE:', JSON.stringify(r.value, null, 2));
    }
  }
}

check();
