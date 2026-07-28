# Toky — Encryption Export-Compliance Technical Review (Revised)

**Purpose.** A factual, source-verified technical description of every encryption
mechanism in the Toky codebase, prepared so a **qualified export-control
professional** can evaluate U.S. Export Administration Regulations (EAR)
applicability. This document makes **no** EAR jurisdiction, ECCN, License
Exception ENC, mass-market, sanctions, or other legal determination.

**Evidence labels used throughout:**

- **[FACT — repository]** — verified in this repository's source (file/line cited).
- **[FACT — live configuration]** — would require the running deployment/console
  to confirm; flagged where used.
- **[PROVIDER-DOCUMENTED]** — behavior of a third-party service per its public
  documentation (link + checked-date given; see note on link verification).
- **[CONCLUSION]** — reasonable technical inference from code + a documented
  standard.
- **[ASSUMPTION]** — not verifiable from this repository; must be confirmed.
- **[LEGAL]** — a question requiring professional export-control/legal review.

**No secrets** (passwords, private keys, service-role keys, API tokens, VAPID
private keys, APNs/signing keys, or full env-var values) are included; only
variable **names** are referenced.

> **Link-verification note.** The review environment has restricted outbound
> network access, so the external URLs below were **not fetched** during this
> review. They are the canonical/authoritative locations and should be opened and
> re-confirmed by the reader. "Checked" dates reflect the review date
> (2026-07-28) as a *to-verify* marker, not a successful fetch.

> **Scope note (important).** This is an **export-compliance technical
> inventory, not a cryptographic security audit.** See §14.

---

## 1. Executive summary

- **Standard primitives, custom composition.** Toky implements **no proprietary
  cryptographic algorithms**. It uses standard primitives from the **Web Crypto
  API** (AES-GCM, ECDH P-256, PBKDF2, SHA-256). However, Toky implements its
  **own application-level protocol** for identity-key management, per-chat key
  generation, key wrapping/distribution, encrypted key backup, message-envelope
  formatting, and per-chat encryption activation. This composition **has not been
  identified as an implementation of a complete externally standardized messaging
  protocol** (e.g., it is not Signal/MLS) and **has not been independently
  audited.** **[FACT — repository]** (`src/lib/crypto/e2ee.ts`,
  `src/lib/crypto/keystore.ts`)
- **E2EE is optional / conditional, not universal.** Direct chats attempt to
  enable end-to-end encryption **automatically at creation on a best-effort
  basis**, but only succeed when **every participant has already enrolled an
  E2EE identity**. When that condition is not met — and for **group chats and
  channels**, and for messages sent **before** a chat was locked — message
  content is stored **server-readable** (protected by TLS in transit and database
  access controls, **not** by E2EE). **[FACT — repository]**
  (`src/lib/db/chats.ts:211-232,380-391`, `src/lib/crypto/keystore.ts:252-299`)
- **Unlocked messages are server-readable.** For non-encrypted chats the message
  is stored as plaintext JSON in `messages.ciphertext` **and** in a plaintext
  `content` column. **[FACT — repository]** (`chats.ts:380-391`)
- **Attachments/media are not application-level E2EE.** Media is uploaded to
  Supabase Storage; for encrypted chats the message payload (which may reference
  the media) is sealed, but the **media object itself is stored without Toky
  application-layer encryption.** **[FACT — repository]**
- **Calls** use standard **WebRTC DTLS-SRTP** (implemented by the browser/OS) in a
  **full-mesh peer-to-peer** topology; Cloudflare provides **STUN/TURN relay
  only**; no SFU/MCU/recording service and **no user-facing call-peer identity
  verification** were found. **[FACT — repository / CONCLUSION]**
- **Private keys** are stored as an **exported plaintext JWK in the app's
  IndexedDB** (browser/Capacitor WebView). The reviewed code does **not**
  demonstrate Apple Keychain, Android Keystore, Secure Enclave, or hardware-backed
  storage. **[FACT — repository]** (`keystore.ts:131-133,195-196`)
- **No sanctions or geographic controls** (country registration limits, IP
  geoblocking, denied-party/sanctioned-person screening, prohibited-end-use
  detection) were found. **[FACT — repository]**
