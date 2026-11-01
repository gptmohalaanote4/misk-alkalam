#!/usr/bin/env node
/**
 * يحصد محتوىً جديداً من «تراث» آلياً، بمرجعه كاملاً، ويضيفه إلى البذرة.
 * هذه الأداة هي ما يجعل التطبيق يُجدِّد محتواه بلا تدخّل: يشغّلها عملٌ مجدول
 * (`.github/workflows/content.yml`) فيزداد المحتوى من نفسه.
 *
 *   node tools/turath-harvest.mjs                  # جولة واحدة ثم كتابة
 *   node tools/turath-harvest.mjs --pages=200      # ميزانية طلبات الجولة (افتراضي ١٢٠)
 *   node tools/turath-harvest.mjs --max=40         # حدّ ما يُضاف في الجولة (افتراضي ٢٥)
 *   node tools/turath-harvest.mjs --book=الفوائد   # كتاب واحد
 *   node tools/turath-harvest.mjs --from=46        # يبدأ من صفحة داخلية بعينها
 *   node tools/turath-harvest.mjs --dry-run        # يعرض ما سيضيفه بلا كتابة
 *   node tools/turath-harvest.mjs --reset          # يبدأ مسحاً جديداً من أول الكتب
 *
 * ── كيف يعمل ──
 * لكل كتابٍ آليةُ حصدٍ تناسب بناءه، والمؤشر محفوظ في `tools/harvest-state.json`
 * فتستأنف كل جولةٍ من حيث انتهت سابقتها ولا تُثقل «تراث»:
 *
 *   'bullet'  — «الفوائد»: تُقرأ صفحاته بالتتابع، وكل نقطة «•» فائدةٌ مكتملة.
 *   'hadeeth' — البخاري: لا يُقرأ بالتتابع (صفحاته الداخلية بالآلاف)، بل يُبحث
 *               عن **أبواب الفضائل** فيعطي «تراث» مسار الكتاب والباب كاملاً،
 *               ثم تُقرأ صفحات الباب وحدها.
 *
 * ولأن المصدر هو الصفحة نفسها، فـ `volume` و`page` و`source_url` تُعرَف يقيناً
 * لا بحثاً، فيمرّ المحصود من بوّابة `--strict` بلا نقص.
 *
 * ── البوّابات ──
 * البوّابات في `lib/extract.mjs` وهي مُختبَرة في `lib/extract.test.mjs`، لأنها
 * الضمان الوحيد بين «تراث» والمستخدم: لا مراجعة بشرية بينهما. وقاعدتها أن
 * **ما دون اليقين يُسقَط** ولا يُؤجَّل. وهذه الأداة تضيف إليها بوّابتين:
 * المصدر من `BOOKS` حصراً بآلية مُعلَنة، والصفحة مرقَّمة المجلد (فمقدّمة
 * المحقّق وفهارسه ليست من كلام المؤلف).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { BOOKS, COLLECTION_BOOK, fetchPage, fingerprint, pageUrl, positiveInt, searchInBook, stats } from './lib/turath.mjs';
import * as turath from './lib/turath.mjs';
import * as shamela from './lib/shamela.mjs';
import {
  classifyHeading,
  extractBiography,
  biographySectionOk,
  extractBulleted,
  extractHadiths,
  extractAnthology,
  extractSentences,
  findDuplicate,
  isDeedChapter,
  isMeritBab,
  printedRef,
} from './lib/extract.mjs';
import { bookSize } from './lib/locate.mjs';
import { readSeed, root, writeSeed } from './lib/seed.mjs';

const STATE_FILE = join(root, 'tools/harvest-state.json');
const REJECTED_FILE = join(root, 'tools/rejected.json');

/**
 * قناتا الجلب. المُعرّفات نفسها في القناتين (الكتب والصفحات)، فالفرق في **سلوك
 * الفراغ** لا في المحتوى:
 *
 *   'turath'  — الفراغ يُحتمل أنه حدُّ طلبات، فيلزمه شاهد (`confirmBookEnd`).
 *               وله وحده وسم `<hadeeth-N>` المُرقَّم ومحرّكُ بحث، فآليّة `hadeeth`
 *               لا تُنقل عنه.
 *   'shamela' — الفراغ 404 قاطع، والحدُّ 429 يُرمى استثناءً. ولا حدَّ عمليّاً.
 *
 * و`bookSize` في «تراث» من `lib/locate.mjs` (مضاعفةٌ وتنصيف على الفراغ)، وفي
 * «الشاملة» من طبقتها نفسها لأن الفراغ فيها قاطعٌ فالنتيجة قاطعة.
 */
