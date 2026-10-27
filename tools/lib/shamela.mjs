/**
 * طبقة الاتصال بـ«المكتبة الشاملة» — بواجهة `turath.mjs` نفسها.
 * بلا تبعيات: node وحده. وطبقةُ النصّ العربي تُستورد من `turath.mjs` ولا تُكرَّر.
 *
 * ── لِمَ قناةٌ ثانية ──
 * «الشاملة» أصلُ «تراث» لا بديلٌ عنه: مُعرّفات الكتب والصفحات الداخلية ونصُّها
 * متطابقة، وكتبُ `BOOKS` كلُّها موجودة بالطبعة نفسها وبالمُعرّف نفسه. وقد تُحقِّق
 * من أن **رقم المطبوع لنفس النصّ متطابقٌ في القناتين**، فمراجعُ البذرة القائمة
 * تبقى صحيحة. ويختلف المُعرّف الداخلي في بعض الكتب («الحلية» بأربع صفحاتٍ في
 * مجلداتها ٨–١٠)، فمؤشّر `harvest-state.json` خاصٌّ بالقناة ويُعاد ضبطه عند النقل.
 *
 * ── ما تحسم فيه «الشاملة» ──
 * **الفراغ لا يلتبس بحدّ الطلبات**، وهو ما كلّف المشروع خطأين مُثبتين في
 * `CLAUDE.md`: نهايةُ الكتاب تخرج **404**، وحدُّ الطلبات يخرج **429/5xx** فيُرمى
 * استثناءً ولا يُترجَم فراغاً أبداً. ولذلك `endIsDefinite = true`: من يقرأ
 * `null` من هذه القناة فقد عَلِم أنه لا صفحة، لا أنه محدود.
 *
 * ولم يظهر لها حدٌّ عملي: ٢٠٠ طلبٍ بلا فجوةٍ بتةً نجحت كلُّها (٤ طلبات/ث).
 * والفجوة هنا تأدُّبٌ لا ضرورة، و`SHAMELA_GAP_MS` يُبطئها.
 *
 * ── ما لا يُنقل إليها ──
 * **وسم الحديث.** «تراث» يضع وسماً دلالياً مُرقَّماً `<hadeeth-45>` ورقمُه يَلحم
 * المتن المتقطّع على حدّ الصفحة المطبوعة، و«الشاملة» تضع `<span class="c2">` وهو
 * وسمُ تنسيقٍ يظهر في كتب النثر حيث لا حديثَ بتةً (أربع مراتٍ في صفحةٍ من
 * «الحلية»، وخمساً في «المدارج»). فلا يصلح بوّابةً، وآليّة `hadeeth` تبقى على
 * «تراث». والبحث النصّي كذلك: `/ajax/search` لا يُستجاب لطلبٍ برمجي.
 */
import { fingerprint, positiveInt, sleep } from './turath.mjs';

const BASE = 'https://shamela.ws';
export const APP = BASE;

/**
 * متصفّحٌ معلَن: الموقع خلف Cloudflare، وطلبٌ بلا ترويسةٍ معروفة يُردّ.
 * ولا تُزاد ترويسةٌ لتَنكُّرٍ — جلبُ الصفحات مُستجابٌ بهذه وحدها.
 */
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  accept: 'application/json, text/html;q=0.9',
};

const GAP = positiveInt(process.env.SHAMELA_GAP_MS) ?? 250;

export const stats = { requests: 0, retries: 0 };

/**
 * `null` من هذه القناة يعني **لا صفحة بهذا المُعرّف** ولا شيء غيره.
 * فحدُّ الطلبات (429) وخللُ الخادم (5xx) يُرميان استثناءً بعد إعادة المحاولة،
 * ولا يُترجَمان فراغاً — وهذا الفرق هو ما تُشترى به هذه القناة.
 */
const ATTEMPTS = 6;

