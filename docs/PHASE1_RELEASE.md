# Phase 1 — Closed-Test Release Validation

> ⛔ **ON HOLD — DO NOT UPLOAD (owner directive, 2026-07-30).**
> Toky Chat is in its required Google Play closed-testing period for production
> access. The current closed-test release is **frozen**: do not upload this
> Phase 1 AAB, do not create a release in the closed track, do not change the
> installed version, and do not ask testers to update — until the owner
> explicitly confirms the testing period and production-access process are done.
> Phase 1 stays on branch `claude/chat-app-android-ios-0pb8r2` (unreleased) and
> must **not** be merged to `main` (the current native app loads `main`'s web UI
> remotely). The steps below apply only *after* explicit authorization.


This build is delivered as an **in-place update to the existing Google Play
closed-testing app** (`app.toky.chat`). It is **not** a new app/package/track.

> The Android AAB is built by **Codemagic** (this environment has no Android
> SDK). Values below marked _(from Codemagic)_ are produced by the build, not
> here — the exact `.aab` path, SHA-256 and final versionCode come from the
> Codemagic build log/artifact.

## Identity checks
| Item | Value |
|---|---|
| Android `applicationId` | **`app.toky.chat`** (unchanged) |
| Android `namespace` | `app.toky.chat` (unchanged) |
| Capacitor `appId` | **`app.toky.chat`** (unchanged, matches) |
| Current `versionCode` | CI-driven = `BUILD_NUMBER + 1` — **confirm the currently active value in Play Console** (repo fallback is `1`) |
| Current `versionName` | `"1.0"` (CI never overrode it before) |
| New `versionCode` | `BUILD_NUMBER + 1` of the next Codemagic build — **auto-monotonic**, higher than the last upload _(from Codemagic)_ |
| New `versionName` | **`1.1.0-phase1`** (now passed via `-PversionName`) |
| Signing | Release signed with the **Codemagic `CM_*` upload keystore** (`android_signing: keystore_reference`); no keystore/secret in the repo |
| Play App Signing | Assumed **enabled** (Codemagic holds the *upload* key; Google re-signs with the app key). Confirm in Play Console → App integrity |
| Local upload keystore | None committed (correct) |

## Upgrade compatibility — verdict: **compatible in-place update**, with one disclosed effect
- `applicationId`, `namespace`, signing identity: **unchanged** → Play accepts it as an update.
- Permissions **added** by the earlier call fixes: `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_MICROPHONE`, `WAKE_LOCK` — all **normal/install-time**
  (no runtime re-grant), upgrade-safe.
- Deep-link **intent filter added** (`tokychat://`) — additive, upgrade-safe.
- **WebView origin changes** `https://mobile-chat-mvp.vercel.app` →
  `https://localhost` (bundled UI). `localStorage`/`IndexedDB` are origin-scoped,
  so on update:
  - **Session is not carried over → testers must sign in again once.**
  - The device's E2EE identity key (in origin-scoped IndexedDB; native secure
    storage is currently disabled in code) is regenerated on next sign-in.
  - **Verified data-safety:** DB shows **0 E2EE-locked chats** (all 25 are
    opportunistic/unlocked) and message content is stored server-side, so
    **no messages or chats are lost** — they reload after sign-in. Nothing is
    encrypted with the old key, so regenerating the identity loses no history.
- **Net effect: a one-time re-login. No data loss.** This is disclosed in the
  release notes below.

## Local (Stage A) test results — run in this environment
| Check | Result |
|---|---|
| Typecheck / lint / unit tests (16) | ✅ pass |
| Web build (API routes intact) | ✅ pass |
| Mobile static export → `mobile/www` | ✅ pass (all routes static, `index.html` present) |
| `cap sync android` (assets bundled) | ✅ pass; `capacitor.config.json` has no `server.url` |
| No server secret in the bundle | ✅ verified (grep clean) |
| Package identity in bundle | ✅ `app.toky.chat` |
| **APK/emulator run, deep link, call, offline launch on device** | ⚠️ **NOT run here — no Android SDK.** Do on the debug/Codemagic build. |

