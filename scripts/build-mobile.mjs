#!/usr/bin/env node
/**
 * Reproducible mobile build: export the client UI, bundle it into the native
 * app, and sync Capacitor. No manual copying required.
 *
 *   1. Temporarily move server-only routes out of the tree (API routes and the
 *      two dynamic segments) so `output: 'export'` succeeds. They are ONLY used
 *      by the hosted Vercel build; the bundled app calls the hosted API and
 *      uses the query-param routes (/chats/view, /public-chat).
 *   2. Run `MOBILE_EXPORT=1 next build` → static site in `out/`.
 *   3. Always restore the moved routes (finally), even on failure.
 *   4. Replace `mobile/www` with the export output.
 *   5. `cap sync android` (+ ios when present).
 *   6. Verify the bundle actually contains index.html.
 *
 * Usage:  node scripts/build-mobile.mjs [--no-sync]
 * Env:    NEXT_PUBLIC_API_BASE_URL  (defaults to the production Vercel origin)
 *         plus the usual NEXT_PUBLIC_SUPABASE_* the web build needs.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stashDir = path.join(root, '.mobile-export-stash');
const outDir = path.join(root, 'out');
const wwwDir = path.join(root, 'mobile', 'www');

// Server-only route dirs that cannot be statically exported.
const EXCLUDE = ['src/app/api', 'src/app/chats/[chatId]', 'src/app/public-chat/[token]'];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://mobile-chat-mvp.vercel.app';
const doSync = !process.argv.includes('--no-sync');

function run(cmd, extraEnv = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

function stashRoutes() {
  fs.mkdirSync(stashDir, { recursive: true });
  for (const rel of EXCLUDE) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(stashDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    console.log(`stashed  ${rel}`);
  }
}

function restoreRoutes() {
  for (const rel of EXCLUDE) {
    const stashed = path.join(stashDir, rel);
    if (!fs.existsSync(stashed)) continue;
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(stashed, dest);
    console.log(`restored ${rel}`);
  }
  fs.rmSync(stashDir, { recursive: true, force: true });
}

function main() {
  console.log(`Mobile export → NEXT_PUBLIC_API_BASE_URL=${API_BASE}`);
  fs.rmSync(outDir, { recursive: true, force: true });

  stashRoutes();
  try {
    run('npx next build', { MOBILE_EXPORT: '1', NEXT_PUBLIC_API_BASE_URL: API_BASE });
  } finally {
    restoreRoutes();
  }

  // Replace mobile/www with the fresh export.
  fs.rmSync(wwwDir, { recursive: true, force: true });
  fs.mkdirSync(wwwDir, { recursive: true });
  fs.cpSync(outDir, wwwDir, { recursive: true });

  const indexHtml = path.join(wwwDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('Export failed: mobile/www/index.html is missing.');
  }
  console.log(`\n✅ Bundled UI copied to mobile/www (index.html present).`);

  if (doSync) {
    run('npx cap sync android');
    if (fs.existsSync(path.join(root, 'ios'))) {
      try {
        run('npx cap sync ios');
      } catch {
        console.warn('cap sync ios failed (expected without macOS/CocoaPods) — Android is synced.');
      }
    }
  } else {
    console.log('Skipped cap sync (--no-sync).');
  }
  console.log('\n✅ Mobile build complete.');
}

main();
