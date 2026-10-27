/**
 * تحديد موضع النص في «تراث» **بصفحات الكتاب وحدها**، بلا محرّك البحث.
 *
 * محرّك البحث في «تراث» يحدّ الطلبات بإرجاع نتائج فارغة، فيصير وجود النص من
 * عدمه تابعاً لحالة الخادم لا لحقيقة الكتاب. وجلبُ الصفحات لا يُحدّ بالقدر
 * نفسه، فهذه الطريقة **قاطعة ومُعادة**: تعطي النتيجة نفسها في كل تشغيل.
 *
 *   الأحاديث — بحثٌ ثنائي على رقم الحديث، فالأرقام متصاعدة مع الصفحات.
 *   المقولات — مسحٌ متتابع لصفحات الكتاب، يقف عند تطابقٍ قاطع.
 */
import { fetchPage, positiveInt } from './turath.mjs';
import { adoptFromPage, locateSpan, pageBody, tokenize } from './adopt.mjs';

const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const toLatinDigits = (text) => String(text).replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d]);

/**
 * أرقام الأحاديث الظاهرة في الصفحة.
 * البخاري يصدّر الحديث برقمه: «٧٩٦ - حدثنا». ومسلم يُصدّره بتسلسله داخل الكتاب
 * ثم رقمِه المعتمد بين قوسين: «١٢٧ - (١٩١٤) حدثنا» — والمعتمد هو ما في البذرة.
 */
export function hadithNumbersOn(pageText, collection) {
  const text = String(pageText);
  const pattern = collection === 'muslim' ? /\(([٠-٩]+)\)/g : /(^|\n)\s*([٠-٩]+)\s*-\s/g;
  const out = [];
  for (const match of text.matchAll(pattern)) {
    const digits = collection === 'muslim' ? match[1] : match[2];
    const value = positiveInt(toLatinDigits(digits));
    if (value) out.push(value);
  }
  return out;
}

/** آخر صفحة داخلية في الكتاب — تُعرف بالمضاعفة ثم التنصيف. */
export async function bookSize(bookId, limit = 20000, budget = null) {
  const spend = () => { if (budget) budget.left -= 1; };
  let known = 0;
  let probe = 64;
  while (probe <= limit && (spend(), await fetchPage(bookId, probe, { expectEmpty: true }))) {
    known = probe;
    probe *= 2;
  }
  let low = known;
  let high = Math.min(probe, limit);
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    spend();
    if (await fetchPage(bookId, mid, { expectEmpty: true })) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * يجد صفحة حديثٍ برقمه ببحثٍ ثنائي.
 * الصفحات التي لا رقم فيها (عنوانُ باب، أو تتمّةُ متن) تُتخطّى إلى الأمام.
 */
export async function findHadithPage(bookId, collection, number, size) {
  let low = 1;
  let high = size;
  let fallback = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    // أقرب صفحةٍ فيها رقم، بحثاً إلى الأمام — ولا نتجاوز الحدّ الأعلى.
    let probe = mid;
    let page = null;
    let numbers = [];
    while (probe <= high) {
      page = await fetchPage(bookId, probe);
      if (!page) break;
      numbers = hadithNumbersOn(page.text, collection);
      if (numbers.length > 0) break;
      probe += 1;
    }

    if (!page || numbers.length === 0) {
      // لا أرقام في هذا الشطر كلّه: نبحث في الشطر الأدنى.
      high = mid - 1;
      continue;
    }

    if (numbers.includes(number)) return { pageId: probe, page };
    if (Math.min(...numbers) > number) {
      high = mid - 1;
    } else {
      // الرقم المطلوب بعد هذه الصفحة؛ نحفظها كأقرب ما دونه.
      if (Math.max(...numbers) < number) fallback = { pageId: probe, page };
      low = probe + 1;
    }
  }

  // الرقم قد يقع في صفحةٍ بلا رقمٍ ظاهر بعد أقرب صفحةٍ دونه.
  if (fallback) {
    for (let offset = 1; offset <= 6; offset++) {
      const page = await fetchPage(bookId, fallback.pageId + offset);
      if (!page) break;
      if (hadithNumbersOn(page.text, collection).includes(number)) {
        return { pageId: fallback.pageId + offset, page };
      }
    }
  }
  return null;
}

/** تطابقٌ قاطع: سلسلةٌ تغطّي أكثر النص، وتغطيةٌ شبه تامة. */
const isDecisive = (span, words) => span && span.anchor >= words * 0.8 && span.coverage >= 0.95;

/**
 * يمسح صفحات الكتاب بحثاً عن نصوصٍ عدّة في مرّة واحدة.
 * يُبقي أفضل موضعٍ لكل نص، ويقف عن النص متى بلغ تطابقه حدّ القطع.
 *
 * `onPage` تُستدعى بعد كل صفحة ليُطبع التقدّم.
 */
export async function scanBookFor(bookId, items, { size, onPage, adoptOptions = {}, budget } = {}) {
  const pending = items.map((item) => ({ item, best: null, done: false }));
  const limit = size ?? (await bookSize(bookId));

  for (let pageId = 1; pageId <= limit; pageId++) {
    if (pending.every((p) => p.done)) break;
    // السقف يوقف المسح وقفةً نظيفة، فيُكتب ما وُجد ولا يضيع عملُ ما مضى.
    if (budget && budget.left <= 0) {
      for (const entry of pending) entry.stoppedShort = !entry.best;
      break;
    }
    const page = await fetchPage(bookId, pageId);
    if (budget) budget.left -= 1;
    if (onPage) onPage(pageId, limit, pending.filter((p) => !p.done).length);
    if (!page) continue;

    const printedPage = positiveInt(page.meta.page);
    if (!printedPage) continue;
    const tokens = tokenize(pageBody(page.text));

    for (const entry of pending) {
      if (entry.done) continue;
      const span = locateSpan(entry.item.text, tokens);
      if (!span) continue;
      if (entry.best && span.anchor <= entry.best.span.anchor) continue;

      const adopted = adoptFromPage(page.text, entry.item.text, adoptOptions);
      if (!adopted) {
        // وُجد الموضع وتعذّر حدّه المطبوع — وهذا غير «لم يظهر النص في الكتاب».
        // الخلط بينهما يُوهم أن النصّ ليس في الكتاب وهو فيه.
        if (!entry.nearMiss || span.anchor > entry.nearMiss.span.anchor) {
          entry.nearMiss = { span, pageId, meta: page.meta };
        }
        continue;
      }
      entry.best = { span, adopted, pageId, meta: page.meta };
      if (isDecisive(span, span.words)) entry.done = true;
    }
  }

  return pending;
}
