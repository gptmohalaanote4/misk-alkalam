/**
 * اعتماد النصّ **كما طُبع**.
 *
 * نصوص البذرة الأولى كُتبت نقلاً، فجاء بعضها مختصَراً أو مجموعاً من موضعين أو
 * بلفظٍ يخالف الطبعة. ولا يصحّ أن يُذيَّل نصٌّ بمرجعٍ لا يوافقه، كما لا يصحّ أن
 * يُصحَّح النصّ بالتأليف. فالحلّ أن يُؤخذ النصّ من الصفحة نفسها حرفاً بحرف.
 *
 * **كل حرفٍ يخرج من هنا مأخوذٌ من صفحة «تراث»**؛ لا تُضاف كلمة ولا تُحذف. ولا
 * يُغيَّر إلا تجميع المسافات في سطرٍ واحد، فذاك تنسيقٌ لا نصّ.
 *
 * وحدود الفقرة تُؤخذ من المطبوع لا تُقدَّر:
 *   • الحديث     → وسم `<hadeeth>` إن وُجد، فهو حدٌّ يقيني للمتن.
 *   • المنقّط     → النقطة «•» تفصل الفائدة عمّا قبلها وبعدها.
 *   • ما عداهما  → الجملة المطبوعة: من بعد علامة ختامٍ إلى علامة ختام.
 */
import { loose, plain } from './turath.mjs';
import { MAX_CHARS, hasRejected, isComplete } from './extract.mjs';

/** علامات ختام الجملة في المطبوع. */
const SENTENCE_END = /[.؟!]/;
/**
 * ألفاظ الإسناد وحكاية الراوي. وجودها في متنٍ يُعرض على أنه كلام النبي ﷺ دليلُ
 * أن الحدّ أخطأ موضعه، فيُسقط المأخوذ ولا يُنقّح.
 */
const ISNAD_WORDS = /سَمِعْتُ|سمعت|حَدَّثَنَا|حدثنا|حَدَّثَنِي|حدثني|أَخْبَرَنَا|أخبرنا|أَخْبَرَنِي|أخبرني|حَسِبْتُ|حسبت/;
/** الوسم الذي يحيط بالكلام المنقول، بقطعه إن تقطّع عند حدّ صفحة. */
const HADEETH_PIECE = /<hadeeth-(\d+)>([\s\S]*?)<hadeeth>/g;
const PAGE_BREAK = /⦗[^⦘]*⦘/g;
const HADITH_NUMBER = /(^|\n)\s*([٠-٩]+)\s*-\s/g;
const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const toLatinDigits = (text) => text.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit]);

/**
 * يُجرّد الصفحة من الوسوم والحواشي **مع إبقاء التشكيل وعلامات الترقيم**،
 * لأن المأخوذ منها يُنقل حرفياً.
 */
export function pageBody(raw) {
  return String(raw)
    .split(/\n_{3,}/)[0] // ما بعد فاصل الحواشي ليس من المتن
    .replace(/<a\s[^>]*>([\s\S]*?)<\/a>/g, '$1') // رابط اسم الراوي → اسمه
    .replace(/<[^>]*>/g, ' ')
    .replace(PAGE_BREAK, ' ')
    // علامة الحاشية «(^١)» من جهاز المحقّق لا من كلام المؤلف، فحذفها لا يمسّ النص.
    .replace(/\(\^[^)]*\)/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}

/** الشكل المعروض: مسافات موحّدة في سطر واحد، بلا مساسٍ بالحروف. */
const flatten = (text) =>
  text
    .replace(/[«»]/g, '')
    .replace(/﵁|﵂|﵃|﵄|﵊|ﷺ/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([،؛:.!؟])/g, '$1')
    .trim();

/** يقطّع النص إلى كلمات، لكل كلمة موضعها في النص ومفتاحُ مقارنتها. */
export function tokenize(text) {
  const tokens = [];
  for (const match of text.matchAll(/\S+/g)) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      key: loose(plain(match[0])),
    });
  }
  return tokens;
}

/**
 * يوقِع كلمات النصّ المطلوب على كلمات الصفحة.
 * يعيد مدى الكلمات في الصفحة ومقياسَي الثقة، أو null إن لم يُوجد.
 */
