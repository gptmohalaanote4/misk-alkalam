#!/usr/bin/env node
/**
 * يعبّئ `volume` و`page` و`source_url` لنصوص البذرة القائمة من «تراث».
 * (لإضافة نصوص جديدة آلياً: `turath-harvest.mjs`.)
 *
 *   node tools/turath-import.mjs                 # يعبّئ الناقص ثم يكتب الملفات
 *   node tools/turath-import.mjs --dry-run       # يعرض ما سيكتبه بلا تعديل
 *   node tools/turath-import.mjs --only=quotes   # quotes أو hadiths
 *   node tools/turath-import.mjs --id=2222…001   # عنصر واحد بعينه
 *   node tools/turath-import.mjs --force         # يعيد توثيق المكتمل أيضاً
 *   node tools/turath-import.mjs --adopt         # يعتمد نصّ المطبوع حرفياً عند اختلافه
 *   node tools/turath-import.mjs --scan          # يحدّد المواضع بالصفحات لا بالبحث
 *   node tools/turath-import.mjs --budget=5000   # سقف صفحات المسح (افتراضي ٥٠٠٠)
 *   node tools/turath-import.mjs --probe "نص"    # يطبع الكتب التي يظهر فيها النص
 *
 * `--adopt`: نصوص البذرة الأولى كُتبت نقلاً، فجاء بعضها مختصَراً أو مجموعاً من
 * موضعين أو بلفظٍ يخالف الطبعة، فلا يصحّ أن يُذيَّل بمرجعٍ لا يوافقه. وفي هذا
 * الوضع يُؤخذ النصّ من الصفحة **حرفاً بحرف** بحدوده المطبوعة (`lib/adopt.mjs`):
 * لا كلمة تُزاد ولا تُحذف، وما تعذّر أخذه يبقى بلا مرجع ويُطبع ليُراجَع.
 *
 * قابل للتكرار ويُستأنف: يتخطّى كل عنصر له صفحة (إلا مع `--force`)، ويكتب بعد
 * كل عنصر، فانقطاع التشغيل لا يُهدر ما وُثّق.
 *
 * لا يخمّن: لا يقبل مرجعاً إلا إذا وُجدت سلسلة كلمات متّصلة من النص في الصفحة
 * وتغطية شبه تامة لبقيّة كلماته، ويطبع كل ما لم يجده ليُراجَع يدوياً.
 *
 * بعد الكتابة يشغّل `gen-seed-sql.mjs` ثم `validate-content.mjs --strict`.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  BOOKS,
  COLLECTION_BOOK,
  alignToPage,
  excerpt,
  fetchPage,
  pageUrl,
  plain,
  positiveInt,
  searchInBook,
  stats,
  tokenize,
} from './lib/turath.mjs';
import { adoptFromPage, locateSpan, pageBody, tokenize as tokenizeSpan } from './lib/adopt.mjs';
import { bookSize, findHadithPage, scanBookFor } from './lib/locate.mjs';
import { readSeed, root, writeSeed } from './lib/seed.mjs';

// ─────────────── الوسائط ───────────────
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const val = (flag) => {
  const hit = argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
};
const dryRun = has('--dry-run');
const force = has('--force');
const adopt = has('--adopt');
/** يحدّد المواضع بصفحات الكتب لا بمحرّك البحث: أبطأ، لكنه قاطعٌ ومُعاد. */
const scan = has('--scan');
/** سقف الصفحات المقروءة في جولة المسح. */
const scanBudget = positiveInt(val('--budget')) ?? 5000;
/**
 * حدّا قبول الموضع، ويُضبطان صراحةً لأن بعض نصوص البذرة تلخيصٌ في أوّله ونقلٌ
 * في آخره: تغطيتُه منخفضة وسلسلتُه طويلة. والسلسلة المتّصلة أقوى دليلاً على أن
 * هذه هي الفقرة، ثم `adoptFromPage` يأخذ المطبوع بحدّه فلا يُنقل التلخيص.
 */
const minAnchor = positiveInt(val('--anchor')) ?? 5;
const minCoverage = Number(val('--coverage') ?? 0.6);
const only = val('--only');
const onlyId = val('--id');
const probeIndex = argv.indexOf('--probe');
const probeText = probeIndex >= 0 ? argv[probeIndex + 1] : null;

