# Toky — Native Apps (Android + iOS)

Toky ships to the App Store and Google Play as a **Capacitor** native shell that
boots into the live Next.js app hosted on Vercel. Because the app is
server-rendered (App Router + API routes), we don't bundle the web build — a
tiny local loader (`mobile/www/index.html`) shows a splash, checks
connectivity, then navigates the WebView to the hosted origin (whitelisted via
`server.allowNavigation`). Web updates therefore reach users instantly without
an app-store review; only native-shell changes (icons, plugins, permissions)
need a new store build.

- App id: **`app.toky.chat`**
- Hosted origin: **`https://mobile-chat-mvp.vercel.app`** (edit in
  `capacitor.config.ts` **and** `mobile/www/index.html` if it ever changes)

## Layout

| Path | What it is |
|---|---|
| `capacitor.config.ts` | Capacitor config (app id, allowed origin, plugins) |
| `mobile/www/` | The thin local loader (splash + offline screen + boot) |
| `android/` | Generated Android Studio project (committed, editable) |
| `ios/` | Generated Xcode project (committed, editable) |
| `assets/` | Source art for the icon/splash generator |
| `scripts/generate-icons.mjs` | Regenerates all icons + splashes from the gradient "T" |
| `codemagic.yaml` | Cloud build pipelines (no Mac required) |

## Everyday commands

```bash
npm run icons        # regenerate web + native icons/splashes
npm run cap:sync     # copy loader + plugins into android/ and ios/
npm run cap:android  # sync + open Android Studio (needs local Android SDK)
npm run cap:ios      # sync + open Xcode (needs a Mac)
```

## Store screenshots