export function locateSpan(seedText, pageTokens) {
  const seedKeys = tokenize(seedText)
    .map((t) => t.key)
    .filter(Boolean);
  if (seedKeys.length === 0) return null;

  let best = null;
  for (let i = 0; i < seedKeys.length; i++) {
    for (let j = 0; j < pageTokens.length; j++) {
      if (pageTokens[j].key !== seedKeys[i]) continue;
      let len = 0;
      while (
        i + len < seedKeys.length &&
        j + len < pageTokens.length &&
        seedKeys[i + len] === pageTokens[j + len].key
      ) {
        len += 1;
      }
      if (!best || len > best.anchor) best = { anchor: len, from: j, to: j + len };
    }
  }
  if (!best) return null;

  // المحيط: طول النص قبل السلسلة وبعدها، لقياس تغطية بقيّة كلماته.
  const span = seedKeys.length;
  const region = pageTokens
    .slice(Math.max(0, best.from - span), Math.min(pageTokens.length, best.to + span))
    .map((t) => t.key);
  const pool = new Map();
  for (const key of region) pool.set(key, (pool.get(key) ?? 0) + 1);
  let found = 0;
  for (const key of seedKeys) {
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      found += 1;
    }
  }
  return { ...best, coverage: found / seedKeys.length, words: seedKeys.length };
}

/** الفائدة المنقّطة المحيطة بالموضع: ما بين نقطتين. */
function bulletUnit(body, from, to) {
  const open = body.lastIndexOf('•', from);
  if (open === -1) return null;
  const next = body.indexOf('•', to);
  const close = next === -1 ? body.length : next;
  // نقطةٌ أخرى داخل المدى تعني أن الموضع يعبُر فائدتين، فلا وحدة تُؤخذ.
  if (body.slice(from, to).includes('•')) return null;
  return body.slice(open + 1, close);
}

/**
 * الكلام المنقول المحيط بالموضع: ما بين علامتَي تنصيص.
 * طبعاتٌ لا تَسِم المتن بوسم، لكنها تحصره بالتنصيص — وهو حدٌّ مطبوع لا مُقدَّر،
 * وبه يخرج الإسناد من المتن. («تراث» يكتبها «…» أو "…" بحسب الطبعة.)
 */
function quotedUnit(body, from, to) {
  for (const [open, close] of [['«', '»'], ['"', '"']]) {
    const start = body.lastIndexOf(open, from);
    if (start === -1) continue;
    const end = body.indexOf(close, to);
    if (end === -1) continue;
    // علامةُ ختامٍ أخرى بين الفتح وموضع التطابق تعني أننا خارج هذا الاقتباس.
    if (body.slice(start + 1, from).includes(close)) continue;
    // بعض الطبعات تضع نقطة الختام خارج التنصيص، وهي من المطبوع فتُضمّ.
    const after = body.slice(end + 1).match(/^\s*([.؟!])/);
    return body.slice(start + 1, end) + (after ? after[1] : '');
  }
  return null;
}

/**
 * الجملة المطبوعة المحيطة بالموضع: من بعد علامة ختامٍ إلى علامة ختام.
 *
 * ويُشترط أن يكون أوّلها في الصفحة لا عند حافّتها: الصفحة قد تبدأ في وسط جملةٍ
 * تمّ أوّلها في الصفحة السابقة، فلا يُعرف مبتدؤها — ولو أُخذت لبدأ النصّ
 * المعروض من وسط الكلام. وكذلك آخرها: جملةٌ لم تُختم في الصفحة لم تتمّ.
 */
function sentenceSpan(body, from, to) {
  let start = from;
  while (start > 0 && !SENTENCE_END.test(body[start - 1]) && body[start - 1] !== '•') start -= 1;
  if (start === 0 && !/^\s*[ء-ي]/.test(body)) return null;
  if (start === 0 && from > 0) return null; // الجملة تمتدّ إلى ما قبل الصفحة

  // البحث عن الختام يبدأ من آخر حرفٍ في المدى لا من بعده: الكلمة الأخيرة قد
  // تحمل علامة الختام نفسها («شهوته.»)، فلو بُدئ بعدها لعبَرت الجملةُ ما يليها.
  let end = Math.max(start, to - 1);
  while (end < body.length && !SENTENCE_END.test(body[end])) {
    if (body[end] === '•') return null; // عبَرنا إلى فائدةٍ أخرى
    end += 1;
  }
  if (end >= body.length) return null; // لم تُختم في هذه الصفحة
  return body.slice(start, end + 1); // علامة الختام من الجملة
}

