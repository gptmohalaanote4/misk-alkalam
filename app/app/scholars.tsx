import { StyleSheet, Switch, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Banner, Button, Card, Txt } from '../src/components/ui';
import { useApp } from '../src/store/AppProvider';
import { useAuth } from '../src/store/AuthProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { radius, space } from '../src/theme/tokens';
import { rowRTL } from '../src/theme/rtl';

export default function ScholarsScreen() {
  const { colors } = useTheme();
  const { content, followed, toggleFollow } = useApp();
  const { isAdmin } = useAuth();

  const isFollowed = (id: string) => followed.length === 0 || followed.includes(id);

  return (
    <Screen>
      <View style={styles.intro}>
        <Banner icon="people-outline">
          اختر العلماء الذين تودّ أن تصلك مقولاتهم. إضافة عالم جديد صلاحية الأدمن وحده.
        </Banner>
      </View>

      {content.scholars.map((scholar) => {
        const count = content.quotes.filter((q) => q.scholar_id === scholar.id).length;
        const followedNow = isFollowed(scholar.id);
        return (
          <Card key={scholar.id} style={styles.card}>
            <View style={styles.header}>
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <Txt variant="title" bold color={colors.primary} serif>
                  {scholar.name.charAt(0)}
                </Txt>
              </View>
              <View style={styles.grow}>
                <Txt variant="bodyLg" bold>
                  {scholar.name}
                </Txt>
                <Txt variant="caption" faint>
                  {[scholar.era, scholar.death_year_hijri ? `ت ${scholar.death_year_hijri} هـ` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              </View>
              <Switch
                value={followedNow}
                onValueChange={() => {
                  // أول تعديل يحوّل "الكل" إلى اختيار صريح.
                  if (followed.length === 0) {
                    const others = content.scholars.filter((s) => s.id !== scholar.id).map((s) => s.id);
                    if (others.length === 0) return;
                    void Promise.all(others.map((id) => toggleFollow(id)));
                    return;
                  }
                  void toggleFollow(scholar.id);
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>

            {scholar.full_name ? (
              <Txt variant="small" muted>
                {scholar.full_name}
              </Txt>
            ) : null}

            {scholar.bio ? (
              <Txt variant="small" muted style={styles.bio}>
                {scholar.bio}
              </Txt>
            ) : null}

            <View style={styles.footer}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textFaint} />
              <Txt variant="caption" faint>
                {count} مقولة
              </Txt>
            </View>
          </Card>
        );
      })}

      {isAdmin ? (
        <Button
          label="إضافة عالم جديد"
          icon="add-circle-outline"
          onPress={() => router.push('/admin' as Href)}
          full
          style={styles.addButton}
        />
      ) : (
        <View style={styles.adminNote}>
          <Txt variant="caption" faint center>
            إضافة عالم جديد متاحة للأدمن فقط.
          </Txt>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.md, marginBottom: space.lg },
  card: { gap: space.sm, marginBottom: space.md },
  header: { flexDirection: rowRTL, alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  bio: { marginTop: space.xs },
  footer: { flexDirection: rowRTL, alignItems: 'center', gap: space.xs, marginTop: space.xs },
  addButton: { marginTop: space.lg },
  adminNote: { marginTop: space.lg },
});
