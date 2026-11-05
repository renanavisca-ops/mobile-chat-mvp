# Verificación de teléfono (§1)

El teléfono es un **atributo opcional** de la cuenta existente (la que inicia
sesión por correo). **No** crea una segunda cuenta ni reemplaza el login por
correo: solo agrega `profiles.phone` + `profiles.phone_verified` tras verificar
un código. Un teléfono verificado pertenece a una sola cuenta (índice único).

## Estado

- **Desactivado por defecto.** Las rutas `/api/phone/request` y
  `/api/phone/verify` devuelven `501 not_configured` salvo que se configure.
- **Simulador local (dev/test):**

  ```
  PHONE_VERIFICATION_ENABLED=1
  PHONE_PROVIDER=simulator
  ```

  Con eso, `request` genera un código de 6 dígitos, lo guarda **hasheado**
  (`phone_verifications`, TTL 10 min, máx. 5 intentos, límite por usuario) y lo
  **devuelve en la respuesta** (`simulatedCode`) para completar el flujo **sin
  enviar SMS**. `verify` comprueba el código y fija `phone`/`phone_verified`.
  La UI está en Ajustes → "Número de teléfono".

## Qué falta para el proveedor SMS REAL (pendiente — tiene costo)

- Un adaptador de envío por `PHONE_PROVIDER=<proveedor>` (Twilio, etc.) con su
  **SDK y credenciales de servidor** (nunca `NEXT_PUBLIC`), que envíe el código
  por SMS en lugar de devolverlo. Hoy cualquier proveedor distinto de
  `simulator` responde `adapter_not_implemented` (501) — **no se finge el envío**.
- Cumplimiento del canal SMS por país.

El simulador **no** demuestra que el envío real por SMS funcione. El login por
correo y las cuentas existentes **no cambian** por esta función.
