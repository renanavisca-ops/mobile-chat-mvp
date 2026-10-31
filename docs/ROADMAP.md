# Toky Chat — Plan de trabajo (checklist vivo)

Basado en la especificación funcional completa (`Funciones.md`). Este documento
es la **lista de trabajo que vamos marcando** conforme avanzamos. Cada etapa
agrupa funciones por valor y riesgo; se trabajan de arriba hacia abajo.

**Leyenda:** `- [x]` hecho · `- [~]` parcial · `- [ ]` pendiente
🔒 necesita decisión/infra externa (costo, proveedor, regulación)
📱 incluye parte **nativa** (entra en el próximo build de Codemagic)

**Cómo trabajamos:** una rama por función → PR → merge a `main` (se despliega
a web/Android/iOS, que comparten el WebView remoto). Lo nativo requiere nuevo
`.aab`/`.ipa`. Al cerrar cada punto se marca aquí en el mismo PR.

---

## Estado actual (ya implementado)

- [x] Login con correo (Gmail) + onboarding, recuperación de contraseña, eliminar cuenta
- [x] Verificación en dos pasos (PIN/MFA) + código de recuperación
- [x] Gestión de dispositivo activo · cerrar sesión por dispositivo y en todos
- [x] Perfil: nombre, foto (con editor: recorte/zoom/rotar), descripción, estado
- [x] Privacidad: quién ve última conexión/en línea/foto · confirmaciones de lectura on/off
- [x] Bloquear / desbloquear / reportar usuarios
- [x] Contactos: agregar, buscar usuarios, iniciar chat
- [x] Chats 1:1: texto en tiempo real, enviado/entregado/leído, escribiendo/borrando/grabando
- [x] Responder, reenviar, copiar, editar, eliminar, reacciones con emoji
- [x] Mensajes destacados/guardados y fijados · selección múltiple
- [x] Búsqueda dentro del chat y búsqueda global (con resaltado) · borradores
- [x] Mensajes temporales (disappearing) · vista previa de enlaces (clicables)
- [x] Traducción de mensajes (IA)
- [x] Archivar, silenciar (con duración), fijar, "Notas personales" (self-chat)
- [x] Exportar conversación
- [x] Multimedia: fotos/videos (cámara y galería), varios archivos, compresión
- [x] Notas de voz con velocidad variable · documentos/PDF/Excel/Word con visor e impresión nativa 📱
- [x] Descargar a galería/archivos · stickers (con editor: fondo, contorno, texto), GIF (Giphy), emojis
- [x] Encuestas · mensajes programados
- [x] Grupos: crear con nombre/foto/descripción, agregar/quitar miembros, salir, reportar, silenciar, archivar
- [x] Grupos: "leído" solo cuando todos leyeron + "Visto por" (quién lo vio)
- [x] Llamadas de voz y video 1:1 y grupales · registro de llamada en el chat
- [x] Notificaciones de llamada, aceptar/rechazar, mic/cámara on-off, cambiar cámara 📱
- [x] Altavoz/auricular 📱 · compartir pantalla 📱 (Android) · TURN/STUN configurado
- [x] Historias (stories): foto/texto, ver, componer
- [x] Canal de novedades (announcement) · difusión (broadcast)
- [x] Cifrado de medios por objeto (AES-GCM) en almacenamiento · número de seguridad (fingerprint)
- [x] Push (FCM) · silenciar chats · temas claro/oscuro · fondos de chat
- [x] Tamaño de letra, alto contraste, modo simple, idioma (es/en), respeta "reducir movimiento"
- [x] Web + Android + (iOS en preparación) sobre el mismo origen/estado
- [x] Chats de soporte públicos (tienda/cliente) con staff
- [x] Gesto "atrás" de Android cierra overlays 📱-friendly · efectos festivos con ajuste

---

## Etapa 1 — Cerrar vacíos del núcleo (chats y grupos)

Alto valor, bajo riesgo, sin dependencias externas.