Both stores require screenshots at several device sizes (6.7"/6.5" iPhone, iPad
12.9", Play phone/tablet). `scripts/store-screenshots.mjs` drives the live app
with a real login and renders every screen at the exact pixel size each store
wants — the full matrix in one command:

```bash
TOKY_EMAIL=demo@toky.chat TOKY_PASSWORD='…' npm run screenshots:store
# → screenshots/<device>/<screen>.png  (upload per store size)
```

Use the **reviewer/demo account** here (the same credentials you give App Store
/ Play reviewers). It needs network access to the hosted app + Supabase, so run
it on a normal machine — a locked-down CI/agent sandbox will block those hosts.
Add `TOKY_HEADFUL=1` to watch it, or `TOKY_THEME=light` for light-mode shots.

## Native key storage (E2EE private key)

On the **native apps**, the end-to-end-encryption identity **private key** is
stored with the OS secure-storage plugin
[`@aparajita/capacitor-secure-storage`](https://github.com/aparajita/capacitor-secure-storage)
(MIT; v6 line for Capacitor 6): **Apple Keychain** on iOS,
**EncryptedSharedPreferences (Android Keystore-backed)** on Android. On the
**web** the key stays in the browser's **IndexedDB** (documented fallback).

- Runtime is detected with `isNativeApp()`; the plugin is only loaded on native.
- On first launch after updating, a **one-time, verified migration** moves any
  existing IndexedDB key into secure storage and deletes the IndexedDB copy
  **only after** a successful read-back (`src/lib/crypto/key-migration.ts`,
  unit-tested). If verification fails, the IndexedDB copy is kept (recoverable).
- `cap sync` auto-links the native plugin — no extra native config needed.
- We do **not** claim Secure Enclave / hardware-backed storage; that depends on
  the device and is not asserted.

## Building without a Mac (Codemagic)

You don't have a Mac, so iOS is built in the cloud with **Codemagic** (macOS
build machines). `codemagic.yaml` defines an `ios` and an `android` workflow.

One-time setup in the Codemagic UI:

1. **Connect** this GitHub repo.
2. **iOS signing** — add the **App Store Connect API key** integration (named
   `CodemagicKey` in the yaml) and enable automatic code signing for bundle id
   `app.toky.chat`. Codemagic creates/uses the distribution certificate +
   provisioning profile for you.
3. **Android signing** — upload a release keystore as `keystore_reference`.
   (Generate once: `keytool -genkey -v -keystore toky.keystore -alias toky
   -keyalg RSA -keysize 2048 -validity 10000`.)
4. **Variable groups** — create `toky_ios` (add `APP_STORE_APPLE_ID`) and, if
   auto-publishing to Play, `toky_android` (add `GCLOUD_SERVICE_ACCOUNT`).
5. **Run** the `ios` workflow → produces a signed `.ipa` and uploads to
   TestFlight. Run `android` → produces a signed `.aab` for Play.

From there you submit for review in App Store Connect / Play Console (both
browser-based — no Mac needed).

> Alternatives to Codemagic with the same "no Mac" property: EAS Build,
> Ionic Appflow, GitHub Actions with a `macos` runner.

## What's already wired

- ✅ App icons + splash (Android adaptive + legacy, iOS marketing icon), brand
  gradient "T", generated from a single source.
- ✅ PWA `manifest.webmanifest` + Apple touch icon (also makes the web app
  installable from the browser).
- ✅ Native permission declarations for **camera/microphone** (WebRTC calls)
  and **push notifications**, plus iOS background modes (`audio`,
  `remote-notification`).
- ✅ Thin loader with an offline screen and connectivity retry.
- ✅ **Native push wired end to end** — `@capacitor-firebase/messaging` on the
  client stores an FCM token in the `device_tokens` table; the server
  (`src/lib/fcm.ts`) delivers to it from `/api/push/send` and `/api/push/call`
  alongside the existing Web Push. Needs the Firebase config below to go live.
- ✅ **Native attachment files** — `@capacitor/filesystem` + `@capacitor/share`
  (`src/lib/native-files.ts`). Because every chat is end-to-end encrypted, an
  attachment's plaintext only exists in-app after decryption; the WebView can't
  save or open an in-memory (`blob:`) file. The document preview writes the
  decrypted bytes to the device and either keeps them (Download → Documents) or
  hands them to the OS share sheet (Open/Print/Share). No extra native config or
  permission — `cap sync` links the plugins and Share auto-wires a FileProvider.
  **Requires a new native build:** the currently installed test app predates
  these plugins, so the buttons only work once testers update to a build made
  after this change.

## Setting up native push (Firebase / FCM)

The code path is done; it stays dormant until Firebase is configured. FCM
delivers to Android directly and to iOS via APNs, so there's one server path.

1. Create a **free Firebase project** and add an **Android app** (package
   `app.toky.chat`) and an **iOS app** (bundle id `app.toky.chat`).
2. **Android:** download `google-services.json` → drop it in `android/app/`.
   (The Gradle wiring is already present and auto-applies when the file exists.)
3. **iOS:** download `GoogleService-Info.plist` → add it to the Xcode `App`
   target. Upload your **APNs Auth Key (.p8)** to Firebase → Project Settings →
   Cloud Messaging, and enable the **Push Notifications** capability on the App
   target (an `App/App.entitlements` template with `aps-environment` is
   included — point the target's *Code Signing Entitlements* at it if it isn't
   already). The `Podfile` pulls the Firebase pod automatically on `pod install`.
4. **Server:** Firebase → Project Settings → Service accounts → *Generate new
   private key*. Paste that JSON into the **`FCM_SERVICE_ACCOUNT`** env var in
   Vercel (see `.env.example`). Redeploy.

That's it — no schema work; the `device_tokens` table already exists. Turning on
push in the app's Settings registers the device and starts delivery.

## Still required before you can ship (not code I can finish here)

1. **Developer accounts** — Apple Developer Program ($99/yr) and Google Play
   Console ($25 one-time).
2. **Firebase config for push** — the delivery code is done (see "Setting up
   native push" above); you just need to create the free Firebase project, drop
   in the two config files, upload the APNs key, and set `FCM_SERVICE_ACCOUNT`.
3. **In-app account deletion** — Apple requires it (Guideline 5.1.1(v)).
   *(An `/api/account/delete` route already exists — confirm it's reachable from
   a Settings screen in the app UI.)*
4. **Privacy policy + Terms** finalized and lawyer-reviewed (both stores
   require a public privacy policy URL; Apple privacy "nutrition labels" and
   Google "Data Safety" form must match what the app collects).
5. **UGC safety** — a chat app with user content + calls needs report/block
   flows and a moderation contact to satisfy store review and age rating.
6. **Store listings** — screenshots, descriptions, age ratings, categories.

## Review-rejection watch-outs

- Apple **Guideline 4.2 (minimum functionality)** can flag thin web wrappers.
  Toky's native push + real WebRTC calls are the justification — make sure both
  work on a physical device before submitting.
- Test **camera/mic prompts** actually appear (the usage strings are in
  `ios/App/App/Info.plist` and `android/.../AndroidManifest.xml`).
