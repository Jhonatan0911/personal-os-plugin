---
name: migrar-ramas
description: Depura y migra repositorios entre proyectos de Azure DevOps (Branching V2). Cada líder escoge su proyecto de origen y sus destinos; la skill inventaría los repos pendientes, documenta todas sus ramas (autor, fecha, adelante/atrás, qué traen) con agentes, recomienda la rama de producción y publica una página donde el líder decide repo por repo (migrar, no migrar, duda o «va a otro proyecto»; un transversal u otro cliente). Con las decisiones arma el plan de migración y solo lo ejecuta con la orden explícita del líder por lote. Úsala cuando digan "migrar ramas", "branching", "qué rama está en producción", "pasar los repos a la nueva organización" o "depurar los repos de un proyecto". No es para montar una mesa de trabajo (mesa-nueva) ni para revisar un PR (revisar-pr).
---

# Migración de ramas (Branching V2)

Una sola página para que el líder depure cientos de repos y ramas de un proyecto de Azure DevOps y
decida qué se migra, a dónde y desde qué rama. Sirve para cualquier líder y cualquier par de proyectos.

## Reglas que no se negocian

1. **Claude no decide.** Muestra datos y recomienda; la decisión la marca el líder en la página.
   Ni siquiera lo que parece obvio (un repo que ya está en el proyecto transversal es un dato, no un «No migrar»).
2. **Solo lectura hasta la orden.** Los pasos 1 a 6 solo leen Azure DevOps. Crear repos o subir ramas
   (paso 7 con `--ejecutar`) exige que el líder diga **qué lote** y lo apruebe en esta conversación. Cada lote, su OK.
3. **La credencial no se toca.** Los scripts la piden a `git credential fill` (o usan `AZDO_PAT` de la
   sesión) y la usan en memoria. Nunca imprimir, guardar ni pegar el PAT. Si no hay credencial, el líder
   clona un repo de la organización una vez.
4. **Nada se fuerza.** Si una rama a crear ya existe en el destino con otro commit, el repo se salta y se revisa a mano.
5. Archivos de trabajo en el scratchpad de la sesión (`<trabajo>`). Al terminar, **copiar `<trabajo>` a
   `carpeta_respaldo`**: el scratchpad se borra y sin `data.json` no se puede volver a publicar.

## Configuración

