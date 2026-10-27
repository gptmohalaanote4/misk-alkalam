/**
 * اختبارات الاعتماد الحرفي. الشرط الذي تحرسه هذه الاختبارات واحد:
 * **كل حرفٍ في المُخرَج مأخوذٌ من الصفحة** — لا كلمة تُزاد ولا تُحذف.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adoptFromPage, locateSpan, pageBody, tokenize } from './adopt.mjs';
import { fingerprint } from './turath.mjs';

/** صفحة منقّطة من «الفوائد — ط عطاءات العلم»، بتشكيلها وحواشيها. */
const BULLETED = `• خَرابُ القلبِ من الأمن والغفلة، وعِمارتُهُ من الخشية والذِّكْرِ.
• القلبُ يمرضُ كما يمرضُ البدنُ، وشفاؤه في التوبة والحِمْيَة، ويصدأُ كما تصدأُ المرآةُ، وجلاؤه بالذِّكر، ويجوعُ ويظمأُ كما يجوعُ البدنُ، وطعامُه وشرابُه المعرفةُ والمحبةُ.
• الشوقُ إلى الله ولقائه نسيمٌ يَهُبُّ على القلب.`;

/** صفحة نثرٍ متّصل: الحدّ فيها الجملة المطبوعة. */
const PROSE = `وهذا كلّه حصل بالعلم وثمرته. ولو لم يكن في العلم إلا القربُ من ربِّ العالمين، والالتحاقُ بعالَم الملائكة، وصحبةُ الملأ الأعلى؛ لكفى به فضلًا وشرفًا. فكيف وعزُّ الدنيا والآخرة منوطٌ به؟`;

/** صفحة حديثٍ موسوم من «صحيح البخاري — ط السلطانية». */
const TAGGED = `٤٥٠ - حَدَّثَنَا يَحْيَى، عَنْ عُثْمَانَ ﵁ قَالَ: سَمِعْتُ رَسُولَ اللهِ ﷺ يَقُولُ: <hadeeth-301>«مَنْ بَنَى مَسْجِدًا يَبْتَغِي بِهِ وَجْهَ اللهِ، بَنَى اللهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ.»<hadeeth>`;

/** كل كلمة في المُخرَج موجودة في الصفحة — لا تأليف. */
function everyWordFromPage(adopted, page) {
  const pageWords = new Set(
    tokenize(pageBody(page))
      .map((t) => t.key)
      .filter(Boolean),
  );
  return tokenize(adopted)
    .map((t) => t.key)
    .filter(Boolean)
    .every((word) => pageWords.has(word));
}

test('الفائدة تُؤخذ بحدّ نقطتها، بتشكيلها كما طُبعت', () => {
  const seed = 'القلب يمرض كما يمرض البدن، وشفاؤه في التوبة والحمية.';
  const got = adoptFromPage(BULLETED, seed);
  assert.ok(got, 'لم يُعتمد شيء');
  assert.equal(got.source, 'نقطة الفائدة');
  assert.ok(got.text.startsWith('القلبُ يمرضُ'), got.text);
  assert.ok(got.text.endsWith('المعرفةُ والمحبةُ.'), got.text);
  // لا تتسرّب الفائدة المجاورة.
  assert.ok(!got.text.includes('خَرابُ القلبِ'));
  assert.ok(!got.text.includes('الشوقُ إلى الله'));
  assert.ok(everyWordFromPage(got.text, BULLETED), 'ظهرت كلمة ليست في الصفحة');
});

test('النقص في نصّ البذرة يُستكمَل من المطبوع لا من عندنا', () => {
  // البذرة تقول «كما يجوع الجسم»، والمطبوع «كما يجوع البدن».
  const seed = 'القلب يمرض كما يمرض البدن، ويجوع ويظمأ كما يجوع الجسم، وطعامه وشرابه المعرفة والمحبة.';
  const got = adoptFromPage(BULLETED, seed);
  assert.ok(got);
  assert.ok(got.text.includes('كما يجوعُ البدنُ'), got.text);
  assert.ok(!got.text.includes('كما يجوعُ الجسمُ'));
  assert.ok(everyWordFromPage(got.text, BULLETED));
});