- **Export classification is unresolved.** Toky uses AES-GCM-256 and ECDH P-256;
  classification under EAR Category 5, Part 2 (e.g., 5D002 vs. 5D992, License
  Exception ENC) requires professional review and is **not** determined here.
  **[LEGAL]**
- **No cryptographic security audit** (protocol review, pentest, formal
  verification) was performed. **[FACT — scope]**

---

## 2. Encryption inventory (corrected)

| # | Function | Library / Service | Version | Algorithm(s) | Key/param | Implemented by | Toky modifies crypto? | Source public? | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Transport security | Browser/OS + Supabase/Vercel/Cloudflare | platform/service | HTTPS/TLS (version negotiated) | n/a | Platform + providers | No | Yes | app-wide; exact TLS version **[PROVIDER-DOCUMENTED/ASSUMPTION]** |
| 2 | Message content sealing (locked chats) | Web Crypto API | platform | AES-GCM | 256-bit key, 96-bit random IV | Toky (standard primitive) | No | Yes | `e2ee.ts:82,137` **[FACT — repository]** |
| 3 | Identity keypair | Web Crypto API | platform | ECDH P-256 | 256-bit curve, extractable | Toky | No | Yes | `e2ee.ts:42-47` **[FACT — repository]** |
| 4 | Chat-key wrapping (app-level, ECIES-style) | Web Crypto API | platform | ephemeral ECDH P-256 → AES-GCM | 256-bit | Toky (custom composition) | No | Yes | `e2ee.ts:107-131` **[FACT — repository]** |
| 5 | Passphrase key backup (KDF) | Web Crypto API | platform | PBKDF2-HMAC-SHA-256 → AES-GCM | 210,000 iters, 16-byte salt, 256-bit | Toky | No | Yes | `e2ee.ts:156-193` **[FACT — repository]** |
| 6 | Safety-number fingerprint | Web Crypto API | platform | SHA-256 | 60 hex chars of digest | Toky | No | Yes | `e2ee.ts:197`, `fingerprint.ts:3` **[FACT — repository]** |
| 7 | Call media | WebRTC (browser/OS) | platform | DTLS-SRTP (mandatory in WebRTC) | negotiated | Browser/OS | No | Yes | `call-provider.tsx:362-393` **[CONCLUSION]** |
| 8 | STUN/TURN | Cloudflare Realtime TURN + public STUN | service | Relays DTLS-SRTP; TURN cred issuance | short-lived creds | Cloudflare | No | Service | `api/turn/route.ts` **[FACT — repository / PROVIDER-DOCUMENTED]** |
| 9 | Web Push **payload** encryption | `web-push` | ^3.6.7 | RFC 8291: ECDH P-256 + HKDF-SHA-256 + AES-128-GCM | 128-bit content key | Open-source lib | No | Yes | `api/push/send/route.ts`, `push/call/route.ts` **[FACT — repository]** |
| 10 | Web Push **server auth (VAPID)** — *distinct from #9* | `web-push` | ^3.6.7 | RFC 8292 VAPID: ECDSA P-256-signed JWT | n/a (auth, not payload) | Open-source lib | No | Yes | same files **[FACT — repository / CONCLUSION]** |
| 11 | Native push transport | Firebase Cloud Messaging | service | Provider transport | n/a | Google | No | Service | FCM path **[PROVIDER-DOCUMENTED]** |
| 12 | Password hashing | Supabase Auth (GoTrue) | service | bcrypt (observed in a test record) | provider-set cost | Supabase | No | Yes (GoTrue OSS) | see §9 **[PROVIDER-DOCUMENTED/ASSUMPTION]** |
| 13 | MFA (TOTP) | Supabase Auth | service | TOTP (RFC 6238) | provider params | Supabase | No | Yes | `auth/mfa.ts` **[PROVIDER-DOCUMENTED]** |
| 14 | MFA recovery-code hashing | Node `crypto` | runtime | SHA-256 (unsalted, unkeyed) | see §10 | Toky | No | Yes | `recovery-hash.ts:10` **[FACT — repository]** |
| 15 | DB/Storage at rest | Supabase | service | provider-managed | n/a | Supabase | No | Service | **[PROVIDER-DOCUMENTED/ASSUMPTION]** |
| 16 | Hosting/edge at rest | Vercel | service | provider-managed | n/a | Vercel | No | Service | **[PROVIDER-DOCUMENTED/ASSUMPTION]** |

