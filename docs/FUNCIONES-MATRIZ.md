# Toky Chat — Matriz de seguimiento de `Funciones.md` (17 secciones)

Documento vivo. Verifica cada requisito contra el código real; se actualiza al
cerrar cada etapa. Es el **ancla de continuidad** del trabajo de completar Toky.

**Estados (verificados contra código, no contra informes previos):**

| Marca | Significado |
|-------|-------------|
| ✅ | Implementado y verificado por pruebas automáticas / revisión en este entorno |
| 🧪 | Implementado + probado con **simulador local** (falta validar con proveedor/dispositivo real) |
| 🏗️ | Estructura/adaptador listo pero **desactivado**; se activa por configuración |
| 🧩 | Parcial — funciona en parte; se indica qué falta |
| 📱 | Código listo; requiere **build nativo (Codemagic)** para verificarse |
| 🔒 | Requiere decisión del usuario, proveedor, credencial o requisito legal |
| ❌ | No implementado |

**Distinción de madurez exigida por §17:** _construido_ ≠ _probado localmente_ ≠
_probado con simulador_ ≠ _probado con proveedor real_ ≠ _validado en dispositivo_.

> Regla de alcance: no se contrata nada ni se genera gasto. Donde haga falta un
> proveedor, se construye la lógica propia + un **simulador local** que recorre el
> flujo completo (éxito, fallo, reintento, asíncrono), con el adaptador real
> **desactivado por defecto** y documentado qué falta para activarlo.

Guías de activación: `docs/INTEGRATIONS.md`, `docs/CAMPAIGNS.md`, `docs/PAYMENTS.md`.

---

## Leyenda de columnas
**Requisito · Estado · Implementado en (archivos) · Pendiente real · Evidencia/aceptación · Dependencia para activar**

---

## 1. Identidad, registro y cuenta
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Registro/login por correo | ✅ | `src/app/login`, `auth/*` | — | Flujo en uso | — |
| Registro/login por teléfono + SMS | 🔒→🧪 (objetivo) | _por construir_ | Adaptador SMS + UI, compatible con cuentas de correo | — | Proveedor SMS |
| Perfil (nombre/foto/descr./disponibilidad) | ✅ | `src/app/settings` | — | — | — |
| Edición de perfil + privacidad | ✅ | `settings`, `privacy` | — | — | — |
| Cambio de número/correo conservando info | ❌ | — | Flujo de cambio de identidad | — | Ligado a teléfono |
| Gestión de dispositivos + cierre remoto | ✅ | `src/lib/db/devices.ts` | — | — | — |
| Alertas de acceso (login nuevo) | ❌ | — | Registrar sesión + aviso | — | — |
| Eliminación de cuenta | ✅ | `src/app/delete-account` | — | — | — |
| 2FA (PIN) + recuperación | ✅ | app-lock, recovery codes | — | — | — |
| Biometría / bloqueo local | 🧩/📱 | `src/lib/chat-lock`, app-lock-gate | Biometría nativa | — | Build nativo |
| Bloqueo/reporte de contactos | ✅ | `src/lib/db/safety.ts` | — | tests | — |

