# Toky — Pre-Public-Launch Security & Distribution Plan (Phase 1)

Audit + implementation plan for: mandatory direct-chat E2EE (fail-closed),
direct-chat **media** E2EE, native private-key protection, public-claims
reconciliation, and Guatemala-limited store distribution.

This is the **Phase 1 deliverable**. It changes no application code or database
state. Later phases each land as their own reviewable PR with tests. iOS build
verification is done via **Codemagic** (owner has Windows/iPhone/iPad, no Mac).

---

## 1. Current-state audit (verified from source)

### 1.1 E2EE model
- Primitives: Web Crypto only — ECDH P-256 identity, AES-GCM-256 chat keys +
  message sealing, PBKDF2-HMAC-SHA-256 (210k) key backup, SHA-256 fingerprint.
  `src/lib/crypto/e2ee.ts`.
- Key management: identity private key in **IndexedDB** (`toky-e2ee/keys/
  identity-priv`) as a plaintext exportable JWK; public key in `user_keys`;
  per-chat wrapped keys in `chat_keys`; optional passphrase backup in
  `key_backups`. `src/lib/crypto/keystore.ts`.
- Message envelope: unlocked → `ciphertext = {"v":1,...}` **plaintext** + plaintext
  `content`; locked → `ciphertext = {"e":1,iv,ct}`, `content = null`.
  `src/lib/db/chats.ts:380-391`.

### 1.2 Chat creation & fail-open confirmation
- `createDirectChatWith` (`chats.ts:211-232`) calls `lockChat` **best-effort**
  inside `try/catch`; on any failure it swallows the error and the chat stays
  **plaintext**. `lockChat` (`keystore.ts:252-299`) only sets `encrypted=true`
  when **every** member has a published `user_keys` identity; otherwise returns
  `{ok:false, missing}` and does nothing.
- **Conclusion: direct-chat encryption currently FAILS OPEN.** If the peer has no
  identity, or lock fails, messages are stored server-readable, and sending is
  still allowed. Group chats/channels never auto-lock.

### 1.3 Media upload flow
- `src/lib/storage/chatMedia.ts`: `uploadChatMedia/Image/Audio/File` upload the
  **original bytes** to the private `chat-media` bucket at
  `chats/<chatId>/<ts>_<uuid>_<name>.<ext>`; return `{ path }`. The message
  payload stores `imagePath/videoPath/audioPath/filePath/gifUrl` (+ `imagePaths`).
- Rendering: `createSignedChatMediaUrl(path, 300s)` → 5-minute signed URL.
- Size caps today: image 5 MB, video **200 MB**, (file/audio per code).
- For a **locked** chat the payload JSON (incl. the storage path) is sealed, but
  the **file object itself is plaintext at rest** in Storage. Thumbnails (where
  generated) are also plaintext.

### 1.4 Native runtime & Capacitor
- Capacitor **6.2.1** (`@capacitor/core|ios|android|cli ^6.2.1`).
- Native detection exists: `isNativeApp()` / `getPlatform()` in
  `src/lib/native-push.ts` (wraps `Capacitor.isNativePlatform()`).
- No secure-storage plugin is currently installed; keys live in IndexedDB on all
  platforms.

### 1.5 Affected surfaces (inventory)
| Area | Files / objects |
|---|---|
| E2EE core | `src/lib/crypto/e2ee.ts`, `keystore.ts`, `fingerprint.ts` |
| Send/gating | `src/lib/db/chats.ts` (send, `createDirectChatWith`, payload types), `src/components/chat-conversation.tsx` (composer, encryption toggle/labels) |
| Media | `src/lib/storage/chatMedia.ts`, `upload.ts`; render sites in `chat-conversation.tsx`, `public-chat/[token]/page.tsx` |
| Tables | `chats.encrypted`, `chat_keys`, `user_keys`, `key_backups`, `messages` (+ future `media_keys`/envelope fields carried inside sealed payload) |
| Storage | bucket `chat-media` (private) + its member RLS policies |
| RLS | `chat_keys`, `chat-media` INSERT/SELECT (member-scoped, already present) |
| API routes | none required for Phases 2–3 (client-side crypto); Phase 4 no new routes |
| i18n | `src/lib/i18n/en.ts`, `es.ts` |

### 1.6 Legacy compatibility requirements
- Existing **plaintext** direct chats and messages must remain readable and must
  **not** be relabeled as encrypted.
- Existing **plaintext media** (already-uploaded `chat-media` objects) must remain
  viewable via signed URLs and be clearly marked **legacy / not E2EE**.
