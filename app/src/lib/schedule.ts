import type { Repeat, Schedule } from '../data/types';

export const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEKDAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: true,
  repeat: 'daily',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  hour: 7,
  minute: 30,
};

/** عدد المواعيد التي نجدولها مسبقاً. iOS يسمح بـ ٦٤ إشعاراً معلقاً كحد أقصى. */
export const MAX_SCHEDULED = 60;

/** الأيام الفعلية التي يُرسل فيها التذكير حسب نوع التكرار. */
export function activeWeekdays(schedule: Schedule): number[] {
  if (schedule.repeat === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  const days = schedule.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b);
  if (schedule.repeat === 'weekly') return unique.slice(0, 1);
  return unique;
}

/**
 * يحسب المواعيد القادمة بعد `from` (حصراً) بالتوقيت المحلي للجهاز.
 * يعيد ضبط الساعة في كل تكرار حتى تبقى صحيحة عبر التوقيت الصيفي.
 */
export function nextOccurrences(schedule: Schedule, from: Date, count: number): Date[] {
  const out: Date[] = [];
  if (!schedule.enabled || count <= 0) return out;

  const days = activeWeekdays(schedule);
  if (days.length === 0) return out;

  const cursor = new Date(from.getTime());
  cursor.setHours(schedule.hour, schedule.minute, 0, 0);
  if (cursor.getTime() <= from.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(schedule.hour, schedule.minute, 0, 0);
  }

  // حدّ أمان: ٧ أيام لكل موعد مطلوب يكفي لأي تركيبة أيام.
  const maxDays = count * 7 + 14;
  for (let i = 0; i < maxDays && out.length < count; i++) {
    if (days.includes(cursor.getDay())) out.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(schedule.hour, schedule.minute, 0, 0);
  }
  return out;
}

/** تنسيق الوقت بالعربية مثل: ٧:٣٠ صباحاً */
export function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'صباحاً' : 'مساءً';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

/** وصف مختصر للجدولة يُعرض في الواجهة. */
export function describeSchedule(schedule: Schedule): string {
  if (!schedule.enabled) return 'التذكير متوقف';
  const time = formatTime(schedule.hour, schedule.minute);
  const days = activeWeekdays(schedule);

  if (schedule.repeat === 'daily') return `كل يوم · ${time}`;
  if (schedule.repeat === 'weekly') {
    const day = days.length > 0 ? WEEKDAY_NAMES[days[0]] : WEEKDAY_NAMES[0];
    return `كل ${day} · ${time}`;
  }
  if (days.length === 0) return 'لم تختر أياماً بعد';
  if (days.length === 7) return `كل يوم · ${time}`;
  return `${days.map((d) => WEEKDAY_SHORT[d]).join('، ')} · ${time}`;
}

/** تطبيع الجدولة بعد تغيير نوع التكرار حتى لا تبقى في حالة غير صالحة. */
export function normalizeSchedule(schedule: Schedule, repeat: Repeat): Schedule {
  if (repeat === 'daily') {
    return { ...schedule, repeat, weekdays: [0, 1, 2, 3, 4, 5, 6] };
  }
  if (repeat === 'weekly') {
    const current = activeWeekdays(schedule);
    return { ...schedule, repeat, weekdays: [current.length > 0 ? current[0] : 5] };
  }
  const current = schedule.weekdays.length > 0 && schedule.weekdays.length < 7 ? schedule.weekdays : [1, 3, 5];
  return { ...schedule, repeat, weekdays: Array.from(new Set(current)).sort((a, b) => a - b) };
}
