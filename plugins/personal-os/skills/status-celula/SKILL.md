---
name: status-celula
description: Genera y publica el tablero de planeación de la célula (un Artifact compartido con el equipo) — Gantt por persona con carga diaria, Revisión 1 a 1, Backlog sin dueño, bloqueos y frentes, indicadores de Jira, colas del líder, macros, modo cliente, timesheets, pestaña privada del líder y bandeja — cruzando el estado del Personal OS con Jira en solo lectura y subiendo la foto de cada corrida a su base. Úsala cuando digan "/status-celula", "status de la célula", "tablero del equipo", "tablero de planeación", "cronograma del equipo", "hasta cuándo está ocupado cada uno", "quién tiene hueco esta semana", "prepara la mesa de líderes" o "actualiza el tablero compartido". No es el brief del día (brief-diario), ni planear un sprint o estimar historias (planear-sprint), ni registrar tus propias horas (timesheet). La skill nunca escribe en Jira.
---

# Skill — status-celula (tablero de planeación de la célula)

Genera y publica **el tablero de planeación con el que el usuario planea su célula y presenta su estado** en
la mesa de líderes (o ante quien coordine varios equipos). Es un Artifact con base compartida: el equipo lo
abre por su enlace y ve lo mismo. Tiene dos caras:

- **La mesa** — lo que necesita que alguien de fuera actúe. El filtro de la sección A es lo que más
  importa: se reporta lo que pide algo a otro líder o a la organización, no el detalle interno.
- **El cronograma** — el corazón de la herramienta: hasta cuándo tiene ocupación cada persona, dónde hay
  simultaneidad, qué está vencido y qué huecos quedan. Aquí **todo está a la vista** (C-1).

**Tres reglas que no se rompen:**

1. **La skill nunca escribe en Jira.** El tablero sí puede (crear, transicionar, comentar, reasignar), pero
   solo cuando quien lo usa lo pide en la página, con su propio conector y una confirmación por cambio. Los
   movimientos del Gantt son plan, no Jira: quedan en «Cambios del plan» hasta que alguien los lleve.
2. **Nada se inventa ni se filtra en silencio.** Lo que falte (estimación, issue, fecha, timesheet) se marca
   como hallazgo; lo que no entre lo dicen la cobertura del motor y el resumen del inventario.
3. **El tablero se comparte solo con quien el líder invita.** Lleva datos de clientes y del equipo. Lo del
   líder (pestañas Líder y Bandeja) va en la colección `privado`, que solo lee y escribe el dueño.
4. **El diseño del tablero no se toca a mano en la página publicada.** Vive en `tablero/plantilla.html` de
   esta carpeta; un cambio publicado a mano se pierde en la siguiente corrida. Todo lo de la célula y la
   empresa está en configuración (sección 0), nunca en la plantilla.

**Scripts** en `<raíz del plugin>/scripts/` (Node, sin dependencias, no consultan nada):
`status-celula.js` (motor: calcula y audita), `status-celula-inventario.js` (pendientes del Gantt),
`status-celula-tablero.js` (arma la página), `status-celula-config.js` (baja lo guardado en la pestaña
⚙ Configuración) y `status-celula-compartido.js` (lo que se sube a la base).
Detalle en `references/motor.md`. `<raíz del plugin>` es la ruta de la línea **«Scripts del plugin:»** del
contexto de la sesión; si no está, búscala donde Claude Code instaló `personal-os` y dila antes de usarla.
Para ver el tablero sin datos reales: `node "<raíz del plugin>/scripts/status-celula-tablero.js" --config
"${CLAUDE_SKILL_DIR}/tablero/ejemplo-celula.json" --organizacion "${CLAUDE_SKILL_DIR}/tablero/ejemplo-organizacion.json" --salida <html>`.

---

## Cuándo no se usa

- **El brief del día** (prioridades, correos, riesgos del líder): `brief-diario`. Este tablero toma su #1, no lo reemplaza.
- **Planear un sprint, estimar historias o armar subtareas**: `planear-sprint`. Aquí no se estima.
- **Registrar las horas propias**: `timesheet`. Aquí solo se audita el timesheet del equipo.

---

## 0 · CONFIGURACIÓN (nada de la empresa vive en esta skill)

