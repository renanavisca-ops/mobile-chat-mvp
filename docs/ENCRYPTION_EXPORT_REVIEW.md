# Toky — Encryption Export-Compliance Technical Review

**Purpose.** A factual technical description of every encryption mechanism in the
Toky codebase, prepared so a qualified export-control professional can evaluate
U.S. Export Administration Regulations (EAR) applicability. This document makes
**no legal determinations**. It distinguishes throughout between:

- **[FACT]** — verified directly in the source code (file/line cited).
- **[CONCLUSION]** — a reasonable technical inference from the code plus a widely
  documented standard/provider behavior.
- **[ASSUMPTION]** — not verifiable from this repository; needs confirmation.
- **[LEGAL]** — a question requiring professional export-compliance/legal review.

No passwords, private keys, service-role credentials, API tokens, VAPID private
keys, APNs keys, or environment-variable **values** are included. Only variable
**names** are referenced where relevant.

---

## 1. Executive summary

- Toky is a civilian, consumer messaging web/mobile application (Next.js web app
  wrapped as iOS/Android via Capacitor).
- **All cryptography Toky implements itself uses standard primitives from the
  browser/runtime Web Crypto API.** There are **no custom or proprietary
  algorithms**, no modified algorithms, and no third-party crypto libraries for
  the message E2EE (the only crypto-related npm dependency is `web-push` for Web
  Push notifications). **[FACT]** (`src/lib/crypto/e2ee.ts`, `package.json`)
- **Optional** end-to-end encryption (E2EE) is available for chats and is
  **opt-in per chat** (a "lock chat" action), not on by default. When a chat is
  locked, message text is sealed with AES-GCM-256 under a per-chat key wrapped to
  each member via ECDH P-256; the server stores only ciphertext and public/
  wrapped-key material. When a chat is **not** locked, message text is stored as
  **plaintext** server-side (protected only by TLS in transit and database
  access controls at rest). **[FACT]** (`src/lib/db/chats.ts:380-391`,
  `src/lib/crypto/keystore.ts:294`)
- Voice/video calls use standard WebRTC, which mandates DTLS-SRTP media
  encryption implemented by the browser/OS; Cloudflare provides STUN/TURN only.
  **[FACT/CONCLUSION]** (`src/lib/call/call-provider.tsx`,
  `src/app/api/turn/route.ts`)
- Transport is HTTPS/TLS to Supabase and Vercel. Password hashing, TOTP MFA, and
  at-rest database/storage encryption are **provided by third parties** (Supabase
  Auth / infrastructure), not implemented by Toky. **[FACT/ASSUMPTION]**
- **No sanctions/geo controls are implemented** (no country registration limits,
  no sanctioned-territory blocking, no denied-party screening). The only
  "country" field in code is a business routing field (`GT`/`CR`), not a control.
  **[FACT]** (`src/types/chat.ts:4`, `src/app/api/chat/start/route.ts:11`)
- **[LEGAL]** The presence of standard encryption (TLS + AES/ECDH E2EE) commonly
  places consumer software using encryption within scope of EAR Category 5 Part 2
  analysis (e.g., ECCN 5D002 vs. mass-market 5D992 / License Exception ENC). This
  requires professional confirmation — see §11.

---

## 2. Encryption inventory table

