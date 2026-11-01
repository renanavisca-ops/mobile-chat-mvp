# Entrega — Automatizaciones, integraciones, campañas, pagos y seguridad

Resumen de lo realizado en esta tanda, bajo la condición de **no contratar
servicios ni generar gastos**: funciones completas donde se pudo, y estructura
mínima + documentación donde hacía falta un proveedor. Detalle vivo por punto en
`docs/ROADMAP.md`; guías de activación en `docs/INTEGRATIONS.md`,
`docs/CAMPAIGNS.md` y `docs/PAYMENTS.md`.

## Estado por categoría

### ✅ Implementado y verificado (por pruebas automáticas)
- **Automatizaciones por palabra clave** (PR #194): reglas por tienda que
  auto-responden y/o auto-etiquetan chats de **soporte**. Separación por empresa
  (RLS), permisos por rol, y controles anti-duplicado/bucle/sistema. **Cifrado:
  solo actúan sobre texto plano de soporte; nunca sobre chats E2EE.**
- **Seguridad del acceso a chats** (PR #187 y #198): corregido el acceso indebido
  a chats ajenos; lógica de autorización extraída a funciones puras con **pruebas
  de permisos y separación entre cuentas** (incluye regresión del bug).
- **Observabilidad** (PR #191): errores de las rutas API al registrador, **sin
  contenido de mensajes** (solo nombre de ruta).

### 🔧 Estructura preparada, pendiente de configuración
- **Integraciones / eventos** (PR #195): eventos internos + saneador (lista
  blanca, nunca contenido) + outbox `integration_events` (adaptador local
  verificable). Falta: adaptador externo (webhook/CRM) + worker. Ver
  `docs/INTEGRATIONS.md`.
- **Campañas** (PR #196): consentimiento/baja por tienda-cliente, estado y
  límites, audiencia autorizada, UI de borradores. Ver `docs/CAMPAIGNS.md`.

### ⛔ Desactivado hasta elegir proveedor
- **Campañas — envío** (PR #196): botón "Enviar" deshabilitado; sin worker ni
  canal (SMS/WhatsApp/email). Sin consumo.
- **Pagos** (PR #197): tabla + RLS + contrato cliente + rutas `checkout`/`webhook`
  en scaffold (501) + gate por entorno. **No procesa dinero, sin UI operativa.**

### 📱 Pendiente de pruebas reales (no verificado aquí)
- Flujo end-to-end de automatizaciones/eventos en un chat de soporte real.
- Pruebas de carga y compatibilidad de dispositivos (requieren infra/teléfonos).
- Efectos nativos previos (requieren build de Codemagic).

## Pruebas ejecutadas

- `tsc --noEmit`, `eslint`, `vitest` (**61 pruebas en verde**) y export móvil
  (28/28 páginas) en cada PR.
- Nuevas pruebas unitarias: matcher de automatizaciones (8), saneador de eventos
  (4), autorización de chats / separación de cuentas (9).
- Migraciones aplicadas y verificadas en la base de datos.

## Cómo activar cada integración después (variables, sin credenciales inventadas)

Todas del lado servidor (nunca `NEXT_PUBLIC_`, salvo el DSN de Sentry que es
público por diseño):

| Integración | Variables | Qué falta construir |
|---|---|---|
| **Observabilidad (Sentry)** | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENV` | Nada de código: la app ya funciona sin DSN; al ponerlo, empieza a reportar. |
| **Webhook / CRM** | `INTEGRATION_WEBHOOK_URL`, `INTEGRATION_WEBHOOK_SECRET` (o las del CRM) | Adaptador de entrega (lee outbox → POST firmado) + worker. |
| **Campañas — envío** | `CAMPAIGN_SENDER_ENABLED`, `CAMPAIGN_CHANNEL`, credenciales del canal | Captura de consentimiento, opt-out del cliente, worker, canal. |
| **Pagos** | `PAYMENTS_ENABLED`, `PAYMENTS_PROVIDER`, secreto del proveedor, `PAYMENTS_WEBHOOK_SECRET` | Integración real del proveedor en `checkout`/`webhook` + UI + cumplimiento. |

> Mientras esas piezas no existan, cada función queda inerte (borrador/no-op/501)
> y **no genera consumo**. El funcionamiento actual y la compatibilidad móvil se
> conservan (todo lo nuevo se auto-oculta para quien no es admin de tienda y se
> carga con lazy-loading).
