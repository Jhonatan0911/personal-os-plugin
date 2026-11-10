# Configuración del status de la célula

Léelo cuando falte un dato, al armar el JSON o al activar el tablero compartido. Todo es opcional salvo lo
marcado; sin el bloque `status_celula:` valen los valores por defecto del motor.

## 1. Lo que viene de la configuración general

| Clave | Para qué | Si falta |
|---|---|---|
| `owner`, `jira.mi_account_id` | Quién es el líder (carril primero) | Se pregunta (obligatorio) |
| `equipo[]` (`nombre`, `rol`, `account_id`, `correo`, `prestamo`) | Carriles y remitentes de timesheet | Se pregunta (obligatorio) |
| `jira.cloud_id`, `jira.sitio`, `jira.proyectos[]` | Lectura de Jira y tablas de Status Jira | Se pregunta (obligatorio); `cloud_id` sale de `getAccessibleAtlassianResources` |
| `jira.campo_inicio` | Campo de fecha de inicio de la instancia | Sin fecha de inicio: la barra empieza en el vencimiento |
| `jira.estados_que_parecen_cerrados` | `estados.no_cierre` | `Redefinido`, `Won't Do`, `Duplicado` |
| `config.json` → `festivos`, `timesheet.jornada`, `timesheet.formatoClave`, `timesheet.metaCoberturaIssue` | Días hábiles, jornada, clave válida de issue y meta del % con issue | Sin festivos (se avisa), 8 h L-V, `PROY-123`, 90 % |

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
  salida_html: "<stateDir>"                          # status-celula-<fecha>.html
  mesa: { nombre: "mesa de líderes", con: "<quien la coordina>" }
  mesa_excluir:                   # temas que el usuario sacó de la mesa: no vuelven sin que él lo pida
    - { tema: "<qué>", por_que: "<razón>", donde_queda: "<dónde se sigue>" }
  tablero_compartido:             # sección H de la skill; sin él no se sube nada
    url: "<url del Artifact>"
    nombre: "<nombre del tablero>"
    personas_extra: []            # displayNames de fuera cuyas issues también ve el tablero
    excluir: []                   # claves que no deben aparecer en la foto
```

La skill copia al JSON `capacidad_factor`, `sla_*`, `limite_wip`, `proyectos_propios`, `estados` (más
`no_cierre` desde `jira.estados_que_parecen_cerrados`), `reparto` y `externos` (como `jira.externos`). El
motor no lee `fuentes.yaml`.

## 3. Si falta algo

Lo obligatorio se pregunta con el modal de preguntas, una vez, y se guarda en `fuentes.yaml` con su fecha.
Lo demás usa el valor por defecto y, si cambia una cifra que la mesa va a ver (factor, SLA, reparto), se dice
en la cabecera del tablero, donde el motor ya lo muestra.
