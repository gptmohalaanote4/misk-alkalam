import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ItemKind, Schedule } from '../data/types';
import {
  EMPTY_STATE,
  currentItemId,
  nextDelivery,
  reconcile,
  seedFirstItem,
  type DeliveryState,
  type Pools,
} from './delivery';
import { DEFAULT_SCHEDULE, MAX_SCHEDULED } from './schedule';

const pools: Pools = {
  quote: ['q1', 'q2', 'q3', 'q4'],
  hadith: ['h1', 'h2', 'h3', 'h4'],
  dua: ['d1', 'd2', 'd3'],
};

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);
const NOW = at(2026, 1, 5, 9, 0);

const schedule = (over: Partial<Schedule> = {}): Schedule => ({ ...DEFAULT_SCHEDULE, ...over });

/** عدد العناصر المسحوبة من طابور نوعٍ ما — مقياس «استهلاك المحتوى». */
const consumed = (state: DeliveryState, kind: ItemKind) => state.queues[kind]?.cursor ?? 0;

const kinds = (state: DeliveryState) => state.plan.map((entry) => entry.kind);

// ─────────────── التناوب ───────────────

test('الخطة تتناوب بين الأنواع الثلاثة', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), pools, NOW);
  assert.ok(state.plan.length > 6);
  // الترتيب المقرّر: حديثٌ، فمقولة، فدعاء — يوماً بيوم.
  assert.deepEqual(kinds(state).slice(0, 6), ['hadith', 'quote', 'dua', 'hadith', 'quote', 'dua']);
});

test('التناوب يكمل من النوع المخالف لآخر ما وصل المستخدم', () => {
  const base: DeliveryState = {
    ...EMPTY_STATE,
    history: [{ at: at(2026, 1, 4).toISOString(), itemId: 'q1', kind: 'quote' }],
  };
  const { state } = reconcile(base, schedule(), pools, NOW);
  // آخر ما وصل مقولة، والتالي في الدورة دعاء.
  assert.equal(state.plan[0].kind, 'dua', 'لم تكمل الخطة الدورة من موضعها');
  assert.deepEqual(kinds(state).slice(0, 3), ['dua', 'hadith', 'quote']);
});

test('نوعٌ واحدٌ له محتوى: كل المواعيد منه', () => {
  // لا يختار المستخدم النوع؛ وإنما يُستبعد ما خلا محتواه.
  const onlyHadith = { quote: [], hadith: pools.hadith, dua: [] };
  const { state } = reconcile(EMPTY_STATE, schedule(), onlyHadith, NOW);
  assert.ok(state.plan.length > 0);
  assert.ok(kinds(state).every((kind) => kind === 'hadith'));
  assert.equal(consumed(state, 'quote'), 0, 'استُهلك طابور نوعٍ بلا محتوى');
});

test('النوع المُفعّل بلا محتوى يُستبعَد من التناوب', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), { quote: [], hadith: pools.hadith, dua: [] }, NOW);
  assert.ok(state.plan.length > 0);
  assert.ok(kinds(state).every((kind) => kind === 'hadith'));
});

test('بلا محتوى إطلاقاً: لا خطة ولا تعطّل', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), { quote: [], hadith: [], dua: [] }, NOW);
  assert.deepEqual(state.plan, []);
});

// ─────────────── الخطة والسجل ───────────────

test('المواعيد تُجدول في المستقبل ولا تتجاوز حدّ النظام', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), pools, NOW);
  assert.ok(state.plan.length <= MAX_SCHEDULED);
  for (const entry of state.plan) assert.ok(Date.parse(entry.at) > NOW.getTime());
});

test('ما مضى من الخطة يصير سجلاً مرتّباً', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const later = new Date(Date.parse(first.plan[1].at) + 60000);

  const { state, justDelivered, planChanged } = reconcile(first, schedule(), pools, later);
  assert.equal(justDelivered.length, 2, 'لم يُرحّل الموعدان الماضيان إلى السجل');
  assert.deepEqual(
    justDelivered.map((entry) => entry.itemId),
    first.plan.slice(0, 2).map((entry) => entry.itemId),
  );
  assert.equal(state.history.length, 2);
  assert.ok(Date.parse(state.history[0].at) <= Date.parse(state.history[1].at));
  assert.ok(planChanged);
  // ولا يبقى الماضي في الخطة.
  for (const entry of state.plan) assert.ok(Date.parse(entry.at) > later.getTime());
});

test('التذكير المتوقف يُفرّغ الخطة ولا يستهلك المحتوى', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const { state } = reconcile(first, schedule({ enabled: false }), pools, NOW);
  assert.deepEqual(state.plan, []);
  assert.equal(consumed(state, 'quote'), consumed(first, 'quote'));
  assert.equal(consumed(state, 'hadith'), consumed(first, 'hadith'));
});

