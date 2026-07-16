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

## Still required before you can ship (not code I can finish here)

1. **Developer accounts** — Apple Developer Program ($99/yr) and Google Play
   Console ($25 one-time).
2. **Push notifications rework** — the current web push (VAPID) does **not**
   fire inside the native wrapper. You need:
   - iOS: **APNs** key in App Store Connect + the `@capacitor/push-notifications`
     registration flow; add the Push Notifications capability in Xcode.
   - Android: a **Firebase** project → `google-services.json` dropped into
     `android/app/`, and FCM.
   - Server: branch `/api/push/send` to deliver to native device tokens vs. the
     existing web `push_subscriptions`. (A `device_tokens` table is the usual
     addition.)
3. **In-app account deletion** — Apple requires it (Guideline 5.1.1(v)).
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
