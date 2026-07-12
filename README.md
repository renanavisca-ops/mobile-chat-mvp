# Toky Chat

A fast, modern messaging web app built with Next.js + Supabase.

> **Note on security:** messages are currently stored server-side as readable
> content and are **not** end-to-end encrypted. They are protected in transit
> (HTTPS) and access is restricted per chat via Postgres Row-Level Security.
> Do not describe the app as "end-to-end encrypted" until real E2EE is
> implemented (a `libsignal` scaffold exists under `src/lib/crypto` for that
> future work). See the launch plan for the encryption task.

## Stack
- Next.js (App Router), TypeScript (strict), Tailwind CSS
- Supabase: Auth, Postgres, Realtime, Storage
- Vitest, Playwright, GitHub Actions (lint / typecheck / test / build)

## Features
- 1:1 and group chats with membership-based access (RLS on every table)
- Realtime message delivery, typing indicators, read receipts
- Online presence with a "hide online status" toggle
- Unique, case-insensitive usernames + user search
- Media: images, video, voice notes, in-page webcam capture
- Per-device chat wallpapers

## Routes
`/login` · `/onboarding` · `/chats` · `/chats/[chatId]` · `/contacts` ·
`/groups/new` · `/settings`

## Environment
Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Run locally
```bash
npm install
npm run dev
```

## Database
Migrations live in `supabase/migrations/`. Apply them to your Supabase project
(they are already applied to the live project).

## Deploy (Vercel)
1. Push to GitHub.
2. Import the repo in Vercel.
3. Set the three environment variables above.
4. Deploy.

## Roadmap
See the launch plan for phased work (legal/trust hardening, core parity,
media & creativity, growth features, then calls and real E2EE).
