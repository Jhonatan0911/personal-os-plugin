---
name: timesheet
description: Arma, valida y prepara el envío del timesheet del usuario (registro de horas trazable a issues) a partir de las líneas TS de la bitácora del Personal OS, cruzándolo en solo lectura con el calendario de Outlook/Teams y con los timesheets que le envía su equipo. Con un perfil de organización activo escribe el libro semanal sobre la plantilla corporativa (.xlsx) con sus categorías, jornada, cobertura mínima, nombre de archivo y destinatarios, y lleva el formato de horas extra por cortes; sin perfil exporta CSV o XLSX. Úsala cuando diga "/timesheet", "timesheet", "registra las horas de hoy", "llena el timesheet de ayer", "prepara el envío del timesheet", "revisa la semana", "corrige el timesheet" o "registra estas horas extra". No es para estimar historias (planear-sprint) ni para el estado del equipo (status-celula). Nunca envía correos.
argument-hint: "[fecha | semana <fecha> | envio <fecha> | horas-extra]"
---

# Timesheet

El timesheet sale de **lo que el usuario declaró mientras trabajaba** (las líneas TS de la
bitácora), cruzado con su calendario y con lo que su equipo declara. El motor no inventa horas: lo
que no tiene evidencia queda como **hueco declarado**, y decidir qué hacer con él es del usuario.

## 0. Qué modo aplica (siempre primero)

```
python "${CLAUDE_SKILL_DIR}/libro.py" perfil
```

- **Imprime `PERFIL ACTIVO`** → **modo libro**: libro semanal sobre la plantilla corporativa
  (`libro.py`) y horas extra por corte (`horas_extra.py`). Lee esa salida entera: categorías y qué va
  en cada una, clientes, reglas de envío, cómo se resuelve la issue de una reunión, cruce con el
  equipo, fila fija de planeación, lo que no va al timesheet y la política de horas extra **son las
  reglas de la organización** y mandan sobre los ejemplos de esta skill.
- **Dice `No hay perfil`** → **modo genérico**: `timesheet.py` arma el día y exporta CSV/XLSX con la
  sección `timesheet` de config.json (`references/configuracion.md`).

Para crear un perfil se copia `perfiles/ejemplo.json` a la ruta que indica el mensaje y se ajusta
(`references/perfil.md`). En los comandos, `python` es `python3` fuera de Windows.

## Reglas (los dos modos)

1. **Nunca se rellena.** Las horas sin línea TS son huecos: se registran solo con evidencia
   (calendario, timesheet del equipo, lo que el usuario confirme) o se declaran (`--hueco`). Inventar
   una actividad para cuadrar la jornada es el hallazgo "tareas de relleno".
2. **Issue y cliente en toda fila.** Son los dos campos que quien recibe el timesheet más reclama.
   Sin rellenos (`-`, `N/A`, `varios`); si un tramo sirvió a dos clientes, se parte. «Sin issue» solo
   con el cliente interno y en las categorías permitidas; si la issue no existe, se consigue o se crea
   **antes** de registrar.
3. **Cada reunión cuelga de una issue**, en este orden: la issue del proyecto que se trató; la tarea
   de ceremonias recurrentes del mes; una tarea de reuniones nueva si es puntual (se propone y se crea
   **solo con el OK del usuario**, estimación = duración agendada; lo que duró de verdad va en las
   horas ejecutadas). El perfil (`reuniones`) trae la consulta exacta.
4. **Cobertura con issue por día ≥ la meta.** Se reporta siempre; bloquea cuando la regla está
   vigente. Las dailys y reuniones internas recurrentes se comen el margen: tienen que colgar de una
   issue, y «Sin issue» queda para lo verdaderamente puntual.
5. **Fecha fija en todas las filas**, como valor y no como fórmula: quien lee el archivo lee filas
   sueltas y muchos visores no recalculan.
6. **Las horas extra no van como filas del timesheet**: van en su propio formato
   (`horas_extra.py` en modo libro). Una fila no cruza la medianoche.
7. **La estimación de una issue va una sola vez por semana** (primera fila); repetirla infla el
   total. Sin estimación va 0 y se avisa: estimar es del líder.
8. **Redacción de negocio, en pasado, concreta y verificable.** No se mencionan asistentes de IA,
   prompts, skills, agentes ni `/comandos`, pero lo hecho con ellos **sí se registra**, traducido a
   su resultado. Tampoco van identificadores que solo existen en notas privadas (riesgos,
   compromisos, desviaciones numeradas, "punto N del MVP", "fase N"): se escribe qué era. Sí van los
   rastreables por el lector (clave de issue, número de caso, hash de commit, tabla, endpoint, rama).

   | No escribas | Escribe |
   |---|---|
   | "Ajuste del prompt del agente de informes" | "Generación del informe de avance del módulo de citas" |
   | "Checkpoint y handoff de la sesión" | "Documentación del avance del proyecto" (máx. 10 min, nunca fila propia) |
   | "Cierre de la desviación D-9" | "Cierre de la brecha de homologación de códigos hacia el sistema del cliente" |

   Si algo asistido no tiene equivalente de negocio claro, pregunta antes; si el equivalente honesto
   dura 10 minutos, que ocupe 10 minutos. El perfil puede traer `ejemplosRedaccion` propios.
