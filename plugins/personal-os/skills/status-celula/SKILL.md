---
name: status-celula
description: Genera el tablero de estado de la célula con cronograma (Gantt) de ocupación — carriles por persona con el líder primero, colas de revisión e implementación, traza de lo terminado, carga diaria contra la jornada, veredicto por fecha, Status Jira, frentes y timesheets del equipo — cruzando el estado del Personal OS con Jira en solo lectura. Úsala cuando digan "/status-celula", "status de la célula", "tablero del equipo", "cronograma del equipo", "hasta cuándo está ocupado cada uno", "prepara la mesa de líderes" o pidan ver la ocupación del equipo. Sale como HTML local y privado; no escribe en Jira.
---

# Skill — status-celula (tablero de estado de la célula)

Genera **el tablero interactivo con el que el usuario presenta el estado de su célula** en la mesa de
líderes (o ante quien coordine varios equipos). Tiene dos caras:

- **La mesa** — lo que necesita que alguien de fuera actúe. El filtro de la sección A es lo que más
  importa: se reporta lo que pide algo a otro líder o a la organización, no el detalle interno.
- **El cronograma** — el corazón de la herramienta: hasta cuándo tiene ocupación cada persona, dónde hay
  simultaneidad, qué está vencido y qué huecos quedan. Aquí **todo está a la vista** (sección C-1).

**Salida:** `<stateDir>/status-celula-<fecha>.html`, un archivo local y **privado** (lleva datos de
clientes y del equipo). **No se publica como Artifact** ni se sube a ningún servicio, salvo que el
usuario lo pida expresamente para ese tablero.

**Motor:** `scripts/status-celula.js` (calcula y maqueta; no consulta nada) + `plantilla.html` y
`ejemplo.json` de esta carpeta. Para ver cómo se ve sin datos reales:

```bash
node "<raíz del plugin>/scripts/status-celula.js" --ejemplo --salida "<stateDir>/status-celula-ejemplo.html"
```

`<raíz del plugin>` es la ruta que aparece en el contexto de la sesión en la línea **«Scripts del
plugin:»** que inyecta el hook de arranque. Si no está, búscala donde Claude Code instaló el plugin
`personal-os` y dila en voz alta antes de usarla.

---

## 0 · DE DÓNDE SALE LA CONFIGURACIÓN (nada de la empresa vive en esta skill)

| Dato | Dónde | Notas |
|---|---|---|
| Equipo (carriles) | `<stateDir>/config/fuentes.yaml` → `equipo[]` (`nombre`, `rol`, `account_id`, `capacidad_horas_dia`) + fichas de `estado/personas/` con `estado: activo` | Los prestados entran igual, con su `prestamo` |
| El líder | `owner` + `jira.mi_account_id` de `fuentes.yaml` | Tiene carril propio y va **primero** |
| Proyectos de Jira | `jira.proyectos[]` (`clave`, `cliente`) | Los «propios» del tablero. Lo demás es **transversal** |
| Sitio de Jira | `jira.cloud_id`, `jira.sitio` | Se pasan al conector de Atlassian; nunca se adivinan |
| Estados que parecen cerrados | `jira.estados_que_parecen_cerrados` | `Redefinido` y compañía: no son cierres |
| Festivos y zona horaria | `~/.claude/personal-os/config.json` → `festivos`, `zonaHoraria` | El script los lee solo. Sin festivos configurados, el tablero lo avisa en la cabecera |
| Jornada por día | `config.json` → `timesheet.jornada` (`lun`…`dom`) | Contra ella se mide la carga diaria |

**Opcionales** (si el usuario los agrega a `fuentes.yaml` en un bloque `status_celula:`; si no, valen
los valores por defecto del script): `capacidad_factor` (0,8), `sla_revision` (2 días hábiles),
`sla_implementacion` (5), `limite_wip` (ninguno), `estados` (nombres de estado de SU Jira para
revisión, implementación, pausa y desarrollo), `reparto` de frentes (p. ej. 2 titular / 2 backup) y
`campo_inicio` (el campo personalizado de fecha de inicio de su instancia).
El script no lee `fuentes.yaml`: la skill **copia estos valores al JSON** de datos (mismos nombres;
`estados` lleva las listas `revision`, `implementacion`, `pausa`, `desarrollo` y `no_cierre`, esta última
desde `jira.estados_que_parecen_cerrados`).