| # | Mechanism | Library / Service | Version | Algorithm(s) | Key size | Implemented by | Toky modifies crypto? | Source public? | Key file(s) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Transport security | Browser/OS TLS + Supabase/Vercel | platform | HTTPS/TLS 1.2/1.3 | n/a | Platform + providers | No | Yes (platform) | app-wide (`https://…` endpoints) |
| 2 | Message E2EE (opt-in) — content sealing | Web Crypto API | platform | AES-GCM | 256-bit, 96-bit IV | Toky (standard primitive) | No | Yes (browser) | `src/lib/crypto/e2ee.ts:82,137` |
| 3 | Message E2EE — identity keypair | Web Crypto API | platform | ECDH, curve P-256 | 256-bit curve | Toky | No | Yes | `e2ee.ts:42` |
| 4 | Message E2EE — chat-key wrapping (ECIES) | Web Crypto API | platform | Ephemeral ECDH P-256 → AES-GCM-256 | 256 | Toky | No | Yes | `e2ee.ts:107-131` |
| 5 | Key backup KDF | Web Crypto API | platform | PBKDF2-HMAC-SHA-256, 210,000 iters → AES-GCM-256 | 256 | Toky | No | Yes | `e2ee.ts:156-193` |
| 6 | Safety-number / fingerprint | Web Crypto API | platform | SHA-256 digest | n/a (hash) | Toky | No | Yes | `e2ee.ts:197`, `src/lib/crypto/fingerprint.ts:3` |
| 7 | Voice/video call media | WebRTC (browser/OS) | platform | DTLS-SRTP (mandatory in WebRTC) | negotiated | Browser/OS | No | Yes | `src/lib/call/call-provider.tsx:362-393` |
| 8 | STUN/TURN relay | Cloudflare Realtime TURN + public STUN | service | Relays DTLS-SRTP; TURN creds via HMAC | n/a | Cloudflare | No | Service | `src/app/api/turn/route.ts` |
| 9 | Password hashing | Supabase Auth (GoTrue) | service | bcrypt | n/a | Supabase | No | Yes (GoTrue OSS) | provider (verified: demo users hash as bcrypt) |
| 10 | MFA (TOTP) | Supabase Auth | service | TOTP (RFC 6238, HMAC-SHA1) | n/a | Supabase | No | Yes | `src/lib/auth/mfa.ts` |
| 11 | MFA recovery codes | Node `crypto` | platform | SHA-256 (hash of code; codes never stored plaintext) | n/a | Toky | No | Yes | `src/lib/auth/recovery-hash.ts:10` |
| 12 | Web Push payload encryption | `web-push` (npm) | ^3.6.7 | RFC 8291: ECDH P-256 + HKDF-SHA-256 + AES-128-GCM (VAPID) | 128 (content), P-256 | Open-source lib | No | Yes | `src/app/api/push/send/route.ts`, `push/call/route.ts` |
| 13 | Native push transport | Firebase Cloud Messaging | service | Provider transport encryption | n/a | Google/Firebase | No | Service | `src/app/api/push/*` (FCM path) |
| 14 | Database/storage at rest | Supabase (Postgres + Storage) | service | Provider-managed (AES-256 typical) | n/a | Supabase | No | Service | provider — **[ASSUMPTION]** |
| 15 | Hosting/edge | Vercel | service | TLS termination, provider at-rest | n/a | Vercel | No | Service | provider — **[ASSUMPTION]** |

---

## 3. Algorithms and key sizes (Toky-implemented items only)

All items below are **standard NIST/IETF algorithms invoked via the Web Crypto
API** with no modification. **[FACT]** (`src/lib/crypto/e2ee.ts`)

- **ECDH, curve P-256** — identity keypair; ephemeral keys for key wrapping.
- **AES-GCM, 256-bit keys, 96-bit (12-byte) random IVs** — chat-key generation,
  chat-key wrapping, and message-content sealing. IVs from
  `crypto.getRandomValues`.
- **PBKDF2-HMAC-SHA-256, 210,000 iterations, 16-byte random salt** — derives a
  256-bit AES-GCM key-encryption-key from a user passphrase to protect the
  identity private-key backup.
- **SHA-256** — safety-number fingerprint of a public key; MFA recovery-code
  hashing (server side, Node `crypto`).

## 4. Libraries and versions

- **Web Crypto API** — runtime/OS/browser-provided (no npm package). Used for all
  Toky-implemented E2EE. **[FACT]** (`e2ee.ts` imports nothing crypto-related.)
- **`web-push` `^3.6.7`** (+ `@types/web-push` `^3.6.4`) — open-source; performs
  RFC 8291 Web Push encryption for browser push. **[FACT]** (`package.json`)
