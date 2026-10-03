import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qypceuzyqupepttibqvi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU'
);

async function updateDb() {
  console.log('Attempting update with anon key...');
  const { data: heroData, error: heroErr } = await supabase
    .from('site_content')
    .update({
      value: {
        alt: 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge',
        src: '/images/hero-cinematic.jpg',
        subtext: 'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.',
        headline: 'Step Into Barrackpore’s Trendsetting Dining Retreat'
      }
    })
    .eq('key', 'hero')
    .select();

  console.log('Hero update result:', heroErr ? heroErr.message : heroData);

  const { data: storyData, error: storyErr } = await supabase
    .from('site_content')
    .update({
      value: {
        alt: 'Artisanal Espresso Pour',
        src: '/images/story-luxury-pour.jpg',
        title: 'Crafting Barrackpore’s finest nocturnal escape',
        description: 'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.'
      }
    })
    .eq('key', 'story')
    .select();

  console.log('Story update result:', storyErr ? storyErr.message : storyData);
}

updateDb();