async function request(path) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    stats.requests += 1;
    let res;
    try {
      res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      // انقطاعٌ على مستوى الشبكة (`fetch failed`) يدوم ثوانيَ غالباً، ومسحُ
      // كتابٍ ذي أربعةَ عشرَ ألفَ صفحةٍ يمرّ به لا بدّ. فالتمهُّلُ أطولُ هنا
      // منه في الحدّ: ٤ ثوانٍ تتضاعف إلى نحو دقيقةٍ في آخر محاولة.
      if (attempt === ATTEMPTS) throw new Error(`تعذّر الاتصال بـ«الشاملة»: ${e.message}`);
      stats.retries += 1;
      await sleep(attempt * 4000);
      continue;
    }

    if (res.status === 404) {
      await sleep(GAP);
      return null; // لا صفحة بهذا المُعرّف — جوابٌ قاطع.
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === ATTEMPTS) {
        throw new Error(
          `«الشاملة» تحدّ الطلبات (HTTP ${res.status}) — أبطئها بـ SHAMELA_GAP_MS ثم أعِد التشغيل.`,
        );
      }
      stats.retries += 1;
      await sleep(attempt * 5000);
      continue;
    }
    if (!res.ok) throw new Error(`«الشاملة» أرجعت HTTP ${res.status} للمسار ${path}`);

    const body = await res.text();
    await sleep(GAP);
    return body;
  }
  return null;
}

// ─────────────── تحويل نصّ الصفحة إلى شكل «تراث» ───────────────
// البوّابات في `extract.mjs` و`adopt.mjs` مكتوبةٌ على شكل «تراث» ومُختبَرةٌ عليه،
// فلا تُمسّ: يُحوَّل النصّ إليه هنا. وأربعةُ فروقٍ لا بدّ من ردّها، وإلّا انكسرت
// البوّابات بلا أن تُخطئ:
//
//   ١) «تراث» يحجز `<span>` **للعناوين** (`<span data-type="title">`)، و`cleanPage`
//      يترجم كل span عنواناً. و«الشاملة» تستعمله للتنسيق (c2 وc5 وc4 وspecial)،
//      فلو بقي لحُسبت كل عبارةٍ مُبرَزةٍ عنواناً — وهي بالعشرات في الصفحة.
//   ٢) رابط الراوي: `shamela.ws/narrator/N` مقابل `inr://man-N`.
//   ٣) الحواشي: «الشاملة» تفصلها بنياناً (`<hr><p class="hamesh">`) و«تراث»
//      بفاصل `___`. والفاصل هو ما يعرفه `cleanPage`.
//   ٤) علامة الحاشية في المتن: `(١)` مقابل `(^١)` — و`tidy` يُسقط الثانية وحدها،
//      فلو بقيت الأولى لظهرت في الإشعار.

/** الوسمُ يُستهلك كلُّه حتى `>`، وإلّا بقي ذَنَبُه («>"») في أوّل الحواشي. */
const FOOTNOTE_SPLIT = /<hr\s*\/?>|<p[^>]*class="[^"]*hamesh[^>]*>/i;

/**
 * يحوّل `nass` إلى نصّ صفحةٍ بشكل «تراث».
 * و`title` حاشيةُ بيانٍ من «الشاملة» لا من الصفحة، فلا يُحشر في النص — إلّا أن
 * يكون العنوان مطبوعاً في الصفحة فعلاً (سطرٌ كلُّه هو)، فيُوسَم كما يوسمه «تراث».
 */