Si falta algo obligatorio (equipo, proyectos o `cloud_id`), **se pregunta** con el modal de preguntas
antes de seguir. No se inventa.

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

- **Antes de repetir un bloqueo de ayer, se verifica que siga.** Un bloqueo ya resuelto que vuelve a la
  mesa le quita credibilidad a todo lo demás. Lo resuelto va a «Ya resuelto», para no volver a discutirlo.
- **Un punto que no pide nada a la mesa no va en «Solicitudes de recurso»**, aunque sea buena noticia.
  Va en el estado de los frentes.
- Lo que es conversación con una persona (su autocierre, el detalle de sus tareas) se le dice al usuario
  aparte, nunca en el tablero.
- **Cada bloqueo lleva `dias`**: desde cuándo está pedido y a quién. Un bloqueo sin antigüedad no
  presiona a nadie, y la antigüedad es justamente el argumento en una mesa de líderes.

---

## B · DE DÓNDE SALEN LOS DATOS

Todo se arma cruzando lo que el Personal OS ya sabe con Jira. **Nada se inventa; lo que falte se marca.**

| Sección | Fuente |
|---|---|
| Carriles | El líder primero + `equipo[]` + fichas activas de `personas/` |
| Items del cronograma | Jira (**solo lectura**): issues del equipo y del líder, abiertas o terminadas desde el día 1 del mes |
| Colas del líder | Las calcula el script: lo que esté en estados de revisión o «listo para implementación» |
| Sin programar | Issues sin fecha de vencimiento + lo que las fichas marquen pendiente |
| Pestaña Líder | `tablero.md` (la #1 y la fecha del brief), `compromisos/`, `riesgos/`, `alcances/` |
| Bloqueos de cliente | `compromisos/` con `direccion: esperado_de_tercero` + bloqueos declarados en `alcances/` |
| Bloqueos de equipo | `riesgos/` abiertos de nivel 2–3 que dependan de la organización |
| Recursos | Riesgos de capacidad y compromisos de petición de recurso |
| Requerimientos | Issues creadas en las últimas 24–48 h + lo declarado en la bitácora |
| Estado de frentes | Fichas de personas + alcances con su `verificado_el` |
| Status Jira | Todo lo abierto de `jira.proyectos`, **tenga o no responsable** |
| Timesheets | Correo del equipo (opcional, sección G) |

### Lectura de Jira (conector de Atlassian, SOLO LECTURA)

Con `cloudId` = `jira.cloud_id`. Tres lecturas, paginadas hasta el final:

1. **El equipo y el líder:** `assignee in (<account_ids>) AND (statusCategory != Done OR statusCategoryChangedDate >= startOfMonth())`.
2. **Las colas, sin límite de fecha:** `assignee in (<account_ids>) AND status in (<estados de revisión e implementación>)`.
3. **Status Jira:** `project in (<claves de jira.proyectos>) AND statusCategory != Done` (incluye las sin responsable).

Campos: `summary, status, assignee, duedate, timeoriginalestimate, timespent, updated, project` y el
campo de fecha de inicio de la instancia (`campo_inicio`). Los tiempos de Jira vienen en segundos: se
pasan a horas.

**El roster se cruza por `account_id`, no por nombre.** El `jira` de cada persona en el JSON es el
**displayName exacto** que trajo la lectura para su `account_id`: si se escribe a mano y no coincide
—una tilde basta—, esa persona desaparece de su propia célula sin avisar. El script lo audita.

---

## C · CÓMO SE GENERA

1. **Leer el estado** (personas, riesgos, compromisos, alcances, `tablero.md`).
2. **Leer Jira en SOLO LECTURA** (sección B).
3. **Aplicar el filtro de la sección A** a la mesa. Lo técnico se descarta aquí, no después. El
   cronograma NO se filtra (C-1).
4. **Timesheets del equipo**, si el usuario los usa (sección G).
5. **Escribir el JSON** en `<stateDir>/_datos/status-celula/datos-<fecha>.json`. El formato completo
   está en la cabecera de `scripts/status-celula.js`; `ejemplo.json` es un caso completo con datos ficticios.
6. **Generar:**

   ```bash
   node "<raíz del plugin>/scripts/status-celula.js" "<stateDir>/_datos/status-celula/datos-<fecha>.json"
   ```

   Sale en `<stateDir>/status-celula-<fecha>.html`. El script imprime la **cobertura**: si dice que algo
   se pierde, se corrige antes de entregar o se dice en la entrega.
7. **Abrir el HTML** en el navegador del usuario (archivo local) y entregar (sección E).

### C-1 · Todo a la vista: nada se filtra en silencio

Un tablero que deja fuera lo cerrado, lo pausado, lo viejo o al propio líder **miente por omisión**.
Por eso:

- **El líder tiene carril propio, el primero.** Lleva sus issues, sus compromisos con fecha y **dos colas
  por persona**, que son trabajo del líder aunque la issue sea de otro:
  - **Revisar a X**: todo lo de X en estados de revisión. Se pinta como **marca corta que termina hoy**,
    con «↤ desde dd/mm» de la entrega más vieja; al hacer clic sale la lista. Está atrasada si pasa de
    `sla_revision` días hábiles.
  - **Publicar a X**: todo lo de X «listo para implementación», **sin límite de fecha**. Atrasada si pasa
    de `sla_implementacion`.
  - Sin historial de cambios, la entrada a la cola es la última actualización de la issue. El tablero lo declara.
- **Lo terminado se queda como traza**: todo lo cerrado desde el día 1 del mes, atenuado, en su fecha real
  de cierre y marcado si cerró tarde. «Listo para implementación» y `Redefinido` se pintan aparte, **nunca
  como cierre**. Las cifras de riesgo de la cabecera se cuentan solo sobre lo pendiente.
- **Pausado entra**, gris y punteado. **Lo vencido antes de la ventana entra**, en una sola marca por
  persona («N vencidas antes del dd/mm») con la lista al hacer clic. Lo sin fecha va a «Sin programar».
- **Ninguna regla oculta issues de alguien con carril**: no hay filtros por persona en la lectura ni en el
  armado. Y se audita: el script compara lo que vino de Jira con lo que quedó en el tablero y **avisa qué
  se pierde** (issues abiertas de alguien con carril que no están, items de alguien sin carril, displayName
  que no cuadra). El aviso sale en la terminal y arriba del tablero.
- **Si una afirmación del tablero contradice al brief del mismo día, gana la verificación más reciente** y
  se corrige el texto; no se deja convivir.

### C-2 · Jira manda

**Cada actualización refresca de Jira el responsable, la estimación, las fechas y el estado** de cada
item. Lo que se movió en el tablero es una **propuesta**, no un dato: si no se aplicó en Jira, en la
siguiente generación vuelve a salir donde Jira diga. Nada del tablero anterior se arrastra por encima de
la lectura nueva.

**Regenerar en el mismo día: por delta, nunca mezclando lecturas.** Para refrescar se pide solo
`updated >= "<hora de la última lectura>"` y se aplica encima, en orden. Mezclar dos lecturas completas de
horas distintas duplica issues (la misma sale abierta y cerrada a la vez).

### C-3 · Días hábiles y festivos

Todo se cuenta en **días hábiles**: la jornada de `config.json` (los días con 0 horas no se trabajan) menos
los `festivos` configurados. El script los inyecta en el tablero: el fin de semana y el festivo se pintan
como no hábiles, parten las barras y todo arrastre aterriza en día hábil. **Si el usuario no ha cargado los
festivos de su país, se le dice**: un festivo sin cargar es un día de capacidad que no existe.

### C-4 · Reuniones y transversales

- **Una reunión en Jira se estima con su duración agendada.** Va con `tipo: "reunion"`, en su día, y suma a
  la carga como cualquier trabajo. Lo que realmente duró va al timesheet, no a la estimación.
- **Las issues de otro proyecto (transversales) se muestran con su nombre**, con una etiqueta del proyecto.
  El interruptor «Mostrar transversales» las **resume** en una barra por proyecto cuando estorban; nunca las
  oculta, y la carga diaria las cuenta igual.

### C-5 · El tiempo: estimado contra trabajado, y la fecha manda

Cada item lleva `horas` (estimado de Jira) y `trabajado` (lo registrado). La barra pinta el consumo; la
ficha lo compara.

- **Sin estimación no se calcula porcentaje.** Se muestra lo trabajado y se dice *«sin estimación: no se
  puede evaluar si va bien»*. Un porcentaje sobre una base inventada miente.
- **`trabajado: 0` significa «no ha registrado nada»**, distinto de no saberlo: si no se pudo traer, se omite.

**El veredicto cruza horas restantes contra capacidad hasta la fecha** — el tiempo trabajado solo no dice
si algo va bien:

| Veredicto | Cuándo |
|---|---|
| 🔴 Vencida hace N días | `fin` < hoy. Mover la fecha con razón escrita o cerrarla |
| 🔴 No alcanza | restante > capacidad efectiva hasta `fin`. Otra fecha, otra persona o repartirla |
| 🟠 Al filo | restante > 85 % de la capacidad |
| ⚪ Sin estimación | no hay `horas`: es lo primero que hay que resolver |
| 🟢 Va en tiempo / Cerrada | el resto |

**La capacidad no es la jornada completa:** se aplica `capacidad_factor` (0,8 por defecto) porque hay
reuniones, revisiones, soporte e interrupciones. El factor se muestra en la cabecera para que el supuesto
esté a la vista y se pueda discutir.

### C-6 · La carga diaria: ¿le caben más cosas o menos?

Cada carril lleva, debajo de sus barras, una tira con las **horas ASIGNADAS** de cada día hábil desde hoy
(no las libres; lo que le cabe sale al pasar el cursor), y la cabecera del carril dice `hoy X/Y h`.

| Regla | Por qué |
|---|---|
| Se mide contra la jornada completa del día, sin el factor | Es la jornada contra la que se asigna; el factor manda en el veredicto |
| Cuenta solo trabajo ejecutable: fuera lo terminado, las colas, los compromisos y lo pausado | Lo cerrado ya no ocupa el día de nadie |
| Lo que está en revisión con fecha de HOY cuenta hoy (la parte que le tocaba); desde mañana no | Fue el trabajo del día |
| Lo que queda (estimado − trabajado) se reparte entre los días hábiles de hoy al vencimiento | Los días pasados ya se fueron |
| Lo vencido y abierto se suma entero a HOY | Sigue pendiente y es lo que llena el día |
| Un item sin estimación no suma horas, pero la celda lleva «+» | La carga real es mayor que la que se ve |
| Colores: ámbar < 85 % (le caben más) · verde 85–105 % · rojo > 105 % · punteado = nada | Se lee sin hacer clic |
| Se recalcula al arrastrar | Es la herramienta para decidir antes de proponer |

### C-7 · Las horas no las pone Claude

Ni en el tablero ni en un borrador de issue: **la estimación la pone el usuario o la persona que hace el
trabajo.** Donde falte, queda vacía y marcada. Si el usuario pide una cifra, va apretada (personas que
trabajan con IA de copiloto) y la decide él.

### C-8 · Reglas al armar el JSON

- Un item sin estimación va con `"horas": 0` y se dice en la `nota`. No se rellena.
- Un item sin issue de Jira lleva `"estado": "Sin issue"` y su nota dice que hay que crearla: es el hallazgo.
- La ventana arranca **el día 1 del mes** (para ver la traza) y llega a 8 semanas; lo anterior entra anclado.
- Si una sección de la mesa queda vacía, **se deja vacía**: el tablero escribe «Nada que reportar hoy».
- Sin datos de salud, credenciales ni observaciones personales: una ausencia se escribe «ausente».

---

## D · QUÉ HACE EL TABLERO (y qué NO hace)

Se toca con el ratón (o el dedo):

- **Arrastrar una barra** → mueve sus fechas conservando sus días hábiles. **Su borde derecho** → la alarga
  o acorta. **A otro carril** → la reasigna.
- **Desde «Sin programar»** (arrastrando o con clic) → le pone fecha y responsable.
- **Resaltar huecos** → pinta los días hábiles vacíos de cada persona. Un día hábil vacío es una pregunta
  —*¿qué va aquí?*—, no un descanso: el objetivo es planear el futuro del equipo, no mirar el presente.
- **Solo vencidas**, **Ocultar terminadas**, **Mostrar transversales**, **Compacto / Normal / Amplio**, y
  **▾ / ▸** para minimizar un carril (se recuerda en el navegador).
- **Pestañas:** Cronograma · Mesa · Líder · Status Jira · Frentes · Timesheets.
- Cada cambio se acumula en **«Cambios propuestos»**; **«Copiar para Jira»** los pasa al portapapeles.

> ### El tablero NO escribe en Jira.
> Nunca. Produce una lista de cambios que el usuario revisa y aplica, o que se aplican en sesión con su
> confirmación explícita, uno por uno. **Antes de asignar**, el `accountId` se saca del displayName exacto
> de una lectura reciente (o de `equipo[].account_id`), nunca de memoria: un accountId equivocado deja la
> issue a nombre de otra persona.

---

## E · CÓMO SE PRESENTA

Al entregarlo, **tres frases, no un recorrido por el tablero**:

1. **Lo que necesito de esta mesa hoy** (bloqueos de cliente y recursos, con sus días).
2. **Lo que está en riesgo y por qué.**
3. **Lo que ya está resuelto**, para que no se vuelva a discutir.

Aparte, para el usuario y **no para la mesa**:

- **La carga**: quién tiene hueco hoy y esta semana, y quién se pasa de su jornada.
- **La cobertura**: lo que el script dijo que se pierde o no cuadra, si quedó algo.
- **Timesheets** (si aplica): quién no envió, el % de horas con issue de cada uno y las horas «sin tarea».

El cronograma es el respaldo cuando alguien pregunte *«¿y eso cuándo?»* o *«¿hasta cuándo está ocupado
fulano?»*. No es el guion.

---

## F · STATUS JIRA Y FRENTES

**Status Jira** mide con nueve columnas, **calculadas por el script desde las issues crudas** (así el
tablero no puede contradecir a Jira): abiertas · con responsable · **sin responsable** · en desarrollo · en
revisión · sin movimiento en 30 días · vencidas · sin estimación · sin fecha. Dos tablas:

1. **Proyectos** (`jira.proyectos`), con todo lo abierto, tenga o no responsable.
2. **La célula**: todas las issues abiertas de cada persona, **en el proyecto que sea** (la carga de alguien
   no se parte por proyecto).

Debajo, separados y marcados: los de fuera de la célula que cargan tus proyectos (responden a otro líder) y
la bolsa sin responsable. Clic en una fila → sus issues ordenadas por lo que arde (vencidas, en revisión,
en desarrollo, el resto). Si se configura `limite_wip`, marca a quien lo supere.

**Frentes** muestra titular y backup de cada frente (si el equipo tiene ese acuerdo) y avisa si alguien se
sale del `reparto` acordado; el líder queda fuera de la cuenta porque es escalamiento. Mover una
titularidad sale como **propuesta para la reunión de equipo**, nunca como hecho consumado.

---

## G · TIMESHEETS DEL EQUIPO (opcional)

Si el equipo envía su timesheet por correo, el tablero hace seguimiento a **que se envíe a diario, a qué %
de sus horas cuelga de una issue y a qué hizo cada quien**. Lo que se mide es la hora trazable, no la escrita.

1. **Buscar por remitente, nunca por asunto** (cada quien titula a su manera), en solo lectura, desde el
   lunes de la semana anterior. El timesheet del líder no se audita aquí.
2. **Abrir cada archivo** (adjunto o enlace). Si no se pudo leer, el envío va con `"leido": false` y el
   tablero avisa que sus rojos pueden ser falsos: **nunca** se deja en rojo callando que no se leyó.
3. **Pasar las filas tal como están**, sin corregirlas: `fecha`, `envio`, `categoria`, `jira` (vacío si no
   hay clave válida: no se le inventa una), `tarea`, `horas`. Las fechas seriales de Excel se convierten.
4. **No se deduplica a mano:** un día sale del envío más reciente que lo traiga (lo hace el script). Sumar
   envíos acumulados duplica o triplica horas.

Colores por día: verde = envió · ámbar = hay horas pero ningún correo posterior · rojo = día hábil pasado
sin horas · gris = festivo, hoy o futuro, o archivo no leído. La meta del % con issue sale de
`timesheet.metaCoberturaIssue` de `config.json`.

**No se hace:** escribirle a nadie reclamando (el tablero lo muestra y el usuario decide), corregir horas,
rellenar días ni poner observaciones personales. Las horas «en espera de asignación» o «sin tarea» son el
hallazgo más importante: dicen que falta plan, no que alguien no trabajó.

---

## H · MANTENIMIENTO

- **Paleta neutra** con claro/oscuro; los frentes toman color de una paleta categórica si el JSON no trae
  uno. Nada de identidad corporativa en la plantilla.
- Si aparece un frente nuevo, **se agrega primero a los datos** (o a `fuentes.yaml`); el tablero no inventa frentes.
- Si una persona no tiene carril, el script lo dice en la cobertura. Ese es el aviso de que falta en `equipo`.
- Después de tocar `plantilla.html`: generar con `--ejemplo`, abrirlo y revisar que el cronograma, el
  arrastre y las pestañas sigan funcionando.
