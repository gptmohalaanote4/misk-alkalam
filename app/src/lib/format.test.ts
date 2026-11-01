import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContentItem, Hadith, Quote, Scholar } from '../data/types';
import { attributionName, attributionSub, kindLabel, referenceLine, shareText } from './format';

const scholars = new Map<string, Scholar>([
  [
    's1',
    {
      id: 's1',
      slug: 'ibn-al-qayyim',
      name: 'ابن القيم',
      full_name: null,
      era: null,
      death_year_hijri: 751,
      bio: null,
      is_active: true,
      sort_order: 1,
    },
  ],
]);

const quote: Quote = {
  kind: 'quote',
  genre: 'saying',
  id: 'q1',
  scholar_id: 's1',
  source_id: 'src',
  text: 'من عرف نفسه اشتغل بإصلاحها عن عيوب الناس.',
  book: 'الفوائد',
  volume: 1,
  page: 80,
  source_url: null,
  tags: [],
  needs_reference_check: false,
};

const hadith: Hadith = {
  kind: 'hadith',
  id: 'h1',
  collection: 'bukhari',
  text: 'إنما الأعمال بالنيات.',
  narrator: 'عمر بن الخطاب رضي الله عنه',
  chapter: 'كتاب بدء الوحي',
  number: 1,
  book: 'صحيح البخاري',
  volume: 1,
  page: 6,
  source_id: 'src',
  source_url: null,
  topic: 'فضائل الأعمال',
  tags: [],
  needs_reference_check: false,
};

test('سطر المرجع للمقولة: الكتاب ثم الجزء ثم الصفحة', () => {
  assert.equal(referenceLine(quote), 'الفوائد · ج1 · ص80');
});

test('سطر المرجع للحديث: الصحيح ثم الكتاب ثم رقم الحديث ثم الموضع', () => {
  assert.equal(referenceLine(hadith), 'صحيح البخاري · كتاب بدء الوحي · حديث 1 · ج1 · ص6');
});

test('سطر المرجع يحذف ما لم يتوفّر بلا فواصل زائدة', () => {
  assert.equal(referenceLine({ ...quote, volume: null }), 'الفوائد · ص80');
  assert.equal(referenceLine({ ...quote, volume: null, page: null }), 'الفوائد');
  assert.equal(
    referenceLine({ ...hadith, chapter: null, number: null, volume: null }),
    'صحيح البخاري · ص6',
  );
});

test('النسبة: اسم العالم للمقولة، والنبي ﷺ للحديث', () => {
  assert.equal(attributionName(quote, scholars), 'ابن القيم');
  assert.equal(attributionName(hadith, scholars), 'قال رسول الله ﷺ');
  // عالمٌ غير موجود في الفهرس لا يُسقط العرض.
  assert.equal(attributionName({ ...quote, scholar_id: 'ghost' }, scholars), 'عالم');
});

test('الراوي يظهر في الحديث وحده', () => {
  assert.equal(attributionSub(hadith), 'عن عمر بن الخطاب رضي الله عنه');
  assert.equal(attributionSub({ ...hadith, narrator: null }), null);
  assert.equal(attributionSub(quote), null);
});

test('عنوان النوع', () => {
  assert.equal(kindLabel(quote), 'مقولة اليوم');
  assert.equal(kindLabel(hadith), 'حديث اليوم');
});

test('نص المشاركة يحمل النص والنسبة والمرجع', () => {
  const text = shareText(hadith, scholars);
  assert.ok(text.includes(hadith.text));
  assert.ok(text.includes('قال رسول الله ﷺ — عن عمر بن الخطاب رضي الله عنه'));
  assert.ok(text.includes(referenceLine(hadith)));
});

test('المقولة بلا قائلٍ معلوم: لا يُفتعل لها اسم', () => {
  // قرارُ صاحب المشروع: «المقولة التي لا تعرف قائلها حطها بدون قائل وضع اسم
  // الكتاب والصفحة». فالسطرُ الأعلى يُترك، والمرجعُ تحته يحمل الكتاب والصفحة.
  const item = {
    kind: 'quote',
    genre: 'anthology',
    id: 'x',
    scholar_id: null,
    source_id: 's',
    text: 'الدنيا عند القوم: ما سوى الله من المال والجاه.',
    book: 'قيمة الزمن عند العلماء',
    volume: null,
    page: 240,
    source_url: null,
    tags: [],
    needs_reference_check: false,
  } as unknown as ContentItem;
  assert.equal(attributionName(item, new Map()), '');
  assert.match(referenceLine(item), /قيمة الزمن عند العلماء/);
  assert.match(referenceLine(item), /ص240/);
});
