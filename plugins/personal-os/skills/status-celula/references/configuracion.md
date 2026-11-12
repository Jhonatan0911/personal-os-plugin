# Configuración del status de la célula

Léelo cuando falte un dato, al armar el JSON o al activar el tablero compartido. Todo es opcional salvo lo
marcado; sin el bloque `status_celula:` valen los valores por defecto del motor.

## 1. Lo que viene de la configuración general

| Clave | Para qué | Si falta |
|---|---|---|
| `owner`, `jira.mi_account_id` | Quién es el líder (carril primero) | Se pregunta (obligatorio) |
| `equipo[]` (`nombre`, `rol`, `account_id`, `correo`, `prestamo`) | Carriles y remitentes de timesheet | Se pregunta (obligatorio) |
| `equipo[].produce_pr`, `equipo[].prestado` | Capacidad real (abajo, §1-bis) | Todos producen PR y nadie está prestado |
| `jira.cloud_id`, `jira.sitio`, `jira.proyectos[]` | Lectura de Jira y tablas de Status Jira | Se pregunta (obligatorio); `cloud_id` sale de `getAccessibleAtlassianResources` |
| `jira.campo_inicio` | Campo de fecha de inicio de la instancia | Sin fecha de inicio: la barra empieza en el vencimiento |
| `jira.estados_que_parecen_cerrados` | `estados.no_cierre` | `Redefinido`, `Won't Do`, `Duplicado` |
| `config.json` → `festivos`, `timesheet.jornada`, `timesheet.formatoClave`, `timesheet.metaCoberturaIssue` | Días hábiles, jornada, clave válida de issue y meta del % con issue | Sin festivos (se avisa), 8 h L-V, `PROY-123`, 90 % |

### 1-bis. Capacidad real: `produce_pr` y `prestado`

```yaml
equipo:
  - nombre: "<Persona>"
    produce_pr: true          # false: QA, analista… no cuenta en «producen PR»
    prestado: { a: "<otra célula>", desde: "AAAA-MM-DD", hasta: null }   # hasta null = sin fecha de regreso
```

La skill los copia tal cual a `personas[]` del JSON de datos. Con ellos el tablero:

- rotula el carril «prestada a `<a>` desde `<fecha>`» (y «no produce PR» si aplica). El campo viejo
  `prestamo` (texto) se sigue mostrando si no hay `prestado`;
- le pone **jornada 0** a la persona en los días del préstamo: no cuenta en la capacidad del veredicto
  ni en la tira de carga, y lo que tenga con fecha en ese rango sale en la cobertura para reasignarlo;
- dice en la cabecera cuántas personas **producen PR al corte** (ni prestadas ni con `produce_pr: false`)
  y quién está prestado o lo estará.

Un `prestado` sin `desde` válido se ignora con aviso: la persona cuenta con capacidad completa.

## 2. Bloque `status_celula:` de `fuentes.yaml`

```yaml
status_celula:
  capacidad_factor: 0.8          # parte de la jornada que es trabajo efectivo (veredicto)
  sla_revision: 2                # días hábiles que puede esperar la cola de revisión
  sla_implementacion: 5          # ídem la de publicación
  limite_wip: null               # máximo «en desarrollo» por persona; null = no se mide
  proyectos_propios: ["PROY"]    # lo de otro proyecto se muestra como transversal
  estados:                       # nombres de TU Jira; «Nombre*» compara por prefijo
    revision: ["Listo para revisión", "En revisión*"]
    certificacion: ["Certificación*"]          # entregado a QA/PO: cuenta como «entregada hoy», no es cola del líder
    implementacion: ["Listo para implementación"]
    pausa: ["Pausado"]
    desarrollo: ["En curso"]
  reparto: { titular: 2, backup: 2 }            # equilibrio del acuerdo de equipo (null = no se mide)
  acuerdo_frentes_fuente: "<ruta al acuerdo de equipo con la tabla de frentes>"   # se lee en vivo, no se copia
  externos:                       # de fuera de la célula que cargan tus proyectos (se marcan como ajenos)
    - { jira: "<displayName exacto>", nombre: "<corto>", lider: "otro líder" }
  carpeta_datos: "<stateDir>/_datos/status-celula"   # datos-<fecha>.json y volcados de Jira
  roster_jira: "<ruta al roster de status-celula-jira.js>"   # si no, se arma desde equipo[] y externos
  timesheets:
    remitentes: [{ nombre: "<persona>", correo: "<remitente>" }]   # si no, equipo[].correo
  mesa: { nombre: "mesa de líderes", con: "<quien la coordina>" }
  mesa_excluir:                   # temas que el usuario sacó de la mesa: no vuelven sin que él lo pida
    - { tema: "<qué>", por_que: "<razón>", donde_queda: "<dónde se sigue>" }
  tablero_compartido:             # sección H de la skill; sin url se publica uno nuevo y se guarda aquí
    url: "<url del Artifact>"
    nombre: "<nombre del tablero>"
    personas_extra: []            # displayNames de fuera cuyas issues también ve el tablero
    excluir: []                   # claves que no deben aparecer en la foto
  tablero:                        # de dónde arma la página status-celula-tablero.js
    celula: "<ruta al JSON de la célula>"           # formato: tablero/ejemplo-celula.json de la skill
    organizacion: "<ruta al perfil de la empresa>"  # formato: tablero/ejemplo-organizacion.json
    extras: "<ruta a extras.json>"                  # opcional: lo prometido al cliente y pendientes sin issue
```

**El JSON de la célula** (`tablero.celula`) lleva lo que la página necesita para hablar de tu equipo:
`pagina` (título, subtítulo, pie), `nombres` (líder y analista, para los textos), `lanes[]` (carril por
persona: `id`, `nm`, `rl`, `account_id`, `nombre_jira` exacto, `correo`, `dev`, `fuera`, `celula` = orden en
la tabla de la célula, `analista` = orden en la de analistas, `rol_jira`, `solo_colas`), `jira` (`cloud`,
`servidor_mcp`, `proyectos_cliente`, `proyecto_transversal`, `nombres`, `proyectos_crear`,
`transversal_fuera`), `m365.servidor_mcp`, `festivos`, `jornada` (`normal`, `viernes`, `efectiva_*`,
`horas_por_dia_estimadas`), `sla`, `clientes` (modo cliente), `ia` (contexto y frentes para la sugerencia del
backlog), `estados` (opcional: nombres de las colas), `modulos` (opcional: `calendario`, `timesheets`,
`bandeja`, `macros`, `cliente`, `backlog`, `frentes` en `false` quitan su pestaña o su lectura; todo está
encendido por defecto) y lo del sprint. **El perfil de la empresa** es aparte
porque lo comparten todos los líderes de la misma organización.

La skill copia al JSON `capacidad_factor`, `sla_*`, `limite_wip`, `proyectos_propios`, `estados` (más
`no_cierre` desde `jira.estados_que_parecen_cerrados`), `reparto` y `externos` (como `jira.externos`). El
motor no lee `fuentes.yaml`.

## 3. Si falta algo

Lo obligatorio se pregunta con el modal de preguntas, una vez, y se guarda en `fuentes.yaml` con su fecha.
Lo demás usa el valor por defecto y, si cambia una cifra que la mesa va a ver (factor, SLA, reparto), se dice
en la cabecera del tablero, donde el motor ya lo muestra.
