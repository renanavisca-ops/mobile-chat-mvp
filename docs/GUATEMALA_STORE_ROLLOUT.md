# Toky — Guatemala Store-Availability Runbook

How to run a **country-limited** rollout (Guatemala) for controlled testing, and
— critically — what a store country limit does and does **not** actually
restrict. Nothing here is a legal determination; export/sanctions questions are
flagged for counsel.

App id: **`app.toky.chat`** · Web origin: **`https://mobile-chat-mvp.vercel.app`**

---

## 1. Google Play — internal testing (fastest trial)

Internal testing is gated by a **tester email list**, not by country — up to 100
testers you name can install regardless of where availability is set.

1. **Play Console → create the app** (if not already): default language, app name
   *Toky Chat*, category Communication.
2. **App content** (left nav) — complete before you can release:
   - **Privacy policy:** `https://mobile-chat-mvp.vercel.app/privacy`
   - **App access:** provide the reviewer/demo login (`appreview@toky.chat`).
   - **Data safety:** fill from `docs/STORE_SUBMISSION.md §3`.
   - **Content rating:** IARC questionnaire (Communication + user content).
   - **Government apps / ads / target audience:** answer as applicable (no ads).
   - **Export laws:** see §4 below.
3. **Testing → Internal testing → Create release.**
   - Upload the **`.aab`** (built via Codemagic — see `MOBILE.md`).
   - Release name / notes, then **review and roll out**.
4. **Testers tab:** create an email list, add your testers, **save**. Share the
   **opt-in URL** with them; they accept, then install from Play.
5. Because `versionCode` now honors the CI build number (PR #2), each new
   Codemagic build uploads cleanly.

> Internal testing does **not** require setting country availability. You only
> pick countries for **closed testing, open testing, and production**.

## 2. Setting country availability to Guatemala (closed/open/production)

When you move beyond internal testing:

- **Play Console → Release → (Closed/Open testing or Production) → Countries /
  regions → Add countries → select _Guatemala_ only.**
- This controls **who can find/install from the Play Store** in that track.

## 3. Apple (for later — needs the iOS build via Codemagic)

- **TestFlight** is invite-based (tester emails or a public link), **not**
  country-gated — same as Play internal testing.
- **App Store** availability is chosen per-country in App Store Connect →
  *Pricing and Availability*; select Guatemala for a country-limited launch.

## 4. Export-law declaration (Google Play & Apple)

Both stores ask an **encryption / export** question. Toky uses **standard
encryption** (TLS + AES-GCM/ECDH via Web Crypto; see
`docs/ENCRYPTION_EXPORT_REVIEW.md`). Typical consumer apps using standard
encryption answer accordingly, but **the correct answer and any registration/
self-classification obligation must be confirmed by a qualified export-control
professional** — do not treat the store checkbox as establishing compliance.

## 5. What a store country limit does NOT restrict (important)

Limiting the **Play/App Store** country does **not** limit any of these:

- **The web app** — `mobile-chat-mvp.vercel.app` is served by Vercel and is
  reachable from **any** country. A Play limit does nothing to it.
- **Account registration** — Supabase Auth sign-up has **no geographic gate** in
  the code; anyone who reaches the web app can register.
- **Existing users traveling** — keep full access from anywhere.
- **Backend/API & realtime** — Supabase/Vercel/Cloudflare keep serving globally.
- **Public chat links** — token-scoped `public-chat/<token>` routes are reachable
  without login from anywhere.

**If you need Toky itself (not just the store listing) to be Guatemala-only**,
that requires **app-level controls** — country-gated registration, IP/geo
checks, and denied-party screening — **none of which are implemented today**
(see `ENCRYPTION_EXPORT_REVIEW.md §12`). Whether such controls are legally
required for your distribution is a **sanctions/export question for counsel**.

## 6. Pre-trial checklist

- [ ] `.aab` built via Codemagic and uploaded to **Internal testing**
- [ ] App content complete (privacy URL, data safety, content rating, app access)
- [ ] Export-law question answered (with professional confirmation)
- [ ] Reviewer/demo account works (`appreview@toky.chat`)
- [ ] Tester email list created + opt-in link shared
- [ ] Store listing text + screenshots + feature graphic uploaded
      (`docs/STORE_LISTING.md`, `npm run screenshots:store`, `npm run feature-graphic`)
- [ ] (Beyond internal test) country availability set to **Guatemala**
- [ ] Decide whether app-level geo/registration limits are needed (counsel)
