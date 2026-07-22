---
name: tablero-diario
description: Regenera el tablero visual HTML del día desde el estado.
---

# Skill: tablero-diario

Genera/regenera el tablero visual del día en `estado/tablero.html`: una vista bonita y de lectura
rápida sobre el estado reconciliado. Es una VISTA, no la fuente de verdad (esa sigue siendo `estado/`).

## Cuándo se ejecuta
- Al final del `brief-diario` (paso 6): se regenera junto con `estado/tablero.md`.
- On-demand con el comando `/tablero` (ver `.claude/commands/tablero.md`).
- No se auto-dispara sin sesión: eso es v2 (cron). En v1.0 se arma al abrir el día o cuando lo pidas.

## Arquitectura del archivo
- **Un solo `.html` autónomo** en `estado/tablero.html`. Sin CDNs, sin dependencias, se abre con doble clic.
- **Data-driven:** todo el contenido vive en arrays JS al inicio del `<script>`. Regenerar = actualizar
  esos arrays; **no toques el CSS ni las funciones de render** salvo que cambie el diseño.
- **CSS theme-aware** (claro/oscuro con `prefers-color-scheme`), responsive (grid → 1 columna en móvil).
- **Fechas dinámicas:** `daysTo(fecha)` calcula días contra el `new Date()` real, así el contador y los
  "vencido/en Nd" siguen vivos aunque abras el archivo otro día. Las fechas se guardan como `YYYY-MM-DD`.
- **Local, nunca publicado:** contiene datos operativos de clientes de salud e incidencias internas.
  NO usar la herramienta Artifact ni subirlo a ningún servicio. Solo archivo local.

## Modelo de datos (arrays del `<script>`)
Mantener estos nombres y campos; el render depende de ellos:
- `DEADLINE_1` — fecha `YYYY-MM-DD` de la entrega #1 (alimenta el contador del hero).
- `ayer[]` — `{t (qué se hizo ayer), note (evidencia/detalle opcional)}`. Columna **Ayer** de la tarjeta de standup (arriba del todo). Solo cosas hechas y evidenciadas del día anterior. La etiqueta de fecha se calcula sola (hoy − 1).
- `hoy[]` — `{t (compromiso del día), note (opcional)}`. Columna **Hoy** de la tarjeta de standup. Versión corta y accionable de las recomendaciones del día (mismas que `propuesta[]`). Pensada para leerla en el daily.
- `riesgos[]` — `{id, tk (ticket), n (nivel 3/2/1, 0=delegado), est (etiqueta), t (título), d (descripción), mit (mitigación)}`.
- `bloqueos[]` — `{tk, t, por}` (puntos de líder pausados y su causa).
- `vencidos[]` — `{tk, f (fecha), tag}` (se ordenan solos por urgencia).
- `compromisos[]` — `{tk, t, est, note}`.
- `agenda[]` — `{h (hora Bogotá), t}` (reuniones de hoy, traídas de Outlook en solo lectura).
- `timeline[]` — `{d (día), wd (Mar/Mié…), t, p}` (actividad reciente, estilo reporte PITS).
- `propuesta[]` — strings (disponibilidad / plan del día).
- `semana[]` — `{b (cifra), s (etiqueta)}` (KPIs de la semana, tipo PITS).

Los KPIs de la cabecera se calculan solos desde estos arrays (días a #1, riesgos críticos, vencidos, compromisos).

## Pasos para regenerar
1. Asegura el estado reconciliado: si no hubo `brief-diario` hoy, córrelo primero (lee `estado/` + fuentes).
2. Lee `estado/tablero.md`, `riesgos.md`, `compromisos.md` y los `proyectos/*.md` activos.
3. Trae la **agenda de hoy** de Outlook (solo lectura) y conviértela a hora Bogotá (UTC−5) para `agenda[]`.
4. Edita los arrays de `estado/tablero.html` para que reflejen 1:1 lo que dice `tablero.md`. Deja CSS/JS intactos.
5. Verifica coherencia: cada riesgo/vencido/compromiso del `.md` debe existir en el `.html` y viceversa.
6. **Abre el tablero** para lectura inmediata (auto-open): Windows `Start-Process "<stateDir>/tablero.html"`; macOS `open`; Linux `xdg-open`. Es archivo local: abrir ≠ publicar (nunca uses Artifact ni lo subas).

## Reglas
- El `.html` NUNCA contradice al `.md`. Si difieren, gana el `.md` (que a su vez se reconcilió con Jira).
- No inventes datos: si una fuente no respondió, no la pintes.
- Un riesgo delegado (nivel 0) se muestra en gris, sin acción de Jhonatan.
- Regla de origen: la regla "regenerar tablero al cerrar el brief" vive en `CLAUDE.md` §11; aquí solo el CÓMO.
