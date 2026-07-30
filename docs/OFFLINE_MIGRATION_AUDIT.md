# Phase 0 — Architecture Audit & Migration Plan

**Goal:** convert Toky Chat from a remote-URL WebView app into a self-contained,
offline-first mobile app. This document is the audit only — **no application
code has been changed.** Implementation does not start until this is reviewed.

---

## 1. Current architecture

### 1.1 Mobile technology
- **Capacitor 6** (`@capacitor/core` 6.2.1) wrapping a **Next.js 14.2.5** web app. Native projects exist for **Android** (`android/`, package `app.toky.chat`, Java) and **iOS** (`ios/`).
- **Startup loads the UI remotely.** `capacitor.config.ts` sets `server.url = https://mobile-chat-mvp.vercel.app` with `androidScheme: 'https'` and `allowNavigation` limited to that host. The native bridge is injected on the hosted origin so plugins work there.
- `webDir` is `mobile/www`, but it contains **only a 3.4 KB placeholder `index.html`** — the real interface is *never* bundled today. **No internet ⇒ blank/failed WebView.**
- Capacitor plugins in use: `@capacitor-firebase/messaging` (FCM push), `@capacitor/app` (lifecycle/deep links), `@capacitor/splash-screen`, `@capacitor/status-bar`, `@aparajita/capacitor-secure-storage`, plus our custom native `AudioRoute` plugin + `CallForegroundService` (calls).

### 1.2 Next.js architecture
- **App Router** (`src/app/**`), Next **14.2.5**, React 18.3.
- **Rendering:** every user-facing screen is a **Client Component** (`'use client'`): `page`, `chats`, `chats/[chatId]`, `contacts`, `calls`, `channels`, `settings`, `login`, `onboarding`, `auth/callback`, `start-chat`, `groups/new`, `public-chat/[token]`, `reset-password`. Only static content pages (`privacy`, `terms`, `guidelines`, `support`, `delete-account`) and `layout.tsx` are server components, and they render static markup.
- **No Server Actions** (`use server`), **no middleware**, **no `next/headers`/`cookies()`** anywhere except the admin client. In practice the app is a **client-rendered SPA** with a set of backend API routes.
- **API routes (13), all server-only, all must stay hosted:** `api/turn`, `api/push/send`, `api/push/call`, `api/ai`, `api/account/delete`, `api/avatar`, `api/chat/[id]/status`, `api/chat/start`, `api/link-preview`, `api/mfa/recovery/{generate,consume}`, `api/payments/checkout`, `api/public-chat/[token]`. Server secrets they read: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_TRIGGER_SECRET`, `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_RATE_LIMIT_PER_MIN`, and the Supabase **service role** (via `src/lib/supabase/admin.ts` — the only service-role user).
- **Not a static export today:** `next.config.mjs` has no `output: 'export'`; the production build emits static + dynamic (ƒ) routes + serverless functions. Sentry is wired with a server tunnel route `/monitoring`.
- **No `next/image`** usage (screens use plain `<img>`), so static export won't hit the image-optimization blocker.

### 1.3 Authentication
- **Supabase Auth** via a single browser client (`src/lib/supabase/client.ts`): `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`, custom pass-through `lock`. **Session is persisted in `localStorage`** (supabase-js default) — not secure storage.
- Email/OAuth callbacks use `emailRedirectTo`/`redirectTo` = `${window.location.origin}/auth/callback`. Today `window.location.origin` is the Vercel origin; in a bundled app it becomes `https://localhost` / `capacitor://localhost`, which **breaks redirect URLs and OAuth** unless deep links + Supabase redirect allowlist are set up.
- Per-device identity + E2EE keystore in `src/lib/auth/local-identity.ts` (localStorage keys `device_bundle`, `active_device_id`, `username`, `toky_auth_user_id`) and IndexedDB DB `toky-e2ee`. Cleared on sign-out / account switch.

