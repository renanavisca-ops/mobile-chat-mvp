// Generates the Google Play "feature graphic" (1024x500) from the same brand
// tokens as the app icon (blue->green gradient "T", dark backdrop). Offline —
// only needs sharp. Output: assets/play-feature-graphic.png
//
//   node scripts/generate-feature-graphic.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLUE = '#2f66ff';
const GREEN = '#12a150';
const DARK = '#020617';
// The app's own slogan (es.ts → auth.welcomeSubtitle), split across two lines
// so it fits the graphic without shrinking. Keep in sync with the app copy.
const TAGLINE_1 = 'La mejor forma de chatear';
const TAGLINE_2 = 'con quienes importan.';

// Keep text well inside the frame — Play can overlay UI near the edges.
const svg = `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(150 0.5 0.5)">
      <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${GREEN}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.62" cy="0.28" r="0.85">
      <stop offset="0"   stop-color="${BLUE}"  stop-opacity="0.34"/>
      <stop offset="0.45" stop-color="${GREEN}" stop-opacity="0.14"/>
      <stop offset="1"   stop-color="${DARK}"  stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1024" height="500" fill="${DARK}"/>
  <rect width="1024" height="500" fill="url(#glow)"/>

  <!-- logo tile -->
  <rect x="104" y="150" width="200" height="200" rx="52" fill="url(#g)"/>
  <text x="204" y="250" fill="#ffffff" font-family="Helvetica,Arial,sans-serif"
        font-size="150" font-weight="800" text-anchor="middle"
        dominant-baseline="central">T</text>

  <!-- wordmark + tagline -->
  <text x="348" y="220" fill="#ffffff" font-family="Helvetica,Arial,sans-serif"
        font-size="88" font-weight="800">Toky Chat</text>
  <text x="352" y="288" fill="#9fb0c9" font-family="Helvetica,Arial,sans-serif"
        font-size="30" font-weight="500">${TAGLINE_1}</text>
  <text x="352" y="328" fill="#9fb0c9" font-family="Helvetica,Arial,sans-serif"
        font-size="30" font-weight="500">${TAGLINE_2}</text>
</svg>`;

async function main() {
  await mkdir(join(root, 'assets'), { recursive: true });
  const out = join(root, 'assets/play-feature-graphic.png');
  await sharp(Buffer.from(svg)).resize(1024, 500).png().toFile(out);
  console.log(`Feature graphic generated → ${out} (1024x500)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
