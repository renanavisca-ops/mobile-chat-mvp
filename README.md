# Mobile Chat MVP (Signal-like E2EE)

MVP web con Next.js + Supabase + cifrado extremo a extremo real en cliente usando `@privacyresearch/libsignal-protocol-typescript`.

## HECHOS TÉCNICOS
- Stack: Next.js App Router, TypeScript strict, Tailwind, Supabase Auth/Postgres/Realtime/Storage, Vitest, Playwright, GitHub Actions.
- El servidor (Supabase) almacena únicamente `ciphertext` + metadatos mínimos de enrutamiento.
- Llaves privadas se generan y conservan en cliente (MVP: `localStorage`; para producción endurecida migrar a IndexedDB + cifrado local de almacenamiento).
- RLS habilitado en todas las tablas de negocio.

## DECISIONES DE DISEÑO
- **Librería elegida**: `@privacyresearch/libsignal-protocol-typescript` (opción A), por su orientación TypeScript y API directa para MVP web.
- Arquitectura modular de crypto (`src/lib/crypto`) para permitir reemplazo por `@signalapp/libsignal-client` sin tocar UI/DB.
- 1 dispositivo por usuario (constraint único en `devices.user_id`) para reducir complejidad de consistencia de sesión en MVP.

## ASUNCIONES
- `ASUNCIÓN_CONTROLADA`: flujo OTP email de Supabase es suficiente para auth MVP.
- `ASUNCIÓN_CONTROLADA`: el cliente publicará prekeys periódicamente; en este MVP se deja preparado el modelo y generación inicial.
- `FALTA_DATO_CRITICO`: parámetros finales de retención de mensajes y compliance regulatoria dependen del país/negocio.

## Threat model MVP
- Protege contra lectura de contenido por backend/DB compromise (mensajes cifrados).
- No protege contra dispositivo cliente comprometido.
- Verificación de identidad por fingerprint para mitigar MITM durante bootstrap de sesión.

## Rutas
- `/login`
- `/onboarding`
- `/chats`
- `/chats/[chatId]`
- `/settings`

## Variables de entorno
Copiar `.env.example` a `.env.local` y configurar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Levantar local
```bash
npm install
npm run dev
```

## Migraciones Supabase
Aplicar SQL en `supabase/migrations/202602250001_init.sql`.

## CI
Workflow en `.github/workflows/ci.yml` ejecuta lint, typecheck, tests y build.

## Deploy en Vercel
1. Push a GitHub.
2. Importar repo en Vercel.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy trigger.

## Limitaciones MVP
- UI de envío aún muestra canal cifrado y suscripción realtime; integrar encrypt/decrypt por chat en siguiente iteración.
- Almacenamiento local de llaves requiere endurecimiento (IndexedDB cifrado + secure enclave cuando aplique).
- Sin multi-device (diseño de tablas preparado para evolución).
