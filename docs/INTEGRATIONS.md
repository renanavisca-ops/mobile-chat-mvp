# Integraciones (estructura preparada)

Este documento describe la base de integraciones **ya construida** y **qué falta**
para conectar un proveedor externo (CRM, webhook) más adelante, sin sorpresas.

> Estado: **estructura preparada, pendiente de configuración.** No hay envíos a
> direcciones externas ni API pública. Nada genera gasto. El "adaptador" activo
> es local: solo graba eventos para inspección.

## Qué hay hoy

- **Eventos internos** (`src/lib/integrations/events.ts`): tipos de evento y un
  **saneador de datos** que deja pasar únicamente metadatos escalares de una
  lista blanca (`ALLOWED_KEYS`). El contenido de los mensajes, credenciales o
  cualquier dato sensible **nunca** entra en un evento, aunque el productor los
  pase por error (probado en `tests/integration-events.test.ts`).
- **Seam de despacho** (`src/lib/integrations/dispatch.ts`,
  `recordIntegrationEvent`): el único punto que llaman los productores. Hoy usa el
  **adaptador local**: inserta el evento en la tabla `integration_events`
  (outbox). Cambiar a un adaptador externo **no toca** a los productores.
- **Outbox** (`public.integration_events`): `store_id`, `type`, `data` (jsonb no
  sensible), `delivered` (bool), `created_at`. RLS: **solo los administradores de
  la tienda leen** sus eventos; solo el rol de servicio inserta.
- **Productores ya emitiendo** (eventos no sensibles):
  - `support.chat_created` — al crear un chat de soporte (`/api/chat/start`).
  - `support.message_received` — al recibir un mensaje del cliente
    (`/api/public-chat/[token]`), con `hasText` (booleano), nunca el texto.
  - `support.chat_status_changed` y `support.chat_assigned` — al cambiar estado o
    asignación (`/api/chat/[id]/status`).

### Cómo verificarlo hoy (sin proveedor)

Como administrador de una tienda, los eventos quedan en `integration_events` y se
pueden inspeccionar por SQL:

```sql
select type, data, created_at
from public.integration_events
where store_id = '<tu_store_id>'
order by created_at desc
limit 20;
```

## Qué falta para activar un proveedor externo (pendiente, requiere decisión)

No construido a propósito (evita gasto y módulos sin uso). Para habilitar la
entrega saliente a un **webhook** o **CRM**:

1. **Elegir destino** y definir su contrato (URL de webhook, o API del CRM).
2. **Variables de entorno** (aún no existen; nombres sugeridos, sin credenciales
   inventadas):
   - `INTEGRATION_WEBHOOK_URL` — URL destino del webhook saliente.
   - `INTEGRATION_WEBHOOK_SECRET` — secreto para firmar el cuerpo (HMAC) y que el
     receptor valide autenticidad.
   - (CRM) las credenciales propias del proveedor elegido.
3. **Adaptador de entrega** (nuevo, pequeño): un proceso/endpoint que lea las
   filas `delivered = false` de `integration_events`, haga `POST` firmado al
   destino, y marque `delivered = true` con reintentos/backoff. Debe respetar la
   lista blanca de datos (ya garantizada en origen).
4. **Disparador**: cron/worker en segundo plano (ver también
   `docs/CAMPAIGNS.md` para el mismo tema de procesamiento en segundo plano).
5. **Seguridad**: nunca enviar contenido de mensajes ni datos sensibles (la lista
   blanca ya lo impide); documentar en el consentimiento del cliente si aplica.

Mientras esas piezas no existan, el sistema funciona con el adaptador local y no
realiza ninguna llamada externa.

## API pública (no incluida)

No se construyó una API pública para terceros (lectura/escritura con tokens). Si
en el futuro se necesita, debe ir con autenticación por token, límites por
cliente (se puede reutilizar `rate_limit_hit`), versionado y documentación. Es un
módulo aparte y se evaluará cuando haya una necesidad concreta.