9. **Solo trabajo de la organización.** Lo personal (y lo que liste `excluir` del perfil) no va ni
   como horas extra.
10. **Los rangos que declara el usuario mandan** ("esto fue de 8 a 9") sobre cualquier reloj, y la
    secuencia debe corresponder con la hora real. Dos cosas a la vez van en **una** fila que diga que
    fueron simultáneas, sin duplicar horas. Si dos líneas TS se cruzan, manda la escrita después.
11. **Nunca se envía nada** ni se escribe en Jira, Outlook o Teams sin el OK del usuario: el motor
    deja el archivo, la sesión redacta el correo y el usuario lo manda.
12. **No digas "quedó cuadrado" sin la salida del motor que lo confirma**, y reporta copiando sus
    números, no de memoria.

## Modo libro (con perfil)

`L` = `python "${CLAUDE_SKILL_DIR}/libro.py"`. Detalle del libro, del JSON y de las compuertas en
`references/libro.md`.

1. **Fecha.** El argumento (`AAAA-MM-DD`, `dd/mm/aaaa`, "ayer", "lunes"); si no hay, hoy. Fin de
   semana: pregunta qué día hábil quiere.
2. **Estado.** `L week --date <DIA>` y `L show --date <DIA>`, para actualizar en vez de duplicar. Si
   el libro de la semana no existe, `set` lo crea desde la plantilla.
3. **Calendario — obligatorio, antes de armar nada.** Es la mitad de la jornada de un líder.
   `outlook_calendar_search` (cárgala con ToolSearch si aparece diferida) con `query: "*"`,
   `order: "oldest"`, `limit: 25`, `afterDateTime: "<DIA>T00:00:00"`,
   `beforeDateTime: "<DIA+1>T12:00:00"`. **La ventana va ancha a propósito**: la API lee UTC y una
   ventana en hora local deja la mañana fuera; el motor convierte y filtra. Pagina con `nextOffset` y
   guarda todo **tal cual** en el scratchpad como `agenda-<DIA>.json`. El calendario no trae llamadas
   improvisadas ni chats: un chat puede ser pista de un hueco, pero hora y contenido los confirma el
   usuario.
4. **Timesheets del equipo** — obligatorio si el perfil dice `equipo.obligatorio`. En solo lectura y
   sin descargar: `outlook_email_search` con `equipo.asuntoContiene` desde el día, paginando; cada
   correo y adjunto con `read_resource` (si un adjunto no se lee sin descargarlo, se dice). De los
   `remitentes` (manda el roster vigente), toma las filas del día que mencionan al usuario
   (`menciones`), sin las de `excluir`; usa el envío más completo que cubra el día. Cada fila es
   **evidencia de una reunión**: hora del desarrollador, issue de su fila, categoría según lo que se
   hizo; si choca con el calendario o con una línea TS, se le pone enfrente al usuario. Se hace aunque
   no haya huecos (confirma a qué reuniones se asistió). Delégalo a un subagente que devuelva solo la
   tabla por día y los correos leídos y no leídos; no se pide permiso para esto.
5. **Borrador — lo arma el motor.**
   `L borrador --date <DIA> --agenda <scratchpad>/agenda-<DIA>.json --out <scratchpad>/dia-<DIA>.json`
   Convierte 1:1 las líneas TS, resuelve la estimación semanal y reporta reuniones sin línea TS,
   solapes, huecos (con la reunión que cae en cada uno) y la cobertura. Presenta al usuario huecos y
   reuniones pendientes **en un solo bloque** (con la herramienta de preguntas si existe) y pregunta
   solo eso. No "mejores" los rangos de una línea TS.
6. **Completa** el JSON: la fila de `planeacionInicial` del perfil si existe (no se pregunta, salvo
   que una línea TS diga otra cosa para esa franja); reuniones con su issue (regla 3) o en
   `"descartadas"` con su razón; tramos sin línea TS solo con evidencia (prosa de la bitácora, `git log`);
   si el usuario adjunta una planilla de check-ins, su columna de tarea es su voz y manda (lo
   "sin documentar" no se registra; los insumos van a `archivos externos/<origen>/`).
7. **Escribe.** `L set --date <DIA> --json <dia.json> --agenda <agenda.json>`. Sin `--parcial`
   exige jornada cuadrada (o `--hueco "<razón>"`), cobertura vigente, cruce con el calendario (solo si
   de verdad no se puede: `--sin-agenda "<razón>"`, y se le dice al usuario) y **toda línea TS
   reflejada en una fila**. `--parcial` para el día en curso (nunca rellenes horas que no han pasado).
   `set` reemplaza solo ese día y amplía el bloque si hace falta; si el Excel está abierto, pide
   cerrarlo.
