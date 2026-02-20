#!/usr/bin/env node
/**
 * Compress all JPEG/PNG/WebP in public/ for fast loading.
 * - Resizes to max 1920px on longest edge (hero/covers stay sharp on large screens)
 * - JPEG quality 82, PNG 85, strips metadata
 * - Overwrites in place; keeps aspect ratio
 *
 * Run: node scripts/compress-images.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const MAX_WIDTH = 1920;
const JPEG_QUALITY = 82;
const PNG_QUALITY = 85;
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;

function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkDir(full);
    else if (EXTENSIONS.test(e.name)) yield full;
  }
}

async function compress(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);
  const before = buf.length;

  let pipeline = sharp(buf)
    .rotate() // auto-orient from EXIF
    .resize(MAX_WIDTH, MAX_WIDTH, { fit: 'inside', withoutEnlargement: true });

  if (ext === '.png') {
    pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: 82 });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  const out = await pipeline.toBuffer();
  const after = out.length;
  if (after >= before) {
    console.log('  skip (already smaller or same):', path.relative(PUBLIC, filePath));
    return { path: filePath, before, after: before, skipped: true };
  }
  fs.writeFileSync(filePath, out);
  const pct = Math.round((1 - after / before) * 100);
  console.log('  ok:', path.relative(PUBLIC, filePath), `${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${pct}%)`);
  return { path: filePath, before, after, skipped: false };
}

async function main() {
  console.log('Compressing images in public/ (max width', MAX_WIDTH + ', JPEG q' + JPEG_QUALITY + ')\n');
  const files = [...walkDir(PUBLIC)];
  if (files.length === 0) {
    console.log('No images found.');
    return;
  }
  let totalBefore = 0, totalAfter = 0;
  for (const f of files) {
    try {
      const r = await compress(f);
      if (!r.skipped) {
        totalBefore += r.before;
        totalAfter += r.after;
      }
    } catch (e) {
      console.error('  error:', path.relative(PUBLIC, f), e.message);
    }
  }
  if (totalAfter > 0) {
    const saved = Math.round((1 - totalAfter / totalBefore) * 100);
    console.log('\nTotal saved:', ((totalBefore - totalAfter) / 1024).toFixed(0) + 'KB (' + saved + '%)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