test('النثر المتّصل يُؤخذ بحدّ الجملة المطبوعة', () => {
  // البذرة اختصرت: حذفت «وصحبة الملأ الأعلى» وقلبت «فضلًا وشرفًا».
  const seed = 'لو لم يكن في العلم إلا القرب من رب العالمين والالتحاق بعالم الملائكة لكفى به شرفا وفضلا.';
  const got = adoptFromPage(PROSE, seed);
  assert.ok(got, 'لم تُعتمد الجملة');
  assert.equal(got.source, 'الجملة المطبوعة');
  assert.ok(got.text.startsWith('ولو لم يكن'), got.text);
  assert.ok(got.text.includes('وصحبةُ الملأ الأعلى'), 'سقط ما في المطبوع');
  assert.ok(got.text.endsWith('فضلًا وشرفًا.'), got.text);
  // ما قبل الجملة وما بعدها لا يدخلان.
  assert.ok(!got.text.includes('وهذا كلّه حصل'));
  assert.ok(!got.text.includes('فكيف وعزُّ الدنيا'));
  assert.ok(everyWordFromPage(got.text, PROSE));
});

test('الحديث يُؤخذ من وسم المتن بلا إسناد', () => {
  const seed = 'من بنى لله مسجدا، بنى الله له مثله في الجنة.';
  const got = adoptFromPage(TAGGED, seed, { number: 450 });
  assert.ok(got);
  assert.equal(got.source, 'وسم المتن');
  assert.ok(got.text.startsWith('مَنْ بَنَى مَسْجِدًا'), got.text);
  // «يبتغي به وجه الله» في المطبوع وليست في البذرة — تُستعاد.
  assert.ok(got.text.includes('يَبْتَغِي بِهِ وَجْهَ اللهِ'));
  // الإسناد وعلامتا التنصيص والرموز لا تظهر.
  assert.ok(!/حَدَّثَنَا|[«»]|﵁|ﷺ/.test(got.text));
  assert.ok(everyWordFromPage(got.text, TAGGED));
});

/** «صحيح مسلم — ت عبد الباقي»: لا وسم للمتن، وحدُّه التنصيص. */
const QUOTED_MATN = `١٠١ - (٧٢٨) حدثنا إسحاق، قَالَ: سَمِعْتُ أُمَّ حَبِيبَةَ تَقُولُ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ "مَنْ صَلَّى اثْنَتَيْ عَشْرَةَ رَكْعَةً فِي يَوْمٍ وَلَيْلَةٍ، بُنِيَ لَهُ بِهِنَّ بَيْتٌ فِي الْجَنَّةِ". قَالَتْ أُمُّ حَبِيبَةَ: فَمَا تَرَكْتُهُنَّ.`;

test('المتن غير الموسوم يُؤخذ بحدّ التنصيص، بلا إسناد', () => {
  const seed = 'من صلّى اثنتي عشرة ركعة في يومٍ وليلة تطوّعاً، بُني له بهنّ بيتٌ في الجنة.';
  const got = adoptFromPage(QUOTED_MATN, seed, { number: 728 });
  assert.ok(got, 'لم يُعتمد المتن');
  assert.equal(got.source, 'وسم المتن أو تنصيصه');
  assert.ok(got.text.startsWith('مَنْ صَلَّى'), got.text);
  assert.ok(got.text.endsWith('فِي الْجَنَّةِ.'), got.text);
  // الإسناد وما بعد المتن لا يدخلان.
  assert.ok(!got.text.includes('سَمِعْتُ'), got.text);
  assert.ok(!got.text.includes('فَمَا تَرَكْتُهُنَّ'), got.text);
  assert.ok(everyWordFromPage(got.text, QUOTED_MATN));
});