- [x] **Menciones** `@usuario` en grupos (autocompletar, resaltar, notificar al mencionado incluso en silencio)
- [x] **Roles de grupo**: creador / administrador / miembro; asignar y revocar admins
- [x] **Permisos de grupo**: quién puede editar datos, enviar mensajes, agregar miembros
- [x] **Invitación a grupo por enlace/QR** con revocación (aprobación de ingreso: pendiente, v2)
- [x] **Historial de grupo**: mensajes de sistema para creación, altas, bajas, salidas, uniones por enlace y cambios de admin
- [x] **Pantalla de guardados/destacados**: lista central de mensajes destacados (Ajustes → Mensajes destacados)
- [x] **Compartir ficha de contacto** dentro del chat (enviar un contacto como mensaje, tocar para ver/añadir)
- [x] **Compartir ubicación puntual** (GPS → tarjeta que abre Google Maps) · en tiempo real: pendiente 🔒 (API de mapas)
- [x] **Filtros de chats** (Todos / No leídos / Grupos) · listas personalizadas y favoritos: v2
- [x] **Chats favoritos** (marcar/desmarcar + filtro "Favoritos" + estrella en la lista)

## Etapa 2 — Multimedia y contenido

- [x] **Editor de imágenes** antes de enviar: recortar, dibujar, texto/anotaciones, rotar, voltear y filtros
- [x] **Mensajes de visualización única** ("ver una vez") para foto/video: el destinatario abre una sola vez, se bloquea tras verlo, el emisor ve si fue abierto; no se puede reenviar/compartir/descargar
- [x] **Calidad de envío**: Estándar (comprimido) / Alta / Original (toggle por envío, recordado; se aplica al enviar)
- [x] **Pausar/reanudar** grabación de voz (botón en la barra de grabación) + escucha previa antes de enviar (ya existía el preview)
- [x] **Descarga automática** configurable por red (Wi-Fi/datos) y tipo (fotos/voz/video): lo desactivado se descarga al tocar · Ajustes → Datos y almacenamiento
- [x] **Gestión de almacenamiento**: uso de caché por chat, archivos más grandes y liberar espacio (Ajustes → Datos y almacenamiento → Almacenamiento). Solo caché local; el objeto compartido en el servidor no se toca.
- [x] **Eventos/recordatorios**: tarjeta de evento en el chat + RSVP (Voy/Tal vez/No) + "Agregar al calendario" (.ics/Google) para el recordatorio. Push programado en servidor: pendiente 🔒 (requiere scheduler)
- [x] **Paquetes de stickers** y favoritos; importar/organizar: pestañas Favoritos/Todos/paquetes, ★ favoritos, importar imagen como sticker, mover a paquete (organización local por dispositivo)

## Etapa 3 — Privacidad y seguridad

- [ ] **Decisión E2EE**: hoy el cifrado de mensajes no está activo (solo medios). Definir alcance real y activarlo de forma verificable, o declarar claramente qué está cifrado 🔒 _(diferido por decisión del usuario — 2026-10)_
- [x] **Avisos de cambio de clave/dispositivo** de contactos: aviso en el chat 1:1 cuando cambia el número de seguridad del contacto (con "Ver número" y "Entendido"); limpia el estado "verificado"
- [~] **Bloqueo de la app** con código (PIN) + autobloqueo configurable (Ajustes → Seguridad). Biometría nativa: pendiente 📱 (requiere plugin)
- [x] **Bloqueo de chats sensibles** individual con el PIN: bloquear/desbloquear desde el menú del chat, pide PIN al abrir y enmascara la vista previa en la lista (reusa el PIN del bloqueo de app)
- [ ] **Copias de seguridad cifradas** opcionales y restauración con clave 🔒 _(diferido por decisión del usuario — 2026-10; retomar: ya existe base `key_backups`/`hasServerBackup`)_
- [x] **Restricciones**: quién puede agregarme a grupos (Todos/Mis contactos/Nadie, con trigger en el servidor) y llamadas 1:1 de desconocidos (Todos/Mis contactos, auto-rechazo en el receptor) · Ajustes → Privacidad
- [x] **Protección frente a enlaces peligrosos** (aviso + confirmación antes de abrir enlaces con credenciales embebidas, punycode o IP) y reporte de spam (reporte por mensaje/usuario con motivo "spam", ya disponible)
- [x] **Permisos granulares** (cámara, micrófono, ubicación, notificaciones) revisables y solicitables en Ajustes → Permisos; contactos y archivos se piden al usar (Permissions API; iOS muestra "se pide al usar")
- [x] **Protección de capturas** (Android, FLAG_SECURE vía plugin nativo `ScreenSecurity`) con toggle en Ajustes → Seguridad 📱 · iOS no permite bloquear capturas (limitación del SO); toma efecto en el próximo build nativo

