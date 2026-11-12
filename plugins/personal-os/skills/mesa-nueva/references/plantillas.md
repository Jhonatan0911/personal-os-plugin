# Plantillas de documentos de la mesa

Moldes probados en una mesa real de varios repos. Si `mesa_nueva.mesa_referencia` apunta a una mesa
tuya ya organizada, sus documentos mandan sobre estos moldes. Rellenar con lo verificado — **nada
inferido**. Todo en español. Ningún secreto, ninguna URL con token, ningún dato de paciente.

## Índice
1. `README.md` (raíz)
2. `CLAUDE.md` (raíz)
3. `CONTRATOS/CONTRATO-<repoA>__<repoB>.md`
4. `docs/INVENTARIO-REPOS.md`
5. `mesas/<NN>-<linea>/README.md`
6. `HANDOFF.md` mínimo del montaje

---

## `README.md` (raíz) — para un humano que llega

```markdown
# <mesa> — workspace unificado

<Una frase: qué problema de negocio resuelve esta mesa y qué repos toca.>

Montada el <YYYY-MM-DD> a partir de `<requerimiento>`.

> Esta raíz **no es un repo git**. Cada carpeta bajo `repos/` sí lo es.

## Por dónde empezar

| Quiero… | Leer |
|---|---|
| entender el flujo completo y quién es dueño de cada paso | **`docs/FLUJO-END-TO-END.md`** |
| saber qué repo está en qué rama, con qué remote y qué falta pushear | **`docs/INVENTARIO-REPOS.md`** |
| los contratos entre repos | `CONTRATOS/` |
| la arquitectura interna de un repo | `docs/codebase/<repo>/` o el `CLAUDE.md` del repo |

## Estructura

​```
<árbol comentado, una línea por carpeta explicando para qué sirve>
​```

## Los N repos

| Carpeta | Azure DevOps | Stack | Rama |
|---|---|---|---|

> <Excepciones de nombre: carpetas sin tilde, repos renombrados al migrar de organización.>

## Reglas de esta raíz

1. **`origin` es el repo vivo.** Verificar antes de cualquier push (detalle en `docs/INVENTARIO-REPOS.md`).
2. **Los remotes traen el PAT embebido.** <Si `mesa_nueva.pat_en_remote_acordado` es true: es la forma
   de trabajo acordada del equipo y no es un pendiente ni un riesgo abierto.> Nunca pegar la salida de
   `git remote -v` en correos, tickets ni documentos.
3. **No commitear configuración local.** `appsettings*.json`, `environment*.ts`, `Web.config` re-apuntados
   a TEST aparecen sucios de forma permanente y así deben quedarse. <Archivos que NUNCA se commitean.>
4. **BD: solo lectura, solo TEST, confirmando cada consulta.** Únicas vías `scripts/dbread.ps1` y
   `scripts/mongoread.py` (con `-DryRun`/`--DryRun` para mostrar el destino y pedir OK). Las escrituras
   se **redactan** como `publicacion_req_<id>.sql` + `rollback_req_<id>.sql` en `scripts/sql/`; las
   ejecuta el usuario/DBA.
5. **Español** en dominio, código, ramas y mensajes.
6. **Los contratos se editan en `CONTRATOS/`** y se sincronizan a los `docs/` de los repos involucrados
   en el mismo PR.

## Cómo se trabaja aquí

**Hay un solo árbol de trabajo por repo: `repos/<repo>`, en la rama `<ramaTrabajo>`** (creada desde
`<ramaBase>` de cada repo — ver `MESA.json`).

<Si hay capa mesas/: `mesas/<linea>/` no son copias ni worktrees: son **junctions de Windows** al mismo
repo, más un README con el foco, el estado y los gates de esa línea. Editar
`mesas/<linea>/<repo>/x.ts` y `repos/<repo>/x.ts` es **exactamente el mismo archivo**.>

## Estado

- [ ] Repos clonados y remotes normalizados
- [ ] Rama de trabajo creada y **pusheada** en los N
- [ ] Codebases mapeados (`docs/codebase/`)
- [ ] Contratos redactados (borrador / vigente)
- [ ] Configuración local re-apuntada a TEST

## Pendientes conocidos

<Lo que a un yo-futuro le dolería no saber: ramas solo locales, repos sin versionar, docs desactualizados.>
```

---

## `CLAUDE.md` (raíz) — para Claude en la próxima sesión

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este directorio

