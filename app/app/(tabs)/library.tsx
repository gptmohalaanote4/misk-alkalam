import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ItemRow } from '../../src/components/ItemRow';
import { Chip, EmptyState, Txt } from '../../src/components/ui';
import { useApp } from '../../src/store/AppProvider';
import { space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';
import { relativeDay } from '../../src/lib/date';
import { allItems } from '../../src/lib/content';
import type { ContentItem } from '../../src/data/types';

type Tab = 'all' | 'quotes' | 'hadiths' | 'received' | 'saved';

export default function LibraryScreen() {
  const { content, itemsById, scholarsById, delivery, favorites, toggleFavorite } = useApp();
  const [tab, setTab] = useState<Tab>('all');

  /** السجل بدون تكرار، الأحدث أولاً. */
  const received = useMemo(() => {
    const seen = new Set<string>();
    const out: { itemId: string; at: string }[] = [];
    for (let i = delivery.history.length - 1; i >= 0; i--) {
      const entry = delivery.history[i];
      if (seen.has(entry.itemId)) continue;
      seen.add(entry.itemId);
      out.push(entry);
    }
    return out;
  }, [delivery.history]);

  const rows = useMemo<{ item: ContentItem; caption?: string }[]>(() => {
    const pick = (ids: string[]) =>
      ids.map((id) => itemsById.get(id)).filter((i): i is ContentItem => Boolean(i)).map((item) => ({ item }));

    if (tab === 'received') {
      return received
        .map((e) => ({ item: itemsById.get(e.itemId), caption: relativeDay(new Date(e.at)) }))
        .filter((r): r is { item: ContentItem; caption: string } => Boolean(r.item));
    }
    if (tab === 'saved') return pick(favorites);
    if (tab === 'quotes') return content.quotes.map((item) => ({ item }));
    if (tab === 'hadiths') return content.hadiths.map((item) => ({ item }));
    return allItems(content).map((item) => ({ item }));
  }, [tab, received, favorites, content, itemsById]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: `الكل (${content.quotes.length + content.hadiths.length})` },
    { key: 'hadiths', label: `أحاديث (${content.hadiths.length})` },
    { key: 'quotes', label: `مقولات (${content.quotes.length})` },
    { key: 'received', label: `وصلتني (${received.length})` },
    { key: 'saved', label: `محفوظة (${favorites.length})` },
  ];

  return (
    <Screen>
      <Txt variant="heading" bold style={styles.title}>
        المكتبة
      </Txt>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon={tab === 'saved' ? 'bookmark-outline' : 'book-outline'}
          title={tab === 'saved' ? 'لم تحفظ شيئاً بعد' : 'لا يوجد محتوى هنا'}
          description={tab === 'saved' ? 'اضغط على علامة الحفظ لتجده هنا.' : undefined}
        />
      ) : (
        rows.map(({ item, caption }) => (
          <ItemRow
            key={item.id}
            item={item}
            scholars={scholarsById}
            caption={caption}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            onPress={() => router.push({ pathname: '/quote/[id]', params: { id: item.id } })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.sm, marginBottom: space.lg },
  tabs: { flexDirection: rowRTL, gap: space.sm, marginBottom: space.lg, flexWrap: 'wrap' },
});
