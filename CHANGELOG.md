# Changelog

## 4.1.0 · El paquete completo, a la medida de cada quien

- **paso-a-produccion genera el paquete completo por defecto.** `config-ejemplo.yaml` trae los 16 entregables (funcional, técnica, impacto, diagramas, pruebas unitarias, ruta crítica, funcionales, QA, plan, apertura, manual, guía de soporte, guía de datos, comunicado y video) y tres aprobaciones. La revisión ya no mira solo el nombre del archivo: `requiere` exige PDF, N capturas, textos con regex, evidencia en `evidencias/` o un MP4 medido con ffprobe, y los marcadores de borrador dejan el entregable 🟡. Dentro de una mesa, el paquete vive en `<mesa>/final/`.
- **Cada quien elige qué genera.** `paso_produccion.omitir: [ids]` (o `genera: false`) deja un entregable en «⚪ no se genera», sin exigirlo. `con: <id>` lo ata a otro: el video se omite con el comunicado. Un id desconocido en `omitir` se denuncia y no se ignora. Las aprobaciones no se omiten.
- **⚙ Config · Paso a producción.** Es un panel nuevo en la consola con una casilla por entregable (el video va anidado bajo el comunicado). Guarda al marcar. `GET/POST /api/config/paso-produccion` reescribe solo la línea `omitir:` de `fuentes.yaml`: deja una copia `.antes-omitir`, escribe de forma atómica y conserva el BOM y el CRLF. Lo cubren 14 pruebas nuevas en `os-servidor.prueba.js`.
- **Comunicado, manual y video con material real.** Hay cinco scripts nuevos:
  - `capturas.py`: Playwright con un guion; hace login con credenciales de TEST fuera del repo, selecciona sede y menú, y no escribe en la base sin `--permitir-escritura`.
  - `pdf.py`: PDF con la marca, con Mermaid.
  - `comunicado.py`: boletín de una página en HTML, PNG y PDF.
  - `verificar_pdf.py`: revisa páginas, franjas blancas y desborde.
  - `musica.py`: MusicGen local.
- **`video.py`: el video tutorial sale de un guion JSON.** El guion lleva gancho, un paso por captura con foco de cámara y clic, beneficios y cierre con logo. El script valida antes de escribir que ningún foco deje ver lo que `video.recorte` oculta (el menú, o la cabecera con el usuario) ni se salga de la captura, que las capturas existan y que dure entre 20 y 90 s. La plantilla `plantillas/video-tutorial/` es neutral (sonidos, package.json y `guion-ejemplo.json`). Los videos anteriores se declaran como referencia en `video.ejemplos`.

## 4.0.1

- **Vigía de compromisos · alcances traspasados:** un alcance con `estado: traspasado` (más `traspasado_a` y `traspasado_el`) deja de vigilarse como propio (entrega, fuente viva y puntos sin dueño) cuando otro líder lo hereda. Solo siguen sonando, como «HITO TUYO EN UN ALCANCE TRASPASADO», los hitos con fecha que nombran al usuario (`nombreCorto()`), hasta que los cierre o los reasigne en la nota. El resumen cuenta los traspasados aparte. Los expedientes de requerimiento aceptan `traspasado_a` con la misma regla: sus compromisos con el cliente pasan al nuevo líder y de sus cortes solo suenan los que nombran al usuario como responsable.

## 4.0.0 · Ahora tiene equipo

Versión mayor: la consola pasa a ser **la app** del Personal OS y los subagentes de Claude Code ganan identidad, ficha y memoria.

