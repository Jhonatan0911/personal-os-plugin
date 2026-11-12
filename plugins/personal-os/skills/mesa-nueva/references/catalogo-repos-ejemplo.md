# Catálogo de repos — nombre local → remote (ejemplo)

Molde del catálogo **tuyo**, que vive fuera del plugin (ruta en `mesa_nueva.catalogo_repos`; por
defecto `mesa-nueva/catalogo-repos.md` junto a tu `fuentes.yaml`). Cópialo allí la primera vez y
llénalo con lo **verificado** en los `.git/config` de tus mesas (tokens enmascarados), nunca inferido.
Es privado: nombra repos y proyectos de tu organización.

Formato del remote:

```
https://<PAT>@dev.azure.com/<org>/<proyecto>/_git/<repo>
```

- Org **viva**: `<org>`, proyecto `<proyecto>` (salvo lo indicado en cada tabla).
- Org **antigua** (`legacy`), si tu organización migró: `<org-antigua>`.
- `origin` **debe** ser el vivo; el antiguo se conserva como remote `legacy` (no se borra).

## <Ecosistema o módulo A>

| Carpeta local | Repo vivo (`<proyecto>`) | `legacy` (`<org-antigua>`) | Stack |
|---|---|---|---|
| `<CarpetaHistorica>` | `<repo-nuevo-frontend>` | `<ProyectoViejo>/_git/<RepoViejo>` | Angular 15 |
| `<otro-repo>` | `<otro-repo>` | — | .NET 8 |

## Repos renombrados al migrar de organización

La carpeta local conserva el nombre histórico; el remote lleva el nuevo. **No renombrar las carpetas**:
hay documentación, junctions y `launch profiles` que las referencian.

| Nombre histórico (carpeta) | Nombre nuevo (repo vivo) |
|---|---|
| `<CarpetaHistorica>` | `<repo-nuevo-frontend>` |

## Repos en otro proyecto u otra organización

Repos que no están en el proyecto por defecto (un proyecto transversal, uno que sigue solo en la org
antigua). Escribir el nombre del proyecto **exactamente** como está en el servidor, aunque tenga una
errata: "corregirlo" hace fallar el clone.

| Carpeta local | Remote | Stack |
|---|---|---|
| `<repo-transversal>` | `<org>/<ProyectoTransversal>/_git/<repo-transversal>` | — |

> Carpeta local **sin tildes** aunque el repo se llame con `ó`: la `ó` en rutas de Windows rompe
> MSBuild, npm y el quoting de git bash. El remote conserva el nombre real URL-encoded (`%C3%B3`).

## Notas por repo (lo que ahorra una hora)

Debajo de cada repo verificado, lo que no se ve a simple vista: puerto dev, nombre real del `.sln`
(con sus erratas), ramas que existen, si hay tests, secretos versionados (**descritos, nunca
transcritos**) y configuración que apunta a producción.

## Mantenimiento

Cuando una mesa use un repo que no esté aquí: pedir la URL, clonarlo y **añadir la fila** con org,
proyecto, repo y stack verificados. El catálogo solo sirve si está al día.
