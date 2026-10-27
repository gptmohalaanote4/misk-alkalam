import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Banner, Button, Card, Chip, Txt } from '../src/components/ui';
import { useApp } from '../src/store/AppProvider';
import { useAuth } from '../src/store/AuthProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { space } from '../src/theme/tokens';
import { rowRTL } from '../src/theme/rtl';

export default function SourcesScreen() {
  const { colors } = useTheme();
  const { content } = useApp();
  const { isAdmin } = useAuth();

  return (
    <Screen>
      <View style={styles.intro}>
        <Banner icon="library-outline">
          «موقع تراث» هو المصدر الافتراضي المعتمد. إضافة أي مصدر آخر صلاحية الأدمن وحده،
          ويفرضها الخادم لا الواجهة.
        </Banner>
      </View>

      {content.sources.map((source) => {
        const count =
          content.quotes.filter((q) => q.source_id === source.id).length +
          content.hadiths.filter((h) => h.source_id === source.id).length;
        return (
          <Card key={source.id} style={styles.card}>
            <View style={styles.header}>
              <Ionicons
                name={source.kind === 'turath' ? 'library' : 'globe-outline'}
                size={20}
                color={colors.primary}
              />
              <Txt variant="bodyLg" bold style={styles.grow}>
                {source.name}
              </Txt>
              {source.is_default ? <Chip label="الافتراضي" /> : null}
            </View>
            {source.note ? (
              <Txt variant="small" muted>
                {source.note}
              </Txt>
            ) : null}
            {source.base_url ? (
              <Txt variant="caption" faint>
                {source.base_url}
              </Txt>
            ) : null}
            <Txt variant="caption" faint>
              {count} عنصراً من هذا المصدر
              {source.is_builtin ? ' · مصدر مدمج لا يُحذف' : ''}
            </Txt>
          </Card>
        );
      })}

      {isAdmin ? (
        <Button
          label="إضافة مصدر جديد"
          icon="add-circle-outline"
          onPress={() => router.push('/admin' as Href)}
          full
          style={styles.addButton}
        />
      ) : (
        <Txt variant="caption" faint center style={styles.addButton}>
          إضافة مصدر غير «تراث» متاحة للأدمن فقط.
        </Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.md, marginBottom: space.lg },
  card: { gap: space.sm, marginBottom: space.md },
  header: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  addButton: { marginTop: space.lg },
});
