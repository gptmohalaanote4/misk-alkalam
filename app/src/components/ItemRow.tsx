import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContentItem, Scholar } from '../data/types';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { rowRTL } from '../theme/rtl';
import { attributionName, referenceLine } from '../lib/format';
import { Card, IconButton, Txt } from './ui';

interface Props {
  item: ContentItem;
  scholars: Map<string, Scholar>;
  caption?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

/** صف في المكتبة أو السجل: الاسم أعلى، ثم النص، ثم المرجع بخط صغير. */
export function ItemRow({ item, scholars, caption, isFavorite, onToggleFavorite, onPress }: Props) {
  const { colors } = useTheme();
  // لونُ النقطة يميّز النوع: حديثٌ ذهبي، ودعاءٌ سماوي، ومقولةٌ بلون التطبيق.
  const dotColor =
    item.kind === 'hadith' ? colors.gold : item.kind === 'dua' ? colors.accent : colors.primary;

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.headerStart}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Txt variant="small" medium>
            {attributionName(item, scholars)}
          </Txt>
          {caption ? (
            <Txt variant="caption" faint>
              {caption}
            </Txt>
          ) : null}
        </View>
        <IconButton
          icon={isFavorite ? 'bookmark' : 'bookmark-outline'}
          label={isFavorite ? 'إزالة من المحفوظات' : 'حفظ'}
          onPress={onToggleFavorite}
          active={isFavorite}
          size={17}
        />
      </View>

      <Txt serif variant="bodyLg" numberOfLines={4} style={styles.text}>
        {item.text}
      </Txt>

      <View style={styles.footer}>
        <Ionicons name={item.kind === 'quote' ? 'book-outline' : 'bookmarks-outline'} size={13} color={colors.textFaint} />
        <Txt variant="caption" faint>
          {referenceLine(item)}
        </Txt>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, marginBottom: space.md },
  header: { flexDirection: rowRTL, alignItems: 'center', justifyContent: 'space-between' },
  headerStart: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  text: { marginTop: -space.xs },
  footer: { flexDirection: rowRTL, alignItems: 'center', gap: space.xs },
});
