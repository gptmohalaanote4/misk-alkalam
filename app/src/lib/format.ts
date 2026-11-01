import { COLLECTION_NAMES, type ContentItem, type Scholar } from '../data/types';

/**
 * سطر المرجع الصغير الذي يظهر أسفل النص:
 *  للمقولة  → اسم الكتاب · الجزء · الصفحة
 *  للحديث   → صحيح البخاري/مسلم · الكتاب · رقم الحديث · الصفحة
 */
export function referenceLine(item: ContentItem): string {
  const parts: (string | null)[] = [];
  if (item.kind === 'hadith') {
    parts.push(COLLECTION_NAMES[item.collection]);
    parts.push(item.chapter);
    parts.push(item.number != null ? `حديث ${item.number}` : null);
  } else if (item.kind === 'dua') {
    // مرجع الدعاء كتابُه ورقمُه؛ والمجلد والصفحة يُضافان إن توفّرا.
    parts.push(item.collection);
    parts.push(item.number != null ? `حديث ${item.number}` : null);
  } else {
    parts.push(item.book);
  }
  parts.push(item.volume != null ? `ج${item.volume}` : null);
  parts.push(item.page != null ? `ص${item.page}` : null);
  return parts.filter(Boolean).join(' · ');
}

/** الاسم الذي يُكتب أعلى النص. */
export function attributionName(item: ContentItem, scholars: Map<string, Scholar>): string {
  if (item.kind === 'hadith') return 'قال رسول الله ﷺ';
  if (item.kind === 'dua') return 'من دعاء النبي ﷺ';
  // الخبر عن صالحٍ ليس قولاً له ولا لمؤلّف الكتاب.
  if (item.genre === 'biography') return 'من سير الصالحين';
  // لا قائلَ معلوماً: لا يُفتعل له اسم، والمرجعُ تحته يحمل الكتاب والصفحة.
  if (!item.scholar_id) return '';
  return scholars.get(item.scholar_id)?.name ?? 'عالم';
}

/** سطر فرعي أعلى النص: الصحابي الراوي في الحديث فقط. */
export function attributionSub(item: ContentItem): string | null {
  if ((item.kind === 'hadith' || item.kind === 'dua') && item.narrator) {
    return `عن ${item.narrator}`;
  }
  return null;
}

const KIND_LABELS: Record<ContentItem['kind'], string> = {
  hadith: 'حديث اليوم',
  quote: 'مقولة اليوم',
  dua: 'دعاء اليوم',
};

export function kindLabel(item: ContentItem): string {
  if (item.kind === 'quote' && item.genre === 'biography') return 'من سير الصالحين';
  return KIND_LABELS[item.kind];
}

/** النص المنسّق للنسخ والمشاركة. */
export function shareText(item: ContentItem, scholars: Map<string, Scholar>): string {
  const sub = attributionSub(item);
  const head = [attributionName(item, scholars), sub].filter(Boolean).join(' — ');
  return `«${item.text}»\n\n${head}\n${referenceLine(item)}`;
}