- **La consola es la app.** `os-servidor.js` sirve la consola y le inyecta `plantillas/consola-app.js`, que suma las pestañas **Oficina**, **Mandos** y **⚙ Config** a su propia barra (sin cascarón ni iframe de la consola). Abierta como archivo, la consola queda igual que siempre. Se retira `plantillas/app.html`. `/consola` abre la app si el servidor responde, como una pestaña del navegador por defecto; `--crear-acceso` deja un acceso `.url` en el Escritorio.
- **Agentes con identidad (modelo Grok Bot / Muse, adaptado a Claude Code).** En ⚙ Config cada agente tiene:
  - **Mascota SVG por familia** (`plantillas/identidad-agente.js`, una sola fórmula para la consola, la oficina, la landing y el video): la familia fija cuerpo, color base y emblema (Personal OS, Claude Code integrados, GSD, otros); el nombre da ojos, boca y matiz; el oficio, el accesorio. Respira, parpadea y rebota cuando el agente trabaja de verdad.
  - **Ficha**: oficio, lema, objetivo, meta de cierre y límites, más el campo oficial `color`. Panel en tres capas: lista, ficha y registro.
  - **Actividad real** desde los hooks (`_runtime/agentes-*.jsonl`): usos de 7 y 30 días, última vez, si corre ahora y sus últimas ejecuciones. Los integrados de Claude Code se listan aunque no tengan archivo.
  - **Memoria en Markdown** con la memoria nativa de Claude Code (`memory: user` → `~/.claude/agent-memory/<agente>/`): **conocimiento** que escribe el usuario (se indexa solo en `MEMORY.md`) y **experiencia** que escribe el agente.
  - Los tuyos se crean, editan y borran (a la papelera, fuera de la carpeta que escanea Claude Code); los del Personal OS y los de terceros llevan candado. Claude Code toma los cambios en caliente.
- **Oficina** (pestaña): la escena 3D se carga solo con la pestaña abierta y se apaga con un botón para aliviar carga; los residentes (tuyos y del Personal OS) tienen escritorio fijo y los demás entran de visita mientras trabajan. El servidor sirve `/_vendor` y la oficina deja de necesitar un servidor aparte.
- **RAM en el pie de la consola**: memoria real del servidor y la que reporta la página.
- **Seguridad del servidor**: 22 pruebas de control en `scripts/pruebas/os-servidor.prueba.js` (Host, Origin, token, lista cerrada, traversal también por `/_vendor`).
- **Landing**: sección «Ahora tiene equipo» con video (HyperFrames, datos ficticios), galería viva de familias y la oficina.
- **mesa-nueva · carpetas de entrega:** toda mesa nace con `revision-pr/` (una carpeta `AAAA-MM-DD-<persona>/` por cada entrega del equipo, con su `ENTREGA.md` y los adjuntos tal como llegaron; ahí se anota el veredicto de `revisar-pr`) y `final/` (el paquete de paso a producción). El `README.md` de `final/` se genera desde `paso_produccion.entregables` y `.aprobaciones` de `fuentes.yaml`, con archivos `<id>.*` y `aprobaciones/`, para que `paso-a-produccion` lo verifique con `paquete.py --carpeta <mesa>/final`.

## 3.19.0

- **Consola unificada (primera entrega):** una sola app en el navegador con las pestañas **Consola** (la consola neuronal de siempre), **Mandos** (estado del OS, exigencia, indicadores y acciones) y **⚙ Configuración** (los agentes llegan en la próxima versión). La sirve `scripts/os-servidor.js`, un servidor local en Node puro, sin dependencias, de unos 47 MB.
  - **Seguridad:** solo `127.0.0.1`; se validan `Host` (contra DNS rebinding) y `Origin`, y se exige un token aleatorio por arranque que solo viaja dentro de la página. Hay una lista cerrada de acciones (ninguna ruta ni comando libre) y los estáticos salen sin traversal. 18 pruebas de control en `scripts/pruebas/os-servidor.prueba.js`.
  - **Acciones propias:** pausar o activar el OS, mover la exigencia (por `exigencia.js`), reconstruir la consola y abrir el tablero, la bitácora de hoy o la carpeta de estado. Las tuyas se declaran en `config.json → servidor.acciones` (`{etiqueta, ayuda, confirmar, cmd: [...], esperar, mostrar_si, ocultar_si}`, con `${STATE}`, `${OS_HOME}`, `${SCRIPTS}` y `${NODE}`).
  - **Indicadores:** `servidor.indicadores` (`[{id, etiqueta, cmd}]`). Cada comando imprime una línea JSON `{valor, detalle, tono}`; si falla, la app lo muestra en rojo con la causa, nunca un número inventado.
  - **Arranque y testigo:** `node os-servidor.js --instalar-tarea` lo deja oculto al iniciar sesión (acceso en la carpeta Inicio; no pide administrador) y `--crear-acceso` pone en el Escritorio una ventana propia (Edge en modo app), sin pisar un acceso ajeno. Con `servidor.activo: true`, el arranque de Claude avisa si no está corriendo.

  ```json
  "servidor": { "activo": true, "puerto": 7318, "acciones": {}, "indicadores": [] }
  ```

