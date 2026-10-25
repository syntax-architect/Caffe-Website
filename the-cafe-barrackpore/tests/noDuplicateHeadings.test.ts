import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { fr } from '../src/i18n/fr';
import { hi } from '../src/i18n/hi';
import { ja } from '../src/i18n/ja';
import { ko } from '../src/i18n/ko';
import { pt } from '../src/i18n/pt';
import { th } from '../src/i18n/th';
import { tr } from '../src/i18n/tr';
import { zh } from '../src/i18n/zh';
import { DEFAULT_STORY_CHAPTERS } from '../src/services/siteContentService';
import type { SupportedLanguage, TranslationDictionary } from '../src/i18n/types';

console.log('=== VERIFYING NO DUPLICATE HEADINGS IN STORY CHAPTERS & I18N ===\n');

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  en, ar, de, es, fr, hi, ja, ko, pt, th, tr, zh
};

function hasDuplicateMultiWordPhrase(text: string, minWords = 2): string | null {
  // Normalize punctuation and whitespace
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length < minWords * 2) return null;

  for (let len = minWords; len <= Math.floor(tokens.length / 2); len++) {
    const seen = new Map<string, number>();
    for (let i = 0; i <= tokens.length - len; i++) {
      const phrase = tokens.slice(i, i + len).join(' ');
      if (seen.has(phrase)) {
        const prevIdx = seen.get(phrase)!;
        if (i >= prevIdx + len) {
          return phrase;
        }
      } else {
        seen.set(phrase, i);
      }
    }
  }
  return null;
}

function getWordSet(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Filter out short conjunctions/particles (< 2 chars like '&', 'و', 'y')
  return new Set(cleaned.split(' ').filter(w => w.length >= 2));
}

let failureCount = 0;

// 1. Verify all 12 language files for story heading
for (const [lang, dict] of Object.entries(dictionaries)) {
  const story = dict.story;
  if (!story) {
    console.error(`❌ Language "${lang}" is missing story section!`);
    failureCount++;
    continue;
  }

  const title = (story.title || '').trim();
  const titleItalic = (story.titleItalic || '').trim();

  // Condition A: titleItalic must not be a substring of title
  if (title.toLowerCase().includes(titleItalic.toLowerCase())) {
    console.error(`❌ [${lang}] titleItalic ("${titleItalic}") is a substring of title ("${title}")`);
    failureCount++;
  }

  // Condition B: title + titleItalic must not repeat words
  const titleWords = getWordSet(title);
  const italicWords = getWordSet(titleItalic);
  const repeatedWords: string[] = [];
  for (const w of italicWords) {
    if (titleWords.has(w)) {
      repeatedWords.push(w);
    }
  }
  if (repeatedWords.length > 0) {
    console.error(`❌ [${lang}] Repeated words between title and titleItalic: ${repeatedWords.join(', ')}`);
    failureCount++;
  }

  // Condition C: Rendered heading text must not repeat 2+ word phrases
  const rendered = `${title} ${titleItalic}`;
  const dupPhrase = hasDuplicateMultiWordPhrase(rendered, 2);
  if (dupPhrase) {
    console.error(`❌ [${lang}] Rendered heading contains duplicate phrase "${dupPhrase}": "${rendered}"`);
    failureCount++;
  }
}

// 2. Verify DEFAULT_STORY_CHAPTERS
for (let idx = 0; idx < DEFAULT_STORY_CHAPTERS.length; idx++) {
  const ch = DEFAULT_STORY_CHAPTERS[idx];
  const title = ch.title.trim();
  const titleItalic = ch.titleItalic.trim();

  if (title.toLowerCase().includes(titleItalic.toLowerCase())) {
    console.error(`❌ Chapter ${idx + 1} titleItalic ("${titleItalic}") is a substring of title ("${title}")`);
    failureCount++;
  }

  const rendered = `${title} ${titleItalic}`;
  const dupPhrase = hasDuplicateMultiWordPhrase(rendered, 2);
  if (dupPhrase) {
    console.error(`❌ Chapter ${idx + 1} rendered heading contains duplicate phrase "${dupPhrase}": "${rendered}"`);
    failureCount++;
  }
}

if (failureCount > 0) {
  throw new Error(`Heading verification failed with ${failureCount} errors.`);
}

console.log('✔ All 12 language files and story chapters passed duplicate heading verification with ZERO errors.');