- No re-encryption of history; `lockChat` already refuses to re-key.

---

## 2. Phase 2 — Mandatory, fail-closed E2EE for **new** direct chats

**Goal:** new direct chats are encrypted or they don't send — never silent
plaintext.

**Design**
- New send path: a message in a chat that is *intended encrypted* must produce a
  sealed envelope or **throw**; never fall back to plaintext `content`.
- Direct-chat creation: keep auto-lock, but surface state. Introduce an explicit
  per-chat "encryption required" notion for **new** direct chats:
  - If both parties enrolled → lock succeeds → encrypted.
  - If peer not enrolled → chat is created but **sending is blocked** with a
    localized explanation + CTA ("Ask <name> to open the app to finish setting up
    encryption" / self "Set up encryption").
- Preserve a **legacy** distinction: chats created before this change with
  `encrypted=false` and existing messages keep working, rendered with a
  clearly-labeled "not encrypted (legacy)" affordance; only *new* direct chats
  are subject to mandatory E2EE.
- Never mark old plaintext messages as encrypted.
- Groups/channels: unchanged, still labeled non-E2EE.

**Data / migration**
- No destructive migration. Optional additive column to distinguish "encryption
  required" chats if needed (e.g., `chats.enc_required boolean default false`),
  set true for new direct chats — decided during implementation; may be infer(a
  direct chat created after the cutover) instead of stored.

**Back-compat & rollback**
- Rollback = revert the PR; no data changes. Legacy chats unaffected either way.

**Tests (must prove plaintext-is-impossible on failure)**
- Unit: send into an "encrypted-required" chat with encryption **locked/unavailable**
  → throws, and asserts **no** `messages` row with plaintext `content` is written.
- Unit: `encryptForChat` returning null → send rejects (no insert).
- Unit: legacy plaintext chat still sends/render as legacy.
- Guard test: assert the send path has no code branch that writes plaintext when
  `encrypted`/required is set.

**Do NOT** claim Signal Protocol. Wording: "application-level E2EE using standard
Web Crypto primitives (unaudited composition)."

---

## 3. Phase 3 — Direct-chat **media** E2EE (documented, versioned format)

**Goal:** for encrypted direct chats, Storage receives **ciphertext** only.

**Proposed file-encryption format `toky-media-v1` (single-shot AEAD)**
- Per media object: generate a fresh **AES-GCM-256** key + **96-bit random IV**
  (unique per object; never reused with a key — each object has its own key).
- Encrypt the **entire file** in one AES-GCM operation (single-shot) → ciphertext
  uploaded to `chat-media` at the same path scheme with an `.enc` marker.
- The per-object media key + IV + `{alg:"AES-GCM", v:1, size, mime}` metadata are
  placed **inside the already-E2E-sealed message payload** (so the key never
  leaves the encrypted envelope; server sees only ciphertext + opaque sealed
  payload). Metadata is validated before decrypt.
- **Thumbnails:** generated client-side, encrypted as their own `toky-media-v1`
  object; **no plaintext thumbnails** for encrypted media.
- **Decrypt:** only on an authorized participant's device, into a Blob/object URL;
  **revoke** object URLs after use; avoid persistent writes to shared storage;
  clear buffers where practical.

**Size limits & the chunking question (needs your sign-off)**
- Single-shot AES-GCM requires the whole file in memory. Safe for images/audio/
  docs. The current **200 MB video cap is too large** for reliable single-shot
  in-browser/WebView encryption.
- **Recommendation:** for `toky-media-v1`, cap encrypted media at a memory-safe
  size (proposed **50 MB**; images 5 MB unchanged). Larger videos in encrypted
  chats are either rejected with a clear message **or** deferred to a **reviewed
  `toky-media-v2` chunked/streaming AEAD** (per-chunk unique IV, sequence-bound,
  authenticated) — **not** implemented until its construction is reviewed. *This
  is the one design decision I want explicit approval on before coding Phase 3.*

**Back-compat**
- Legacy plaintext media keeps working via signed URLs, labeled "legacy — not
  E2EE." No retroactive encryption. Encrypted objects are distinguished by
  payload metadata (and/or `.enc` path), so the renderer picks the right path.

**Tests**
- Upload in an encrypted chat → assert the object bytes in `chat-media` are
  **not** the original (ciphertext), and decrypt round-trips on an authorized
  device.
- Assert an unauthorized user cannot obtain the media key (it's only in the sealed
  payload) even if they fetch the object via a signed URL → gets ciphertext.
- Interrupted upload / retry / corrupted-tag / wrong-key → safe failure, no
  plaintext leak, no false "sent".

**Rollback:** revert PR; legacy media unaffected; encrypted objects remain
decryptable by clients with the sealed payload.

---

## 4. Phase 4 — Native private-key protection (iOS Keychain / Android Keystore)

**Goal:** on native, stop storing the identity private key as a plaintext JWK in
IndexedDB; use OS-backed secure storage. Web keeps the documented IndexedDB
fallback.

**Plugin selection (to finalize in-phase, with checks)**
- Candidate: **`@aparajita/capacitor-secure-storage`** — Capacitor 6 compatible,
  actively maintained, MIT, uses iOS **Keychain** and Android **EncryptedSharedPreferences/Keystore**.
- Before adding ANY plugin: verify **maintenance status, license, Capacitor-6
  compatibility, and native implementation** (Keychain/Keystore actually used).
  Do **not** claim **Secure Enclave**/hardware-backed unless verified on-device.

**Design**
- Abstraction `keyStore` with two backends chosen by `isNativeApp()`:
  - **native** → secure-storage plugin (Keychain/Keystore).
  - **web** → existing IndexedDB (documented fallback).
- **Migration (idempotent, recoverable):** on native startup, if an IndexedDB key
  exists and secure storage is empty → write to secure storage, **read back and
  verify** it matches, and only **then** delete the IndexedDB copy. If verify
  fails, keep IndexedDB and retry next launch. Never delete before verified.
- Never log private keys / passphrases / decrypted material.
- Preserve `key_backups` passphrase backup + multi-device recovery unchanged.
- Handle reinstall (native store may or may not persist — treat as "restore from
  backup"), logout, **account deletion** (clear native key material), user switch.

**Tests / verification**
- Android instrumented/unit test for store round-trip + migration idempotency.
- **iOS verification via Codemagic** (no Mac): a Codemagic workflow that builds
  the iOS app and runs the storage read/write/migrate check.

**Rollback:** feature-flag native backend; if disabled, falls back to IndexedDB
(no data loss — the key was verified before any deletion).

---

## 5. Phase 5 — Public-claims reconciliation
After Phases 2–4 verify, update Privacy, Terms, Support, encryption screens,
onboarding, `STORE_SUBMISSION.md`, `STORE_LISTING.md`, `ENCRYPTION_EXPORT_REVIEW.md`,
and store-console copy to state precisely: new direct chats = mandatory fail-closed
E2EE; legacy messages remain non-E2EE; whether direct media is E2EE; groups/channels
not E2EE; calls = WebRTC DTLS-SRTP (no separate audited call protocol); native vs web
key storage; and "not independently audited." No absolute claims
("unhackable"/"impossible to access"). *(Partial reconciliation already landed in
PR #13; Phase 5 finalizes it against the shipped behavior.)*

## 6. Phase 6 — `docs/GUATEMALA_STORE_ROLLOUT.md`
Runbook for country-limited distribution: Google Play country availability (GT),
App Store/TestFlight availability, what country limits do **and don't** restrict
(web app on Vercel, Supabase registration, traveling users, backend), and the
sanctions/export items requiring counsel. Documentation only.

---

## 7. Sequencing, risk & rollback summary

| Phase | Risk of data loss / unreadable msgs | Gate |
|---|---|---|
| 2 — mandatory E2EE (new chats) | Low (new chats only; legacy preserved) | tests prove no-plaintext-on-failure |
| 3 — media E2EE | Low–Med (legacy media preserved; **chunking decision** needed) | approve `v1` size cap / `v2` chunking before coding |
| 4 — native key storage | **Highest** (key migration) | delete IndexedDB only after verified read-back; feature-flag + Codemagic iOS check |
| 5 — claims | None (docs) | after 2–4 verified |
| 6 — GT runbook | None (docs) | anytime |

**Each phase = its own PR with tests.** Nothing is combined. No live-DB mutation
occurs without a reviewed, additive, reversible migration (Phases 2–4 need at most
additive columns; none drop or rewrite existing data).

## 8. Open decisions needing owner input before coding
1. **Phase 3 media size/chunking:** approve `toky-media-v1` single-shot with a
   **50 MB** cap (reject larger in encrypted chats), or authorize designing a
   reviewed `toky-media-v2` chunked format for large video.
2. **Phase 2 legacy UX:** confirm that *new* direct chats are fail-closed while
   *existing* plaintext chats stay usable-as-legacy (recommended), rather than
   forcing all direct chats.
3. **Phase 4 plugin:** approve evaluating `@aparajita/capacitor-secure-storage`
   (pending the maintenance/license/compat checks above).