Este NO es un repositorio único: es el **workspace de <mesa>**, que agrupa N proyectos
independientes, cada uno con su propio `CLAUDE.md` (fuente de verdad de comandos y arquitectura —
leerlo antes de tocar código de ese proyecto):

| Proyecto | Qué es | Stack | Puerto dev |
|---|---|---|---|

Flujo del ecosistema: <A → B → C, marcando qué contratos están vigentes y cuáles en borrador.>

<Documentación oficial de terceros: dónde vive y qué hay que leer ANTES de diseñar contra ella.>

## Forma de trabajo: GSD + contratos

- **Siempre se trabaja con agentes GSD** (skills `gsd-*`): `/gsd-map-codebase` para mapear,
  `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` para el ciclo de fases.
- **`docs/codebase/<repo>/`** guarda los mapas consolidados de cada repo (regenerar con
  `/gsd-map-codebase` dentro del repo y re-copiar; **no editar las copias a mano**).
- **Regla de contratos:** se editan en `CONTRATOS/` y se sincronizan a los `docs/` de los repos
  involucrados **en el mismo PR**. Las dos copias cambian juntas o divergen.

## Comandos rápidos (detalle en el CLAUDE.md de cada proyecto)

​```powershell
<build / serve / test por repo>
​```

⚠️ **Colisiones de puerto:** <si dos servicios usan el mismo puerto, decirlo aquí y no levantarlos juntos.>
<Qué proyectos tienen tests y cuáles no.>

## Convenciones transversales

- **Español** en dominio, mensajes y comentarios.
- <Envoltorio de respuesta común y convención de status codes.>
- <Ortografías intencionales que son contrato — mantenerlas al referenciar namespaces.>
- <Legado sin referencias que NO debe usarse como patrón.>

## Estado git

<Qué repos están versionados, en qué rama, y que esta raíz no es repo — no correr git desde aquí.>

## Scripts de BD (publicación / rollback) — convención obligatoria

Toda modificación de base de datos (INSERT/UPDATE/DELETE, CREATE/ALTER/DROP, correcciones de datos,
alteración de stored procedures) se registra en `scripts/sql/`. Nunca cambios sueltos ni solo
aplicados a mano.

Por cada requerimiento, exactamente dos archivos:

- `scripts/sql/publicacion_req_<id>.sql` — todos los cambios, en orden de dependencia (arriba → abajo).
- `scripts/sql/rollback_req_<id>.sql` — el inverso de cada cambio, en orden inverso.

1. **Un cambio = un bloque numerado `[NN]`** con descripción, objeto afectado y motivo. El mismo `NN`
   conecta la publicación con su rollback.
2. **Orden por dependencia.** Tablas/columnas antes que los SPs que las usan; padres antes que hijos.
3. **Idempotencia.** Cada bloque con `IF [NOT] EXISTS` / verificaciones: re-ejecutar es seguro.
4. **Atomicidad.** La publicación va en una transacción con `SET XACT_ABORT ON` + `TRY/CATCH`.
5. **Append-only.** No editar bloques ya ejecutados en un entorno; agregar al final (y su rollback al inicio).
6. **Claude NO ejecuta estos scripts contra la BD.** Son entregable de despliegue; los ejecuta el usuario/DBA.

## Reglas de acceso a la base de datos

**Solo lectura, solo TEST, y con OK explícito del usuario por CADA consulta** (script exacto +
servidor + BD antes de ejecutar; una aprobación no cubre la siguiente).

​```powershell
scripts\dbread.ps1 -ConfirmDb <catalogo_test> -Query "SELECT TOP(10) ..." -DryRun
scripts\mongoread.ps1 --ConfirmDb <bd_test> --Collection <col> --Filter '{...}' --Project '{...}' --Limit 5 --DryRun
​```

`-DryRun`/`--DryRun` muestra el destino sin ejecutar: esa salida es la que se usa para pedir el OK.
`TOP(N)` y `--Limit` son obligatorios; `--Project` evita volcar documentos completos. Nunca imprimir
cadenas de conexión, contraseñas ni tokens, ni volcar datos de pacientes más allá de lo necesario.
```

---

## `CONTRATOS/CONTRATO-<repoA>__<repoB>.md`

```markdown
# Contrato de integración — <repoA> ↔ <repoB>

> **Estado:** BORRADOR | VIGENTE · **Verificado contra el código:** YYYY-MM-DD

