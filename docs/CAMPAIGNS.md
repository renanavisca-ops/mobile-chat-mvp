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

## Captura de consentimiento y baja (implementado)

El cliente controla su consentimiento **por palabra clave** en el chat de
soporte (`src/lib/campaigns/optout.ts`, evaluado en `/api/public-chat`):

- **Baja / opt-out** (siempre se respeta): `baja`, `stop`, `cancelar`,
  `unsubscribe`, `darme de baja`, `no molestar`…
- **Alta / opt-in** (explícito): `alta`, `suscribir`, `quiero ofertas`…

Al detectarlo se actualiza `store_customer_consent` (por tienda-cliente,
`source='keyword'`), se confirma al cliente con un mensaje y se emite un evento
de integración (`support.consent_opt_in`/`_opt_out`). La audiencia
(`campaign_audience_count`) refleja estos cambios de inmediato. Es conservador
con palabras sueltas para evitar bajas accidentales (p. ej. "no" no es baja).

## Qué NO hay (a propósito)

- **No hay envío**: ni interno masivo ni a proveedores externos.
- **No hay materialización de destinatarios** por campaña (se haría al enviar).

## Qué falta para enviar de forma fiable (pendiente)

1. **Captura de consentimiento (opt-in) y baja (opt-out)** — ✅ **implementado**
   por palabra clave en el chat de soporte (ver sección anterior). Opcional a
   futuro: un opt-in más explícito (casilla al iniciar el chat).
2. **Procesamiento en segundo plano.** No existe un worker/cron del lado del
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

## Worker + canal SIMULADO (ya implementado, dev/test)

Para recorrer el flujo de envío **sin proveedor externo y sin costo** hay un
worker con canal simulado, **desactivado por defecto**. Se activa solo con:

```
CAMPAIGNS_ENABLED=1
CAMPAIGNS_CHANNEL=simulator
```

Con eso, `POST /api/campaigns/send { campaignId }` (solo admin de la tienda):
- enumera la **audiencia autorizada** (`store_customer_consent` con `consent=true`
  y sin `opted_out_at`),
- respeta el **límite diario** y no reenvía a quien ya tiene entrega (tabla
  `campaign_deliveries`),
- registra una entrega por destinatario con resultado **simulado** (`channel =
  'simulator'`; el marcador determinista de fallo está en `simulateDelivery`),
- actualiza el estado de la campaña a `sending` / `sent`.
- **No hace ninguna llamada externa.** Lógica pura en `src/lib/campaigns/sender.ts`
  con pruebas (`tests/campaigns-sender.test.ts`); tabla `campaign_deliveries` con
  RLS de solo-personal. El botón "Enviar" en Ajustes llama a este worker (muestra
  el aviso de desactivado si el gate está apagado).

## Qué falta para el canal REAL (sigue pendiente)

El simulador **no** es el canal real. Para enviar de verdad falta, además de la
decisión/cumplimiento por país:
- el **adaptador del proveedor** (SMS/WhatsApp/email) con su SDK y credenciales
  de servidor (nunca `NEXT_PUBLIC`), detrás de un `CAMPAIGNS_CHANNEL` propio;
- disparo del worker de forma recurrente (cron/cola) en vez de una llamada manual;
- plantillas aprobadas por el canal e inclusión de la baja en cada mensaje.
No basta con "poner una clave": ese adaptador aún no existe. Un simulador **no**
demuestra que el envío real funcione.

Mientras eso no exista, en producción (gate apagado) las campañas quedan como
**borradores**; no se envía nada y no hay consumo.
