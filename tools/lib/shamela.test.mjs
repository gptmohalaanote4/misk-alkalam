import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageRef, toPageText, toVolume } from './shamela.mjs';
import { cleanPage, extractBulleted, tidy } from './extract.mjs';

/**
 * نصوصٌ منقولةٌ من «الشاملة» كما تردُ، لا مُصاغةٌ هنا — فهي التي تُختبر.
 * والبوّابات في `extract.mjs` مكتوبةٌ على شكل «تراث»، فالمطلوب من `toPageText`
 * أن تمرّ عليها كما يمرّ نصُّ «تراث»: وهذا ما تُثبته هذه الاختبارات.
 */
const through = (nass, title = null) => tidy(cleanPage(toPageText(nass, title)));

/** صحيح البخاري ١٦٨١/١٠٠ — رابط راوٍ، و«special» داخل الكلام، و«c2» على المتن. */
const BUKHARI = `<p><span id="np100_1" class="anchor"></span>٥٢ - حَدَّثَنَا <a href="https://shamela.ws/narrator/5093">أَبُو نُعَيْمٍ، </a>قَالَ: سَمِعْتُ رَسُولَ اللهِ <span class="special">ﷺ</span> يَقُولُ: <span class="c2">«الْحَلَالُ بَيِّنٌ وَالْحَرَامُ بَيِّنٌ»</span>.<a href="#np100_1" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p>`;

/** مدارج السالكين ١٩٩/٥٠٠ — علامةُ حاشيةٍ في المتن، والحواشي بعد «hr». */
const WITH_NOTES = `<p><span class="anchor" id="np500_1"></span>سببًا لهما (١)، ولا لها عللٌ غائيّةٌ هي مفضيةٌ إليها.<a href="#np500_1" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p><hr><p class="hamesh">(١) ج: "لها".<br />\r(٢) ع: "والأمزجة والأغذية".</p>`;

/** الفوائد ٢١٢/١٥٠ — كل فائدةٍ فقرةٌ، وبعضُها داخل «c5». */
const BULLETS = `<p><span class="anchor" id="np150_1"></span><span class="c5">• قسوةُ القلب من أربعة أشياء إذا جاوزتْ قدرَ الحاجة: الأكل، والنوم، والكلام، والمخالطة.</span><a href="#np150_1" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p><p><span class="anchor" id="np150_2"></span>• القلوب المتعلقةُ بالشهوات محجوبةٌ عن الله بقدر تعلُّقها بها.<a href="#np150_2" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p>`;

/** حلية الأولياء ١٠٤٩٥/٣٨٥٨ — ترجمةٌ تبدأ في وسط الصفحة، بلا وسمٍ يميّزها. */
const HEADING_PAGE = `<p><span class="anchor" id="np3858_1"></span>فطابت الدنيا بذكر الخروج منها وطابت الجنة بذكر الخلود فيها.<a href="#np3858_1" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p><p><span class="anchor" id="np3858_2"></span>أبو عمرو الزجاجي<a href="#np3858_2" class="btn_tag btn btn-sm"><span class="text-gray fa fa-copy"></span></a></p>`;

// ─────────────── وسوم التنسيق ───────────────

test('وسمُ التنسيق لا يصير عنواناً', () => {
  // «تراث» يحجز <span> للعناوين، و`cleanPage` يترجم كل span عنواناً فيُحذف متنُه
  // من الاستخراج. و«الشاملة» تستعمله للإبراز (c2 وc5)، فلو بقي لضاع المتن.
  const out = toPageText(BUKHARI);
  assert.ok(!out.includes('<span'), `بقي وسمُ span: ${out}`);
  assert.match(through(BUKHARI), /الْحَلَالُ بَيِّنٌ وَالْحَرَامُ بَيِّنٌ/);
});

test('«special» المتداخل في «c5» يخرج نصّاً لا وسماً', () => {
  const nested = `<p><span class="c5">وسئل عن قول النبي <span class="special">ﷺ</span>:</span> فقال: سيفه الله.</p>`;
  const out = toPageText(nested);
  assert.ok(!out.includes('<span'), out);
  assert.ok(!out.includes('</span>'), out);
  assert.match(out, /وسئل عن قول النبي ﷺ: فقال: سيفه الله\./);
});

test('مرساةُ الفقرة وزرُّ نسخها يُحذفان', () => {
  const out = toPageText(BUKHARI);
  assert.ok(!out.includes('np100_1'), out);
  assert.ok(!out.includes('fa-copy'), out);
});

test('رابط الراوي يأخذ شكل «تراث» فيُفكّ إلى اسمه', () => {
  // `cleanPage` يفكّ <a> إلى نصّه، فالشكل هو ما يضمن أن يُفكّ كما يُفكّ هناك.
  assert.match(toPageText(BUKHARI), /<a href="inr:\/\/man-5093">/);
  const out = through(BUKHARI);
  assert.match(out, /حَدَّثَنَا أَبُو نُعَيْمٍ،/);
  assert.ok(!out.includes('shamela.ws'), out);
});

