import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, space } from '../theme/tokens';
import { rowRTL } from '../theme/rtl';
import { Txt } from './ui';

interface Props {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

const MINUTE_STEP = 5;

function Stepper({
  value,
  label,
  onUp,
  onDown,
}: {
  value: string;
  label: string;
  onUp: () => void;
  onDown: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`زيادة ${label}`}
        onPress={onUp}
        style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Ionicons name="chevron-up" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={[styles.valueBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Txt center style={[styles.value, { color: colors.text }]}>
          {value}
        </Txt>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`إنقاص ${label}`}
        onPress={onDown}
        style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Txt variant="caption" faint>
        {label}
      </Txt>
    </View>
  );
}

/** مُحدِّد وقت بسيط بخطوة ٥ دقائق، بدون اعتماد على مكوّنات نظام إضافية. */
export function TimeSelector({ hour, minute, onChange }: Props) {
  const { colors } = useTheme();
  const isAm = hour < 12;
  const display12 = hour % 12 === 0 ? 12 : hour % 12;

  const shiftHour = (delta: number) => onChange((hour + delta + 24) % 24, minute);
  const shiftMinute = (delta: number) => {
    const total = hour * 60 + minute + delta * MINUTE_STEP;
    const wrapped = ((total % 1440) + 1440) % 1440;
    onChange(Math.floor(wrapped / 60), wrapped % 60);
  };
  const setPeriod = (am: boolean) => {
    if (am === isAm) return;
    onChange((hour + 12) % 24, minute);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Stepper
          value={String(display12)}
          label="الساعة"
          onUp={() => shiftHour(1)}
          onDown={() => shiftHour(-1)}
        />
        <Txt style={[styles.colon, { color: colors.textFaint }]}>:</Txt>
        <Stepper
          value={String(minute).padStart(2, '0')}
          label="الدقيقة"
          onUp={() => shiftMinute(1)}
          onDown={() => shiftMinute(-1)}
        />
      </View>

      <View style={styles.periods}>
        {[
          { label: 'صباحاً', am: true },
          { label: 'مساءً', am: false },
        ].map((p) => {
          const selected = p.am === isAm;
          return (
            <Pressable
              key={p.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setPeriod(p.am)}
              style={[
                styles.period,
                {
                  backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Txt variant="small" medium color={selected ? colors.onPrimary : colors.textMuted}>
                {p.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: space.lg },
  row: { flexDirection: rowRTL, alignItems: 'center', gap: space.md },
  stepper: { alignItems: 'center', gap: space.xs },
  arrow: { padding: space.xs },
  valueBox: {
    minWidth: 78,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  value: { fontFamily: fonts.sansBold, fontSize: 30, lineHeight: 40 },
  colon: { fontFamily: fonts.sansBold, fontSize: 26, marginBottom: 18 },
  periods: { flexDirection: rowRTL, gap: space.sm },
  period: {
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
