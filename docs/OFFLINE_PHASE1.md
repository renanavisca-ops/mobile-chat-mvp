# Phase 1 — Bundle the UI + self-contained startup (COMPLETE)

The app no longer loads its interface from the live Vercel URL. The UI is
exported statically and bundled into the native app; only data calls go to the
hosted backend. Phases 2–13 (SQLite, offline queue, sync) are **not** started.

## 1. Architecture now
- **Startup:** Capacitor loads the bundled `mobile/www` from the secure local
  origin **`https://localhost`** (`androidScheme: 'https'`). `server.url` is
  removed from `capacitor.config.ts`.
- **UI:** produced by `MOBILE_EXPORT=1 next build` (`output: 'export'`) →
  `out/` → copied into `mobile/www` → `cap sync`. Reproducible via
  `npm run build:mobile` (script: `scripts/build-mobile.mjs`).
- **Backend:** unchanged, still hosted on Vercel. The app calls the app's own
  `/api/*` routes through a single base URL, and Supabase / Cloudflare directly.
- **Two build targets from one repo:** the normal `next build` (Vercel) keeps
  API routes + dynamic routes + Sentry; the mobile export excludes the
  server-only routes and Sentry tunnel. The difference is isolated entirely in
  `next.config.mjs` (env-gated) and `scripts/build-mobile.mjs`.

## 2. No longer loads UI from Vercel — confirmed
`android/app/src/main/assets/capacitor.config.json` has **no `server` URL**;
`mobile/www/index.html` (real 10.7 KB app shell, not the old placeholder) is
bundled into `android/app/src/main/assets/public/`.

## 3. Local origin
`https://localhost` (Android `androidScheme: 'https'`, iOS `iosScheme: 'https'`).

## 4. Auth deep-link scheme + callback URLs
- Scheme: **`tokychat://`** (new; no prior deep link existed). Canonical
  callbacks: **`tokychat://auth/callback`** (sign-up / email confirmation /
  magic link) and **`tokychat://reset-password`** (password reset).
- Android intent filter added in `AndroidManifest.xml` (VIEW + BROWSABLE +
  DEFAULT, `scheme="tokychat"`).
- `src/components/native-auth-links.tsx` listens to `@capacitor/app`
  `appUrlOpen`, establishes the session (`exchangeCodeForSession` for PKCE
  `code`, else `setSession` from the URL-fragment tokens), and routes to the
  validated in-app path (allow-list: `/auth/callback`, `/reset-password`).
- Web is unchanged: `authRedirectUrl()` returns `${origin}/…` on web,
  `tokychat://…` on native.

## 5. Supabase redirect URLs to add MANUALLY (dashboard → Auth → URL Config)
Add to **Redirect URLs (allow list)**:
```
tokychat://auth/callback
tokychat://reset-password
```
Keep the existing web URLs (`https://mobile-chat-mvp.vercel.app/auth/callback`,
`…/reset-password`) so the browser version keeps working.

## 6. Backend base URL config
`NEXT_PUBLIC_API_BASE_URL` (public, non-secret). Empty on web (same-origin);
the mobile build sets it to `https://mobile-chat-mvp.vercel.app`. Centralized in
`src/lib/api/client.ts` (`apiFetch()`); no hardcoded URLs in components.

## 7. API endpoints & call-sites changed (14 call-sites → `apiFetch`)
`chat/[id]/status`, `link-preview`, `account/delete`, `public-chat/[token]` (×3),
`chat/start`, `ai`, `mfa/recovery/generate`, `mfa/recovery/consume`, `turn`,
`push/call`, `payments/checkout`, `avatar`. Files: `chat-conversation.tsx`,
`link-preview.tsx`, `settings/page.tsx`, `public-chat-view.tsx`,
`start-chat/page.tsx`, `lib/ai.ts`, `lib/auth/mfa.ts`, `call-provider.tsx`,
`lib/payments/index.ts`, `lib/db/avatar.ts`. Push target URLs updated to the new
`/chats/view?c=` route.

## 8. Dynamic-route conversion
- `chats/[chatId]` → new static route **`/chats/view?c=<uuid>`**
  (`src/app/chats/view/page.tsx`, Suspense + validated UUID). In-app navigation
  (chat list, channels, contacts, groups, notification taps) now uses it via
  client-side `router.push` (no full reloads). The old `[chatId]` route is kept
  for the hosted web build and **excluded from the export**.
- `public-chat/[token]` → shared component **`PublicChatView`**
  (`src/components/public-chat-view.tsx`) rendered by both the web `[token]`
  route and the static **`/public-chat?token=<token>`** route
  (`src/app/public-chat/page.tsx`). `start-chat` navigates to the query route.
- URL-format change (documented): in-app deep target is `/chats/view?c=…` /
  `/public-chat?token=…`; browser `/chats/<id>` and `/public-chat/<token>`
  still work on the hosted site.