// ─────────────── البحث عن موضع النص ───────────────
/** نوافذ البحث: نافذتان بطولين من ثلاثة مواضع — تكفيان بأقلّ عدد طلبات. */
function searchPhrases(text) {
  const { shown } = tokenize(text);
  const out = [];
  const push = (part) => {
    const phrase = part.join(' ');
    if (phrase.length >= 12 && !out.includes(phrase)) out.push(phrase);
  };
  for (const size of [9, 6]) {
    if (shown.length <= size) {
      push(shown);
      continue;
    }
    const mid = Math.floor((shown.length - size) / 2);
    push(shown.slice(0, size));
    push(shown.slice(mid, mid + size));
    push(shown.slice(-size));
  }
  return out;
}

/**
 * حدّ القبول: سلسلة متّصلة تُثبت الفقرة، وتغطية شبه تامة لكلمات النص.
 * وفي وضع الاعتماد تُخفَّض التغطية المطلوبة، لأن اختلاف النص عن المطبوع هو
 * سبب التشغيل أصلاً — والسلسلة تبقى هي الدليل على أن هذه هي الفقرة، ثم
 * `adoptFromPage` يتحقّق مرة أخرى قبل أن يأخذ شيئاً.
 */
const MIN_ANCHOR = 6;
const MIN_COVERAGE = 0.9;
const ADOPT_COVERAGE = 0.6;

async function locate(text, bookId) {
  const item = tokenize(text);
  const total = item.keys.length;
  const anchorNeed = Math.min(MIN_ANCHOR, total);
  const coverageNeed = adopt ? ADOPT_COVERAGE : MIN_COVERAGE;
  let best = null;

  for (const phrase of searchPhrases(text)) {
    for (const row of await searchInBook(phrase, bookId)) {
      const page = positiveInt(row.meta.page);
      if (!page) continue;
      const pageTokens = tokenize(row.text ?? '');
      const match = alignToPage(item, pageTokens);
      const better =
        !best ||
        match.anchor > best.anchor ||
        (match.anchor === best.anchor && match.coverage > best.coverage);
      if (better) {
        best = {
          anchor: match.anchor,
          coverage: match.coverage,
          page,
          volume: positiveInt(row.meta.vol),
          pageId: positiveInt(row.meta.page_id),
          printed: excerpt(pageTokens, match),
        };
      }
    }
    if (best && best.anchor >= total) break; // تطابق تام — لا داعي لنافذة أقصر
  }

  const ok = Boolean(best) && best.anchor >= anchorNeed && best.coverage >= coverageNeed;
  if (!ok) return { ok: false, best, anchorNeed, coverageNeed, total };
  return {
    ok: true,
    volume: best.volume,
    page: best.page,
    pageId: best.pageId,
    source_url: pageUrl(bookId, best.pageId),
    best,
    anchorNeed,
    coverageNeed,
    total,
  };
}

// ─────────────── التحديد بالصفحات (بلا محرّك البحث) ───────────────
/** يبني نتيجة تحديدٍ من صفحةٍ مقروءة، بمقاييس تطابقها مع نصّ البذرة. */
function resultFromPage(book, pageId, page, text) {
  const printedPage = positiveInt(page.meta.page);
  if (!printedPage) return null;
  const span = locateSpan(text, tokenizeSpan(pageBody(page.text)));
  if (!span) return null;
  return {
    ok: true,
    volume: positiveInt(page.meta.vol),
    page: printedPage,
    pageId,
    source_url: pageUrl(book.id, pageId),
    total: span.words,
    anchorNeed: Math.min(MIN_ANCHOR, span.words),
    best: {
      anchor: span.anchor,
      coverage: span.coverage,
      printed: plain(pageBody(page.text)).slice(0, 160),
    },
  };
}

/**
 * يحدّد مواضع كل العناصر بصفحات الكتب وحدها.
 * أبطأ من البحث، لكنه **قاطع ومُعاد**: لا يتعلّق بحالة محرّك البحث ولا بحدّه.
 */