const CHANNELS = {
  turath: { ...turath, bookSize: (id) => bookSize(id) },
  shamela,
};
const channelOf = (book) => CHANNELS[book.channel] ?? CHANNELS.turath;

/**
 * ما حُذف لأجل معناه لا لمخالفةٍ شكلية: لا بوّابةَ تردّه، فلو أُعيد المسح لعاد.
 * فيُستشار سجلُّه قبل الإضافة. والمقارنة ببصمة النص، فتوحيدُ الرسم لا يُفلته.
 */
const rejected = (() => {
  if (!existsSync(REJECTED_FILE)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(REJECTED_FILE, 'utf8'));
    return new Set((raw.items ?? []).map((x) => fingerprint(x.text)));
  } catch {
    console.log('⚠ تعذّر قراءة tools/rejected.json — يُتابَع بلا سجلّ المحذوف.');
    return new Set();
  }
})();

/** عبارات البحث التي تكشف أبواب الفضائل في الصحيحين. */
const MERIT_QUERIES = ['باب فضل', 'باب فضائل', 'باب ثواب', 'باب كفارة'];

/** صفحات تُقرأ بعد عنوان الباب — أحاديث الباب تقع فيها. */
const FOLLOW_PAGES = 4;

// ─────────────── الوسائط ───────────────
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const val = (flag) => {
  const hit = argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
};
const dryRun = has('--dry-run');
const reset = has('--reset');
const onlyBook = val('--book');
const requestBudget = positiveInt(val('--pages')) ?? 120;
const maxNew = positiveInt(val('--max')) ?? 25;
/** يُقدّم مؤشر الكتاب المتتابع يدوياً — لتخطّي مقدّمة أو إعادة قراءة نطاق. */
const fromPage = positiveInt(val('--from'));
/** ملفُ مرشّحاتٍ تُراجَع بدل الكتابة في البذرة — لِما لا تضمن الآلةُ جودته. */
const candidatesFile = val('--candidates');

// ─────────────── المؤشر ───────────────
/** المؤشر محفوظٌ في المستودع ليستأنف العمل المجدول من حيث انتهى. */
function loadState() {
  if (reset || !existsSync(STATE_FILE)) return { books: {} };
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? { books: parsed.books ?? {} } : { books: {} };
  } catch {
    return { books: {} };
  }
}

const saveState = (state) =>
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