| Dato | Dónde |
|---|---|
| Equipo (carriles) | `<stateDir>/config/fuentes.yaml` → `equipo[]` (`nombre`, `rol`, `account_id`, `correo`, `prestamo`, `produce_pr`, `prestado`) + fichas de `<stateDir>/personas/` con `estado: activo`. Los prestados entran igual: su carril dice «prestada a … desde …» y no cuentan en la capacidad de ese rango (`references/configuracion.md` §1-bis) |
| El líder | `owner` + `jira.mi_account_id`. Tiene carril propio y va **primero** |
| Proyectos y sitio de Jira | `jira.proyectos[]`, `jira.cloud_id`, `jira.sitio`. Se pasan al conector; nunca se adivinan |
| Estados que parecen cerrados | `jira.estados_que_parecen_cerrados` (`Redefinido` y compañía: no son cierres) |
| Festivos, zona y jornada | `~/.claude/personal-os/config.json` → `festivos`, `zonaHoraria`, `timesheet.jornada` (los lee el motor) |
| Todo lo propio del motor | Bloque `status_celula:` de `fuentes.yaml` (`references/configuracion.md`) |
| El tablero de planeación | `status_celula.tablero_compartido.url` (el Artifact) y `status_celula.tablero`: `celula` (JSON de la célula: carriles, Jira, festivos, jornada, SLA, clientes, textos; formato en `tablero/ejemplo-celula.json`; ahí van también `jira.sitio` para los enlaces a las issues, `roles.lider` y `roles.certifica` con el carril que revisa y el que certifica, `carriles_movil` con los carriles que se ven primero en el celular, y `org.palabras_comunes` con las palabras que no cuentan al agrupar), `organizacion` (nombre, pie y logo de la empresa: `tablero/ejemplo-organizacion.json`) y `extras` (opcional: lo prometido al cliente y los pendientes sin issue, formato en la cabecera de `status-celula-inventario.js`) y `motor` (opcional: `motor.json` junto a la célula, con los ajustes del motor que se cambian desde la página) |
| Lo guardado en la pestaña ⚙ Configuración | La base del tablero: `config/celula`, `config/organizacion`, `privado/config_extras`, `privado/config_motor`. **Manda sobre los archivos**: se baja en el paso 0 de la sección C |

Del bloque `status_celula:` la skill **copia al JSON de datos** `capacidad_factor` (0,8), `sla_revision` (2),
`sla_implementacion` (5), `limite_wip`, `estados`, `reparto`, `proyectos_propios` y `campo_inicio`; el motor
no lee `fuentes.yaml`. **Si existe `motor.json`, cada clave que traiga reemplaza a la de `status_celula:`**
(también `estados.no_cierre`, `externos`, `timesheets.remitentes`, `mesa`, `mesa_excluir` y
`tablero_compartido.personas_extra`/`excluir`): es lo que el líder cambió en la página. Si falta algo
obligatorio (equipo, proyectos o `cloud_id`), **se pregunta** con el modal de preguntas y se guarda. No se
inventa.

**Un líder nuevo no edita JSON a mano.** Si falta el JSON de la célula, se arma lo mínimo con lo que ya haya
en `fuentes.yaml` (`equipo[]`, `jira`) partiendo de `tablero/ejemplo-celula.json` y `ejemplo-organizacion.json`,
se publica el tablero y se le dice: «abre ⚙ Configuración, completa tu equipo, Jira, clientes, jornada y logo,
y dale Guardar; vuelve a pedir el status para que traiga Jira con eso». `status-celula-tablero.js` dice qué
campo falta si queda incompleto.

---

## A · QUÉ ENTRA A LA MESA Y QUÉ NO — el filtro

| ✅ Sí entra | ❌ No entra |
|---|---|
| Bloqueos de **cliente** (insumo que no llega, definición pendiente) | Bloqueos **técnicos** (un bug, una rama, un merge) |
| Bloqueos de **equipo** (cola de revisión, accesos, credenciales) | Detalle de implementación de una issue |
| **Solicitudes de recurso** (falta gente, alguien salió) | Quién hizo qué commit |
| **Requerimientos nuevos** que entran o hay que decidir | Discusiones de diseño interno |
| **Estado general de los frentes** | El seguimiento uno a uno de cada persona |
| Compromisos con fecha en riesgo | Lo que se resuelve dentro de la célula sin ayuda |

