import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  color: string;
  opacity?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * زخرفة إسلامية متكرّرة (نجمة ثمانية داخل شبكة) تُستخدم خلفيةً خفيفة.
 * مرسومة بـ SVG حتى تبقى حادة على كل الكثافات.
 */
export function OrnamentPattern({ color, opacity = 0.06, size = 56, style }: Props) {
  const h = size / 2;
  const q = size / 4;
  return (
    <Svg style={style} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id="hekmah-ornament" width={size} height={size} patternUnits="userSpaceOnUse">
          <G stroke={color} strokeWidth={1} fill="none" opacity={opacity}>
            {/* نجمة ثمانية */}
            <Path d={`M ${h} ${q} L ${size - q} ${h} L ${h} ${size - q} L ${q} ${h} Z`} />
            <Path d={`M ${q} ${q} L ${size - q} ${q} L ${size - q} ${size - q} L ${q} ${size - q} Z`} />
            {/* وصلات الشبكة */}
            <Path d={`M 0 0 L ${q} ${q} M ${size} 0 L ${size - q} ${q}`} />
            <Path d={`M 0 ${size} L ${q} ${size - q} M ${size} ${size} L ${size - q} ${size - q}`} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hekmah-ornament)" />
    </Svg>
  );
}

/** فاصل زخرفي صغير يوضع بين النص ومصدره. */
export function OrnamentDivider({ color, width = 90 }: { color: string; width?: number }) {
  const h = 14;
  const mid = width / 2;
  return (
    <Svg width={width} height={h}>
      <G stroke={color} strokeWidth={1.2} fill="none" opacity={0.75}>
        <Path d={`M 0 ${h / 2} L ${mid - 12} ${h / 2}`} />
        <Path d={`M ${mid + 12} ${h / 2} L ${width} ${h / 2}`} />
        <Path d={`M ${mid} 2 L ${mid + 7} ${h / 2} L ${mid} ${h - 2} L ${mid - 7} ${h / 2} Z`} />
      </G>
    </Svg>
  );
}
