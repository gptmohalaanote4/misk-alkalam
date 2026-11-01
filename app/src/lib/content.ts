import type {
  ContentBundle,
  ContentItem,
  Dua,
  Hadith,
  HadithCollection,
  ItemKind,
  Quote,
  Scholar,
  Source,
  SourceKind,
} from '../data/types';
import { HADITH_TOPIC, SEED_CONTENT } from '../data/seed';
import { fetchFeedContent } from './feed';
import { getItem, setItem, KEYS } from './storage';
import { supabase } from './supabase';

/** المحتوى المخزَّن محلياً، وإلا المحتوى المدمج. */
export async function loadCachedContent(): Promise<ContentBundle> {
  const cached = await getItem<ContentBundle>(KEYS.contentCache);
  if (cached?.quotes?.length && cached.scholars?.length && cached.sources?.length && cached.hadiths) {
    return cached;
  }
  return SEED_CONTENT;
}

/**
 * يجلب المحتوى المنشور من Supabase.
 * يعيد null إذا لم تُضبط بيانات الاتصال أو فشل الجلب — ويبقى التطبيق يعمل.
 */
async function syncFromSupabase(): Promise<ContentBundle | null> {
  if (!supabase) return null;
  try {
    const [scholarsRes, sourcesRes, quotesRes, hadithsRes, duasRes] = await Promise.all([
      supabase.from('scholars').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('sources').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('quotes').select('*').eq('status', 'published'),
      supabase.from('hadiths').select('*').eq('status', 'published'),
      supabase.from('duas').select('*').eq('status', 'published'),
    ]);

    if (scholarsRes.error || sourcesRes.error || quotesRes.error || hadithsRes.error || duasRes.error) {
      return null;
    }

    const scholars: Scholar[] = (scholarsRes.data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      full_name: (row.full_name as string) ?? null,
      era: (row.era as string) ?? null,
      death_year_hijri: (row.death_year_hijri as number) ?? null,
      bio: (row.bio as string) ?? null,
      is_active: Boolean(row.is_active),
      sort_order: (row.sort_order as number) ?? 0,
    }));

    const sources: Source[] = (sourcesRes.data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      kind: row.kind as SourceKind,
      base_url: (row.base_url as string) ?? null,
      note: (row.note as string) ?? null,
      is_builtin: Boolean(row.is_builtin),
      is_default: Boolean(row.is_default),
      is_active: Boolean(row.is_active),
      sort_order: (row.sort_order as number) ?? 0,
    }));

    const quotes: Quote[] = (quotesRes.data as Record<string, unknown>[]).map((row) => ({
      kind: 'quote',
      genre: row.genre === 'biography' ? 'biography' : 'saying',
      id: String(row.id),
      scholar_id: row.scholar_id == null ? null : String(row.scholar_id),
      source_id: String(row.source_id),
      text: String(row.text),
      book: String(row.book),
      volume: (row.volume as number) ?? null,
      page: (row.page as number) ?? null,
      source_url: (row.source_url as string) ?? null,
      tags: (row.tags as string[]) ?? [],
      needs_reference_check: Boolean(row.needs_reference_check),
    }));

    const hadiths: Hadith[] = (hadithsRes.data as Record<string, unknown>[])
      .filter((row) => row.collection === 'bukhari' || row.collection === 'muslim')
      .map((row) => {
        const collection = row.collection as HadithCollection;
        return {
          kind: 'hadith',
          id: String(row.id),
          collection,
          text: String(row.text),
          narrator: (row.narrator as string) ?? null,
          chapter: (row.chapter as string) ?? null,
          number: (row.number as number) ?? null,
          book: collection === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم',
          volume: (row.volume as number) ?? null,
          page: (row.page as number) ?? null,
          source_id: String(row.source_id),
          source_url: (row.source_url as string) ?? null,
          topic: (row.topic as string) ?? HADITH_TOPIC,
          tags: (row.tags as string[]) ?? [],
          needs_reference_check: Boolean(row.needs_reference_check),
        };
      });

    if (scholars.length === 0 || (quotes.length === 0 && hadiths.length === 0)) return null;

    const duas: Dua[] = (duasRes.data as Record<string, unknown>[])
      .filter((row) => typeof row.collection === 'string' && row.collection.trim() !== '')
      .map((row) => ({
        kind: 'dua',
        id: String(row.id),
        text: String(row.text),
        narrator: (row.narrator as string) ?? null,
        collection: String(row.collection),
        number: (row.number as number) ?? null,
        book: String(row.collection),
        volume: (row.volume as number) ?? null,
        page: (row.page as number) ?? null,
        source_id: String(row.source_id),
        source_url: (row.source_url as string) ?? null,
        tags: (row.tags as string[]) ?? [],
        needs_reference_check: Boolean(row.needs_reference_check),
        sort_order: (row.sort_order as number) ?? 0,
      }));

    return { scholars, sources, quotes, hadiths, duas, syncedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

/**
 * يُجدِّد المحتوى من قناتين، والأولى أولى:
 *   ١) Supabase — إن ضُبط، فهو محتوى الأدمن المُنتقى.
 *   ٢) الملف الثابت المنشور — القناة التلقائية التي يُحدِّثها العمل المجدول،
 *      وتعمل دائماً بلا إعداد ولا خادم ولا اشتراك.
 *
 * يعيد null إذا لم تنجح أيٌّ منهما، فيبقى التطبيق على المحتوى المدمج أو المخزَّن.
 */
export async function syncContent(): Promise<ContentBundle | null> {
  const bundle = (await syncFromSupabase()) ?? (await fetchFeedContent());
  if (!bundle) return null;
  await setItem(KEYS.contentCache, bundle);
  return bundle;
}

export function allItems(bundle: ContentBundle): ContentItem[] {
  return [...bundle.quotes, ...bundle.hadiths, ...bundle.duas];
}

export function indexContent(bundle: ContentBundle) {
  const itemsById = new Map<string, ContentItem>(allItems(bundle).map((i) => [i.id, i]));
  const scholarsById = new Map(bundle.scholars.map((s) => [s.id, s]));
  const sourcesById = new Map(bundle.sources.map((s) => [s.id, s]));
  return { itemsById, scholarsById, sourcesById };
}

/**
 * نصٌّ صالح للإرسال: مرجعه كامل.
 * نفس بوّابة `--strict` في أداة التحقّق، لكن مفروضةً في وقت التشغيل: محتوىً
 * قديم مخزَّن على الجهاز، أو عنصرٌ ناقص المرجع في البذرة، لا يُرسَل.
 *
 * والمرجع الكامل يختلف باختلاف نوع المصدر: كتب النثر (الفوائد، مدارج السالكين)
 * يُحال إليها بالمجلد والصفحة، وكتب الحديث يُحال إليها **برقم الحديث** — وهو
 * المعتمد في الأدعية، إذ مصادرها كتب حديثٍ تُرقَّم أحاديثها.
 */
const hasPage = (item: { page: number | null }) => item.page != null;
const isDeliverableDua = (item: Dua) =>
  item.collection.trim() !== '' && (item.number != null || item.page != null);

/**
 * مجموعات المعرّفات المتاحة لكل نوع.
 * المقولات تُفلتر حسب العلماء الذين يتابعهم المستخدم؛ الأحاديث متاحة دائماً.
 */
export function availablePools(
  bundle: ContentBundle,
  followedScholarIds: string[],
): Record<ItemKind, string[]> {
  const active = new Set(bundle.scholars.filter((s) => s.is_active).map((s) => s.id));
  const followed = followedScholarIds.filter((id) => active.has(id));
  const allowed = followed.length > 0 ? new Set(followed) : active;
  return {
    quote: // ما لا قائلَ له لا يُستبعد بمتابعة العلماء — فليس لأحدٍ أن يتابعه أو يتركه.
    bundle.quotes.filter((q) => hasPage(q) && (q.scholar_id == null || allowed.has(q.scholar_id))).map((q) => q.id),
    hadith: bundle.hadiths.filter(hasPage).map((h) => h.id),
    // الأدعية بترتيبها المقصود: `sort_order` هو ما يُعرض به ويُعاد من أوّله.
    dua: bundle.duas
      .filter(isDeliverableDua)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => d.id),
  };
}