**La prueba:** *¿esto necesita que otro líder o la organización haga algo?* Si no, se queda en la
conversación interna. Ante la duda, no entra: un tablero contaminado con detalle técnico deja de servir.

- **Lo que el usuario ya sacó de la mesa no vuelve**: `status_celula.mesa_excluir` lista cada tema con su
  razón y dónde queda (p. ej. actas de gobierno del requerimiento que lleva la PMO, un riesgo aceptado, una
  fuente que dejó de existir). Se respeta sin volver a preguntarlo.
- **Antes de repetir un bloqueo de ayer, se verifica que siga.** Un bloqueo ya resuelto que vuelve a la mesa
  le quita credibilidad a todo lo demás. Lo resuelto va a «Ya resuelto», para no volver a discutirlo.
- **Un punto que no pide nada a la mesa no va en «Solicitudes de recurso»**, aunque sea buena noticia: va en
  el estado de los frentes.
- Lo que es conversación con una persona (su autocierre, el detalle de sus tareas) se le dice al usuario
  aparte, nunca en el tablero.
- **Cada bloqueo lleva `dias`**: desde cuándo está pedido y a quién. Un bloqueo sin antigüedad no presiona a
  nadie, y la antigüedad es justamente el argumento en una mesa de líderes.

---

## B · DE DÓNDE SALEN LOS DATOS

Todo se arma cruzando lo que el Personal OS ya sabe con Jira. **Nada se inventa; lo que falte se marca.**

