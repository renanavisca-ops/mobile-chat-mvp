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

## Simulador local (dev/test)

Para poder recorrer el flujo completo **sin un proveedor real y sin dinero**,
hay un simulador que se activa **solo** con:

```
PAYMENTS_ENABLED=1
PAYMENTS_PROVIDER=simulator
```

Con eso:
- `POST /api/payments/checkout` (provider `simulator`) crea una fila `payments`
  en estado `pending`, marcada `provider='simulator'`, y devuelve `paymentId` +
  `confirmPath`. **No hace ninguna llamada externa.**
- `POST /api/payments/sim` `{ paymentId, outcome?: 'succeed'|'fail' }` imita el
  **webhook asíncrono** del proveedor y pasa el pago a `succeeded`/`failed`. Sin
  `outcome` el resultado es determinista (`simulateOutcome`: montos cuyos
  centavos son `13` fallan, el resto tiene éxito), lo que permite probar el
  **camino de fallo**. Un pago `failed` puede reintentarse (`failed → succeeded`);
  un pago `succeeded` ya no se puede mutar (`canTransition`).
- El cliente `simulateConfirm(paymentId, outcome?)` (`src/lib/payments/index.ts`)
  llama a esa ruta. Lógica pura en `src/lib/payments/simulator.ts` con pruebas
  (`tests/payments-simulator.test.ts`).

**Importante:** el simulador está **desactivado por defecto** (en producción
`PAYMENTS_ENABLED` no está puesto → las rutas devuelven 501), toda fila simulada
queda marcada `provider='simulator'`, y **un simulador NO demuestra que la
integración real funcione**.

## Qué falta para el proveedor REAL (sigue pendiente)

El simulador no es el adaptador real. Para operar con dinero de verdad falta,
además de la decisión/compliance de arriba:
- el **SDK y la clave secreta** del proveedor elegido (variable de servidor,
  nunca `NEXT_PUBLIC`);
- crear el PaymentIntent/sesión real en `checkout` (rama por `PAYMENTS_PROVIDER`)
  e insertar la fila `pending`;
- **verificar la firma** del webhook real del proveedor en una ruta propia
  (distinta de `/api/payments/sim`) antes de actualizar el estado;
- la UI de cobro/pago y los comprobantes para el usuario final.
No basta con "poner una clave": ese código del adaptador real aún no existe.