## 3.18.2

- **Corteza · un ajuste por nota:** `conocimiento-build.js --check` rechaza dos propuestas de ajuste a la misma nota vigente y las que dicen «ajustar» sin decir qué nota (`ajusta: CO-###`). El sueño semanal corre por semanas y abría un ajuste nuevo en cada una en vez de sumarle el caso al pendiente; ponerse al día con cuatro semanas dejó 23 ajustes para 13 notas, casi todos sin el párrafo **Regla.** completo.

## 3.18.1

- **Consola · la plantilla se actualiza sola:** si el usuario tiene una copia en `<estado>/config/consola.html` distinta a la del plugin, `build-consola.js` la reemplaza por la del plugin y deja respaldo (`consola.html.antes-AAAA-MM-DD`). Así nadie se queda con un diseño viejo sin saberlo. Una copia marcada con `consola-personalizada` se respeta.

## 3.18.0

- **Consola · auditoría de UX/UI en 13 rondas (de UX 35 % / UI 44 % a UX 92,5 % / UI 80-89 %, sin bloqueantes).**
  - **Pestaña Hoy** (la de entrada): la prioridad #1 con su fecha (si no es de hoy lo dice en naranja), cuatro cifras que filtran (vence hoy, vencidos con su antigüedad, nivel 3, todos) y «Lo que pide atención» ordenado; cada fila abre su tarjeta. Franja de frescura si los datos o el hito no son de hoy; avisos del build en una lista, no en un tooltip.
  - **Datos honestos en el build:** quita los comentarios YAML del frontmatter (alcances cumplidos ya no cuentan como activos), fecha la prioridad y el hito, días de atraso por ítem, texto completo de la nota y su ruta, avisos de proyectos sin mapear agrupados en uno, «Sin proyecto» en un hueco libre y visible en ambos ámbitos.
  - **Mapa:** proyectos con muchos ítems muestran los 3 más graves y una insignia con el total; clic o toque en nodo, nombre, insignia o ítem abre su tarjeta; rótulos que no chocan; tooltips que nunca salen de la pantalla.
  - **Tarjetas:** filtros, búsqueda con vacío y «Limpiar», 8 ítems por tarjeta con «Ver los N restantes», «Ver todo» a lo ancho y «Abrir ↗» la nota.
  - **Corteza:** la búsqueda y los lóbulos listan lecciones como botones (teclado y lector), «Abrir la lección ↗», controles del panel con su detalle, lectura a pantalla completa en celular con «Volver».
  - **Celular, accesibilidad y movimiento:** cabecera compacta con las 5 pestañas, ámbito como selector, objetivos de 44 px, foco gestionado tras cada acción, anuncios `aria-live`, URL que recuerda vista y ámbito, y todo quieto con «reducir movimiento».

## 3.17.0

- **Consola · pestaña Corteza:** el cerebro se ve. `build-consola.js` lee las notas `CO-###` de `conocimiento.dir` (regla, porqué, cuándo no aplica, casos, versiones del historial y sus «Ver también»), las propuestas del sueño y las semanas ya consolidadas, y las pinta como lóbulos por tema con sinapsis reales entre notas. Arriba, la capa de control (núcleo de la empresa, vigías, guardia); al cambiar el ámbito a Personal se apaga el control de la empresa y el saber queda entero. Búsqueda, detalle de cada lección al tocarla, filtro por lóbulo y enlace directo `consola.html#corteza&personal`. Sin corteza configurada, la pestaña explica cómo activarla.
- **Landing · «Ahora sueña»:** video de 34 s hecho con HyperFrames (fuente editable en `video/ahora-suena/`): la bitácora de la semana se vuelve una lección mientras el OS duerme y, al cambiar a Personal, se apaga el control y queda el saber. Sin datos reales.
- **Landing · consola en vivo:** «El cerebro» incrusta la consola **real** generada por el mismo build con un estado y una corteza de ejemplo (`demo/generar.js` → `demo/consola.html`), con la pestaña Corteza abierta. Novedades de la 3.14 a la 3.17.

