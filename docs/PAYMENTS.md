# Pagos (estructura mínima, DESACTIVADA)

Solo existen los **contratos de integración** y la **configuración mínima** para
un proveedor futuro. **No se procesa dinero, no se recopilan datos bancarios ni
documentos de identidad, y no hay una función de pagos operativa en la UI.**

> Estado: **desactivado hasta elegir proveedor.** Todas las rutas responden
> `501` hasta que exista una integración real.

## Qué hay hoy (estructura)

- **Tabla `public.payments`** (ya existente) con RLS: `payments_select_participant`
  (solo participantes ven sus pagos) y `payments_insert_own_pending`. Columnas:
  `sender_id`, `recipient_id`, `chat_id`, `amount_cents`, `currency`, `status`,
  `provider`, `provider_ref`, `created_at`.
- **Contrato cliente** (`src/lib/payments/index.ts`): tipos + `startCheckout()`
  que llama a la ruta y devuelve `{ configured: false }` mientras no haya
  proveedor. **No hay UI que lo invoque** (no se muestra función de pagos).
- **Rutas (scaffold, 501):**
  - `POST /api/payments/checkout` — crearía el intento de pago e insertaría la
    fila `payments` (status `pending`). Hoy devuelve `501`.
  - `POST /api/payments/webhook` — verificaría la firma del proveedor y marcaría
    la fila `succeeded`/`failed`. Hoy devuelve `501`.
- **Gate de configuración** (`src/lib/payments/config.ts`): `paymentsEnabled()` y
  `paymentsProvider()` leen variables de entorno. Por defecto **desactivado**.

## Variables de entorno (activación futura; sin credenciales inventadas)

Todas del lado servidor (nunca `NEXT_PUBLIC_`):

- `PAYMENTS_ENABLED` — `1` para habilitar el gate (por defecto apagado).
- `PAYMENTS_PROVIDER` — nombre del proveedor elegido (p. ej. `stripe`).
- El **secreto propio del proveedor** (p. ej. `STRIPE_SECRET_KEY`).
- `PAYMENTS_WEBHOOK_SECRET` — secreto para verificar la firma de los webhooks.

**Nota:** aunque se pongan `PAYMENTS_ENABLED=1` y `PAYMENTS_PROVIDER`, las rutas
devuelven `provider_not_implemented` (501) hasta que se escriba la integración
real. Esto es deliberado: el interruptor no "inventa" un procesador.

## Qué falta para operar (pendiente, requiere decisión y cumplimiento)

1. **Elegir proveedor regulado por país** (comisiones, KYC/antifraude, licencias).
2. Implementar `checkout` (crear PaymentIntent/sesión + fila `pending`) y
   `webhook` (verificar firma + actualizar estado) con el SDK del proveedor.
3. Construir la **UI** (p. ej. "Enviar dinero" en el menú de adjuntar) que use
   `startCheckout()` y maneje el client secret / URL de redirección.
4. **Cumplimiento**: verificación de identidad, comprobantes, historial,
   antifraude, y requisitos legales por país.

## Simulaciones

No hay simulación activa. Si en desarrollo se necesitara una, debe quedar
**claramente identificada** y **limitada al entorno de desarrollo** (nunca en
producción, nunca con dinero real), y no mostrarse como una función operativa.
