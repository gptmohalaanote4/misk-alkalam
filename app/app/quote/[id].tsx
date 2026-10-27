import { useCallback } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../src/components/Screen';
import { ItemHero } from '../../src/components/ItemHero';
import { Button, EmptyState, IconButton } from '../../src/components/ui';
import { useApp } from '../../src/store/AppProvider';
import { space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';
import { kindLabel, shareText } from '../../src/lib/format';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { itemsById, scholarsById, sourcesById, favorites, toggleFavorite } = useApp();
  const item = typeof id === 'string' ? itemsById.get(id) : undefined;

  const onShare = useCallback(async () => {
    if (!item) return;
    try {
      await Share.share({ message: shareText(item, scholarsById) });
    } catch {
      // ألغى المستخدم المشاركة
    }
  }, [item, scholarsById]);

  if (!item) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="لم يُعثر على هذا المحتوى" />
      </Screen>
    );
  }

  const isFavorite = favorites.includes(item.id);

  return (
    <Screen contentStyle={styles.content}>
      <ItemHero
        item={item}
        scholars={scholarsById}
        source={sourcesById.get(item.source_id) ?? null}
        eyebrow={kindLabel(item)}
      />
      <View style={styles.actions}>
        <IconButton
          icon={isFavorite ? 'bookmark' : 'bookmark-outline'}
          label={isFavorite ? 'إزالة من المحفوظات' : 'حفظ'}
          onPress={() => toggleFavorite(item.id)}
          active={isFavorite}
        />
        <IconButton
          icon="copy-outline"
          label="نسخ"
          onPress={() => Clipboard.setStringAsync(shareText(item, scholarsById))}
        />
        <Button label="مشاركة" onPress={onShare} variant="secondary" icon="share-social-outline" style={styles.grow} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md },
  actions: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm, marginTop: space.lg },
  grow: { flex: 1 },
});
