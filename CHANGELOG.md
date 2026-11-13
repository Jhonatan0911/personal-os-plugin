# Changelog

## 3.4.0

- **planear-sprint · modelo de BD por subtarea:** el ítem acepta `modelo` (tablas nuevas y existentes, columnas con llave, referencia y null). En la página se abre como diagrama de relaciones con zoom y un editor para borrar o agregar tablas y columnas, guardar (queda como decisión) y aprobar; el modelo sale en la descripción de Jira. El generador lo valida.
- **Panel de la subtarea más claro:** «Análisis previo de la IA y notas del líder» (no va a Jira) y, siempre visible debajo, «Descripción que se crea en Jira» como tarjeta. Corregido el fondo oscuro que heredaba la cabecera de la descripción.
- **Las notas del líder mandan:** el analista de la página las sigue sobre el borrador y el expediente («Ajustar con el analista a mis notas»), y la skill exige leer la base de la página antes de regenerar y dar `id` a toda subtarea escrita a mano.

## 3.3.2

- **planear-sprint**: la observación de cada subtarea se escribe en lenguaje claro desde el primer análisis, con tres partes fijas («Qué hace · Horas · Depende de», o «Por qué está en espera»). La traza técnica (tipo de matriz, factores, confianza, ajustes del revisor y del refutador) pasa a `obs_tecnica`. `generar_cronograma.py` avisa por cada observación que no empiece con «Qué hace:».

## 3.3.1

- status-celula: en la pestaña ⚙ Configuración, la lista «Carriles que se ven en el celular» (y toda casilla de la pestaña) se veía rota en el celular, porque el ancho completo de los campos de texto también se aplicaba a las casillas. Ahora cada carril es una pastilla con su casilla al lado, y las pastillas se reparten en filas según el ancho de la pantalla.

## 3.3.0

El tablero de planeación se configura desde la propia página: nadie tiene que editar JSON a mano.

- **Pestaña ⚙ Configuración** en el tablero (solo la ve el dueño): página y logo, equipo con búsqueda del
  accountId en Jira, Jira y Microsoft 365, clientes, jornada, festivos, SLA, pestañas, asistente, sprint,
  ajustes del motor y lo prometido al cliente. Valida con las mismas reglas del armador antes de guardar y
  conserva las claves que el formulario no conoce (hay un editor de JSON completo para el resto).
- **Guardar y listo:** la célula y la organización van a la colección `config` de la base y la página las
  aplica al abrir, para todos; los extras y el motor van a `privado` y entran al regenerar.
- **`status-celula-config.js`** (nuevo) baja lo guardado en la página a los archivos antes de regenerar, con
  respaldo y en el mismo orden de claves; si alguien editó un archivo a mano después, prepara la subida.
- `status-celula-tablero.js` acepta `--extras` y `--motor` para que la pestaña los precargue; `motor.json`
  manda sobre el bloque `status_celula:` de `fuentes.yaml`.
- Un tablero ya publicado necesita la regla `config` (lectura: view, escritura: owner): la skill la agrega
  una sola vez al republicar (`tablero-compartido.md` §4).
- `prueba-igualdad.js` acepta `--ignorar "<selector>"` para probar que todo lo demás pinta igual.
- Corregidos los nombres de skills que salían rotos en «Cuándo no se usa» de status-celula.

## 3.2.2

- **planear-sprint** estima horas de atención cuando la matriz trae `factor_atencion_aplicado`: la generación
  del agente es tiempo de máquina, las cifras no se vuelven a multiplicar ni se suben por legado (eso va en
  `rango`) y la revisión y las pruebas no se recortan.
- **planear-sprint** planea varios frentes en paralelo por dev (`planeacion.frentes_paralelos`, por defecto 3):
  nunca propone dedicación exclusiva ni dice que un frente le quita horas a otro.
- Las referencias de tamaño salen siempre de la matriz, no del texto de la skill.
- La matriz por defecto (`matriz-tiempos-ejemplo.yaml`) pasa a ser la del autor: 28 tipos con cifras de
  planeaciones reales, ya en horas de atención (×0,5). Sin datos de personas ni de clientes: ajústala a tu equipo.

## 3.2.1

- **migrar-ramas** y **redactar** vuelven a dispararse solas: su descripción tenía «: » sin comillas, el
  encabezado YAML no se podía leer y Claude Code no sabía cuándo usarlas.

## 3.2.0

El tablero de planeación de la célula sale de la skill, y seis herramientas del líder entran al plugin,
todas configurables.

- **status-celula** arma y publica el **tablero de planeación compartido** (Gantt por persona, colas de
  revisión, certificación y publicación, macros, modo cliente, ocupación de hoy y festivos). La plantilla
  lee la célula (`status_celula.tablero` → `celula.json`, `extras.json`) y la organización
  (`organizacion.json`: marca, conectores) de la configuración; los módulos que no uses (calendario,
  timesheets, bandeja) se apagan solos. `status-celula-tablero.js` arma la página, `prueba-igualdad.js`
  compara contra una publicada y `/status-celula ejemplo` la muestra con una célula de ejemplo. Quién revisa
  y quién certifica (`roles`), el sitio de Jira (`jira.sitio`) y los carriles del celular (`carriles_movil`)
  también salen de la configuración: la plantilla no trae nombres de ninguna célula.