### 1.4 Messaging
- **`messages` table columns:** `id` (server-generated), `chat_id`, `ciphertext`, `content` (nullable), `nonce`, `message_type`, `sender_id`, `sender_device_id`, `sender_type`, `delivery_status` (nullable), `read` (bool), `created_at`, `edited_at`, `expires_at`.
- **Send path** (`src/lib/db/chats.ts` `sendMessage`): builds an envelope (opportunistic E2EE), sets `nonce = crypto.randomUUID()`, inserts one row. **There is no stable client-generated message ID and no idempotency key.** The UI shows an optimistic local echo (`id: local-<uuid>`) that is reconciled when the realtime/refresh row arrives.
- **Realtime:** Supabase `postgres_changes` channels (`src/lib/realtime/use-chat-realtime.ts`, presence, calls, notifications).
- Supported types seen in the payload: text, image(s), video, audio, file, gif, poll, reactions, replies, forwards, edits, disappearing messages, stars, archive. `delivery_status` + `read` already exist for 3-state ticks.
- **Attachments:** Supabase Storage bucket `chat-media`; encrypted media under `chats/<id>/enc/*.enc` (per-object AES-GCM key carried in the message payload), non-encrypted under `chats/<id>/…`. Signed URLs minted client-side.

### 1.5 Calling
- `src/lib/call/call-provider.tsx`: WebRTC, **signalling over a Supabase Realtime channel** (broadcast), ICE from `POST /api/turn` (Cloudflare TURN + STUN). Native pieces just added: `AudioRoute` plugin (loudspeaker) + `CallForegroundService` (mic + wake lock for screen-off). Online-only by nature.

### 1.6 Notifications
- **Native:** `@capacitor-firebase/messaging` (FCM token stored in `device_tokens`), tap handler routes to the target chat; delivered-notification clearing on foreground.
- **Web:** `public/sw.js` (push display + click-to-focus only — **no caching/offline logic**).
- **Server:** `POST /api/push/send` and `/api/push/call` (VAPID web-push + FCM), gated by `PUSH_TRIGGER_SECRET`.

### 1.7 Local persistence already in use
- **`localStorage`** (12 files): Supabase session, device bundle, active device id, username, wallpaper, UI prefs.
- **IndexedDB** (2 files): `toky-e2ee` keystore (identity private key) + local identity.
- **Secure storage** (1 file): `@aparajita/capacitor-secure-storage` in `src/lib/crypto/secure-store.ts` for key material (native).
- **No IndexedDB message cache, no Cache API, no SQLite today.** There is **no local database of chats/messages** — every read hits Supabase.

### 1.8 Security
- Supabase **RLS** throughout (messages = `is_chat_member OR is_store_staff_for_chat`; chat-media storage policies; store roles `superadmin/admin/agent`, `store_id` scoping). Service-role key is server-only. E2EE is a custom AES-GCM/ECDH scheme (`src/lib/crypto/e2ee.ts`, `keystore.ts`) — **not libsignal** — with wrapped per-chat keys in `chat_keys`, identity in `user_keys`, passphrase backup in `key_backups`.

---

## 2. Dependencies on the live Vercel URL
1. **The entire UI** (loaded via `server.url`).
2. **14 client call-sites** hitting **12 internal `/api/*` endpoints** (relative `fetch('/api/...')`) — these resolve to the Vercel origin only because the app *is* served from it.
3. **Auth redirect URLs** built from `window.location.origin`.
4. **Sentry tunnel** route `/monitoring`.
5. Push registration & service worker are served from the same origin.

Everything else (Supabase Auth/DB/Realtime/Storage, Cloudflare TURN) is already called **directly** against its own hosted endpoint, not through Next — so those are unaffected by bundling.

---

## 3. What can be bundled unchanged vs. must be refactored

