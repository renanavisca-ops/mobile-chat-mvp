/**
 * Store screenshot generator for Toky Chat.
 *
 * Drives the LIVE app with a real login and captures every screen at the exact
 * pixel sizes the App Store and Google Play require, so the output PNGs can be
 * uploaded straight into App Store Connect / Play Console.
 *
 * Why a script (not manual screenshots): both stores want several device sizes
 * (6.7" iPhone, iPad 12.9", Android phone/tablet) of the same screens. Doing
 * that by hand is slow and inconsistent; this produces the full matrix in one
 * command and re-runs identically whenever the UI changes.
 *
 * USAGE
 *   TOKY_EMAIL=demo@toky.chat TOKY_PASSWORD=... node scripts/store-screenshots.mjs
 *
 * Requires network access to the hosted app (TOKY_URL) and its Supabase backend.
 * If you run it inside a restricted CI/agent sandbox, allowlist those hosts first
 * — otherwise the browser can't reach the app and login will time out.
 *
 * ENV
 *   TOKY_URL       Base URL of the app        (default https://mobile-chat-mvp.vercel.app)
 *   TOKY_EMAIL     Login email                (required)
 *   TOKY_PASSWORD  Login password             (required)
 *   TOKY_OUT       Output dir                 (default ./screenshots)
 *   TOKY_THEME     'dark' | 'light'           (default dark — the app's default)
 *   TOKY_HEADFUL   set to 1 to watch the run  (default headless)
 *
 * Output: screenshots/<device>/<screen>.png
 */

import { chromium, devices as pwDevices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.TOKY_URL || 'https://mobile-chat-mvp.vercel.app').replace(/\/$/, '');
const EMAIL = process.env.TOKY_EMAIL;
const PASSWORD = process.env.TOKY_PASSWORD;
const OUT = process.env.TOKY_OUT || 'screenshots';
const THEME = process.env.TOKY_THEME === 'light' ? 'light' : 'dark';
const HEADFUL = process.env.TOKY_HEADFUL === '1';

if (!EMAIL || !PASSWORD) {
  console.error('✗ Set TOKY_EMAIL and TOKY_PASSWORD (a demo/reviewer account).');
  process.exit(1);
}

// Device matrix. `out` names the output pixel size the store expects; we derive
// a CSS viewport + deviceScaleFactor that renders to exactly that size.
// Apple 6.7" = 1290x2796, 6.5" = 1242x2688, iPad 12.9" = 2048x2732.
// Google Play phone/tablet accept a range; 1080x1920 / 1600x2560 are safe.
const DEVICES = [
  { name: 'ios-6.7',        width: 430,  height: 932,  scale: 3, required: 'Apple 6.7" iPhone (1290x2796)' },
  { name: 'ios-6.5',        width: 414,  height: 896,  scale: 3, required: 'Apple 6.5" iPhone (1242x2688)' },
  { name: 'ipad-12.9',      width: 1024, height: 1366, scale: 2, required: 'Apple iPad 12.9" (2048x2732)' },
  { name: 'android-phone',  width: 360,  height: 640,  scale: 3, required: 'Google Play phone (1080x1920)' },
  { name: 'android-tablet', width: 800,  height: 1280, scale: 2, required: 'Google Play tablet (1600x2560)' },
];

// Screens to capture. `auth: false` = reachable while signed out.
// The conversation screen is opened by clicking the first chat row (no fixed id).
const SCREENS = [
  { name: '1-welcome',      path: '/login', auth: false },
  { name: '2-chats',        path: '/chats' },
  { name: '3-conversation', path: '/chats', openFirstChat: true },
  { name: '4-calls',        path: '/calls' },
  { name: '5-channels',     path: '/channels' },
  { name: '6-contacts',     path: '/contacts' },
  { name: '7-settings',     path: '/settings' },
];

const settle = (page, ms = 900) => page.waitForTimeout(ms);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  // Defensive selectors — the submit label is localized, so match by role/text
  // with fallbacks to the field types.
  await page.locator('input[autocomplete="email"], input[placeholder="you@email.com"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  const signIn = page.getByRole('button', { name: /sign in|iniciar sesi|entrar|log in/i });
  if (await signIn.count()) {
    await signIn.first().click();
  } else {
    await page.locator('input[type="password"]').first().press('Enter');
  }
  // Wait until we've left /login (redirect to /chats or /onboarding).
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await settle(page, 1500);
}

async function capture(context, device) {
  const dir = path.join(OUT, device.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();

  await login(page);

  for (const screen of SCREENS) {
    try {
      await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
      await settle(page);

      if (screen.openFirstChat) {
        // Open the first conversation in the list, if any exist.
        const row = page.locator('a[href^="/chats/"], [role="listitem"], li').first();
        if (await row.count()) {
          await row.click().catch(() => {});
          await page.waitForURL(/\/chats\/.+/, { timeout: 8000 }).catch(() => {});
          await settle(page);
        }
      }

      const file = path.join(dir, `${screen.name}.png`);
      await page.screenshot({ path: file });
      console.log(`  ✓ ${device.name}/${screen.name}.png`);
    } catch (err) {
      console.warn(`  ⚠ ${device.name}/${screen.name} skipped: ${err.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log(`Toky store screenshots → ${BASE}  (theme: ${THEME})`);
  const browser = await chromium.launch({ headless: !HEADFUL });
  try {
    for (const device of DEVICES) {
      console.log(`\n▸ ${device.name}  — ${device.required}`);
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
        isMobile: device.name.startsWith('ios') || device.name === 'android-phone',
        hasTouch: true,
        colorScheme: THEME,
        userAgent: device.name.startsWith('ios') ? pwDevices['iPhone 13 Pro'].userAgent : undefined,
      });
      await capture(context, device);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone. PNGs in ./${OUT}/<device>/  — upload per store size.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