## 3. Toky's custom protocol composition (explicit)

Distinguishing the three layers, as required:

1. **Standard algorithms** (not invented, not modified): AES-GCM, ECDH P-256,
   PBKDF2-HMAC-SHA-256, SHA-256 — all via the Web Crypto API. **[FACT — repository]**
2. **Toky's application-specific composition of those algorithms** (custom, in
   the sense of being Toky's own design, though built from standard parts):
   identity-key lifecycle, per-chat symmetric key generation, ECIES-style key
   wrapping to each member, server-side wrapped-key distribution (`chat_keys`),
   passphrase-encrypted private-key backup, message-envelope JSON formatting
   (`{"v":1,…}` plaintext vs. `{"e":1,iv,ct}` sealed), and per-chat activation.
   **[FACT — repository]** (`e2ee.ts`, `keystore.ts`, `chats.ts:380-391`)
3. **A professionally audited standardized protocol**: **not present.** The system
   is **not** identified as Signal, MLS (RFC 9420), OTR, or any complete published
   specification, and **no independent audit** was found. **[FACT — repository /
   scope]**

> Do not describe Toky's complete E2EE system as "a standard protocol." It is a
> standard-primitive-based, custom, unaudited composition.

## 4. End-to-end encryption assessment (corrected)

- **Optional / conditional, not guaranteed by default.** `createDirectChatWith`
  calls `lockChat` **best-effort** at creation (wrapped in try/catch), so a
  direct chat becomes encrypted **only if** `lockChat` succeeds.
  **[FACT — repository]** (`chats.ts:211-232`)
- **`lockChat` succeeds only when every member has a published identity public
  key.** If any member is missing (`missing.length > 0`), it returns `{ok:false}`
  and does **not** set `encrypted=true` — the chat stays plaintext. **[FACT —
  repository]** (`keystore.ts:266-274,294`)
- **Group chats / channels are not auto-locked.** `createGroupChat` /
  `createChannel` do not call `lockChat`. Treat groups and channels as **not
  E2EE** unless a user explicitly locks a group and all members are enrolled.
  **[FACT — repository]** (`chats.ts:234-260`)
- **No retroactive encryption.** `lockChat` is idempotent and never re-keys an
  already-locked chat; messages sent **before** locking remain in their original
  (plaintext) form. **[FACT — repository]** (`keystore.ts:261-264`)
- **Unlocked chats are server-readable.** Send path stores plaintext JSON in
  `ciphertext` and plaintext in `content`. **[FACT — repository]**
  (`chats.ts:380-391`)
- **Locked chats:** message text is AES-GCM-256 sealed under a per-chat key
  wrapped to each member's ECDH P-256 public key; server stores only public keys,
  wrapped keys, and ciphertext. Absent client compromise or a weak backup
  passphrase, stored server data does not reveal locked-chat content.
  **[CONCLUSION]**

**Suggested accurate wording:** *"Toky provides optional application-level
end-to-end encryption for chats where encryption has been enabled (direct chats
attempt this automatically when both participants have set up encryption). Chats
that are not encrypted — including group chats, channels, and messages predating
activation — store message content in server-readable form, protected by
transport encryption and database access controls but not by end-to-end
encryption."*

## 5. Attachment / media encryption (corrected)

- Images, videos, audio, and files are uploaded to **Supabase Storage** and
  referenced by path/URL. **[FACT — repository]**
- For a locked chat, the **message payload** (which may contain the media
  reference/metadata) is sealed, **but encrypting a reference does not encrypt the
  underlying file.** **[FACT — repository]** (no media-byte encryption found)
- The media object remains accessible per **Supabase Storage access policies**;
  **Storage access controls + TLS are not equivalent to E2EE.** An operator or
  infrastructure administrator with service-level access may technically access
  stored media. **[CONCLUSION]**

