#!/usr/bin/env node
/**
 * يتحقّق من سلامة المحتوى المدمج قبل البناء أو النشر.
 *
 *   node tools/validate-content.mjs            # الأخطاء تُفشل، نقص المراجع تنبيه
 *   node tools/validate-content.mjs --strict   # نقص المجلد/الصفحة يُفشل أيضاً
 *
 * الوضع الصارم هو بوّابة النشر العام: لا يُنشر نصّ بلا مرجع كامل.
 * تستدعيه أداة الاستيراد من «تراث» بعد كل تعبئة للتحقق من النتيجة.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fingerprint } from './lib/turath.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = join(root, 'app/src/data/seed');
const strict = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const read = (file) => {
  try {
    const parsed = JSON.parse(readFileSync(join(seedDir, file), 'utf8'));
    if (!Array.isArray(parsed)) {
      err(`${file}: الملف ليس مصفوفة.`);
      return [];
    }
    return parsed;
  } catch (e) {
    err(`${file}: تعذّرت قراءته — ${e.message}`);
    return [];
  }
};

const scholars = read('scholars.json');
const sources = read('sources.json');
const quotes = read('quotes.json');
const hadiths = read('hadiths.json');
const duas = read('duas.json');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** المعرّفات فريدة عبر كل الملفات، لأنها تُدمج في جدول واحد عند المزامنة. */
const seenIds = new Map();
const checkId = (file, item, index) => {
  const where = `${file}[${index}]`;
  if (typeof item.id !== 'string' || !UUID.test(item.id)) {
    err(`${where}: معرّف غير صالح (${item.id ?? 'مفقود'}).`);
    return;
  }
  if (seenIds.has(item.id)) {
    err(`${where}: معرّف مكرّر مع ${seenIds.get(item.id)}.`);
    return;
  }
  seenIds.set(item.id, where);
};

/** نصّ عربي غير فارغ، ولا يحمل مسافات زائدة تظهر في الإشعار. */
const checkText = (where, value, field = 'text') => {
  if (typeof value !== 'string' || value.trim() === '') {
    err(`${where}: ${field} فارغ.`);
    return;
  }
  if (value !== value.trim()) err(`${where}: ${field} يبدأ أو ينتهي بمسافة.`);
  if (/\s{2,}/.test(value)) warn(`${where}: ${field} فيه مسافات متتالية.`);
};

/** المجلد والصفحة: أعداد صحيحة موجبة أو null — ولا شيء بينهما. */
const checkRef = (where, item) => {
  for (const field of ['volume', 'page']) {
    const v = item[field];
    if (v == null) continue;
    if (!Number.isInteger(v) || v <= 0) err(`${where}: ${field} = ${v} ليس عدداً صحيحاً موجباً.`);
  }
  if (item.volume != null && item.page == null) {
    warn(`${where}: المجلد مُدخل بلا صفحة.`);
  }
  // التطبيق و seed.sql يحسبان هذه الراية من page == null، فالقيمة المخزّنة
  // إن خالفت فهي مُضلّلة لمن يقرأ الملف.
  const expected = item.page == null;
  if ('needs_reference_check' in item && item.needs_reference_check !== expected) {
    warn(
      `${where}: needs_reference_check = ${item.needs_reference_check} ` +
        `والمتوقّع ${expected} (تُحسب من وجود الصفحة).`,
    );
  }
};

const scholarSlugs = new Set();
scholars.forEach((s, i) => {
  const where = `scholars.json[${i}]`;
  checkId('scholars.json', s, i);
  checkText(where, s.name, 'name');
  if (typeof s.slug !== 'string' || s.slug === '') err(`${where}: slug مفقود.`);
  else if (scholarSlugs.has(s.slug)) err(`${where}: slug مكرّر (${s.slug}).`);
  else scholarSlugs.add(s.slug);
});

const sourceSlugs = new Set();
let builtinDefaults = 0;
sources.forEach((s, i) => {
  const where = `sources.json[${i}]`;
  checkId('sources.json', s, i);
  checkText(where, s.name, 'name');
  if (typeof s.slug !== 'string' || s.slug === '') err(`${where}: slug مفقود.`);
  else if (sourceSlugs.has(s.slug)) err(`${where}: slug مكرّر (${s.slug}).`);
  else sourceSlugs.add(s.slug);
  if (s.kind !== 'turath' && s.kind !== 'external') err(`${where}: kind غير معروف (${s.kind}).`);
  if (s.is_default) builtinDefaults += 1;
});

// قاعدة البيانات تفرضها بفهرس فريد جزئي؛ نكشفها هنا قبل أن يرفضها الخادم.
if (sources.length > 0 && builtinDefaults !== 1) {
  err(`sources.json: يجب أن يكون مصدر افتراضي واحد بالضبط، والموجود ${builtinDefaults}.`);
}
if (sources.length > 0 && !sourceSlugs.has('turath')) {
  err('sources.json: المصدر المدمج «turath» مفقود.');
}

let missingRefs = 0;