## 3.16.1

- **conocimiento-build.js · índice liviano:** las notas de método del índice (que entra en todas las sesiones) van solo con su título —que ya es la afirmación— y el nombre de su archivo; la regla completa se lee de la nota. Con 61 notas el índice bajó de 22,7 KB a 3,8 KB.

## 3.16.0

- **El sueño: consolidación y olvido.** `bitacora-rotate.js` ya no borra: **archiva** en `bitacora/_archivo/AAAA-MM/` los diarios vencidos y solo si su semana ISO ya tiene `resumen-AAAA-Www.md` (nada se olvida sin consolidar; el timesheet y la búsqueda siguen encontrándolos). El arranque avisa cuando hay lecciones propuestas en `<conocimiento>/_propuestas/` esperando aprobación, y si alguna no pasó la validación. CORE §7-quater describe el sueño semanal y cómo se revisan las propuestas (aprobar, ajustar una nota con un caso más —3+ casos sube a `duro`—, archivar o rechazar). `conocimiento-build.js` acepta «Por que» sin tilde.

## 3.15.0

- **El cerebro: corteza de saber común (`conocimiento-build.js`).** El saber técnico propio del usuario vive como notas atómicas `CO-###` (título = la afirmación, porqué, caso de origen abstraído, procedencia, `aplica_a`, `nivel` duro|criterio, `estado` propuesta|vigente|archivada) y se genera a `~/.claude/rules/conocimiento/` por tipo de archivo, para que aplique en **cualquier** proyecto, de la empresa o personal. Valida la forma (`--check`), exige el porqué y **bloquea los términos confidenciales** de `conocimiento.terminosProhibidos` (integridad contextual: lo que cruza de contexto es la lección abstraída). El índice siempre presente lleva las notas de método y la regla de pedir el criterio del usuario antes de proponer arquitectura. CORE §7-quater.
- **reglas-organizacion · núcleo por ámbito:** `salida.nucleo` en el registro escribe el núcleo fuera de las reglas que Claude Code carga siempre; `session-init.js` lo inyecta desde `<os-home>/nucleo-empresa.md` solo en sesiones de la empresa. El hook guardia sigue en todas.
- Fundamento (investigación del 21/11/2026): el cerebro separa por contexto el control, no el saber (corteza prefrontal vs neocórtex); lo que se transfiere entre dominios es la lección abstraída (ReasoningBank, ACE); integridad contextual (Nissenbaum).

## 3.14.0

- **Frontera personal/laboral por carpeta (`config.json → ambitos`):** el ámbito de la sesión sale de la carpeta donde se abrió (gana el prefijo más largo; sin coincidencia = `central`). En una sesión personal (proyectos propios, universidad) **callan** el vigía de correo, el de reglas de la organización y el de reuniones con issue; el de compromisos solo muestra los alcances personales (`ambito: personal` o un cliente de `clientesPersonales`), sin expedientes, sin compromisos de la empresa y sin rastreo de la bitácora. En las `laboral` y la `central` todo sigue igual. El arranque inyecta «Ámbito de esta sesión». Sin `ambitos`, el comportamiento es el de siempre. Nació de que el vigía de correo (3.13.0) se exigía antes del tema también en sesiones personales.

## 3.13.2

- **status-celula · avisos fijos solo de «sin tareas»:** se quitan los avisos de «X está sobrecargado hoy»; quedan solo los de quien está sin tareas o se queda sin ellas (pedido del 20/11/2026). La carga del día sigue visible en la franja «Hoy» y en la fila de carga de cada carril.

## 3.13.1

- **status-celula · títulos de hoy entendibles:** la regla pasa a «tipo de trabajo + sobre qué», 3 a 6 palabras («Dashboard del validador de derechos», «Integración de pruebas rápidas con Compensar»); una reunión se nombra como reunión; sin recortes que cambien el sentido ni siglas sin contexto. Guía nueva `references/titulos-hoy.md` (fórmula, tabla de tipos de trabajo, ejemplos buenos y malos) y `status-celula-hoy.js` con más contexto por grupo (tipo de cada issue, historias, pista de reunión o seguimiento) y `--validar`, obligatorio antes de subir.