**Suggested wording:** *"Attachments are not currently end-to-end encrypted by
Toky. For encrypted chats the message payload containing the attachment reference
may be encrypted, but the underlying media object is stored without Toky
application-layer encryption."*

## 6. Private-key storage (corrected)

- The identity private key is **exported to a JWK and written as plaintext into
  the app's IndexedDB** (`toky-e2ee` database, `keys` store, `identity-priv`
  key). It is **not** stored in Apple Keychain, Android Keystore, Secure Enclave,
  or any hardware-backed store in the reviewed code. **[FACT — repository]**
  (`keystore.ts:28-60,131-133,195-196`)
- Documented sub-findings:
  - **Extractable from a compromised device:** The key is stored as a plaintext
    JWK, so an attacker with access to the app's IndexedDB could read it. **[FACT
    — repository]**
  - **Marked non-exportable?** No — the CryptoKey is generated `extractable=true`
    and is exported to JWK for storage. **[FACT — repository]** (`e2ee.ts:42`)
  - **Stored as plaintext locally?** Yes (unencrypted JWK). **[FACT — repository]**
  - **Included in device backups?** Whether OS/cloud backups capture app
    IndexedDB is platform-dependent and **not** determinable from the repo.
    **[ASSUMPTION / unanswered]**
  - **Removed on app-data clear?** Clearing the app's site/WebView data would
    remove IndexedDB and thus the key. **[CONCLUSION]**
  - **Screen-lock / biometric protection?** None found in the reviewed code.
    **[FACT — repository: absence]**
- Optional server backup is a **passphrase-encrypted** copy (PBKDF2 → AES-GCM) in
  `key_backups`; the passphrase never leaves the device. **[FACT — repository]**

**Suggested wording:** *"Toky stores the local private identity key in the
application's IndexedDB inside the browser or Capacitor WebView context. The OS
may sandbox app storage, but the reviewed code does not demonstrate storage in
Apple Keychain, Android Keystore, Secure Enclave, or hardware-backed key storage;
the key is held as a plaintext, exportable JWK."*

## 7. WebRTC call-encryption assessment (corrected)

*"Toky calls use WebRTC. Media is protected between WebRTC peers using DTLS-SRTP,
including when encrypted packets are relayed through a standards-compliant TURN
server. A TURN relay forwards encrypted media and ordinarily cannot decrypt its
contents. Toky does not implement an additional application-level
media-encryption protocol or a user-facing cryptographic identity-verification
mechanism for calls."*

Additional required detail:

- **Topology:** **full-mesh peer-to-peer** — one `RTCPeerConnection` per remote
  participant (`Map<string, RTCPeerConnection>`), local tracks added to each.
  **[FACT — repository]** (`call-provider.tsx:128,365-366`)
- **SFU / MCU / recording / media-processing service:** **none found.** No
  server-side media component, no `MediaRecorder`, no recording route.
  **[FACT — repository: absence]**
- **Independent authentication of signaling fingerprints:** DTLS fingerprints are
  exchanged via WebRTC signaling; **no separate/out-of-band authentication of
  those fingerprints** is implemented. **[FACT — repository: absence]**