## Etapa 4 — Multidispositivo y sincronización

- [ ] **Vincular dispositivos** adicionales por QR (sesión web/escritorio como dispositivo enlazado) 🔒 _(diferido — depende de la arquitectura multidispositivo/E2EE, aún no decidida)_
- [x] **Revocar dispositivos** perdidos y administrar sesiones: lista de dispositivos de la cuenta (con etiqueta por plataforma y fecha), "este dispositivo" y revocar los demás · Ajustes → Dispositivo (además de "Cerrar sesión en todos")
- [x] **Cola de envío offline** y reintentos idempotentes: los envíos (texto y payloads con medios ya subidos) se encolan sin conexión y se reintentan al reconectar; `client_id` único por remitente evita duplicados aunque un reintento ya hubiera llegado
- [x] **Resolución de conflictos** y reconciliación al reconectar: al volver la conexión/foco se reconcilia la página viva — se reflejan ediciones, se eliminan mensajes borrados/expirados detectados ausentes y se conservan los ecos locales pendientes e historial anterior (con pruebas)
- [ ] **Cliente de escritorio** (empaquetar la web como app de escritorio) 🔒 _(diferido por decisión del usuario — 2026-10; requiere Electron/Tauri y build fuera de este entorno)_

## Etapa 5 — Canales, difusión y comunidades

- [x] **Canales públicos** más allá de novedades: crear, seguir y **dejar de seguir** (nuevo) · Canales privados (invitación): pendiente v2
- [x] **Descubrir/buscar canales**; directorio y categorías: búsqueda (ya existía) + filtro por categoría, selección de categoría al crear y etiqueta en cada canal
- [x] **Publicar** en canal: texto, imagen, video, enlace, audio, encuesta (el dueño usa el compositor completo; los enlaces generan vista previa)
- [x] **Reacciones y métricas** agregadas por publicación: reacciones (ya existían, por membresía) + métrica de alcance por post para el dueño (👁 vistas distintas vía `mark_channel_seen` + total de reacciones)
- [x] **Roles y notificaciones** por canal: el dueño puede nombrar co-administradores que también publican (RLS: canal permite dueño o admin) desde el panel de info del canal; notificaciones por canal (silenciar/activar) en ese mismo panel
- [x] **Listas de difusión** con consentimiento y reglas de entrega: cada destinatario puede desactivar "Recibir listas de difusión" (Ajustes → Privacidad); el envío solo llega a quienes lo aceptan (+ bloqueados ya excluidos por RLS) y muestra resumen de omitidos
- [x] **Comunidades** (MVP): agrupar varios grupos bajo una comunidad con administración central (crear, vincular grupos que administras, quitar, eliminar) · Ajustes/menú → Comunidades. Anuncios por comunidad y permisos finos: v2

## Etapa 6 — Llamadas (mejoras)

