# Modo libro: contrato del archivo corporativo

Léelo cuando trabajes con perfil de organización y necesites el detalle del libro (estructura,
JSON de `set`, mantenimiento) o cuando el motor rechace algo y no esté claro por qué.

## Índice
1. Carpeta base
2. Estructura del libro
3. Fecha fija en todas las filas
4. Categorías en el libro
5. JSON del día (`set`)
6. Compuertas de `set` y `envio`
7. Mantenimiento (`remap`, `fechas`)
8. Horas extra

## 1. Carpeta base

`rutas.base` del perfil (o la variable de entorno que declare `rutas.variablesEntorno.base`, o
`TIMESHEET_DIR`). Dentro va todo clasificado; **la raíz no lleva archivos sueltos**:

```
<base>/
├─ formatos/                 plantilla corporativa (rutas.plantilla): NO se toca
├─ timesheet/AAAA-MM/        libros semanales; la carpeta es la del LUNES de la semana
│  └─ envio/                 copias con el nombre que exige la organización (las deja `envio`)
├─ horas extra/              formatos de horas extra, uno por corte (pueden cruzar meses)
└─ archivos externos/<origen>/   insumos de terceros (planillas, exportes)
```

La carpeta del mes es la del lunes para que una semana que cruza de mes no quede partida. El
motor crea `timesheet/AAAA-MM/` y `envio/` si no existen; si aparece un `.xlsx` suelto en la
raíz, se archiva en su carpeta antes de seguir.

## 2. Estructura del libro

Una hoja (`libro.hoja`) con las columnas de `libro.columnas` (por defecto: A fecha · B cliente ·
C categoría · D código Jira · E tarea · F desde · G hasta · H asignadas · I ejecutadas (fórmula,
descuenta el `almuerzo`) · J observaciones). Encabezado: nombre, identificación y fechas desde/hasta
en `libro.celdas`.

Bloques de `filasPorDia` filas por día desde `primeraFila`, y el TOTAL en `filaTotal`. Ese layout es
**nominal y solo al crear el libro**: si un día necesita más filas, `set` **amplía su bloque**
(inserta al final del día, copia el formato de la última fila, corre los bloques siguientes junto
con las celdas combinadas y reescribe fórmulas por fila y el TOTAL). Desde ahí la estructura real se
lee del archivo: un día empieza donde cambia la fecha de la columna A. Tú pasas las filas que el día
necesita; acomodar el bloque es tarea del motor. Agrupar sigue siendo criterio de calidad: por
encima de `maxFilasPorDia` `set` se niega, y solo se agrupa entre filas de la misma issue y
categoría.

## 3. Fecha fija en todas las filas

Toda fila del bloque, con actividad o vacía, lleva su fecha **como valor** en la columna A. Nunca
como fórmula: openpyxl la guarda sin valor calculado y la vista previa del correo, Excel web o móvil
la muestran en blanco. El libro nuevo nace así; `set` sella todo el libro (y convierte fórmulas
viejas); `envio` lo vuelve a sellar y no genera el archivo si queda una fila con actividad sin
fecha; `week` avisa `FILAS SIN FECHA FIJA`. Si alguien edita la columna A a mano, todas las filas de
un mismo día deben llevar la misma fecha o el motor deja de reconocer el libro.

## 4. Categorías en el libro

`categorias` del perfil es la fuente única. El motor las agrega a la hoja de parámetros del **libro
semanal** (nunca a la plantilla) y apunta el desplegable a ese rango. Las etiquetas de
`aliasCategorias` no se rechazan: se reescriben a la vigente y se avisa, para que líneas TS y libros
viejos sigan sirviendo. La comparación ignora tildes y mayúsculas.

## 5. JSON del día (`set`)

Se parte del JSON que deja `borrador` (va en el scratchpad):

```json
{
  "nombre": "<persona.nombre>", "identificacion": "<persona.identificacion>",
  "rows": [
    {"cliente": "Cliente A", "categoria": "Desarrollo", "jira": "PROY-12", "tarea": "...",
     "desde": "08:00", "hasta": "10:00", "asignadas": 16, "observaciones": ""},
    {"cliente": "Interno", "categoria": "Otros", "jira": "", "tarea": "...",
     "desde": "15:30", "hasta": "17:00", "asignadas": 0,
     "observaciones": "Sin issue - comité interno sin issue asociada"}
  ],
  "descartadas": [{"reunion": "Entrega del módulo", "razon": "se cruzó con la daily, que fue la atendida"}]
}
```

- `asignadas` = la estimación de la issue en Jira, **una sola vez por semana** (primera fila donde
  aparece); en las demás va 0. Sin estimación: 0, y el motor avisa (estimar es del líder).
- Sin código Jira solo con `observaciones` que empiecen por `<marcas.sinIssue> - <razón>`, con el
  `clienteInterno` y en `categoriasSinIssue`; desde `reunionesExigenIssueDesde`, nunca en reuniones.
- Fuera de la jornada: la observación empieza por `<marcas.extra>` (se radica) o
  `<marcas.extendida>` (solo se reporta). Las horas extra van en su formato, no aquí.
- `descartadas`: reuniones del calendario que no se atendieron, con su razón.

## 6. Compuertas

`set` sin `--parcial` exige: jornada cuadrada (o `--hueco "<razón>"`), cobertura ≥ mínimo si la
regla está vigente, cruce con el calendario (`--agenda`; solo si de verdad no se puede,
`--sin-agenda "<razón>"`, y se le dice al usuario) con toda reunión registrada o descartada, y
**toda línea TS de la bitácora reflejada en una fila**. `set` reemplaza el bloque de ese día y no
toca los demás: re-ejecutarlo para corregir es seguro. Si el archivo está abierto en Excel, avisa.

`envio` no genera el archivo si algún día acumulado está bajo la cobertura vigente o tiene líneas TS
que no llegaron al libro (estas dos **no** se saltan con `--force`), o si una fila quedó sin código
Jira o sin cliente (`--force` lo genera y la explicación es del usuario).

## 7. Mantenimiento

- `remap --date`: reescribe en el libro las categorías retiradas por la vigente. Solo toca esa
  columna; no reordena ni recalcula.
- `fechas --date`: sella la columna de fecha de un libro ya escrito sin tocar actividades.

## 8. Horas extra

```
python -I "${CLAUDE_SKILL_DIR}/horas_extra.py" add  --fecha AAAA-MM-DD --desde HH:MM --hasta HH:MM --obs "<qué se hizo>" [--novedades "<resumen>"] [--festivo]
python -I "${CLAUDE_SKILL_DIR}/horas_extra.py" show --fecha AAAA-MM-DD
python -I "${CLAUDE_SKILL_DIR}/horas_extra.py" del  --fecha AAAA-MM-DD --desde HH:MM
```

Un archivo por corte (`horasExtra.cortes`); el primero de cada corte se crea copiando el formato
más reciente (conserva encabezado, documento y cargo). Una fila no cruza medianoche (`--hasta 00:00`
es 24:00; lo que sigue va al día siguiente). Diurna/nocturna según `horasExtra.diurna`; domingo o
festivo en las columnas de dominical/festivo. Las observaciones no llevan códigos de issue (el
formato va a nómina). Una línea TS de horas extra se marca en la bitácora como
`**TS fuera del timesheet (horas extra…):**` para que `set` no la exija en el libro. Antes de
radicar, `show` del corte. Avisar en los días de radicación que dice `horasExtra.politica`.