- **User-facing call-peer verification (safety number for the call):** **not
  present.** (A SHA-256 safety-number exists for **chat identity keys**, not for
  verifying a call peer's media session.) **[FACT — repository]**
- **Cloudflare role:** **STUN/TURN relay only** (`api/turn/route.ts`), with
  short-lived credentials. **[FACT — repository]**

## 8. Third-party services and provider labels (corrected)

The following are **not** repository-verified and are labeled accordingly; each
needs confirmation against authoritative provider documentation (links to verify):

- **Supabase** — Auth (bcrypt, TOTP), Postgres, Storage; TLS in transit;
  at-rest encryption & key management **[PROVIDER-DOCUMENTED / ASSUMPTION]**.
  Verify: https://supabase.com/docs/guides/platform (and GoTrue source,
  https://github.com/supabase/auth). Checked (to-verify): 2026-07-28.
- **Vercel** — hosting/edge, TLS termination, at-rest **[PROVIDER-DOCUMENTED /
  ASSUMPTION]**. Verify: https://vercel.com/docs/security. 2026-07-28.
- **Firebase Cloud Messaging** — native push transport **[PROVIDER-DOCUMENTED]**.
  Verify: https://firebase.google.com/docs/cloud-messaging. 2026-07-28.
- **Cloudflare Realtime TURN** — STUN/TURN **[PROVIDER-DOCUMENTED]**. Verify:
  https://developers.cloudflare.com/realtime/turn/. 2026-07-28.
- **Standards** — Web Crypto:
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API ; RFC 8291
  (Web Push payload), RFC 8292 (VAPID), RFC 6238 (TOTP), RFC 8446 (TLS 1.3),
  RFC 8827 (WebRTC DTLS-SRTP mandatory). Checked (to-verify): 2026-07-28.

Exact **TLS versions**, **Supabase/Vercel at-rest algorithms and key
management**, **Firebase transport details**, **Cloudflare infra encryption**,
and **Apple/Google hardware-backed protection** are **not** repository-verifiable
and must not be presented as repository facts. **[ASSUMPTION / PROVIDER-DOCUMENTED]**

## 9. Password hashing and MFA (clarified)

- **Password hashing:** A **test-user** password record examined during earlier
  work used a **bcrypt-formatted** hash. Toky does **not** control Supabase's
  service-side hashing configuration; the exact production algorithm and cost
  must be confirmed via Supabase/GoTrue documentation or configuration. No hash
  value is reproduced here. **[FACT — repository (test record) / PROVIDER-DOCUMENTED
  (production)]**
- **MFA (TOTP)** — three distinct layers:
  1. **Toky client** calls Supabase MFA APIs (`supabase.auth.mfa.enroll/challenge/
     verify`). **[FACT — repository]** (`auth/mfa.ts`)
  2. **Supabase service-side TOTP** implementation and parameters (secret storage,
     algorithm, digits, period). **[PROVIDER-DOCUMENTED]**
  3. **Recovery-code hashing implemented by Toky** (see §10). **[FACT —
     repository]**

## 10. Recovery-code protection (detailed)

From `api/mfa/recovery/generate/route.ts`, `consume/route.ts`, `recovery-hash.ts`,
`rate-limit.ts`. **[FACT — repository]**

- **Count / length / format:** 10 codes; each 10 symbols shown as `XXXXX-XXXXX`.
- **Alphabet:** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 32 symbols (0/O/1/I removed).
- **Entropy:** 10 symbols × log2(32) = **~50 bits** per code. Because the alphabet
  size (32) divides 256, `byte % 32` is unbiased. **[CONCLUSION]**
- **RNG:** Node `crypto.randomBytes` (CSPRNG). **[FACT — repository]**
- **Storage:** only the **SHA-256 hex hash** (`code_hash`) is stored; **no salt,
  no keyed HMAC**. (Acceptable given ~50-bit entropy + rate limiting, but noted;
  unsalted fast-hash offers no protection for *low*-entropy secrets.) **[FACT —
  repository]**
- **One-time consumption:** a code matches only where `used_at IS NULL`, then is
  marked used. **[FACT — repository]**
- **Rate limits:** generate 10/60s, consume 5/60s per user — but the limiter is
  **in-memory per process** (per warm serverless instance), **not a durable
  global cap**. **[FACT — repository]** (`rate-limit.ts`)
- **Regeneration:** generating new codes **deletes all previous codes** first
  (previous codes are invalidated). **[FACT — repository]**
- **Effect of successful recovery:** all TOTP factors are **deleted** (2FA turned
  **off**) and all recovery codes cleared; the user must re-enable 2FA. **[FACT —
  repository]**
- **Audit logging of recovery events:** **none found** in the reviewed code.
  **[FACT — repository: absence / unanswered]**

*Do not claim hashing alone makes codes safe.* Safety here rests on **~50-bit
entropy + one-time use + rate limiting**; note the rate limiter's per-instance
scope as a limitation.

## 11. Web Push terminology (corrected)

- **Payload encryption (RFC 8291):** protects push **message content** using
  **ECDH P-256 + HKDF-SHA-256 + AES-128-GCM**. **[FACT — repository / CONCLUSION]**
- **VAPID (RFC 8292):** authenticates the **application server** to the push
  service via an **ECDSA P-256-signed JWT**. **VAPID is server identification,
  not the payload-encryption mechanism.** The two are separate functions (see
  inventory rows #9 and #10). **[FACT — repository / CONCLUSION]**

## 12. Sanctions-control findings (qualified)

Current implementation — **each absence is stated as "not implemented," not as a
legal violation**:

- **Country registration restriction:** Not implemented. **[FACT — repository]**
- **IP-based geoblocking:** Not implemented. **[FACT — repository]**
- **Denied-party / sanctioned-person screening:** Not implemented. **[FACT —
  repository]**
- **Prohibited-end-use detection:** Not implemented. **[FACT — repository]**

> For each: *"Not implemented. Whether this control is legally required for Toky's
> intended distribution requires professional sanctions/export-control review."*
> **[LEGAL]**

Distinctions that matter for a reviewer:

- **Google Play country availability** is a store-console setting (not in code)
  and does **not** restrict the **web app** (Vercel), **Supabase account
  registration**, **existing users traveling**, or **backend services** that keep
  operating outside Play. **[CONCLUSION]**
- The `country` values `GT`/`CR` (`src/types/chat.ts:4`,
  `api/chat/start/route.ts:11`) are **business routing**, not an export/sanctions
  control. **[FACT — repository]**

## 13. Distribution findings (evidence-based)

- **Web application (Vercel):** the app is a public Next.js site; **no
  geographic/registration gate was found in the repository.** Whether the
  deployment is publicly reachable and in which regions is a **[FACT — live
  configuration]** to confirm in Vercel — not inferable from code alone.
- **Registration:** email/password sign-up via Supabase Auth; **no invitation-only
  gate or country gate found in code.** **[FACT — repository]** (`app/login`)
- **Public customer-chat routes:** `GET/POST /api/public-chat/[token]` and
  `/public-chat/[token]` allow **token-scoped access without user
  authentication** (anyone holding a valid `public_token`). **[FACT —
  repository]**
- **Google Play track, TestFlight availability, selected Play countries:** **not
  determinable from the repository** (they live in the store consoles). Do **not**
  infer "limited distribution" from planning docs such as `STORE_SUBMISSION.md`.
  **[ASSUMPTION / live configuration — unanswered]**
- **Supabase auth geographic restrictions:** none found in code; provider/console
  setting. **[ASSUMPTION]**

## 14. Security-review limitation

> This review is an **export-compliance technical inventory, not a cryptographic
> security audit.** The use of standard algorithms does **not** establish that
> Toky's custom key-management and encryption protocol is secure. **No independent
> protocol review, penetration test, formal verification, or cryptographic audit
> was performed.** An independent cryptographic security review is recommended
> before making strong public E2EE claims.

## 15. Inaccurate / broader-than-supported public claims (with file references)

Each item below is **broader than the verified code** (which makes E2EE
conditional; see §4). Recommended path per item: **(a)** change the
implementation so the claim becomes universally true (e.g., enforce E2EE and
block sends when it can't be established), **or (b)** revise the wording to match
the current conditional behavior. *(No public files were modified in this
review.)*

- `src/app/privacy/page.tsx:68` — *"in direct (one-to-one) chats, the text and
  details of your messages are **end-to-end encrypted by default** … we cannot
  read that content."* → Overbroad: E2EE is best-effort/conditional; unenrolled
  counterpart or pre-lock messages are server-readable.
  *(Correctly states media not E2E and groups/channels not E2E.)*
- `src/app/terms/page.tsx:27` — *"Direct chats are **end-to-end encrypted by
  default**; group chats and channels may not be."* → Overbroad ("by default"
  unqualified).
- `docs/STORE_SUBMISSION.md:37-38` — *"direct-chat message text is
  E2E-encrypted."* → Overbroad (states unconditionally).
- `docs/STORE_LISTING.md:73` — *"Encryption is on by default for direct chats."*
  (reviewer notes) → Overbroad.
- `docs/STORE_LISTING.md:47,98,127` and `docs/STORE_SUBMISSION.md:127` — *"Turn on
  end-to-end encryption for private chats **only you and the recipient can
  read**."* → The "turn on" framing is closer to accurate, but "only you and the
  recipient can read" should be scoped to **locked** chats with **both** parties
  enrolled.
- `src/app/onboarding/page.tsx:100-102` — code comment *"is what lets direct chats
  be encrypted **by default**."* → Internal comment overstates; enrollment enables
  the *ability*, not guaranteed encryption of every chat.
- **Not found (good):** no claim that **all** messages are E2EE, that **media** is
  E2EE, that **calls** have independently verified E2EE, or that private keys are
  in **Apple Keychain / Android Keystore**. If such claims are added later
  (marketing, screenshots), they would be unsupported by current code.

## 16. Potential export-classification considerations (professional review) — [LEGAL]

- Whether Toky is **subject to the EAR** given it incorporates encryption.
- Whether **ECCN 5D002** applies. *Do not determine this from key size alone:*

> Toky uses AES-GCM-256 and ECDH P-256. A qualified export-control professional
> must evaluate these functions under the current EAR Category 5, Part 2 criteria,
> definitions, notes, exclusions, and License Exception ENC requirements. This
> report does not determine classification from key size alone.

- Whether Toky qualifies as **mass-market** software and the interplay with
  **License Exception ENC (§740.17)**, **self-classification report** vs. **BIS
  CCATS**, and possible **5D992** treatment.
- Whether **encryption registration / annual self-classification reporting** is
  required.
- Whether any **country/destination license requirements** apply.

None of the above is asserted as a conclusion. **[LEGAL]**

## 17. Unanswered questions

- Provider at-rest algorithms/key management (Supabase, Vercel); exact TLS
  versions; Firebase/Cloudflare infra crypto. **[ASSUMPTION / PROVIDER-DOCUMENTED]**
- Whether OS/cloud device backups capture the IndexedDB private key. **[ASSUMPTION]**
- Whether recovery events are logged anywhere (none found in code). **[unanswered]**
- Live distribution posture: Play track, TestFlight, selected Play countries, web
  reachability, whether registration is effectively open. **[live configuration]**
- Exact Supabase bcrypt cost and TOTP parameters. **[PROVIDER-DOCUMENTED]**
- Whether a decision will be made to make E2EE mandatory (and block sends when it
  can't be established) vs. keep it conditional. **[product]**

## 18. Recommended next steps (technical + legal)

**Technical**
1. Reconcile public E2EE claims (§15): either enforce E2EE for direct chats (and
   fail-closed) or revise Privacy/Terms/Store copy to describe conditional E2EE.
2. Decide on **media E2EE** for locked chats (currently plaintext-at-rest in
   Storage behind access controls).
3. Consider hardware-backed/OS-protected key storage and marking keys
   non-exportable; consider at-rest protection of the local JWK.
4. Consider durable (cross-instance) rate limiting and audit logging for recovery.
5. Consider a user-facing verification story for calls if stronger call claims are
   desired.

**Legal / compliance**
6. Engage a **qualified export-control professional** with §§2–11 to determine
   ECCN, ENC eligibility, and any registration/reporting.
7. Obtain **sanctions/export counsel** on whether any country/registration/
   screening controls are required for the intended distribution (none exist
   today).
8. Commission an **independent cryptographic audit** before strong public E2EE
   claims (§14).

## Final conclusion

> This report provides **technical facts** for export-classification analysis. It
> does **not** establish EAR jurisdiction, ECCN classification, mass-market
> status, License Exception ENC eligibility, reporting obligations, license
> requirements, or sanctions compliance — and **checking the Google Play export-law
> declaration is not, by itself, sufficient to establish compliance.** Those
> determinations require review by a qualified export-control professional.

---

*Prepared from source inspection only; the application and database were not
modified. Evidence labels indicate the basis for each statement. Not legal advice;
not a security audit.*
