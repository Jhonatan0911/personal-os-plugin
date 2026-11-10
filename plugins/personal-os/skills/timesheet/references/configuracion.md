# Modo genérico: configuración y archivo de envío

Léelo cuando trabajes sin perfil de organización (motor `timesheet.py`) y haga falta ajustar la
configuración o entender el archivo exportado.

## config.json → `timesheet`

`~/.claude/personal-os/config.json` (o `$PERSONAL_OS_HOME/config.json`). Nada de la empresa está
fijo en el motor: todo sale de aquí. Si falta la sección, el motor lo dice y pide correr `/os-setup`.

| Clave | Para qué |
|---|---|
| `jornada` | Horas por día (`lun`…`dom`). 0 = no laborable. Los `festivos` de la raíz de config.json también cuentan como no laborables. |
| `inicioJornada` | Hora de arranque (`HH:MM`). La ventana del día es inicio + horas (+ pausas). |
| `pausas` | Tramos que no cuentan como jornada (almuerzo): `[{"desde": "12:00", "hasta": "13:00"}]`. |
| `categorias` | Las únicas categorías válidas. |
| `aliasCategorias` | Abreviaturas o etiquetas retiradas → categoría vigente (se reescriben y se avisa). |
| `categoriasReunion` | Cuáles son reuniones (para `reunionesExigenIssueDesde`). |
| `clientes` / `clienteInterno` | Clientes conocidos; uno nuevo entra con aviso. El interno es el único que admite SIN-ISSUE. |
| `categoriasSinIssuePermitidas` | Únicas categorías donde vale SIN-ISSUE (y solo con el cliente interno). |
| `reunionesExigenIssueDesde` | Fecha desde la que toda reunión exige issue (`null` = no aplica). |
| `formatoClave` | Expresión regular de la clave de issue (p. ej. `PROY-142`). |
| `prohibidoEnTarea` | Palabras que no pueden aparecer en la descripción (herramientas, IA…). |
| `metaCoberturaIssue` | Fracción mínima de horas con issue por día (0,9 = 90 %). |
| `planeacionInicial` | Opcional: `{"minutos": 30, "clave": "SIN-ISSUE", "categoria": "Otros", "tarea": "…"}`. Si la primera franja del día no tiene línea TS y el día sí tiene actividad, se registra como planeación. Un día sin ninguna línea TS nunca se "abre" con esta fila. |
| `formatoEnvio` | `csv` (defecto) o `xlsx`. |
| `perfil` | Opcional: ruta del perfil de organización (activa el modo libro). |

## fuentes.yaml (`<stateDir>/config/fuentes.yaml`)

```yaml
timesheet_equipo:            # cruce con los timesheets que el equipo envía por correo
  activo: true
  asunto_contiene: "Timesheet"
  remitentes: ["<correo de Persona 1>", "<correo de Persona 2>"]
  menciones: ["con el líder", "<tu nombre>"]   # cómo te nombran en sus filas
  excluir: ["en espera de asignación"]          # esperar al usuario no es tiempo del usuario
timesheet_envio:
  para: ["<correo>"]
  cc: []
  asunto: "Timesheet {nombre} {fecha}"
```

Las filas del equipo se guardan en el scratchpad como lista JSON
`[{"fecha","desde","hasta","persona","clave","tarea"}]` y se pasan con `dia --equipo <archivo>`: el
motor dice si cada una ya está cubierta o cae en un hueco.

## Archivo de envío

`exportar` deja `<stateDir>/timesheet/timesheet-<usuario>-<desde>[_<hasta>].csv|xlsx`. No lo genera
si queda algún error (línea ilegible, clave o cliente faltante, SIN-ISSUE no permitido, categoría
desconocida, palabra prohibida); con `--exigir-cobertura` tampoco si un día queda bajo la meta. La
estimación de cada issue va una sola vez por semana. El CSV usa `;` y coma decimal, UTF-8 con BOM
(`--separador ,` lo cambia). El XLSX trae además una hoja `Resumen` con jornada, horas, hueco
declarado y cobertura por día; sin `openpyxl` sale CSV y lo avisa.