// ─────────────── التشغيل ───────────────
async function main() {
  const quotes = readSeed('quotes.json');
  const hadiths = readSeed('hadiths.json');
  const state = loadState();

  // ما هو موجود أصلاً: بصمات النصوص للمقارنة، وأرقام الأحاديث.
  const known = [...quotes, ...hadiths].map((item) => ({
    print: fingerprint(item.text),
    label: item.number ? `${item.collection} ${item.number}` : item.id,
  }));
  const seenNumber = new Set(
    hadiths.filter((h) => h.number).map((h) => `${h.collection}#${h.number}`),
  );

  const addedQuotes = [];
  const addedHadiths = [];
  const counts = { duplicate: 0, unnumbered: 0, offTopic: 0, limited: 0, gaps: 0, rejected: 0 };
  const added = () => addedQuotes.length + addedHadiths.length;

  /**
   * الميزانية تُقسَم على الكتب بالعدل، وما لم يُنفقه كتابٌ ينتقل إلى ما بعده —
   * وإلّا استنفد أوّل كتابٍ الجولة كلّها فلم ينمُ غيره أبداً.
   */
  const session = { budget: requestBudget, allowance: 0, quota: 0, startedAt: 0 };
  const quotaReached = () => added() >= maxNew || added() - session.startedAt >= session.quota;
  const canSpend = () => session.budget > 0 && session.allowance > 0 && !quotaReached();
  const spend = () => {
    session.budget -= 1;
    session.allowance -= 1;
  };

  /**
   * آليّةُ `sentence` **لا تدخل البذرة آلياً**.
   *
   * كتبُ ابن القيم نثرٌ متّصل لا تفصل فيه الطبعة وحداتٍ مكتملة، فالجملةُ
   * المستخرجة منها لا يضمن بناءُ الطبعة حدَّها — بخلاف `bullet` و`hadeeth`
   * و`biography`. وهذا منصوصٌ في `BOOKS` وفي جدول الضمانات، لكنّ الشفرة كانت
   * تخالفه: الجولةُ العادية تحصدها وتكتبها في البذرة، والعملُ المجدول أسبوعياً
   * يفعل ذلك بلا عينٍ تراه.
   *
   * فصارت تُحصد **فقط** مع `--candidates`، أي إلى ملفِّ مراجعةٍ لا إلى البذرة.
   * والضمانُ في الشفرة لا في تذكُّر الراية.
   *
   * و`anthology` تدخل البذرة: نصُّها منقولٌ عن غير مؤلّف الكتاب، وقد حسم صاحب
   * المشروع نسبتَه — «المقولة التي لا تعرف قائلها حطها بدون قائل، وضع اسم
   * الكتاب والصفحة». فـ`scholar_slug` فيها فارغ، والمرجعُ كتابُها وصفحتُه.
   */
  const CANDIDATES_ONLY = new Set(['sentence']);

  const harvestable = Object.entries(BOOKS).filter(
    ([name, book]) =>
      book.harvest &&
      (!onlyBook || name === onlyBook) &&
      (!CANDIDATES_ONLY.has(book.harvest) || Boolean(candidatesFile)),
  );
  if (harvestable.length === 0) {
    console.error(onlyBook ? `لا حصد من «${onlyBook}» — راجع BOOKS.` : 'لا كتاب قابلاً للحصد.');
    process.exit(1);
  }

  console.log(
    `الحصد من ${harvestable.length} كتاباً، بميزانية ${requestBudget} طلباً ` +
      `وحدّ ${maxNew} عنصراً جديداً.\n`,
  );

  /** يقبل نصّاً بعد فحص التكرار على كل ما سبق — الموجود والمحصود في هذه الجولة. */
  const accept = (text, label, build) => {
    // ما حُذف بقرارٍ لا يعود، ولو أُعيد مسح الكتاب من أوّله.
    if (rejected.has(fingerprint(text))) {
      counts.rejected += 1;
      return false;
    }
    const duplicate = findDuplicate(text, known);
    if (duplicate) {
      counts.duplicate += 1;
      return false;
    }
    known.push({ print: fingerprint(text), label });
    build();
    return true;
  };

  const addQuote = (text, book, bookName, volume, page, url) =>
    accept(text, `${bookName} ص${page}`, () => {
      addedQuotes.push({
        id: randomUUID(),
        // المجموعُ ينقل عن غير مؤلّفه، فلا يُنسب إليه ولا يُفتعل له قائل:
        // «المقولة التي لا تعرف قائلها حطها بدون قائل، وضع اسم الكتاب والصفحة».
        scholar_slug: book.scholar_slug ?? null,
        // 'biography' خبرٌ عن صالح من كتب السِّيَر، لا قولٌ لصاحب الكتاب.
        genre: book.genre ?? 'saying',
        text,
        book: bookName,
        topic: book.topic ?? undefined,
        volume,
        page,
        source_url: url,
        tags: [],
        needs_reference_check: false,
        // المصدر هو القناة التي يشير إليها `source_url` فعلاً، لا الافتراضي.
        source_slug: channelOf(book).slug,
      });
      console.log(`    + ج${volume ?? '؟'}/ص${page}: ${text.slice(0, 68)}…`);
    });

  const addHadith = (hit, book, volume, page, url) => {
    const key = `${book.collection}#${hit.number}`;
    if (seenNumber.has(key)) {
      counts.duplicate += 1;
      return false;
    }
    return accept(hit.matn, key, () => {
      seenNumber.add(key);
      addedHadiths.push({
        id: randomUUID(),
        collection: book.collection,
        text: hit.matn,
        narrator: hit.narrator,
        chapter: hit.chapter,
        number: hit.number,
        volume,
        page,
        source_url: url,
        tags: [],
      });
      console.log(
        `    + ${COLLECTION_BOOK[book.collection]} ${hit.number} — ج${volume ?? '؟'}/ص${page}: ` +
          `${hit.matn.slice(0, 58)}…`,
      );
    });
  };

  /**
   * الفراغ ليس عدماً: «تراث» يحدّ الطلبات المتسارعة بإرجاع صفحةٍ فارغة بلا خطأ.
   * فالحكم بنهاية الكتاب لا يُبنى على فراغٍ واحد، بل على شاهدٍ قاطع: نتمهّل، ثم
   * نعيد صفحةً **قُرئت فعلاً** قبل قليل. فإن عادت بنصّها فالخادم يستجيب والفراغ
   * نهايةٌ حقيقية؛ وإن عادت فارغةً هي أيضاً فنحن محدودون، فنتوقف بلا حكم —
   * ولا يُكتب `done`، لئلّا يُهجر باقي الكتاب إلى الأبد.
   * (وقد وقع هذا فعلاً: حُكم بانتهاء «حلية الأولياء» في مجلّدها الثاني من عشرة.)
   */
  async function confirmBookEnd(book, cursor) {
    // قناةٌ تُفرِّق الفراغ من الحدّ برمزٍ (404 مقابل 429) لا تحتاج شاهداً: فراغُها
    // جوابٌ قاطع من الطلب الأول، فلا يُنتظر دقيقةٌ ولا يُنفَق طلبٌ على تحصيل
    // الحاصل. و«تراث» وحده هو الذي يُشتبه فراغُه.
    if (channelOf(book).endIsDefinite) return true;
    const back = Math.max(1, cursor - 40);
    if (back === cursor) return true;
    await new Promise((r) => setTimeout(r, 60_000));
    const witness = await fetchPage(book.id, back, { expectEmpty: true });
    spend();
    return witness != null;
  }

  // ─── آلية «النقاط»: قراءة الكتاب بالتتابع ───
  async function harvestBulleted(bookName, book, bookState) {
    const channel = channelOf(book);
    // طولُ الكتاب يُحدَّد ببحثٍ ثنائي مرةً واحدة ويُحفظ. وبه يُفرَّق بين **ثُغرةٍ**
    // في بيانات المصدر ونهايةِ الكتاب — وقد حُكم بانتهاء «الحلية» عند ثُغرةٍ في
    // صفحتها ٢٥٠٦ وفيها بعدها ألفٌ وثلاث مئة صفحة.
    if (bookState.last == null) {
      bookState.last = await channel.bookSize(book.id);
      spend();
      console.log(`  آخر صفحةٍ داخلية في الكتاب: ${bookState.last}`);
    }
    console.log(
      `• ${bookName} — ${book.edition}\n` +
        `  قناة «${channel.label}» — من الصفحة الداخلية ${bookState.cursor}`,
    );
    let read = 0;
    const before = addedQuotes.length;
    // العناوين تُحمل بين الصفحات: «تراث» لا يذكرها إلا في صفحة ابتدائها.
    let section = bookState.section ?? [];
    /** فقرةٌ لم تُختم في آخر صفحة: تنتظر تتمّتها في أوّل التالية (المجموع وحده). */
    let anthCarry = null;
    let empties = 0;

    while (canSpend()) {
      const page = await channel.fetchPage(book.id, bookState.cursor);
      spend();
      read += 1;

      if (!page) {
        // ما دون آخر صفحةٍ في الكتاب ثُغرةٌ تُتجاوز، لا نهاية. وثُغرةٌ طويلة قد
        // تكون حدَّ طلباتٍ متنكّراً، فتُستشهد صفحةٌ قُرئت فعلاً بعد عشر فراغاتٍ متتابعة.
        if (bookState.cursor < bookState.last) {
          empties += 1;
          counts.gaps += 1;
          bookState.cursor += 1;
          if (empties < 10) continue;
          if (await confirmBookEnd(book, bookState.cursor)) {
            empties = 0;
            continue;
          }
          counts.limited += 1;
          console.log(
            `  ⚠ عشرُ صفحاتٍ فارغةٍ متتابعة عند ${bookState.cursor} وصفحةٌ سابقة فارغةٌ كذلك: حدُّ طلبات.`,
          );
          console.log(
            '    تُوقف هذه الجولة والمؤشر باقٍ. أعِد التشغيل لاحقاً أو أبطئه بـ TURATH_GAP_MS.',
          );
          break;
        }
        if (await confirmBookEnd(book, bookState.cursor)) {
          bookState.done = true;
          console.log(`  ⌁ انتهى الكتاب عند الصفحة الداخلية ${bookState.cursor}.`);
        } else {
          counts.limited += 1;
          console.log(
            `  ⚠ فراغٌ عند ${bookState.cursor} وصفحةٌ سابقة فارغةٌ كذلك: حدُّ طلبات لا نهايةُ كتاب.`,
          );
          console.log(
            '    تُوقف هذه الجولة والمؤشر باقٍ. أعِد التشغيل لاحقاً أو أبطئه بـ TURATH_GAP_MS.',
          );
        }
        break;
      }
      bookState.cursor += 1;
      empties = 0;

      const pageHeadings = Array.isArray(page.meta?.headings) ? page.meta.headings : [];
      if (pageHeadings.length > 0) section = pageHeadings;
      bookState.section = section;

      const ref = printedRef(page.meta);
      if (!ref) {
        counts.unnumbered += 1;
        continue;
      }
      // كتب السِّيَر تُحصد من أبواب التراجم وحدها، لا من سيرة النبي ﷺ ولا من
      // المقدّمات والفهارس.
      if (book.harvest === 'biography' && !biographySectionOk(section)) {
        counts.offTopic += 1;
        continue;
      }
      // الصفحة تُستوفى كاملة: قد تتجاوز نصيب الجولة بقليل، لكن إغفال فائدةٍ في
      // صفحةٍ قُرئت يعني ضياعها، لأن المؤشر يتقدّم ولا يعود.
      const url = channel.pageUrl(book.id, page.pageId);

      // المجموعُ وحده يحمل حالةً بين الصفحات: الفقرةُ تعبُر حدَّ الصفحة فتُوصل،
      // وتُنسب إلى الصفحة التي ابتدأت فيها لا التي انتهت — فلكلِّ عنصرٍ صفحتُه.
      if (book.harvest === 'anthology') {
        const got = extractAnthology(page.text, { carry: anthCarry, page: ref.page });
        anthCarry = got.carry;
        for (const item of got.items) {
          addQuote(item.text, book, bookName, ref.volume, item.page, url);
        }
        continue;
      }

      const extractor =
        book.harvest === 'sentence'
          ? extractSentences
          : book.harvest === 'biography'
            ? extractBiography
            : extractBulleted;
      const texts = extractor(page.text);
      for (const text of texts) {
        addQuote(text, book, bookName, ref.volume, ref.page, url);
      }
    }

    console.log(`  قُرئت ${read} صفحة، وأُضيف ${addedQuotes.length - before} عنصراً.\n`);
  }

  // ─── آلية «أبواب الفضائل»: البحث عن الباب ثم قراءة صفحاته ───
  async function harvestMeritChapters(bookName, book, bookState) {
    bookState.query ??= 0;
    bookState.searchPage ??= 1;
    console.log(
      `• ${bookName} — ${book.edition}\n` +
        `  بحث «${MERIT_QUERIES[bookState.query]}» — صفحة النتائج ${bookState.searchPage}`,
    );
    const before = addedHadiths.length;
    let babs = 0;

    while (canSpend()) {
      if (bookState.query >= MERIT_QUERIES.length) {
        bookState.done = true;
        console.log('  ⌁ استُوفيت عبارات البحث كلّها.');
        break;
      }

      const rows = await searchInBook(MERIT_QUERIES[bookState.query], book.id, bookState.searchPage);
      spend();

      if (rows.length === 0) {
        // انتهت نتائج هذه العبارة — ننتقل إلى التالية.
        bookState.query += 1;
        bookState.searchPage = 1;
        continue;
      }
      bookState.searchPage += 1;

      for (const row of rows) {
        if (!canSpend()) break;
        const headings = Array.isArray(row.meta.headings) ? row.meta.headings : [];
        const titles = headings.map(classifyHeading);
        const chapter = titles.find((h) => h.level === 'chapter')?.title ?? null;
        const bab = titles.findLast((h) => h.level === 'bab')?.title ?? null;
        // البوّابتان قبل أي قراءة: لا نُنفِق طلباً على باب لا يُقبل.
        if (!isDeedChapter(chapter) || !isMeritBab(bab)) continue;

        const start = positiveInt(row.meta.page_id);
        if (!start) continue;
        babs += 1;

        // صفحة العنوان ثم صفحاتٌ بعدها: فيها أحاديث الباب.
        let context = { chapter, bab };
        for (let offset = 0; offset <= FOLLOW_PAGES; offset++) {
          if (offset > 0 && !canSpend()) break;
          const page =
            offset === 0
              ? { text: row.text, meta: row.meta, pageId: start }
              : await fetchPage(book.id, start + offset);
          if (offset > 0) spend();
          if (!page) break;

          const result = extractHadiths(page.text, context);
          context = result.context;
          // خرجنا من باب الفضائل إلى غيره: لا حاجة لمتابعة صفحات هذا الباب.
          if (!isMeritBab(context.bab)) break;

          const ref = printedRef(page.meta);
          if (!ref) {
            counts.unnumbered += 1;
            continue;
          }
          const url = pageUrl(book.id, page.pageId ?? start + offset);
          for (const hit of result.items) {
            addHadith(hit, book, ref.volume, ref.page, url);
          }
        }
      }
    }

    console.log(`  فُحص ${babs} باباً، وأُضيف ${addedHadiths.length - before} حديثاً.\n`);
  }

  /**
   * ينقل مؤشر الكتاب من قناةٍ إلى أخرى **بالصفحة المطبوعة**، لا بالمُعرّف الداخلي.
   *
   * المُعرّف الداخلي خاصٌّ بالقناة: «تراث» يزيد في «حلية الأولياء» أربعَ مواضعِ
   * تقسيمٍ في مجلداتها ٨–١٠، فمؤشرُ ٣٨٥٦ عنده هو ٣٨٥٢ في «الشاملة». ولو نُقل
   * الرقم كما هو لقُفز عن أربع صفحاتٍ بلا أن يظهر نقصٌ في شيء.
   *
   * ورقمُ المطبوع لنفس النصّ متطابقٌ في القناتين (تُحقِّق من ذلك في ثلاثة مواضع)،
   * فهو وحده ما يصلح جسراً: نقرأ المطبوع عند المؤشر القديم، ثم نسأل القناة
   * الجديدة عن صفحته. وما تعذّر نقله يُترك بحاله ويُطبع — لا يُخمَّن.
   */
  async function adoptCursorToChannel(bookName, book, bookState) {
    const channel = channelOf(book);
    const was = bookState.channel ?? 'turath';
    if (was === book.channel) {
      bookState.channel = book.channel;
      return;
    }

    const from = CHANNELS[was];
    // طولُ الكتاب ومقطعُه محسوبان بمُعرّفات القناة القديمة، فيُسقطان في كل حال.
    bookState.last = null;
    bookState.section = undefined;
    bookState.channel = book.channel;

    const moving = `• ${bookName}: نُقل إلى قناة «${channel.label}»`;
    // مؤشرٌ في أوّل الكتاب لا يحتاج نقلاً: أوّلُه أوّلُه في القناتين.
    if (bookState.cursor <= 1) {
      console.log(`${moving} — المؤشر في أوّل الكتاب.`);
      bookState.cursor = 1;
      return;
    }
    if (!from || !channel.locatePrintedPage) {
      console.log(`${moving} — ⚠ تعذّر نقل المؤشر، فهو باقٍ بحاله (${bookState.cursor}).`);
      console.log('    راجِعه بـ--from، أو ابدأ مسحاً جديداً بـ--reset.');
      return;
    }

    const page = await from.fetchPage(book.id, bookState.cursor);
    spend();
    const printed = positiveInt(page?.meta?.page);
    const volume = positiveInt(page?.meta?.vol);
    if (!printed) {
      console.log(
        `• ${bookName}: نُقل إلى «${channel.label}» وتعذّر قراءة مطبوع المؤشر ` +
          `${bookState.cursor} من «${from.label}» — المؤشر باقٍ بحاله.`,
      );
      return;
    }

    const moved = await channel.locatePrintedPage(book.id, volume ?? 1, printed);
    spend();
    if (!moved) {
      console.log(
        `• ${bookName}: نُقل إلى «${channel.label}» ولم تُعرف داخليةُ ج${volume ?? '؟'}/ص${printed} ` +
          '— المؤشر باقٍ بحاله.',
      );
      return;
    }

    console.log(
      `• ${bookName}: نُقل إلى قناة «${channel.label}» — المؤشر ${bookState.cursor} ← ${moved} ` +
        `(ج${volume ?? '؟'}/ص${printed}).`,
    );
    bookState.cursor = moved;
  }

  const requestShare = Math.max(1, Math.ceil(requestBudget / harvestable.length));
  const itemShare = Math.max(1, Math.ceil(maxNew / harvestable.length));

  for (const [index, [bookName, book]] of harvestable.entries()) {
    if (session.budget <= 0 || added() >= maxNew) break;

    // نصيب هذا الكتاب، مضافاً إليه ما لم يُنفقه من قبله.
    const remainingBooks = harvestable.length - index;
    session.allowance = Math.min(session.budget, requestShare + Math.max(0, session.allowance));
    session.quota = Math.min(
      maxNew - added(),
      itemShare + Math.max(0, maxNew - added() - itemShare * remainingBooks),
    );
    session.startedAt = added();

    const bookState = state.books[String(book.id)] ?? { cursor: 1, done: false };
    // كتابٌ مكتملٌ لا يُنقل مؤشره: نقلٌ بلا قارئ، ويُنفق طلباً بلا فائدة.
    if (bookState.done && !fromPage) {
      console.log(`• ${bookName}: مسحٌ مكتمل — لإعادة المسح: --reset.\n`);
      continue;
    }
    // خللُ شبكةٍ عارض لا يُهدِر الجولة. المؤشر يتقدّم في `bookState` مع كل صفحةٍ
    // تُقرأ، فالخروجُ نظيفاً يحفظ ما قُرئ وما حُصد؛ والاستثناءُ لو صعد لأُلغي
    // كلُّ شيء — وقد وقع فعلاً في «سير أعلام النبلاء»: ضاعت خمس مئة صفحةٍ
    // وأربعةُ أخبارٍ لانقطاعٍ لحظة. (وهذا ما يفعله مسارُ «تراث» عند حدّ الطلبات:
    // يتوقف والمؤشر باقٍ.)
    //
    // و**نقلُ المؤشر داخل الحارس** لا خارجه: هو نفسُه يطلب من الشبكة، فكان
    // خروجُه منه يُسقِط الجولة كلَّها بأول خطأ — وهو ما أفشل أوّل تشغيلٍ على
    // GitHub Actions في سبع ثوانٍ، قبل أن يُقرأ حرفٌ واحد.
    try {
      await adoptCursorToChannel(bookName, book, bookState);
      // `--from` يُذكر بمُعرّفات القناة العاملة، فيَلِي النقلَ ولا يُترجَم.
      if (fromPage) {
        bookState.cursor = fromPage;
        bookState.done = false;
      }
      if (['bullet', 'sentence', 'biography', 'anthology'].includes(book.harvest)) {
        await harvestBulleted(bookName, book, bookState);
      }
      if (book.harvest === 'hadeeth') await harvestMeritChapters(bookName, book, bookState);
    } catch (e) {
      counts.limited += 1;
      state.books[String(book.id)] = bookState;
      console.log(`  ⚠ انقطع «${bookName}» عند الصفحة الداخلية ${bookState.cursor}: ${e.message}`);
      console.log('    يُحفظ ما قُرئ وما حُصد، والمؤشر باقٍ. أعِد التشغيل ليُستأنف.\n');
      break;
    }

    state.books[String(book.id)] = bookState;
  }

  console.log('─'.repeat(60));
  console.log(
    `جديد: ${addedQuotes.length} مقولة، ${addedHadiths.length} حديثاً. ` +
      `مكرّر مُسقَط: ${counts.duplicate}، صفحات غير مرقَّمة: ${counts.unnumbered}، خارج أبواب التراجم: ${counts.offTopic}. ` +
      `طلبات: تراث ${stats.requests} (تمهّل ${stats.cooldowns})، ` +
      `الشاملة ${shamela.stats.requests} (إعادة ${shamela.stats.retries})` +
      (counts.gaps > 0 ? `، ثُغَرٌ تُجوِّزت: ${counts.gaps}` : '') +
      (counts.rejected > 0 ? `، محذوفٌ مُنع رجوعه: ${counts.rejected}` : '') +
      (counts.limited > 0 ? `، كتبٌ أُوقفت لحدّ الطلبات: ${counts.limited}.` : '.'),
  );

  if (dryRun) {
    console.log('\n--dry-run: لم تُكتب أي ملفات.');
    return;
  }

  // المؤشر يُحفظ حتى لو لم يُضَف شيء، فالجولة القادمة تبدأ بعد ما قُرئ.
  saveState(state);

  if (added() === 0) {
    console.log('\nلا جديد يُضاف — حُفظ المؤشر فقط.');
    return;
  }

  if (candidatesFile) {
    // الجملة المستخرجة من النثر لا تضمن الآلةُ صلاحَها للعرض، فتُكتب مرشّحات
    // تُراجَع، ولا تُمسّ البذرة حتى يعتمدها صاحب المشروع.
    writeFileSync(candidatesFile, `${JSON.stringify(addedQuotes, null, 1)}\n`, 'utf8');
    console.log(`\nكُتب ${addedQuotes.length} مرشّحاً في ${candidatesFile} — لم تُمسّ البذرة.`);
    return;
  }

  writeSeed('quotes.json', [...quotes, ...addedQuotes]);
  writeSeed('hadiths.json', [...hadiths, ...addedHadiths]);
  console.log('\nكُتبت ملفات البذرة.');

  // البذرة مصدر الحقيقة؛ ما بعدها مولَّد. والتحقّق هنا غير صارم بقصد: ما يُضيفه
  // الحاصد كامل المرجع بحكم مصدره، ونقصُ ما سبقه ليس من شأنه — و`--strict`
  // بوّابة نشر التطبيق لا بوّابة هذه الجولة.
  for (const [script, args] of [
    ['gen-seed-sql.mjs', []],
    ['gen-content-json.mjs', []],
    ['validate-content.mjs', []],
  ]) {
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