**Bundle unchanged:** all client screens/components, Tailwind CSS, fonts/icons in `public/`, the Supabase client (talks directly to Supabase), realtime hooks, the crypto/keystore layer, native plugins.

**Must be refactored for a bundled/static build:**
- **`output: 'export'` blockers:** the dynamic client routes `chats/[chatId]` and `public-chat/[token]` (no `generateStaticParams`) → convert to client-side routing (read id/token from the URL at runtime) or a catch-all SPA fallback.
- **Internal API calls:** all 12 `/api/*` endpoints must be called at an **absolute hosted base URL** (`https://mobile-chat-mvp.vercel.app/api/...`) via a small `apiFetch()` wrapper + `NEXT_PUBLIC_API_BASE`.
- **Auth callbacks/deep links:** redirect URLs and OAuth/email confirmation must use a fixed app deep link, registered in Supabase's redirect allowlist and handled by `@capacitor/app`'s `appUrlOpen`.
- **Sentry:** the `/monitoring` tunnel won't exist in the bundle → send directly to the DSN (or drop the tunnel for mobile).
- **Config:** add a mobile build variant (`output: 'export'`, `images.unoptimized`), point `capacitor.config.ts` `webDir` at the export output and **remove `server.url`**.

**Must remain hosted (backend):** all 13 API routes and the service-role key. Recommended: keep them on Vercel for now; optionally migrate to Supabase Edge Functions later (larger change, not required for Phase 1).

---

## 4. Recommended technology choices
- **Local database:** **`@capacitor-community/sqlite`** (native SQLite on Android/iOS, `jeep-sqlite` Web fallback for dev). Best-maintained SQLite option for Capacitor; supports encryption-at-rest, migrations, and large datasets. *Not* localStorage.
- **Data-access layer:** a repository module per entity (`chatsRepo`, `messagesRepo`, …) so UI reads/writes SQLite and never calls Supabase directly for reads.
- **Attachment cache:** `@capacitor/filesystem` for binaries + a `local_attachments` metadata table (no blobs in SQLite).
- **Connectivity:** `@capacitor/network` for online/offline transitions.
- **Sync:** incremental pull keyed by a per-chat `updated_at`/server cursor; realtime events persisted to SQLite first; a durable `outgoing_operations` queue with client-generated idempotency keys.

## 5. Proposed local schema (Phase 2 preview)
`local_chats, local_chat_members, local_messages, local_attachments, local_contacts, local_stores, local_profiles, message_receipts, drafts, outgoing_operations, sync_state` — each syncable row carries `{ server_id, local_id, created_at, updated_at, server_rev, sync_status, deleted }`. Message status enum: `draft|pending|sending|sent|delivered|read|failed|cancelled`. Attachment status enum: `local_only|queued|uploading|uploaded|downloading|cached|failed|unavailable`.

## 6. Proposed synchronization strategy (Phase 3/6 preview)
Local-first reads (render SQLite immediately) → connectivity detect → session validate → **push** outgoing queue → **pull** incremental chat/message deltas into SQLite → update receipts → reconcile attachments → advance cursors. Idempotent, non-overlapping runs, cursor recovery, tombstones for deletes, dedup by client message id.

---

## 7. Main risks / blockers
1. **No idempotency today.** Offline queue + retries *will* duplicate messages unless we add a `client_message_id` column + unique constraint + upsert-on-conflict, and dedup realtime by that id. **Backend SQL migration + send-path change required.** (High priority, touches the server.)
2. **Dynamic routes block static export** — needs a routing refactor (`chats/[chatId]`, `public-chat/[token]`).
3. **Auth deep links** — OAuth/email/password-reset redirects must be reworked for the app origin, or users can't complete those flows in the bundled app. Requires Supabase dashboard config (redirect allowlist) — a manual step.
4. **E2EE + offline plaintext.** Storing message plaintext in SQLite must match the intended security model; keys must stay in secure storage. Retry must reuse the same logical message id so re-encryption doesn't fork a message.
5. **Session persistence in `localStorage`** is not secure storage; offline session validity + logout data-isolation need explicit rules (Phase 8).
6. **iOS** background audio/calls and secure storage parity are not yet implemented (Android-only native work so far).
7. **Realtime under mobile lifecycle** (background/reconnect) can drop events → sync must never trust realtime alone; always reconcile via incremental pull.
8. **Two build targets** (hosted web with API routes *and* a static mobile export from the same repo) adds build complexity; needs a clean, documented split so CI/Vercel/Codemagic don't collide.

