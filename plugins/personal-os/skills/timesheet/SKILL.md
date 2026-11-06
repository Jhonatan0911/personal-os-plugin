---
name: timesheet
description: Arma, valida y prepara el envío del timesheet del usuario a partir de las líneas TS de la bitácora del Personal OS. Úsala cuando diga "/timesheet", "timesheet", "registra las horas de hoy", "llena el timesheet del <fecha>", "prepara el envío del timesheet" o pida revisar la semana. Cruza en solo lectura el calendario de Outlook/Teams y, si lo configuró, los timesheets que su equipo le envía; exige clave de issue y cliente en toda fila, toma la jornada y las categorías de config.json, mide la cobertura con issue contra la meta configurada, declara los huecos sin rellenarlos y genera el archivo de envío (CSV o XLSX). Nunca envía correos.
---

# Timesheet

El timesheet sale de **lo que el usuario declaró mientras trabajaba** (las líneas TS de la
bitácora), cruzado con su calendario. El motor no inventa horas: lo que no tiene evidencia
queda como **hueco declarado**, y decidir qué hacer con él es del usuario.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Motor | `<raíz del plugin>/skills/timesheet/timesheet.py` (Python 3, solo biblioteca estándar; `openpyxl` opcional para XLSX) |
| Configuración | `~/.claude/personal-os/config.json` → sección `timesheet` (o `$PERSONAL_OS_HOME/config.json`) |
| Bitácora | `<stateDir>/bitacora/AAAA-MM-DD.md` |
| Archivo de envío | `<stateDir>/timesheet/timesheet-<usuario>-<desde>[_<hasta>].csv\|xlsx` |
| Integraciones (equipo, destinatarios) | `<stateDir>/config/fuentes.yaml` |

La raíz del plugin aparece en el contexto de la sesión en la línea **"Scripts del plugin:"**
que inyecta el hook de arranque (es la carpeta que contiene `scripts/`). En los comandos de
abajo, `python3` es `python` en Windows.

## Configuración (config.json → `timesheet`)

Nada de la empresa está fijo en el motor: todo sale de aquí.

| Clave | Para qué |
|---|---|
| `jornada` | Horas por día (`lun`…`dom`). 0 = no laborable. Los `festivos` de la raíz de config.json también cuentan como no laborables. |
| `inicioJornada` | Hora de arranque (`HH:MM`). La ventana del día es inicio + horas (+ pausas). |
| `categorias` | Las únicas categorías válidas. |
| `aliasCategorias` | Abreviaturas o etiquetas retiradas → categoría vigente (se reescriben y se avisa). |
| `categoriasReunion` | Cuáles son reuniones (para la regla de `reunionesExigenIssueDesde`). |
| `clientes` / `clienteInterno` | Clientes conocidos; uno nuevo entra con aviso. El interno es el único que admite SIN-ISSUE. |
| `categoriasSinIssuePermitidas` | Únicas categorías donde vale SIN-ISSUE (y solo con el cliente interno). |
| `reunionesExigenIssueDesde` | Fecha desde la que toda reunión exige issue (`null` = no aplica). |
| `formatoClave` | Expresión regular de la clave de issue (p. ej. `PROY-142`). |
| `prohibidoEnTarea` | Palabras que no pueden aparecer en la descripción (herramientas, IA…). |
| `metaCoberturaIssue` | Fracción mínima de horas con issue por día (0,9 = 90 %). |

Claves **opcionales** que el motor entiende además de la plantilla:

```json
"pausas": [{"desde": "12:00", "hasta": "13:00"}],
"planeacionInicial": {"minutos": 30, "clave": "SIN-ISSUE", "categoria": "Otros",
                      "tarea": "Planeación del día y organización de prioridades"},
"formatoEnvio": "csv"
```

- `pausas`: tramos que no cuentan como jornada (almuerzo). Una fila que los cruza no los cobra.
- `planeacionInicial`: **solo si el usuario lo quiere**. Si la primera franja del día no tiene
  línea TS y el día sí tiene actividad declarada, el motor la registra como planeación con esos
  datos (cliente = `clienteInterno` si no se indica). Sin esta clave, la primera franja vacía es
  un hueco como cualquier otro. Un día sin ninguna línea TS nunca se "abre" con esta fila.
- `formatoEnvio`: `csv` (defecto) o `xlsx`.

Si falta la sección `timesheet`, el motor lo dice y pide correr `/os-setup`.

## Contrato de la línea TS

Cada tramo laboral es una línea en la bitácora del día:

```
- **TS:** HH:MM-HH:MM | PROY-123 | Categoría | Cliente | est=4h | qué se hizo, sobre qué y con qué resultado | evidencia
```

- Clave `SIN-ISSUE` (alias `SIN-JIRA`) solo si de verdad no hay issue; estimación `SIN-EST`
  si la issue no tiene horas.
