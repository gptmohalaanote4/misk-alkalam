import { I18nManager } from 'react-native';
import type { FlexStyle } from 'react-native';

/**
 * التطبيق عربي بالكامل، لكن اتجاه محرّك التخطيط يتبع لغة الجهاز.
 * هذه الثوابت تضمن أن يبدأ كل صف من اليمين سواء كان الجهاز عربياً أو إنجليزياً،
 * دون الحاجة إلى forceRTL الذي يتطلّب إعادة تشغيل التطبيق.
 */
export const isRTLLayout: boolean = I18nManager.isRTL;

/** صف أفقي يبدأ من اليمين. */
export const rowRTL: FlexStyle['flexDirection'] = isRTLLayout ? 'row' : 'row-reverse';

/** بداية المحور (اليمين) لعناصر مثل alignSelf. */
export const startRTL: FlexStyle['alignSelf'] = isRTLLayout ? 'flex-start' : 'flex-end';

/** نهاية المحور (اليسار). */
export const endRTL: FlexStyle['alignSelf'] = isRTLLayout ? 'flex-end' : 'flex-start';