- **migrar-ramas**: nota por líder, `coordinador` opcional para las dudas sin dueño y recordatorio de
  revocar el token al cerrar la migración. **mesa-nueva** usa `raiz_mesas` para encontrar una mesa vecina
  con la configuración ya apuntando a pruebas. **redactar** lee entera la sección del perfil para escribir
  fuera de la organización. **regresion-guiada**: forma de `DEPENDENCIAS_EXTERNAS.json`, más reglas del
  reglamento (relaciones entre datos, tipos de prueba, formato del Excel, orden por riesgo) y la plantilla
  del Excel sin nombres de cliente.
- **informe-desarrollo**: informe de orientación (o diagnóstico, si se pide) de un desarrollo ya
  construido, con levantamiento por subagentes y auditoría de un dev sin contexto. Sección opcional
  `informe_desarrollo`.
- **redactar**: textos que salen a tu nombre, en tu voz, desde tu perfil de voz (`rutas.perfil_voz`).
  Nunca envía.
- **auditar-ux-ui**: auditoría de UX, UI y marca con tres porcentajes y modo «hasta la meta», con el
  perfil de marca de tu organización (`organizacion.marca`).
- **mesa-nueva**: monta una mesa de trabajo multi-repo de Azure DevOps (clonado con el PAT fuera del
  chat, rama base elegida por el líder, mapas por repo, contratos, wrappers de BD de solo lectura). La
  organización, la rama de trabajo y el catálogo de repos salen de la sección `mesa_nueva` de
  `fuentes.yaml`; el catálogo vive fuera del plugin.
- **migrar-ramas**: depuración y migración de repos entre proyectos de Azure DevOps (Branching V2) con
  página de decisiones por repo. La organización, el proyecto transversal, las ramas V2, los alias de
  proyecto y la tabla de líderes salen de la sección `migrar_ramas`; los scripts reciben `--org`.
- **`regresion-guiada`** (nueva): conduce en 10 fases la regresión de un sistema antes de publicarlo —
  reparto por persona, ramas, base de conocimiento por proyecto, lectura del periodo de referencia en
  staging, arranque en localhost con aislamiento de red (proxy-sumidero, relevo de terceros, guardia, firewall
  opcional), reproducción por API y por pantalla con el mismo usuario, errores por causa, revisión con el
  responsable y cobertura por inventario. Lo del cliente (repos, periodo, publicación, bases legadas, ventana
  de escritura) va en la sección `regresion` de `fuentes.yaml` y en un perfil (`regresion.perfil_dir`).
  La lectura de staging pide OK por consulta salvo excepción registrada (`staging.lectura_autonoma`).

## 3.1.1

La Worklist del líder se lee más fácil:

- El expediente abre en un **Resumen**: tarjetas con el paso actual, el compromiso con el cliente, las dudas
  abiertas, lo que está por revisar y el avance en Jira, y debajo los pasos, «Lo que está frenando» y las notas.
- El resto va en **pestañas** con su conteo (Ficha e impacto, Dudas, Plan, Técnica, Historias, Calidad). El
  detalle corto de los niveles que lo usan no cambia.
- El **chat del analista** pasa a un botón flotante por caso, con su propio hilo y borrador; en el celular
  ocupa la pantalla.
- Lista lateral más limpia (punto de criticidad y una línea de estado; etiquetas solo cuando importan) y
  filtros plegados. Tablas con encabezado claro y más aire.

## 3.1.0

Cada célula adapta el flujo del líder sin copiar el de otra: niveles de caso, normas por país y
capacidad real, todo por configuración. Sin la sección `flujo`, nada cambia.

### Nuevo
- **worklist-lider**: la cabina del líder como skill genérica (lista + expediente + chat), con filtro
  por nivel y detalle corto para los casos pequeños. Paleta neutra; marca y conectores por configuración.
- **Niveles de caso** (`flujo` en `fuentes.yaml`, contrato en `planear-sprint/references/niveles.md`):
  qué pasos recorre cada nivel y en qué versión (`corto`, `completo`, `ia_y_humana`, `evidencia`…).
- **Expediente**: `nivel`, `ficha_corta`, `compromisos[]` con historial de fechas y cortes con
  `responsable`, `tipo` (incluye `acta`) y `fuente`.

### Cambiado
- **refutador-requerimiento**: modo corto (norma y alcance, máx. 5 puntos) y filtro por
  `normas.jurisdicciones`; las reglas de la tabla llevan `jurisdiccion`.
- **planear-sprint**: paso 0 clasifica el nivel y resuelve los casos cortos con la ficha corta; el
  cronograma muestra cuántas personas producen PR y avisa de subtareas en días de préstamo.
- **revisar-pr**: capas según el nivel; en `ia_y_humana` no hay segunda pasada y la regla mínima (rama
  con clave, BD con rollback) devuelve el PR.
- **certificar-funcional**: con `evidencia`, una sola fila con la evidencia de cierre.
- **Vigía** (`alcances-scan.js`): persigue también los cortes pendientes y los compromisos vigentes de
  los expedientes, con la cadena de fechas movidas y sin duplicar lo que ya trae una nota de alcance.
- **status-celula**: `produce_pr` y `prestado` en el carril y en la capacidad.

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
