import { randomSeed, shuffle } from './random';

export interface QuoteQueue {
  /** ترتيب معرّفات العناصر: عشوائي، أو كما ورد إن كان الطابور مرتّباً. */
  ids: string[];
  /** موضع العنصر التالي الذي لم يُحجز بعد. */
  cursor: number;
  /** بصمة مجموعة العناصر المتاحة — لإعادة البناء عند تغيّر المحتوى. */
  signature: string;
  /** آخر معرّف سُحب — يمنع تكراره مباشرةً في أول الدورة التالية. */
  last?: string | null;
  /**
   * طابورٌ مرتّب: يُعرض بترتيبه كما ورد، وإذا تمّ أُعيد **من أوّله** بلا خلط.
   * الأدعية كذلك: ترتيبها في المصدر مقصود، فلا يُبدَّل ولا يُعاد عشوائياً.
   */
  ordered?: boolean;
}

/** بصمة مستقرة لمجموعة معرّفات (مستقلة عن الترتيب). */
export function signatureOf(ids: readonly string[]): string {
  const sorted = ids.slice().sort();
  let hash = 2166136261;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0x2c;
    hash = Math.imul(hash, 16777619);
  }
  return `${sorted.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * ينشئ دورة جديدة بترتيب عشوائي، مع تفادي أن تبدأ بالعنصر الأخير الذي ظهر.
 * وإن كان الطابور مرتّباً حُفظ ترتيب المصدر كما هو.
 */
export function createQueue(
  ids: readonly string[],
  avoidFirst?: string | null,
  ordered = false,
): QuoteQueue {
  const signature = signatureOf(ids);
  if (ordered) {
    return { ids: ids.slice(), cursor: 0, signature, last: avoidFirst ?? null, ordered: true };
  }
  let order = shuffle(ids, randomSeed());
  if (avoidFirst && order.length > 1 && order[0] === avoidFirst) {
    order = [order[1], order[0], ...order.slice(2)];
  }
  return { ids: order, cursor: 0, signature, last: avoidFirst ?? null };
}

/**
 * يضمن أن الطابور يغطي المقولات المتاحة حالياً.
 * يُعاد بناؤه فقط عند تغيّر مجموعة المقولات (إضافة/حذف/تغيير المتابَعين).
 */
export function ensureQueue(
  queue: QuoteQueue | null,
  availableIds: readonly string[],
  lastDeliveredId?: string | null,
  ordered = false,
): QuoteQueue {
  const signature = signatureOf(availableIds);
  if (
    queue &&
    queue.signature === signature &&
    queue.ids.length === availableIds.length &&
    Boolean(queue.ordered) === ordered
  ) {
    return queue;
  }
  return createQueue(availableIds, lastDeliveredId, ordered);
}

/**
 * يحجز `count` مقولة من الطابور ويقدّم المؤشر.
 * عند اكتمال الدورة يُعاد الخلط ببذرة جديدة فتبدأ دورة مختلفة الترتيب،
 * فلا تتكرر مقولة إلا بعد استيفاء جميع المقولات المتاحة.
 */
export function takeNext(queue: QuoteQueue, count: number): { ids: string[]; queue: QuoteQueue } {
  if (queue.ids.length === 0 || count <= 0) return { ids: [], queue };

  let working: QuoteQueue = queue;
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    if (working.cursor >= working.ids.length) {
      if (working.ordered) {
        // الطابور المرتّب يُعاد من أوّله بترتيبه، بلا خلطٍ ولا تفادي تكرار.
        working = { ...working, cursor: 0 };
      } else {
        // بداية دورة جديدة: نتفادى تكرار آخر معرّف سُحب فعلاً، ولو كان في استدعاء سابق.
        const last = ids.length > 0 ? ids[ids.length - 1] : working.last ?? null;
        working = createQueue(working.ids, last);
      }
    }
    const picked = working.ids[working.cursor];
    ids.push(picked);
    working = { ...working, cursor: working.cursor + 1, last: picked };
  }

  return { ids, queue: working };
}
