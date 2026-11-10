---
name: worklist-lider
description: Publica y mantiene la Worklist del líder — la cabina donde el líder técnico ve todos sus requerimientos y bugs en curso (lista con filtros por nivel A/B/C, módulo, paso y criticidad; detalle del expediente por pasos 0-6, o detalle corto con ficha, compromisos y cortes para los trámites y bugs; cola de revisión de Jira; chat de un analista que cita fuentes). Carga los expedientes de la carpeta de estado en la base de la página y refresca Jira en solo lectura. Úsala cuando digan "worklist", "lista de trabajo del líder", "cabina del líder", "actualiza la worklist", "carga los expedientes", "refresca la cola de revisión" o "publica la worklist". No es para planear un requerimiento (planear-sprint), ni para el tablero del equipo (status-celula), ni para revisar un PR (revisar-pr).
argument-hint: "[publicar | cargar | jira]"
---

# worklist-lider — la cabina del líder

Una página privada (Artifact) con todos los casos en curso: lista a la izquierda, el expediente del caso a la
derecha (un **Resumen** primero —paso actual, compromiso, dudas, cola y avance en Jira— y el resto en pestañas:
Ficha e impacto, Dudas, Plan, Técnica, Historias, Calidad) y un **botón flotante** por caso que abre el chat de un
analista que responde con el expediente y, en solo lectura, con Jira y el correo. **La copia local del
expediente manda**; la página es una vista con las marcas del líder encima.

## Dónde está cada cosa

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. Los scripts se corren con
`python -I "${CLAUDE_SKILL_DIR}/scripts/<script>.py"` (en adelante, sin la ruta) y aceptan `--estado <stateDir>`.

- Expedientes: `<stateDir>/requerimientos/<slug>/expediente.json` (esquema v2 de
  `planear-sprint/references/expediente.md`, campos de nivel de `planear-sprint/references/niveles.md`).
- Configuración: `<stateDir>/config/fuentes.yaml` → `flujo`, `jira`, `status_celula.estados.revision`,
  `worklist` (opcional). Detalle y colecciones de la base: `references/configuracion.md`.
- Salidas (privadas, nunca en el plugin): `<stateDir>/worklist/worklist.html` y `<stateDir>/worklist/carga/`.

## Seguridad

- **Jira y el correo se leen, nunca se escriben.** Las consultas son de solo lectura; nada se comenta ni mueve.
- **La colección `marcas` es del líder**: ningún script ni lote la escribe. Antes de cambiar un expediente
  local, trae las marcas (ArtifactData `list` de `marcas`) y pásalas a la copia local si deben quedar.
- **El expediente no se incrusta en el HTML** y no lleva datos sensibles de personas: si `cargar.py` avisa de
  números de 7-10 dígitos, revísalos antes de cargar.
- La página es **privada**: no se comparte con quien no deba ver los expedientes.

## Procedimiento

**Publicar o cambiar la página** («publica la worklist», o tras cambiar `fuentes.yaml`):
1. `build.py [--marca <marca.json>]` — lee `flujo`, `jira.cloud_id`, `jira.sitio`, conectores y estados de
   revisión. Lee sus `AVISO` al líder (p. ej. sin `cloud_id` el chat no consulta Jira).
2. Carga la skill `artifact-capabilities` y publica `<stateDir>/worklist/worklist.html` con la herramienta
   **Artifact** declarando `db` (colecciones `req`, `expediente`, `marcas`, `cola`, `criticidad`), `user`,
   `sample` y `mcp` de solo lectura (`searchJiraIssuesUsingJql`, `outlook_email_search`, `read_resource`).
   Para actualizarla, pasa el `url` guardado en `fuentes.yaml` → `worklist.url` (léelo antes con `read`).
   La primera vez, ofrece guardar la URL ahí. Nunca la hagas pública.

**Cargar los expedientes** («carga los expedientes», «actualiza la worklist»):
1. `cargar.py` — valida cada expediente (también `nivel` y `ficha_corta`), calcula la completitud solo con los
   pasos de su nivel y deja `carga/lote.json`. Sale con 1 si alguno no valida: muestra los errores, ese
   expediente queda fuera y el resto sí se carga.
2. Lee las versiones vigentes con ArtifactData `list` de `req`, `expediente` y `cola`; guárdalas como
   `{"expediente/<slug>": n, "req/<slug>": n, "cola/actual": n}` y corre `cargar.py --versiones <archivo>`.
3. Envía cada lote de `lote.json` con ArtifactData **`batch`** (hasta 50 escrituras por lote). Si una falla por
   versión, relee, vuelve al paso 2 y no pises lo ajeno.
4. Presenta el resumen: por caso, nivel, completitud, lo que falta, compromisos vigentes y cortes pendientes con
   responsable y tipo. **Un corte o compromiso sin responsable o sin fecha se dice primero.**

**Refrescar Jira y la cola de revisión** (cada mañana o antes de revisar):
1. `sync-jira.py --consultas` imprime las JQL (claves de los expedientes, hijas y la cola de la célula).
2. Córrelas con `searchJiraIssuesUsingJql` (cloudId de `jira.cloud_id`, campos que indica el script, paginando)
   y guarda cada respuesta en una carpeta temporal vacía.
3. `sync-jira.py <carpeta>/*.json` — escribe en cada expediente solo `jira_estado`, `jira_sync`,
   `cola_revision` y `sin_expediente`, y deja `requerimientos/_cola_revision.json`.
4. Sigue con «Cargar los expedientes».

## Reglas

- **Un paso que no aplica al nivel es «no aplica»**, no pendiente: no se reporta ni cuenta en la completitud.
- **El estado de Jira es la evidencia**; el comentario de un desarrollador no cierra nada.
- Sin sección `flujo` (o con `niveles_activos: false`) todo caso es del flujo completo y la página no muestra
  niveles. El nivel lo puede cambiar el líder en la página (queda en `marcas`): avísale que lo pase a la copia local.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/configuracion.md` | Configurar `fuentes.yaml`, la marca, o entender la base de la página |
| `plantilla.html` | Solo para cambiar la página; luego `build.py` y republicar |
| `scripts/*.py` | Se ejecutan, no se leen (`comun.py` es un módulo). Pruebas: `python -I -m unittest discover -s "${CLAUDE_SKILL_DIR}/scripts/pruebas"` |