// ─────────────── الحواشي ───────────────

test('الحواشي تُقطع بفاصل «تراث» فيُسقطها cleanPage', () => {
  const out = toPageText(WITH_NOTES);
  assert.ok(out.includes('\n___\n'), out);
  const body = through(WITH_NOTES);
  assert.ok(!body.includes('والأمزجة'), `حاشيةٌ تسرّبت إلى المتن: ${body}`);
});

test('ذَنَبُ وسم الحواشي لا يبقى في أوّلها', () => {
  // الفصلُ كان يقع وسط الوسم فيبقى «>"» في صدر الحواشي.
  assert.ok(!toPageText(WITH_NOTES).includes('">('), toPageText(WITH_NOTES));
});

test('علامةُ الحاشية في المتن تأخذ شكل «تراث» فيُسقطها tidy', () => {
  // «الشاملة» تكتبها «(١)» و«تراث» «(^١)»، و`tidy` يُسقط الثانية وحدها —
  // فلو تُركت لظهرت في الإشعار: «سببًا لهما (١)».
  assert.match(toPageText(WITH_NOTES), /\(\^١\)/);
  const body = through(WITH_NOTES);
  assert.ok(!/\(\^?١\)/.test(body), body);
  assert.match(body, /^سببًا لهما، ولا لها/);
});

// ─────────────── الفقرات والنقاط ───────────────

test('الفقرةُ سطرٌ، فالفائدتان تُستخرجان فائدتين', () => {
  const items = extractBulleted(toPageText(BULLETS));
  assert.equal(items.length, 2);
  assert.match(items[0], /^قسوةُ القلب من أربعة أشياء/);
  assert.match(items[1], /^القلوب المتعلقةُ بالشهوات محجوبةٌ/);
});

test('حدُّ الفقرة يصير مسافةً لا التصاقاً', () => {
  // «فقط!</p><p>والفقهاء» → «فقط! والفقهاء» كما في «تراث»، لا «فقط!والفقهاء».
  const out = through(`<p>تمَّ الكلامُ هنا!</p><p>والفقهاءُ بعده.</p>`);
  assert.match(out, /تمَّ الكلامُ هنا! والفقهاءُ بعده\./);
});

// ─────────────── العنوان ───────────────

test('العنوان المطبوع في الصفحة يُوسَم وسمَ «تراث»', () => {
  // ويُقارَن ببصمة النص: «الزجاجى» في بيان «الشاملة» و«الزجاجي» في الصفحة.
  const out = toPageText(HEADING_PAGE, 'أبو عمرو الزجاجى');
  assert.match(out, /<span data-type="title">أبو عمرو الزجاجي<\/span>/);
});

test('العنوانُ المحمولُ من صفحةٍ سابقة لا يُحشر في النص', () => {
  // «الشاملة» تذكر الموضع في كل صفحة وإن لم يبتدئ فيها، فلا يُزاد في المطبوع
  // ما ليس فيه — ولا يُصنَع حدٌّ لجملةٍ لا حدَّ لها.
  const out = toPageText(HEADING_PAGE, 'أبو بكر الشبلى');
  assert.ok(!out.includes('<span'), out);
  assert.ok(!out.includes('الشبل'), out);
});

// ─────────────── المجلّد ───────────────

test('مجلّدُ الكتاب الواحد «الكتاب» يُسمّى «1» كما في «تراث»', () => {
  // ولو تُرك لسقطت كتبٌ كاملة ببوّابة «مجلّدٌ غير مرقَّم» («الفوائد» و«الوابل
  // الصيب» منها) — وهي بوّابةُ مقدّمةِ المحقّق لا بوّابةُ كتابٍ في مجلّد.
  assert.equal(toVolume('الكتاب'), '1');
  assert.equal(toVolume(' الكتاب '), '1');
});

test('«المقدمة» تبقى غير مرقَّمة، والمجلّد المرقَّم يبقى رقمه', () => {
  assert.equal(toVolume('المقدمة'), 'المقدمة');
  assert.equal(toVolume('10'), '10');
});

// ─────────────── مُعرّف الصفحة من نقاط العكس ───────────────

test('«-1» تعني لا صفحة، ولا تصير الصفحة الأولى', () => {
  // `positiveInt` يُسقط الإشارة فتصير «-1» صفحةً رقمها ١ — أوّلَ الكتاب، فيُقرأ
  // موضعٌ غيرُ المطلوب ويُنسب إليه مرجعٌ كاذب.
  assert.equal(pageRef('-1'), null);
  assert.equal(pageRef(' -1 '), null);
});

test('مُعرّفٌ صحيح يُقرأ، وما ليس رقماً يُردّ', () => {
  assert.equal(pageRef('151'), 151);
  assert.equal(pageRef(' 100\n'), 100);
  assert.equal(pageRef('0'), null);
  assert.equal(pageRef('<!DOCTYPE html>'), null);
  assert.equal(pageRef(''), null);
  assert.equal(pageRef(null), null);
});