Sección `migrar_ramas` de `<stateDir>/config/fuentes.yaml` (`<stateDir>` = carpeta de estado de
`~/.claude/personal-os/config.json`; forma en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`). Si falta
`azure_devops.organizacion`, pregúntala en el modal y ofrece guardarla; lo demás tiene valor por
defecto. En adelante `<org>` es esa organización y `S` = `python -I "${CLAUDE_SKILL_DIR}/scripts`.
**Todo script que habla con Azure recibe `--org <org>`** (los que leen `data.json` la toman de ahí).

## Paso 0 — Preguntar (AskUserQuestion)

- Nombre del líder (va en el título de la página): `lider` o `owner.nombre`.
- Si ya existe una página suya de migración: `pagina_url`; entonces se **actualiza**, no se crea otra.
- Si `lideres` tiene filas, úsalas como referencia para proponer sus proyectos en el paso 1 (no son asignación).
  Si la fila trae `nota` (p. ej. «ya migrado»), dísela antes de inventariar: puede que no haya nada pendiente.

## Paso 1 — Proyectos de la organización

```
S/proyectos.py" "<trabajo>" --org <org>
```
Muestra cada proyecto con su número de repos y deja `proyectos.json`. Preguntar al líder:
- **Origen**: de dónde salen los repos (`origen_por_defecto` como propuesta; puede ser más de uno, separados por coma).
- **Destinos**: a dónde van (uno o varios, separados por coma).
- **Cómo se reconocen sus repos dentro del origen**: una palabra o regex que aparezca en el nombre del repo
  o de sus ramas (`<cliente>`, `<cliente>|<prefijo>-`), o una lista de repos en un .txt. Sin filtro se toman todos.

## Paso 2 — Inventario

```
S/inventario.py" "<trabajo>" --org <org> --origen <Origen> --destinos <Destino> \
       --incluir "<filtro>" [--excluir "poc|test"] [--repos mis_repos.txt] \
       [--destino-regex "<Destino2>=<regex>"] [--incluir-existentes]
```
Cruza por nombre contra los destinos y deja `pendientes.json`. Reportar los números al líder
(pendientes, ya existen, fuera del filtro, vacíos, sin acceso, ya existen en otro proyecto) y
**confirmar que el universo es el suyo** antes de seguir: si el filtro trae repos de otro cliente o le faltan, se ajusta aquí.
Límite: un repo renombrado en el destino sale como pendiente; el líder lo marca «No migrar» o «Va a otro proyecto».

## Paso 3 — Detalle de ramas

```
S/detalle.py" "<trabajo>"
```
Por rama: adelante/atrás de la base, último autor y fecha, 15 últimos commits y archivos tocados.
Deja `ramas_detalle.json` y `lotes/loteN.json` (hasta 8, balanceados por número de ramas). Tarda unos minutos.

## Paso 4 — Agentes: recomendación y qué trae cada rama

Un agente `general-purpose` por lote, **todos en el mismo mensaje** (en paralelo). Prompt de cada uno:

> Lee `<trabajo>/lotes/loteN.json`. Cada repo trae sus ramas con fecha, autor, commits adelante/atrás de la
> base, historial y archivos tocados. Para cada repo decide qué rama es la que con más probabilidad está
> **en producción para el cliente de destino `<destinos>`** (pista del cliente: `<filtro>`). Criterios: rama del
> cliente (`<filtro>`) o la base si no hay; merges de «publicación»/«prod»/«release»; la punta más nueva que
> contenga a las demás; desconfía de ramas `qa`, `test`, `feature/*` sin merge y de ramas de otros clientes.
> Escribe `<trabajo>/lotes/recN.json` con esta forma exacta:
> `{"<repo>": {"recomendada": "<rama>", "confianza": "alta|media|baja", "porque": "1-2 frases con fechas y autores",
> "riesgo": "otra rama con trabajo posterior o duda real, o vacío", "nota": "repo de otro cliente, vacío, viejo, duplicado…, o vacío",
> "ramas": {"<rama>": "resumen técnico corto de sus últimos commits"},
> "fn": {"<rama>": "qué trae en lenguaje funcional, a partir de los archivos tocados (módulos, pantallas, integraciones)"}}}`
> Todas las ramas de todos los repos del lote van en `ramas` y `fn`. Solo datos del archivo; no inventes.
> Español con tildes. No ejecutes nada contra Azure ni git.

Verificar que existan todos los `recN.json` y que sean JSON válido antes de seguir.

## Paso 5 — Unir

```
S/unir.py" "<trabajo>" --lider "<Nombre del líder>" --clave "<filtro>" \
       [--transversal "<proyecto_transversal>"] [--marca "<marca>"]
```
Deja `<trabajo>/artefacto/data.json` (con la lista de proyectos para el botón «Va a otro proyecto»).
Reporta repos sin recomendación: si hay, relanzar el agente de ese lote.

## Paso 6 — Publicar la página

1. Copiar `${CLAUDE_SKILL_DIR}/assets/index.html` a `<trabajo>/artefacto/index.html` (no editarla: todo sale de `data.json`).
2. Publicar con la herramienta Artifact:
   - `file_path`: `<trabajo>/artefacto/index.html`
   - `files`: `{"data.json": "<trabajo>/artefacto/data.json"}`
   - `capabilities`: `{"db": {}, "user": {}, "sample": {}}` (decisiones compartidas, quién decidió, chat sobre las ramas)
   - `icon`: `branch` · primera vez sin `url`; si el líder ya tiene página, con su `url` (antes `action: read`).
3. Darle el enlace y ofrecer guardarlo en `pagina_url`. La página guarda cada decisión en la colección `decisiones`:
   `{repo, decision: migrar|otro|no|duda, rama, extras[], destino[], nota, origen, por, fecha}`.
   «Va a otro proyecto» guarda el proyecto escogido en `destino`.
   Para compartirla con su equipo: menú Compartir de la página (Claude no cambia permisos).

## Paso 7 — Seguimiento, respaldo y plan

- **Leer decisiones:** ArtifactData `list` de `decisiones` con `out_dir` = `<trabajo>/decisiones` (límite 1000).
  Resumir: decididos / total, por decisión, dudas agrupadas por a quién hay que preguntar (sale de las notas;
  las que no nombran a nadie van a `coordinador`, si está configurado).
- **Respaldo Excel** (cada vez que avance):
  `S/respaldo_excel.py" "<trabajo>/decisiones/decisiones" "<trabajo>/artefacto/data.json" "<salida>.xlsx"`
- **Plan de migración** (solo lectura, por defecto):
  `S/plan_migracion.py" "<trabajo>/decisiones/decisiones" "<trabajo>/artefacto/data.json" "<trabajo>" [--alias "<Nombre>=<PROY>" …]`
  (un `--alias` por cada entrada de `alias_proyectos`). Deja `plan_migracion.md`: repo, origen, destino
  (incluye los «Va a otro proyecto»), rama → `main`, ramas V2 y adicionales.
- **Ejecutar un lote — solo con la orden del líder para ESE lote:** mostrarle la tabla del lote y esperar su OK.
  `... plan_migracion.py ... --repos repo1,repo2 --ejecutar [--ramas-v2 "<ramas_v2 separadas por coma>"]`
  Crea el repo si no existe, sube la rama como `main`, crea desde `main` las ramas de `--ramas-v2`
  (por defecto `develop,qa,staging`; si `ramas_v2` está vacía, pasa `--sin-ramas-v2`) y sube las adicionales con su nombre.
  Es reanudable (`ejecucion.jsonl`). Reportar repo por repo lo que dijo la salida.
- **Al cerrar la migración** (último lote ejecutado o el líder la da por terminada): recordarle revocar el
  token personal que usó y borrar la variable `AZDO_PAT` de su sesión y de su perfil.
- **Políticas de rama** (si el líder pregunta quién debe aprobar en el destino):
  `S/politicas.py" --org <org> <Proyecto>/<repo> […]` (solo lectura).

## Paso 8 — Refrescar ramas (botón «↻ Refrescar ramas» de cada repo)

La página no puede consultar Azure (sin conector y sin PAT en el navegador): el botón deja un pedido en
la colección `refrescos` (`{repo, estado: "pendiente", pedido, por}`) y Claude lo atiende. Cuando el
líder diga «refresca» (o con `/loop 3m procesa los refrescos de la página de ramas` durante una sesión de depuración):

1. ArtifactData `query` de `refrescos` con `where: [["estado","==","pendiente"]]`. Si no hay, no hacer nada.
2. `S/refrescar.py" "<trabajo>/artefacto/data.json" "<trabajo>/refrescos" repo1 repo2 …` (solo lectura).
3. ArtifactData `batch`: por repo, `set` de `ramas/<doc_id>` con `file_path` del JSON (con `if_version` si ya existía)
   y `update` de `refrescos/<doc_id>` a `{estado: "hecho", hecho: <fecha>}` (o `{estado: "error", error}`) con su `if_version`.
4. La página superpone las ramas nuevas al instante y conserva el análisis de las que ya existían; las nuevas
   salen marcadas «nueva» y sin análisis. Si el líder lo pide, analizar las nuevas como en el paso 4 y regenerar `data.json`.

## Gotchas

- Las migraciones viejas aplanaron el historial: ningún SHA coincide entre organización vieja y nueva.
  Para saber si algo ya se migró se compara el **árbol** (`git rev-parse <rama>^{tree}`), no el commit.
- `git` no lista repos: el inventario real sale de la API. `size: 0` de la API no es confiable; manda `ls-remote`.
- Un repo puede necesitar más de una rama (p. ej. una `feature/*` viva además de la de producción): «Ramas adicionales» en la página.
- Si hay inventarios previos (Excel, hojas compartidas) con PAT en texto plano: no abrirlos ni citarlos.
- Publicar recarga la página de quien la tenga abierta; las decisiones no se pierden (viven en la base).

## Cuándo NO usarla

- Montar una mesa de trabajo con varios repos para un requerimiento → `mesa-nueva`.
- Revisar un PR antes de aprobarlo → `revisar-pr`.
- Crear políticas de rama o permisos en Azure DevOps: se hace en Azure; esta skill solo las lee.

## Archivos

| Archivo | Cuándo |
|---|---|
| `config-ejemplo.yaml` | Al crear o completar la sección `migrar_ramas` |
| `scripts/azdo.py` | Módulo común (credencial, `--org`); no se corre solo |
| `scripts/proyectos.py`, `inventario.py`, `detalle.py`, `unir.py` | Pasos 1, 2, 3 y 5 |
| `scripts/respaldo_excel.py`, `plan_migracion.py`, `politicas.py` | Paso 7 |
| `scripts/refrescar.py` | Paso 8 |
| `assets/index.html` | Paso 6: se copia tal cual y se publica con `data.json` |