- **`@supabase/supabase-js` `^2.49.1`** — client to Supabase Auth/DB/Storage;
  crypto (bcrypt password hashing, TOTP) executes in the Supabase service.
- **Node `crypto`** (runtime built-in) — SHA-256 for recovery-code hashing.
- No `libsodium`, `tweetnacl`, `libsignal`, `crypto-js`, `openpgp`, `node-forge`,
  or similar are present. **[FACT]** (`package.json`)

## 5. File references supporting each finding

- E2EE primitives: `src/lib/crypto/e2ee.ts` (generateIdentity `:42`, AES-GCM key
  `:82`, deriveSharedAesKey `:90`, wrap/unwrap `:107-131`, encrypt/decrypt
  `:137-150`, PBKDF2 backup `:156-193`, fingerprint `:197`).
- Key management/storage: `src/lib/crypto/keystore.ts` (IndexedDB private key
  `:28-60`, publish public key to `user_keys` `:125`, passphrase backup to
  `key_backups` `:174-201`, per-chat wrapped keys in `chat_keys` `:221-320`,
  `lockChat` sets `chats.encrypted=true` `:294`).
- Encryption gating on send: `src/lib/db/chats.ts:380-391` (plaintext unless
  `chatRow.encrypted`).
- Fingerprint: `src/lib/crypto/fingerprint.ts:3`.
- WebRTC: `src/lib/call/call-provider.tsx` (RTCPeerConnection `:365`, offer/answer
  `:393`), ICE/TURN `src/app/api/turn/route.ts`.
- MFA: `src/lib/auth/mfa.ts` (Supabase TOTP), recovery hashing
  `src/lib/auth/recovery-hash.ts:10`.
- Web Push: `src/app/api/push/send/route.ts`, `src/app/api/push/call/route.ts`.
- Business "country" field (not a control): `src/types/chat.ts:4`,
  `src/app/api/chat/start/route.ts:11`.

## 6. End-to-end encryption assessment

- **Which conversations are E2EE:** only chats explicitly **locked** by a user.
  Locking calls `lockChat`, which generates a random AES-GCM-256 chat key, wraps
  it to each member's ECDH P-256 public key, stores wrapped keys in `chat_keys`,
  and sets `chats.encrypted=true`. **[FACT]** (`keystore.ts:252-300`)
- **Which are not:** all other chats (the default). For unlocked chats the send
  path stores the message as **plaintext** in `messages.ciphertext` (JSON
  `{"v":1,"text":…}`) **and** in a plaintext `content` column. **[FACT]**
  (`chats.ts:380-391`) → *The operator/database can read unlocked-chat content.*
- **Attachments/media:** **not** end-to-end encrypted by Toky. Media is uploaded
  to Supabase Storage (`chat-media` bucket) and referenced by URL; no
  application-layer encryption of media bytes was found. For a locked chat the
  message **payload** (which may include the media URL/metadata) is sealed, but
  the stored media object itself is protected only by TLS + Storage access rules.
  **[FACT/CONCLUSION]** (no media-encryption code found; `STORE_SUBMISSION.md`
  states the same.)
- **Where private keys are generated/stored:** generated in-browser via Web
  Crypto; the **identity private key is stored locally in IndexedDB**
  (`toky-e2ee` DB) and does **not** leave the device except as an **optional,
  passphrase-encrypted backup** (PBKDF2 → AES-GCM) uploaded to `key_backups`.
  **[FACT]** (`keystore.ts:28-60,174-201`)
- **What the server stores:** identity **public** keys (`user_keys`), opaque
  **wrapped** chat keys (`chat_keys`), optional **passphrase-encrypted** private-
  key backups (`key_backups`), and message **ciphertext** for locked chats.
  **[FACT]**
- **Can the operator decrypt locked-chat messages?** Not from stored data alone:
  the server holds only public keys, ciphertext, and passphrase-encrypted
  backups (the passphrase is never sent). **[CONCLUSION]** (standard ECIES/AES-GCM
  model; assumes the client is honest and the passphrase is strong — see §13.)
