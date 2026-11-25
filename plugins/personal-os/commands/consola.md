---
description: Regenera la consola neuronal (vista HTML local del estado) y la abre en el navegador
---

Sigue el skill `consola-neuronal` del plugin:

1. Si hoy no ha corrido el `brief-diario`, propón correrlo primero (lee el estado y cruza las fuentes en solo lectura).
2. Si hay prioridad #1 fijada hoy, escríbela en `<stateDir>/_datos/prioridad.json` (`{laboral:{v,note}, ambas:{v,note}, personal:{v,note}}`); si no la hay, no la inventes.
3. Corre `node "<raíz del plugin>/scripts/build-consola.js"` (la raíz del plugin está en la línea **"Scripts del plugin:"** del contexto de la sesión). Escribe `<stateDir>/consola.html` y `<stateDir>/_datos/datos.js` desde las notas de `riesgos/`, `compromisos/` y `alcances/`, la bitácora del día y `config/consola-layout.json`. No edites el HTML ni `datos.js` a mano.
4. Lee los avisos del build y propón cómo corregir cada uno en la nota o en el layout.
5. Ábrela con `node "<raíz del plugin>/scripts/os-servidor.js" --asegurar --abrir`: arranca el servidor de la consola si no corre (o lo reinicia si quedó en una versión vieja del plugin) y abre la app (`http://127.0.0.1:<puerto>/`, con Oficina y ⚙ Config) como una pestaña del navegador por defecto. **Nunca abras el `consola.html` suelto si `--asegurar` salió bien.** Solo si sale con error, abre `<stateDir>\consola.html` (Windows `Start-Process`, macOS `open`, Linux `xdg-open`) y di por qué no arrancó el servidor.
6. Si `--asegurar` dice «Arranque al iniciar Windows: NO instalado», ofrece una vez (en el modal) instalarlo con `node "<raíz del plugin>/scripts/os-servidor.js" --instalar-tarea` para que la consola esté lista desde que enciende el equipo; sobrevive a las actualizaciones del plugin.

**Es un archivo local y privado:** no lo publiques, no uses la herramienta Artifact y no lo subas a ningún servicio.

Termina indicando en 2–3 líneas qué cambió (ítems nuevos o cerrados, cambio de #1, sinapsis nuevas) y qué avisos quedan.
