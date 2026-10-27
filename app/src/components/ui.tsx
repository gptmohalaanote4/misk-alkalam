import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, fontSize, radius, space } from '../theme/tokens';
import { rowRTL, startRTL } from '../theme/rtl';

/* ─────────────── نص ─────────────── */

type TextVariant = 'display' | 'heading' | 'title' | 'body' | 'bodyLg' | 'small' | 'caption';

const VARIANT_SIZE: Record<TextVariant, number> = {
  display: fontSize.display,
  heading: fontSize.heading,
  title: fontSize.title,
  bodyLg: fontSize.bodyLg,
  body: fontSize.body,
  small: fontSize.small,
  caption: fontSize.caption,
};

interface TxtProps {
  children: React.ReactNode;
  variant?: TextVariant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  bold?: boolean;
  medium?: boolean;
  serif?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function Txt({
  children,
  variant = 'body',
  muted,
  faint,
  color,
  bold,
  medium,
  serif,
  center,
  style,
  numberOfLines,
}: TxtProps) {
  const { colors } = useTheme();
  const resolved = color ?? (faint ? colors.textFaint : muted ? colors.textMuted : colors.text);
  const family = serif ? (bold ? fonts.serifBold : fonts.serif) : bold ? fonts.sansBold : medium ? fonts.sansMedium : fonts.sans;
  const size = VARIANT_SIZE[variant];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: resolved,
          fontFamily: family,
          fontSize: size,
          lineHeight: Math.round(size * (serif ? 1.9 : 1.6)),
          textAlign: center ? 'center' : 'right',
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ─────────────── أزرار ─────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  full,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  };
  const tone = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : startRTL,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={tone.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: tone.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  active?: boolean;
  size?: number;
}

export function IconButton({ icon, onPress, label, active, size = 20 }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={size} color={active ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

/* ─────────────── بطاقات وشرائح ─────────────── */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.textMuted} />
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.onPrimary : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="title" bold>
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

/* ─────────────── حقول الإدخال ─────────────── */

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'url';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  hint?: string;
  dir?: 'rtl' | 'ltr';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType = 'default',
  secureTextEntry,
  autoCapitalize = 'sentences',
  hint,
  dir = 'rtl',
}: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Txt variant="small" medium muted>
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
            textAlign: dir === 'rtl' ? 'right' : 'left',
            writingDirection: dir,
            minHeight: multiline ? 120 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {hint ? (
        <Txt variant="caption" faint>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Banner({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const bg = tone === 'error' ? colors.dangerSoft : tone === 'warn' ? colors.goldSoft : colors.primarySoft;
  const fg = tone === 'error' ? colors.danger : tone === 'warn' ? colors.gold : colors.primary;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon ?? 'information-circle-outline'} size={18} color={fg} />
      <View style={styles.bannerBody}>
        <Txt variant="small" color={fg}>
          {children}
        </Txt>
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={28} color={colors.textFaint} />
      </View>
      <Txt variant="bodyLg" medium center>
        {title}
      </Txt>
      {description ? (
        <Txt variant="small" muted center>
          {description}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: rowRTL,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 46,
  },
  buttonLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.body,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  chip: {
    flexDirection: rowRTL,
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.small,
  },
  sectionHeader: {
    flexDirection: rowRTL,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    marginTop: space.xl,
  },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  field: { gap: space.xs, marginBottom: space.lg },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.sans,
    fontSize: fontSize.body,
  },
  banner: {
    flexDirection: rowRTL,
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  bannerBody: { flex: 1 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
