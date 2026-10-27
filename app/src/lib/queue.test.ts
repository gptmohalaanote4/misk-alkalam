import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, ensureQueue, signatureOf, takeNext, type QuoteQueue } from './queue';

const ids = ['a', 'b', 'c', 'd', 'e'];

test('البصمة مستقلّة عن الترتيب وتتغيّر بتغيّر المجموعة', () => {
  assert.equal(signatureOf(['a', 'b', 'c']), signatureOf(['c', 'a', 'b']));
  assert.notEqual(signatureOf(['a', 'b', 'c']), signatureOf(['a', 'b']));
  assert.notEqual(signatureOf(['a', 'b', 'c']), signatureOf(['a', 'b', 'z']));
});

test('الطابور يحوي كل المعرّفات مرة واحدة', () => {
  const queue = createQueue(ids);
  assert.deepEqual([...queue.ids].sort(), [...ids].sort());
  assert.equal(queue.cursor, 0);
});

test('الدورة الجديدة لا تبدأ بآخر ما ظهر', () => {
  // الخلط عشوائي، فنُكرّر حتى نطمئن أن الحارس يعمل في كل الحالات.
  for (let i = 0; i < 50; i++) {
    assert.notEqual(createQueue(ids, 'c').ids[0], 'c');
  }
});

test('لا يتكرّر نصّ حتى تنتهي الدورة كلّها', () => {
  const { ids: drawn } = takeNext(createQueue(ids), ids.length);
  assert.equal(drawn.length, ids.length);
  assert.equal(new Set(drawn).size, ids.length);
});

test('السحب المتفرّق يكافئ السحب الجملي', () => {
  let queue = createQueue(ids);
  const drawn: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const step = takeNext(queue, 1);
    drawn.push(...step.ids);
    queue = step.queue;
  }
  assert.equal(new Set(drawn).size, ids.length);
});

test('عند اكتمال الدورة يُعاد الخلط ولا تبدأ الدورة بآخر نصّ ظهر', () => {
  for (let i = 0; i < 30; i++) {
    const { ids: drawn } = takeNext(createQueue(ids), ids.length + 1);
    assert.equal(drawn.length, ids.length + 1);
    // أول الدورة الثانية يخالف آخر الأولى، فلا يشعر المستخدم بتكرار.
    assert.notEqual(drawn[ids.length], drawn[ids.length - 1]);
  }
});

test('الخلط يُعاد ببذرة جديدة فلا تتطابق الدورتان دائماً', () => {
  // ليس تأكيداً على ترتيب بعينه، بل على أن الدورة الثانية ليست نسخة من الأولى.
  let differed = false;
  for (let i = 0; i < 20 && !differed; i++) {
    const { ids: drawn } = takeNext(createQueue(ids), ids.length * 2);
    const first = drawn.slice(0, ids.length).join();
    const second = drawn.slice(ids.length).join();
    if (first !== second) differed = true;
  }
  assert.ok(differed, 'الدورة الثانية كانت نسخة من الأولى في كل المحاولات');
});

test('الطابور يُحفظ ما لم تتغيّر مجموعة المحتوى', () => {
  const queue = takeNext(createQueue(ids), 2).queue;
  assert.equal(ensureQueue(queue, ids), queue, 'أُعيد بناء الطابور بلا سبب');
  // ترتيب مختلف لنفس المجموعة ليس تغيّراً في المحتوى.
  assert.equal(ensureQueue(queue, [...ids].reverse()), queue);
});

test('الطابور يُعاد بناؤه عند تغيّر المحتوى', () => {
  const queue = takeNext(createQueue(ids), 2).queue;
  const rebuilt = ensureQueue(queue, [...ids, 'f']);
  assert.notEqual(rebuilt, queue);
  assert.equal(rebuilt.cursor, 0);
  assert.equal(rebuilt.ids.length, ids.length + 1);
});

test('طابور فارغ لا يسحب ولا يتعطّل', () => {
  const empty = createQueue([]);
  const { ids: drawn, queue } = takeNext(empty, 3);
  assert.deepEqual(drawn, []);
  assert.equal(queue, empty);
});

test('سحب صفر أو أقل لا يقدّم المؤشر', () => {
  const queue = createQueue(ids);
  assert.equal(takeNext(queue, 0).queue.cursor, 0);
  assert.equal(takeNext(queue, -1).queue.cursor, 0);
});

test('طابور محفوظ من إصدار سابق بلا last يعمل', () => {
  // ما خُزّن على الجهاز قبل إضافة الحقل يُقرأ بلا تعريف.
  const stored = { ids, cursor: ids.length, signature: signatureOf(ids) } as QuoteQueue;
  const { ids: drawn } = takeNext(stored, 1);
  assert.equal(drawn.length, 1);
});

// ─────────────── الطابور المرتّب (الأدعية) ───────────────

test('الطابور المرتّب يحفظ ترتيب المصدر ولا يخلطه', () => {
  const queue = createQueue(ids, null, true);
  assert.deepEqual(queue.ids, ids, 'خُلط ترتيبٌ مقصود');
  assert.equal(queue.ordered, true);
});

test('الطابور المرتّب يُعاد من أوّله عند تمامه', () => {
  // شرط صاحب المشروع: الأدعية تُعرض بترتيبها، وإذا انتهت بدأت من أوّلها.
  const { ids: drawn } = takeNext(createQueue(ids, null, true), ids.length * 2 + 1);
  assert.deepEqual(drawn.slice(0, ids.length), ids);
  assert.deepEqual(drawn.slice(ids.length, ids.length * 2), ids, 'لم تُعَد الدورة بترتيبها');
  assert.equal(drawn[ids.length * 2], ids[0]);
});

test('الطابور المرتّب لا يتفادى تكرار آخر عنصر عند الإعادة', () => {
  // التفادي يكسر الترتيب، والترتيب هنا مقصود — فآخر عنصرٍ يليه أوّلُ القائمة.
  const { ids: drawn } = takeNext(createQueue(ids, null, true), ids.length + 1);
  assert.equal(drawn[ids.length - 1], ids[ids.length - 1]);
  assert.equal(drawn[ids.length], ids[0]);
});

test('تغيّر نوع الطابور يُعيد بناءه', () => {
  const shuffled = createQueue(ids);
  assert.equal(ensureQueue(shuffled, ids, null, true).ordered, true);
  assert.equal(ensureQueue(createQueue(ids, null, true), ids, null, false).ordered, undefined);
});

test('الطابور المرتّب يُحفظ ما لم يتغيّر المحتوى', () => {
  const queue = takeNext(createQueue(ids, null, true), 2).queue;
  assert.equal(ensureQueue(queue, ids, null, true), queue);
});
