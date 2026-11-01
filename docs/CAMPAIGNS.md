# Campañas (base interna, envíos desactivados)

Base para difusiones internas a clientes, **sin envío real** y **sin proveedores
externos** (SMS/WhatsApp/email). No genera gasto. Este documento describe lo
construido y, sobre todo, **qué falta para enviar de forma fiable**.

> Estado: **estructura preparada, pendiente de configuración / desactivada.**
> El botón "Enviar" en la UI está deshabilitado a propósito.

## Qué hay hoy (implementado y verificado)

- **Consentimiento y baja por (tienda, cliente)** — tabla
  `store_customer_consent` (`consent`, `opted_out_at`, `source`). El
  consentimiento es **por tienda** (opt-in explícito); la baja tiene prioridad.
  RLS: el staff de la tienda lee, solo admin escribe.
- **Campañas con estado y límites** — tabla `campaigns`
  (`status` = draft/scheduled/sending/sent/cancelled, `daily_limit`,
  `scheduled_at`). RLS: staff lee, admin gestiona.
- **Audiencia autorizada** — RPC `campaign_audience_count(store_id)` (solo admin):
  cuenta los clientes **con consentimiento y sin baja**. No expone datos de
  clientes, solo el número.
- **UI de administración** (`Ajustes → Campañas`, solo admins): crear/editar
  **borradores**, ver la audiencia y el estado. El botón **Enviar está
  deshabilitado** con un aviso.

## Qué NO hay (a propósito)

- **No hay envío**: ni interno masivo ni a proveedores externos.
- **No hay captura de consentimiento** del lado del cliente todavía (ver abajo).
- **No hay materialización de destinatarios** por campaña (se haría al enviar).

## Qué falta para enviar de forma fiable (pendiente)

1. **Punto de captura de consentimiento (opt-in).** Hoy nadie escribe en
   `store_customer_consent`, así que la audiencia es 0 hasta definir **dónde y
   cómo** el cliente acepta recibir comunicaciones (p. ej. una casilla al iniciar
   el chat de soporte, o un mensaje de opt-in). Es una decisión de producto/legal.
2. **Mecanismo de baja (opt-out) para el cliente.** Por ejemplo, detectar una
   palabra clave ("BAJA"/"STOP") en el chat de soporte y marcar `opted_out_at`.
   Se puede apoyar en el motor de automatizaciones ya existente.
3. **Procesamiento en segundo plano.** No existe un worker/cron del lado del
   servidor para enviar en lotes con reintentos y respetar `daily_limit`. Hace
   falta:
   - Materializar destinatarios por campaña (tabla `campaign_recipients`:
     `campaign_id`, `customer_id`, `status`, `reason`) — **pendiente**.
   - Un worker que tome `campaigns` en estado `sending`, respete el límite diario
     y el consentimiento/baja vigentes, y actualice el estado.
4. **Canal de envío.** Dentro de Toky (solo a clientes que usan la app) o por un
   proveedor externo (SMS/WhatsApp/email). Lo externo implica **costo por
   mensaje**, cumplimiento por canal y un proveedor (decisión pendiente). Variables
   de entorno sugeridas cuando se decida (sin credenciales inventadas):
   - `CAMPAIGN_SENDER_ENABLED` — interruptor general (por defecto apagado).
   - `CAMPAIGN_CHANNEL` — `internal` | `sms` | `whatsapp` | `email`.
   - Las credenciales propias del proveedor elegido (según canal).
5. **Cumplimiento.** Registrar prueba de consentimiento, incluir forma de baja en
   cada envío y respetar límites legales por país.

Mientras no existan (1)–(4), las campañas quedan como **borradores**; no se envía
nada y no hay consumo.
