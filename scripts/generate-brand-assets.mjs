/**
 * Generate PWA icons, favicons, and OG image from public/brand/logo-source.png
 * Run: node scripts/generate-brand-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = process.cwd();
const brandDir = path.join(root, 'public', 'brand');
const publicDir = path.join(root, 'public');
const source = path.join(brandDir, 'logo-source.png');

const NAVY = '#0a1931';

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Missing public/brand/logo-source.png — add the master logo first.');
    process.exit(1);
  }

  const logo = sharp(source).ensureAlpha();

  const sizes = [
    { name: 'logo.png', size: 512, dir: publicDir },
    { name: 'icon-192.png', size: 192, dir: publicDir },
    { name: 'icon-512.png', size: 512, dir: publicDir },
    { name: 'apple-touch-icon.png', size: 180, dir: publicDir },
    { name: 'favicon-32.png', size: 32, dir: publicDir },
    { name: 'favicon-16.png', size: 16, dir: publicDir },
  ];

  for (const { name, size, dir } of sizes) {
    const out = path.join(dir, name);
    await logo.clone().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
    console.log('Wrote', out);
  }

  // Maskable: logo on solid navy with safe padding (~20%)
  for (const size of [192, 512]) {
    const pad = Math.round(size * 0.12);
    const inner = size - pad * 2;
    const resized = await logo.clone().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const out = path.join(publicDir, `icon-maskable-${size}.png`);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: NAVY,
      },
    })
      .composite([{ input: resized, gravity: 'centre' }])
      .png()
      .toFile(out);
    console.log('Wrote', out);
  }

  // OG / social share: 1200×630, logo centered on navy
  const ogW = 1200;
  const ogH = 630;
  const ogLogoSize = 420;
  const ogLogo = await logo.clone().resize(ogLogoSize, ogLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const ogOut = path.join(publicDir, 'og-image.png');
  await sharp({
    create: {
      width: ogW,
      height: ogH,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: ogLogo, gravity: 'centre' }])
    .png()
    .toFile(ogOut);
  console.log('Wrote', ogOut);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