8. **Envío.** `L envio --date <DIA>` deja la copia acumulada con el nombre que exige el perfil y dice
   asunto y destinatarios. Se niega si un día queda bajo la cobertura vigente o tiene líneas TS sin
   pasar (no se salta con `--force`), o si una fila quedó sin issue o sin cliente (`--force` la saca y
   la explicación es del usuario). El correo se redacta con destinatarios, asunto, adjunto y cuerpo, y
   **lo envía el usuario** tras su OK.
9. **Cierra** con `L week --date <DIA>` y reporta copiando su salida: filas, horas, cobertura del día
   y si es válido, reuniones registradas/descartadas, filas sin cliente, issues sin estimación, huecos
   y archivo listo. Si `week` marca `TS DE LA BITACORA SIN PASAR AL LIBRO`, `INVALIDO` o
   `FILAS SIN FECHA FIJA`, el timesheet **no está listo** y se dice así.

**Mantenimiento:** `L remap --date` (etiquetas retiradas → vigentes, solo esa columna) y
`L fechas --date` (sella la fecha en un libro ya escrito).
**Horas extra:** `python -I "${CLAUDE_SKILL_DIR}/horas_extra.py" add|show|del` (ver
`references/libro.md` §8): un archivo por corte, observaciones sin códigos de issue, avisar en los
días de radicación de `horasExtra.politica` y `show` del corte antes de radicar.

## Modo genérico (sin perfil)

`T` = `python "${CLAUDE_SKILL_DIR}/timesheet.py"`. Configuración en `references/configuracion.md`.

1. **Fecha** como arriba; si es no laborable según `jornada`/`festivos`, pregunta.
2. **Día:** `T dia <DIA>` → filas, horas contra jornada, cobertura, huecos, tramos fuera del
   timesheet, correcciones por solape, avisos y errores.
3. **Calendario** con la misma llamada del modo libro y `T dia <DIA> --agenda <archivo>`: reporta
   reuniones sin línea TS, solapes y qué reunión cae en cada hueco.
4. **Equipo** solo si `fuentes.yaml` → `timesheet_equipo.activo`: filas como lista JSON y
   `T dia <DIA> --equipo <archivo>`.
5. **Huecos:** por cada tramo que el usuario confirme, escribe su línea TS con
   `node "<raíz del plugin>/scripts/bitacora-append.js" --ts "rango|clave|categoría|cliente|est|tarea|evidencia"`
   (`--hoy AAAA-MM-DD` para un día anterior). La bitácora es de solo anexar: una línea nueva con el
   mismo rango corrige la anterior. Contrato: `- **TS:** HH:MM-HH:MM | PROY-123 | Categoría | Cliente | est=4h | qué se hizo | evidencia`
   (`SIN-ISSUE` sin issue; `SIN-EST` sin estimación).
6. Repite `T dia` hasta `exportable`. **Semana:** `T semana <DIA>` (consumo por issue, `SIN ESTIMACIÓN`, `SOBREPASA`).
7. **Exportar:** `T exportar --desde <DIA> [--hasta <DIA>] [--formato csv|xlsx] [--exigir-cobertura]`.
   No sale con errores. El correo se redacta (destinatarios de `fuentes.yaml` → `timesheet_envio`) y
   lo envía el usuario.
8. **Cierre** copiando la salida del motor; si dijo `con errores`, no está listo.

## Prohibido

Inventar actividades o estirar rangos para cuadrar · exportar o enviar con errores · registrar horas
extra como filas · mencionar herramientas de IA o códigos internos en la tarea · cambiar el formato
base, mover columnas, añadir hojas o insertar filas a mano (ampliar un día lo hace el motor) · tocar
la plantilla corporativa · escribir fines de semana · dejar archivos sueltos en la raíz de la carpeta
base · escribir en Jira, Outlook o Teams sin OK · enviar correos.

## Cuándo NO usarla

Estimar historias o armar un sprint (`planear-sprint`), ver la ocupación del equipo
(`status-celula`), redactar un correo que no es el del timesheet.

## Archivos

| Archivo | Cuándo |
|---|---|
| `libro.py` | Se **ejecuta**: modo libro (`perfil`, `week`, `show`, `borrador`, `set`, `envio`, `remap`, `fechas`) |
| `horas_extra.py` | Se **ejecuta**: formato de horas extra por corte (`add`, `show`, `del`) |
| `timesheet.py` | Se **ejecuta**: modo genérico (`dia`, `semana`, `exportar`) |
| `perfiles/ejemplo.json` | Plantilla neutra del perfil de organización |
| `references/libro.md` | Estructura del libro, JSON de `set`, compuertas, mantenimiento y horas extra |
| `references/perfil.md` | Dónde va el perfil y qué hace cada clave |
| `references/configuracion.md` | Modo genérico: config.json, fuentes.yaml y archivo exportado |
