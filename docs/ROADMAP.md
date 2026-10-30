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
- [ ] **Eventos/recordatorios**: crear, invitar y recordar dentro del chat 🔒
- [ ] **Paquetes de stickers** y favoritos; importar/organizar

## Etapa 3 — Privacidad y seguridad

- [ ] **Decisión E2EE**: hoy el cifrado de mensajes no está activo (solo medios). Definir alcance real y activarlo de forma verificable, o declarar claramente qué está cifrado 🔒
- [ ] **Avisos de cambio de clave/dispositivo** de contactos
- [ ] **Bloqueo de la app** con biometría/código 📱
- [ ] **Bloqueo de chats sensibles** individual (biometría/código)
- [ ] **Copias de seguridad cifradas** opcionales y restauración con clave 🔒
- [ ] **Restricciones**: quién puede agregarme a grupos / llamadas de desconocidos
- [ ] **Protección frente a enlaces peligrosos** (avisos) y reporte de spam
- [ ] **Permisos granulares** (cámara, micrófono, contactos, ubicación, archivos) revisables en Ajustes
- [ ] **Protección de capturas** donde sea técnicamente posible 📱 (sin garantizar)

## Etapa 4 — Multidispositivo y sincronización

- [ ] **Vincular dispositivos** adicionales por QR (sesión web/escritorio como dispositivo enlazado) 🔒
- [ ] **Revocar dispositivos** perdidos y administrar sesiones (ampliar lo actual)
- [ ] **Cola de envío offline** y reintentos idempotentes
- [ ] **Resolución de conflictos** y reconciliación al reconectar
- [ ] **Cliente de escritorio** (empaquetar la web como app de escritorio) 🔒

## Etapa 5 — Canales, difusión y comunidades

- [ ] **Canales públicos/privados** más allá de novedades: crear, seguir, dejar de seguir
- [ ] **Descubrir/buscar canales**; directorio y categorías
- [ ] **Publicar** en canal: texto, imagen, video, enlace, audio, encuesta
- [ ] **Reacciones y métricas** agregadas por publicación
- [ ] **Roles y notificaciones** por canal
- [ ] **Listas de difusión** con consentimiento y reglas de entrega (ampliar broadcast)
- [ ] **Comunidades**: agrupar varios grupos con anuncios y administración central

## Etapa 6 — Llamadas (mejoras)

- [ ] **Selección de salida Bluetooth/auriculares** (hoy altavoz/auricular) 📱
- [ ] **Enlaces de invitación a llamada** y acceso controlado
- [ ] **Agregar participantes** a una llamada en curso
- [ ] **Silenciar llamadas de desconocidos**
- [ ] **Adaptación a conexión inestable** (reducción de datos, reconexión robusta)
- [ ] **Continuidad en segundo plano** afinada por SO/permisos 📱

## Etapa 7 — Herramientas empresariales

- [ ] **Perfil comercial**: categoría, dirección, horario, sitio web
- [ ] **Catálogo** de productos/servicios (imágenes, precios, descripción)
- [ ] **Mensajes de bienvenida/ausencia** y **respuestas rápidas**
- [ ] **Etiquetas** para clientes y conversaciones
- [ ] **Multiagente**: asignación de conversaciones y roles (ampliar staff actual)
- [ ] **Mensajes interactivos**: botones, listas y plantillas
- [ ] **Estadísticas** de entrega/lectura/atención
- [ ] **Automatizaciones / API / CRM** 🔒
- [ ] **Campañas** con consentimiento, límites y baja 🔒

## Etapa 8 — Accesibilidad, i18n, calidad e infraestructura

- [ ] **Lectores de pantalla** y navegación accesible (auditoría + correcciones)
- [ ] **Más idiomas** y formatos regionales/husos horarios
- [ ] **Estados claros** de conexión/envío/error/reintento en toda la app
- [ ] **Observabilidad**: métricas, trazas y alertas (sin contenido sensible) 🔒
- [ ] **Panel administrativo** y auditoría de acciones 🔒
- [ ] **Rate limiting** y anti-spam reforzados 🔒
- [ ] **Pruebas** de carga, seguridad, accesibilidad y compatibilidad
- [ ] **Optimización** de batería, memoria y tiempos de carga

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