quotes.forEach((q, i) => {
  const where = `quotes.json[${i}]`;
  checkId('quotes.json', q, i);
  checkText(where, q.text);
  checkText(where, q.book, 'book');
  checkRef(where, q);
  if (!scholarSlugs.has(q.scholar_slug)) {
    // seed.ts يُسقط المقولة كلها في هذه الحالة، فتختفي بلا أثر.
    err(`${where}: scholar_slug = "${q.scholar_slug}" لا يقابل عالماً، والمقولة ستُحذف عند التحميل.`);
  }
  if (q.source_slug != null && !sourceSlugs.has(q.source_slug)) {
    err(`${where}: source_slug = "${q.source_slug}" لا يقابل مصدراً.`);
  }
  if (q.tags != null && !Array.isArray(q.tags)) err(`${where}: tags ليست مصفوفة.`);
  // النوع الفرعي يُحدّ بقيمتين، لأن المخطَّط يحدّه بهما — وقيمةٌ ثالثة تُردّ في
  // قاعدة البيانات لا في الواجهة، فتكسر النشر.
  if (q.genre != null && q.genre !== 'saying' && q.genre !== 'biography') {
    err(`${where}: genre = "${q.genre}" ليس 'saying' ولا 'biography'.`);
  }
  // خبر الصالح محدودٌ بخمسين كلمة بطلب صاحب المشروع.
  if (q.genre === 'biography' && String(q.text).split(/s+/).filter(Boolean).length > 50) {
    err(`${where}: خبرُ صالحٍ يتجاوز خمسين كلمة.`);
  }
  if (q.page == null) missingRefs += 1;
});

const COLLECTIONS = new Set(['bukhari', 'muslim']);
const hadithNumbers = new Map();

hadiths.forEach((h, i) => {
  const where = `hadiths.json[${i}]`;
  checkId('hadiths.json', h, i);
  checkText(where, h.text);
  checkRef(where, h);
  if (!COLLECTIONS.has(h.collection)) {
    // قيد في schema.sql أيضاً: التطبيق مقصور على الصحيحين.
    err(`${where}: collection = "${h.collection}" من غير الصحيحين.`);
  }
  if (h.number != null) {
    if (!Number.isInteger(h.number) || h.number <= 0) {
      err(`${where}: number = ${h.number} ليس رقم حديث صالحاً.`);
    } else {
      const key = `${h.collection}#${h.number}`;
      if (hadithNumbers.has(key)) {
        // ‎hadiths_collection_number‎ فهرس فريد في schema.sql، فالتكرار يُفشل seed.sql.
        err(`${where}: رقم الحديث ${key} مكرّر مع ${hadithNumbers.get(key)}.`);
      } else {
        hadithNumbers.set(key, where);
      }
    }
  }
  if (h.tags != null && !Array.isArray(h.tags)) err(`${where}: tags ليست مصفوفة.`);
  if (h.page == null) missingRefs += 1;
});

// الأدعية: مرجعها الكتاب ورقم الحديث (أو موضعه) لا المجلد والصفحة، فمصادرها كتب
// حديثٍ تُرقَّم أحاديثها. وترتيبها مقصود: يُعرض به وتُعاد من أوّله.
const duaOrders = new Map();
const duaNumbers = new Map();
duas.forEach((d, i) => {
  const where = `duas.json[${i}]`;
  checkId('duas.json', d, i);
  checkText(where, d.text);
  checkText(where, d.collection, 'collection');
  checkRef(where, d);
  if (d.number != null && (!Number.isInteger(d.number) || d.number <= 0)) {
    err(`${where}: number = ${d.number} ليس رقم حديث صالحاً.`);
  }
  if (d.number == null && d.page == null) {
    // البوّابة نفسها في schema.sql و content.ts و feed.ts.
    err(`${where}: دعاءٌ بلا مرجع — يلزمه رقم حديثٍ أو موضعٌ في الكتاب.`);
  }
  if (d.number != null) {
    const key = `${d.collection}#${d.number}`;
    if (duaNumbers.has(key)) err(`${where}: ${key} مكرّر مع ${duaNumbers.get(key)}.`);
    else duaNumbers.set(key, where);
  }
  if (!Number.isInteger(d.sort_order) || d.sort_order <= 0) {
    err(`${where}: sort_order غير صالح — وترتيب الأدعية مقصود.`);
  } else if (duaOrders.has(d.sort_order)) {
    err(`${where}: sort_order = ${d.sort_order} مكرّر مع ${duaOrders.get(d.sort_order)}.`);
  } else {
    duaOrders.set(d.sort_order, where);
  }
  if (d.tags != null && !Array.isArray(d.tags)) err(`${where}: tags ليست مصفوفة.`);
});

// نصّان بمعنى واحد: الحديث يُروى في موضعين برقمين وبفرق كلمةٍ في آخره، والمقولة
// تُنقل عن طبعتين. بصمة النص كلّه لا تكشفهما، فيصل المستخدم نصّان متشابهان.
const openings = new Map();
for (const [file, items] of [['quotes.json', quotes], ['hadiths.json', hadiths], ['duas.json', duas]]) {
  items.forEach((item, i) => {
    if (typeof item.text !== 'string' || item.text.trim() === '') return;
    const head = fingerprint(item.text).split(' ').slice(0, 10).join(' ');
    if (head === '') return;
    const where = `${file}[${i}]`;
    if (openings.has(head)) {
      warn(`${where}: مطلعه يطابق ${openings.get(head)} — نصّان متشابهان يصلان المستخدم.`);
    } else {
      openings.set(head, where);
    }
  });
}

const total = quotes.length + hadiths.length;
if (missingRefs > 0) {
  const msg =
    `${missingRefs} من ${total} عنصراً بلا مجلد/صفحة — ` +
    'تُوثَّق من «تراث» قبل النشر العام (tools/turath-import.mjs).';
  if (strict) err(msg);
  else warn(msg);
}

for (const w of warnings) console.warn(`تنبيه: ${w}`);
for (const e of errors) console.error(`خطأ: ${e}`);

console.log(
  `المحتوى: ${sources.length} مصدر، ${scholars.length} عالم، ` +
    `${quotes.length} مقولة، ${hadiths.length} حديثاً، ${duas.length} دعاءً — ` +
    `${errors.length} خطأ، ${warnings.length} تنبيهاً.`,
);

process.exit(errors.length > 0 ? 1 : 0);