export function toPageText(nass, title = null) {
  const [body, ...rest] = String(nass ?? '').split(FOOTNOTE_SPLIT);

  let text = body
    // مرساةُ الفقرة وزرُّ نسخها من جهاز الموقع لا من الصفحة المطبوعة.
    .replace(/<a\s[^>]*href="#np[^"]*"[\s\S]*?<\/a>/g, ' ')
    .replace(/<span[^>]*class="anchor"[^>]*>\s*<\/span>/g, ' ')
    // رابط الراوي يأخذ شكل «تراث» فيفكّه `cleanPage` كما يفكّه هناك.
    .replace(/<a\s[^>]*href="https?:\/\/shamela\.ws\/narrator\/(\d+)"[^>]*>/g, '<a href="inr://man-$1">')
    // وسوم التنسيق تُفكّ إلى نصّها — لا تُترك فتُحسب عناوين.
    .replace(/<\/?span[^>]*>/g, '')
    // الفقرة سطرٌ، كما يفصلها «تراث».
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/\r/g, '')
    // علامة الحاشية بشكل «تراث» ليُسقطها `tidy`.
    .replace(/\(([٠-٩]+)\)/g, '(^$1)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  // العنوان المطبوع في الصفحة يُوسَم وسمَ «تراث»، فتُعرَف حدوده كما تُعرف هناك.
  // والمقارنة ببصمة النص، فاختلاف رسم الألف المقصورة لا يُفلته: «الزجاجى» في
  // بيان «الشاملة» و«الزجاجي» في نصّ الصفحة.
  if (title) {
    const want = fingerprint(title);
    if (want) {
      text = text
        .split('\n')
        .map((line) => (fingerprint(line) === want ? `<span data-type="title">${line}</span>` : line))
        .join('\n');
    }
  }

  // الحواشي تُلحق بفاصل «تراث»، فيُسقطها `cleanPage` إسقاطَها هناك.
  if (rest.length > 0) {
    const notes = rest
      .join(' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (notes) text += `\n___\n${notes}`;
  }

  return text;
}

/**
 * المجلّد كما يسمّيه «تراث».
 * «الشاملة» تسمّي مجلّدَ الكتاب الواحد «الكتاب» و«تراث» يسمّيه «1»، فلو تُرك
 * لسقطت كتبٌ كاملة ببوّابة «مجلّدٌ غير مرقَّم» («الفوائد» و«الوابل الصيب» منها)
 * — وهي بوّابةُ مقدّمةِ المحقّق، لا بوّابةُ كتابٍ في مجلّد. و«المقدمة» تُترك
 * كما هي، فهي في القناتين سواء.
 */
export const toVolume = (part) => (String(part ?? '').trim() === 'الكتاب' ? '1' : part);

/**
 * يجلب صفحة بمُعرّفها الداخلي، ويعيدها بشكل `turath.fetchPage` نفسه.
 * `null` تعني **لا صفحة بهذا المُعرّف** — قاطعةً، لا حدَّ طلبات.
 *
 * `expectEmpty` مقبولٌ للتوافق ومُهمَل: لا تمهُّلَ هنا يُوفَّر، فالفراغ جوابٌ
 * قاطع من الطلب الأول.
 */
export async function fetchPage(bookId, pageId, { expectEmpty: _expectEmpty = false } = {}) {
  const body = await request(`/ajax/pageContent/${bookId}/${pageId}`);
  if (body == null) return null;

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data?.nass) return null;

  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
  return {
    text: toPageText(data.nass, title),
    meta: {
      // «الشاملة» تذكر الموضع في **كل** صفحة، و«تراث» لا يذكره إلا في صفحة
      // ابتدائه — فما كان يُحمل بين الصفحات يصير معلوماً عن كل صفحة.
      headings: title ? [title] : [],
      page: positiveInt(data.pageNum),
      vol: toVolume(data.part),
      page_id: positiveInt(data.pageId) ?? pageId,
    },
    pageId,
    /** آخرُ صفحةٍ في الكتاب `nextId === null` — نهايةٌ مُعلَنة لا مُستنبطة. */
    nextId: positiveInt(data.nextId),
  };
}

/**
 * آخر صفحة داخلية في الكتاب — مضاعفةٌ ثم تنصيف.
 * والنتيجة قاطعةٌ لأن غير الموجود يخرج 404، فلا تُقدَّر بـ`bookSize` ظنّاً.
 * (و`harvest-state.json` كان يسجّل لـ«الحلية» ٣٨٩٥ نقلاً عن «تراث»، وهي ٣٨٩١.)
 */
