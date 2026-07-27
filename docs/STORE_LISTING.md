# Toky Chat — Store Listing (copy-paste ready)

Field-by-field text for **App Store Connect** and **Google Play Console**, in
English and Spanish. Character limits are noted; every value below is within
them. Data Safety / App Privacy answers live in `STORE_SUBMISSION.md` (§2–§3);
this file is only the marketing listing.

- **Reviewer login (both stores):** `appreview@toky.chat` / `TokyReview!2026`
- **Bundle ID:** `app.toky.chat`
- **URLs:** Privacy `https://mobile-chat-mvp.vercel.app/privacy` ·
  Terms `https://mobile-chat-mvp.vercel.app/terms` ·
  Support `https://mobile-chat-mvp.vercel.app/support` ·
  Marketing `https://mobile-chat-mvp.vercel.app`

---

## Apple — App Store Connect

| Field | Value |
|---|---|
| **App Name** (≤30) | Toky Chat |
| **Subtitle** (≤30) — EN | Private messaging & calls |
| **Subtitle** (≤30) — ES | Mensajes y llamadas privados |
| **Primary category** | Social Networking |
| **Secondary category** | Productivity |
| **Support URL** | https://mobile-chat-mvp.vercel.app/support |
| **Marketing URL** | https://mobile-chat-mvp.vercel.app |
| **Privacy Policy URL** | https://mobile-chat-mvp.vercel.app/privacy |
| **Age rating** | 17+ (user-generated content + communication) |

**Promotional Text** (≤170) — EN
> Fast, private messaging with voice & video calls, group chats, stories, and end-to-end encryption. Your conversations, your control.

**Promotional Text** (≤170) — ES
> Mensajería rápida y privada con llamadas de voz y video, grupos, historias y cifrado de extremo a extremo. Tus conversaciones, bajo tu control.

**Keywords** (≤100, comma-separated, no spaces) — EN
```
chat,messenger,messaging,video call,voice call,groups,encrypted,private,stories,calls
```
**Keywords** (≤100) — ES
```
chat,mensajería,mensajero,videollamada,llamadas,grupos,cifrado,privado,historias,mensajes
```

**Description** (≤4000) — EN
> Toky Chat is a fast, modern messenger for staying close to the people who matter. Send messages, share photos, videos, GIFs and emoji, react, and start voice or video calls — one-on-one or in groups. Turn on end-to-end encryption for private chats only you and the recipient can read. Share moments with stories, keep an eye on your call history, and get notified the moment a message arrives — even when the app is closed.
>
> • Voice & video calls, with in-call switch to video
> • Group chats, reactions, polls, and stories
> • End-to-end encryption for private conversations
> • Block, report, and mute to stay in control
> • Available in English and Spanish
>
> No ads. No tracking. Just conversations.

**Description** (≤4000) — ES
> Toky Chat es un mensajero rápido y moderno para mantenerte cerca de las personas que importan. Envía mensajes, comparte fotos, videos, GIFs y emojis, reacciona e inicia llamadas de voz o video, individuales o en grupo. Activa el cifrado de extremo a extremo para chats privados que solo tú y el destinatario pueden leer. Comparte momentos con historias, revisa tu historial de llamadas y recibe notificaciones en el instante en que llega un mensaje, incluso con la app cerrada.
>
> • Llamadas de voz y video, con cambio a video durante la llamada
> • Chats grupales, reacciones, encuestas e historias
> • Cifrado de extremo a extremo para conversaciones privadas
> • Bloquea, reporta y silencia para mantener el control
> • Disponible en español e inglés
>
> Sin anuncios. Sin rastreo. Solo conversaciones.

**App Review — Notes to reviewer**
> The app's UI loads from our hosted web app inside a native shell (Capacitor);
> native features (push notifications, camera, and voice/video calls) run
> through native APIs and can be demonstrated with the demo account. Sign in
> with the credentials below; the account already has chats, a group, and
> contacts. Encryption is on by default for direct chats.
>
> Demo account — Email: appreview@toky.chat · Password: TokyReview!2026

---

## Google Play — Console

| Field | Value |
|---|---|
| **App name** (≤30) | Toky Chat |
| **App category** | Communication |
| **Tags** | Messaging, Chat, Video calling |
| **Contact email** | (your support email) |
| **Website** | https://mobile-chat-mvp.vercel.app |
| **Privacy Policy** | https://mobile-chat-mvp.vercel.app/privacy |
| **Content rating** | Teen / Mature 17+ (IARC questionnaire) |

**Short description** (≤80) — EN
> Private messaging with voice & video calls, groups, and encryption.

**Short description** (≤80) — ES
> Mensajería privada con llamadas de voz y video, grupos y cifrado.

**Full description** (≤4000) — EN
> Toky Chat is a fast, modern messenger for staying close to the people who matter. Send messages, share photos, videos, GIFs and emoji, react, and start voice or video calls — one-on-one or in groups. Turn on end-to-end encryption for private chats only you and the recipient can read. Share moments with stories, keep an eye on your call history, and get notified the moment a message arrives — even when the app is closed.
>
> Features:
> • Voice & video calls, with in-call switch to video
> • Group chats, reactions, polls, and stories
> • End-to-end encryption for private conversations
> • Block, report, and mute to stay in control
> • Available in English and Spanish
>
> No ads. No tracking. Just conversations.

**Full description** (≤4000) — ES
> Toky Chat es un mensajero rápido y moderno para mantenerte cerca de las personas que importan. Envía mensajes, comparte fotos, videos, GIFs y emojis, reacciona e inicia llamadas de voz o video, individuales o en grupo. Activa el cifrado de extremo a extremo para chats privados que solo tú y el destinatario pueden leer. Comparte momentos con historias, revisa tu historial de llamadas y recibe notificaciones al instante, incluso con la app cerrada.
>
> Funciones:
> • Llamadas de voz y video, con cambio a video durante la llamada
> • Chats grupales, reacciones, encuestas e historias
> • Cifrado de extremo a extremo para conversaciones privadas
> • Bloquea, reporta y silencia para mantener el control
> • Disponible en español e inglés
>
> Sin anuncios. Sin rastreo. Solo conversaciones.

**App access — test credentials** (Play Console → App content → App access)
> All functionality requires sign-in. Provide these reviewer credentials:
> Email: appreview@toky.chat · Password: TokyReview!2026

---

## Graphics still needed (assets, not text)

| Asset | Spec | How |
|---|---|---|
| Screenshots | 6.7"/6.5" iPhone, iPad 12.9", Play phone/tablet | `npm run screenshots:store` (see MOBILE.md) |
| App icon | 1024×1024, no alpha (iOS) | already generated in `assets/` / native projects |
| Feature graphic (Play) | 1024×500 | design asset — not yet created |

> Set the primary listing **language** to Spanish (Guatemala) if that's your main
> market, then add English (U.S.) as an additional localization — paste the EN
> values into it. Both stores let you ship multiple locales in one submission.
