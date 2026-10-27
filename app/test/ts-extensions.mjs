/**
 * يسمح لمُشغّل اختبارات node بقراءة مصادر التطبيق كما هي، في أمرين:
 *
 *   ١) الاستيراد بلا لاحقة (`./schedule`) — يفهمه Metro و TypeScript، ويطلب
 *      مُحمّل ESM في node اللاحقة صريحةً. فنُلحقها وقت الحلّ.
 *   ٢) استيراد JSON — يطلبه node بسمة `with { type: 'json' }`، ولا يطلبها
 *      Metro. فنضيفها وقت الحلّ لملفات ‎.json‎ وحدها.
 *
 * فبدل تغيير أسلوب الاستيراد في المشروع كلّه من أجل الاختبارات، يُحتوى
 * الفرق هنا. يعمل بـ node وحده (`module.registerHooks`) — بلا تبعيات.
 */
import { registerHooks } from 'node:module';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/** يضيف سمة JSON إلى نتيجة الحلّ إن كان الملف JSON. */
function withJsonAttribute(resolved) {
  if (!resolved?.url?.endsWith('.json')) return resolved;
  return { ...resolved, importAttributes: { ...resolved.importAttributes, type: 'json' } };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // السمة تُضاف قبل الحلّ أيضاً، لأن node يرفض JSON بلا سمة عند التحميل.
    const attributed =
      specifier.endsWith('.json')
        ? { ...context, importAttributes: { ...context.importAttributes, type: 'json' } }
        : context;
    try {
      return withJsonAttribute(nextResolve(specifier, attributed));
    } catch (error) {
      // لا نُخمّن إلا في المسارات النسبية بلا لاحقة — وما عداها يُرفع خطؤه كما هو.
      if (!specifier.startsWith('.') || /\.[cm]?[jt]sx?$|\.json$/.test(specifier)) throw error;
      for (const ext of CANDIDATES) {
        try {
          return withJsonAttribute(nextResolve(specifier + ext, attributed));
        } catch {
          // نجرّب اللاحقة التالية.
        }
      }
      throw error;
    }
  },
});
