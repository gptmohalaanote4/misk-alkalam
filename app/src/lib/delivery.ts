import type { HistoryEntry, ItemKind, PlanEntry, Schedule } from '../data/types';
import { MAX_SCHEDULED, nextOccurrences } from './schedule';
import { ensureQueue, takeNext, type QuoteQueue } from './queue';

export type Pools = Record<ItemKind, string[]>;
export type Queues = Record<ItemKind, QuoteQueue | null>;

export interface DeliveryState {
  queues: Queues;
  /** المواعيد القادمة مع العنصر المخصّص لكل موعد. */
  plan: PlanEntry[];
  /** ما وصل المستخدم فعلاً، الأقدم أولاً. */
  history: HistoryEntry[];
}

export const EMPTY_STATE: DeliveryState = {
  queues: { quote: null, hadith: null, dua: null },
  plan: [],
  history: [],
};

const HISTORY_LIMIT = 300;
/** ترتيب التناوب الثابت: حديثٌ، فمقولة، فدعاء — يوماً بيوم. */
const KIND_ORDER: ItemKind[] = ['hadith', 'quote', 'dua'];
/**
 * الأنواع التي تُعرض بترتيبها وتُعاد من أوّلها عند تمامها.
 * الأدعية كذلك بطلب صاحب المشروع: ترتيبها في المصدر مقصود.
 */
const ORDERED_KINDS: ItemKind[] = ['dua'];

/** هل يُعرض هذا النوع بترتيبه ويُعاد من أوّله؟ */
export const isOrderedKind = (kind: ItemKind) => ORDERED_KINDS.includes(kind);
const isOrdered = isOrderedKind;

/**
 * النوع التالي في الدورة بعد نوعٍ معيّن، من بين ما له محتوى.
 * موضعٌ واحد يحكم التناوب، فلا يتفرّق بين محرّك التسليم والواجهة.
 */
export function nextKindAfter(kind: ItemKind | null, pools: Pools): ItemKind | null {
  const available = KIND_ORDER.filter((k) => pools[k].length > 0);
  if (available.length === 0) return null;
  if (!kind) return available[0];
  const index = available.indexOf(kind);
  if (index < 0) return available[0];
  return available[(index + 1) % available.length];
}

/**
 * الأنواع الداخلة في الدورة: كلُّ نوعٍ له محتوى، بترتيب `KIND_ORDER` الثابت.
 * ولا يختار المستخدم منها شيئاً — الدورة ثابتة، وإنما يُستبعد نوعٌ خلا محتواه
 * لئلّا تنكسر الخطة.
 */
function enabledKinds(pools: Pools): ItemKind[] {
  return KIND_ORDER.filter((k) => pools[k].length > 0);
}

function samePlanTimes(plan: PlanEntry[], times: Date[]): boolean {
  if (plan.length !== times.length) return false;
  return plan.every((entry, i) => entry.at === times[i].toISOString());
}

export interface ReconcileResult {
  state: DeliveryState;
  planChanged: boolean;
  justDelivered: HistoryEntry[];
}

/**
 * يوفّق بين الجدولة والمحتوى والسجل:
 *  ١) ينقل المواعيد التي مضت إلى السجل.
 *  ٢) يبني خطة المواعيد القادمة بالتناوب بين الأحاديث والمقولات.
 *  ٣) يعيد استعمال العناصر المحجوزة سابقاً حتى لا تُستهلك عند كل تغيير جدولة.
 *
 * دالة خالصة: لا تلمس التخزين ولا نظام الإشعارات.
 */
