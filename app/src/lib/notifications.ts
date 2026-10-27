import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ContentItem, PlanEntry, Scholar } from '../data/types';
import { attributionName } from './format';

export const CHANNEL_ID = 'hekmah-daily';

let handlerConfigured = false;

/** يُستدعى مرة واحدة عند إقلاع التطبيق. */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** قناة أندرويد — مطلوبة حتى تظهر الإشعارات بالأولوية الصحيحة. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'حكمة اليوم',
      description: 'تذكير يومي بمقولة من أقوال العلماء',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 200, 120, 200],
      sound: 'default',
    });
  } catch {
    // لا نوقف التطبيق إذا فشل إنشاء القناة.
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    return settings.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/** يطلب الإذن إن لم يكن ممنوحاً. يعيد true عند الموافقة. */
export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

/** يقتطع نص المقولة ليناسب جسم الإشعار. */
export function notificationBody(text: string, limit = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export interface ScheduleInput {
  plan: PlanEntry[];
  itemsById: Map<string, ContentItem>;
  scholarsById: Map<string, Scholar>;
}

/**
 * يلغي كل الإشعارات المجدولة ويعيد جدولتها من الخطة.
 * كل إشعار يحمل نص مقولته، فلا حاجة لأي خادم إرسال.
 */
export async function syncScheduledNotifications({
  plan,
  itemsById,
  scholarsById,
}: ScheduleInput): Promise<PlanEntry[]> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await ensureAndroidChannel();

  const now = Date.now();
  const scheduled: PlanEntry[] = [];

  for (const entry of plan) {
    const item = itemsById.get(entry.itemId);
    const when = Date.parse(entry.at);
    if (!item || Number.isNaN(when) || when <= now) {
      scheduled.push(entry);
      continue;
    }
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.kind === 'hadith' ? 'حديث اليوم' : 'حكمة اليوم'} · ${attributionName(item, scholarsById)}`,
          body: notificationBody(item.text),
          data: { itemId: item.id },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(when),
          channelId: CHANNEL_ID,
        },
      });
      scheduled.push({ ...entry, notificationId: id });
    } catch {
      scheduled.push({ at: entry.at, itemId: entry.itemId, kind: entry.kind });
    }
  }

  return scheduled;
}

export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // تجاهل
  }
}

/** إشعار تجريبي فوري ليتأكد المستخدم أن التذكير يعمل. */
export async function sendTestNotification(title: string, body: string): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNEL_ID,
    },
  });
}