| Sección | Fuente |
|---|---|
| Carriles | El líder primero + `equipo[]` + fichas activas de `personas/` |
| Items del cronograma | Jira (**solo lectura**): issues del equipo y del líder, abiertas o terminadas desde el día 1 del mes |
| Colas del líder | Las calcula el motor: todo lo de cada persona en revisión o «listo para implementación», **con o sin fecha** |
| Sin programar | Issues sin fecha de vencimiento + lo que las fichas marquen pendiente |
| Pestaña Líder | `tablero.md` (la #1 y la fecha del brief), `compromisos/`, `riesgos/`, `alcances/` y las issues propias |
| Bloqueos de cliente | `compromisos/` con `direccion: esperado_de_tercero` + bloqueos declarados en `alcances/` |
| Bloqueos de equipo | `riesgos/` abiertos de nivel 2–3 que dependan de la organización |
| Recursos | Riesgos de capacidad y compromisos de petición de recurso |
| Requerimientos | Issues creadas en las últimas 24–48 h + lo declarado en la bitácora |
| Estado de frentes | Fichas de personas + alcances con su `verificado_el` |
| Status Jira | Todo lo abierto de `jira.proyectos`, **tenga o no responsable**, con comentarios |
| Frentes y backups | La tabla del acuerdo de equipo (`status_celula.acuerdo_frentes_fuente`), leída en vivo |
| Timesheets | Correo del equipo (sección G) |

### Lectura de Jira (conector de Atlassian, SOLO LECTURA, `cloudId` = `jira.cloud_id`, paginado hasta el final)

1. **El equipo y el líder:** `assignee in (<account_ids>) AND (statusCategory != Done OR statusCategoryChangedDate >= startOfMonth())`, con `comment`, `timespent` y el campo de inicio.
2. **Las colas, sin límite de fecha:** `assignee in (<account_ids>) AND status in (<revisión e implementación>)`.
3. **Status Jira:** `project in (<claves>) AND statusCategory != Done` (incluye las sin responsable).

Campos: `summary, status, assignee, duedate, timeoriginalestimate, timespent, updated, created, project,
issuetype, parent, comment` y `campo_inicio`. Los volcados se guardan y se normalizan con
`status-celula-jira.js` (segundos → horas, comentarios ADF → texto, ámbito célula / externo / sin responsable).
El historial de cambios solo llega issue por issue (`expand=changelog`): pedirlo para todo satura el
conector; se pide solo para lo que se vaya a discutir y la ficha enlaza a Jira.

**El roster se cruza por `account_id`, no por nombre.** El `jira` de cada persona es el **displayName exacto**
que trajo la lectura: si se escribe a mano y no coincide —una tilde basta—, esa persona desaparece de su
propia célula sin avisar. El motor lo audita.

---

## C · CÓMO SE GENERA

0. **Bajar la configuración guardada en la página** (si ya hay tablero publicado): `ArtifactData` `list` de
   `config` y `privado` y `status-celula-config.js --aplicar` (`references/tablero-compartido.md` §2-bis).
   Todo lo que sigue usa los archivos ya sincronizados; si el script sale con 1, no se regenera.
1. **Leer el estado** (personas, riesgos, compromisos, alcances, `tablero.md`) y el acuerdo de equipo.
2. **Leer Jira en SOLO LECTURA** (sección B) y normalizar con `status-celula-jira.js`.
3. **Aplicar el filtro de la sección A** a la mesa. Lo técnico se descarta aquí, no después. El cronograma
   NO se filtra (C-1).
4. **Timesheets del equipo** (sección G). Si el usuario los usa, un tablero sin esa pestaña no sale sin
   decirlo en la entrega.
5. **Escribir el JSON** en `status_celula.carpeta_datos` (por defecto `<stateDir>/_datos/status-celula/`)
   como `datos-<fecha>.json`. Formato en la cabecera de `status-celula.js` (motor); `ejemplo.json` es un caso
   completo ficticio. El formato del motor anterior se acepta tal cual (se convierte solo).
6. **Auditar con el motor, con la carga de la semana:**
   `node "<raíz del plugin>/scripts/status-celula.js" "<datos.json>" --carga 5`
   Imprime la **cobertura**: si dice que algo se pierde, se corrige antes de publicar o se dice en la entrega.
7. **Inventario del Gantt:** `node "<raíz del plugin>/scripts/status-celula-inventario.js" --datos "<datos.json>"
   --config "<celula>" [--extras "<extras>"] --salida "<carpeta_datos>/inventario-<fecha>.json"`. Imprime qué
   quedó fuera y por qué; «persona sin carril» es normal (gente de fuera: sale en Indicadores de Jira).
8. **Armar la página:** `node "<raíz del plugin>/scripts/status-celula-tablero.js" --config "<celula>"
   --organizacion "<organizacion>" --inventario "<inventario>" [--extras "<extras>"] [--motor "<motor>"]
   --salida "<carpeta_datos>/tablero-<fecha>.html"` (extras y motor solo los precarga la pestaña ⚙ Configuración).
   Si sale con error, dice qué falta en la configuración: se completa con el usuario, no se inventa.
9. **Guardar la actividad del timesheet en las fichas**:
   `node "<raíz del plugin>/scripts/status-celula-fichas.js" "<datos.json>"` (sin duplicar; pasa por el
   guardarraíl de datos de personas).
10. **Subir los datos y publicar la página** (sección H) y entregar (sección E) con el enlace del tablero.

### C-1 · Todo a la vista: nada se filtra en silencio

Un tablero que deja fuera lo cerrado, lo pausado, lo viejo o al propio líder **miente por omisión**:

- **El líder tiene carril propio, el primero.** Lleva sus issues, sus compromisos con fecha y **dos colas
  por persona**, que son trabajo del líder aunque la issue sea de otro:
  - **Revisar a X**: todo lo de X en revisión. **Marca corta que termina hoy**, con «↤ desde dd/mm» de la
    entrega más vieja; al hacer clic, la lista con la espera de cada una. Atrasada si pasa de `sla_revision`
    días hábiles. Lo que el líder mismo entrega a revisión no es su cola.
  - **Publicar a X**: todo lo de X «listo para implementación», **sin límite de fecha**. Atrasada si pasa de
    `sla_implementacion`. La certificación del PO/QA es de otra persona: no entra a la cola del líder.
  - Sin historial de cambios, la entrada a la cola es la última actualización. El tablero lo declara.
- **Lo terminado se queda como traza**, atenuado, en su fecha real de cierre y marcado si cerró tarde.
  «Listo para implementación» y `Redefinido` se pintan aparte, **nunca como cierre**. Las cifras de riesgo de
  la cabecera se cuentan solo sobre lo pendiente.
- **Pausado entra**, gris y punteado; si ya venció, sigue contando en rojo. **Lo vencido antes de la ventana
  entra** en una sola marca por persona («N vencidas antes del dd/mm»). Lo sin fecha va a «Sin programar».
- **Ninguna regla oculta issues de alguien con carril**, y se audita: el motor compara lo que vino de Jira con
  lo que quedó en el tablero y avisa qué se pierde (en la terminal y arriba del tablero).
- **Si una afirmación del tablero contradice al brief del mismo día, gana la verificación más reciente** y
  se corrige el texto; no se deja convivir.

### C-2 · Jira manda, y regenerar es por delta

Cada actualización refresca de Jira el responsable, la estimación, las fechas y el estado. Lo que se movió
en el tablero es una **propuesta**: si no se aplicó en Jira, vuelve a salir donde Jira diga.
**Para regenerar el mismo día no se vuelve a leer todo**: se pide solo `updated >= "<hora de la última
lectura>"` y se pasa con `--delta`, en orden. Mezclar dos lecturas completas de horas distintas duplica
issues (la misma sale abierta y cerrada a la vez).

### C-3 · Días hábiles, reuniones y transversales

- Todo se cuenta en **días hábiles**: la jornada de `config.json` menos los `festivos`. **Si no hay festivos
  cargados, se le dice al usuario**: un festivo sin cargar es un día de capacidad que no existe.
- **Una reunión en Jira se estima con su duración agendada** (`tipo: "reunion"`); lo que duró va al timesheet.
- **Lo de otro proyecto (transversal)** se muestra con su nombre y etiqueta. «Mostrar transversales» las
  resume por proyecto cuando estorban; nunca las oculta y la carga las cuenta igual.

### C-4 · El tiempo y el veredicto: la fecha manda, no el reloj

Cada item lleva `horas` (estimado de Jira) y `trabajado` (lo registrado); la barra pinta el consumo.
**Sin estimación no se calcula porcentaje** (*«sin estimación: no se puede evaluar si va bien»*).
`trabajado: 0` significa «no registró nada»; si no se pudo traer, se omite.

| Veredicto | Cuándo |
|---|---|
| 🔴 Vencida hace N días | `fin` < hoy. Mover la fecha con razón escrita o cerrarla |
| 🔴 No alcanza | restante > capacidad efectiva hasta `fin` (sin los días en que la persona está prestada). Otra fecha, otra persona o repartirla |
| 🟠 Al filo | restante > 85 % de la capacidad |
| ⚪ Sin estimación | no hay `horas`: es lo primero que hay que resolver |
| 🟢 Va en tiempo / Cerrada | el resto |

**La capacidad no es la jornada completa:** `capacidad_factor` (0,8) porque hay reuniones, revisiones,
soporte e interrupciones. Se muestra en la cabecera para que el supuesto se pueda discutir.

### C-5 · La carga diaria: ¿le caben más cosas o menos?

Debajo de cada carril, una tira con las **horas ASIGNADAS** de cada día hábil desde hoy (no las libres; lo que
le cabe sale al pasar el cursor) y `hoy X/Y h` en la cabecera. `--carga N` la imprime en texto.

| Regla | Por qué |
|---|---|
| Contra la jornada completa del día, sin el factor | Es la jornada contra la que se asigna |
| Solo trabajo ejecutable: fuera lo terminado, las colas, los compromisos y lo pausado | Lo cerrado ya no ocupa a nadie |
| En revisión o certificación con fecha de HOY cuenta hoy (la parte que le tocaba); desde mañana no | Fue el trabajo del día |
| Lo que queda (estimado − trabajado) se reparte de hoy al vencimiento | Los días pasados ya se fueron |
| Lo vencido y abierto se suma entero a HOY | Sigue pendiente y es lo que llena el día |
| Sin estimación no suma, pero la celda lleva «+» | La carga real es mayor que la que se ve |
| Ámbar < 85 % · verde 85–105 % · rojo > 105 % · punteado = nada; se recalcula al arrastrar | Se lee sin clic y sirve para decidir antes de proponer |

### C-6 · Las horas no las pone Claude, y el accountId tampoco se adivina

**La estimación la pone el usuario o quien hace el trabajo.** Donde falte, queda vacía y marcada. Si el
usuario pide una cifra, va apretada (personas que trabajan con IA de copiloto) y la decide él. Cuando el
tablero termina en escrituras aprobadas, el `accountId` **se saca del displayName exacto de una lectura
reciente** (o de `equipo[].account_id`), nunca de memoria: uno equivocado deja la issue a nombre de otro.

### C-7 · Reglas al armar el JSON

- Sin estimación: `"horas": 0` y se dice en la `nota`. Sin issue: `"estado": "Sin issue"`; es el hallazgo.
- La ventana arranca **el día 1 del mes** y llega a 8 semanas; lo anterior entra anclado con su fecha real.
- Si una sección de la mesa queda vacía, **se deja vacía**: el tablero escribe «Nada que reportar hoy».
- Sin datos de salud, credenciales ni observaciones personales: una ausencia se escribe «ausente».

---

## D · QUÉ HACE EL TABLERO

| Vista | Qué hace | Escribe en |
|---|---|---|
| Gantt | Carriles por persona, arrastrar y soltar, editor, carga del día y ocupación de hoy, reuniones de Teams | `plan`; Jira solo con confirmación |
| Revisión 1 a 1 | Lo abierto de una persona en los proyectos configurados; indicadores que filtran; ficha con «Llevar hasta» | Jira, con confirmación |
| Backlog sin dueño | Lo sin asignar, con sugerencia de la IA (responsable, prioridad, talla) | `sugerencias`, `backlog`; Jira con confirmación |
| Bloqueos y frentes | La mesa (sección A) | — |
| Indicadores de Jira | Las nueve columnas por proyecto, célula, analistas, externos y sin responsable | — |
| Colas | Revisar, Certificar y Publicar con su SLA | — |
| Macros y seguimiento | Proyectos macro y los cronogramas de `planear-sprint` | — |
| Modo cliente | Ocupación por proyecto macro, simulador de prioridad y borrador de correo | Solo el navegador |
| Timesheets | Envío diario, % con issue y horas «sin tarea» | — |
| Frentes | Titular y backup; los cambios quedan como propuesta para la reunión de equipo | `propuestas` (dueño) |
| Líder · Bandeja | La #1, compromisos, riesgos y alcances; tarjetas de decisión | `privado` (solo el dueño) |
| ⚙ Configuración | Solo el dueño: página y logo, equipo (con búsqueda del accountId en Jira), Jira, clientes, jornada, festivos, SLA, pestañas, asistente, sprint, motor y extras; valida con las mismas reglas que el armador | `config` (célula y organización: se aplican al guardar) y `privado` (extras y motor: al regenerar) |

Los movimientos del Gantt son **plan**, no Jira: «Cambios del plan» los lista y «Actualizar Jira y
calendario» trae la foto en vivo con el conector de quien pulsa (la más reciente gana).

---

## E · CÓMO SE PRESENTA

Al entregarlo, **tres frases, no un recorrido por el tablero**:

1. **Lo que necesito de esta mesa hoy** (bloqueos de cliente y recursos, con sus días).
2. **Lo que está en riesgo y por qué.**
3. **Lo que ya está resuelto**, para que no se vuelva a discutir.

Aparte, para el usuario y **no para la mesa**: la **carga** (quién tiene hueco hoy y esta semana y quién se
pasa, de `--carga`), la **cobertura** (lo que el motor dijo que se pierde) y los **timesheets** (quién no
envió, el % con issue de cada uno, qué hizo cada quien ayer en una línea y las horas «sin tarea»).
El cronograma es el respaldo cuando alguien pregunte *«¿y eso cuándo?»*. No es el guion.

---

## F · STATUS JIRA Y FRENTES

**Status Jira** mide con nueve columnas **calculadas por el motor desde las issues crudas** (el tablero no puede
contradecir a Jira): abiertas · con responsable · **sin responsable** · en desarrollo · en revisión · sin
movimiento en 30 días · vencidas · sin estimación · sin fecha. Tablas: **tus proyectos** (todo lo abierto,
tenga o no responsable), **la célula** (todas las issues de cada persona, en el proyecto que sea), y —siempre
separados y marcados— **los de fuera** que cargan tus proyectos y **la bolsa sin responsable**. Esa marca es
la diferencia entre lo que el usuario dirige y lo que solo le preguntan. Clic en una fila → sus issues
ordenadas por lo que arde; clic en una issue → su **ficha**: veredicto, inicio y vencimiento, tiempo,
comentarios, historial y dos propuestas (estado, comentario) que van a «Cambios propuestos». Con `limite_wip`
marca a quien lo supere.

**Frentes** muestra titular y backup (con cliente) y avisa si alguien se sale del `reparto`; el líder queda
fuera de la cuenta porque es escalamiento. Mover una titularidad sale como **propuesta para la reunión de
equipo**, con fecha y por escrito, nunca como hecho consumado.

---

## G · TIMESHEETS DEL EQUIPO

Si el equipo envía su timesheet por correo, el tablero sigue **que se envíe a diario, qué % de sus horas
cuelga de una issue y qué hizo cada quien**. Se mide la hora trazable, no la escrita. Lo esencial (detalle en
`references/timesheets.md`): se busca **por remitente, nunca por asunto**, en solo lectura; un archivo que no
se pudo abrir va con `"leido": false` y **nunca** se deja en rojo callando que no se leyó; las filas pasan tal
como están; **un día sale del envío más reciente que lo traiga** (lo hace el motor). No se le reclama a nadie,
no se corrigen horas ni se rellenan días. Las horas «en espera» o «sin tarea» son el hallazgo más importante:
dicen que falta plan, no que alguien no trabajó.

---

## H · PUBLICAR EL TABLERO

1. **Datos:** cada corrida sube su foto con `status-celula-compartido.js` y **una sola** llamada `ArtifactData`
   `batch`: la foto de Jira solo si es más reciente que la que el tablero ya tiene, con `if_version` en cada
   documento y la pestaña del líder solo para el dueño.
2. **Página:** se publica el HTML del paso 8 con la herramienta Artifact al `url` configurado, **sin pasar
   `capabilities`** (así conserva las que tiene: base con sus reglas, conectores de Jira y Microsoft 365,
   `sample`, `user`). Antes se lee la versión publicada; si alguien la cambió a mano, se le dice al usuario
   qué cambió y se lleva a la plantilla antes de publicar encima (regla 4). Si su declaración guardada no
   trae la regla de `config`, esa vez se publica con las capacidades completas (`tablero-compartido.md` §4).
3. **Primera vez** (sin `url`): se publica sin `url` y con las capacidades de `references/tablero-compartido.md`
   §4, se guarda el enlace en `status_celula.tablero_compartido.url` y se le recuerda al usuario compartirlo.

Procedimiento, reglas de acceso y capacidades en `references/tablero-compartido.md`.

---

## I · MANTENIMIENTO

- **El diseño vive en `tablero/plantilla.html`** (CSS, vistas e interacción). Lo de la célula entra por
  `__CONFIG__`, lo de la empresa por `__ORG_*__` y lo que solo precarga la pestaña ⚙ Configuración por
  `__AJUSTES__`; si un texto nuevo nombra a una persona, un proyecto o la empresa, se lee de la configuración,
  nunca se escribe en la plantilla. La aplicación arranca desde `window.__ARRANCAR` cuando el arranque del
  final resolvió la configuración (la de la base si la hay; si no, la incrustada).
- **Un campo nuevo de configuración** se agrega en tres lugares: el formulario de `renderConfig`, `cfValidar`
  (si es obligatorio, con la misma regla que `status-celula-tablero.js`) y `references/configuracion.md`.
- Si aparece un frente nuevo, **se agrega primero a `personas/_dominios.md`** (o a los datos); el tablero no
  inventa frentes. Si una persona no tiene carril, el motor lo dice en la cobertura.
- **Después de tocar la plantilla, se prueba** con `tablero/prueba-igualdad.js` (necesita jsdom: ver
  `references/motor.md`): `node prueba-igualdad.js <publicada.html> <generada.html> [<carpeta con la base>]`
  abre cada vista en las dos y compara lo que pintan; un cambio de diseño a propósito se revisa a ojo en la
  vista afectada, o se aparta con `--ignorar "<selector>,…"` para probar que todo lo demás pinta igual. Con `ejemplo-celula.json` comprueba también que arranca sin errores para otra célula.
