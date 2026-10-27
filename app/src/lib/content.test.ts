import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentBundle, Hadith, Quote, Scholar, Source } from '../data/types';
import { allItems, availablePools, indexContent } from './content';

const scholar = (id: string, is_active = true): Scholar => ({
  id,
  slug: id,
  name: id,
  full_name: null,
  era: null,
  death_year_hijri: null,
  bio: null,
  is_active,
  sort_order: 1,
});

const source: Source = {
  id: 'src',
  slug: 'turath',
  name: 'موقع تراث',
  kind: 'turath',
  base_url: null,
  note: null,
  is_builtin: true,
  is_default: true,
  is_active: true,
  sort_order: 1,
};

const quote = (id: string, scholar_id: string, page: number | null): Quote => ({
  kind: 'quote',
  genre: 'saying',
  id,
  scholar_id,
  source_id: source.id,
  text: 'نصّ المقولة',
  book: 'الفوائد',
  volume: 1,
  page,
  source_url: null,
  tags: [],
  needs_reference_check: page == null,
});

const hadith = (id: string, page: number | null): Hadith => ({
  kind: 'hadith',
  id,
  collection: 'bukhari',
  text: 'متن الحديث',
  narrator: null,
  chapter: null,
  number: null,
  book: 'صحيح البخاري',
  volume: 1,
  page,
  source_id: source.id,
  source_url: null,
  topic: 'فضائل الأعمال',
  tags: [],
  needs_reference_check: page == null,
});

const bundle: ContentBundle = {
  scholars: [scholar('s1'), scholar('s2'), scholar('s3', false)],
  sources: [source],
  quotes: [quote('q1', 's1', 10), quote('q2', 's2', 20), quote('q3', 's1', null), quote('q4', 's3', 30)],
  hadiths: [hadith('h1', 5), hadith('h2', null)],
  duas: [],
  syncedAt: null,
};

test('ناقص المرجع لا يُرسَل', () => {
  const pools = availablePools(bundle, []);
  assert.ok(!pools.quote.includes('q3'), 'أُرسلت مقولة بلا صفحة');
  assert.ok(!pools.hadith.includes('h2'), 'أُرسل حديث بلا صفحة');
  assert.deepEqual(pools.hadith, ['h1']);
});

test('عالمٌ غير مفعّل لا تُرسَل مقولاته', () => {
  const pools = availablePools(bundle, []);
  assert.ok(!pools.quote.includes('q4'));
  assert.deepEqual(pools.quote, ['q1', 'q2']);
});

test('متابعة عالمٍ تقصُر المقولات عليه', () => {
  assert.deepEqual(availablePools(bundle, ['s2']).quote, ['q2']);
});

test('متابعة عالمٍ غير مفعّل تُهمَل فتبقى المقولات كلّها', () => {
  assert.deepEqual(availablePools(bundle, ['s3']).quote, ['q1', 'q2']);
});

test('الأحاديث لا تتأثّر بمتابعة العلماء', () => {
  assert.deepEqual(availablePools(bundle, ['s1']).hadith, ['h1']);
});

test('الفهرسة تضمّ النوعين وتردّ العالم والمصدر', () => {
  assert.equal(allItems(bundle).length, bundle.quotes.length + bundle.hadiths.length);
  const { itemsById, scholarsById, sourcesById } = indexContent(bundle);
  assert.equal(itemsById.get('q1')?.kind, 'quote');
  assert.equal(itemsById.get('h1')?.kind, 'hadith');
  assert.equal(scholarsById.get('s1')?.name, 's1');
  assert.equal(sourcesById.get('src')?.slug, 'turath');
});
