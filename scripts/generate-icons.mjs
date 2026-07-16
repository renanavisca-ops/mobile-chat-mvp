// Generates every app icon + splash from a single gradient "T" mark, matching
// src/app/icon.tsx (blue->green gradient, white bold T). One command owns all
// icon output so the brand stays consistent across web, Android and iOS.
//
//   - public/icons/*, public/apple-touch-icon.png   PWA / web
//   - assets/*                                       source art (kept in repo)
//   - android/.../res/mipmap-*                        Android launcher + adaptive
//   - android/.../res/drawable/splash.png             Android splash
//   - ios/.../AppIcon.appiconset, Splash.imageset     iOS icon + splash
//
// Native output is only written when the Capacitor platforms exist. Re-run
// after `npx cap add` or whenever the mark changes:  node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLUE = '#2f66ff';
const GREEN = '#12a150';
const DARK = '#020617';

const exists = (p) => access(p).then(() => true).catch(() => false);

// Full-bleed icon: gradient square + centered T (opaque — required for iOS).
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" gradientTransform="rotate(150 0.5 0.5)">
    <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${GREEN}"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <text x="512" y="560" fill="#fff" font-family="Helvetica,Arial,sans-serif"
        font-size="620" font-weight="800" text-anchor="middle">T</text>
</svg>`;

// Transparent foreground (T only) for Android adaptive icons; sized inside the
// central safe zone so launcher masks never clip it.
const foregroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="640" fill="#fff" font-family="Helvetica,Arial,sans-serif"
        font-size="400" font-weight="800" text-anchor="middle">T</text>
</svg>`;

const backgroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" gradientTransform="rotate(150 0.5 0.5)">
    <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${GREEN}"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
</svg>`;

// Splash: centered mark on a solid backdrop.
const splashSvg = (bg) => `
<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" gradientTransform="rotate(150 0.5 0.5)">
    <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${GREEN}"/>
  </linearGradient></defs>
  <rect width="2732" height="2732" fill="${bg}"/>
  <rect x="1116" y="1116" width="500" height="500" rx="110" fill="url(#g)"/>
  <text x="1366" y="1430" fill="#fff" font-family="Helvetica,Arial,sans-serif"
        font-size="300" font-weight="800" text-anchor="middle">T</text>
</svg>`;

const png = (svg) => sharp(Buffer.from(svg)).png();

// Rasterize an SVG to `size`, optionally clipped by a mask shape (dest-in).
async function raster(svg, size, maskSvg) {
  let img = sharp(Buffer.from(svg)).resize(size, size);
  if (maskSvg) {
    const mask = await sharp(Buffer.from(maskSvg)).resize(size, size).png().toBuffer();
    img = img.composite([{ input: mask, blend: 'dest-in' }]);
  }
  return img.png().toBuffer();
}

const roundedMask = (r) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="${r}" fill="#fff"/></svg>`;
const circleMask =
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="50" fill="#fff"/></svg>`;

// dp -> px density multipliers for Android resource buckets.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function web() {
  await mkdir(join(root, 'public/icons'), { recursive: true });
  for (const s of [192, 512]) {
    await png(iconSvg).resize(s, s).toFile(join(root, `public/icons/icon-${s}.png`));
  }
  await png(iconSvg).resize(512, 512).toFile(join(root, 'public/icons/maskable-512.png'));
  await png(iconSvg).resize(180, 180).toFile(join(root, 'public/apple-touch-icon.png'));
}

async function source() {
  await mkdir(join(root, 'assets'), { recursive: true });
  await png(iconSvg).resize(1024, 1024).toFile(join(root, 'assets/icon-only.png'));
  await png(foregroundSvg).resize(1024, 1024).toFile(join(root, 'assets/icon-foreground.png'));
  await png(backgroundSvg).resize(1024, 1024).toFile(join(root, 'assets/icon-background.png'));
  await png(splashSvg('#f8fafc')).toFile(join(root, 'assets/splash.png'));
  await png(splashSvg(DARK)).toFile(join(root, 'assets/splash-dark.png'));
  await writeFile(join(root, 'assets/.gitkeep'), '');
}

async function android() {
  const res = join(root, 'android/app/src/main/res');
  if (!(await exists(res))) return false;
  for (const [d, scale] of Object.entries(DENSITIES)) {
    const dir = join(res, `mipmap-${d}`);
    await mkdir(dir, { recursive: true });
    const legacy = Math.round(48 * scale);
    const adaptive = Math.round(108 * scale);
    await writeFile(join(dir, 'ic_launcher.png'), await raster(iconSvg, legacy, roundedMask(22)));
    await writeFile(join(dir, 'ic_launcher_round.png'), await raster(iconSvg, legacy, circleMask));
    await writeFile(join(dir, 'ic_launcher_foreground.png'), await raster(foregroundSvg, adaptive));
    await writeFile(join(dir, 'ic_launcher_background.png'), await raster(backgroundSvg, adaptive));
  }
  // Point the adaptive-icon background at our gradient instead of a flat color.
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  await writeFile(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptiveXml);
  await writeFile(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptiveXml);
  // Splash (Capacitor scales/crops a single image to fill).
  await mkdir(join(res, 'drawable'), { recursive: true });
  await png(splashSvg(DARK)).resize(2000, 2000).toFile(join(res, 'drawable/splash.png'));
  return true;
}

async function ios() {
  const appicon = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  if (!(await exists(appicon))) return false;
  // iOS marketing icon: 1024px, opaque, no rounded corners (Apple masks it).
  await sharp(Buffer.from(iconSvg)).resize(1024, 1024).flatten({ background: BLUE }).png()
    .toFile(join(appicon, 'AppIcon-512@2x.png'));
  const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');
  await mkdir(splashDir, { recursive: true });
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await png(splashSvg(DARK)).toFile(join(splashDir, f));
  }
  return true;
}

async function main() {
  await web();
  await source();
  const a = await android();
  const i = await ios();
  console.log(`Icons generated — web+source ✓  android ${a ? '✓' : '(skipped)'}  ios ${i ? '✓' : '(skipped)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
