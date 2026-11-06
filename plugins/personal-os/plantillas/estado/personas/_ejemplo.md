---
tipo: persona
nombre: "Ana Ejemplo"
slug: ana-ejemplo
alias: [ana, anita]
estado: activo
relacion: reporta
rol: "Desarrolladora backend"
desde: 2026-01-12
hasta: null

identidades:
  jira: null
  correo: null
  git: []
  azure: null
  verificado: false

frentes:
  - clave: facturacion
    nivel: dueno
    desde: 2026-02-02
    hasta: null
    fuente: declarado
    evidencia: "Construyó el módulo de facturación electrónica (PROY-142)"
    registrado_el: 2026-02-02
  - clave: reportes
    nivel: toco
    desde: 2026-01-12
    hasta: 2026-03-01
    fuente: jira
    evidencia: "Dos issues de reportes cerradas en enero (PROY-118, PROY-121)"
    registrado_el: 2026-01-20

clientes: ["Cliente A"]
proyectos: ["PROY"]

derivado_el: null
issues_abiertas: null
issues_vencidas: null
ultimo_movimiento_jira: null
conflictos: []
---

# Ana Ejemplo

> ⚠️ **ARCHIVO DE EJEMPLO — persona, cliente e issues ficticios.** Los scripts del módulo
> ignoran todo archivo que empiece por `_`, así que esta nota nunca aparece en las consultas.
> Para una ficha real no hace falta copiarla: `personas-append.js <persona> --hecho "…" --crear`
> la crea con este mismo formato. Puedes borrar este archivo cuando quieras.

<!--
Guía de campos (todo vive en el frontmatter; el cuerpo es libre salvo la sección "## Historial"):

  nombre / slug / alias   Cómo se la nombra. El slug es el nombre del archivo sin .md. Los alias
                          son cómo la llamas en la conversación ("ana", "anita").
  estado                  activo | fuera-de-celula (cubre frentes desde otro equipo) | ambiguo
                          (identidad dudosa: no se le atribuye nada derivado) | inactivo
  relacion                reporta (te reporta a ti; solo estas entran en `libre`) | par | externo
  identidades             Usuario de Jira, correo y autores de git. `verificado: true` solo cuando
                          confirmaste que son de ESTA persona (mezclar dos personas envenena todo).
  frentes                 Hechos fechados: clave (debe existir en _dominios.md), nivel
                          (dueno | trabaja | toco | aprende), desde, hasta (null = vigente),
                          fuente (declarado | jira | git | mixto), evidencia y registrado_el.
                          Un hecho que cambia NO se borra: se cierra con `hasta`.
  derivado_el / issues_*  Los escribe el asistente al cruzar con Jira en SOLO LECTURA.
  conflictos              Choques entre lo declarado y lo derivado, en texto.
-->

## Cómo trabaja

- Prefiere recibir los requisitos por escrito antes de estimar. *(fuente: declarado, 2026-02-02)*

## Historial

- **2026-01-20** [reportes] — Cerró dos issues de reportes del Cliente A. *(fuente: jira; PROY-118, PROY-121)*
- **2026-02-02** [facturacion] — Queda como dueña del módulo de facturación. *(fuente: declarado; construyó el módulo (PROY-142))*
- **2026-03-01** [reportes] — Deja de tocar reportes para concentrarse en facturación. *(fuente: declarado)*
