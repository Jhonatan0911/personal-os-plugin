---
name: consola-neuronal
description: Regenera la consola neuronal (vista HTML local del estado) desde las notas y la abre en el navegador. Úsala cuando el usuario diga "/consola", "regenera la consola", "actualiza el cerebro" o quiera ver el mapa de proyectos, riesgos y bitácora del día.
---

# Skill: consola-neuronal

Genera/regenera la **consola neuronal** en `<stateDir>/consola.html`: una vista "segundo cerebro" con
el grafo sináptico de proyectos e ítems abiertos, los signos vitales y la bitácora del día. Es una
**VISTA**, no la fuente de verdad (esa sigue siendo la carpeta de estado). Es **distinta y
complementaria** al `tablero.html` del brief: el tablero es el reporte ejecutivo lineal; la consola es
el mapa navegable.

## Local y privada — NUNCA se publica
La consola muestra datos operativos del usuario (riesgos, compromisos, alcances con clientes, la
bitácora). **No uses la herramienta Artifact, no la subas a ningún servicio, no la adjuntes, no la
copies a un repositorio.** Es un archivo local que se abre con doble clic. Abrirla en el navegador
local ≠ publicarla. Si el usuario quiere mostrarla a alguien, la alternativa es una captura que él
mismo revise, nunca un enlace.

## Cuándo se ejecuta
- On-demand con el comando `/consola`.
- Cuando el usuario pida "regenera la consola" o "actualiza el cerebro".
- No se auto-dispara ni se regenera en cada brief salvo que se pida.

## Cómo está armada
- **El build escribe, la consola lee.** `build-consola.js` (en `scripts/` del plugin) genera dos archivos
  en la carpeta de estado:
  - `consola.html` — copia de la plantilla del plugin (`plantillas/consola.html`), **sin datos dentro**.
  - `_datos/datos.js` — los datos vivos como `window.ESTADO = { NODES, ITEMS, SINAPSIS, PRIO, … }`.
  **Regenerar = correr el build. Nunca edites el HTML ni `datos.js` a mano:** si un dato sale mal, se
  arregla en la NOTA o en el layout y se vuelve a correr. Cuando los datos vivían pegados en el HTML
  había que transcribirlos a mano y la consola quedaba vieja en días.
- **`<script src>` y no `fetch()` a propósito:** con protocolo `file://` el navegador bloquea `fetch` de
  archivos locales, pero una etiqueta script sí carga. Por eso se abre con doble clic, sin servidor.
- **El layout es diseño y no se regenera.** `fx`, `fy` (fracciones 0–1), `r`, `label`, `full`, `scope`
  (`laboral` | `personal`) y `parent` viven en `<stateDir>/config/consola-layout.json`, ajustados a mano.
  Si no existe, el build usa el **ejemplo del plugin** (`plantillas/consola-layout.json`, nodos
  ficticios "Cliente A", "Cliente B", "PROY"…) y lo avisa: propón al usuario copiarlo a su `config/` y
  poner ahí sus proyectos. Convención: laboral a la DERECHA, personal a la IZQUIERDA, núcleo al centro.
- **Diseño personalizado (opcional):** si existe `<stateDir>/config/consola.html`, el build la usa en
  lugar de la plantilla del plugin. Si tu configuración vive fuera del estado, pásala con
  `--config-dir <ruta>` (layout y plantilla se leen de ahí).
- **Pendientes personales (opcional):** si el layout declara `prefijo_item_a_nodo` (p. ej. `"BOT": "bot"`),
  el build lee los bloques `- id: P-<PREFIJO>-<n>` de `<stateDir>/personal/*.md` (campos `titulo`,
  `detalle`, `nivel`, `estado`, `siguiente_paso`) y los cuelga del nodo personal correspondiente.
  Así se ven los proyectos personales junto a los laborales; el toggle de ámbito los separa.
- Consola oscura a propósito (es una pantalla, no un documento). Respeta `prefers-reduced-motion`.
- El pie dice **siempre de qué día son los datos** y avisa en naranja si no son de hoy.

## Modelo de datos (`window.ESTADO`)
- `NODES[]` — `{id, label, full, kind ('core' | —), scope ('laboral' | 'personal' | 'both'), parent?, fx, fy, r, issues}`.
  - Un nodo `kind: "core"` es el núcleo, al centro. Si el layout no lo trae, el build pone uno.
  - **`parent` = sub-nodo:** cuelga de otro nodo en vez del núcleo (p. ej. los módulos de un curso).
    Los sub-nodos no cuentan como proyecto propio en los signos vitales.
  - `issues` = resumen del tooltip: los 3 ítems más graves del nodo (lo compone el build).