## 9. Build & export commands
```
npm run build          # normal Vercel build (API routes intact)
npm run build:mobile   # export -> mobile/www -> cap sync (android + ios)
npm run export:mobile   # export only (no cap sync)
```
CI (`codemagic.yaml`) now runs the export step before `cap sync` in both
workflows.

## 10. Android install & offline test
1. `npm run build:mobile` (with `NEXT_PUBLIC_SUPABASE_*` + `NEXT_PUBLIC_API_BASE_URL` set), then build the APK/AAB in Codemagic/Android Studio.
2. Install, launch once online, then enable airplane mode, force-close, relaunch → the bundled UI must render (not blank, not the Vercel site).

## 11–12. Results of checks run in this environment
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ pass |
| `next lint` | ✅ pass (no errors) |
| `npm test` (vitest) | ✅ 16/16 pass |
| Web build (`next build`) | ✅ pass — API + dynamic routes intact |
| Mobile static export (`MOBILE_EXPORT=1`) | ✅ pass — all routes static, `mobile/www/index.html` produced |
| `cap sync android` | ✅ pass — assets + 5 plugins synced |
| No server secret in bundle | ✅ verified (grep clean) |
| Android debug/release build | ⚠️ NOT run here — no Android SDK in this environment; run in Codemagic |
| iOS build | ⚠️ NOT run — needs macOS/Xcode |
| On-device offline / online acceptance (A/B) | ⚠️ require a real Android build + device (Codemagic) |

## 13. Files added / modified / moved / deleted
- **Added:** `src/lib/api/client.ts`, `src/lib/auth/redirect.ts`,
  `src/components/native-auth-links.tsx`, `src/app/chats/view/page.tsx`,
  `src/app/public-chat/page.tsx`, `scripts/build-mobile.mjs`,
  `docs/OFFLINE_PHASE1.md`.
- **Moved:** `src/app/public-chat/[token]/page.tsx` → `src/components/public-chat-view.tsx` (and a thin `[token]/page.tsx` wrapper re-added for web).
- **Modified:** `capacitor.config.ts`, `next.config.mjs`, `package.json`,
  `.env.example`, `.gitignore`, `codemagic.yaml`,
  `android/app/src/main/AndroidManifest.xml`, `src/app/layout.tsx`,
  `src/app/login/page.tsx`, `src/app/chats/page.tsx`, `src/app/channels/page.tsx`,
  `src/app/contacts/page.tsx`, `src/app/groups/new/page.tsx`,
  `src/app/start-chat/page.tsx`, `src/app/settings/page.tsx`,
  `src/app/api/push/send/route.ts`, `src/app/api/push/call/route.ts`,
  `src/components/chat-conversation.tsx`, `src/components/link-preview.tsx`,
  `src/lib/ai.ts`, `src/lib/auth/mfa.ts`, `src/lib/call/call-provider.tsx`,
  `src/lib/payments/index.ts`, `src/lib/db/avatar.ts`, plus Capacitor-generated
  `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`.
- **Deleted (untracked):** `mobile/www/index.html` placeholder (now generated;
  `mobile/www/` and `out/` are gitignored).

## 14. Environment variables required
- Build (public, inlined): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`
  (mobile export). Set these in Codemagic.
- Backend (unchanged, server-side on Vercel): `SUPABASE_SERVICE_ROLE_KEY`,
  `VAPID_*`, `CLOUDFLARE_TURN_*`, `ANTHROPIC_*`, `PUSH_TRIGGER_SECRET`, etc.
- No server secret is exposed via `NEXT_PUBLIC_*`.

## 15. Manual steps you must do
1. **Supabase dashboard:** add `tokychat://auth/callback` and
   `tokychat://reset-password` to the Auth redirect allow-list (§5).
2. **Codemagic:** set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL` in the build
   environment (variable group).
3. **Build the Android app** in Codemagic and run the offline/online acceptance
   tests on a device.

## 16. Known limitations (Phase 1)
- Still online-first: with no network and no prior data, content areas show
  empty/unavailable states (SQLite offline reads arrive in Phase 2–3).
- iOS deep-link URL scheme not yet added to `Info.plist` (Android-first). No iOS
  parity claimed.
- Password-reset/confirmation email deep links require the Supabase allow-list
  entries (§5) to actually open the app.

## 17. Risks remaining for Phase 2
- **Idempotency (Phase 4, required):** `messages` has no stable client id.
  Plan: add `client_message_id uuid` + unique `(chat_id, client_message_id)` +
  upsert-on-conflict; set the id in the `sendMessage` path
  (`src/lib/db/chats.ts`) and dedup realtime by it. Phase 1 does not block this.
- Local DB encryption must be genuine (SQLCipher / verified) before caching
  plaintext (Phase 2 gate, per approved conditions).
- Realtime under mobile lifecycle must be reconciled by incremental pull.

## 18. Checkpoint
Branch `claude/chat-app-android-ios-0pb8r2`. See the Phase 1 commit hash in the
delivery message.