- **Key backup mechanism:** identity private key JWK → encrypted with
  PBKDF2-HMAC-SHA-256 (210k iters, random salt) derived AES-GCM-256 key → stored
  as `{salt, iv, ct}`. Restore requires the user passphrase. **[FACT]**
  (`e2ee.ts:169-193`)

## 7. WebRTC encryption assessment

- Calls use `RTCPeerConnection`; media is therefore protected by **DTLS-SRTP**,
  which is **mandatory in the WebRTC standard** and implemented by the
  browser/OS, not by Toky. **[FACT/CONCLUSION]** (`call-provider.tsx:362-393`)
- **ICE servers:** public STUN (`stun.cloudflare.com`, `stun.l.google.com`) plus
  **Cloudflare Realtime TURN**, with short-lived credentials minted server-side
  in `src/app/api/turn/route.ts` using `CLOUDFLARE_TURN_KEY_ID` /
  `CLOUDFLARE_TURN_API_TOKEN` (values not shown). If unset, STUN-only. **[FACT]**
- **Can TURN see call content?** TURN **relays** the already-encrypted DTLS-SRTP
  media; a standards-compliant TURN relay cannot decrypt it. **[CONCLUSION]**
- **Custom call encryption layer?** **None** — Toky adds no additional encryption
  on top of WebRTC's DTLS-SRTP. Note: with a TURN relay, calls are not
  cryptographically end-to-end beyond WebRTC's standard peer encryption; there is
  no Toky-added E2EE for calls. **[FACT]**

## 8. Third-party encryption services

- **Supabase** — Auth (bcrypt password hashing, TOTP MFA), Postgres database and
  Storage; TLS in transit; provider-managed at-rest encryption. Toky does not
  implement these. **[FACT for usage; ASSUMPTION for at-rest specifics]**
- **Vercel** — hosting/edge, TLS termination; provider at-rest. **[ASSUMPTION]**
- **Firebase Cloud Messaging** — native push transport (provider-encrypted).
- **Cloudflare** — STUN/TURN for calls (relay only).
- **Apple / Google platform APIs** — OS TLS, keychain/keystore, WebRTC DTLS-SRTP,
  APNs/FCM transport. Provided by the OS/platform.

## 9. Custom-cryptography confirmation

Based on a review of the source:

- **Custom or proprietary algorithms:** **None.** **[FACT]**
- **Modifications to standard algorithms:** **None** — algorithms are invoked
  through the Web Crypto API / standard libraries with standard parameters.
  **[FACT]**
- **User-selectable algorithms or key sizes:** **None** — parameters are
  hard-coded (P-256, AES-GCM-256, PBKDF2-SHA-256/210k). **[FACT]**
- **Cryptanalysis / interception / surveillance tooling:** **None found.**
- **Military/government/intelligence-specific functionality:** **None found.**

## 10. Intended-use confirmation

- **Civilian consumer messaging application** (chats, calls, stories, contacts).
  **[FACT — product scope]**
- **No** military/intelligence/weapons/surveillance/restricted-government
  functionality found. **[FACT — absence in code]**
- Currently positioned for **controlled testing / limited initial distribution**
  (internal testing / TestFlight per `docs/STORE_SUBMISSION.md`). **[FACT — docs]**
- **No code mechanism** intentionally distributes to, or screens out, sanctioned
  persons/uses (see §12). Intended-use statements about *not* targeting
  prohibited end-uses are **business representations**, not technical controls.
  **[LEGAL/ASSUMPTION]**

## 11. Potential export-classification considerations *(for professional review)*

Label all of the following **[LEGAL]** — issues to be confirmed by a qualified
export-control professional; none is a determination:

- Whether Toky is **subject to the EAR** given it incorporates encryption
  (standard TLS + AES/ECDH E2EE).
