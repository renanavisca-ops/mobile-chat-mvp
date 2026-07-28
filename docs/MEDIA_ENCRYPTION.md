# Toky media encryption — `toky-media-v1`

Versioned, documented format for encrypting **attachments in encrypted direct
chats**. Implemented in `src/lib/crypto/media.ts`; uploaded/fetched via
`src/lib/storage/chatMedia.ts`.

## Goals
- Supabase Storage receives **ciphertext only** for encrypted chats.
- The media key never reaches the server — it travels **inside the already
  end-to-end-sealed message payload**.
- Authenticated encryption; unique key + nonce per object; no nonce reuse.

## Format v1
- **Cipher:** AES-GCM, 256-bit key, **single-shot** over the whole file.
- **Per object:** a fresh random 256-bit key and a fresh random **96-bit IV**
  (`crypto.getRandomValues`). Each object has its own key, so a nonce is never
  reused with a key.
- **Ciphertext object:** uploaded to `chats/<chatId>/enc/<ts>_<uuid>.enc` with
  content type `application/octet-stream`.
- **Metadata** (embedded in the sealed message payload under
  `enc[<storagePath>]`):
  ```json
  { "v": 1, "alg": "AES-GCM", "k": "<base64 raw key>", "iv": "<base64 iv>",
    "size": <plaintext bytes>, "mime": "image/png" }
  ```
  Metadata is **validated before decryption** (`v`/`alg`/`k`/`iv` present).
- **Decryption:** only on an authorized participant's device. Ciphertext is
  downloaded via a short-lived signed URL, decrypted in memory to a `Blob`, and
  exposed as an object URL that is **revoked on unmount**. No decrypted file is
  written to shared device storage.

## Size limits
- Single-shot requires the whole file in memory, so encrypted media is capped at
  **`MAX_ENC_MEDIA_BYTES = 25 MB`**. Larger files are **rejected** in encrypted
  chats with a clear message. (Images keep their 5 MB product cap upstream.)
- **Chunking:** intentionally **not** implemented in v1. A future `toky-media-v2`
  streaming/chunked AEAD (per-chunk unique, sequence-bound, authenticated IVs)
  would be required for larger video and **must be reviewed before use** — do not
  invent an ad-hoc chunking scheme.

## Thumbnails & metadata
- No plaintext thumbnails are stored for encrypted media. If a thumbnail is
  generated, it is encrypted as its own `toky-media-v1` object with its own key.
- Only non-secret display metadata (size, mime, file name for documents) travels
  in the sealed payload alongside the key.

## Legacy media (pre-v1)
- Attachments uploaded before this feature (or in non-encrypted chats) are stored
  **plaintext** and served via signed URLs. They are **not** end-to-end encrypted
  and are **not** retroactively encrypted. The renderer distinguishes them by the
  presence/absence of `enc[<path>]` metadata.

## Failure handling
- Interrupted upload / retry: a new random key+object is used on retry.
- Wrong key or tampered bytes → AES-GCM tag check fails → decryption throws; the
  UI shows an error rather than rendering anything.
- Oversized file → rejected before upload (no ciphertext or message is created).

## Threat notes
- An unauthorized user who obtains a signed URL downloads only ciphertext and
  cannot decrypt it without the key, which exists solely inside the sealed
  message envelope shared with authorized participants.
- This is a standard-primitive composition and has **not** been independently
  audited (see `ENCRYPTION_EXPORT_REVIEW.md`).
