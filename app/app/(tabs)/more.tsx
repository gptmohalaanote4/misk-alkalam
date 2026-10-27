import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, Chip, Divider, Txt } from '../../src/components/ui';
import { useApp } from '../../src/store/AppProvider';
import { useAuth } from '../../src/store/AuthProvider';
import { useTheme, type ThemePreference } from '../../src/theme/ThemeProvider';
import { radius, space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.grow}>
        <Txt variant="bodyLg" medium>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" faint>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.textFaint} />
    </Card>
  );
}

export default function MoreScreen() {
  const { content, followed, delivery, syncing } = useApp();
  const { isAdmin, remoteEnabled, profile } = useAuth();
  const { preference, setPreference } = useTheme();

  const followedCount = followed.length > 0 ? followed.length : content.scholars.length;

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'حسب النظام' },
    { key: 'light', label: 'فاتح' },
    { key: 'dark', label: 'داكن' },
  ];

  return (
    <Screen>
      <Txt variant="heading" bold style={styles.title}>
        المزيد
      </Txt>

      <Row
        icon="people-outline"
        title="العلماء"
        subtitle={`${content.scholars.length} عالم · تتابع ${followedCount}`}
        onPress={() => router.push('/scholars')}
      />
      <Row
        icon="library-outline"
        title="المصادر"
        subtitle={`${content.sources.length} مصدر · الافتراضي موقع تراث`}
        onPress={() => router.push('/sources')}
      />
      <Row
        icon="shield-checkmark-outline"
        title="لوحة الأدمن"
        subtitle={
          !remoteEnabled
            ? 'غير مفعّلة — يلزم ضبط الاتصال بالخادم'
            : isAdmin
              ? `مسجّل الدخول: ${profile?.email ?? ''}`
              : 'إضافة العلماء والمصادر — للأدمن فقط'
        }
        onPress={() => router.push('/admin' as Href)}
      />
      <Row icon="information-circle-outline" title="عن التطبيق" onPress={() => router.push('/about')} />

      <Txt variant="title" bold style={styles.sectionTitle}>
        المظهر
      </Txt>
      <View style={styles.chips}>
        {themeOptions.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            selected={preference === opt.key}
            onPress={() => setPreference(opt.key)}
          />
        ))}
      </View>

      <Card style={styles.statsCard}>
        <View style={styles.statRow}>
          <Txt variant="small" muted>
            المحتوى المتاح
          </Txt>
          <Txt variant="small" medium>
            {content.quotes.length} مقولة · {content.hadiths.length} حديثاً
          </Txt>
        </View>
        <Divider />
        <View style={styles.statRow}>
          <Txt variant="small" muted>
            وصلتك
          </Txt>
          <Txt variant="small" medium>
            {delivery.history.length}
          </Txt>
        </View>
        <Divider />
        <View style={styles.statRow}>
          <Txt variant="small" muted>
            حالة المحتوى
          </Txt>
          <Txt variant="small" medium>
            {syncing
              ? 'جارٍ التحديث…'
              : content.syncedAt
                ? 'مُحدَّث من الخادم'
                : 'المحتوى المدمج'}
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.sm, marginBottom: space.lg },
  row: { flexDirection: rowRTL, alignItems: 'center', gap: space.md, marginBottom: space.sm },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  sectionTitle: { marginTop: space.xl, marginBottom: space.md },
  chips: { flexDirection: rowRTL, gap: space.sm, flexWrap: 'wrap' },
  statsCard: { marginTop: space.xl, gap: space.md },
  statRow: { flexDirection: rowRTL, alignItems: 'center', justifyContent: 'space-between' },
});
