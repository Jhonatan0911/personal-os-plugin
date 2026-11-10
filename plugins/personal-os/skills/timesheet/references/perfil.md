# Perfil de organización

Léelo al crear o ajustar un perfil, o cuando `libro.py perfil` diga que falta una clave. El perfil
activa el modo libro: todo lo que es de la organización o de la persona vive aquí, nunca en la
skill ni en los motores. Se parte de `perfiles/ejemplo.json`.

## Índice
1. Dónde se guarda y cómo se encuentra
2. Claves
3. Comprobar un perfil nuevo

## 1. Dónde se guarda

El perfil tiene datos personales (nombre, documento, destinatarios): va **fuera del plugin y de
cualquier repositorio público**. El motor lo busca, en orden:

1. `--perfil <ruta>` (libro.py y horas_extra.py)
2. variable de entorno `TIMESHEET_PERFIL`
3. `config.json` → `timesheet.perfil` (ruta)
4. `<PERSONAL_OS_HOME o ~/.claude/personal-os>/timesheet-perfil.json` ← ubicación recomendada

Si no encuentra ninguno, el modo libro no arranca y la skill usa el modo genérico.

## 2. Claves

| Clave | Para qué |
|---|---|
| `organizacion`, `persona.{nombre, identificacion, nombreCorto}` | Encabezado del libro, nombre del archivo de envío y a quién se le pide el OK en los mensajes |
| `rutas.base` | Carpeta raíz (plantilla, libros, envío, horas extra) |
| `rutas.bitacora` | Carpeta de la bitácora; si es `null`, `<stateDir>/bitacora` de config.json |
| `rutas.variablesEntorno.{base, bitacora}` | Variables de entorno que, si existen, mandan sobre las rutas (además de `TIMESHEET_DIR` y `TIMESHEET_BITACORA`) |
| `rutas.{plantilla, libros, carpetaMes, archivoSemana, envio}` | Plantilla relativa a la base y cómo se nombran carpetas y archivos (`{lunes:%Y-%m}`, `{viernes:…}`) |
| `libro.{hoja, dias, primeraFila, filasPorDia, maxFilasPorDia, filaTotal}` | Layout nominal de la plantilla |
| `libro.columnas` | Número de columna de fecha, cliente, categoria, jira, tarea, desde, hasta, asignadas, ejecutadas, observaciones |
| `libro.celdas`, `etiquetaTotal`, `marcaTotal`, `hojaParametros`, `columnaParametros`, `formatoFecha` | Encabezado, fila TOTAL y hoja donde viven las categorías del desplegable |
| `jornada.{lun…vie}` | Tramos `[["HH:MM","HH:MM"], …]`; la jornada del día es su suma |
| `almuerzo` | `["HH:MM","HH:MM"]` que la fórmula de horas ejecutadas descuenta (`null` = sin descuento) |
| `utcOffsetHoras` | Desfase de la hora local frente a UTC para leer el calendario (si falta, el del sistema) |
| `categorias`, `guiaCategorias`, `aliasCategorias`, `notasAlias` | Vigentes, qué va en cada una, etiquetas retiradas → vigente, y precisiones |
| `categoriasLider`, `categoriasSinIssue`, `categoriasReunion` | Uso exclusivo del líder; dónde vale «Sin issue»; cuáles son reuniones |
| `reunionesExigenIssueDesde` | Desde qué fecha toda reunión exige issue (`null` = no aplica) |
| `clientes`, `clienteInterno`, `guiaClientes`, `clientesRelleno` | Clientes conocidos, el único que admite «Sin issue», cómo elegir y qué cuenta como relleno |
| `marcas.{extra, extendida, sinIssue}` | Prefijos de observación que el motor reconoce |
| `formatoClave` | Regex de la clave de issue |
| `cobertura.{minimo, vigenteDesde, nota}` | % mínimo de horas con issue por día; `vigenteDesde: null` = solo avisa |
| `planeacionInicial` | Fila fija del arranque del día (desde, hasta, tarea, cliente, categoria, observaciones, regla) o `null` |
| `reuniones` | Orden para resolver la issue de una reunión, JQL de la tarea de ceremonias, épica y nota |
| `equipo` | Cruce con los timesheets del equipo: `obligatorio`, `asuntoContiene`, `remitentes`, `menciones`, `excluir`, `roster` |
| `excluir` | Trabajo que no va al timesheet (proyectos personales, estudios…) |
| `ejemplosRedaccion`, `insumosExternos`, `notas` | Texto que `libro.py perfil` muestra para la sesión |
| `envio.{nombreArchivo, asunto, asuntoUltimoDia, asuntoSet, destinatarios, reglas}` | Archivo y correo de envío; plantillas con `{nombre}`, `{fecha:…}`, `{lunes:…}`, `{viernes:…}` |
| `citas.{campos, categorias}` | Origen de la regla que los mensajes citan (p. ej. el correo que la fijó); opcional |
| `borrador.archivo` | Nombre del JSON de `borrador` cuando no se pasa `--out` |
| `horasExtra.*` | Carpeta, nombre del archivo por corte (`{nombre}`, `{corte}`, `{mes}`, `{anio}`), plantilla, filas y columnas del formato, `cortes`, `diurna`, `codigosProhibidos`, `radicarA`, `festivos` (se suman a los de config.json) y `politica` |

## 3. Comprobar un perfil nuevo

1. `python "${CLAUDE_SKILL_DIR}/libro.py" perfil`: debe listar rutas, jornada y categorías sin error.
2. `week --date <una fecha>` sobre una **copia** de la carpeta base (`TIMESHEET_DIR=<copia>`).
3. `set --parcial --sin-agenda "prueba"` de un día con 2-3 filas en la copia, y abrir el libro.
4. `envio` en la copia: revisar nombre del archivo, asunto y destinatarios.
