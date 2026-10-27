import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchFeedContent } from './feed';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** الملف المنشور فعلاً، كما يولّده `tools/gen-content-json.mjs`. */
const published = JSON.parse(readFileSync(join(repoRoot, 'public/content.json'), 'utf8'));

/** يُبدّل `fetch` بردٍّ مُعطى، فيُختبَر مسار السحب كاملاً بلا شبكة. */
async function withFetch<T>(reply: () => unknown, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => reply()) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

test('الملف المنشور فعلاً يُقبل ويُقرأ كاملاً', async () => {
  const bundle = await withFetch(() => ok(published), fetchFeedContent);
  assert.ok(bundle, 'رُفض الملف الذي تولّده الأداة');
  assert.equal(bundle.quotes.length, published.quotes.length);
  assert.equal(bundle.hadiths.length, published.hadiths.length);
  assert.ok(bundle.syncedAt, 'لم يُسجَّل وقت المزامنة');
  // كل ما وصل صالحٌ للعرض: له مرجع، وللحديث صحيحٌ معروف.
  for (const quote of bundle.quotes) {
    assert.ok(quote.page != null && quote.book);
    assert.equal(quote.needs_reference_check, false);
  }
  for (const hadith of bundle.hadiths) {
    assert.ok(hadith.page != null);
    assert.ok(hadith.collection === 'bukhari' || hadith.collection === 'muslim');
    assert.equal(hadith.book, hadith.collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم');
  }
});

test('صيغةٌ غير مفهومة تُرفَض بلا استبدال ما على الجهاز', async () => {
  assert.equal(await withFetch(() => ok({ ...published, version: 99 }), fetchFeedContent), null);
  assert.equal(await withFetch(() => ok({ version: 1 }), fetchFeedContent), null);
  assert.equal(await withFetch(() => ok(null), fetchFeedContent), null);
  assert.equal(await withFetch(() => ok('نصّ لا حزمة'), fetchFeedContent), null);
});

test('حزمةٌ بلا نصوص ليست تحديثاً', async () => {
  const empty = { ...published, quotes: [], hadiths: [], duas: [] };
  assert.equal(await withFetch(() => ok(empty), fetchFeedContent), null);
});

test('الأدعية تُقرأ بمرجعها ومواضعها', async () => {
  const bundle = await withFetch(() => ok(published), fetchFeedContent);
  assert.ok(bundle);
  assert.equal(bundle.duas.length, published.duas.length);
  for (const dua of bundle.duas) {
    // مرجع الدعاء كتابُه ورقمُه أو موضعه.
    assert.ok(dua.collection.trim() !== '');
    assert.ok(dua.number != null || dua.page != null);
    assert.ok(dua.sort_order > 0, 'ترتيب الدعاء مقصود فلا يكون صفراً');
  }
  // الترتيب محفوظ كما نُشر.
  assert.deepEqual(
    bundle.duas.map((d) => d.sort_order),
    published.duas.map((d: { sort_order: number }) => d.sort_order),
  );
});

test('دعاءٌ بلا مرجع يُسقَط', async () => {
  const feed = { ...published, duas: [{ ...published.duas[0], number: null, page: null }] };
  const bundle = await withFetch(() => ok(feed), fetchFeedContent);
  assert.ok(bundle);
  assert.deepEqual(bundle.duas, []);
});

test('العنصر الناقص يُسقَط ويبقى الباقي', async () => {
  const feed = {
    ...published,
    quotes: [
      { ...published.quotes[0], page: null }, // بلا مرجع
      { ...published.quotes[0], id: 'q-ghost', scholar_id: 'لا-يوجد' }, // بلا عالم
      { ...published.quotes[0], id: 'q-ok' }, // سليم
    ],
    hadiths: [
      { ...published.hadiths[0], collection: 'tirmidhi' }, // من غير الصحيحين
      { ...published.hadiths[0], id: 'h-ok' },
    ],
  };
  const bundle = await withFetch(() => ok(feed), fetchFeedContent);
  assert.ok(bundle);
  assert.deepEqual(
    bundle.quotes.map((q) => q.id),
    ['q-ok'],
  );
  assert.deepEqual(
    bundle.hadiths.map((h) => h.id),
    ['h-ok'],
  );
});

test('تعذّر الشبكة أو ردٌّ فاشل يعيد null بلا رفع خطأ', async () => {
  assert.equal(await withFetch(() => ({ ok: false, json: async () => ({}) }), fetchFeedContent), null);
  assert.equal(
    await withFetch(() => {
      throw new Error('انقطاع');
    }, fetchFeedContent),
    null,
  );
});
