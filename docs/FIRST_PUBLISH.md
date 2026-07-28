# Publishing Toky to Google Play — a first-timer's guide

Plain-language, click-by-click. No coding, no Mac. Do it in order; each part says
roughly how long it takes and what you'll see. If a screen looks different, the
labels move around but the words are usually the same.

**The whole idea:** your app already runs as a website. We wrap that website into
an Android file (`.aab`), then upload it to Google Play and invite testers. That's
it. Three parts: **build the file → fill in store info → release to testers.**

You'll use two websites:
- **Codemagic** — builds and signs the app file for you (free).
- **Google Play Console** — where you upload it and manage testing.

---

## Part 0 — What you need (5 min)
- A **Google Play Developer account** ($25 one-time). You already have this — you're in the Console.
- A **GitHub account** that can see the `renanavisca-ops/mobile-chat-mvp` repo. (You have this.)
- That's it to start.

---

## Part 1 — Make the app file with Codemagic

### 1a. Create a Codemagic account (5 min)
1. Go to **https://codemagic.io** → **Sign up** → **Sign up with GitHub**.
2. Approve the GitHub permission prompt.
3. You're in. It's free (500 build-minutes/month — plenty).

### 1b. Connect the repo (3 min)
1. In Codemagic → **Add application** (or **Apps → Add application**).
2. Choose **GitHub** as the source.
3. If asked, **install the Codemagic GitHub app** and give it access to
   `renanavisca-ops/mobile-chat-mvp`.
4. Pick **`mobile-chat-mvp`** from the list.
5. When it asks the project type, choose **"Use codemagic.yaml"** (the build recipe
   is already in the repo). Select it.

### 1c. Make a signing key (10 min, one time)
Android apps must be **signed** — a digital signature that proves updates come from
you. You create a key file once and reuse it forever.

**Easiest way (needs Java's `keytool`):**
1. Install a free JDK if you don't have one: **https://adoptium.net** → download →
   install (Next, Next, Finish).
2. Open **Command Prompt** (Windows key → type `cmd`) and run this **one line**
   (change the password to something you'll remember):
   ```
   keytool -genkey -v -keystore toky-upload.jks -alias toky -keyalg RSA -keysize 2048 -validity 10000 -storepass CHANGE-ME -keypass CHANGE-ME
   ```
   Answer the questions (name, city, etc. — anything reasonable).
3. It creates **`toky-upload.jks`** in that folder. **⚠️ Back this file up** (email it
   to yourself, save in Google Drive) along with the password. **If you lose it, you
   can never update the app.**

*(No-command alternative: install Android Studio, open the `android` folder, then
Build → Generate Signed App Bundle → Create new… — the wizard makes the key with a
form.)*

### 1d. Give the key to Codemagic (5 min)
1. Codemagic → your app → **Settings** (gear) → **Code signing** → **Android**.
2. Upload **`toky-upload.jks`**, and enter:
   - **Keystore password** and **key password** (what you set above)
   - **Key alias:** `toky`
3. Set the **reference name** to exactly **`keystore_reference`** (the build recipe
   expects that name). Save.

### 1e. Build the file (10 min, mostly waiting)
1. Codemagic → your app → **Start new build**.
2. Pick the workflow **"Toky Android (Play Store)"** → **Start build**.
3. Wait ~5–10 min. It installs, runs the tests, syncs the app, and signs it.
4. When it's green ✅, download the **`.aab`** from the build's **Artifacts** section.

**You now have the app file.** 🎉

---

## Part 2 — Google Play Console: create the app & fill info

### 2a. Create the app (if not already) (3 min)
Play Console → **Create app** → name **Toky Chat**, language, **App**, **Free**,
accept the declarations.

### 2b. Do the "App content" tasks (20–30 min)
Left menu → **Policy → App content**. Fill each, using the text I prepared:
- **Privacy policy:** `https://mobile-chat-mvp.vercel.app/privacy`
- **App access:** the app needs login, so give the reviewer account —
  Email `appreview@toky.chat`, Password `TokyReview!2026`.
- **Ads:** No ads.
- **Data safety:** copy from `docs/STORE_SUBMISSION.md` (section 3).
- **Content rating:** answer the questionnaire (communication app, user content).
- **Target audience:** teen/adult (not children).
- **Government apps / financial / health:** No.

### 2c. Store listing (15 min)
Left menu → **Grow → Store presence → Main store listing**. Paste from
`docs/STORE_LISTING.md`:
- Short + full description
- **App icon**, **Feature graphic** (`assets/play-feature-graphic.png`), and
  **Screenshots** (run `npm run screenshots:store`, or take them on your phone).

---

## Part 3 — Release to internal testing

1. Left menu → **Test → Internal testing**.
2. **Testers tab → Create email list** → add your testers' Gmail addresses
   (include your own). Save.
3. **Releases tab → Create new release.**
4. **Upload** your `.aab`. Accept **Play App Signing** when prompted (Google keeps
   the master key safe; your `.jks` is the "upload key").
5. Add short **release notes** (e.g. "First internal test").
6. **Review release → Start rollout to Internal testing.**
7. Back on **Testers**, copy the **opt-in link** and send it to your testers.

Testers open the link on their Android phone → **Become a tester** → install from
Play.

---

## Tell your testers this
- After installing, **open the app once and sign up** — that turns on encryption.
- To message someone privately, **both of you must have opened the app once**
  (new private chats are encrypted and won't send until both sides are set up —
  that's on purpose).
- Available in **English and Spanish**.

---

## Country limit to Guatemala
Internal testing is by email list, not country, so no country setting is needed
yet. When you later move to closed/open testing or production, set availability to
Guatemala — see `docs/GUATEMALA_STORE_ROLLOUT.md` (and note what a country limit
does **not** restrict).

---

## If something goes wrong
- **Codemagic build fails:** open the build log; the failing step is red. Common
  causes: keystore reference name isn't `keystore_reference`, or the wrong password.
- **Play rejects the upload:** usually an unfinished **App content** task — the
  Console tells you which one.
- Stuck? Copy the error and ask — we'll fix it together.
