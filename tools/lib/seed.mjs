/**
 * قراءة ملفات البذرة وكتابتها بأسلوبها القائم — تشترك فيها أدوات `tools/`.
 * `app/src/data/seed/` هو مصدر الحقيقة الوحيد للمحتوى، و`seed.sql` يُولَّد منه.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const seedDir = join(root, 'app/src/data/seed');

export const readSeed = (file) => JSON.parse(readFileSync(join(seedDir, file), 'utf8'));

/** كتابة بأسلوب الملفات القائم: مسافتان، ومصفوفات النصوص في سطر واحد. */
export function stringifySeed(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => typeof v === 'string')) {
      return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    }
    const inner = `${indent}  `;
    return `[\n${value.map((v) => inner + stringifySeed(v, inner)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const inner = `${indent}  `;
    return `{\n${keys
      .map((key) => `${inner}${JSON.stringify(key)}: ${stringifySeed(value[key], inner)}`)
      .join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value ?? null);
}

/** يضع المفاتيح الجديدة في موضعها بدل إلحاقها بآخر العنصر. */
const KEY_ORDER = [
  'id', 'collection', 'scholar_slug', 'text', 'book', 'narrator', 'chapter', 'number',
  'volume', 'page', 'source_url', 'topic', 'tags', 'needs_reference_check', 'source_slug',
];

export function reorder(item) {
  const out = {};
  for (const key of KEY_ORDER) if (key in item) out[key] = item[key];
  for (const key of Object.keys(item)) if (!(key in out)) out[key] = item[key];
  return out;
}

export const writeSeed = (file, items) =>
  writeFileSync(join(seedDir, file), `${stringifySeed(items.map(reorder))}\n`, 'utf8');
