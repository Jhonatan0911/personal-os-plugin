# Changelog

## 3.0.0

Salto mayor: el plugin pasa a cubrir el flujo completo del líder técnico por requerimiento, de entender
y aceptar hasta certificar, y la instalación local y el plugin quedan unidos en una sola fuente.

### Nuevo
- **maestro-skills**: crea, audita (con un auditor determinista y puntaje de 0 a 100), generaliza y
  publica Agent Skills.
- **mapa-criticidad**: calificación de cada módulo en cinco ejes (transaccionalidad, dinero, norma,
  usuarios y reversibilidad) con evidencia citada y validación del líder.
- **revisar-pr**: revisión de un PR de Azure DevOps contra los criterios de aceptación, en tres capas
  (máquina, IA y segunda pasada que verifica cada hallazgo). Enmascara secretos y datos de personas y no
  publica nada.
- **certificar-funcional**: matriz de pruebas desde la especificación, verificación de evidencias,
  veredicto funcional y retro en borrador.
- Agente **refutador-requerimiento**: separa lo que se acepta de lo que va contra una norma, degrada el
  producto o se sale del alcance, y da siempre una alternativa con su costo.

### Cambiado
- **planear-sprint**: paso 0 (entender y aceptar) con el refutador, ficha de impacto, escenarios de
  calidad con medida, subtareas como instrucción con criterios CA-n y cortes de seguimiento.
- **timesheet** une el genérico con el perfil de organización (plantilla corporativa, cortes de horas
  extra).
- **status-celula**, **brief-diario** (2.1.0), **tablero-diario** (pestaña ORDEN), **consola-neuronal**
  (`--config-dir`) y los scripts de los hooks se unieron con las mejoras de la instalación local.
- **checkpoint**: commit local agregando archivos por nombre (nunca `git add -A`) y push solo con OK.
## 2.0.0

Salto mayor: de "brief + tablero" a un núcleo de control completo. Todo lo específico de una empresa
salió a configuración del usuario.

### Nuevo
- **Vigía de compromisos** (`alcances-scan.js`, hook `SessionStart`, comando `/vigia`): un alcance con
  fecha = una nota en `estado/alcances/` con su fuente viva; se cruza punto por punto contra Jira y
  avisa lo que va a fallar. Detecta en la bitácora promesas con fecha que no tienen nota.
- **Hitos con fecha en cada prompt** (`alcances-scan.js --hitos`, hook `UserPromptSubmit`).
- **Búsqueda en todas las fuentes** (`os-buscar.js`, `/buscar`) y hook `Stop`
  (`verificar-ausencia.js`) que bloquea una vez la respuesta que afirma una ausencia sin buscar.
- **Bitácora**: `prompt-logger.js` registra cada prompt; `bitacora-append.js` añade el resumen y las
  líneas `TS` validadas; `bitacora-rotate.js` aplica la retención.
- **Timesheet trazable** (skill y comando `timesheet`): arma el día desde las líneas `TS`, mide la
  cobertura con issue, declara huecos y exporta. Categorías, clientes y jornada configurables.
- **Dial de exigencia** (`exigencia.js`, `/exigencia`): fácil · normal · estricto · cuartel.
- **Consola neuronal** (`build-consola.js`, `/consola`) con plantilla y layout de ejemplo.
- **Módulo de personas** (`personas-*.js`, skill `personas`, `/quien`).
- **Status de la célula** con Gantt (`/status-celula`).
- **Planear sprint** (skill `planear-sprint`) con matriz de tiempos y agente `revisor-estimacion`.
- **Checkpoint / retomar** multi-frente (`handoff.js`).
- Agentes `brief-jira`, `brief-outlook`, `brief-teams` y `redactor-correos`.
- `/os-setup` reescrito sobre `os-setup.js`: siembra todas las carpetas con su contrato, plantilla
  `fuentes.yaml` (cloudId, accountId, proyectos, equipo, matriz de tiempos) y `config.json` (zona
  horaria, festivos del país, timesheet, carpetas de búsqueda). Idempotente: nunca pisa nada.

### Cambia
- **Estado en notas-objeto**: una nota por riesgo, compromiso, decisión, alcance y persona (antes,
  `riesgos.md` / `compromisos.md` únicos). Si vienes de la 1.x, tus archivos viejos no se tocan;
  pásalos a notas cuando quieras (el brief puede ayudarte).
- Días hábiles con los **festivos que configures** y hora en tu **zona horaria**.
- Hooks con `node` portable y rutas por `${CLAUDE_PLUGIN_ROOT}`; el vigía sale con 0 para que su
  bloque llegue al contexto (`--exit-code` para usarlo en scripts).
- El email del autor ya no figura en los manifiestos. Archivos en UTF-8 sin BOM.

### Quita
- La fuente externa de tareas propia de una empresa: ahora es genérica (`tareas_externas` en `fuentes.yaml`).

## 1.4.0
Fuentes externas de tareas, roles (responsable · líder · aprobador) y consultas de Jira ampliadas.

## 1.3.0
Brief con seguimiento verificado (cierre por evidencia).

## 1.2.0
Tarjeta Ayer/Hoy en el tablero y apertura automática; recordatorios locales.
