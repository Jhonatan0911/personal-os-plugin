# Motor del status de la célula

Léelo al generar, al regenerar por delta, al convertir un JSON viejo o después de tocar la plantilla.

## Índice
1. Scripts y comandos
2. Formato del JSON y formato anterior
3. Regenerar el mismo día (delta)
4. Probar el tablero
5. Comparar contra un tablero anterior

## 1. Scripts y comandos

Todos viven en `<raíz del plugin>/scripts/` (Node, sin dependencias). Ninguno consulta la red.

| Script | Hace | Comando |
|---|---|---|
| `status-celula.js` | Calcula y audita (veredictos, colas, cobertura, métricas de Jira y timesheets); imprime cobertura y carga | `node status-celula.js <datos.json> [--carga N] [--hoy AAAA-MM-DD]` |
| `status-celula-inventario.js` | Pendientes con los que arranca el Gantt (cliente, colas, priorizar) | `node status-celula-inventario.js --datos <datos.json> --config <celula.json> [--extras <extras.json>] --salida <inventario.json>` |
| `status-celula-tablero.js` | Arma la página del tablero: plantilla + célula + organización + inventario | `node status-celula-tablero.js --config <celula.json> --organizacion <org.json> [--inventario <inv.json>] --salida <html>` |
| `status-celula.js --convertir` | Pasa un JSON del motor anterior al formato actual y lo guarda | `node status-celula.js <viejo.json> --convertir <nuevo.json>` |
| `status-celula-jira.js` | Normaliza los volcados del conector al bloque `jira` | `node status-celula-jira.js --corte AAAA-MM-DD --roster <roster.json> --salida <jira.json> --celula <volcados…> [--proyectos …] [--delta …] [--changelog …] [--campo-inicio customfield_X]` |
| `status-celula-fichas.js` | Escribe en `personas/` qué hizo cada quien según su timesheet, sin duplicar | `node status-celula-fichas.js <datos.json> [--dry-run]` |
| `status-celula-compartido.js` | Prepara los documentos y el `writes.json` del tablero compartido | ver `tablero-compartido.md` |
| `status-celula-config.js` | Baja a los archivos lo guardado en la pestaña ⚙ Configuración (o prepara la subida si el archivo es más nuevo) | `node status-celula-config.js --base <dir> --celula <json> --organizacion <json> [--extras <json>] [--motor <json>] [--subir <dir>] [--aplicar]` (ver `tablero-compartido.md` §2-bis) |

- El motor ya no escribe HTML: la página es la que arma `status-celula-tablero.js`.
- `--carga N` imprime la carga de los próximos N días hábiles por persona (horas asignadas / jornada, «+» si
  hay trabajo sin estimar) con la misma regla de la tira del cronograma. Es para el usuario, no para la mesa.
- El roster de `status-celula-jira.js` es un JSON con `celula` [{`jira`, `nombre`, `rol`}], `externos`,
  `proyectos` y `frentes` opcional; también acepta el `celula.json` del formato anterior (`proyectos_cliente`).

## 2. Formato del JSON y formato anterior

El formato completo está en la cabecera de `status-celula.js` y `ejemplo.json` lo muestra entero. Lo único
obligatorio es `personas` (con el líder marcado) e `items`; todo lo demás tiene valor por defecto.

El **formato anterior** (motor en Python: items ya anclados con `recortada`/`fin_real`, colas como
`tipo: "grupo"`, cierres como `tipo: "cerrada"`, bloque `jira` con `key`, `celula`, `proyectos_cliente`,
`alias`, bloque `lider` con `brief_fecha`, `colas`, `propias`) se detecta y se convierte solo
(`lib/status-celula-legado.js`):

- se restaura la fecha real de cada item y el motor la vuelve a anclar;
- las colas se recalculan, pero conservan la fecha de entrada de cada issue (la espera no cambia);
- líder y displayName salen de `jira.celula`; los titulares y backups pasan a `acuerdo_frentes`;
- lo que el motor anterior traía fijo (reparto 2/2, límite de 3 «en desarrollo», «en desarrollo» por nombre
  exacto) se copia solo si el JSON no lo trae. El motor lo anuncia en la terminal.

## 3. Regenerar el mismo día (delta)

1. Guarda los volcados de la lectura completa (célula, proyectos).
2. Para refrescar, pide solo `updated >= "<hora de la última lectura>"` con los mismos campos.
3. Vuelve a correr `status-celula-jira.js` con la lectura completa y **cada delta al final, en orden**
   (`--delta d1.json d2.json`). El delta reemplaza estado, fechas y tiempos; lo que no trae (comentarios,
   campo de inicio) se conserva.
4. Rearma los items desde ese bloque y regenera. Nunca se juntan dos lecturas completas.

## 4. Probar el tablero

`node "${CLAUDE_SKILL_DIR}/tablero/prueba-igualdad.js" <a.html> <b.html> [<carpeta-base>]` carga las dos páginas
en un DOM real, abre cada vista y compara lo que pintan (sin `<script>` ni `<style>`), además de contar los
errores de ejecución. Usos:

- **Tras tocar la plantilla:** `a` = la versión publicada (léela con la herramienta Artifact), `b` = la
  generada. Una diferencia buscada se revisa a ojo en esa vista; cualquier otra es un error.
- **Con datos:** `<carpeta-base>` tiene una subcarpeta por colección y un `.json` por documento (lo que deja
  `ArtifactData list` con `out_dir`). Sin ella, las vistas con datos solo muestran su estado vacío.
- **Otra célula:** con `a` = `b` = la página de `ejemplo-celula.json`, verifica que arranca sin errores.

Necesita **jsdom** (no viene con el plugin): `npm install jsdom` en cualquier carpeta y
`NODE_PATH=<esa carpeta>/node_modules`. Sale con 0 si todo pasa, 1 si algo falla y 2 si no puede correr. Si no
se puede correr, se dice en la entrega; no se da el tablero por probado.

## 5. Comparar contra un tablero anterior

Al cambiar de motor o de plantilla, genera los dos tableros con el mismo JSON (salida a una carpeta temporal,
nunca a la del usuario) y compara: carriles y número de barras por carril (plan y traza), tira de carga por
día, colas (personas, cantidad y espera), los KPIs de la cabecera, las tablas de Status Jira, los estados de
timesheets y las filas de frentes. Una diferencia se explica o se corrige; nunca se da por buena en silencio.
