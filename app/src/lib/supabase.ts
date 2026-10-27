import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * التطبيق يعمل كاملاً بلا خادم اعتماداً على المحتوى المدمج.
 * عند ضبط متغيّرات Supabase تُفعَّل المزامنة ولوحة الأدمن.
 */
export const isRemoteEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isRemoteEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // التطبيق ليس متصفحاً، فلا يوجد عنوان يحمل رمز الجلسة.
        detectSessionInUrl: false,
      },
    })
  : null;
