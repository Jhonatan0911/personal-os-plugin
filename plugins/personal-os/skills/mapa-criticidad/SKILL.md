---
name: mapa-criticidad
description: Arma y mantiene el mapa de criticidad de los módulos del producto (el análisis de impacto del negocio de cada módulo) en cinco ejes de 1 a 5 — transaccionalidad, dinero, norma, usuarios y reversibilidad —, cada valor con su evidencia citada, para que el líder lo valide una vez por módulo y lo reutilicen la ficha de impacto, el refutador, la regresión y la revisión de PR. Calcula el índice con un script y propone (nunca ejecuta) los conteos de volumetría. Úsala cuando digan "mapa de criticidad", "qué tan crítico es este módulo", "califica los módulos", "validemos la criticidad", "qué módulos faltan por validar", "agrega este módulo al mapa" o "mide la volumetría de los módulos". No es para estimar ni planear un requerimiento (planear-sprint), ni para mantener la tabla de normas, ni para ejecutar pruebas de regresión.
argument-hint: "[sembrar|validar|ver|volumetria] [módulo]"
---

# mapa-criticidad — qué tan grave es romper cada módulo

Se califica **el módulo**, no el requerimiento: es estable, se hace una vez y se reutiliza en cada
cambio que lo toque. **Un valor sin evidencia es inventado**: si no hay fuente, el eje queda en null
con «por validar» y el script lo trata como hueco.

**Dónde está cada cosa.** El mapa vive en `<stateDir>/criticidad/modulos.json` (`<stateDir>` es la
carpeta de estado de `~/.claude/personal-os/config.json`). Anclas por nivel, esquema, fórmula, usos y
procedimiento de volumetría: `references/anclas.md` (léelo antes de calificar). El script:
`python -I "${CLAUDE_SKILL_DIR}/scripts/criticidad.py" --archivo "<stateDir>/criticidad/modulos.json" [opciones]`
(en PowerShell, antes `$env:PYTHONIOENCODING="utf-8"`).

## Reglas que no se negocian

- **Evidencia por eje**, con archivo y sección. Lo que el líder dijo vale como evidencia solo si quedó
  escrito en algún lugar que se pueda citar.
- **El líder valida cada módulo una vez** (`validado_por_lider: true` + `validado_el`). Si después
  cambia un valor validado, vuelve a `false` hasta que lo confirme. Nunca marques validado por tu cuenta.
- **Bases de datos: nada se ejecuta solo.** La volumetría se propone; cada consulta necesita el comando
  exacto, el servidor y la base destino (solo pruebas o staging, solo lectura) y el OK explícito del
  líder en esa conversación, por consulta. Sin wrapper de solo lectura del proyecto, no se consulta.
  Procedimiento: `references/anclas.md` §6.
- **El script manda sobre el cálculo**: no calcules el índice a mano ni lo redondees distinto.
- **Riesgo del proyecto ≠ criticidad del módulo.** Un frente atrasado o con rotación va como
  evidencia `general`, no sube ningún eje.

## Procedimiento

### Sembrar (primera vez o módulo nuevo)
1. Lee las fuentes que existan en el estado y en el equipo; no preguntes lo que puedas leer:
   diccionario de frentes (`<stateDir>/personas/_dominios.md`), guías de regresión por grupo, bases de
   conocimiento por repo (funcional, datos, dependencias, contratos), documentación funcional, mesas de
   trabajo, notas de alcance y de riesgo, expedientes de requerimientos y la investigación de normas.
   Si no sabes dónde están, pregúntalo una vez en el modal y guarda la ruta en
   `<stateDir>/config/fuentes.yaml` bajo `criticidad.fuentes`.
2. Por módulo: `id` (slug), nombre, descripción de una línea, frentes y repos. Califica cada eje con las
   anclas; si no hay evidencia, null y «por validar: qué falta».
3. Corre el script sin opciones: debe decir «esquema válido». Corrige todo error antes de seguir.

### Validar con el líder
1. `--pendientes` lista los módulos sin validar, los de más huecos primero.
2. Por módulo, muestra en el chat la ficha (`--modulo <id>`: ejes, índice, rango y evidencia) y
   pregunta en el modal: validar tal cual · ajustar ejes (él dice cuáles y por qué) · dejar para
   después. Hasta 4 módulos por tanda de modales.
3. Lo que él ajuste entra como evidencia con su texto y la fecha. Al validar, `validado_por_lider: true`
   y `validado_el`. Corre el script otra vez.

### Usar en un requerimiento
`--modulos a,b --json` devuelve la criticidad combinada (peor valor por eje) y los módulos sin validar.
Así la consumen la ficha de impacto, el refutador, la regresión y la revisión (tabla en
`references/anclas.md` §5). Si un módulo tocado no está en el mapa, agrégalo antes (sembrar).

### Volumetría
`--volumetria <id>` imprime las consultas de conteo propuestas; no se conecta a nada. Sigue
`references/anclas.md` §6 consulta por consulta y registra cada medición con su OK.

## Salida

Al terminar, en el chat: la tabla del script (índice, rango, nivel, ejes, validado), los módulos con
más huecos y qué falta para cada uno, y lo que espera del líder (validaciones y consultas por aprobar).

## Cuándo NO usarla

- Estimar, planear o armar la ficha completa de un requerimiento → planear-sprint (que lee este mapa).
- Mantener la tabla de normas vigentes → la pieza dueña de `normas.json`; aquí solo se cita.
- Ejecutar la regresión o la revisión funcional → sus propias skills; este mapa solo decide la profundidad.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/anclas.md` | Antes de calificar o validar: anclas, evidencia, esquema, fórmula, usos y volumetría |
| `scripts/criticidad.py` | Se ejecuta: valida el JSON, calcula índice y nivel, lista pendientes, combina módulos y propone conteos |
