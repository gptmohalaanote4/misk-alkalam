import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Schedule } from '../data/types';
import {
  DEFAULT_SCHEDULE,
  MAX_SCHEDULED,
  activeWeekdays,
  describeSchedule,
  formatTime,
  nextOccurrences,
  normalizeSchedule,
} from './schedule';

/** الاختبارات بالتوقيت المحلي للجهاز، كما يحسب التطبيق مواعيده. */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const schedule = (over: Partial<Schedule> = {}): Schedule => ({ ...DEFAULT_SCHEDULE, ...over });

test('المواعيد بعد اللحظة الحالية حصراً', () => {
  // الموعد ٧:٣٠ وقد مضى في هذا اليوم، فأوّل موعد غداً.
  const from = at(2026, 1, 5, 9, 0);
  const [first] = nextOccurrences(schedule(), from, 3);
  assert.ok(first.getTime() > from.getTime());
  assert.equal(first.getDate(), 6);
  assert.equal(first.getHours(), 7);
  assert.equal(first.getMinutes(), 30);
});

test('الموعد الذي لم يحن بعدُ يُحسب في اليوم نفسه', () => {
  const [first] = nextOccurrences(schedule(), at(2026, 1, 5, 6, 0), 1);
  assert.equal(first.getDate(), 5);
});

test('الموعد المطابق للحظة الحالية لا يُعاد', () => {
  // لو أُعيد لأُرسِل إشعارٌ في الماضي عند كل توفيق.
  const [first] = nextOccurrences(schedule({ hour: 7, minute: 30 }), at(2026, 1, 5, 7, 30), 1);
  assert.equal(first.getDate(), 6);
});

test('التكرار اليومي يعطي أياماً متتابعة بالوقت نفسه', () => {
  const list = nextOccurrences(schedule(), at(2026, 1, 5, 9, 0), 5);
  assert.equal(list.length, 5);
  list.forEach((date, i) => {
    assert.equal(date.getDate(), 6 + i);
    assert.equal(date.getHours(), 7);
    assert.equal(date.getMinutes(), 30);
  });
});

test('الساعة تبقى صحيحة عبر التوقيت الصيفي', () => {
  // ٦٠ موعداً تعبر أي تحوّل صيفي في نصف الكرة الشمالي أو الجنوبي.
  for (const start of [at(2026, 3, 25), at(2026, 10, 20)]) {
    for (const date of nextOccurrences(schedule({ hour: 7, minute: 30 }), start, MAX_SCHEDULED)) {
      assert.equal(date.getHours(), 7, `اختلّت الساعة عند ${date.toString()}`);
      assert.equal(date.getMinutes(), 30);
    }
  }
});

test('التكرار الأسبوعي يوم واحد كل سبعة أيام', () => {
  const list = nextOccurrences(schedule({ repeat: 'weekly', weekdays: [5] }), at(2026, 1, 5), 4);
  assert.equal(list.length, 4);
  for (const date of list) assert.equal(date.getDay(), 5);
  for (let i = 1; i < list.length; i++) {
    const days = Math.round((list[i].getTime() - list[i - 1].getTime()) / 86400000);
    assert.equal(days, 7);
  }
});

test('الأيام المختارة وحدها هي مواعيد التكرار المخصّص', () => {
  const days = [1, 3, 5];
  const list = nextOccurrences(schedule({ repeat: 'custom', weekdays: days }), at(2026, 1, 5), 9);
  assert.equal(list.length, 9);
  for (const date of list) assert.ok(days.includes(date.getDay()), `يوم غير مختار: ${date.getDay()}`);
});

test('المواعيد مرتّبة تصاعدياً بلا تكرار', () => {
  const list = nextOccurrences(schedule({ repeat: 'custom', weekdays: [0, 6] }), at(2026, 1, 5), 10);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].getTime() > list[i - 1].getTime());
  }
});

test('التذكير المتوقف أو العدد غير الموجب لا يعطي مواعيد', () => {
  assert.deepEqual(nextOccurrences(schedule({ enabled: false }), at(2026, 1, 5), 5), []);
  assert.deepEqual(nextOccurrences(schedule(), at(2026, 1, 5), 0), []);
});

test('التكرار المخصّص بلا أيام لا يعطي مواعيد', () => {
  // حالة واجهة حقيقية: المستخدم أزال كل الأيام.
  assert.deepEqual(nextOccurrences(schedule({ repeat: 'custom', weekdays: [] }), at(2026, 1, 5), 5), []);
});

test('المواعيد المطلوبة تُستوفى ولو تفرّقت الأيام', () => {
  // يومٌ واحد في الأسبوع × ٦٠ موعداً = أكثر من سنة، فحدّ الأمان يجب أن يكفيه.
  const list = nextOccurrences(schedule({ repeat: 'weekly', weekdays: [2] }), at(2026, 1, 5), MAX_SCHEDULED);
  assert.equal(list.length, MAX_SCHEDULED);
});

test('أيام التكرار تُنظَّف وتُرتَّب', () => {
  assert.deepEqual(activeWeekdays(schedule({ repeat: 'daily', weekdays: [2] })), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(activeWeekdays(schedule({ repeat: 'weekly', weekdays: [5, 1] })), [1]);
  assert.deepEqual(activeWeekdays(schedule({ repeat: 'custom', weekdays: [5, 1, 5, 9, -1] })), [1, 5]);
});

test('تطبيع الجدولة يترك حالة صالحة بعد تغيير التكرار', () => {
  assert.deepEqual(normalizeSchedule(schedule({ weekdays: [] }), 'daily').weekdays, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(normalizeSchedule(schedule({ weekdays: [3, 6] }), 'weekly').weekdays.length, 1);
  const custom = normalizeSchedule(schedule({ repeat: 'daily' }), 'custom');
  assert.ok(custom.weekdays.length > 0 && custom.weekdays.length < 7);
});

test('تنسيق الوقت بالعربية', () => {
  assert.equal(formatTime(7, 30), '7:30 صباحاً');
  assert.equal(formatTime(0, 5), '12:05 صباحاً');
  assert.equal(formatTime(12, 0), '12:00 مساءً');
  assert.equal(formatTime(21, 0), '9:00 مساءً');
});

test('وصف الجدولة يطابق حالتها', () => {
  assert.equal(describeSchedule(schedule({ enabled: false })), 'التذكير متوقف');
  assert.ok(describeSchedule(schedule()).startsWith('كل يوم'));
  assert.ok(describeSchedule(schedule({ repeat: 'weekly', weekdays: [5] })).startsWith('كل الجمعة'));
  assert.equal(describeSchedule(schedule({ repeat: 'custom', weekdays: [] })), 'لم تختر أياماً بعد');
  assert.ok(describeSchedule(schedule({ repeat: 'custom', weekdays: [1, 3] })).includes('اثنين'));
});