<Qué es este contrato en una frase.> Este documento vive en **ambos** repositorios y debe mantenerse
sincronizado; si cambia un endpoint, actualizar las dos copias en el mismo PR.

| Componente | Rol | Stack | Repo |
|---|---|---|---|

- **Base URL:** `{...}` — en test `...`
- **Cliente:** `<file:line>` · **Proveedor:** `<file:line>`
- **Serialización:** <camelCase/snake_case, query vs body>

> **Alcance:** <qué queda FUERA de este contrato.>

## Envoltorio de respuesta

<Forma común de las respuestas + convención de status codes.>

## Endpoints

| # | Método | Endpoint | Entrada | `data` |
|---|---|---|---|---|

### Validaciones server-side (rechazo 400)

## <Detalle por endpoint>

<Ejemplos `jsonc` REALES cuando existan, con la fecha y el ambiente en que se capturaron.>

## Reglas que rompen la intuición

<Lo más valioso del contrato: cada regla con su POR QUÉ y la alternativa que se descartó.
Ejemplo: "yaEnviado agregado es TODAS y al menos una, NO alguna — si fuera 'alguna', el diálogo
y la lista dirían cosas distintas de la misma cita".>

## Fuentes de verdad

- **Proveedor:** `<archivo:línea>` (controlador, DTOs, servicio)
- **Consumidor:** `<archivo:línea>` (cliente, DTOs, catálogo de URLs)

_Verificado contra el código a <fecha>. <Qué falta por verificar contra el ambiente real.>_
```

---

## `docs/INVENTARIO-REPOS.md`

```markdown
# Inventario de repos — <mesa>

> Levantado el <fecha> con `scripts/mesa-status.ps1`. Verificado con git, no inferido.

## 1. Los N repos

| Repo (carpeta) | Azure DevOps | Stack | Rama base | Rama de trabajo |
|---|---|---|---|---|

## 2. Remotes

| Repo | `origin` (vivo) | `legacy` |
|---|---|---|

⚠️ Los remotes traen el PAT embebido: **no pegar la salida de `git remote -v`** en correos, tickets
ni documentos.

## 3. Estado al montar

| Repo | Rama | HEAD | vs upstream | sucios |
|---|---|---|---|---|

## 4. Trampas de esta mesa

<Remotes de la org antigua, repos renombrados, ramas solo locales, refs que colisionan,
configuración local que hay que re-apuntar a TEST, secretos versionados que ya venían así.>
```

---

## `mesas/<NN>-<linea>/README.md` (solo si hay varias líneas)

```markdown
# Mesa <NN> · <título de la línea>

<Qué persigue esta línea, en 2-3 líneas. Qué reemplaza o a qué da continuidad.>

## Repos (junctions a `../../repos/`)

| Carpeta | Qué es | Stack | Puerto dev |
|---|---|---|---|

> Todos en la rama **`<ramaTrabajo>`**.

## Core value

<La frase que dice cuándo esta línea sirvió de algo.>

## Contratos

<Rutas a `../../CONTRATOS/…` y estado de cada uno.>

## Arquitectura

​```
<diagrama de texto del recorrido>
​```

<Dos o tres cosas que rompen la intuición en esta línea.>

## Comandos

## BD

<Scripts de esta línea en `../../scripts/sql/`.>

## Dependencias externas

## Riesgos abiertos
```

---

## `HANDOFF.md` mínimo del montaje

```markdown
# HANDOFF — <mesa>
> Memoria de sesión. La genera `/checkpoint`, la lee `/retomar`. Actualizado: YYYY-MM-DD HH:MM

## Estado actual
Mesa montada con `/mesa-nueva`: N repos clonados en `repos/`, rama `<ramaTrabajo>` desde `<ramaBase>`,
codebases mapeados en `docs/codebase/`, contratos en borrador en `CONTRATOS/`.

## Decisiones y gotchas
- <fecha> Rama base elegida por repo (y por qué esa y no otra).
- <fecha> <Trampas encontradas al clonar: remotes, renombres, colisiones de ref.>

## Pendientes priorizados
1. (alta) Re-apuntar la configuración local a TEST en <repos>.
2. (alta) Pushear `<ramaTrabajo>` en los repos donde falte.
3. (media) Promover los contratos de BORRADOR a VIGENTE tras verificarlos contra el ambiente real.

## Cómo levantar
<comandos por repo>

## Siguiente paso sugerido
<UNA cosa concreta.>
```