## Stage B — build the signed AAB (Codemagic)
Workflow **“Toky Android (Play Store)”** already:
1. `npm ci` → `npm test`
2. **`node scripts/build-mobile.mjs --no-sync`** (static export → `mobile/www`)
3. `npx cap sync android`
4. `./gradlew bundleRelease -PversionCode=$((BUILD_NUMBER+1)) -PversionName="1.1.0-phase1"`
5. Prints the AAB path, versionCode, applicationId and SHA-256.

**Codemagic env required:** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL=https://mobile-chat-mvp.vercel.app`,
plus the existing `keystore_reference`.

Artifact: `android/app/build/outputs/bundle/release/app-release.aab` _(from Codemagic)_.
SHA-256: printed by the build step _(from Codemagic)_.

## Manual Play Console steps (you perform these)
1. Play Console → **Toky Chat** → **Testing → Closed testing** → open the **existing** track.
2. **Create new release**.
3. **Upload** the `app-release.aab` from Codemagic.
4. Verify shown **App bundle**: `versionCode` is higher than the active one, `versionName = 1.1.0-phase1`, package `app.toky.chat`.
5. Paste the **release notes** (below) into “Release notes”.
6. **Save** → **Review release**.
7. **Start rollout to Closed testing**.
8. Wait for **processing** (status → Available); Play may take minutes to hours.
9. Confirm the release shows as **available to testers** on the track.
10. Ask testers to **update via Google Play** (not sideload an APK).
11. Confirm the installed version: on device, **Settings → Apps → Toky Chat**, or Play listing shows `1.1.0-phase1`.
12. Record issues in your tracker without pausing the track.

**Do not create a new track. Do not roll out to production.**

## Tester release notes (paste into Play)
```
Toky Chat 1.1.0 (Phase 1 — bundled app)

What changed
• The app’s screens are now built into the app itself, so it opens even with no
  internet (you’ll see the interface instead of a blank screen).
• Sending/receiving messages, calls, media and sync still need internet.

Please note
• After updating you may need to sign in again once. Your chats and messages are
  safe on the server and will reload after you sign in.

Please report
• Blank screens on open, trouble signing in, missing chats, messages that won’t
  send/receive, missing notifications, call problems, or any update/install issue.
• Update through Google Play — don’t install a separate APK over the Play version.

Not included yet: reading old messages while fully offline (coming in a later update).
```

## Rollback procedure
- Recoverable pre-Phase-1 code: commit **`0846a70`** (tag `pre-phase1-bundling`
  created locally; the remote tag push was blocked by the git proxy — the commit
  itself is on the branch history and on `main` as `8f913cc`).
- Google Play will **not** accept an older `versionCode` as a downgrade.
- To roll back: check out `0846a70` (or `main` pre-Phase-1), rebuild via
  Codemagic with a **new, higher** `versionCode`, and upload that to the closed
  track. Uploading the *old* AAB does **not** roll back.
- Record the previously-accepted AAB’s versionCode/versionName from Play Console
  before uploading, so you know the number to exceed.

## Known risks
- One-time re-login for existing testers (disclosed). No data loss (0 locked chats).
- Auth email/reset deep links only open the app after the two Supabase redirect
  URLs are added (see `docs/OFFLINE_PHASE1.md` §5).
- Native APK build + on-device acceptance still pending (Codemagic + device).
- iOS not covered in this release (Android-first).

## Phase 1 completion gate
- [x] Stage A: local validation (build/export/sync/secret checks) — pass here.
- [ ] Stage A on-device (debug APK): offline launch, login, deep link, call — **you run**.
- [ ] Stage B: signed AAB updates the existing closed-testing install via Play — **you run**.
Phase 2 does not start until both device stages pass and you authorize it.
