import rawScholars from './seed/scholars.json';
import rawSources from './seed/sources.json';
import rawQuotes from './seed/quotes.json';
import rawHadiths from './seed/hadiths.json';
import rawDuas from './seed/duas.json';
import type { ContentBundle, Dua, Hadith, HadithCollection, Quote, Scholar, Source } from './types';

interface RawQuote {
  id: string;
  genre?: 'saying' | 'biography';
  scholar_slug: string;
  source_slug: string;
  text: string;
  book: string;
  volume?: number | null;
  page?: number | null;
  source_url?: string | null;
  tags?: string[];
  needs_reference_check?: boolean;
}

interface RawDua {
  id: string;
  text: string;
  narrator?: string | null;
  collection: string;
  number?: number | null;
  volume?: number | null;
  page?: number | null;
  source_url?: string | null;
  tags?: string[];
  sort_order?: number;
}

interface RawHadith {
  id: string;
  collection: HadithCollection;
  text: string;
  narrator?: string | null;
  chapter?: string | null;
  number?: number | null;
  volume?: number | null;
  page?: number | null;
  tags?: string[];
}

const scholars = rawScholars as Scholar[];
const sources = rawSources as Source[];

const scholarBySlug = new Map(scholars.map((s) => [s.slug, s.id]));
const sourceBySlug = new Map(sources.map((s) => [s.slug, s.id]));

/** المصدر الافتراضي المدمج: موقع تراث. */
export const DEFAULT_SOURCE_SLUG = 'turath';
const defaultSourceId = sourceBySlug.get(DEFAULT_SOURCE_SLUG) as string;

/** التطبيق يقتصر على أحاديث فضائل الأعمال. */
export const HADITH_TOPIC = 'فضائل الأعمال';

const quotes: Quote[] = (rawQuotes as RawQuote[])
  .filter((q) => scholarBySlug.has(q.scholar_slug))
  .map((q) => ({
    kind: 'quote',
    genre: q.genre ?? 'saying',
    id: q.id,
    scholar_id: scholarBySlug.get(q.scholar_slug) as string,
    source_id: sourceBySlug.get(q.source_slug) ?? defaultSourceId,
    text: q.text,
    book: q.book,
    volume: q.volume ?? null,
    page: q.page ?? null,
    source_url: q.source_url ?? null,
    tags: q.tags ?? [],
    needs_reference_check: q.page == null,
  }));

const hadiths: Hadith[] = (rawHadiths as RawHadith[])
  // حارس إضافي: لا يُقبل إلا ما كان من الصحيحين.
  .filter((h) => h.collection === 'bukhari' || h.collection === 'muslim')
  .map((h) => ({
    kind: 'hadith',
    id: h.id,
    collection: h.collection,
    text: h.text,
    narrator: h.narrator ?? null,
    chapter: h.chapter ?? null,
    number: h.number ?? null,
    book: h.collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم',
    volume: h.volume ?? null,
    page: h.page ?? null,
    source_id: defaultSourceId,
    source_url: null,
    topic: HADITH_TOPIC,
    tags: h.tags ?? [],
    needs_reference_check: h.page == null,
  }));

const duas: Dua[] = (rawDuas as RawDua[])
  // حارس: دعاءٌ بلا كتابٍ يُحال إليه لا مرجع له، فلا يُعرض.
  .filter((d) => typeof d.collection === 'string' && d.collection.trim() !== '')
  .map((d, index) => ({
    kind: 'dua',
    id: d.id,
    text: d.text,
    narrator: d.narrator ?? null,
    collection: d.collection,
    number: d.number ?? null,
    // سطر المرجع يقرأ `book`، ومرجع الدعاء كتابُه.
    book: d.collection,
    volume: d.volume ?? null,
    page: d.page ?? null,
    source_id: defaultSourceId,
    source_url: d.source_url ?? null,
    tags: d.tags ?? [],
    needs_reference_check: d.number == null && d.page == null,
    sort_order: d.sort_order ?? index + 1,
  }));

/** المحتوى المدمج داخل التطبيق — يعمل بلا إنترنت ولا خادم. */
export const SEED_CONTENT: ContentBundle = {
  scholars,
  sources,
  quotes,
  hadiths,
  duas,
  syncedAt: null,
};