- [x] **Selección de salida Bluetooth/auriculares** 📱: selector de salida de audio en la llamada (auricular/altavoz/cable/Bluetooth) vía AudioRoute nativo (Android; toma efecto en el próximo build)
- [x] **Enlaces de invitación a llamada** y acceso controlado: botón "Copiar enlace" en la llamada genera `/call?c=…`; abrirlo une a la persona al `callId` (acceso controlado: solo miembros del chat de la llamada)
- [x] **Agregar participantes** a una llamada en curso: botón "Agregar participante" en la llamada que invita a un contacto al `callId` actual; el mesh por presencia conecta al que se une (1:1 pasa a grupal)
- [x] **Silenciar llamadas de desconocidos**: ya cubierto por la política de llamadas "Mis contactos" (Etapa 3) — auto-rechaza llamadas 1:1 de no-contactos
- [x] **Adaptación a conexión inestable**: tope de bitrate de video + degradación balanceada, y reconexión por ICE restart (recupera al desconectarse en vez de cortar; un reintento antes de rendirse)
- [x] **Continuidad en segundo plano** afinada por SO/permisos 📱: el servicio en primer plano de la llamada declara el tipo `camera` además de `microphone` cuando la llamada es de video (requisito de Android 14+ para seguir usando la cámara con la pantalla apagada); `startCallAudio` recibe el flag `video` desde el provider (iniciar/aceptar/unirse por enlace)

## Etapa 7 — Herramientas empresariales

- [x] **Perfil comercial**: categoría, descripción, dirección, horario, sitio web y teléfono sobre la tienda (`stores`). Editor en Ajustes solo para administradores de la tienda (`private.is_store_admin` + policy `stores_update_admin`); el cliente ve el perfil en una tarjeta plegable dentro del chat de soporte público.
- [x] **Catálogo** de productos/servicios (imágenes, precios, descripción): tabla `store_products` + bucket público `catalog`; gestor en Ajustes para admins de la tienda (agregar/editar/ocultar/eliminar con foto) y vitrina plegable para el cliente en el chat de soporte. Requiere aplicar `202610310002_store_catalog.sql`.
- [x] **Mensajes de bienvenida/ausencia** y **respuestas rápidas**: bienvenida automática al primer mensaje del cliente y mensaje de ausencia (toggle) desde Ajustes del admin; respuestas rápidas (canned) que el staff inserta desde el compositor en chats de tienda. Tabla `store_quick_replies` + columnas `welcome_message/away_message/away_active` en `stores`.
- [x] **Etiquetas** para clientes y conversaciones: definiciones por tienda con color (gestor en Ajustes para admins) y aplicación/quita de etiquetas sobre cada conversación de tienda desde la consola de soporte (chips + selector). Tablas `store_labels` + `chat_labels` con RLS (admin define; el staff etiqueta).
- [x] **Multiagente**: asignación de conversaciones y roles (amplía el staff actual). "Tomar" asigna el chat a quien lo toma; selector de asignado (reasignar a otro miembro) y estado sin-asignar en la consola de soporte; gestor "Equipo y roles" en Ajustes para admins (cambia agente↔admin vía RPC `set_store_member_role`). El agente puede tomar chats sin asignar de su tienda.
- [x] **Mensajes interactivos**: botones, listas y plantillas. El admin define plantillas (texto + opciones) en Ajustes; el staff las envía con un toque desde el compositor en chats de tienda; el cliente ve las opciones como botones tocables en el chat de soporte y al tocar una responde con esa opción. Tabla `store_message_templates`; payload `options[]` en el mensaje.
- [x] **Estadísticas** de entrega/lectura/atención: panel en Ajustes (solo admins) con conversaciones por estado (abiertas/en curso/cerradas), clientes, mensajes sin leer, volumen de mensajes a 7 días (total/cliente/equipo) y desglose por agente (activas/cerradas). RPC `store_support_stats` autorizada a admins.
- [ ] **Automatizaciones / API / CRM** 🔒 _(diferido: requiere proveedor/infra externa y decisiones de costo)_
- [ ] **Campañas** con consentimiento, límites y baja 🔒 _(diferido: requiere infra de envío masivo, consentimiento/baja y cumplimiento)_

## Etapa 8 — Accesibilidad, i18n, calidad e infraestructura

