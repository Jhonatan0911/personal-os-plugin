# El cronograma interactivo

Léelo en la Fase 4: al generar, publicar y registrar el cronograma, o cuando el líder pregunte cómo se
comporta la página (carga, reprogramar, exportar).

Secciones: 1 Generar · 2 Publicar · 3 Cómo se comporta · 4 Exportar a Jira · 5 Después de publicar ·
Panel de cada subtarea · Modelo de BD en Jira · 6 Modo requerimiento multi-sprint (campos, cálculo, página).

## 1. Generar

```
python "${CLAUDE_SKILL_DIR}/generar_cronograma.py" plan.json cronograma.html [--perfil <perfil.json>] [--marca <marca.json>]
```

Con `python` o `python3`. Pasa `--perfil` si existe `planeacion.perfil` y `--marca` si existe
`planeacion.marca` (ver `configuracion.md`). Lee los avisos que imprime: sin `cloud_id` la página no
consulta ni exporta; si nombra un expediente que no existe o al que le faltan fuentes, corrígelo antes.

## 2. Publicar

- **Con la herramienta `Artifact`**: carga antes la skill `artifact-capabilities` y declara
  `db` (colecciones `plan`, `orden` y `expediente`, y `escenario` si el plan es multi-sprint: lectura para
  quien ve, escritura solo el dueño),
  `user`, `sample`, `downloads` y `mcp` (Atlassian: `searchJiraIssuesUsingJql`, `createJiraIssue`,
  `addCommentToJiraIssue`, `getTransitionsForJiraIssue`, `transitionJiraIssue`; y, si hay correo,
  `outlook_email_search` y `read_resource`). Después, `ArtifactData set` del expediente en
  `expediente/actual`.
- **Sin `Artifact`**: entrega el HTML local. Se ve el plan en solo lectura (sin guardado, sin Jira y sin
  analista); la exportación queda para cuando se publique.
- La página es responsive y respeta modo claro/oscuro; la marca es opcional.

## 3. Cómo se comporta (para explicarlo sin abrir el código)

- **Dos estados**: `propuesta` (Claude la sugiere; el líder la acepta, la cambia o la descarta; no se pinta
  hasta aceptarla) y `espera` (pendiente de definición, vinotinto, sin fecha).
- **Fila de carga real**: reparte cada subtarea con la capacidad que le queda al día desde su inicio y pasa
  al día hábil siguiente lo que no cabe. No divide parejo ni duplica. Festivos con carga 0.
- **«Programar en secuencia desde…»**: rehace las fechas de lo aceptado sin clave de Jira, en el orden de
  las historias y sus subtareas, desde el siguiente día hábil, con **un calendario por persona**.
- **Responsable por subtarea**: por defecto el dueño del cronograma. La de otra persona no suma a la carga
  del dueño y al exportar sale asignada a ella (accountId de `cuentas`, o la página lo busca en Jira por
  nombre; nunca se adivina).
- **Revisión y pruebas** van al final del sprint, no pegadas a la historia donde quedaron escritas.
- **Desborde**: si lo aceptado pasa del fin de desarrollo, se muestra como atraso con las horas que no
  caben. Las fases del cliente no se mueven; un replanteo va en `fases_replan` (en rojo, debajo).
- Los datos que entrega el almacén vienen congelados: la página los clona antes de editarlos.

## 4. Exportar a Jira (lo hace el líder desde la página)

1. **Paso 1 · interpretar**: el analista toma el borrador de cada subtarea, la historia, las subtareas
   hermanas y el expediente, y redacta la descripción (Objetivo · Qué hacer · Dónde · Criterios técnicos
   · Depende de). El líder la revisa y corrige en el modal.
2. **Paso 2 · escribir**: solo lo marcado, uno por uno, con la cuenta del líder. **Una subtarea con menos
   de 120 caracteres de descripción no sale** (`DESC_MIN` de la plantilla). La página agrega el pie con
   horas, fechas y responsable, la estimación original, la fecha límite y, si existe `campo_inicio`, la
   fecha de inicio.