- `ITEMS[]` — `{id, cli (id del nodo), clase, nivel (1-3), estado, tag, label}`. El ámbito se hereda del nodo.
  - **Riesgos** (`riesgos/`): `nivel` declarado en la nota; se omiten los cerrados.
  - **Compromisos** (`compromisos/`): nivel derivado — vencido = 3, con `fecha_limite` futura = 2, sin fecha = 1.
  - **Alcances** (`alcances/`): nivel 3 si está vencido, sin `fecha_entrega` o con puntos sin dueño
    (`puntos_sin_issue` / `puntos_sin_responsable` / `puntos_sin_fecha`); 2 si entrega en ≤ 5 días hábiles; 1 si no.
  - El nodo sale del campo `proyecto` (o `cliente`) de la nota, traducido con `mapa_proyecto_a_nodo`
    del layout (sin distinguir mayúsculas ni tildes; si el valor ya es el id, label o nombre de un
    nodo, no hace falta mapearlo). Si no resuelve, va al `nodo_por_defecto` o a un nodo **SIN NODO**
    que el build crea al vuelo: **un ítem sin nodo nunca se oculta**, se ve y se avisa.
- `SINAPSIS[]` — `{t (HH:MM), scope, label}`: las líneas `- **OS:** …` de `bitacora/AAAA-MM-DD.md` del
  día (los prompts crudos no cuentan). El ámbito es una heurística declarada: es `personal` si el
  resumen contiene un término de `sinapsis_personal.terminos` o el label de un nodo personal.
- `PRIO` — `{laboral:{v,note}, ambas:{v,note}, personal:{v,note}}`: la prioridad #1 por ámbito. Es
  **juicio, no dato**: el build la lee de `_datos/prioridad.json` y, si no existe, la consola dice
  "sin fijar" en vez de inventarla.
- `hito` (opcional, del layout) — `{etiqueta, fecha}` que el pie cuenta como "en Nd".

El conmutador **Ambas / Laboral / Personal** filtra grafo, signos vitales, tarjetas y bitácora.

## Pasos para regenerar
1. **Estado reconciliado:** si hoy no ha corrido el `brief-diario`, propón correrlo primero (lee el
   estado y cruza las fuentes en solo lectura).
2. **Prioridad del día:** si el brief fijó la #1, escríbela en `<stateDir>/_datos/prioridad.json` con la
   forma `{"laboral":{"v":"…","note":"…"},"ambas":{…},"personal":{…}}`. Es lo único que el build no
   puede derivar. No la inventes: si no hay #1 fijada, deja que la consola diga "sin fijar".
3. **Corre el build:**
   `node "<raíz del plugin>/scripts/build-consola.js"`
   La raíz del plugin aparece en el contexto de la sesión en la línea **"Scripts del plugin:"** que
   inyecta el hook de arranque. Opciones: `--dry-run` (solo muestra el resumen y los avisos),
   `--hoy AAAA-MM-DD` (otra fecha), `--estado <ruta>` (otra carpeta de estado, para pruebas).
4. **Lee los avisos del build y trátalos como trabajo, no como ruido:** cada uno señala un dato que
   falta en la fuente (una nota sin frontmatter, un proyecto que no está en el layout, la bitácora sin
   líneas OS, el layout de ejemplo en uso). Propón la corrección en la nota o en el layout.
5. **Ábrela en el navegador por defecto** (es local; abrir no es publicar):
   - Windows (PowerShell): `Start-Process "<stateDir>\consola.html"`
   - macOS: `open "<stateDir>/consola.html"`
   - Linux: `xdg-open "<stateDir>/consola.html"`
6. **Cierra en 2–3 líneas** con qué cambió (ítems nuevos o cerrados, cambio de #1, sinapsis nuevas) y
   los avisos que quedaron pendientes.

## Reglas
- La consola **nunca contradice** a las notas: si difieren, gana la nota y se vuelve a correr el build.
- No inventes datos ni posiciones: un proyecto sin nodo se avisa, no se dibuja en un lugar inventado.
- No toques el CSS ni el render de la plantilla salvo que el usuario pida un rediseño (y entonces,
  en `<stateDir>/config/consola.html`, no en el plugin).