## 2. Contactos y descubrimiento
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Sincronización de agenda con consentimiento | ❌/📱 | — | Plugin contactos + consentimiento + fallback web | — | Build nativo |
| Detección de registrados + invitar | 🧩 | invite links | Detección desde agenda | — | Ligado a agenda |
| Búsqueda por nombre/identificador | ✅ | `src/lib/db/contacts.ts` | — | — | — |
| Agregar/editar/eliminar/bloquear | ✅ | contacts.ts | — | — | — |
| Compartir fichas de contacto | ✅ | chat-conversation | — | — | — |
| Frecuentes + favoritos | ✅ | chats list | — | — | — |
| **QR personal de contacto** | ✅ | `src/app/add`, contacts.ts (#204) | — | export 29/29 | — |

## 3. Conversaciones individuales
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Texto RT, env/entreg/leído, escribiendo | ✅ | chat-conversation, realtime | — | — | — |
| Fecha/hora, separación por día, no leídos | ✅ | — | — | — | — |
| Responder/reenviar/copiar/editar/eliminar | ✅ | — | — | — | — |
| Reacciones / menciones | ✅ | — | — | — | — |
| Destacados/fijados/guardados | ✅ | `src/app/saved` | — | — | — |
| Búsqueda en chat + global por texto | ✅ | chats page, searchAllMessages | — | — | — |
| **Búsqueda por fecha / tipo de archivo** | ❌ | — | Filtro por tipo/fecha en búsqueda global | — | — |
| Selección múltiple / preview enlaces | ✅ | — | — | — | — |
| Temporales / vista única / borradores | ✅ | — | — | — | — |
| Traducción | ✅ | — | — | — | — |
| Transcripción de audio | ❌ | — | Motor local o adaptador + simulador | — | Motor/Proveedor |
| Archivar/silenciar/fijar/filtros por tipo | ✅ | chats page (#206) | — | — | — |
| **Listas personalizadas** | ✅ | `src/lib/chat-lists.ts` (#206) | sync entre dispositivos | tests +9 | — |
| Bloqueo individual por código / exportar | ✅ | — | biometría 📱 | — | — |

## 4. Contenido multimedia y archivos
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Fotos/videos cámara/galería, varios, captura | ✅ | attach-sheet, camera | — | — | — |
| Compresión + calidad | ✅ | — | — | — | — |
| Documentos/PDF/visor + impresión | ✅ 📱 | document-preview | — | — | — |
| Audios/voz velocidad variable, pausa, preview | ✅ | — | — | — | — |
| **Subtítulos/descripciones accesibles de medios** | ❌ | — | Descripción/alt al enviar + render | — | — |
| Guardar/descargar/reenviar/eliminar + auto-descarga + espacio | ✅ | storage-manager | — | — | — |
| Ubicación puntual | ✅ | — | — | — | — |
| **Ubicación en tiempo real** | ❌ | — | Lógica propia + simulador (sin API de mapas de pago) | — | API de mapas (opcional) |
| Enviar contactos/enlaces/eventos, stickers/GIF | ✅ | — | — | — | — |
| Recortar/dibujar/texto, encuestas | ✅ | image-editor, poll-composer | — | — | — |
| Eventos/invitaciones/recordatorios | ✅ | event-composer | push programado 🔒 | — | Worker push |

## 5. Grupos
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Crear con nombre/imagen/descr. | ✅ | groups/new | — | — | — |
| Añadir/retirar + **límites configurables** | 🧩 | group-info-modal | Límite de miembros configurable | — | — |
| Roles creador/admin/miembro + permisos | ✅ | group-roles migration | — | — | — |
| Invitación enlace/QR + revocación | ✅ | — | — | — | — |
| **Aprobación de ingreso** | ✅ | approval migration (#203) | — | migración verificada | — |
| Historial / respuestas / menciones / encuestas / fijados | ✅ | — | — | — | — |
| Llamadas grupales / silenciar / abandonar / reportar | ✅ | — | — | — | — |
| Comunidades (varios grupos + admin central) | 🧩 | communities | Anuncios por comunidad + permisos finos | — | — |

## 6. Llamadas y comunicación en vivo
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Voz/video 1:1 y grupal, desde chat, registro | ✅ | call, calls | — | — | — |
| Notif + aceptar/rechazar/silenciar, cam/mic, cámaras | ✅ | — | — | — | — |
| Altavoz/Bluetooth, compartir pantalla | ✅ 📱 | — | — | verificar en dispositivo | Build nativo |
| Enlaces de invitación + incorporar en curso | ✅ | — | — | — | — |
| Continuidad en segundo plano / datos inestables | ✅ 📱 | — | — | verificar en dispositivo | Build nativo |
| Cifrado de comunicaciones (medio) | 🧩 | WebRTC DTLS-SRTP | Capa E2EE extra (ver §9) | — | Decisión E2EE |
| Silenciar desconocidos / perdidas + reconexión | ✅ | — | — | — | — |

## 7. Publicaciones efímeras (Historias)
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Publicar con expiración (foto/texto) | ✅ | story-composer, stories.ts | — | — | — |
| **Video/audio en historia** | ❌ | — | Soporte video/audio en composer+visor | — | — |
| **Audiencia fina por historia** | 🧩 | status-privacy-modal | Selección por historia (incluir/excluir/lista) | — | — |
| Ver + responder en privado | 🧩 | story-viewer | Responder en privado | — | — |
| Reacciones + registro de vistas | 🧩 | — | Reacciones + vistas | — | — |
| **Silenciar historias de ciertas personas** | ❌ | — | Mute por autor | — | — |
| Eliminar propias | ✅ | — | — | — | — |
| Edición (texto/dibujo/emojis/fondos) | 🧩 | — | Edición avanzada | — | — |

## 8. Canales y difusión
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Crear públicos | ✅ | chats.ts createChannel | — | — | — |
| **Canales privados (invitación)** | ❌ | — | Canal privado + invitación | — | — |
| Seguir/dejar/descubrir/buscar | ✅ | channels page | — | — | — |
| Publicar texto/img/video/enlace/audio/encuesta | ✅ | — | — | — | — |
| Reacciones + métricas agregadas | ✅ | mark_channel_seen | — | — | — |
| Administración roles/permisos + notif por canal | ✅ | — | — | — | — |
| **Enlaces para compartir/invitar** | ✅ | `src/app/c` (#207) | — | export 30/30 | — |
| Listas de difusión con consentimiento | ✅ | broadcast-lists | — | — | — |
| Directorio/categorías + **recomendaciones** | 🧩 | — | Recomendaciones | — | — |

## 9. Privacidad y seguridad
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| **E2EE de conversaciones** | 🔒/🧪 (objetivo) | keystore (claves), media AES-GCM | Protocolo mensajes E2EE en entorno aislado, desactivado en prod | — | Decisión usuario |
| E2EE de medios (reposo) | ✅ | media-encryption, tests | — | tests | — |
| Identidad cripto / número de seguridad | 🧩 | safety-number-modal, keystore | Intercambio claves E2EE completo | tests fingerprint | Ligado a E2EE |
| Avisos de cambio de clave/dispositivo | ✅ | — | — | — | — |
| Cifrado archivos en tránsito/almacenamiento | ✅ | TLS + AES-GCM | — | — | — |
| **Copias de seguridad cifradas** | 🔒 | base `key_backups` | Backup/restore cifrado | — | Ligado a E2EE |
| Quién ve conexión/foto; recibos lectura on/off | ✅ | privacy | — | — | — |
| Restricciones grupos/llamadas desconocidos | ✅ | — | — | — | — |
| Bloqueo/denuncia cuentas/mensajes/grupos | ✅ | — | — | — | — |
| Detección spam/suplantación/automatizaciones | 🧩 | rate-limit, link-safety | Detección de suplantación | tests | — |
| Notif. seguridad + enlaces peligrosos; bloqueo app | ✅ | — | — | tests | — |
| Minimización de metadatos/retención | 🧩 | — | Políticas de retención/borrado | — | — |
| Permisos granulares + protección capturas | ✅ 📱 | permissions | — | — | Build nativo |

## 10. Notificaciones y personalización
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Push mensajes/menciones/reacciones/llamadas | ✅ | FCM | — | — | — |
| Previsualización en pantalla bloqueada | 🧩 | — | Depende del SO/ajuste | — | — |
| Sonidos/vibración globales o por chat | ✅ | — | — | — | — |
| Silenciar temporal/permanente | ✅ | — | — | — | — |
| Ahorro de datos / temas / fondos | ✅ | — | — | — | — |
| Tamaño de letra / idioma / accesibilidad | ✅ | — | — | — | — |
| Contadores no leídos + acceso rápido | ✅ | — | — | — | — |

## 11. Multidispositivo, web y escritorio
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Apps móvil + web | ✅ | — | — | — | — |
| **Escritorio** | 🔒 | — | Empaquetar Electron/Tauri (build fuera del entorno) | — | Build externo |
| **Vincular múltiples dispositivos (QR)** | 🔒 | — | Ligado a arquitectura E2EE/multidispositivo | — | Decisión E2EE |
| Sync conversaciones/lectura/estados | ✅ | realtime | — | — | — |
| Revocación de dispositivos + cola offline | ✅ | devices, offline queue | — | — | — |
| Resolución de conflictos al reconectar | ✅ | — | — | tests | — |
| **Migración/restauración entre dispositivos** | 🔒 | — | Ligado a backups | — | Backups |

## 12. Herramientas empresariales
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Perfil comercial + catálogo | ✅ | catalog.ts | — | — | — |
| **Enlaces/QR para iniciar chat con tienda** | 🧩 | support links | QR dedicado a soporte de tienda | — | — |
| Bienvenida/ausencia/respuestas rápidas + etiquetas | ✅ | templates | — | — | — |
| Gestión de consultas/estados | ✅ | chat status | — | — | — |
| **Pedidos / carrito desde catálogo** | ❌ | — | Carrito + pedido + estados (flujo completo) | — | — |
| Mensajes interactivos (botones/listas) | ✅ | — | — | — | — |
| Multiagente (asignación + roles) | ✅ | authz/chat-access | — | tests | — |
| Automatizaciones por palabra clave | ✅ | automations/match | — | tests | — |
| **Integraciones CRM / API** | 🏗️ | integrations/events+dispatch | Adaptador local simulador + flujo completo (desactivado) | — | Proveedor |
| **Campañas** (consentimiento/límites/baja) | 🏗️ | campaigns/* | Worker de envío + canal simulado (desactivado) | — | Proveedor canal |
| Estadísticas de entrega/lectura/atención | ✅ | store_support_stats | — | — | — |
| **Verificación de identidad empresarial** | 🔒 | — | Lógica propia + simulador + adaptador desactivado | — | Programa externo |
| **Pagos** | 🏗️ | payments/* | Simulador completo + historial (desactivado) | — | Proveedor |

## 13. Pagos y servicios adicionales
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Transferencias/pagos/solicitudes (estructura) | 🏗️ | payments/config, api/payments/webhook | Simulador de proveedor + flujo cliente completo | — | Proveedor |
| **Historial/comprobantes** | ❌ | — | Historial + comprobante (con simulador) | — | Proveedor |
| Verificación identidad/antifraude | 🔒 | — | — | — | Proveedor |
| Integración proveedores por país | 🔒 | — | — | — | Decisión país |
| **Compartir enlaces de pago/estados** | ❌ | — | Enlace de pago + estado (simulado) | — | Proveedor |

## 14. Copias, almacenamiento y migración
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Respaldo manual/programado + restauración | 🔒 | base key_backups | Backup/restore (ligado a E2EE/claves) | — | Backups cifrados |
| Incluir/excluir videos + liberar espacio | 🧩/✅ | storage-manager | — | — | — |
| **Exportación de datos personales (completa)** | 🧩 | export de conversación | Export completo de la cuenta | — | — |
| Eliminación de datos | ✅ | delete-account | — | — | — |
| Transferencia segura de historial / retención | 🔒/🧩 | — | Políticas de retención | — | — |

## 15. Accesibilidad y experiencia de usuario
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Lectores de pantalla / navegación accesible | 🧩 | a11y screenreaders | **Extender trampa de foco al resto de modales** | — | — |
| Trampa de foco (núcleo) | ✅ | `src/lib/a11y/focus-trap.ts` (#205) | — | tests +6 | — |
| Texto escalable/contraste + indicadores conexión | ✅ | — | — | — | — |
| Teclado/dictado del SO | 🧩 | — | Se apoya en SO | — | — |
| i18n/formatos regionales + errores comprensibles | ✅ | i18n/format | — | tests | — |
| Optimización batería/memoria/carga | 🧩 | code-splitting | Perfilado batería/memoria | — | Dispositivo |

## 16. Administración, infraestructura y operación
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Auth/perfiles/sesiones + transporte RT + colas idempotentes | ✅ | — | — | — | — |
| Almacenamiento cifrado adjuntos + URLs temporales + push tokens | ✅ | — | — | — | — |
| Señalización llamadas + STUN/TURN | ✅ | — | — | — | — |
| Gestión de claves/protocolos auditados | 🧩 | ENCRYPTION_EXPORT_REVIEW | E2EE mensajes | — | Decisión E2EE |
| Moderación/denuncias | ✅ | — | — | — | — |
| **Rate limiting / anti-spam** | 🧩 | ratelimit-db (#202) | Unificar limitador memoria↔durable | tests | — |
| **Observabilidad** (métricas/trazas/alertas) | 🧩 | observability.ts | DSN producción + alertas | — | Config/Proveedor |
| **Panel admin / roles internos / auditoría** | 🧩 | audit.ts, activity log | Consola de administración | — | — |
| Alta disponibilidad/backups/DR | 🔒 | Supabase/Vercel gestionados | Plan DR formal | — | — |
| Privacidad/términos/consentimiento | 🧩 | terms, privacy, guidelines | Cumplimiento por jurisdicción | — | Legal |
| **Pruebas carga/seguridad/accesibilidad/compat** | 🧩 | tests/* (87) | Scripts de carga reproducibles (sin ejecutar contra prod); compat dispositivos | tests 87 | Infra/dispositivos |
| Versionado API / despliegue gradual | 🧩 | — | — | — | — |

## 17. Criterios transversales de aceptación
| Requisito | Estado | Archivos | Pendiente | Evidencia | Dependencia |
|---|---|---|---|---|---|
| Definir plataformas/permisos/límites/offline por función | 🧩 | roadmap/docs | Tabla transversal por función | — | — |
| Entrega/lectura/eliminación distinguen local vs remoto | ✅ | — | — | — | — |
| Funciones cifradas declaran alcance real | ✅ | esta matriz + docs | — | — | — |
| Dependientes de terceros activables por configuración | ✅ | env gates | — | — | — |
| Acciones críticas con confirmación/recuperación/trazabilidad | 🧩 | audit, confirmaciones | — | — | — |
| Documentar límites sin inventar cifras | ✅ | docs | — | — | — |

---

## Plan de etapas (orden por dependencias; cada etapa = PR verificado)

1. **Matriz** (este documento). ✅
2. **§3** Búsqueda por tipo/fecha · **§15** extender trampa de foco · **§16** unificar rate limiter. _(limpiezas + búsqueda)_
3. **§4** Descripciones accesibles de medios (alt/caption al enviar).
4. **§5** Límite de miembros configurable · **§8** canales privados + recomendaciones · **§5** anuncios de comunidad.
5. **§7** Historias: video/audio, audiencia fina, vistas/reacciones, silenciar autor.
6. **§12** Pedidos/carrito desde catálogo (flujo completo).
7. **§12/§13** Pagos: simulador de proveedor + historial/comprobantes + compartir enlace (desactivado por defecto).
8. **§12** Campañas: worker de envío + canal simulado (desactivado).
9. **§12** CRM/API: adaptador local simulador (desactivado).
10. **§1** Registro por teléfono con **simulador SMS** (compatible con correo) · alertas de acceso.
11. **§16** Consola de administración · **§14** export completo de datos.
12. **§9** E2EE de mensajes en entorno aislado (desactivado en prod) — mayor riesgo; decisión explícita.
13. **Nativo (📱)**: biometría, sincronización de agenda — preparar código + marcar pendiente de build.
14. **§17** Tabla transversal por función + cierre de matriz.

> **Punto de continuidad:** al retomar, leer esta matriz, verificar el estado real
> en el código y continuar por la primera etapa no cerrada sin repetir trabajo.
