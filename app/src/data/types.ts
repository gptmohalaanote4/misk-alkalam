export interface Scholar {
  id: string;
  slug: string;
  name: string;
  full_name: string | null;
  era: string | null;
  death_year_hijri: number | null;
  bio: string | null;
  is_active: boolean;
  sort_order: number;
}

/** نوع المصدر: "تراث" مدمج في التطبيق، وأي مصدر آخر يضيفه الأدمن فقط. */
export type SourceKind = 'turath' | 'external';

export interface Source {
  id: string;
  slug: string;
  name: string;
  kind: SourceKind;
  base_url: string | null;
  note: string | null;
  /** مصدر مدمج لا يُحذف ولا يُعدّل (موقع تراث). */
  is_builtin: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

/** أنواع المحتوى المُرسَل الثلاثة، يتناوب التطبيق بينها يوماً بيوم. */
export type ItemKind = 'quote' | 'hadith' | 'dua';

/** مرجع مختصر يُعرض بخط صغير أسفل النص. */
export interface Reference {
  /** اسم الكتاب أو المصدر المطبوع. */
  book: string;
  volume: number | null;
  page: number | null;
}

/**
 * نوعا المقولة:
 *   'saying'    — قولٌ للعالم نفسه.
 *   'biography' — خبرٌ **عنه** من كتب السِّيَر: «كان فلانٌ يفعل كذا». فصاحب
 *                 النصّ مؤلِّفُ الكتاب لا المترجَم له، فلا يُعرض قولاً لأحدهما.
 */
export type QuoteGenre = 'saying' | 'biography';

export interface Quote extends Reference {
  kind: 'quote';
  genre: QuoteGenre;
  id: string;
  /** مَن قاله. و`null` لمقولةٍ لا يُعرف قائلُها — فيكفيها اسمُ الكتاب وصفحتُه. */
  scholar_id: string | null;
  source_id: string;
  text: string;
  source_url: string | null;
  tags: string[];
  /** مرجع ناقص (بلا جزء/صفحة) — يظهر للأدمن فقط. */
  needs_reference_check: boolean;
}

/** الأحاديث مقصورة على الصحيحين. */
export type HadithCollection = 'bukhari' | 'muslim';

export const COLLECTION_NAMES: Record<HadithCollection, string> = {
  bukhari: 'صحيح البخاري',
  muslim: 'صحيح مسلم',
};

export interface Hadith extends Reference {
  kind: 'hadith';
  id: string;
  /** البخاري أو مسلم — لا يُقبل غيرهما. */
  collection: HadithCollection;
  /** متن الحديث. */
  text: string;
  /** الصحابي الراوي. */
  narrator: string | null;
  /** كتاب الحديث داخل الصحيح، مثل: كتاب الإيمان. */
  chapter: string | null;
  /** رقم الحديث في الطبعة المعتمدة. */
  number: number | null;
  source_id: string;
  source_url: string | null;
  /** الموضوع — التطبيق يقتصر على فضائل الأعمال. */
  topic: string;
  tags: string[];
  needs_reference_check: boolean;
}

/**
 * دعاءٌ من أدعية النبي ﷺ.
 *
 * مرجعه **الكتاب ورقم الحديث** لا المجلد والصفحة: هذه كتب حديثٍ يُحال إليها
 * بأرقامها (صحيح مسلم ٢٦٩٧، صحيح الجامع ٥٧٠٣)، ولو توفّر المجلد والصفحة
 * أُضيفا. ولذلك `collection` هنا نصٌّ حرّ لا قيدَ فيه بالصحيحين.
 */
export interface Dua extends Reference {
  kind: 'dua';
  id: string;
  /** نصّ الدعاء وحده، بلا سياق الرواية. */
  text: string;
  /** الصحابي الراوي. */
  narrator: string | null;
  /** الكتاب الذي يُحال إليه: صحيح مسلم، صحيح الجامع، السلسلة الصحيحة… */
  collection: string;
  /** رقم الحديث في ذلك الكتاب — وهو المرجع المعتمد لهذا النوع. */
  number: number | null;
  source_id: string;
  source_url: string | null;
  tags: string[];
  /** مرجع ناقص (بلا كتابٍ أو رقم) — يظهر للأدمن فقط. */
  needs_reference_check: boolean;
  /** موضعه في ترتيب العرض؛ الأدعية تُعرض مرتّبةً وتُعاد من أوّلها. */
  sort_order: number;
}

/** أي عنصر قابل للإرسال. */
export type ContentItem = Quote | Hadith | Dua;

export interface ContentBundle {
  scholars: Scholar[];
  sources: Source[];
  quotes: Quote[];
  hadiths: Hadith[];
  duas: Dua[];
  /** وقت آخر مزامنة ناجحة مع الخادم، أو null إذا كان المحتوى مدمجاً فقط. */
  syncedAt: string | null;
}

/** نوع تكرار التذكير. */
export type Repeat = 'daily' | 'weekly' | 'custom';

export interface Schedule {
  enabled: boolean;
  repeat: Repeat;
  /** 0 = الأحد … 6 = السبت. يُستخدم مع weekly (يوم واحد) و custom (عدة أيام). */
  weekdays: number[];
  /** ساعة اليوم 0–23 بالتوقيت المحلي. */
  hour: number;
  /** الدقيقة 0–59. */
  minute: number;
}

// ملاحظة: لا خيار للمستخدم في نوع المحتوى. الدورة ثابتة على ثلاثة أيام —
// حديثٌ، فمقولة، فدعاء — ويحكمها `KIND_ORDER` في `lib/delivery.ts` وحده.

/** عنصر في خطة الإرسال: متى، وأي عنصر. */
export interface PlanEntry {
  /** وقت الإرسال بصيغة ISO. */
  at: string;
  itemId: string;
  kind: ItemKind;
  /** معرّف الإشعار المجدول في النظام (لإلغائه لاحقاً). */
  notificationId?: string;
}

/** عنصر تم تسليمه فعلاً. */
export interface HistoryEntry {
  at: string;
  itemId: string;
  kind: ItemKind;
}
