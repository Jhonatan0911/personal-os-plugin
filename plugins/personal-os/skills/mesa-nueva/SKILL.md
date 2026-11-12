---
name: mesa-nueva
description: Monta desde cero una mesa de trabajo multi-repo de Azure DevOps en la carpeta actual, a partir de un requerimiento inicial. Pregunta qué repos participan, los clona con el PAT, normaliza remotes y ramas, mapea cada codebase con subagentes en paralelo, redacta los contratos entre repos y deja la estructura (repos/ docs/ CONTRATOS/ scripts/ CLAUDE.md README.md MESA.json) lista para trabajar con GSD. Úsalo cuando el usuario diga "monta una mesa", "nueva mesa de trabajo", "arma la mesa para este requerimiento" o abra una carpeta vacía con un REQ y pida organizarla. No es para mover repos entre mesas ni para migrar repos entre proyectos (migrar-ramas).
---

# Mesa nueva — montaje de una mesa de trabajo multi-repo

**Invocación:** `/mesa-nueva` con el cwd en la carpeta de la mesa (normalmente recién creada,
a veces con el `.md` del requerimiento adentro).

**Idioma:** todo en español — carpetas, docs, contratos, ramas y mensajes de commit.

**Subagentes:** esta skill usa el Agent tool en paralelo por diseño. No hace falta volver a pedir
permiso para eso.

## Configuración (léela antes del paso 1)

