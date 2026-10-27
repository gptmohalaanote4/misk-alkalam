/** تنسيق التاريخ الميلادي بالعربية: "١٤ أكتوبر ٢٠٢٦". */
export function formatGregorian(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * التاريخ الهجري (أم القرى) إن كان محرّك JS يدعمه، وإلا null.
 * بعض نسخ Hermes تُبنى بدون بيانات التقاويم الكاملة، فنتعامل مع ذلك بهدوء.
 */
export function formatHijri(date: Date): string | null {
  try {
    const formatted = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    // إذا سقط المحرّك إلى التقويم الميلادي فلا فائدة من عرضه مرتين.
    const gregorianYear = String(date.getFullYear());
    if (formatted.includes(gregorianYear)) return null;
    return `${formatted} هـ`;
  } catch {
    return null;
  }
}

/** وصف نسبي مختصر: "اليوم"، "أمس"، أو التاريخ. */
export function relativeDay(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays > 1 && diffDays < 7) return `قبل ${diffDays} أيام`;
  if (diffDays === -1) return 'غداً';
  return formatGregorian(date);
}

/** المدة المتبقية حتى موعد قادم: "بعد ٣ ساعات". */
export function timeUntil(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return 'قريباً';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `بعد ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `بعد ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'غداً';
  if (days === 2) return 'بعد يومين';
  return `بعد ${days} أيام`;
}