export function reconcile(
  state: DeliveryState,
  schedule: Schedule,
  pools: Pools,
  now: Date,
): ReconcileResult {
  const nowMs = now.getTime();
  const valid: Record<ItemKind, Set<string>> = {
    quote: new Set(pools.quote),
    hadith: new Set(pools.hadith),
    dua: new Set(pools.dua),
  };

  // ١) ما مضى من الخطة يصبح سجلاً.
  const justDelivered: HistoryEntry[] = [];
  const stillFuture: PlanEntry[] = [];
  for (const entry of state.plan) {
    const at = Date.parse(entry.at);
    if (Number.isNaN(at)) continue;
    if (at <= nowMs) justDelivered.push({ at: entry.at, itemId: entry.itemId, kind: entry.kind });
    else stillFuture.push(entry);
  }

  const history = [...state.history, ...justDelivered]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-HISTORY_LIMIT);

  const last = history.length > 0 ? history[history.length - 1] : null;

  // ٢) طوابير منفصلة لكل نوع — تُعاد فقط عند تغيّر المحتوى المتاح.
  const queues = Object.fromEntries(
    KIND_ORDER.map((kind) => [
      kind,
      ensureQueue(
        state.queues[kind] ?? null,
        pools[kind],
        last?.kind === kind ? last.itemId : null,
        isOrdered(kind),
      ),
    ]),
  ) as Queues;

  const kinds = enabledKinds(pools);
  const times = kinds.length > 0 ? nextOccurrences(schedule, now, MAX_SCHEDULED) : [];
  const futureValid = stillFuture.filter((e) => valid[e.kind].has(e.itemId) && kinds.includes(e.kind));

  if (futureValid.length === stillFuture.length && samePlanTimes(futureValid, times)) {
    return {
      state: { queues, plan: futureValid, history },
      planChanged: justDelivered.length > 0,
      justDelivered,
    };
  }

  // عناصر كانت محجوزة لمواعيد أُلغيت — تُستعمل قبل السحب من الطابور.
  const recycled: Record<ItemKind, string[]> = { quote: [], hadith: [], dua: [] };
  for (const entry of futureValid) recycled[entry.kind].push(entry.itemId);

  // ٣) التناوب: نكمل الدورة من النوع المخالف لآخر ما وصل المستخدم.
  let offset = 0;
  if (last && kinds.length > 1) {
    const lastIndex = kinds.indexOf(last.kind);
    if (lastIndex >= 0) offset = lastIndex + 1;
  }

  const plan: PlanEntry[] = [];
  const working = { ...queues };

  times.forEach((date, index) => {
    const kind = kinds[(offset + index) % kinds.length];
    let itemId = recycled[kind].shift();
    if (!itemId) {
      const queue = working[kind];
      if (!queue) return;
      const drawn = takeNext(queue, 1);
      working[kind] = drawn.queue;
      itemId = drawn.ids[0];
    }
    if (itemId) plan.push({ at: date.toISOString(), itemId, kind });
  });

  return {
    state: { queues: working, plan, history },
    planChanged: true,
    justDelivered,
  };
}

/**
 * أول عنصر يراه المستخدم قبل وصول أي إشعار:
 * نحجز له عنصراً من الطابور ونضعه في السجل حتى لا تكون الشاشة فارغة.
 */
export function seedFirstItem(state: DeliveryState, pools: Pools, now: Date): DeliveryState {
  if (state.history.length > 0) return state;
  const kind = KIND_ORDER.find((k) => pools[k].length > 0) ?? null;
  if (!kind) return state;

  const queue = ensureQueue(state.queues[kind], pools[kind], null, isOrdered(kind));
  const { ids, queue: nextQueue } = takeNext(queue, 1);
  if (ids.length === 0) return { ...state, queues: { ...state.queues, [kind]: queue } };

  return {
    ...state,
    queues: { ...state.queues, [kind]: nextQueue },
    history: [{ at: now.toISOString(), itemId: ids[0], kind }],
  };
}

/** آخر عنصر وصل المستخدم. */
export function currentItemId(state: DeliveryState): string | null {
  if (state.history.length === 0) return null;
  return state.history[state.history.length - 1].itemId;
}

/** الموعد القادم، أو null إذا كان التذكير متوقفاً. */
export function nextDelivery(state: DeliveryState): PlanEntry | null {
  return state.plan.length > 0 ? state.plan[0] : null;
}
