---
description: Corre el vigía de compromisos y cruza punto por punto los alcances con fecha
---

1. Ejecuta `node "<raíz del plugin>/scripts/alcances-scan.js"` (la raíz aparece en la línea
   "Scripts del plugin:" del contexto) y muestra el bloque `⚠️ VIGÍA DE COMPROMISOS` tal cual.
2. Si hay **posibles compromisos sin declarar**, pregunta con **AskUserQuestion** cuáles son reales y
   crea su nota en `<estado>/alcances/` copiando la estructura de `alcances/_ejemplo.md` (con su
   `fuente` viva; los puntos no se copian).
3. Para cada alcance activo que no se haya cruzado hoy, ofrece cruzarlo ahora (SOLO LECTURA en Jira):
   recorre la fuente viva **punto por punto**, busca cada punto **por clave, nunca por título**, toma el
   `status` de Jira como evidencia (si el equipo dice otra cosa, se dicen los dos), separa los estados
   que parecen cerrados sin estarlo (`fuentes.yaml → jira.estados_que_parecen_cerrados`) y anota
   desde cuándo y a quién se pidió cada insumo bloqueado.
4. Escribe el resultado en la nota: `verificado_el` (hoy) y los contadores `puntos_total`,
   `puntos_con_dueno`, `puntos_sin_issue`, `puntos_sin_responsable`, `puntos_sin_fecha`,
   `puntos_estado_enganoso`, `puntos_bloqueados` (+ `bloqueo_detalle`), `puntos_brecha_estado`.
   Si no se escribe, el ciclo no se cerró y el vigía seguirá avisando, con razón.
5. Cada CRÍTICO restante se atiende o se declara por escrito por qué no. Punto sin issue, responsable
   o fecha = riesgo nivel 3: ofrece crear la nota en `riesgos/`.