## 3.13.0

- **Vigía de correo (regla dura, CORE §7-ter):** script nuevo `correo-scan.js` en los hooks de arranque y de cada prompt. Avisa cuando el buzón lleva más de `correo.horasMaxSinBarrer` horas sin barrer en jornada (3 por defecto), cuando el último barrido leyó un buzón que no es el del dueño (`correo.buzon` en config.json) o cuando hay urgentes abiertos; `--marcar` registra cada barrido en `<stateDir>/correo/barrido.json`. Nació de un urgente del cliente con plazo que llegó después del brief y se descubrió dos días tarde con el conector abierto en otra cuenta.
- **brief-diario · paso 0-bis «Barrido de urgentes»:** identidad del buzón primero, entrantes desde el último barrido con términos de urgencia, y cada urgente con fecha se vuelve alcance o hito el mismo día. Lo hace también cualquier sesión cuando el vigía lo pide.
- **brief-outlook:** se detiene y lo dice en la primera línea si el buzón es ajeno; la sección URGENTES abre el digest.
- **retomar:** el vigía de correo se atiende antes del frente.
## 3.12.0

- **status-celula · el título dice lo que se hace hoy:** cada global de «Ocupación de hoy» se muestra con un título corto (2 a 4 palabras) de lo que la persona hace ese día («Correcciones doble RIPS», «Validador de derechos»), no con el nombre largo del macro, que queda al pasar el cursor. Regla fija de la skill: paso 7-bis de §C con el script nuevo `status-celula-hoy.js`, que lista por persona y global las tareas de hoy para escribir `datos.jira.cortos` (`"<carril>|<GLOBAL>"` y uno genérico por global); `status-celula-compartido.js` lo sube a `jira/cortos`. Sin títulos escritos, la página acorta sola (sin paréntesis, [GLPI-…], «HU-xx ·», nombre del cliente; 6 palabras máximo).

## 3.11.3

- **status-celula · Ocupación de hoy, texto más corto:** «X % terminado, Y % en revisión» sin el prefijo «Proyecto:» y sin el aviso «trayendo de Jira…»; un error de Jira queda solo en el detalle al pasar el cursor.

## 3.11.2

- **status-celula · Ocupación de hoy, textos y un solo botón:** se quita el botón «traer de Jira / actualizar» de cada global; el avance se trae solo al desplegar y «Actualizar Jira y calendario» lo renueva. Textos sin abreviaturas: «Proyecto: X % terminado, Y % en revisión» y «Hoy le dedica N h» («Hoy: … en reuniones»).

## 3.11.1

- **status-celula · Ocupación de hoy, diseño:** la línea de globales ya no ensancha las tarjetas (vuelven a caber todas a primera vista); el desplegable ▾ va debajo de su propia tarjeta y con su mismo ancho, compacto (global, %, barra, «% hecho · % en revisión · horas de hoy»; el detalle al pasar el cursor) y con alto máximo. Los globales con el mismo título (una issue y su espejo en otro proyecto) se muestran como uno, con el avance de los dos.

## 3.11.0

- **status-celula · qué hace hoy cada persona:** cada tarjeta de «Ocupación de hoy» lleva una línea con los globales en que trabaja hoy (macro; si no hay, la historia; si no tiene padre, la propia tarea), ordenados por horas y con las reuniones al final. La flecha ▾ despliega una barra por global con su avance en Jira por etapas (terminado · revisión o por publicar · en curso · sin iniciar) sobre todas sus hojas, por horas si todas están estimadas o por cantidad si no; `Redefinido` se cuenta aparte. Trae el global en vivo con el conector de quien mira y, sin conector, usa la foto y lo dice. Regla en SKILL.md §C-5-bis.
- **status-celula · foto con padres:** `status-celula-compartido.js` sube el padre y el tipo de cada issue y un documento `jira/padres` con los ancestros (lo que no vino en la lectura del equipo llega en `datos.jira.padres`), para que el global se vea desde la foto de la skill y no solo tras «Actualizar». Nuevo paso 4 en la lectura de Jira (§B).