- Se escribe con el script del plugin, que valida contra config.json:
  `node "<raíz del plugin>/scripts/bitacora-append.js" --ts "rango|clave|categoría|cliente|est|tarea|evidencia"`
- La bitácora es de solo anexar: **para corregir un tramo se escribe una línea nueva con el
  mismo rango**; si dos líneas se cruzan, manda la escrita después (la anterior se recorta).
- Una línea no cruza la medianoche: se parte en dos días.

## Reglas

1. **Nunca se rellena.** Las horas sin línea TS son huecos. Se registran solo con evidencia
   (calendario, timesheet del equipo, lo que el usuario confirme) o se declaran como huecos.
   Inventar una actividad para cuadrar la jornada es exactamente el hallazgo "tareas de relleno".
2. **Clave de issue y cliente en toda fila.** Sin rellenos (`-`, `N/A`, `varios`): si un tramo
   sirvió a dos clientes, se parte. SIN-ISSUE solo en las categorías permitidas y con el
   cliente interno; si la issue no existe, se consigue o se crea **antes** de registrar.
3. **Cobertura con issue por día ≥ `metaCoberturaIssue`.** El motor la reporta siempre; con
   `--exigir-cobertura` además bloquea la exportación.
4. **Fecha en todas las filas** del archivo de envío.
5. **Las horas extra no van como filas.** Lo que cae fuera de la jornada configurada se reporta
   como "fuera del timesheet" y no se exporta; si se cobran, van en su propio formato.
6. **Sin herramientas ni códigos internos en la descripción.** El timesheet reporta trabajo de
   negocio: no se mencionan asistentes de IA, prompts, skills, agentes ni `/comandos`, pero lo
   hecho con ellos **sí se registra**, traducido a su resultado. Tampoco van identificadores que
   solo existen en notas privadas (riesgos, compromisos, desviaciones numeradas, "punto N del
   MVP"): se escribe qué era. Sí van los identificadores rastreables por el lector (clave de
   issue, número de caso, hash de commit, rama, endpoint).

   | No escribas | Escribe |
   |---|---|
   | "Ajuste del prompt del agente de informes" | "Generación del informe de avance del módulo de citas" |
   | "Checkpoint y handoff de la sesión" | "Documentación del avance del proyecto" (máx. 10 min, nunca fila propia) |
   | "Cierre de la desviación D-9" | "Cierre de la brecha de homologación de códigos hacia el sistema del cliente" |

7. **Cada reunión cuelga de una issue**, en este orden: la issue del proyecto que se trató; la
   tarea de ceremonias recurrentes si el usuario la tiene; una tarea nueva de reuniones si es
   puntual (se propone y se crea **solo con su OK**, con estimación = duración agendada). Solo
   si nada de eso aplica y la categoría lo permite, SIN-ISSUE con el cliente interno.
8. **Nunca se envía nada.** El motor deja el archivo; la sesión redacta el correo y el usuario
   lo manda.

## Procedimiento

1. **Fecha.** El argumento de `/timesheet` (`AAAA-MM-DD`, `dd/mm/aaaa`, "ayer", "lunes"); si no
   hay, hoy. Si es un día no laborable según `jornada`/`festivos`, pregunta qué día quiere.

2. **Estado del día.**
   ```
   python3 "<raíz del plugin>/skills/timesheet/timesheet.py" dia AAAA-MM-DD
   ```
   Muestra las filas, horas contra jornada, cobertura, huecos, tramos fuera del timesheet,
   correcciones por solape, avisos y errores.

3. **Calendario (solo lectura).** Si la sesión tiene la búsqueda de calendario de Microsoft 365
   (`outlook_calendar_search`; cárgala con ToolSearch si aparece diferida), pide los eventos del
   día con una **ventana ancha**: desde `<DIA>T00:00:00` hasta `<DIA+1>T12:00:00`, `query: "*"`,
   orden ascendente, y pagina con `nextOffset`. La API suele interpretar las fechas en UTC: una
   ventana estrecha en hora local deja la mañana fuera. Guarda la respuesta **tal cual** (varias
   páginas pegadas valen) en el scratchpad como `agenda-AAAA-MM-DD.json` y vuelve a correr:
   ```
   python3 "<raíz del plugin>/skills/timesheet/timesheet.py" dia AAAA-MM-DD --agenda <scratchpad>/agenda-AAAA-MM-DD.json
   ```
   El motor convierte a la zona del usuario y descarta solas las canceladas, las de todo el día,
   los bloques sin asistentes y los eventos libres; lo tentativo se conserva. Reporta las
   reuniones sin línea TS, los solapes del calendario y qué reunión cae en cada hueco.
   El calendario no trae llamadas improvisadas ni chats: un mensaje puede ser pista de un hueco,
   pero la hora y el contenido los confirma el usuario. Si no hay acceso al calendario, dilo.

