import type { ContentBundle, Dua, Hadith, Quote, Scholar, Source } from '../data/types';
import { HADITH_TOPIC } from '../data/seed';

/**
 * القناة التلقائية للمحتوى: ملف ثابت منشور يُولَّد من البذرة
 * (`tools/gen-content-json.mjs`) ويُحدِّثه عملٌ مجدول أسبوعياً.
 *
 * استضافة ثابتة = **بلا خادم وبلا اشتراك**، فيبقى مبدأ تكلفة التشغيل صفراً
 * قائماً مع تجدّد المحتوى بلا تدخّل. وإن تعذّر الوصول عمل التطبيق على ما لديه.
 */
const DEFAULT_FEED_URL = 'https://gptmohalaanote4.github.io/misk-alkalam/content.json';

export const FEED_URL = process.env.EXPO_PUBLIC_CONTENT_URL ?? DEFAULT_FEED_URL;

/** صيغة الحزمة التي يفهمها هذا الإصدار — ما خالفها يُرفض بلا تفسير. */
const SUPPORTED_VERSION = 1;

const TIMEOUT_MS = 15000;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isNonEmptyString) : [];

/**
 * يتحقّق من الحزمة الواردة قبل قبولها.
 * الحُرّاس هي نفسها حُرّاس `seed.ts`: ما لا مرجع له أو جاء من غير الصحيحين
 * **يُسقَط**، فلا يظهر للمستخدم نصٌّ لا نضمنه ولو جاء من قناتنا.
 */
function parseBundle(raw: unknown): ContentBundle | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== SUPPORTED_VERSION) return null;

  const scholars: Scholar[] = (Array.isArray(data.scholars) ? data.scholars : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .filter((row) => isNonEmptyString(row.id) && isNonEmptyString(row.name))
    .map((row) => ({
      id: String(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name),
      full_name: (row.full_name as string) ?? null,
      era: (row.era as string) ?? null,
      death_year_hijri: (row.death_year_hijri as number) ?? null,
      bio: (row.bio as string) ?? null,
      is_active: row.is_active !== false,
      sort_order: (row.sort_order as number) ?? 0,
    }));

  const sources: Source[] = (Array.isArray(data.sources) ? data.sources : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .filter((row) => isNonEmptyString(row.id) && isNonEmptyString(row.name))
    .map((row) => ({
      id: String(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name),
      kind: row.kind === 'turath' ? 'turath' : 'external',
      base_url: (row.base_url as string) ?? null,
      note: (row.note as string) ?? null,
      is_builtin: Boolean(row.is_builtin),
      is_default: Boolean(row.is_default),
      is_active: row.is_active !== false,
      sort_order: (row.sort_order as number) ?? 0,
    }));

  const scholarIds = new Set(scholars.map((s) => s.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const defaultSourceId = sources.find((s) => s.is_default)?.id ?? sources[0]?.id ?? null;

  const quotes: Quote[] = (Array.isArray(data.quotes) ? data.quotes : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .filter(
      (row) =>
        isNonEmptyString(row.id) &&
        isNonEmptyString(row.text) &&
        isNonEmptyString(row.book) &&
        // مرجعٌ ناقص لا يُنشر، ومقولةٌ بلا عالم لا تُنسب.
        positive(row.page) != null &&
        (row.scholar_id == null || scholarIds.has(String(row.scholar_id))),
    )
    .map((row) => ({
      kind: 'quote',
      genre: row.genre === 'biography' ? 'biography' : 'saying',
      id: String(row.id),
      scholar_id: row.scholar_id == null ? null : String(row.scholar_id),
      source_id:
        isNonEmptyString(row.source_id) && sourceIds.has(String(row.source_id))
          ? String(row.source_id)
          : (defaultSourceId as string),
      text: String(row.text),
      book: String(row.book),
      volume: positive(row.volume),
      page: positive(row.page),
      source_url: isNonEmptyString(row.source_url) ? String(row.source_url) : null,
      tags: stringList(row.tags),
      needs_reference_check: false,
    }));

  const hadiths: Hadith[] = (Array.isArray(data.hadiths) ? data.hadiths : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .filter(
      (row) =>
        isNonEmptyString(row.id) &&
        isNonEmptyString(row.text) &&
        // الأحاديث من الصحيحين حصراً — الحارس نفسه في seed.ts و schema.sql.
        (row.collection === 'bukhari' || row.collection === 'muslim') &&
        positive(row.page) != null,
    )
    .map((row) => {
      const collection = row.collection === 'bukhari' ? 'bukhari' : 'muslim';
      return {
        kind: 'hadith',
        id: String(row.id),
        collection,
        text: String(row.text),
        narrator: isNonEmptyString(row.narrator) ? String(row.narrator) : null,
        chapter: isNonEmptyString(row.chapter) ? String(row.chapter) : null,
        number: positive(row.number),
        book: collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم',
        volume: positive(row.volume),
        page: positive(row.page),
        source_id:
          isNonEmptyString(row.source_id) && sourceIds.has(String(row.source_id))
            ? String(row.source_id)
            : (defaultSourceId as string),
        source_url: isNonEmptyString(row.source_url) ? String(row.source_url) : null,
        topic: isNonEmptyString(row.topic) ? String(row.topic) : HADITH_TOPIC,
        tags: stringList(row.tags),
        needs_reference_check: false,
      };
    });

  const duas: Dua[] = (Array.isArray(data.duas) ? data.duas : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .filter(
      (row) =>
        isNonEmptyString(row.id) &&
        isNonEmptyString(row.text) &&
        // مرجع الدعاء كتابُه ورقمُه (أو موضعه)، لا المجلد والصفحة وحدهما.
        isNonEmptyString(row.collection) &&
        (positive(row.number) != null || positive(row.page) != null),
    )
    .map((row, index) => ({
      kind: 'dua',
      id: String(row.id),
      text: String(row.text),
      narrator: isNonEmptyString(row.narrator) ? String(row.narrator) : null,
      collection: String(row.collection),
      number: positive(row.number),
      book: String(row.collection),
      volume: positive(row.volume),
      page: positive(row.page),
      source_id:
        isNonEmptyString(row.source_id) && sourceIds.has(String(row.source_id))
          ? String(row.source_id)
          : (defaultSourceId as string),
      source_url: isNonEmptyString(row.source_url) ? String(row.source_url) : null,
      tags: stringList(row.tags),
      needs_reference_check: false,
      sort_order: positive(row.sort_order) ?? index + 1,
    }));

  // حزمةٌ بلا عالم أو بلا نصّ واحد ليست تحديثاً، فلا تُستبدل بها نسخةُ الجهاز.
  if (scholars.length === 0 || sources.length === 0) return null;
  if (quotes.length === 0 && hadiths.length === 0 && duas.length === 0) return null;

  return { scholars, sources, quotes, hadiths, duas, syncedAt: new Date().toISOString() };
}

/**
 * يسحب المحتوى المنشور. يعيد null عند أي تعذّر — انقطاع، أو صيغة غير مفهومة،
 * أو حزمة لا تمرّ من الحُرّاس — ويبقى التطبيق على ما لديه.
 */
export async function fetchFeedContent(): Promise<ContentBundle | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FEED_URL, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseBundle(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