/** متون الصفحة من وسم `<hadeeth>`، مع رقم كل متنٍ من إسناده. */
export function taggedMatns(rawPage) {
  const out = [];
  const groups = [];
  for (const match of String(rawPage).matchAll(HADEETH_PIECE)) {
    const [, id, piece] = match;
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.body += ` ${piece}`;
    else groups.push({ id, index: match.index, body: piece });
  }
  for (const group of groups) {
    const isnad = String(rawPage).slice(0, group.index);
    const numbers = [...isnad.matchAll(HADITH_NUMBER)];
    const marker = numbers[numbers.length - 1];
    out.push({
      number: marker ? Number.parseInt(toLatinDigits(marker[2]), 10) : null,
      text: flatten(group.body.replace(PAGE_BREAK, ' ')),
    });
  }
  return out;
}

/**
 * يأخذ من الصفحة النصَّ الذي يوافق نصّ البذرة، **كما طُبع**.
 *
 * `number` — رقم الحديث إن كان المطلوب حديثاً، فيُقدَّم الوسم على غيره.
 * يعيد null إن لم يبلغ التطابقُ الحدَّ، أو إن لم يصلح المأخوذ للعرض.
 */
export function adoptFromPage(
  rawPage,
  seedText,
  { number = null, minAnchor = 5, minCoverage = 0.6, minChars = 36 } = {},
) {
  const body = pageBody(rawPage);
  // حدّ الطول هنا أدنى من حدّ الحصد: الاكتمال مضمونٌ بالحدّ المطبوع نفسه، فلا
  // حاجة إلى طولٍ يحتاط به من الاقتطاع — وفوائدُ المؤلف فيها القصيرُ التامّ.
  const acceptable = (text) =>
    isComplete(text) && text.length >= minChars && text.length <= MAX_CHARS && !hasRejected(text);

  // ١) الحديث الموسوم: الوسم حدٌّ يقيني للمتن، فلا يُقدَّر له حدّ.
  if (number != null) {
    const tagged = taggedMatns(rawPage).find((m) => m.number === number);
    // الوسم قد يشمل حكاية الراوي ومقدّمته، فلا يُؤخذ على علّاته: ما خالط
    // المتنَ لفظُ إسنادٍ لا يصلح أن يُعرض على أنه كلام النبي ﷺ.
    if (tagged && acceptable(tagged.text) && !ISNAD_WORDS.test(tagged.text)) {
      const check = locateSpan(seedText, tokenize(tagged.text));
      if (check && check.anchor >= minAnchor) {
        return { text: tagged.text, source: 'وسم المتن', anchor: check.anchor, words: check.words };
      }
    }
  }

  const tokens = tokenize(body);
  const span = locateSpan(seedText, tokens);
  if (!span || span.anchor < minAnchor || span.coverage < minCoverage) return null;

  const from = tokens[span.from].start;
  const to = tokens[span.to - 1].end;

  /**
   * حدود المتن للحديث: الوسم، أو التنصيص — ولا شيء غيرهما.
   * حدُّ الجملة لا يفصل المتن عن إسناده (الإسناد لا تتخلّله نقطة)، فلو جاز
   * للحديث لنُسب إلى النبي ﷺ كلامُ راويه. وما لم يُحَدّ بأحدهما يُترك.
   */
  const candidates =
    number != null
      ? [['وسم المتن أو تنصيصه', quotedUnit(body, from, to)]]
      : [
          ['نقطة الفائدة', bulletUnit(body, from, to)],
          ['الجملة المطبوعة', sentenceSpan(body, from, to)],
        ];

  for (const [source, raw] of candidates) {
    if (!raw) continue;
    const text = flatten(raw);
    if (!acceptable(text)) continue;
    // أدوات الإسناد لا تكون في متنٍ يُعرض على أنه كلام النبي ﷺ.
    if (number != null && ISNAD_WORDS.test(text)) continue;
    // المأخوذ يجب أن يشمل موضع التطابق نفسه، وإلا فهو جملةٌ أخرى.
    const covers = locateSpan(seedText, tokenize(text));
    if (!covers || covers.anchor < minAnchor) continue;
    return { text, source, anchor: span.anchor, coverage: span.coverage, words: span.words };
  }
  return null;
}