## 3.10.1

- **reglas-organizacion · página de convenciones para el equipo:** campos opcionales `texto_equipo` y `fuente_equipo` por regla. La página (`--vista`) muestra la norma como la lee el equipo y la fuente por su nombre real, y oculta las etiquetas de cumplimiento del asistente; `regla` y `fuente` siguen siendo lo que cumple Claude. Sin esos campos, la página usa el texto de siempre.

## 3.10.0

- **Nueva skill `reglas-organizacion`:** registro único de las reglas de la organización (`<config>/reglas-empresa/registro.yaml` + `repos.yaml`, plantillas en la skill). `scripts/build.py` genera por capas: núcleo siempre presente y reglas por tipo de archivo en `~/.claude/rules/<salida>/` (con `paths:`), `reglas_empresa.por_skill` y `revision_pr` en `fuentes.yaml`, la configuración del hook y del vigía, y con `--vista` una página de convenciones con la marca de la organización. Valida antes de escribir (ids, campos, tope de 40 reglas en el núcleo, secciones escritas a mano) y no toca nada si falla.
- **Hook `guardia-empresa.js` (PreToolUse, Bash | PowerShell):** niega comandos que conectan a servidores de producción declarados, pregunta por réplicas de lectura, niega push a ramas protegidas o sin clave de Jira (solo en los remotos de `remotos_org`) y niega escrituras SQL/Mongo fuera de los servidores de test. Sin configuración generada, deja pasar todo.
- **Vigía `reglas-scan.js` (SessionStart):** despliegues a producción con fecha sin paquete completo (`paso-a-produccion`), documentos fuente que cambiaron o versiones nuevas en carpetas vigiladas (`--aceptar` marca la revisión) y registro editado sin regenerar. Solo imprime si hay hallazgos.
- **CORE §17:** reglas de la organización: normativas, registro único y cumplimiento por capas; nunca reglas inyectadas en cada prompt.
## 3.9.0

- **brief-diario · reglas de la organización sobre correo:** si `fuentes.yaml` trae `reglas_empresa.por_skill.brief-diario`, `brief-outlook` recibe esas reglas y devuelve las solicitudes de requerimiento o de estimación de los últimos 3 días hábiles con su fecha de llegada, si se respondieron en el hilo y si llegaron por el canal y con las copias exigidas. Cada regla incumplida entra al brief como riesgo con su `id`.
## 3.8.0

- **Nueva skill `paso-a-produccion`:** arma y verifica el paquete que la organización exige antes de desplegar a producción. La lista de entregables y aprobaciones vive en la sección `paso_produccion` de `fuentes.yaml` (ejemplo en `config-ejemplo.yaml`); `scripts/paquete.py` la cruza contra el expediente (campos con contenido) y la carpeta del paquete (archivos por prefijo), escribe `paquete.json` y `paquete.md` y sale con 0 (completo), 1 (falta algo) o 2 (sin expediente o configuración). Guía para producir los faltantes técnicos desde el código (impacto por `git diff`, diagramas en Mermaid) y borrador del correo de aprobación. Nunca despliega ni envía.
- **Reglas de la organización por skill:** clave nueva `reglas_empresa.por_skill.<skill>` en `fuentes.yaml`, una lista de `{id, titulo, regla, fuente}` (suele generarse desde un registro de reglas). `planear-sprint` aplica las suyas como verificaciones en el paso 0, la descomposición y el resumen; `mesa-nueva` las lleva al `CLAUDE.md` de la mesa y marca como nuevos (con sus guías de arquitectura) los repos de `revision_pr.proyectos_nuevos.repos_nuevos`; `paso-a-produccion` nombra la regla que exige el paquete.
- **mesa-nueva · PowerShell 5.1:** `dbread.ps1`, `mesa-clonar.ps1` y `mesa-status.ps1` resuelven su ruta por defecto dentro del script, porque en PS 5.1 `` puede llegar vacío en los valores por defecto de `param()` (la corrección ya estaba en la copia instalada y no en el plugin).

## 3.7.0

