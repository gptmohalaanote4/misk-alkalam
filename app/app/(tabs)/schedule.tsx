import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TimeSelector } from '../../src/components/TimeSelector';
import { Banner, Button, Card, Chip, Divider, Txt } from '../../src/components/ui';
import { useApp } from '../../src/store/AppProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';
import {
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  activeWeekdays,
  describeSchedule,
  formatTime,
  nextOccurrences,
  normalizeSchedule,
} from '../../src/lib/schedule';
import { sendTestNotification } from '../../src/lib/notifications';
import { relativeDay } from '../../src/lib/date';
import type { ItemKind, Repeat } from '../../src/data/types';

const REPEATS: { key: Repeat; label: string; icon: 'calendar-outline' | 'today-outline' | 'options-outline' }[] = [
  { key: 'daily', label: 'يومياً', icon: 'today-outline' },
  { key: 'weekly', label: 'أسبوعياً', icon: 'calendar-outline' },
  { key: 'custom', label: 'أيام مختارة', icon: 'options-outline' },
];

const KINDS: {
  key: ItemKind;
  label: string;
  icon: 'moon-outline' | 'sparkles-outline' | 'hand-left-outline';
}[] = [
  { key: 'hadith', label: 'أحاديث', icon: 'moon-outline' },
  { key: 'quote', label: 'مقولات العلماء', icon: 'sparkles-outline' },
  { key: 'dua', label: 'أدعية', icon: 'hand-left-outline' },
];

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { schedule, updateSchedule, permission, enableNotifications, delivery } = useApp();
  const [testing, setTesting] = useState(false);

  const days = activeWeekdays(schedule);

  const preview = useMemo(
    () => nextOccurrences(schedule, new Date(), 3),
    [schedule],
  );

  const setRepeat = useCallback(
    (repeat: Repeat) => {
      void updateSchedule(normalizeSchedule(schedule, repeat));
    },
    [schedule, updateSchedule],
  );

  const toggleDay = useCallback(
    (day: number) => {
      if (schedule.repeat === 'weekly') {
        void updateSchedule({ ...schedule, weekdays: [day] });
        return;
      }
      const has = schedule.weekdays.includes(day);
      const next = has ? schedule.weekdays.filter((d) => d !== day) : [...schedule.weekdays, day];
      if (next.length === 0) {
        Alert.alert('اختر يوماً واحداً على الأقل', 'لا يمكن إيقاف جميع الأيام مع إبقاء التذكير مفعّلاً.');
        return;
      }
      void updateSchedule({ ...schedule, weekdays: next.sort((a, b) => a - b) });
    },
    [schedule, updateSchedule],
  );

  const onTest = useCallback(async () => {
    if (permission !== 'granted') {
      const granted = await enableNotifications();
      if (!granted) {
        Alert.alert('الإشعارات غير مفعّلة', 'فعّل الإشعارات لتطبيق «مسك الكلام» من إعدادات الجهاز.');
        return;
      }
    }
    setTesting(true);
    try {
      await sendTestNotification('تجربة التذكير', 'هكذا ستصلك مقولة اليوم في موعدها بإذن الله.');
      Alert.alert('تم', 'سيصلك إشعار تجريبي خلال ثوانٍ.');
    } finally {
      setTesting(false);
    }
  }, [permission, enableNotifications]);

  return (
    <Screen>
      <Txt variant="heading" bold style={styles.title}>
        التذكير
      </Txt>

      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.grow}>
            <Txt variant="bodyLg" medium>
              تذكير بمقولة
            </Txt>
            <Txt variant="small" muted>
              {describeSchedule(schedule)}
            </Txt>
          </View>
          <Switch
            value={schedule.enabled}
            onValueChange={(enabled) => updateSchedule({ ...schedule, enabled })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      {permission !== 'granted' && schedule.enabled ? (
        <View style={styles.block}>
          <Banner tone="warn" icon="notifications-off-outline">
            لم يُسمح بالإشعارات بعد، ولن يصلك التذكير حتى تسمح به.
          </Banner>
          <Button label="السماح بالإشعارات" onPress={enableNotifications} variant="secondary" />
        </View>
      ) : null}

      <Txt variant="title" bold style={styles.sectionTitle}>
        نوع المحتوى
      </Txt>
      <View style={styles.cycle}>
        {KINDS.map((k, index) => (
          <View key={k.key} style={styles.cycleStep}>
            <View style={[styles.cycleBadge, { backgroundColor: colors.primary }]}>
              <Txt variant="caption" bold color={colors.onPrimary}>
                {index + 1}
              </Txt>
            </View>
            <Ionicons name={k.icon} size={14} color={colors.textMuted} />
            <Txt variant="small" medium>
              {k.label}
            </Txt>
            {index < KINDS.length - 1 ? (
              <Ionicons name="arrow-back" size={13} color={colors.textFaint} />
            ) : null}
          </View>
        ))}
      </View>
      <Txt variant="caption" faint style={styles.hint}>
        دورةٌ ثابتة لا تُختار: كل يومٍ نوع، فإذا تمّت الثلاثة استُؤنفت من أوّلها.
      </Txt>

      <Txt variant="title" bold style={styles.sectionTitle}>
        التكرار
      </Txt>
      <View style={styles.chips}>
        {REPEATS.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            icon={r.icon}
            selected={schedule.repeat === r.key}
            onPress={() => setRepeat(r.key)}
          />
        ))}
      </View>

      {schedule.repeat !== 'daily' ? (
        <>
          <Txt variant="title" bold style={styles.sectionTitle}>
            {schedule.repeat === 'weekly' ? 'يوم الأسبوع' : 'أيام الأسبوع'}
          </Txt>
          <View style={styles.chips}>
            {WEEKDAY_SHORT.map((label, index) => (
              <Chip
                key={label}
                label={label}
                selected={days.includes(index)}
                onPress={() => toggleDay(index)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Txt variant="title" bold style={styles.sectionTitle}>
        الوقت
      </Txt>
      <Card style={styles.timeCard}>
        <TimeSelector
          hour={schedule.hour}
          minute={schedule.minute}
          onChange={(hour, minute) => updateSchedule({ ...schedule, hour, minute })}
        />
        <Divider />
        <View style={styles.presets}>
          {[
            { label: 'بعد الفجر', hour: 5, minute: 30 },
            { label: 'الصباح', hour: 7, minute: 30 },
            { label: 'بعد العصر', hour: 16, minute: 30 },
            { label: 'قبل النوم', hour: 21, minute: 30 },
          ].map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              selected={schedule.hour === p.hour && schedule.minute === p.minute}
              onPress={() => updateSchedule({ ...schedule, hour: p.hour, minute: p.minute })}
            />
          ))}
        </View>
      </Card>

      {schedule.enabled && preview.length > 0 ? (
        <>
          <Txt variant="title" bold style={styles.sectionTitle}>
            المواعيد القادمة
          </Txt>
          <Card style={styles.previewCard}>
            {preview.map((date, index) => (
              <View key={date.toISOString()} style={styles.previewRow}>
                <Ionicons
                  name={index === 0 ? 'ellipse' : 'ellipse-outline'}
                  size={9}
                  color={index === 0 ? colors.primary : colors.textFaint}
                />
                <Txt variant="small" medium={index === 0} muted={index !== 0}>
                  {WEEKDAY_NAMES[date.getDay()]} · {relativeDay(date)}
                </Txt>
                <View style={styles.grow} />
                <Txt variant="small" faint>
                  {formatTime(date.getHours(), date.getMinutes())}
                </Txt>
              </View>
            ))}
            <Txt variant="caption" faint style={styles.note}>
              {delivery.plan.length} موعداً مجدولاً على جهازك — تُجدَّد تلقائياً كلما فتحت التطبيق.
            </Txt>
          </Card>
        </>
      ) : null}

      <Button
        label="إرسال إشعار تجريبي"
        onPress={onTest}
        variant="ghost"
        icon="paper-plane-outline"
        loading={testing}
        full
        style={styles.testButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.sm, marginBottom: space.lg },
  card: { marginBottom: space.md },
  block: { gap: space.sm, marginBottom: space.md },
  switchRow: { flexDirection: rowRTL, alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  sectionTitle: { marginTop: space.xl, marginBottom: space.md },
  cycle: {
    flexDirection: rowRTL,
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  cycleStep: {
    flexDirection: rowRTL,
    alignItems: 'center',
    gap: space.xs / 1.5,
  },
  cycleBadge: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: rowRTL, flexWrap: 'wrap', gap: space.sm },
  timeCard: { gap: space.lg },
  presets: { flexDirection: rowRTL, flexWrap: 'wrap', gap: space.sm },
  previewCard: { gap: space.md },
  previewRow: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm },
  note: { marginTop: space.xs },
  hint: { marginTop: space.sm },
  testButton: { marginTop: space.xl },
});