## 5. Después de publicar

- **Tablero central** (si existe `planeacion.tablero_central`): `ArtifactData set` en
  `<coleccion>/<slug>` con `{titulo, url, tipo: "cronograma", epica, historias[], responsable, inicio,
  entrega, estado, nota}`. Al cerrar o mover la entrega, actualiza ese documento con `if_version`.
- **Compromiso con fecha**: si el sprint tiene una entrega comprometida, propón crear su nota en
  `<stateDir>/alcances/` con el cronograma como fuente viva (los puntos se leen de ahí, no se copian).


## Panel de cada subtarea (desde 3.4.0)

- **Análisis previo de la IA y notas del líder** (`obs`): no va a Jira. Es lo que la IA dedujo del código y de
  las definiciones, y donde el líder escribe sus decisiones. El analista de la página («Ajustar con el analista a
  mis notas») trata esas notas y el modelo de BD como mandatorios sobre el borrador.
- **Descripción que se crea en Jira** (`desc`): siempre visible debajo; es exactamente lo que sale al exportar,
  más el modelo de BD y el pie de estimación.
- **🗄 Ver modelo de BD** (si el ítem trae `modelo`, o «+ Modelo de BD» para crearlo): diagrama de relaciones
  (tablas nuevas en azul, existentes en gris, 🔑 llave, 🔗 referencia, zoom) y editor para borrar o agregar
  tablas y columnas. «Guardar» anota el cambio como decisión; «Guardar y aprobar» marca el modelo aprobado.


## Modelo de BD en Jira (desde 3.5.0)

La subtarea que trae `modelo` sale a Jira con el modelo completo en la descripción (una tabla por cada tabla
de BD, las existentes que solo se leen y la lista de relaciones) **y el diagrama como imagen incrustada**:

1. Después de que el líder exporte, por cada subtarea creada que tenga `modelo`, genera la imagen con el mismo
   dibujo de la página: `python <skill>/modelo_png.py <plan.json o el documento de la base> <id o parte del título> <salida.png>`
   (necesita Edge o Chrome; sale a doble resolución). Lee el documento de la base de la página, no el plan
   local: ahí están las ediciones y la aprobación del líder.
2. Sube la imagen con la operación `uploadAttachmentToJiraIssue` del conector de Atlassian (`discover` →
   `executeWrite`): fase 1 con `filePath` devuelve un `uploadCommand`; córrelo en la terminal y toma el `fileId`.
3. Incrústala en la descripción con `editJiraIssue` e `inlineFileId` (queda al final de la descripción, debajo
   del modelo en texto). No corras la fase 2 para ese mismo archivo: duplicaría el adjunto.
4. Es una escritura en Jira: confírmala con el líder antes, issue por issue o en un solo OK para el lote.

Sin terminal (el líder solo en la página): el botón **⬇ Imagen PNG** del visor descarga la misma imagen para
adjuntarla a mano.


## 6. Modo requerimiento multi-sprint (desde 3.6.0)

Un solo cronograma para **todo un requerimiento** de varios sprints. Se activa con `sprints` en el plan; sin
ese campo la página y el generador se comportan exactamente como en un sprint.

### Campos del plan

