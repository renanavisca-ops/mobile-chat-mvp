# Toky Chat — Store Submission Kit

Everything you paste into App Store Connect and Google Play Console. The data
sections are derived from the app's actual database schema and permissions, so
they match what the app really does.

---

## 1. What the app collects (source of truth)

No analytics or advertising SDKs are present, and the app requests **no location
and no device address-book access**. Everything below exists to make the
messaging product work.

| Data | Where | Purpose | Linked to user |
|---|---|---|---|
| Email + password | Supabase Auth | Sign-in | Yes |
| Display name, username, avatar | `profiles` | Your identity in chats | Yes |
| Messages (text/media, or ciphertext if a chat is encrypted) | `messages`, Storage | Deliver messages | Yes |
| Photos / videos you share or capture | Storage | Send in chats | Yes |
| In-app contacts (other Toky users you add) | `contacts` | Your contact list | Yes |
| Call metadata (time, participants, missed/answered) — **no recording** | `calls` | Call history | Yes |
| Reactions, polls, stories, story views | various | App features | Yes |
| Push token / device id | `device_tokens`, `push_subscriptions`, `devices` | Notifications | Yes |
| Encryption public keys + encrypted key backup (server can't read) | `user_keys`, `key_backups`, `chat_keys` | End-to-end encryption | Yes |
| Block / report records | `blocks`, `reports` | Safety / moderation | Yes |

**Processors** (infrastructure, not sold/shared for ads): Supabase (database,
auth, storage), Google Firebase (push delivery), Vercel (hosting), Cloudflare
(STUN/TURN for calls).
**In transit:** all traffic is HTTPS/TLS. **End-to-end encryption:** direct-chat
message text is E2E-encrypted; media attachments are not yet (disclose messages
as collected either way). **Deletion:** in-app account deletion removes the
account and its data, purges the user's Storage files, and cascades profile,
devices, tokens, contacts, blocks, memberships, and encryption keys; residual
backup copies purged within 90 days.

---

## 2. Apple — App Privacy ("nutrition label")

Set **"Data used to track you": None** (no ad/tracking SDKs → no ATT prompt).

Data linked to the user, all purpose **App Functionality** only:

- **Contact Info →** Email Address
- **User Content →** Photos or Videos; Other User Content (messages); Customer Support (reports)
- **Identifiers →** User ID; Device ID

> Payments are a **scaffold only** (no active checkout, no UI), so declare **no
> purchases** and there's no In-App Purchase requirement today. If you later sell
> digital goods, Apple requires In-App Purchase (not an external checkout) — wire
> that before enabling it.

Everything else (Location, Contacts, Health, Browsing History, Search History,
Diagnostics, Usage Data): **Data Not Collected.**

---

## 3. Google Play — Data safety form

- **Does the app collect or share user data?** Collect: Yes. Share: No (processors only).
- **Encrypted in transit?** Yes.
- **Can users request deletion?** Yes — in-app (Settings → delete account).

Data types to declare (Collected, Linked, purpose *App functionality*):

- Personal info: **Name, Email address, User IDs**
- Photos and videos: **Photos, Videos**
- Messages: **In-app messages**
- App activity: **App interactions** (calls/stories/reactions)
- Device or other IDs: **Device or other IDs** (push token)

Security section: "Data is encrypted in transit," "You can request that data be
deleted," and (optionally) "Committed to Play Families / follows security best
practices."

---

## 4. Age rating

- **Apple:** Unrestricted user-generated content + communication → expect **17+**.
  Answer "Yes" to user-generated content and confirm moderation exists (block,
  report, mute — all present).
- **Google (IARC questionnaire):** social communication app with user content and
  interaction → typically **Teen / Mature 17+**. Declare: users interact, share
  content, and content is moderated (block/report).

---

## 5. Store listing copy

**App name:** Toky Chat
**Subtitle (Apple, ≤30):** Private messaging & calls
**Primary category:** Social Networking · **Secondary:** Productivity

**Promotional text (≤170):**
Fast, private messaging with voice & video calls, group chats, stories, and
end-to-end encryption. Your conversations, your control.

**Description:**
> Toky Chat is a fast, modern messenger for staying close to the people who
> matter. Send messages, share photos, videos, GIFs and emoji, react, and start
> voice or video calls — one-on-one or in groups. Turn on end-to-end encryption
> for private chats only you and the recipient can read. Share moments with
> stories, keep an eye on your call history, and get notified the moment a
> message arrives — even when the app is closed.
>
> • Voice & video calls, with in-call switch to video
> • Group chats, reactions, polls, and stories
> • End-to-end encryption for private conversations
> • Block, report, and mute to stay in control
> • Available in English and Spanish
>
> No ads. No tracking. Just conversations.

**Keywords (Apple, ≤100 chars):**
chat,messenger,messaging,video call,voice call,groups,encrypted,private,stories,calls

**Required URLs:**
- Privacy Policy: `https://mobile-chat-mvp.vercel.app/privacy`
- Terms: `https://mobile-chat-mvp.vercel.app/terms`
- Support URL: *(add a support email/page — required by both stores)*

---

## 6. Pre-submission checklist

**Accounts & signing**
- [ ] Apple Developer account ($99/yr) + Google Play account ($25 once)
- [ ] iOS: `GoogleService-Info.plist` added + APNs key uploaded (`ios/FIREBASE_SETUP.md`)
- [ ] Bundle IDs match everywhere: `app.toky.chat`

**Build**
- [ ] `versionName` / `MARKETING_VERSION` and build numbers bumped
- [ ] Android release signing key created & backed up
- [ ] Build via Codemagic → TestFlight (iOS) / internal testing (Play)

**Assets**
- [ ] App icon (1024×1024, no alpha for iOS)
- [ ] Screenshots per required device size (6.7"/6.5" iPhone, 12.9" iPad; Play phone/tablet)
- [ ] Feature graphic (Play, 1024×500)

**Compliance**
- [ ] App Privacy (Apple) + Data Safety (Google) filled from sections 2–3
- [ ] Age rating questionnaire completed (section 4)
- [ ] Support URL live
- [ ] Test account/credentials provided to reviewers (chat needs login to review)
- [ ] Export compliance: app uses encryption → answer the encryption question
      ("standard encryption / exempt" typically applies; confirm for your case)

**Known review risk**
- [ ] iOS 4.2/2.5.2: app loads UI from the web. Have native features (push,
      camera, calls) ready to demonstrate; if rejected, bundle the UI. Not a
      functional blocker.
