import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hadithNumbersOn } from './locate.mjs';

/** البخاري — ط السلطانية: الرقم يتصدّر الإسناد. */
const BUKHARI = `٧٩٦ - حَدَّثَنَا آدَمُ، قَالَ: حَدَّثَنَا شُعْبَةُ.
٧٩٧ - حَدَّثَنَا مُحَمَّدٌ، عَنْ أَبِي هُرَيْرَةَ.`;

/** مسلم — ت عبد الباقي: التسلسل داخل الكتاب، ثم الرقم المعتمد بين قوسين. */
const MUSLIM = `١٢٧ - (١٩١٤) حدثنا يحيى بن يحيى، قال: قرأت على مالك.
١٢٨ - (١٩١٥) وحدثنا قتيبة بن سعيد.`;

test('أرقام البخاري تُقرأ من صدر الإسناد', () => {
  assert.deepEqual(hadithNumbersOn(BUKHARI, 'bukhari'), [796, 797]);
});

test('أرقام مسلم تُقرأ من القوسين لا من التسلسل', () => {
  // ١٢٧ تسلسلٌ داخل الكتاب، والمعتمد في البذرة هو ١٩١٤.
  assert.deepEqual(hadithNumbersOn(MUSLIM, 'muslim'), [1914, 1915]);
});

test('صفحة بلا أرقام تعطي قائمة فارغة', () => {
  assert.deepEqual(hadithNumbersOn('<span>بَابُ فَضْلِ التَّهْلِيلِ</span>', 'bukhari'), []);
  assert.deepEqual(hadithNumbersOn('', 'muslim'), []);
});

test('الرقم داخل السطر لا يُقرأ رقمَ حديث في البخاري', () => {
  // «وهو ابن ٦٠ - سنة» ليست صدر إسناد، والصدر يلزمه بداية سطر.
  assert.deepEqual(hadithNumbersOn('حدثنا فلان وهو ابن ٦٠ - سنة', 'bukhari'), []);
});