| Campo | Forma | Notas |
|---|---|---|
| `sprints[]` | `{id, nombre, orden, estado, responsable, inicio_min?, avance?, fases?}` | `estado`: `por_planear`, `planeado`, `en_curso`, `en_revision`, `hecho` (el `hecho` no aporta horas). `responsable` por defecto: `asignado.nombre`. `inicio_min`: el sprint no arranca antes. `fases`: las del cliente para ese sprint, `[[id, nombre, inicio, fin], …]`. |
| `meta` | `{fin_desarrollo, entrega, texto}` | Obligatorio `fin_desarrollo` (o el `fin_desarrollo` de siempre). Sin `fin` ni `fases`, salen de la meta. |
| `escenarios[]` | `{id, nombre, asignacion: {"S04": "Persona"}, desde?}` | El primero es el que abre la página y el que usa el generador. `asignacion` cambia el responsable del sprint; `desde`: fecha en que entran las personas que no son responsables de ningún sprint en `sprints[]` (antes tienen capacidad 0). |
| historia `sprint` | `"S07"` | Sin sprint, o con uno que no existe, la historia no se programa (aviso). |
| historia `keys` | `["PROY-1", "PROY-2"]` | Cuando una historia del plan agrupa varias claves de Jira repetidas. Las subtareas se crean bajo `key`. |
| ítem `id` | texto | Si falta, el generador pone `<key>.<n>`. Lo usa `depende`. |
| ítem `responsable` | nombre | Manda sobre el responsable del sprint en cualquier escenario. |
| ítem `depende` | `["id", …]` | La subtarea no empieza antes de que terminen esas (aunque sean de otra persona u otro sprint). |
| ítem `cierre` | `true`/`false` | Revisión y pruebas: va al final de su sprint. Por defecto lo son los tipos `prueba_funcional_logica` y `pruebas_en_dispositivos`. |
| ítem `comparte` | etiqueta | La misma pieza en varios sprints (p. ej. el mismo cambio en seis ciclos de vida). La vista general las junta. |

### Cómo se calcula el calendario

El mismo algoritmo en `generar_cronograma.py` (`planificar`) y en la página (`planificar()`): si cambias uno,
cambia el otro (la prueba de que coinciden: en la página recién generada, «Aplicar fechas del escenario» dice
que las fechas ya eran esas).

1. Un calendario por persona desde `inicio`, con la capacidad diaria (`capacidad`: lunes a jueves y viernes),
   0 en `festivos`, 0 si no produce PR o está prestada (`equipo`) y 0 antes del `desde` del escenario.
2. Orden: sprints por `orden` (sin los `hecho`); dentro de cada sprint, primero el desarrollo y al final lo de
   `cierre`; las historias en el orden de la página (por clave) y los ítems en su orden. Después,
   `depende` reordena lo necesario (un ciclo se rompe en el orden del plan).
3. Cada ítem arranca donde va la persona (o después de `inicio_min` y de sus dependencias), llena la
   capacidad que le queda al día y pasa al siguiente lo que no cabe. Las horas no se tocan.
4. `espera` y `descartada` no llevan fecha; las horas en espera se suman aparte.
5. **Atraso** = horas que caen después de `meta.fin_desarrollo`; **fin estimado** = el último día con trabajo.
   Nada se comprime ni se esconde.

El generador escribe esas fechas en los ítems (las del plan se ignoran, con aviso) e imprime el resumen por
sprint y por persona del primer escenario y una línea por cada escenario más.

### La página

- **Vista general** (abre así): escenario, «Aplicar fechas del escenario» (solo el dueño: escribe las fechas
  calculadas en las subtareas sin clave de Jira y lo anota en el expediente), totales (propuestas, en espera,
  meta, fin estimado, atraso), un Gantt por persona con una barra por sprint (color por estado, raya roja si
  termina después de la meta, línea de meta y de entrega), la tabla por persona (capacidad hasta la meta,
  holgura o atraso), la tabla de sprints con su responsable editable y la de piezas compartidas.
- **Reasignar un sprint**: el selector de responsable de la tabla recalcula al instante. Quien ve la página
  puede simularlo; lo del dueño queda guardado en `escenario/actual` (con el escenario elegido) y anotado en
  el expediente. Cambiar de escenario borra las reasignaciones.
- **Vista de un sprint** («Ver» arriba o clic en una barra): la página de siempre con solo sus historias, sus
  fechas y la carga de su responsable; el filtro «Persona» deja las historias y la carga de esa persona. El
  responsable de cada subtarea dice «Del sprint (…)» salvo que tenga uno propio.
- **Exportar a Jira no cambia**: todos los sprints a la vez, cada subtarea bajo su historia; el responsable
  sale del escenario activo (o el propio de la subtarea).