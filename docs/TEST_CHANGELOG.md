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
| **Calls drop after ~1 min** | Not a code bug and NOT missing env — `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_API_TOKEN` are set in Vercel. Suspected the stored TURN credentials are rejected by Cloudflare, so `/api/turn` silently falls back to STUN-only (which can't hold a call through mobile NAT). | Verify with a live test call + Vercel logs; if bad, replace the stored credential values. |
| **Android loudspeaker** | Fixed in code (item 5) but needs a new Android build to ship. | Include in the next Codemagic build. |
| **iOS loudspeaker** | Not implemented (native plugin is Android-only for now). | Add iOS AVAudioSession routing when iOS testing starts. |
| **AI features (smart replies / translate) fail** | `/api/ai` returns 502 — Anthropic API reports "credit balance is too low". | Top up the Anthropic account credits. |

## Pending native (Android) changes — batch before the next rebuild
Rebuild the Android app once to pick up **all** of these together:
- [ ] `AudioRoute` native plugin (call loudspeaker) — item 5 above.