- Whether **ECCN 5D002** applies to the software (information-security
  functionality using >56-bit symmetric / >512-bit asymmetric — Toky uses
  AES-256 and ECDH P-256).
- Whether Toky qualifies as **"mass-market"** encryption software (consumer app,
  generally available, encryption not user-modifiable) and the interaction with
  **License Exception ENC** (§740.17) and possible **self-classification report**
  vs. **BIS classification (CCATS) request**.
- Whether **reclassification to 5D992** (mass-market) may apply after satisfying
  applicable requirements.
- Whether an **encryption registration / annual self-classification report** is
  required, and to which email/agencies.
- Whether any **country restrictions / license requirements** apply (e.g., EAR
  §740.17 excluded destinations; embargoed countries).

Supporting technical facts a professional will need are provided in §§2–9
(algorithms, key sizes, that encryption is standard/unmodified and not
user-configurable, and that the app is mass-market consumer software).

## 12. Sanctions-control findings (actual implementation)

Reviewed for controls; **findings reflect the current code**:

- **Limit Google Play distribution by country:** not controlled in code (a store-
  console setting, not implemented in-app). **Gap.**
- **Restrict registration by country:** **not implemented.** Sign-up is
  email/password via Supabase Auth with no country gate. **Gap.**
- **Block sanctioned territories (geo-blocking):** **not implemented.** No IP/geo
  checks found. **Gap.**
- **Screen restricted persons/organizations (denied-party screening):** **not
  implemented.** **Gap.**
- **Prevent prohibited end uses:** **not implemented** beyond Terms/PP text.
  **Gap.**
- The `country` values `GT`/`CR` in `src/types/chat.ts` and
  `src/app/api/chat/start/route.ts` are **business routing** (matching a user to a
  regional "store"), **not** an export/sanctions control. **[FACT]**

*(Per instructions, no restrictions were implemented as part of this review.)*

## 13. Unanswered questions

- Provider at-rest encryption specifics (cipher, key management) for Supabase and
  Vercel — not verifiable from this repo. **[ASSUMPTION]**
- Whether media/attachments should be E2E-encrypted for locked chats (currently
  not). **[FACT: not encrypted]** — product decision.
- Whether E2EE should be **default-on** for direct chats (currently opt-in);
  marketing copy in `docs/STORE_SUBMISSION.md` states direct chats are E2E, which
  is **broader than the code** (code = opt-in per chat). This discrepancy should
  be reconciled before making public encryption claims. **[FACT — discrepancy]**
- Exact Supabase GoTrue password-hash parameters (bcrypt cost) — provider default.
- Whether any additional environments enable/disable features that affect
  crypto (e.g., VAPID/TURN configured in production).

## 14. Recommended next steps

1. Engage a qualified **export-control professional** with §§2–9 to determine
   ECCN (5D002 vs. 5D992), ENC eligibility, and any registration/reporting.
2. Reconcile the **E2EE claim discrepancy**: either make encryption default-on
   for direct chats, or adjust store/marketing copy to say "optional E2EE."
3. Decide on **media E2EE** for locked chats (currently plaintext-at-rest in
   Storage, protected by TLS + access rules).
4. If required by counsel, add **sanctions/geo controls** (store-country limits,
   registration/geo checks, denied-party screening) — currently none exist.
5. Keep an **encryption fact sheet** (this document) updated as crypto changes.

## 15. Statements requiring professional legal confirmation

- Any EAR applicability, ECCN (5D002/5D992), License Exception ENC eligibility,
  mass-market status, and registration/reporting obligations. **[LEGAL]**
- Whether the current absence of sanctions/geo controls is acceptable for the
  intended distribution, or whether specific controls are legally required.
  **[LEGAL]**
- Whether "civilian/consumer, non-military" intended-use representations are
  sufficient as business statements absent technical enforcement. **[LEGAL]**
- Any country/destination restrictions or license requirements. **[LEGAL]**

---

*Prepared from source inspection only; the application and database were not
modified. Verification labels indicate the basis for each statement. This is a
technical description, not legal advice.*
