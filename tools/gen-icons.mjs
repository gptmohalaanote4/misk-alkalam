#!/usr/bin/env node
/**
 * يولّد أيقونات التطبيق بلا أي مكتبة خارجية: رسم نقطي + ترميز PNG يدوي.
 *   node tools/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'app/assets');
mkdirSync(out, { recursive: true });

/* ───────────── ترميز PNG ───────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** يكتب صورة RGBA إلى ملف PNG. */
function writePng(path, width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // عمق البت
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // بلا ترشيح
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

/* ───────────── الرسم ───────────── */

const EMERALD = [14, 107, 88];
const DEEP = [6, 46, 39];
const GOLD = [217, 182, 97];

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/**
 * النجمة الثمانية الإسلامية (خاتم سليمان): مربّع قائم ومربّع مائل ٤٥°.
 * نعيد المسافة المُوقَّعة إلى حدّ اتحادهما — سالبة داخل الشكل.
 */
function starEdgeDistance(dx, dy, radius) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const square = Math.max(ax, ay) - radius;              // مربّع قائم
  const diamond = (ax + ay) * Math.SQRT1_2 - radius;      // مربّع مائل
  return Math.min(square, diamond);                       // حدّ الاتحاد
}

/** تغطية حادّة: شريط بعرض stroke مع تنعيم بمقدار بكسل واحد فقط. */
function band(distance, stroke, px) {
  return Math.max(0, Math.min(1, (stroke - Math.abs(distance)) / px + 0.5));
}

function disc(r, radius, px) {
  return Math.max(0, Math.min(1, (radius - r) / px + 0.5));
}

/**
 * يرسم الأيقونة بعينة فائقة (2x) ثم يصغّرها لتنعيم الحواف.
 * filled=false يعطي شكلاً أبيض على خلفية شفافة (أيقونة الإشعار).
 */
function render(size, { filled = true, color = GOLD, scale = 1 } = {}) {
  const S = 2;
  const big = size * S;
  const buf = Buffer.alloc(big * big * 4);
  const c = big / 2;
  const radius = (big / 2) * 0.56 * scale;
  const stroke = big * 0.016;
  const px = 1.2;

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const i = (y * big + x) * 4;
      const dx = x - c + 0.5;
      const dy = y - c + 0.5;
      const rr = Math.hypot(dx, dy);

      let rgb = null;
      let alpha = 0;

      if (filled) {
        const t = (x / big) * 0.5 + (y / big) * 0.5;
        rgb = mix(EMERALD, DEEP, t);
        alpha = 255;
      }

      const onStar = band(starEdgeDistance(dx, dy, radius), stroke, px);
      const onInnerStar = band(starEdgeDistance(dx, dy, radius * 0.52), stroke * 0.8, px);
      const onDot = disc(rr, radius * 0.13, px);
      const onRing = filled ? band(rr - radius * 1.42, stroke * 0.5, px) * 0.5 : 0;

      const mark = Math.max(onStar, onInnerStar, onDot, onRing);
      if (mark > 0) {
        if (filled) {
          rgb = mix(rgb, color, mark);
        } else {
          rgb = [255, 255, 255];
          alpha = Math.round(255 * mark);
        }
      }

      if (rgb) {
        buf[i] = rgb[0];
        buf[i + 1] = rgb[1];
        buf[i + 2] = rgb[2];
        buf[i + 3] = alpha;
      }
    }
  }

  // تصغير بمعدّل 2×2 (تنعيم)
  const small = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const j = ((y * S + sy) * big + (x * S + sx)) * 4;
          const av = buf[j + 3];
          r += buf[j] * av; g += buf[j + 1] * av; b += buf[j + 2] * av; a += av;
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        small[i] = Math.round(r / a);
        small[i + 1] = Math.round(g / a);
        small[i + 2] = Math.round(b / a);
      }
      small[i + 3] = Math.round(a / (S * S));
    }
  }
  return small;
}

const files = [
  ['icon.png', 1024, { filled: true }],
  ['adaptive-icon.png', 1024, { filled: true, scale: 0.72 }],
  ['splash-icon.png', 1024, { filled: false, scale: 0.9 }],
  ['notification-icon.png', 96, { filled: false, scale: 1.05 }],
  ['favicon.png', 64, { filled: true }],
];

for (const [name, size, opts] of files) {
  const bytes = writePng(join(out, name), size, size, render(size, opts));
  console.log(`${name.padEnd(22)} ${size}×${size}  ${(bytes / 1024).toFixed(1)} KB`);
}