test('موعد بتاريخ تالف يُهمَل بلا تعطّل', () => {
  const broken: DeliveryState = {
    ...EMPTY_STATE,
    plan: [{ at: 'ليس تاريخاً', itemId: 'q1', kind: 'quote' }],
  };
  const { state } = reconcile(broken, schedule(), pools, NOW);
  assert.ok(state.plan.every((entry) => !Number.isNaN(Date.parse(entry.at))));
  assert.equal(state.history.length, 0);
});

// ─────────────── ثبات الخطة ───────────────

test('التوفيق بلا تغيير لا يغيّر الخطة ولا يستهلك المحتوى', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const second = reconcile(first, schedule(), pools, NOW);

  assert.deepEqual(second.state.plan, first.plan, 'تغيّرت الخطة بلا سبب');
  assert.equal(second.planChanged, false);
  assert.equal(consumed(second.state, 'quote'), consumed(first, 'quote'));
  assert.equal(consumed(second.state, 'hadith'), consumed(first, 'hadith'));
});

test('معرّف الإشعار المحفوظ لا يُفقد عند التوفيق بلا تغيير', () => {
  // لو فُقد لتُركت إشعاراتٌ مجدولة في النظام بلا ما يُلغيها.
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const withIds: DeliveryState = {
    ...first,
    plan: first.plan.map((entry, i) => ({ ...entry, notificationId: `n${i}` })),
  };
  const { state } = reconcile(withIds, schedule(), pools, NOW);
  assert.equal(state.plan[0].notificationId, 'n0');
});

// ─────────────── إعادة استعمال المحجوز ───────────────

test('تغيير الوقت يعيد استعمال العناصر المحجوزة ولا يسحب من الطابور', () => {
  const first = reconcile(EMPTY_STATE, schedule({ hour: 7, minute: 30 }), pools, NOW).state;
  const moved = reconcile(first, schedule({ hour: 20, minute: 0 }), pools, NOW);

  // المواعيد تغيّرت…
  assert.notEqual(moved.state.plan[0].at, first.plan[0].at);
  assert.ok(moved.planChanged);
  // …والنصوص هي هي، بترتيبها.
  assert.deepEqual(
    moved.state.plan.map((entry) => entry.itemId),
    first.plan.map((entry) => entry.itemId),
  );
  // ولم يُسحب شيء جديد من الطابور.
  assert.equal(consumed(moved.state, 'quote'), consumed(first, 'quote'));
  assert.equal(consumed(moved.state, 'hadith'), consumed(first, 'hadith'));
});

test('تقليص أيام التذكير لا يستهلك المحتوى', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const fewer = reconcile(first, schedule({ repeat: 'custom', weekdays: [1, 4] }), pools, NOW);

  assert.ok(fewer.state.plan.length > 0);
  assert.equal(consumed(fewer.state, 'quote'), consumed(first, 'quote'));
  assert.equal(consumed(fewer.state, 'hadith'), consumed(first, 'hadith'));
  // وما حُجز سابقاً هو ما يُستعمل، لا نصوص جديدة.
  const before = new Set(first.plan.map((entry) => entry.itemId));
  for (const entry of fewer.state.plan) assert.ok(before.has(entry.itemId));
});

test('إعادة تشغيل التذكير تبني خطة جديدة بلا تكرار داخل الدورة', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const off = reconcile(first, schedule({ enabled: false }), pools, NOW).state;
  const on = reconcile(off, schedule(), pools, NOW).state;

  assert.ok(on.plan.length > 0, 'بقيت الخطة فارغة بعد إعادة التشغيل');
  // الإيقاف لم يستهلك الطابور، فالتشغيل يسحب من حيث انتهى. والضمان هو ألّا
  // يتكرّر نصٌّ مباشرةً بعد نفسه — ولو وقع الاستئناف على حدّ دورة.
  for (const kind of ['quote', 'hadith'] as ItemKind[]) {
    const drawn = on.plan.filter((entry) => entry.kind === kind).map((entry) => entry.itemId);
    for (let i = 1; i < drawn.length; i++) {
      assert.notEqual(drawn[i], drawn[i - 1], `تكرّر ${kind} مرتين متتاليتين`);
    }
  }
});

test('عنصر حُذف من المحتوى يُستبدل ولا يبقى في الخطة', () => {
  const first = reconcile(EMPTY_STATE, schedule(), pools, NOW).state;
  const removed = first.plan.find((entry) => entry.kind === 'quote')!.itemId;
  const narrowed: Pools = { ...pools, quote: pools.quote.filter((id) => id !== removed) };

  const { state } = reconcile(first, schedule(), narrowed, NOW);
  assert.ok(state.plan.every((entry) => entry.itemId !== removed));
  assert.ok(state.plan.length > 0);
});

