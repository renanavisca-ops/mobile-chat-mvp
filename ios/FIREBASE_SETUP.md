# iOS push (FCM) setup — one manual step

The Android side uses `android/app/google-services.json`. iOS needs its **own**
config file, `GoogleService-Info.plist`, which only you can download because it
contains keys tied to an iOS app you register in Firebase.

Everything else is already wired:

- `App.entitlements` → `aps-environment` (Push Notifications capability)
- `Info.plist` → `UIBackgroundModes` = `audio`, `remote-notification`
- `Podfile` → `CapacitorFirebaseMessaging`
- `AppDelegate.swift` → calls `FirebaseApp.configure()` **only if** the plist is
  present (so a build without it won't crash — it just won't have push yet)

## Steps (in the Firebase console)

1. Open the **toky-chat** Firebase project → **Project settings** → **Your apps**.
2. Click **Add app → iOS**.
3. **Apple bundle ID:** `app.toky.chat` (must match exactly).
4. Download the generated **`GoogleService-Info.plist`**.
5. Put it at **`ios/App/App/GoogleService-Info.plist`** and, in Xcode, make sure
   it's added to the **App** target (checked under *Target Membership*).
6. Under **Project settings → Cloud Messaging → Apple app configuration**, upload
   your **APNs Authentication Key** (`.p8`) — this is what lets FCM deliver to
   iOS. (Requires an Apple Developer account.)

## After adding it

```bash
npx cap sync ios
```

Then build (Codemagic or Xcode). On first launch the app will register for push
and store its token, same as Android.

> Until `GoogleService-Info.plist` is added, the iOS app builds and runs fine —
> it simply has no push notifications. Nothing else depends on it.