async function locateAllByScan(pending) {
  const found = new Map();
  const byBook = new Map();
  // سقف صفحات الجولة: يقف المسح عنده وقفةً نظيفة فيُكتب ما وُجد، ولا يُهدر
  // عملُ ما مضى كما يحدث لو قُطع التشغيل. وما لم يُمسح يُطبع ليُستأنف لاحقاً.
  const budget = { left: scanBudget };
  const unscanned = [];
  for (const target of pending) {
    const book = BOOKS[target.bookName];
    if (!book) continue;
    if (!byBook.has(book.id)) byBook.set(book.id, { book, name: target.bookName, targets: [] });
    byBook.get(book.id).targets.push(target);
  }

  for (const { book, name, targets } of byBook.values()) {
    if (budget.left <= 0) {
      unscanned.push(`${name} (${targets.length})`);
      continue;
    }
    console.log(`\n⌁ مسح «${name}» — ${targets.length} عنصراً · بقي من السقف ${budget.left}`);
    const size = await bookSize(book.id, undefined, budget);
    console.log(`  الكتاب ${size} صفحة داخلية.`);

    // الأحاديث: بحثٌ ثنائي على الرقم — عشرات الطلبات بدل مسح الكتاب كلّه.
    const byNumber = targets.filter((t) => book.collection && t.item.number != null);
    for (const target of byNumber) {
      const hit = await findHadithPage(book.id, book.collection, target.item.number, size);
      if (!hit) {
        console.log(`  ✗ ${target.label}: لم يظهر رقم الحديث في الكتاب.`);
        continue;
      }
      const result = resultFromPage(book, hit.pageId, hit.page, target.item.text);
      if (!result) {
        console.log(`  ✗ ${target.label}: الصفحة ${hit.pageId} لا تطابق نصّ البذرة.`);
        continue;
      }
      found.set(target.item, result);
      console.log(`  ✓ ${target.label}: ج${result.volume ?? '؟'}/ص${result.page}`);
    }

    // المقولات: مسحٌ متتابع، ويقف عن النص متى بلغ تطابقه حدّ القطع.
    const byText = targets.filter((t) => !byNumber.includes(t));
    if (byText.length === 0) continue;
    let lastReport = 0;
    const scanned = await scanBookFor(
      book.id,
      byText.map((t) => t.item),
      {
        size,
        budget,
        adoptOptions: { minAnchor, minCoverage },
        onPage: (pageId, limit, left) => {
          if (pageId - lastReport < 50) return;
          lastReport = pageId;
          console.log(`    … ${pageId}/${limit} — بقي ${left}`);
        },
      },
    );
    for (const entry of scanned) {
      const target = byText.find((t) => t.item === entry.item);
      if (!entry.best) {
        if (entry.stoppedShort) {
          console.log(`  ⏸ ${target.label}: بلغ السقف قبل تمام المسح — يُستأنف.`);
        } else if (entry.nearMiss) {
          const { span, meta, pageId } = entry.nearMiss;
          console.log(
            `  ✗ ${target.label}: وُجد موضعه (ج${meta.vol}/ص${meta.page}، سلسلة ` +
              `${span.anchor}/${span.words} كلمة) وتعذّر حدّه المطبوع — ` +
              `النصّ ليس فقرةً مكتملة في الكتاب. الصفحة الداخلية ${pageId}.`,
          );
        } else {
          console.log(`  ✗ ${target.label}: لم يظهر النص في الكتاب أصلاً.`);
        }
        continue;
      }
      // المقاييس تُؤخذ من المسح نفسه، فنصّ الصفحة لا يُحتفظ به بعد مروره.
      const result = {
        ok: true,
        volume: positiveInt(entry.best.meta.vol),
        page: positiveInt(entry.best.meta.page),
        pageId: entry.best.pageId,
        source_url: pageUrl(book.id, entry.best.pageId),
        total: entry.best.span.words,
        anchorNeed: Math.min(MIN_ANCHOR, entry.best.span.words),
        best: {
          anchor: entry.best.span.anchor,
          coverage: entry.best.span.coverage,
          printed: entry.best.adopted.text,
        },
      };
      found.set(entry.item, result);
      console.log(`  ✓ ${target.label}: ج${result.volume ?? '؟'}/ص${result.page}`);
    }
  }
  if (unscanned.length > 0) {
    console.log(`
⏸ بلغ السقف (${scanBudget} صفحة) قبل هذه الكتب: ${unscanned.join('، ')}`);
    console.log(`  شغّلها لاحقاً: node tools/turath-import.mjs --adopt --scan`);
  }
  return found;
}