Sección `mesa_nueva` de `<stateDir>/config/fuentes.yaml` (`<stateDir>` = carpeta de estado de
`~/.claude/personal-os/config.json`; forma y valores en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`):

| Clave | Para qué | Si falta |
|---|---|---|
| `azure_devops.organizacion` / `.proyecto` | org y proyecto vivos de los repos no catalogados | se pregunta y se guarda |
| `azure_devops.organizacion_legacy` | org antigua, para el remote `legacy` | sin `legacy` |
| `rama_trabajo` | patrón con `{mesa}` | se pregunta (propón `feature/{mesa}`) y se guarda |
| `catalogo_repos` | tu catálogo nombre local → remote | `mesa-nueva/catalogo-repos.md` junto a `fuentes.yaml`; si no existe, se crea desde `references/catalogo-repos-ejemplo.md` |
| `mesa_referencia` | mesa tuya que sirve de modelo: se replica su arquitectura **sin** sus carpetas de respaldo (`_respaldo-*`, `_copias-*`) | se usan los moldes de `references/plantillas.md` |
| `raiz_mesas` | carpeta donde viven tus mesas: ahí se buscan mesas vecinas que ya tengan el mismo repo (gotchas, configuración local apuntando a TEST) | no se buscan vecinas |
| `pat_en_remote_acordado` | el PAT en la URL del remote es práctica acordada | `false`: se avisa como riesgo |

El catálogo es **tuyo** y vive fuera del plugin: es donde se añaden los repos nuevos, para que una
actualización del plugin no los borre.

## Contrato de la skill (lo que garantiza)

1. La raíz de la mesa **no es un repo git**. Cada carpeta bajo `repos/` sí lo es.
2. **Un solo árbol de trabajo por repo**: `repos/<carpeta>`. Nunca dos copias del mismo repo.
3. **Ningún secreto en disco fuera del remote de git**: ni PAT, ni cadenas de conexión, ni
   contraseñas en `MESA.json`, docs, contratos o HANDOFF.
4. **BD: solo lectura, solo TEST, con OK explícito por consulta.** Los wrappers son la única vía.
5. Nada se sobrescribe sin mirarlo antes: si la carpeta ya tiene contenido, se detiene y pregunta.

---

## Paso 0 — Situarse

1. `cwd` = raíz de la mesa. Nombre de la mesa = nombre de la carpeta (confirmable en el paso 1).
2. Listar la carpeta. Casos:
   - **Vacía** o solo con `.md` → adelante.
   - **Ya tiene `MESA.json`** → no es una mesa nueva: reporta el estado con `<mesa>/scripts/mesa-status.ps1`
     y pregunta si lo que quiere es **agregar repos** (paso 3 en adelante, solo para los nuevos) o
     re-documentar (paso 6).
   - **Tiene otro contenido** (repos sueltos, carpetas ajenas) → **para** y pregunta antes de tocar nada.
3. Leer el requerimiento inicial: todo `.md` de la raíz. Ese texto es la entrada de todo lo demás
   (mesa, repos candidatos, líneas de trabajo). Si no hay ninguno, pedirlo antes de seguir: sin
   requerimiento la mesa no tiene para qué existir.
4. Si hay memoria persistente (`mem_search`), buscar el nombre de la mesa y los términos del
   requerimiento — puede haber contexto de sesiones previas (repos ya conocidos, gotchas, ramas).

## Paso 1 — Entrevista de arranque (UNA sola ronda)

Con `AskUserQuestion`, y proponiendo defaults derivados del requerimiento — que confirme, no que
redacte:

| Qué | Default propuesto |
|---|---|
| Nombre de la mesa | nombre de la carpeta |
| **Repos que participan** | los que aparezcan nombrados en el requerimiento, resueltos contra el catálogo |
| Rama de trabajo | `mesa_nueva.rama_trabajo` con `{mesa}` sustituido |
| Rama base por repo | **NO se pregunta aquí y NO se adivina** — se elige en el paso 3, viendo las ramas reales del servidor |
| ¿Una línea o varias? | una (plana). Con varias → se crea la capa `mesas/<NN>-<linea>/` con junctions |
| `appsettings` principal (para los wrappers de BD) | el del backend principal de la mesa |

Sobre los repos, pregunta abierta: **"dame los nombres de los repos"**. Luego:

- Los que estén en el catálogo → se resuelven a org/proyecto/repo y legacy **sin preguntar**.
- Los que no estén → pedir la URL de Azure DevOps (sin token) y, al terminar la mesa, **añadirlos al
  catálogo** para la próxima vez.
- ⚠️ **Repos renombrados al migrar de organización**: la **carpeta local conserva el nombre
  histórico** y el remote lleva el nuevo. El catálogo trae las dos columnas: respetarlas.
- ⚠️ **Sin tildes ni `ó` en nombres de carpeta local** aunque el repo remoto las tenga: rompen MSBuild,
  npm y el quoting de git bash en Windows. El remote conserva el nombre real (URL-encoded).

## Paso 2 — Esqueleto y manifiesto

Crear la estructura (plana; `mesas/` solo si hay varias líneas):

```
<mesa>/
├─ CONTRATOS/                 contratos entre repos — FUENTE DE VERDAD
├─ docs/
│   ├─ codebase/<repo>/       mapas por repo (7 archivos, paso 4)
│   ├─ INVENTARIO-REPOS.md    repos, remotes, ramas, sucios, riesgos
│   └─ FLUJO-END-TO-END.md    mapa transversal (solo si hay ≥2 repos)
├─ scripts/
│   ├─ mesa-clonar.ps1        clonado + normalización de remotes (pide el PAT)
│   ├─ mesa-status.ps1        estado git de los N repos, en una tabla
│   ├─ dbread.ps1             SQL solo lectura, solo TEST
│   ├─ mongoread.ps1 / .py    Mongo solo lectura, solo TEST
│   └─ sql/                   publicacion_req_<id>.sql + rollback_req_<id>.sql
├─ repos/<carpeta>/           ÚNICO árbol de trabajo por repo
├─ mesas/<NN>-<linea>/        (opcional) README de la línea + junctions a repos/
├─ .planning/                 GSD (paso 7, con OK)
├─ MESA.json                  manifiesto de la mesa
├─ CLAUDE.md   README.md   HANDOFF.md
└─ <REQ inicial>.md           se mueve a CONTRATOS/ si es el requerimiento formal del cliente
```

Copiar los cinco scripts desde `${CLAUDE_SKILL_DIR}/assets/` a `<mesa>/scripts/` y sustituir los
placeholders de los wrappers de BD (tabla en `references/mantenimiento.md` §Placeholders). Si la mesa
no tiene backend con esa cadena, dejarlo apuntando al primero y **decirlo en el reporte**: un wrapper
que apunta al appsettings equivocado falla ruidosamente (bien), pero conviene saberlo antes.

Escribir `MESA.json` — es lo que hace la mesa reproducible y lo que leen `mesa-clonar.ps1`,
`mesa-status.ps1` y `/retomar`:

```json
{
  "mesa": "<nombre>",
  "creada": "YYYY-MM-DD",
  "requerimiento": "CONTRATOS/REQ-....md",
  "ramaTrabajo": "<rama_trabajo con {mesa} sustituido>",
  "lineas": [],
  "appsettingsPrincipal": "repos/<Backend>/.../appsettings.json",
  "repos": [
    {
      "carpeta": "<CarpetaLocal>",
      "org": "<organizacion>",
      "proyecto": "<proyecto>",
      "repo": "<repo-vivo>",
      "legacy": { "org": "<org-antigua>", "proyecto": "<ProyectoViejo>", "repo": "<RepoViejo>" },
      "ramaBase": null,
      "stack": "Angular 15",
      "linea": null
    }
  ]
}
```

`legacy` es `null` si el repo no viene de otra organización. `ramaBase` nace en `null` **a
propósito**: se llena en el paso 3, cuando el líder elige viendo las ramas que existen de verdad.
**`MESA.json` nunca lleva el PAT ni cadenas de conexión.**

## Paso 3 — Clonar y elegir rama (tres fases, el PAT no pasa por el chat)

**Regla dura: la rama base la escoge el líder, nunca la skill.** Primero se baja el repo, se hace
`fetch`, se le muestran las ramas que existen en el servidor, y él dice de cuál se parte. Ni `main`
ni `master` ni "la default" valen como suposición.

### 3a · Clonar

Vía preferida — **que lo corra el usuario**, para que el token no quede en la transcripción:

> Pega esto en el prompt: `! .\scripts\mesa-clonar.ps1 -Fase clonar`

Pide el PAT con `Read-Host -AsSecureString`, lo verifica con un `git ls-remote` contra el primer repo
**antes** de clonar los N, clona cada uno en `repos/<carpeta>`, pone **`origin` = repo vivo** y
**`legacy` = org antigua** cuando el manifiesto lo declara, y **deja cada repo en la rama default del
servidor sin crear nada**. Enmascara el token en toda su salida.

### 3b · Elegir la rama base, repo por repo

La fase `clonar` termina listando, por repo, las ramas remotas ordenadas de la más reciente a la más
vieja con **fecha, autor, commit y asunto**. Si hace falta re-listarlas:
`.\scripts\mesa-clonar.ps1 -Fase ramas` (con `-Top 40` si son muchas).

Presenta esa lista y **pregunta por cada repo de cuál parte** (`AskUserQuestion`, una pregunta por
repo, ofreciendo como opciones las ramas más recientes). Cuando responda, escribe cada elección en el
campo `ramaBase` de `MESA.json`.

- Si quiere **trabajar directo sobre una rama existente** sin crear otra: pon esa misma rama en
  `ramaBase` **y** en `ramaTrabajo`. El script lo detecta y solo hace checkout.
- Si una rama que él nombra no aparece en el listado, **para y dilo** — puede ser una rama que nunca
  se pusheó desde otra máquina.

### 3c · Crear la rama de trabajo

> `! .\scripts\mesa-clonar.ps1 -Fase rama`

Hace checkout de la base elegida y crea la rama de trabajo **desde ahí**. Se niega a correr si algún
repo quedó sin `ramaBase`, y si la base no existe en `origin` no inventa un punto de partida: reporta
y sigue con los demás. También detecta la colisión de refs (`<prefijo>/<mesa>` a secas vs
`<prefijo>/<mesa>/qa`).

Recuérdale empujar la rama el mismo día que se crea:
`git -C repos\<repo> push -u origin <ramaTrabajo>`.

Fallback: si el usuario prefiere pegarte el PAT, úsalo en la sesión y **no lo escribas en ningún
archivo** salvo el remote. Nunca imprimas `git remote -v` ni `.git/config` sin enmascarar
(`-replace '://[^@/]+@','://<TOKEN>@'`).

El PAT queda embebido en la URL del remote. Si `pat_en_remote_acordado` es `true`, es la forma de
trabajo del equipo (los tokens expiran solos): **no es un hallazgo ni un riesgo que reportar**. Si es
`false`, menciónalo una vez en el reporte. En los dos casos: no pegar la salida de `git remote -v` en
correos, tickets ni documentos.

Al terminar, correr `<mesa>/scripts/mesa-status.ps1` y guardar su salida: es el insumo de
`docs/INVENTARIO-REPOS.md`.

**Configuración local**: una mesa recién clonada arranca con los `appsettings*.json` /
`environment*.ts` / `Web.config` **como estén commiteados**, que normalmente **no apuntan a TEST**.
Dejarlo dicho en el reporte y en el README: hay que re-apuntarlos a TEST a mano (o copiarlos de otra
mesa que ya los tenga: con `raiz_mesas`, di cuál mesa vecina tiene el mismo repo, sin abrir ni citar
sus cadenas) y **esos sucios permanentes no se commitean**.

## Paso 4 — Mapear los codebases (subagentes en paralelo)

Un subagente por repo, **todos en el mismo mensaje** para que corran concurrentes. Solo para repos
sin `docs/codebase/<carpeta>/` — nunca re-mapear lo que ya está.

Cada subagente escribe **7 archivos** en `docs/codebase/<carpeta>/`, el mismo juego que produce
`/gsd-map-codebase`:

`STACK.md` · `ARCHITECTURE.md` · `STRUCTURE.md` · `CONVENTIONS.md` · `INTEGRATIONS.md` ·
`CONCERNS.md` · `TESTING.md`

Prompt para cada uno (adaptar el nombre y la ruta):

> Mapea el repo en `repos/<carpeta>` (stack: `<stack>`) y escribe los 7 documentos en
> `docs/codebase/<carpeta>/`. Si el repo ya trae `CLAUDE.md`, léelo primero y **no lo contradigas
> sin evidencia**: es la fuente de verdad de comandos y arquitectura de ese repo (si lo que dice ya
> no es cierto, anótalo en `CONCERNS.md` con `file:line`).
> Cada afirmación debe ser verificable en el código con `file:line` — nada inferido de la
> documentación. En `INTEGRATIONS.md` interesa especialmente **con quién habla este repo**: HTTP
> salientes, colas, BD (SQL Server/Mongo), SPs y los DTOs de frontera; es el insumo de los
> contratos. En `CONCERNS.md`, riesgos reales con evidencia (secretos versionados, puertos que
> colisionan, ortografías intencionales que son contrato, legado sin referencias).
> **No ejecutes consultas a ninguna base de datos** y no imprimas secretos que encuentres: descríbelos
> ("credenciales versionadas en `appsettings.json:NN`") sin transcribir el valor.
> Español. Al terminar, devuelve un resumen de 10 líneas: stack, puerto dev, comandos de build/test,
> con quién se integra y los 3 riesgos principales.

Si el repo ya tiene o va a tener su propio `.planning/`, prefiere `Skill(gsd-map-codebase)` **dentro**
del repo y copia los resultados a `docs/codebase/<carpeta>/` (las copias no se editan a mano: se
regeneran).

## Paso 5 — Sintetizar: flujo y contratos

Cuando terminen los mapeadores, **un** subagente sintetizador con los 7×N mapas ya en disco:

1. **`docs/FLUJO-END-TO-END.md`** — el recorrido del negocio atravesando los repos, quién es dueño de
   cada paso, y dónde están las fronteras. Solo si hay ≥2 repos.
2. **`CONTRATOS/CONTRATO-<repoA>__<repoB>.md`** — uno por cada par de repos que se hablan (según los
   `INTEGRATIONS.md`), en **BORRADOR** y con la plantilla de `references/plantillas.md` §3: endpoints,
   envoltorio de respuesta, DTOs con ejemplos `jsonc` **reales**, validaciones server-side y — lo que
   más valor tiene — las **reglas que rompen la intuición**, con el *por qué* y la alternativa
   descartada. Cierra con **Fuentes de verdad** (`file:line`).
3. **`docs/INVENTARIO-REPOS.md`** — desde la salida de `mesa-status.ps1`: repo, org/proyecto/repo vivo,
   legacy, stack, rama, HEAD, ahead/behind, sucios, y una sección de **trampas** (remotes de la org
   antigua, repos renombrados, ramas solo locales, refs que colisionan).

**Nada de PAT en estos documentos.** El inventario nombra los repos, no las URLs con token.

Reglas de contratos, que van también al `CLAUDE.md` de la mesa:

- Se **editan en `CONTRATOS/`** y se sincronizan a los `docs/` de los repos involucrados **en el mismo PR**.
- Un contrato dice qué se promete y **qué no** (alcance explícito).
- Los estados de negocio no son errores HTTP: si el contrato lo decide así, decirlo y explicar por qué.

## Paso 6 — `CLAUDE.md` y `README.md` de la raíz

Plantillas completas en `references/plantillas.md` (o los documentos de `mesa_referencia`, si hay).
Lo esencial:

**`README.md`** — para un humano que llega: qué es la mesa, tabla "Quiero… / Leer", el árbol de
carpetas comentado, tabla de repos (carpeta · repo en Azure · stack · puerto dev), reglas de la raíz,
cómo se trabaja aquí, estado y pendientes conocidos.

**`CLAUDE.md`** — para Claude en la próxima sesión: que esto **no es un repo único** sino un
workspace; tabla de proyectos con su `CLAUDE.md` propio como fuente de verdad; la forma de trabajo
(GSD + contratos); comandos rápidos por repo con **las colisiones de puerto marcadas**; convenciones
transversales; la **convención obligatoria de `publicacion_req_<id>.sql` / `rollback_req_<id>.sql`**
(un cambio = un bloque `[NN]` numerado, orden por dependencia, idempotente, atómico con
`SET XACT_ABORT ON`, append-only, **y Claude no los ejecuta**); y las reglas de BD con los wrappers
y sus flags (`-ConfirmDb`, `TOP(N)`, `--Limit`, `--Project`, `-DryRun`).

## Paso 7 — Cierre (requiere OK explícito)

Al terminar los pasos 0-6, **reporta y propón** — no lo ejecutes de corrido:

1. `/gsd-new-project` con el requerimiento como entrada, para levantar `.planning/`
   (PROJECT.md → REQUIREMENTS.md → ROADMAP.md).
2. `/checkpoint` para dejar `HANDOFF.md` + memoria persistente.

Mientras no haya `.planning/`, escribe al menos un `HANDOFF.md` mínimo con el estado del montaje
(`references/plantillas.md` §6): si la sesión se corta, `/retomar` tiene de dónde agarrarse.

## Checklist de verificación final

Antes de reportar "lista", comprobar y decir el resultado de cada punto:

- [ ] Cada repo del manifiesto existe en `repos/`, en la rama de trabajo **creada desde la base que
      eligió el líder** (registrada en `MESA.json.repos[].ramaBase`), y `origin` apunta al repo **vivo**.
- [ ] Ninguna rama base quedó adivinada: si no hubo elección explícita, la rama no se creó.
- [ ] `mesa-status.ps1` corre y su salida coincide con `docs/INVENTARIO-REPOS.md`.
- [ ] `docs/codebase/<repo>/` tiene los 7 archivos por cada repo mapeado.
- [ ] Hay un contrato por cada par de repos que se hablan, marcado BORRADOR y con fecha.
- [ ] `dbread.ps1 -DryRun` muestra servidor + catálogo correctos y **no** imprime contraseñas.
- [ ] `grep` de la mesa por el PAT y por `password=` no devuelve nada fuera de `.git/config` y de los
      `appsettings` versionados que ya venían así en el repo.
- [ ] `README.md`, `CLAUDE.md`, `MESA.json` y `HANDOFF.md` existen y son coherentes entre sí.
- [ ] Los repos nuevos que no estaban en el catálogo quedaron **añadidos** a tu catálogo
      (`mesa_nueva.catalogo_repos`), no a la carpeta de la skill.

## Errores que esta skill existe para evitar

Cada uno costó una consolidación completa en una mesa real:

1. **Dos árboles de trabajo del mismo repo** en mesas distintas, divergiendo en silencio. De ahí la
   regla de un solo `repos/<repo>` y la capa `mesas/` como **junctions** (`New-Item -ItemType Junction`),
   no copias ni worktrees: git no permite la misma rama en dos worktrees, y editar
   `mesas/<linea>/<repo>/x.ts` y `repos/<repo>/x.ts` debe ser **el mismo archivo**.
2. **`origin` apuntando a la organización antigua**: un `git push origin` sin revisarlo sube el
   trabajo al repo muerto. Verificar remotes **antes** de cualquier push.
3. **Ramas que nunca se pushearon** y commits que solo existían en local. Empujar la rama de trabajo
   al servidor el mismo día que se crea.
4. **Un ref y una carpeta de refs con el mismo nombre**: si existe `<prefijo>/<mesa>`, git rechaza crear
   `<prefijo>/<mesa>/qa`. Comprobar antes con `git ls-remote --heads origin` y renombrar el viejo a
   `<prefijo>/<mesa>-legacy` en vez de improvisar otro nombre.
5. **Worktree o clon nuevo que no hereda los sucios de configuración** y arranca contra el destino
   commiteado, que no es TEST.
6. **Contratos duplicados que divergen**: por eso `CONTRATOS/` es la fuente de verdad y las copias en
   los repos viajan en el mismo PR.

## Fuera de alcance

- **Mover repos entre mesas** o consolidar mesas existentes: es cirugía, se hace con respaldo previo
  (`git bundle` de cada repo) y no la hace esta skill.
- **Migrar repos entre proyectos u organizaciones** de Azure DevOps: eso es `migrar-ramas`.
- **Ejecutar escrituras de BD**: se redactan como entregable en `<mesa>/scripts/sql/` y las ejecuta el usuario/DBA.
- **Rotar o crear PATs**: eso lo hace el líder en Azure DevOps.

## Archivos

| Archivo | Cuándo leerlo |
|---|---|
| `config-ejemplo.yaml` | Al crear o completar la sección `mesa_nueva` de `fuentes.yaml` |
| `references/plantillas.md` | Pasos 5-7: moldes de README, CLAUDE.md, contratos, inventario y HANDOFF |
| `references/catalogo-repos-ejemplo.md` | Solo si el usuario aún no tiene catálogo: se copia a su ruta y se llena |
| `references/mantenimiento.md` | Al copiar los scripts (placeholders) o si vas a editar los de `assets/` |
| `assets/mesa-clonar.ps1`, `mesa-status.ps1`, `dbread.ps1`, `mongoread.ps1`, `mongoread.py` | Se **copian** a `<mesa>/scripts/`; no se ejecutan desde la skill |
