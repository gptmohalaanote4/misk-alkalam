import AsyncStorage from '@react-native-async-storage/async-storage';

/** قراءة قيمة JSON من التخزين المحلي، مع إرجاع null عند أي خطأ. */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** كتابة قيمة JSON في التخزين المحلي. تتجاهل الأخطاء (تخزين ممتلئ أو محظور). */
export async function setItem(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين غير متاح — نتابع دون إيقاف التطبيق.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // تجاهل
  }
}

export const KEYS = {
  schedule: 'hekmah.schedule',
  plan: 'hekmah.delivery-plan',
  history: 'hekmah.history',
  queue: 'hekmah.queue',
  favorites: 'hekmah.favorites',
  followedScholars: 'hekmah.followed-scholars',
  contentCache: 'hekmah.content-cache',
  onboarded: 'hekmah.onboarded',
  pendingQuoteId: 'hekmah.pending-quote',
} as const;
