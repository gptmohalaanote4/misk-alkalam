/**
 * طبقة الاتصال بـ «تراث» ومعالجة النص العربي — تشترك فيها أدوات `tools/`.
 * بلا تبعيات: node وحده.
 *
 * «تراث» يحدّ من الطلبات المتسارعة بإرجاع **نتائج فارغة بلا رسالة خطأ**، فنتائجٌ
 * فارغة متتابعة تعني غالباً الحدّ لا عدم وجود النص؛ لذلك يتمهّل العميل هنا ثم
 * يعيد المحاولة، ولا يُفسِّر الفراغ عدماً إلا بعد ذلك.
 */

const API = 'https://api.turath.io';
export const APP = 'https://app.turath.io';

// ─────────────── الطبعات المعتمدة ───────────────
// مُعرّف الكتاب في «تراث» لكل كتاب تستشهد به البذرة. الاختيار مقصود: أرقام
// الأحاديث في البذرة موافقة لترقيم هاتين الطبعتين، وكتب ابن القيم من طبعة
// «عطاءات العلم» لأنها محقَّقة وترقيمها موافق للمطبوع.
//
//   kind     : 'hadith' أو 'quote' — ما يُنتجه الكتاب.
//   harvest  : آلية الحصد الآلي، أو false فلا يُحصد منه (يبقى للتوثيق فقط).
//              'bullet' — الطبعة تفصل الفوائد بـ «•» فكل نقطة وحدة مكتملة.
//              'hadeeth' — المتون موسومة في «تراث» بوسم <hadeeth> فتُستخرج يقيناً.
//   channel  : قناةُ الجلب — 'turath' أو 'shamela' (انظر `lib/shamela.mjs`).
//              المُعرّفات نفسها في القناتين، فالجدول واحدٌ لهما.
//              و**آليّة `hadeeth` تلزمها «تراث»** لأن وسم `<hadeeth-N>` المُرقَّم
//              هو ما يَلحم المتن المتقطّع، ولا نظير له في «الشاملة».
//              وما سواها على «الشاملة»: لا حدَّ طلبات، والفراغ لا يلتبس بالحدّ.
//
// لإضافة كتاب: `turath-import.mjs --probe "عبارة منه"` يطبع مُعرّفه.
export const BOOKS = {
  'صحيح البخاري': {
    id: 1681,
    edition: 'ط السلطانية (بترقيم محمد فؤاد عبد الباقي)',
    kind: 'hadith',
    collection: 'bukhari',
    harvest: 'hadeeth',
    channel: 'turath',
  },
  // لا يُحصد آلياً: نصّ هذه الطبعة في «تراث» بلا وسم <hadeeth>، وحدّ المتن فيها
  // علامةُ تنصيصٍ واحدة غير مزدوجة، فلا يضمن بناؤها حدود المتن. والطبعة لا تُبدَّل
  // لأن المجلد والصفحة خاصّان بها، فخلطُ طبعتين يجعل المرجع غير متّسق.
  'صحيح مسلم': {
    id: 1727,
    edition: 'ت محمد فؤاد عبد الباقي',
    kind: 'hadith',
    collection: 'muslim',
    harvest: false,
    channel: 'turath',
  },
  'الفوائد': {
    id: 212,
    edition: 'ط عطاءات العلم',
    kind: 'quote',
    scholar_slug: 'ibn-al-qayyim',
    harvest: 'bullet',
    channel: 'shamela',
  },
  // الكتب الآتية نثرٌ متّصل لا تفصل فيه الطبعة وحداتٍ مكتملة، فلا تُحصد آلياً:
  // المرجع يُوثَّق منها، والنصّ يُضاف بمراجعة.
  'الجواب الكافي': { id: 98093, edition: 'الداء والدواء — ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'إغاثة اللهفان': { id: 18612, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'الوابل الصيب': { id: 18128, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'مدارج السالكين': { id: 199, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'عدة الصابرين': { id: 252, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'مفتاح دار السعادة': { id: 145411, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'روضة المحبين': { id: 417, edition: 'ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  'بدائع الفوائد': { id: 12003, edition: 'ط الكتاب العربي', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },
  // لا يُحصد آلياً — **وهذا قرارٌ عن تجربة، لا عن تقدير**: حُصدت منه ستّون خبراً
  // فكان أكثرها جرحاً وتعديلاً («القطان لا يحدّث عن إسرائيل»، «أبو معشر تغيّر قبل
  // موته»)، أو أخبارَ أمراءٍ وفتنٍ وقتل («الحجاج يعذّب معبداً… ثم قتله»، «المختار
  // يربطهم بالمحال والكذب»)، أو تفاصيلَ عابرة (بيعُ العطر، ولبسُ الطيلسان). وهي
  // كلُّها تمرّ بوّابات `biography` لأنها «كان فلانٌ يفعل كذا» صيغةً.
  //
  // والعلّة أن هذا كتابُ **جرحٍ وتعديلٍ وتاريخ**، وبوّابات هذا النوع موضوعةٌ على
  // كتب السِّيَر المُتعبِّدة («الحلية» و«صفة الصفوة»). فبناءُ الطبعة لا يضمن **نوع**
  // الخبر وإن ضمن حدَّه — والقاعدة أن ما دون اليقين يُسقَط.
  // والستّون في `../سير-أعلام-النبلاء-للمراجعة.md` ليُقضى فيها.
  'سير أعلام النبلاء': { id: 10906, edition: 'ط الرسالة (ترقيم موافق للمطبوع)', kind: 'quote', genre: 'biography', scholar_slug: 'al-dhahabi', harvest: false, channel: 'shamela' },
  'صفة الصفوة': { id: 12031, edition: 'ط دار الحديث (ترقيم موافق للمطبوع)', kind: 'quote', genre: 'biography', scholar_slug: 'ibn-al-jawzi', harvest: 'biography', channel: 'shamela' },
  'حلية الأولياء': { id: 10495, edition: 'ط السعادة (ترقيم موافق للمطبوع)', kind: 'quote', genre: 'biography', scholar_slug: 'abu-nuaym', harvest: 'biography', channel: 'shamela' },
  'الرسالة التبوكية': { id: 14211, edition: 'ضمن مجموع الرسائل — ط عطاءات العلم', kind: 'quote', scholar_slug: 'ibn-al-qayyim', harvest: 'sentence', channel: 'shamela' },

  // مجاميعُ موضوعية: كتابٌ يجمع مواقفَ العلماء وأقوالَهم في بابٍ واحد، فكلُّ
  // ما فيه في الموضوع. وآليّتُها `anthology` — وحدتُها الفقرة المطبوعة، لأن
  // `biography` تشترط «كان فلانٌ…» فأعطت صفراً، و`sentence` تردّ كلَّ منقولٍ
  // وهذه الكتب كلُّها نقل. و**لا تدخل البذرة آلياً**: النصُّ فيها منقولٌ عن
  // غير مؤلّفه، فنسبتُه قرارٌ لصاحب المشروع (انظر «النسبة في المجاميع»).
  'قيمة الزمن عند العلماء': { id: 96882, edition: 'ط الشاملة', kind: 'quote', genre: 'anthology', topic: 'الحرص على الوقت', harvest: 'anthology', channel: 'shamela' },
  'علو الهمة': { id: 96278, edition: 'ط الشاملة', kind: 'quote', genre: 'anthology', topic: 'علو الهمة', harvest: 'anthology', channel: 'shamela' },
};

/** اسم الكتاب الذي يُعرض تحت الحديث. */
export const COLLECTION_BOOK = { bukhari: 'صحيح البخاري', muslim: 'صحيح مسلم' };

/** عددٌ صحيح موجب من قيمةٍ قد تكون نصاً أو فارغة، وإلا null. */
export const positiveInt = (value) => {
  const n = Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ─────────────── تطبيع النص العربي ───────────────
// تطبيعان مقصودان:
//   • `plain` — يُزيل التشكيل والترقيم وحده. هذا ما يُرسل إلى محرّك بحث «تراث»،
//     لأنه يطابق رسم الهمزات والتاء المربوطة، فتوحيدها يُفقِد النتائج.
//   • `loose` — يوحّد فوق ذلك الهمزات والألف المقصورة والتاء المربوطة. للمقارنة
//     وحدها، لأن رسم البذرة قد يختلف عن رسم المطبوع في هذه الحروف.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function plain(text) {
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(DIACRITICS, '')
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loose(word) {
  const out = word
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ء/g, '');
  return out === '' ? word : out;
}

/** يقطّع النص مرة واحدة إلى كلمتين متوازيتين: المعروضة، والمقارَن بها. */
export function tokenize(text) {
  const shown = plain(text).split(' ').filter(Boolean);
  return { shown, keys: shown.map(loose) };
}

/** بصمة نصّ للمقارنة والتخلّص من التكرار. */
export const fingerprint = (text) => tokenize(text).keys.join(' ');

/**
 * يوقِع نصّ العنصر على نصّ الصفحة ويعيد مقياسين:
 *   • `anchor`   أطول سلسلة كلمات متّصلة مشتركة — تُثبت أن هذه هي الفقرة نفسها.
 *   • `coverage` نسبة كلمات العنصر الموجودة في محيط تلك السلسلة — تكشف اختلاف
 *     كلمةٍ أو كلمتين في الرسم بلا أن يُهدر التطابق كلّه.
 * ويعيد موضع السلسلة ليُعرَض نصّ المطبوع بحذاء نصّ البذرة عند الاختلاف.
 */
export function alignToPage(item, page) {
  let best = { anchor: 0, coverage: 0, pageStart: 0, pageEnd: 0 };
  for (let i = 0; i < item.keys.length; i++) {
    for (let j = 0; j < page.keys.length; j++) {
      if (page.keys[j] !== item.keys[i]) continue;
      let len = 0;
      while (
        i + len < item.keys.length &&
        j + len < page.keys.length &&
        item.keys[i + len] === page.keys[j + len]
      ) {
        len += 1;
      }
      if (len > best.anchor) best = { anchor: len, coverage: 0, pageStart: j, pageEnd: j + len };
    }
  }
  if (best.anchor === 0) return best;

  // المحيط: طول العنصر قبل السلسلة وبعدها، فيكفي لاحتواء الفقرة كاملة.
  const span = item.keys.length;
  const region = page.keys.slice(
    Math.max(0, best.pageStart - span),
    Math.min(page.keys.length, best.pageEnd + span),
  );
  const pool = new Map();
  for (const key of region) pool.set(key, (pool.get(key) ?? 0) + 1);
  let found = 0;
  for (const key of item.keys) {
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      found += 1;
    }
  }
  best.coverage = found / item.keys.length;
  return best;
}

