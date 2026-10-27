#!/usr/bin/env node
/**
 * يولّد supabase/seed.sql من نفس ملفات البذرة المدمجة في التطبيق،
 * حتى يبقى محتوى الخادم مطابقاً لما يُشحن داخل التطبيق.
 *
 *   node tools/gen-seed-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = join(root, 'app/src/data/seed');
const read = (f) => JSON.parse(readFileSync(join(seedDir, f), 'utf8'));

const scholars = read('scholars.json');
const sources = read('sources.json');
const quotes = read('quotes.json');
const hadiths = read('hadiths.json');
const duas = read('duas.json');

/** اقتباس آمن لقيمة نصية في SQL. */
const s = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? 'null' : Number(v));
const b = (v) => (v ? 'true' : 'false');
const arr = (v) =>
  !v || v.length === 0 ? "'{}'" : `array[${v.map((x) => s(x)).join(', ')}]::text[]`;

const scholarId = new Map(scholars.map((x) => [x.slug, x.id]));
const sourceId = new Map(sources.map((x) => [x.slug, x.id]));
const defaultSource = sources.find((x) => x.is_default) ?? sources[0];

const lines = [];
lines.push('-- مولّد آلياً: node tools/gen-seed-sql.mjs — لا تعدّله يدوياً.');
lines.push('-- نفّذه بعد schema.sql. آمن للتكرار (on conflict do nothing).');
lines.push('');

lines.push('insert into public.sources (id, slug, name, kind, base_url, note, is_builtin, is_default, is_active, sort_order) values');
lines.push(
  sources
    .map(
      (x) =>
        `  (${s(x.id)}, ${s(x.slug)}, ${s(x.name)}, ${s(x.kind)}, ${s(x.base_url)}, ${s(x.note)}, ${b(x.is_builtin)}, ${b(x.is_default)}, ${b(x.is_active)}, ${n(x.sort_order)})`,
    )
    .join(',\n') + '\non conflict (id) do nothing;\n',
);

lines.push('insert into public.scholars (id, slug, name, full_name, era, death_year_hijri, bio, is_active, sort_order) values');
lines.push(
  scholars
    .map(
      (x) =>
        `  (${s(x.id)}, ${s(x.slug)}, ${s(x.name)}, ${s(x.full_name)}, ${s(x.era)}, ${n(x.death_year_hijri)}, ${s(x.bio)}, ${b(x.is_active)}, ${n(x.sort_order)})`,
    )
    .join(',\n') + '\non conflict (id) do nothing;\n',
);

lines.push(
  'insert into public.quotes (id, scholar_id, source_id, genre, text, book, volume, page, tags, needs_reference_check, status) values',
);
lines.push(
  quotes
    .map((x) => {
      const sch = scholarId.get(x.scholar_slug);
      const src = sourceId.get(x.source_slug) ?? defaultSource.id;
      const needsCheck = x.page == null;
      const genre = x.genre === 'biography' ? 'biography' : 'saying';
      return `  (${s(x.id)}, ${s(sch)}, ${s(src)}, ${s(genre)}, ${s(x.text)}, ${s(x.book)}, ${n(x.volume)}, ${n(x.page)}, ${arr(x.tags)}, ${b(needsCheck)}, 'published')`;
    })
    .join(',\n') + '\non conflict (id) do nothing;\n',
);

lines.push('insert into public.hadiths (id, collection, text, narrator, chapter, number, volume, page, source_id, topic, tags, needs_reference_check, status) values');
lines.push(
  hadiths
    .map((x) => {
      if (x.collection !== 'bukhari' && x.collection !== 'muslim') {
        throw new Error(`حديث من غير الصحيحين: ${x.id}`);
      }
      const needsCheck = x.page == null;
      return `  (${s(x.id)}, ${s(x.collection)}, ${s(x.text)}, ${s(x.narrator)}, ${s(x.chapter)}, ${n(x.number)}, ${n(x.volume)}, ${n(x.page)}, ${s(defaultSource.id)}, ${s('فضائل الأعمال')}, ${arr(x.tags)}, ${b(needsCheck)}, 'published')`;
    })
    .join(',\n') + '\non conflict (id) do nothing;\n',
);

lines.push(
  'insert into public.duas (id, text, narrator, collection, number, volume, page, source_id, source_url, tags, needs_reference_check, sort_order, status) values',
);
lines.push(
  duas
    .map((x, i) => {
      // مرجع الدعاء كتابُه ورقمُه أو موضعه — وقيدُ الجدول يرفض ما خلا منهما.
      const needsCheck = x.number == null && x.page == null;
      return `  (${s(x.id)}, ${s(x.text)}, ${s(x.narrator)}, ${s(x.collection)}, ${n(x.number)}, ${n(x.volume)}, ${n(x.page)}, ${s(defaultSource.id)}, ${s(x.source_url)}, ${arr(x.tags)}, ${b(needsCheck)}, ${n(x.sort_order ?? i + 1)}, 'published')`;
    })
    .join(',\n') + '\non conflict (id) do nothing;\n',
);

writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n'), 'utf8');
console.log(
  `seed.sql: ${sources.length} مصدر، ${scholars.length} عالم، ${quotes.length} مقولة، ${hadiths.length} حديثاً، ${duas.length} دعاءً`,
);