---

## 8. Proposed phased implementation plan
Matches the requested order:
- **P1** Bundle the UI in the app; drop `server.url`; re-point `/api/*`; fix dynamic routes; deep-link auth. *(Native rebuild.)*
- **P2** Versioned SQLite + schema + migrations.
- **P3** Local-first reads (repository layer, pagination, indexes).
- **P4** Durable outgoing queue + client message ids + backend idempotency.
- **P5** Attachment queue + filesystem cache.
- **P6** Connectivity + sync engine.
- **P7** Conflict rules (server-authoritative vs local-pending).
- **P8** Secure storage + session/logout rules.
- **P9** E2EE compatibility.
- **P10** Calls/notifications/permissions parity.
- **P11** Offline UX states.
- **P12** Tests.
- **P13** Release/migration safety + rollback.

## 9. Exact files expected to change in Phase 1
- `capacitor.config.ts` — remove `server.url`; set `webDir` to the export output; adjust `androidScheme`/deep links.
- `next.config.mjs` — add a mobile build variant (`output: 'export'`, `images.unoptimized: true`); handle Sentry tunnel for mobile.
- `src/app/chats/[chatId]/page.tsx`, `src/app/public-chat/[token]/page.tsx` — convert to client-side routing (or a SPA catch-all) so export succeeds.
- **New** `src/lib/api/base.ts` (`apiFetch()` + `NEXT_PUBLIC_API_BASE`) and rewrite the 12 `/api/*` call-sites to use it.
- `src/lib/supabase/client.ts` + `src/app/login/page.tsx` + `src/app/auth/callback/page.tsx` — fixed deep-link redirect handling; add `@capacitor/app` `appUrlOpen` listener (new small module).
- **New** mobile build script (export → `cap sync`) + `package.json` script; Codemagic config update.
- `android/app/src/main/AndroidManifest.xml` + iOS `Info.plist` — deep-link intent filters / URL scheme.
- `docs/` — deep-link + Supabase redirect setup notes.
- No changes to Supabase/API routes in P1 (idempotency lands in P4).

## 10. Questions that genuinely need your input
1. **App origin / deep-link scheme:** OK to use `https://localhost` (Capacitor default, best for Web APIs like crypto/service worker) with a custom deep link (e.g. `app.toky.chat://auth`) for OAuth/email callbacks? This requires adding those redirect URLs to the **Supabase Auth redirect allowlist** (a dashboard step only you can do).
2. **Backend location:** keep the 13 API routes on **Vercel** (recommended for now) and point the app at that base URL — or do you want them moved to **Supabase Edge Functions** as part of this (larger scope)?
3. **Idempotency migration:** approval to add a `client_message_id` (unique) column to `messages` + upsert-on-conflict in Phase 4 — this is the only way to guarantee no duplicate messages from offline retries.
4. **Offline plaintext vs E2EE:** for chats that are end-to-end encrypted, do you want decrypted message text cached in local SQLite for offline reading (faster, but plaintext at rest on the device), or keep only ciphertext locally and decrypt on read? This is a security-policy call.
5. **Logout data policy:** on logout, should local chats/messages be **fully deleted**, or retained encrypted and restored only for the same account on next login?
6. **iOS scope now or later:** include iOS parity (background audio, secure storage, deep links) in this migration, or Android-first and iOS afterward?