// ─────────────── وضع الاستكشاف ───────────────
async function probe(text) {
  const seen = new Map();
  for (const phrase of searchPhrases(text).slice(0, 3)) {
    // بحثٌ في كل الكتب: `book=0` لا يُقيّد، فنمرّر بحثاً غير مقيَّد بكتاب.
    for (const row of await searchInBook(phrase, '')) {
      if (!seen.has(row.book_id)) {
        seen.set(row.book_id, `${row.meta.book_name ?? '؟'} — ${row.meta.author_name ?? '؟'}`);
      }
    }
  }
  if (seen.size === 0) {
    console.log('لم يظهر النص في أي كتاب.');
    return;
  }
  console.log(`ظهر في ${seen.size} كتاباً:\n`);
  for (const [id, name] of seen) console.log(`  ${String(id).padStart(7)}  ${name}`);
  console.log('\nأضف المُعرّف إلى BOOKS في tools/lib/turath.mjs ليصبح الكتاب قابلاً للتوثيق.');
}

// ─────────────── التشغيل ───────────────
async function main() {
  if (probeText) return probe(probeText);

  const quotes = readSeed('quotes.json');
  const hadiths = readSeed('hadiths.json');

  const flush = () => {
    if (only !== 'hadiths') writeSeed('quotes.json', quotes);
    if (only !== 'quotes') writeSeed('hadiths.json', hadiths);
  };

  // توحيد النوعين في قائمة واحدة للمعالجة.
  const targets = [];
  if (only !== 'hadiths') {
    for (const quote of quotes) targets.push({ item: quote, bookName: quote.book, label: quote.book });
  }
  if (only !== 'quotes') {
    for (const hadith of hadiths) {
      const bookName = COLLECTION_BOOK[hadith.collection];
      targets.push({
        item: hadith,
        bookName,
        label: `${bookName ?? hadith.collection}${hadith.number ? ` ${hadith.number}` : ''}`,
      });
    }
  }

  const pending = targets.filter(
    (t) => (!onlyId || t.item.id === onlyId) && (force || t.item.page == null),
  );

  console.log(
    `البذرة: ${quotes.length} مقولة، ${hadiths.length} حديثاً — ` +
      `${pending.length} عنصراً للتوثيق${force ? ' (إعادة توثيق)' : ''}.\n`,
  );
  if (pending.length === 0) {
    console.log('لا جديد — كل المطلوب موثَّق.');
    return;
  }

  const unresolved = [];
  const partial = [];
  const adoptedItems = [];
  const unknownBooks = new Set();
  let filled = 0;

  // في وضع المسح تُحدَّد المواضع كلّها أولاً، كتاباً كتاباً، في مرّةٍ واحدة.
  const scanned = scan ? await locateAllByScan(pending) : null;
  if (scanned) console.log();

  for (const [index, { item, bookName, label }] of pending.entries()) {
    const head = `[${index + 1}/${pending.length}] ${label}`;
    const book = BOOKS[bookName];

    if (!book) {
      unknownBooks.add(bookName);
      unresolved.push({ item, label, why: `الكتاب «${bookName}» غير مُعرَّف في BOOKS` });
      console.log(`${head}\n  ✗ الكتاب غير مُعرَّف في BOOKS — أضفه بـ --probe.\n`);
      continue;
    }

    let result;
    try {
      result = scanned
        ? (scanned.get(item) ?? { ok: false, best: null, anchorNeed: MIN_ANCHOR, total: 0 })
        : await locate(item.text, book.id);
    } catch (e) {
      unresolved.push({ item, label, why: e.message });
      console.error(`${head}\n  ✗ ${e.message}\n`);
      continue;
    }

    if (!result.ok) {
      const got = result.best
        ? `أطول سلسلة ${result.best.anchor}/${result.total} كلمة، وتغطية ${Math.round(result.best.coverage * 100)}٪`
        : 'بلا نتائج';
      const bar = `المطلوب سلسلة ${result.anchorNeed} وتغطية ${MIN_COVERAGE * 100}٪`;
      unresolved.push({ item, label, why: `${got} — ${bar}` });
      console.log(`${head}\n  ✗ لم يُوثَّق — ${got}. ${bar}.`);
      if (result.best) {
        console.log(`    البذرة : ${plain(item.text)}`);
        console.log(`    المطبوع: ${result.best.printed}`);
      }
      console.log();
      continue;
    }

    // في وضع الاعتماد يُؤخذ المطبوع حرفياً دائماً — لا عند اختلاف الكلمات وحده،
    // فنصّ البذرة قد يكون مقتطَعاً من فقرةٍ أطول وإن طابق كلّ كلمةٍ فيه.
    let adopted = null;
    if (adopt) {
      const page = result.pageId ? await fetchPage(book.id, result.pageId) : null;
      if (page) adopted = adoptFromPage(page.text, item.text, { number: item.number ?? null, minAnchor, minCoverage });

      // تعذّر الأخذ ونصُّ البذرة يخالف المطبوع في كلماته: لا يُوثَّق ولا يُخمَّن.
      // أما إن طابق كلّ كلمةٍ فيه فهو اقتطاعٌ حرفيّ صحيح، فيُترك بنصّه ويُوثَّق.
      if (!adopted && result.best.anchor < result.total) {
        unresolved.push({ item, label, why: 'تعذّر أخذ النص من الصفحة بحدوده المطبوعة' });
        console.log(`${head}\n  ✗ وُجدت الصفحة، وتعذّر أخذ النص منها بحدوده — لا يُكتب تخميناً.`);
        console.log(`    البذرة : ${plain(item.text)}`);
        console.log(`    المطبوع: ${result.best.printed}\n`);
        continue;
      }
    }

    const before = item.text;
    if (adopted && adopted.text !== item.text) item.text = adopted.text;
    else adopted = null;
    item.volume = result.volume;
    item.page = result.page;
    item.source_url = result.source_url;
    if ('needs_reference_check' in item) item.needs_reference_check = false;
    filled += 1;
    if (!dryRun) flush();

    console.log(
      `${head}\n  ✓ ${result.volume ? `ج${result.volume}/` : ''}ص${result.page} — ${book.edition}\n` +
        `    سلسلة ${result.best.anchor}/${result.total} كلمة · تغطية ` +
        `${Math.round(result.best.coverage * 100)}٪ · ${result.source_url}`,
    );

    if (adopted) {
      adoptedItems.push({ item, label, before });
      console.log(`    ⤷ اعتُمد نصّ المطبوع حرفياً (${adopted.source}):`);
      console.log(`      كان  : ${before}`);
      console.log(`      صار  : ${item.text}`);
    } else if (result.best.anchor < result.total) {
      // تطابق جزئي بلا اعتماد: المرجع صحيح، والنص يخالف المطبوع.
      partial.push({ item, label, printed: result.best.printed });
      console.log('    ⚠ النص يخالف المطبوع — شغّله بـ --adopt أو راجِعه:');
      console.log(`      البذرة : ${plain(item.text)}`);
      console.log(`      المطبوع: ${result.best.printed}`);
    }
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(
    `وُثّق ${filled} عنصراً، وتعذّر ${unresolved.length}. ` +
      `طلبات الشبكة: ${stats.requests}، تمهّل: ${stats.cooldowns}.`,
  );

  if (adoptedItems.length > 0) {
    console.log(`
اعتُمد نصّ المطبوع حرفياً في ${adoptedItems.length} عنصراً:`);
    for (const a of adoptedItems) console.log(`  • ${a.label} — ${a.item.id}`);
  }
  if (partial.length > 0) {
    console.log(`\nوُثّق مع اختلاف عن المطبوع (${partial.length}) — يُراجَع نصّه قبل النشر:`);
    for (const p of partial) console.log(`  • ${p.label} — ${p.item.id}`);
  }
  if (unresolved.length > 0) {
    console.log('\nلم يُوثَّق (يُراجع يدوياً على app.turath.io — ولا يُخمَّن):');
    for (const u of unresolved) console.log(`  • ${u.label} — ${u.item.id}\n    ${u.why}`);
  }
  if (unknownBooks.size > 0) {
    console.log('\nكتبٌ تحتاج إضافة إلى BOOKS:');
    for (const b of unknownBooks) {
      console.log(`  • ${b}   →  node tools/turath-import.mjs --probe "عبارة منه"`);
    }
  }

  if (dryRun) {
    console.log('\n--dry-run: لم تُكتب أي ملفات.');
    return;
  }
  if (filled === 0) {
    console.log('\nلا تعديل يُكتب.');
    return;
  }

  flush();
  console.log('\nكُتبت ملفات البذرة.');

  // البذرة هي مصدر الحقيقة؛ seed.sql يُولَّد منها، والتحقّق الصارم بوّابة النشر.
  for (const [script, args] of [['gen-seed-sql.mjs', []], ['validate-content.mjs', ['--strict']]]) {
    console.log(`\n$ node tools/${script} ${args.join(' ')}`.trimEnd());
    const res = spawnSync(process.execPath, [join(root, 'tools', script), ...args], {
      stdio: 'inherit',
    });
    if (res.status !== 0) process.exitCode = res.status ?? 1;
  }
}

main().catch((e) => {
  console.error(`فشل: ${e.message}`);
  process.exit(1);
});