4. **Timesheets del equipo (opcional).** Solo si el usuario lo activó en `fuentes.yaml`:
   ```yaml
   timesheet_equipo:
     activo: true
     asunto_contiene: "Timesheet"          # cómo titula el equipo sus envíos
     remitentes: ["<correo de Persona 1>", "<correo de Persona 2>"]
     menciones: ["con el líder", "<tu nombre>"]   # cómo te nombran en sus filas
     excluir: ["en espera de asignación"]          # esperar al usuario no es tiempo del usuario
   ```
   Busca esos correos en solo lectura (`outlook_email_search` desde el día a registrar, paginando)
   y lee cada adjunto con `read_resource`; si un adjunto no se puede leer sin descargarlo, se dice
   y no se descarga. Toma las filas del día que mencionan al usuario (sin las de `excluir`) y
   guárdalas en el scratchpad como lista JSON
   `[{"fecha","desde","hasta","persona","clave","tarea"}]`; pásalas con `--equipo <archivo>`.
   Cada fila es **evidencia** de una reunión del usuario con esa persona: el motor dice si ya
   está cubierta o si cae en un hueco. Es lectura pesada: delégala a un subagente que devuelva
   solo esa lista y los correos leídos y no leídos.

5. **Resolver huecos y reuniones pendientes.** Presenta al usuario, en un solo bloque, los huecos
   y las reuniones sin línea TS, con hora y asunto (si la sesión tiene la herramienta de
   preguntas con opciones, úsala). Por cada tramo que confirme, escribe su línea TS con
   `bitacora-append.js --ts "…"` (con la clave resuelta según la regla 7 y la categoría según lo
   que se hizo). No reinterpretes los rangos que el usuario declara: la secuencia debe coincidir
   con la hora real. Lo que no tenga evidencia **no se registra**: queda como hueco.
   Dos cosas a la vez van en **una** fila que diga que fueron simultáneas, sin duplicar horas.
   Para un día anterior, pasa la fecha con `--hoy AAAA-MM-DD`
   (`bitacora-append.js --ts "…" --hoy 2026-11-04`): así escribe en la bitácora de ESE día y no en la de hoy.

6. **Volver a validar.** Corre `dia` otra vez hasta que el estado sea `exportable`. Los errores
   se corrigen en la bitácora (una línea nueva con el mismo rango reemplaza a la anterior), nunca
   editando el archivo exportado.

7. **Semana** (para revisar o antes del envío semanal):
   ```
   python3 "<raíz del plugin>/skills/timesheet/timesheet.py" semana AAAA-MM-DD
   ```
   Horas contra jornada por día, cobertura, huecos, días sin registros y consumo de cada issue
   contra su estimación (`SIN ESTIMACIÓN`, `SOBREPASA`).

8. **Exportar.**
   ```
   python3 "<raíz del plugin>/skills/timesheet/timesheet.py" exportar --desde AAAA-MM-DD [--hasta AAAA-MM-DD] [--formato csv|xlsx] [--exigir-cobertura]
   ```
   No genera el archivo si queda algún error (línea ilegible, clave o cliente faltante, SIN-ISSUE
   no permitido, categoría desconocida, palabra prohibida). La estimación de cada issue va **una
   sola vez por semana** (en su primera fila) para no inflar el total. El CSV usa `;` y coma
   decimal (como lo abre Excel en español) y UTF-8 con BOM; `--separador ,` lo cambia. El XLSX
   trae además una hoja `Resumen` con jornada, horas, hueco declarado y cobertura por día. Si
   `openpyxl` no está instalado, sale CSV y lo avisa.

9. **Correo (redactado, no enviado).** Si el usuario envía su timesheet por correo, redacta
   asunto y cuerpo (destinatarios desde `fuentes.yaml` → `timesheet_envio` si existe:
   `{para: [...], cc: [...], asunto: "Timesheet {nombre} {fecha}"}`), menciona los huecos
   declarados si los hay e indica la ruta del archivo a adjuntar. **Lo envía el usuario.**

10. **Cierre.** Reporta en pocas líneas **copiando los números de la salida del motor** (no de
    memoria): día(s), filas, horas registradas contra jornada, cobertura con issue y si cumple la
    meta, reuniones del calendario registradas o pendientes, huecos declarados, tramos fuera del
    timesheet, issues sin estimación y la ruta del archivo. Si el motor dijo `con errores`, el
    timesheet **no está listo** y se dice así.

## Prohibido

Inventar actividades o estirar rangos para cuadrar la jornada · exportar con errores ·
registrar horas extra como filas · mencionar herramientas de IA o códigos internos en la tarea ·
escribir en Jira, Outlook o Teams sin el OK del usuario · enviar correos.