// ─────────────── أول عنصر والواجهة ───────────────

test('أول عنصر يُحجز فلا تكون الشاشة فارغة', () => {
  const state = seedFirstItem(EMPTY_STATE, pools, NOW);
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].kind, 'hadith');
  assert.ok(pools.hadith.includes(state.history[0].itemId));
  assert.equal(currentItemId(state), state.history[0].itemId);
});

test('أول عنصر لا يُحجز مرتين', () => {
  const once = seedFirstItem(EMPTY_STATE, pools, NOW);
  const twice = seedFirstItem(once, pools, at(2026, 1, 6));
  assert.equal(twice, once);
});

test('أول عنصر يكون حديثاً إن لم تتوفّر مقولة', () => {
  const state = seedFirstItem(EMPTY_STATE, { quote: [], hadith: pools.hadith, dua: [] }, NOW);
  assert.equal(state.history[0].kind, 'hadith');
});

test('بلا محتوى لا يُحجز أول عنصر', () => {
  const state = seedFirstItem(EMPTY_STATE, { quote: [], hadith: [], dua: [] }, NOW);
  assert.deepEqual(state.history, []);
  assert.equal(currentItemId(state), null);
});

test('الموعد القادم هو أوّل الخطة، و null عند توقّف التذكير', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), pools, NOW);
  assert.equal(nextDelivery(state), state.plan[0]);
  assert.equal(nextDelivery(EMPTY_STATE), null);
});

test('السجل لا ينمو بلا حدّ', () => {
  // ٣٠٠ هو الحدّ في delivery.ts؛ نتجاوزه لنرى أنه يُقتطع من الأقدم.
  const history = Array.from({ length: 320 }, (_, i) => ({
    at: at(2024, 1, 1, 0, i).toISOString(),
    itemId: `old${i}`,
    kind: 'quote' as ItemKind,
  }));
  const { state } = reconcile({ ...EMPTY_STATE, history }, schedule(), pools, NOW);
  assert.equal(state.history.length, 300);
  assert.equal(state.history[state.history.length - 1].itemId, 'old319');
});

// ─────────────── الأدعية: ترتيبٌ يُعاد من أوّله ───────────────

test('الأدعية تُرسَل بترتيبها وتُعاد من أوّلها', () => {
  const onlyDua = { quote: [], hadith: [], dua: pools.dua };
  const { state } = reconcile(EMPTY_STATE, schedule(), onlyDua, NOW);
  const order = state.plan.map((entry) => entry.itemId);
  assert.ok(order.length > pools.dua.length, 'الخطة أقصر من دورة كاملة');
  // الدورة الأولى بترتيب المصدر، ثم تُعاد من أوّلها.
  assert.deepEqual(order.slice(0, pools.dua.length), pools.dua);
  assert.deepEqual(order.slice(pools.dua.length, pools.dua.length * 2), pools.dua);
});

test('ترتيب الأدعية لا يتأثّر بإعادة التوفيق', () => {
  const onlyDua = { quote: [], hadith: [], dua: pools.dua };
  const first = reconcile(EMPTY_STATE, schedule(), onlyDua, NOW).state;
  const again = reconcile(first, schedule(), onlyDua, NOW).state;
  assert.deepEqual(
    again.plan.map((e) => e.itemId),
    first.plan.map((e) => e.itemId),
  );
});

// ─────────────── الدورة ثابتة، والمحتوى لا يتكرّر قبل استيفائه ───────────────

test('الدورة ثلاثية ثابتة ولا يختارها المستخدم', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), pools, NOW);
  const order = kinds(state);
  // كل ثلاثة مواعيد متتابعة أنواعٌ ثلاثة مختلفة، بلا تكرارٍ داخل اليوم الثالث.
  for (let i = 0; i + 2 < order.length; i += 3) {
    assert.equal(new Set(order.slice(i, i + 3)).size, 3, `تكرّر نوعٌ في الدورة عند ${i}`);
  }
});

test('المقولات والأحاديث لا تتكرّر حتى يُستوفى كل المتاح', () => {
  const { state } = reconcile(EMPTY_STATE, schedule(), pools, NOW);
  for (const kind of ['quote', 'hadith'] as ItemKind[]) {
    const drawn = state.plan.filter((entry) => entry.kind === kind).map((entry) => entry.itemId);
    const cycle = drawn.slice(0, pools[kind].length);
    assert.equal(new Set(cycle).size, cycle.length, `تكرّر ${kind} قبل استيفاء المتاح`);
    assert.deepEqual([...cycle].sort(), [...pools[kind]].sort(), `لم تُستوفَ كل عناصر ${kind}`);
  }
});
