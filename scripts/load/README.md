# Pruebas de carga (preparadas, NO ejecutadas)

Harness reproducible de carga con [k6](https://k6.io). Está **preparado pero no
se ejecuta** en este entorno: correrlo es un paso **manual y deliberado**, contra
un despliegue de **staging** que controles, **nunca producción**, y requiere el
binario de k6 (no viene incluido, no genera costo instalarlo).

## Por qué no se corrió aquí
- No hay staging ni datos de prueba sembrados en este entorno.
- Correr carga contra producción degradaría el servicio real y podría generar
  consumo facturable (Vercel/Supabase). La directiva lo prohíbe explícitamente.

## Cómo ejecutarlo (en staging)
```bash
# Instala k6 (una vez): https://k6.io/docs/get-started/installation/
BASE_URL=https://TU-STAGING.vercel.app k6 run scripts/load/k6-smoke.js

# Parámetros (env):
#   VUS=50 DURATION=2m PATH_=/login   # usuarios concurrentes, duración, ruta
```

El run **falla** si se superan los umbrales (`http_req_failed < 1%`,
`p95 < 800ms`), de modo que sirve como verificación pasa/falla reproducible.

## Alcance y límites honestos
- El escenario por defecto es **sin autenticar** y pega a una ruta benigna (el
  shell de la app). Mide capacidad de servir páginas/CDN, no la ruta de BD.
- Un escenario **autenticado y realista** (login → enviar mensaje → crear pedido)
  está **esbozado** en `k6-smoke.js` (`authedFlow`) y hay que completarlo con una
  **cuenta de prueba de staging** y datos desechables. No se incluye ejecutado
  porque no inventamos credenciales ni tocamos datos reales.
- Las pruebas de **compatibilidad de dispositivos** (Android/iOS por versión/
  modelo) requieren dispositivos o un servicio de device farm; quedan fuera de
  este harness y se identifican como pendientes de infra real.

## Qué medir cuando se corra
- Latencia p95/p99 por ruta, tasa de error, throughput sostenido.
- Comportamiento del rate limiting durable (`rate_limit_hit`) bajo ráfaga.
- Saturación de conexiones de Supabase (pool) en rutas que leen/escriben BD.
