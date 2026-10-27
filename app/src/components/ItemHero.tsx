import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ContentItem, Scholar, Source } from '../data/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, fontSize, radius, space } from '../theme/tokens';
import { rowRTL } from '../theme/rtl';
import { attributionName, attributionSub, referenceLine } from '../lib/format';
import { OrnamentDivider, OrnamentPattern } from './Ornament';
import { Txt } from './ui';

/** أيقونة كل نوع — موضعٌ واحد يجمعها فلا تتفرّق في الشاشات. */
const KIND_ICON: Record<ContentItem['kind'], 'moon-outline' | 'sparkles-outline' | 'hand-left-outline'> = {
  hadith: 'moon-outline',
  quote: 'sparkles-outline',
  dua: 'hand-left-outline',
};

interface Props {
  item: ContentItem;
  scholars: Map<string, Scholar>;
  source: Source | null;
  /** سطر علوي صغير: "مقولة اليوم" أو "حديث اليوم". */
  eyebrow?: string;
}

/** حجم الخط يتكيّف مع طول النص حتى تبقى البطاقة متوازنة. */
function textSize(length: number): number {
  if (length <= 90) return fontSize.quoteLg;
  if (length <= 200) return fontSize.quoteMd;
  return fontSize.quoteSm;
}

/**
 * البطاقة البطلة. ترتيب العناصر:
 *   الاسم (العالم أو «قال رسول الله ﷺ») → النص → المرجع بخط صغير.
 */
export function ItemHero({ item, scholars, source, eyebrow }: Props) {
  const { colors } = useTheme();
  const size = textSize(item.text.length);
  const sub = attributionSub(item);
  const reference = referenceLine(item);

  return (
    <View style={[styles.wrapper, { shadowColor: colors.shadow }]}>
      <LinearGradient
        colors={colors.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={StyleSheet.absoluteFill}>
          <OrnamentPattern color="#FFFFFF" opacity={0.08} size={64} />
        </View>

        {eyebrow ? (
          <View style={styles.eyebrow}>
            <Ionicons
              name={KIND_ICON[item.kind]}
              size={13}
              color="rgba(255,255,255,0.75)"
            />
            <Txt variant="caption" color="rgba(255,255,255,0.75)" medium>
              {eyebrow}
            </Txt>
          </View>
        ) : null}

        {/* الاسم في الأعلى */}
        <Txt variant="title" center bold color="#FFFFFF" serif={item.kind !== 'quote'}>
          {attributionName(item, scholars)}
        </Txt>
        {sub ? (
          <Txt variant="caption" center color="rgba(255,255,255,0.72)">
            {sub}
          </Txt>
        ) : null}

        <View style={styles.dividerWrap}>
          <OrnamentDivider color="rgba(255,255,255,0.45)" />
        </View>

        {/* النص */}
        <Txt
          serif
          center
          color="#FFFFFF"
          style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.95) }]}
        >
          {item.text}
        </Txt>

        {/* المرجع بخط صغير أسفل النص */}
        {reference ? (
          <Txt variant="caption" center color="rgba(255,255,255,0.75)" style={styles.reference}>
            {reference}
          </Txt>
        ) : null}

        {source ? (
          <View style={styles.sourceTag}>
            <Ionicons name="library-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Txt variant="caption" color="rgba(255,255,255,0.7)">
              {source.name}
            </Txt>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  gradient: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    minHeight: 300,
    justifyContent: 'center',
  },
  eyebrow: {
    flexDirection: rowRTL,
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.lg,
  },
  dividerWrap: { marginVertical: space.md },
  text: { fontFamily: fonts.serif, marginBottom: space.lg },
  reference: { opacity: 0.95 },
  sourceTag: {
    flexDirection: rowRTL,
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
