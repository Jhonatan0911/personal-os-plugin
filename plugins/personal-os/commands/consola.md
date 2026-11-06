---
description: Regenera la consola neuronal (vista HTML local del estado) y la abre en el navegador
---

Sigue el skill `consola-neuronal` del plugin:

1. Si hoy no ha corrido el `brief-diario`, propón correrlo primero (lee el estado y cruza las fuentes en solo lectura).
2. Si hay prioridad #1 fijada hoy, escríbela en `<stateDir>/_datos/prioridad.json` (`{laboral:{v,note}, ambas:{v,note}, personal:{v,note}}`); si no la hay, no la inventes.
3. Corre `node "<raíz del plugin>/scripts/build-consola.js"` (la raíz del plugin está en la línea **"Scripts del plugin:"** del contexto de la sesión). Escribe `<stateDir>/consola.html` y `<stateDir>/_datos/datos.js` desde las notas de `riesgos/`, `compromisos/` y `alcances/`, la bitácora del día y `config/consola-layout.json`. No edites el HTML ni `datos.js` a mano.
4. Lee los avisos del build y propón cómo corregir cada uno en la nota o en el layout.
5. Ábrela en el navegador por defecto: Windows `Start-Process "<stateDir>\consola.html"`, macOS `open`, Linux `xdg-open`.

**Es un archivo local y privado:** no lo publiques, no uses la herramienta Artifact y no lo subas a ningún servicio.

Termina indicando en 2–3 líneas qué cambió (ítems nuevos o cerrados, cambio de #1, sinapsis nuevas) y qué avisos quedan.