/** مقطع من المطبوع حول موضع التطابق، ليُرى الفرق بالعين. */
export function excerpt(page, match, pad = 4) {
  const from = Math.max(0, match.pageStart - pad);
  const to = Math.min(page.shown.length, match.pageEnd + pad + 8);
  return `${from > 0 ? '…' : ''}${page.shown.slice(from, to).join(' ')}${to < page.shown.length ? '…' : ''}`;
}

// ─────────────── العميل ───────────────
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// حدّ «تراث» على البحث أضيقُ منه على جلب الصفحات، ويطول أثره بعد جولةٍ مكثّفة.
// `TURATH_GAP_MS` و`TURATH_COOLDOWN_MS` يُبطئان الأداة عند الحاجة بلا تعديل شفرة.
const REQUEST_GAP = positiveInt(process.env.TURATH_GAP_MS) ?? 1500;
const COOLDOWN = positiveInt(process.env.TURATH_COOLDOWN_MS) ?? 25000;
const EMPTY_STREAK_LIMIT = 2;

export const stats = { requests: 0, cooldowns: 0 };
let emptyStreak = 0;

async function request(path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      stats.requests += 1;
      const res = await fetch(`${API}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw new Error(`تعذّر الاتصال بتراث: ${e.message}`);
      await sleep(attempt * 1200);
    }
  }
  return null;
}

/**
 * يطلب من «تراث» ويفرّق بين «لا نتائج» و«تجاوزنا حدّ الطلبات».
 * `isEmpty` يحدّده المتصل، لأن شكل الفراغ يختلف بين البحث وجلب الصفحة.
 */
async function guarded(path, isEmpty) {
  let data = await request(path);
  await sleep(REQUEST_GAP);

  if (!isEmpty(data)) {
    emptyStreak = 0;
    return data;
  }

  emptyStreak += 1;
  if (emptyStreak < EMPTY_STREAK_LIMIT) return data;

  stats.cooldowns += 1;
  emptyStreak = 0;
  console.log(`    … «تراث» يُرجع فراغاً متتابعاً — انتظار ${COOLDOWN / 1000} ثانية ثم إعادة المحاولة.`);
  await sleep(COOLDOWN);
  data = await request(path);
  await sleep(REQUEST_GAP);
  return data;
}

const parseRows = (data) => {
  const rows = [];
  for (const row of data?.data ?? []) {
    try {
      rows.push({ ...row, meta: JSON.parse(row.meta) });
    } catch {
      // صفٌّ بلا meta صالحة لا يصلح مرجعاً — يُهمَل.
    }
  }
  return rows;
};

/**
 * يبحث عن عبارة داخل كتاب واحد — أو في كل الكتب إن لم يُمرَّر مُعرّف.
 * `resultPage` صفحة النتائج (عشرون في كل صفحة)، لا صفحة في الكتاب.
 */
export async function searchInBook(phrase, bookId, resultPage) {
  const scope = bookId ? `&book=${bookId}` : '';
  const paging = resultPage && resultPage > 1 ? `&page=${resultPage}` : '';
  const path = `/search?q=${encodeURIComponent(phrase)}${scope}${paging}`;
  return parseRows(await guarded(path, (d) => !d?.data?.length));
}

/**
 * يجلب صفحة بمُعرّفها الداخلي في «تراث» (`page_id`).
 * يعيد null عند نهاية الكتاب — وقد سبقَها تمهّلٌ يميّزها من حدّ الطلبات.
 *
 * `expectEmpty` يُعطَّل به ذلك التمهّل، لمن يقصد تحسّس نهاية الكتاب: الفراغ
 * عنده نتيجةٌ مطلوبة لا علامةُ حدّ، فانتظارُه عبثٌ يُبطئ العمل دقائق.
 */
export async function fetchPage(bookId, pageId, { expectEmpty = false } = {}) {
  const path = `/page?book_id=${bookId}&pg=${pageId}`;
  if (expectEmpty) {
    const probe = await request(path);
    await sleep(REQUEST_GAP);
    if (!probe?.text) return null;
    try {
      return { text: probe.text, meta: JSON.parse(probe.meta), pageId };
    } catch {
      return null;
    }
  }
  const data = await guarded(path, (d) => !d?.text);
  if (!data?.text) return null;
  let meta = {};
  try {
    meta = JSON.parse(data.meta);
  } catch {
    return null;
  }
  return { text: data.text, meta, pageId };
}

/** رابط الصفحة في «تراث» كما يفتحها التطبيق. */
export const pageUrl = (bookId, pageId) => `${APP}/book/${bookId}${pageId ? `/${pageId}` : ''}`;

/**
 * `null` من `fetchPage` **ليس قاطعاً** هنا: «تراث» يحدّ الطلبات بصفحةٍ فارغة بلا
 * رسالة خطأ، فالفراغ يُحتمل أنه الحدّ. فمن يقرأ منه يلزمه شاهدٌ قبل الحكم بنهاية
 * الكتاب (`confirmBookEnd`). وهذا بخلاف «الشاملة» — انظر `lib/shamela.mjs`.
 */
export const endIsDefinite = false;

/** اسمُ القناة كما يُعرَض، ومُعرّفُ مصدرها في البذرة. */
export const label = 'تراث';
export const slug = 'turath';