- [x] **Lectores de pantalla** y navegación accesible (auditoría + correcciones): auditoría — `lang` del documento ya se actualiza con el idioma, imágenes con `alt` OK, botones de ícono mayormente con `aria-label`. Correcciones: región viva (`role="status" aria-live`) para avisos/errores del chat (cubre todos los toasts), y semántica de diálogo (`role="dialog"`/`aria-modal`/`aria-label`) en modales clave (acciones de mensaje, info de grupo, reenviar, reportar, "visto por"). _Pendiente follow-up: extender `role=dialog` + trampa de foco al resto de modales._
- [~] **Más idiomas** y formatos regionales/husos horarios: formateo central locale-aware (`src/lib/i18n/format.ts` + hook `useFormatters`) para fechas/horas/números y tiempo relativo, respetando el huso horario del dispositivo; base lista para sumar idiomas (registro `DICTS`/`LOCALE_BY_LANG` documentado). Tests de formato. _Pendiente: traducir un 3er idioma completo (diferido a decisión)._
- [x] **Estados claros** de conexión/envío/error/reintento en toda la app: banner global de conexión (sin conexión / reconectado) con contador de mensajes en espera, como región viva accesible; se suma a lo ya existente (enviado/entregado/leído por mensaje y cola offline que reenvía al reconectar).
- [~] **Observabilidad**: métricas, trazas y alertas (sin contenido sensible): las 9 rutas API del servidor ahora reportan sus excepciones a Sentry vía `reportServerError` (no-op si no hay DSN; solo el error + nombre de ruta, sin contenido sensible). Sentry ya daba trazas/errores de cliente. _Pendiente (requiere decisión/costo): aprovisionar el DSN de producción y un servicio de métricas/alertas._
- [~] **Panel administrativo** y auditoría de acciones: **auditoría** implementada — tabla `audit_log` (lectura solo admins vía RLS; escritura por funciones SECURITY DEFINER/rol de servicio) que registra cambios de rol y asignación/estado de conversaciones; visor "Registro de actividad" en Ajustes (lazy, solo admins). _Pendiente (alcance grande): consola de administración completa._
- [~] **Rate limiting** y anti-spam reforzados: limitador por ventana fija en BD (`rate_limits` + RPC `rate_limit_hit`, solo rol de servicio) aplicado al POST del endpoint público de soporte (20 msg/min por token, *fail-open*). _Pendiente: extender a más endpoints (p. ej. por IP) y a flujos autenticados sensibles._
- [~] **Pruebas** de carga, seguridad, accesibilidad y compatibilidad: ampliada la cobertura de pruebas unitarias de lógica crítica (seguridad de enlaces `assessLink`, política de contraseñas `validatePassword`/`passwordStrength`, formatos i18n) + revisión de seguridad del código de la sesión (hallazgo crítico corregido en #187). _Pendiente: pruebas de carga y compatibilidad de dispositivos (requieren infra)._
- [~] **Optimización** de batería, memoria y tiempos de carga: code-splitting de las 7 secciones de administración de tienda en Ajustes (lazy `next/dynamic`), que solo descarga el admin — `/settings` baja de 26.9 kB/235 kB a 22.2 kB/229 kB de First Load. _Pendiente: perfilado de batería/memoria y más lazy-loading de editores pesados del chat._

## Etapa 9 — Pagos (condicional) 🔒

Depende de proveedor regulado por país; se activa por configuración.

- [ ] Transferencias entre personas / pagos a comercios / solicitudes de pago
- [ ] Historial y comprobantes · verificación de identidad y antifraude
- [ ] Integración con proveedores autorizados según país

---

## Decisiones / dependencias externas pendientes

- **Registro por teléfono (SMS)**: la spec pide número + SMS; Toky usa correo. Cambiarlo implica proveedor de SMS (costo). Decidir si se mantiene correo o se agrega teléfono.
- **E2EE real de mensajes**: hoy inactivo. Es la decisión de seguridad más importante.
- **Ubicación/mapas, pagos, SMS, push avanzado**: requieren servicios de terceros (costo/privacidad).
- **Recorte de fondos con IA** para stickers (fotos complejas): servicio externo.

## Próximo paso sugerido

Empezar por la **Etapa 1** (menciones → roles/permisos de grupo → invitación por enlace → pantalla de guardados). Son de alto uso diario, sin costo externo, y cada una es un PR independiente.
