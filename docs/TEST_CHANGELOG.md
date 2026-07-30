# Toky Chat — Test Changelog

A running record of changes made during testing, so they can be copied into
QA / test forms. Newest cycle first.

**Legend — where a change lives and what's needed for it to take effect:**

- **Web** = ships via the Vercel deploy of `main`. Takes effect on the next app
  launch (the Android shell loads the live site). **No app rebuild needed.**
- **Native** = Android/iOS project code. **Requires a new Codemagic build**
  (new APK/AAB) before it takes effect. The live web deploy alone won't include it.
- **DB** = Supabase migration / policy. Applied directly to the database.
- **Infra/CI** = build pipeline only; no user-facing effect.

---

## Cycle 3 — 2026-07-30

| # | Change | Area | Effect requires | Status |
|---|--------|------|-----------------|--------|
| 1 | **Unread chats pinned to the top of the chat list.** Chats with unread messages sort above read ones (most recent first in each group); once a chat is read it drops below the last unread. | Web | Vercel deploy | ✅ Fixed |
| 2 | **Media auto-loads without a tap.** Transient first-load failures (cold-start auth race) now auto-retry a couple of times, so images/audio stop needing a click to appear. | Web | Vercel deploy | ✅ Fixed |
| 3 | **Calls survive the screen turning off.** New microphone foreground service + wake lock keep mic access and CPU alive when the screen locks (this was the real "call cuts after ~1 min" cause — the screen was timing out). | **Native (Android)** | **New Codemagic build** | ⏳ Needs rebuild |
| 4 | **Speaker toggle now uses the modern Android 12+ audio API** (`setCommunicationDevice`), so the loudspeaker actually switches (old API was a no-op on newer Android). | **Native (Android)** | **New Codemagic build** | ⏳ Needs rebuild |

### How to test Cycle 3
- **Unread order:** Have two chats receive messages → both jump to the top; open/read one → it drops below the still-unread one.
- **Media auto-load:** Open a chat with images/voice notes → they appear on their own within a second or two (no tapping needed).
- **Calls screen-off (after new Android build):** Start a call → lock the screen / let it time out → call keeps going.
- **Speaker (after new Android build):** During a call, tap speaker → audio audibly switches to loudspeaker.

---

## Cycle 2 — 2026-07-30 (PR #36, merged → commit `55f11c9`)

| # | Change | Area | Effect requires | Status |
|---|--------|------|-----------------|--------|
| 1 | **Images "Object not found" fixed.** Media now loads per-attachment so one unreadable item can't blank the whole chat; failed tile shows tap-to-retry instead of a chat-wide error banner. | Web | Vercel deploy | ✅ Live |
| 2 | **Forwarding media fixed.** Forwarded images/audio/video/files are re-uploaded (re-encrypted) into the destination chat, so the new recipient can actually open them. | Web | Vercel deploy | ✅ Live |
| 3 | **Audio playback fixed for the sender.** Recorder now uses a format the device supports (was hard-coded webm → empty recordings on some Android phones). | Web | Vercel deploy | ✅ Live |
| 4 | **Notifications clear on app open.** Opening/foregrounding the app dismisses the phone's notification tray automatically. | Web | Vercel deploy | ✅ Live |
| 5 | **Android call loudspeaker works.** New native `AudioRoute` plugin drives the platform AudioManager (toggle + proper voice mode). | **Native (Android)** | **New Codemagic build** | ⏳ Needs rebuild |
| 6 | **Store-staff media read policy.** Store staff / superadmin who can read a chat's text can now also read its media. | DB | Applied | ✅ Live |
| 7 | CI build now runs with placeholder Supabase env so it stops failing on prerender. | Infra/CI | — | ✅ Done |

### How to test Cycle 2
- **Images:** Shop sends a photo (camera + gallery) → recipient opens the chat → image loads (no "Object not found").
- **Forwarding:** Forward an image from chat A to a contact in chat B → recipient in B can open it.
- **Audio:** Record and send a voice note → the **sender** can play it back → recipient can too.
- **Notifications:** Receive several push notifications → open the app → tray clears.
- **Speaker (only after a new Android build):** During a call, tap the speaker icon → audio switches to loudspeaker.

---

## Known outstanding issues (as of 2026-07-30)

| Issue | Diagnosis | Owner / next step |
|-------|-----------|-------------------|
| **Calls cut when the screen turns off** | ROOT CAUSE FOUND (Cycle 3): when the screen locks, Android suspends background mic access + CPU, killing the call. Fixed with a microphone foreground service + wake lock — needs a new Android build. (TURN turned out to be fine; the credentials are set and calls connect.) | Ships in the next Codemagic build. |
| **Android loudspeaker** | Fixed in code (Cycle 2 #5 + Cycle 3 #4, now using the modern Android 12+ API) but needs a new Android build to ship. | Include in the next Codemagic build. |
| **iOS loudspeaker / background calls** | Not implemented (native pieces are Android-only for now). | Add iOS AVAudioSession routing + background audio mode when iOS testing starts. |
| **AI features (smart replies / translate) fail** | `/api/ai` returns 502 — Anthropic API reports "credit balance is too low". | Top up the Anthropic account credits. |

## Pending native (Android) changes — batch before the next rebuild
Rebuild the Android app once to pick up **all** of these together:
- [ ] `AudioRoute` native plugin — call loudspeaker (Cycle 2 #5, Cycle 3 #4).
- [ ] `CallForegroundService` + wake lock — calls survive screen-off (Cycle 3 #3).

**Play Store note:** the microphone foreground service will require a short
justification in the Play Console's "Foreground service" declaration at
submission time.