- **planear-sprint · mockups dentro del cronograma:** campo opcional `mockups` en el plan (`{archivo, titulo}`, ruta `.html` relativa al plan). El generador pinta un botón fijo «🖼» que abre la página de mockups en un panel con **Pantalla completa** y **Descargar HTML** (capacidad `downloads`), y avisa cómo publicarla con `files`. Sobrevive a cada regeneración.
- Documentado en `references/cronograma.md`: armar una sola página de mockups desde el HTML de Stitch (`download_file`, no PNG), limpiarla de lo inventado fuera del alcance, y el gotcha de no enlazar el archivo en otra pestaña (claude.ai lo bloquea con `ERR_BLOCKED_BY_RESPONSE`).

## 3.6.0

- **planear-sprint · modo requerimiento multi-sprint:** un solo cronograma para todo un requerimiento de varios sprints. Se activa con `sprints` en el plan (sin ese campo, todo igual que antes). Campos nuevos opcionales: `sprints[]` (estado, responsable, inicio mínimo, avance, fases), `meta` (fin de desarrollo y entrega), `escenarios[]` de personas (quién toma cada sprint y desde cuándo entra la persona nueva); en la historia `sprint` y `keys`; en el ítem `id`, `responsable`, `depende`, `cierre` y `comparte`.
- **Calendario por persona** en el generador y en la página (mismo algoritmo): sprints en orden, revisión y pruebas al final de cada sprint, dependencias, capacidad diaria con festivos y préstamos, lo en espera sin fecha. El desborde frente a la meta sale como atraso (horas que no caben y fin estimado), nunca se comprime.
- **Vista general** (abre por defecto con sprints): Gantt por persona con una barra por sprint y color por estado, líneas de meta y entrega, totales y holgura o atraso por persona, selector de escenario, reasignar un sprint completo (recalcula, queda guardado y anotado), «Aplicar fechas del escenario» y piezas que se repiten entre sprints. **Vista de sprint**: la página de siempre filtrada por sprint y por persona. La exportación a Jira no cambia.
- El generador valida los campos nuevos (historia sin sprint, sprint inexistente, escenario con un sprint desconocido, dependencias rotas, ids repetidos) e imprime el resumen por sprint, por persona y por escenario. Ejemplo ficticio: `plan-multisprint-ejemplo.json`.
- **Fase 1:** si la mesa tiene `MESA.json` con `compararClientes`, el buscador de reutilización revisa cada pieza en el cliente base y en cada cliente de `otros` (carpetas locales, solo lectura) y la tabla de piezas lleva una columna por cliente.

## 3.5.2

- **planear-sprint · el paso 1 del exportador ya no reescribe lo revisado:** «Interpretar y redactar descripciones» solo redacta las subtareas sin descripción; las ya redactadas se conservan tal cual. Con borrador, el analista ya no recorta a 150 palabras: conserva pasos, reglas con sus cifras, valores de catálogos, «Qué NO tocar», criterios CA-n, contexto, condicionados, bloqueos de terceros, la nota del mockup y «Si dudas, pregunta». No inventa campos ni cifras, no vuelve fijo lo configurable y no da por adjunto ni por resuelto lo que no lo está.

## 3.5.1

- **planear-sprint:** nueva clave `planeacion.reglas_org` en `fuentes.yaml`: reglas de la organización (quién corre scripts y jobs, convenciones de BD…) que la skill lee en la Fase 0 y cumple en toda subtarea.

## 3.5.0

- **planear-sprint · el modelo de BD llega completo a Jira:** la descripción de la subtarea lleva una tabla por cada tabla de BD (columna, tipo, PK, referencia, null), las tablas existentes que se leen y la lista de relaciones. El diagrama va como imagen: `modelo_png.py` la genera con el mismo dibujo de la página (Edge o Chrome headless, doble resolución) y la skill la sube e incrusta en la descripción con `uploadAttachmentToJiraIssue` + `editJiraIssue` (con OK del líder). En la página, el botón «⬇ Imagen PNG» del visor descarga la misma imagen.

## 3.4.1

- **planear-sprint:** «+ Modelo de BD» abre un borrador que no se guarda hasta darle «Guardar»; antes, un clic dejaba guardada una tabla vacía «Nueva_Tabla». El editor tiene «Quitar el modelo».

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