export async function bookSize(bookId, limit = 40000) {
  const exists = async (pageId) => (await fetchPage(bookId, pageId)) != null;

  let known = 0;
  let probe = 64;
  while (probe <= limit && (await exists(probe))) {
    known = probe;
    probe *= 2;
  }
  let low = known;
  let high = Math.min(probe, limit);
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (await exists(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * مُعرّفُ صفحةٍ من نقاط العكس (`pagenum2id` و`specialnumber2id`).
 * و«الشاملة» تُعلِم بعدم الوجود بـ **`-1`** — ولا يُمرَّر على `positiveInt`، فهو
 * يُسقط الإشارة فيصير «-1» صفحةً رقمها ١، وهي أوّل الكتاب: فيُقرأ موضعٌ غيرُ
 * الذي طُلب ويُنسب إليه مرجعٌ كاذب.
 */
export const pageRef = (body) => {
  const raw = String(body ?? '').trim();
  if (!/^\d+$/.test(raw)) return null; // '-1' أو صفحةُ خطأٍ أو فراغ
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * صفحةُ حديثٍ برقمه — طلبٌ واحد.
 * و«تراث» يلزمه بحثٌ ثنائي بعشرات الطلبات (`locate.findHadithPage`).
 */
export async function findHadithPage(bookId, number) {
  return pageRef(await request(`/ajax/specialnumber2id/${bookId}/${number}`));
}

/**
 * الصفحة الداخلية لصفحةٍ مطبوعة في مجلّدٍ بعينه — طلبٌ واحد.
 *
 * ورقمُ المجلّد في هذه النقطة **صفرٌ للكتاب الواحد**: «الشاملة» تسمّي مجلّده
 * «الكتاب» لا «1»، فطلبُ المجلّد الأول فيه يرجع `-1`. فيُجرَّب رقمُ المجلّد ثم
 * يُعاد بصفر. ولا يُبدأ بالصفر: في الكتاب ذي المجلدات يعني «أوّل موضعٍ بهذا
 * الرقم في الكتاب كلّه» فيُخطئ المجلّد (ص٣٨٣ في «المدارج»: بالمجلّد ١١١٤، وبالصفر ٥٠٦).
 */
export async function locatePrintedPage(bookId, volume, page) {
  const part = positiveInt(volume);
  if (part) {
    const hit = pageRef(await request(`/ajax/pagenum2id/${bookId}/${part}/${page}`));
    if (hit) return hit;
  }
  return pageRef(await request(`/ajax/pagenum2id/${bookId}/0/${page}`));
}

/**
 * أبناءُ عقدةٍ في فهرس الكتاب، ومعهم صفحاتُهم الداخلية.
 * `parentId = 0` جذرُ الفهرس. وبه تُعرف أبواب «الفضائل» تحت كتبها إحصاءً.
 */
export async function chapterTree(bookId, parentId = 0) {
  const body = await request(`/ajax/titlechilds/${bookId}/${parentId}`);
  if (!body) return [];
  const out = [];
  for (const row of String(body).split('<li')) {
    const link = row.match(/href="[^"]*\/book\/\d+\/(\d+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const title = link[2].replace(/<[^>]*>/g, '').trim();
    if (!title) continue;
    out.push({
      title,
      pageId: positiveInt(link[1]),
      id: positiveInt(row.match(/data-id="(\d+)"/)?.[1]) ?? null,
    });
  }
  return out;
}

/** رابط الصفحة في «الشاملة» كما يفتحها الموقع. */
export const pageUrl = (bookId, pageId) => `${BASE}/book/${bookId}${pageId ? `/${pageId}` : ''}`;

/**
 * `null` من `fetchPage` جوابٌ قاطع لا يُحتمل أنه حدُّ طلبات.
 * فمن يقرأ منها لا يحتاج شاهداً على نهاية الكتاب (`confirmBookEnd`).
 */
export const endIsDefinite = true;

/** اسمُ القناة كما يُعرَض، ومُعرّفُ مصدرها في البذرة. */
export const label = 'الشاملة';
export const slug = 'shamela';