test('رقم حديثٍ غير موجود لا يُعتمد بوسم غيره', () => {
  const got = adoptFromPage(TAGGED, 'من بنى لله مسجدا بنى الله له مثله في الجنة.', { number: 999 });
  // يسقط إلى حدّ الجملة، ولا يأخذ متن حديثٍ آخر منسوباً للرقم المطلوب.
  assert.ok(!got || got.source !== 'وسم المتن');
});

test('نصٌّ ليس في الصفحة لا يُعتمد', () => {
  assert.equal(adoptFromPage(BULLETED, 'الصبر حبس النفس عن الجزع والتسخط وحبس اللسان عن الشكوى.'), null);
  assert.equal(adoptFromPage(PROSE, 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى.'), null);
});

test('تطابقٌ ضعيف لا يُعتمد', () => {
  // كلماتٌ شائعة متفرّقة لا تكفي للحكم بأن هذه هي الفقرة.
  assert.equal(adoptFromPage(PROSE, 'في الله من العلم به.'), null);
});

test('صفحة فارغة أو بلا نصّ لا تُعطي شيئاً', () => {
  assert.equal(adoptFromPage('', 'القلب يمرض كما يمرض البدن.'), null);
  assert.equal(adoptFromPage(BULLETED, ''), null);
});

test('نصّ الحاشية لا يدخل في المأخوذ، وعلامتُها تُحذف', () => {
  const withFootnote = `• الدُّنيا مجازٌ، والآخرةُ وطنٌ، والأوطارُ إنَّما تُطلَبُ في الأوطان (^١).
_________
(^١) تعليق المحقّق.`;
  const got = adoptFromPage(withFootnote, 'الدنيا مجاز والآخرة وطن والأوطار إنما تطلب في الأوطان.');
  assert.ok(got, 'أُسقط نصٌّ لأجل علامة حاشية');
  // نصّ التعليق نفسه لا يدخل، والعلامة لا تظهر.
  assert.ok(!got.text.includes('تعليق المحقّق'), got.text);
  assert.ok(!got.text.includes('(^'), got.text);
});

test('الموضع يُحدَّد بمقياسي السلسلة والتغطية', () => {
  const tokens = tokenize(pageBody(BULLETED));
  const span = locateSpan('القلب يمرض كما يمرض البدن', tokens);
  assert.ok(span.anchor >= 5);
  assert.ok(span.coverage > 0.9);
  assert.equal(locateSpan('', tokens), null);
});

test('بصمة المأخوذ تطابق بصمة المطبوع حرفاً بحرف', () => {
  const got = adoptFromPage(BULLETED, 'القلب يمرض كما يمرض البدن، وشفاؤه في التوبة والحمية.');
  const printed = 'القلبُ يمرضُ كما يمرضُ البدنُ، وشفاؤه في التوبة والحِمْيَة، ويصدأُ كما تصدأُ المرآةُ، وجلاؤه بالذِّكر، ويجوعُ ويظمأُ كما يجوعُ البدنُ، وطعامُه وشرابُه المعرفةُ والمحبةُ.';
  assert.equal(fingerprint(got.text), fingerprint(printed));
});

/** متنٌ تخلّله كلام راوٍ، فحدُّه غير بيّن — البخاري ٤٥٠. */
const INTERRUPTED = `٤٥٠ - حَدَّثَنَا يَحْيَى، أَنَّهُ سَمِعَ عُثْمَانَ بْنَ عَفَّانَ يَقُولُ: سَمِعْتُ النَّبِيَّ ﷺ يَقُولُ: «مَنْ بَنَى مَسْجِدًا قَالَ بُكَيْرٌ: حَسِبْتُ أَنَّهُ قَالَ يَبْتَغِي بِهِ وَجْهَ اللهِ، بَنَى اللهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ.»`;

test('المتن الذي تخلّله كلام راوٍ يُسقَط ولا يُنقّح', () => {
  // «قال بكير: حسبت أنه قال» من كلام الراوي، فلو عُرض لنُسب إلى النبي ﷺ.
  const seed = 'من بنى لله مسجدا، بنى الله له مثله في الجنة.';
  assert.equal(adoptFromPage(INTERRUPTED, seed, { number: 450 }), null);
});

test('حدّ الجملة لا يُستعمل للحديث', () => {
  // متنٌ بلا وسمٍ ولا تنصيص: لا يُؤخذ بحدّ الجملة، لئلّا يدخل الإسناد في المتن.
  const bare = 'حَدَّثَنَا يَحْيَى، عَنْ عُثْمَانَ قَالَ: سَمِعْتُ رَسُولَ اللهِ ﷺ يَقُولُ: مَنْ بَنَى مَسْجِدًا يَبْتَغِي بِهِ وَجْهَ اللهِ، بَنَى اللهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ.';
  assert.equal(adoptFromPage(bare, 'من بنى لله مسجدا، بنى الله له مثله في الجنة.', { number: 450 }), null);
});

test('وسم المتن الذي شمل حكاية الراوي يُسقَط', () => {
  // «تراث» يضع الوسم أحياناً على الخبر كلّه لا على المتن وحده.
  const tagWrapsNarration = `٤٥٠ - حَدَّثَنَا يَحْيَى: <hadeeth-301>«أَنَّهُ سَمِعَ عُثْمَانَ يَقُولُ: إِنَّكُمْ أَكْثَرْتُمْ، وَإِنِّي سَمِعْتُ النَّبِيَّ ﷺ يَقُولُ: مَنْ بَنَى مَسْجِدًا، بَنَى اللهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ.»<hadeeth>`;
  assert.equal(
    adoptFromPage(tagWrapsNarration, 'من بنى لله مسجدا، بنى الله له مثله في الجنة.', { number: 450 }),
    null,
  );
});

test('الجملة التي تبدأ قبل الصفحة لا تُؤخذ', () => {
  // الصفحة تبدأ في وسط جملة، فأوّلها في الصفحة السابقة ولا يُعرف.
  const continued = 'على كلِّ أحدٍ في كلِّ وقت، وهي مطلوبُ الله ومراده من العباد، إذ الهجرة هجرتان: هجرة بالجسم من بلدٍ إلى بلد.';
  assert.equal(adoptFromPage(continued, 'الهجرة هجرتان: هجرة بالجسم من بلد إلى بلد.'), null);
});

test('الجملة التي لم تُختم في الصفحة لا تُؤخذ', () => {
  const unfinished = 'وقال رحمه الله. الصبرُ حبسُ النفس عن الجزع، وحبسُ اللسان عن الشكوى، وحبسُ الجوارح';
  assert.equal(adoptFromPage(unfinished, 'الصبر حبس النفس عن الجزع وحبس اللسان عن الشكوى.'), null);
});

test('الجملة لا تعبُر نقطةَ فائدةٍ أخرى', () => {
  // الكلمة الأخيرة تحمل علامة الختام، فلو بُدئ البحث بعدها لابتلعت الفائدة التالية.
  const page = `• مَن أراد صفاءَ قلبه فليُؤْثِر الله على شهوته.
• القلوبُ المتعلقةُ بالشهوات محجوبةٌ عن الله بقدر تعلُّقها بها.`;
  const got = adoptFromPage(page, 'من أراد صلاح قلبه فليؤثر الله على شهوته.');
  assert.ok(got, 'لم تُعتمد الفائدة');
  assert.ok(got.text.endsWith('على شهوته.'), got.text);
  assert.ok(!got.text.includes('المتعلقةُ'), 'ابتلعت الفائدة التالية');
  // ولفظ المطبوع «صفاء» لا «صلاح» — يُؤخذ كما طُبع.
  assert.ok(got.text.includes('صفاءَ') && !got.text.includes('صلاح'), got.text);
});
