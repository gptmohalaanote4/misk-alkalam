#!/usr/bin/env node
/**
 * يولّد `public/content.json` — ملف المحتوى الذي يسحبه التطبيق ليُجدِّد نفسه.
 *
 *   node tools/gen-content-json.mjs
 *
 * يُنشر هذا الملف على GitHub Pages (استضافة ثابتة مجانية)، فيسحبه التطبيق عند
 * فتحه ويُحدِّث محتواه بلا خادم ولا اشتراك. وهو **نفس** شكل الحزمة التي يبنيها
 * `app/src/data/seed.ts`، فالتطبيق يستعملها كما يستعمل المحتوى المدمج.
 *
 * مولَّد آلياً من البذرة — لا يُحرَّر يدوياً.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSeed, root } from './lib/seed.mjs';

const HADITH_TOPIC = 'فضائل الأعمال';
const COLLECTION_NAMES = { bukhari: 'صحيح البخاري', muslim: 'صحيح مسلم' };

const scholars = readSeed('scholars.json');
const sources = readSeed('sources.json');
const rawQuotes = readSeed('quotes.json');
const rawHadiths = readSeed('hadiths.json');
const rawDuas = readSeed('duas.json');

const scholarBySlug = new Map(scholars.map((s) => [s.slug, s.id]));
const sourceBySlug = new Map(sources.map((s) => [s.slug, s.id]));
const defaultSource = sources.find((s) => s.is_default) ?? sources[0];

// نفس حُرّاس `seed.ts`: ما لا يقابل عالماً يُسقط، والأحاديث من الصحيحين حصراً.
const quotes = rawQuotes
  .filter((q) => scholarBySlug.has(q.scholar_slug))
  .map((q) => ({
    kind: 'quote',
    genre: q.genre === 'biography' ? 'biography' : 'saying',
    id: q.id,
    scholar_id: scholarBySlug.get(q.scholar_slug),
    source_id: sourceBySlug.get(q.source_slug) ?? defaultSource.id,
    text: q.text,
    book: q.book,
    volume: q.volume ?? null,
    page: q.page ?? null,
    source_url: q.source_url ?? null,
    tags: q.tags ?? [],
    needs_reference_check: q.page == null,
  }));

const hadiths = rawHadiths
  .filter((h) => h.collection === 'bukhari' || h.collection === 'muslim')
  .map((h) => ({
    kind: 'hadith',
    id: h.id,
    collection: h.collection,
    text: h.text,
    narrator: h.narrator ?? null,
    chapter: h.chapter ?? null,
    number: h.number ?? null,
    book: COLLECTION_NAMES[h.collection],
    volume: h.volume ?? null,
    page: h.page ?? null,
    source_id: defaultSource.id,
    source_url: h.source_url ?? null,
    topic: h.topic ?? HADITH_TOPIC,
    tags: h.tags ?? [],
    needs_reference_check: h.page == null,
  }));

// مرجع الدعاء كتابُه ورقمُه (أو موضعه)، لا المجلد والصفحة — فمصادره كتب حديث.
const duas = rawDuas
  .filter((d) => typeof d.collection === 'string' && d.collection.trim() !== '')
  .map((d, index) => ({
    kind: 'dua',
    id: d.id,
    text: d.text,
    narrator: d.narrator ?? null,
    collection: d.collection,
    number: d.number ?? null,
    book: d.collection,
    volume: d.volume ?? null,
    page: d.page ?? null,
    source_id: defaultSource.id,
    source_url: d.source_url ?? null,
    tags: d.tags ?? [],
    needs_reference_check: d.number == null && d.page == null,
    sort_order: d.sort_order ?? index + 1,
  }));

// النشر لا يحمل ناقص المرجع: التطبيق المدمج يُظهره للأدمن، والعام لا يراه.
const publishable = (item) => item.page != null;
const bundle = {
  // رقم الصيغة: يرفضه التطبيق إن تغيّر شكل الحزمة في إصدار لاحق.
  version: 1,
  generatedAt: new Date().toISOString(),
  scholars,
  sources,
  quotes: quotes.filter(publishable),
  hadiths: hadiths.filter(publishable),
  duas: duas.filter((d) => d.number != null || d.page != null),
};

const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'content.json'), `${JSON.stringify(bundle)}\n`, 'utf8');

const dropped =
  quotes.length - bundle.quotes.length +
  (hadiths.length - bundle.hadiths.length) +
  (duas.length - bundle.duas.length);
console.log(
  `content.json: ${bundle.scholars.length} عالم، ${bundle.sources.length} مصدر، ` +
    `${bundle.quotes.length} مقولة، ${bundle.hadiths.length} حديثاً، ${bundle.duas.length} دعاءً` +
    (dropped > 0 ? ` — واستُثني ${dropped} عنصراً بلا مرجع كامل.` : '.'),
);
