/**
 * نظام التصميم — "مسك الكلام"
 * لوحة ألوان دافئة مستوحاة من الورق والحبر والزخرفة الإسلامية،
 * مع وضعين: فاتح (ورق) وداكن (ليل).
 */

import type { ItemKind } from '../data/types';

export type ThemeName = 'light' | 'dark';

/**
 * لونُ القسم — «حِبرٌ ومِداد».
 *
 * لكلِّ نوعٍ حِبرُه من عائلة المخطوط نفسها، فيُعرف القسم من لونه قبل قراءة سطر:
 * الحديثُ زمرّديّ (وهو عمود التطبيق)، والمقولةُ بنّيٌّ ذهبيّ (لونُ الحبر في
 * الكتب)، والدعاءُ نيليّ. وهذا **لون المحتوى وحده**؛ وهيكلُ الواجهة — الأزرار
 * والتبويبات — يبقى على `primary` الزمرديّ، وإلّا تبدّل وجهُ التطبيق كلَّ يوم.
 */
export interface KindPalette {
  /** اللون على سطحٍ عادي: نقطةُ الصفّ، والأيقونة، والسطر العلوي. */
  tint: string;
  /** تدرّجُ البطاقة البطلة — ثلاثُ درجاتٍ من الفاتح إلى الغامق. */
  gradient: [string, string, string];
}

export interface Palette {
  /** خلفية الشاشة الأساسية */
  bg: string;
  /** خلفية بديلة متدرجة (أعلى الشاشة) */
  bgAlt: string;
  /** أسطح البطاقات */
  surface: string;
  /** سطح مرتفع (حوارات، شرائح) */
  surfaceAlt: string;
  /** حدود خفيفة */
  border: string;
  /** حد أوضح للعناصر التفاعلية */
  borderStrong: string;
  /** النص الأساسي */
  text: string;
  /** نص ثانوي */
  textMuted: string;
  /** نص خافت جداً */
  textFaint: string;
  /** اللون الرئيسي (زمردي) */
  primary: string;
  /** درجة أفتح/أغمق من الرئيسي للخلفيات */
  primarySoft: string;
  /** نص فوق اللون الرئيسي */
  onPrimary: string;
  /** لون التمييز الذهبي */
  gold: string;
  /** ذهبي ناعم للخلفيات */
  goldSoft: string;
  /** لون ثالث يميّز الأدعية عن الأحاديث والمقولات */
  accent: string;
  /** حِبرُ كل قسم — انظر `KindPalette`. */
  kinds: Record<ItemKind, KindPalette>;
  /** أحمر للأخطاء */
  danger: string;
  /** خلفية خافتة للخطأ */
  dangerSoft: string;
  /** أخضر للنجاح */
  success: string;
  /** لون الزخرفة الهندسية */
  ornament: string;
  /** ظل */
  shadow: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F7F3EA',
    bgAlt: '#FFFDF8',
    surface: '#FFFFFF',
    surfaceAlt: '#FBF7EF',
    border: '#E7DFD0',
    borderStrong: '#D6CAB4',
    text: '#17211D',
    textMuted: '#5F6B64',
    textFaint: '#95A09A',
    primary: '#0E6B58',
    primarySoft: '#E3F0EC',
    onPrimary: '#FFFFFF',
    gold: '#A9822B',
    goldSoft: '#F6EEDC',
    accent: '#2E6E8E',
    kinds: {
      hadith: { tint: '#0E6B58', gradient: ['#0E6B58', '#0B5547', '#083E35'] },
      quote: { tint: '#8A5A2B', gradient: ['#8A5A2B', '#6E4722', '#523419'] },
      dua: { tint: '#2E6E8E', gradient: ['#2E6E8E', '#255770', '#1B4053'] },
    },
    danger: '#B3261E',
    dangerSoft: '#FBEAE8',
    success: '#1F7A4D',
    ornament: '#0E6B58',
    shadow: '#1A2B25',
  },
  dark: {
    bg: '#0C110F',
    bgAlt: '#121916',
    surface: '#161F1B',
    surfaceAlt: '#1D2823',
    border: '#27332D',
    borderStrong: '#36443D',
    text: '#F0EDE4',
    textMuted: '#A3AFA8',
    textFaint: '#6E7B74',
    primary: '#49B294',
    primarySoft: '#16302A',
    onPrimary: '#04241C',
    gold: '#D9B661',
    goldSoft: '#2A2416',
    accent: '#6FB3D2',
    // في الليل تُرفع الدرجةُ للنصّ الأبيض ويُخفَض التشبّع، وإلّا ابتلع السوادُ الفرق.
    kinds: {
      hadith: { tint: '#49B294', gradient: ['#10493D', '#0C332C', '#081F1B'] },
      quote: { tint: '#C99A52', gradient: ['#4A331A', '#382614', '#26190D'] },
      dua: { tint: '#6FB3D2', gradient: ['#1C3F52', '#15303E', '#0E212B'] },
    },
    danger: '#F2938C',
    dangerSoft: '#3A1F1D',
    success: '#5BC68E',
    ornament: '#49B294',
    shadow: '#000000',
  },
};

/** مقياس المسافات (٤ نقاط) */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** انحناءات الزوايا */
export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** أحجام الخطوط */
export const fontSize = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLg: 17,
  title: 20,
  heading: 24,
  display: 30,
  quoteSm: 21,
  quoteMd: 25,
  quoteLg: 29,
} as const;

export const fonts = {
  /** خط النصوص الشرعية (نسخي) */
  serif: 'Amiri_400Regular',
  serifBold: 'Amiri_700Bold',
  serifItalic: 'Amiri_400Regular_Italic',
  /** خط الواجهة */
  sans: 'Tajawal_400Regular',
  sansMedium: 'Tajawal_500Medium',
  sansBold: 'Tajawal_700Bold',
} as const;

export const shadows = {
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  hero: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
} as const;
