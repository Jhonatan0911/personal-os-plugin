# Alcances — compromisos de entrega con fecha

Un compromiso de entrega = **una nota** en esta carpeta. Lo vigila `alcances-scan.js` en cada
arranque de sesión (bloque `⚠️ VIGÍA DE COMPROMISOS`) y sus `hitos` en cada prompt (`⏰ HITOS CON FECHA`).

**La unidad de seguimiento es el punto prometido, no la issue.** Los puntos NO se copian aquí: se
leen de su **fuente viva** (el Excel, la diapositiva, el JQL). Aquí solo va el resultado del cruce.

Los archivos que empiezan por `_` (como `_ejemplo.md`) son plantillas: el vigía los ignora.

## Frontmatter

| Campo | Obligatorio | Qué es |
|---|---|---|
| `id` | sí | Identificador corto (`A-001`). |
| `nombre` | sí | Qué se prometió, en lenguaje normal. |
| `cliente` | sí | A quién (o "Interno", "Universidad"…). |
| `estado` | sí | `activo` · `cumplido` · `incumplido` · `cancelado`. |
| `fecha_entrega` | sí | `AAAA-MM-DD`. Sin fecha no se puede vigilar. |
| `fuente` | sí | Objeto con al menos uno: `ruta`, `web_url`, `uri`, `item_id`, `jql`. |
| `verificado_el` | tras cada cruce | Fecha del último cruce punto por punto. |
| `puntos_total` | tras cada cruce | Cuántos puntos tiene la fuente. |
| `puntos_con_dueno` | tras cada cruce | Con issue, responsable y fecha. |
| `puntos_sin_issue` · `puntos_sin_responsable` · `puntos_sin_fecha` | tras cada cruce | Se solapan; cada uno es riesgo nivel 3. |
| `puntos_estado_enganoso` | tras cada cruce | En un estado que Jira cuenta como cerrado sin estarlo. |
| `puntos_bloqueados` + `bloqueo_detalle` | tras cada cruce | Esperando a un tercero: desde cuándo y a quién. |
| `puntos_brecha_estado` | tras cada cruce | "Hechos" según el equipo pero sin mover en Jira. |
| `hitos` | si hay | Lista `"AAAA-MM-DD \| qué \| estado"`; estado vacío = pendiente, `hecho: <evidencia>` = cumplido. |
| `alias` · `issue_paraguas` | opcional | Palabras distintivas y la issue que agrupa, para no confundirlo con otros. |

## Cómo se cruza (todos los días hábiles hasta cumplirse)
1. Abrir la fuente viva y recorrer **punto por punto**.
2. Buscar cada punto en Jira **por clave, nunca por título**. Fusiones → se declaran en el cuerpo.
3. El `status` de Jira es la evidencia; el comentario del desarrollador no. Si difieren, se dicen los dos.
4. Escribir `verificado_el` y los contadores. Si no se escribe, el ciclo no se cerró.
