import { useCallback, useState } from 'react';
import { RefreshControl, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { ItemHero } from '../../src/components/ItemHero';
import { Banner, Button, EmptyState, IconButton, Txt } from '../../src/components/ui';
import { useApp } from '../../src/store/AppProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';
import { formatGregorian, formatHijri, timeUntil } from '../../src/lib/date';
import { describeSchedule } from '../../src/lib/schedule';
import { kindLabel, shareText } from '../../src/lib/format';

export default function TodayScreen() {
  const { colors } = useTheme();
  const {
    ready,
    todayItem,
    scholarsById,
    sourcesById,
    favorites,
    toggleFavorite,
    drawAnother,
    schedule,
    nextAt,
    permission,
    enableNotifications,
    refresh,
    syncing,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const today = new Date();
  const hijri = formatHijri(today);

  const onCopy = useCallback(async () => {
    if (!todayItem) return;
    await Clipboard.setStringAsync(shareText(todayItem, scholarsById));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [todayItem, scholarsById]);

  const onShare = useCallback(async () => {
    if (!todayItem) return;
    try {
      await Share.share({ message: shareText(todayItem, scholarsById) });
    } catch {
      // ألغى المستخدم المشاركة
    }
  }, [todayItem, scholarsById]);

  const onAnother = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await drawAnother();
  }, [drawAnother]);

  if (!ready) {
    return (
      <Screen>
        <View style={styles.loading} />
      </Screen>
    );
  }

  if (!todayItem) {
    return (
      <Screen>
        <EmptyState
          icon="moon-outline"
          title="لا يوجد محتوى متاح"
          description="تأكد من متابعتك لعالم واحد على الأقل من صفحة العلماء."
        />
        <Button label="فتح صفحة العلماء" onPress={() => router.push('/scholars')} full />
      </Screen>
    );
  }

  const isFavorite = favorites.includes(todayItem.id);
  const source = sourcesById.get(todayItem.source_id) ?? null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.header}>
        <View>
          <Txt variant="caption" faint>
            {formatGregorian(today)}
          </Txt>
          {hijri ? (
            <Txt variant="small" medium muted>
              {hijri}
            </Txt>
          ) : null}
        </View>
        <Txt variant="heading" bold>
          مسك الكلام
        </Txt>
      </View>

      {permission !== 'granted' && schedule.enabled ? (
        <View style={styles.banner}>
          <Banner tone="warn" icon="notifications-off-outline">
            التذكير اليومي لن يصلك قبل السماح بالإشعارات.
          </Banner>
          <Button
            label="السماح بالإشعارات"
            onPress={enableNotifications}
            variant="secondary"
            icon="notifications-outline"
          />
        </View>
      ) : null}

      <ItemHero item={todayItem} scholars={scholarsById} source={source} eyebrow={kindLabel(todayItem)} />

      <View style={styles.actions}>
        <IconButton
          icon={isFavorite ? 'bookmark' : 'bookmark-outline'}
          label={isFavorite ? 'إزالة من المحفوظات' : 'حفظ'}
          onPress={() => toggleFavorite(todayItem.id)}
          active={isFavorite}
        />
        <IconButton icon={copied ? 'checkmark' : 'copy-outline'} label="نسخ" onPress={onCopy} />
        <IconButton icon="share-social-outline" label="مشاركة" onPress={onShare} />
        <Button label="التالي" onPress={onAnother} variant="secondary" icon="refresh-outline" style={styles.grow} />
      </View>

      <View style={[styles.nextCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <View style={styles.grow}>
          <Txt variant="small" medium>
            {schedule.enabled && nextAt ? `القادم ${timeUntil(nextAt)}` : 'التذكير متوقف'}
          </Txt>
          <Txt variant="caption" faint>
            {describeSchedule(schedule)}
          </Txt>
        </View>
        <Button label="تعديل" onPress={() => router.push('/(tabs)/schedule')} variant="ghost" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { height: 300 },
  header: {
    flexDirection: rowRTL,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
    marginTop: space.sm,
  },
  banner: { gap: space.sm, marginBottom: space.lg },
  actions: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm, marginTop: space.lg },
  grow: { flex: 1 },
  nextCard: {
    flexDirection: rowRTL,
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    padding: space.md,
    borderRadius: 16,
    borderWidth: 1,
  },
});
