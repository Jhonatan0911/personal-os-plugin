---
description: Genera el brief operativo del día
---

Sigue el skill `brief-diario` del plugin. Lee el estado en la `stateDir` de `~/.claude/personal-os/config.json`
(`tablero.md`, `riesgos.md`, `compromisos.md`, `proyectos/*.md`), crúzalo en SOLO LECTURA con Jira/Outlook/Teams,
y entrega: prioridad #1, riesgos abiertos con nivel y mitigación, vencido/vence hoy, compromisos pendientes y
foco recomendado. Cierra pidiendo la #1 y regenera `tablero.md` + `tablero.html`. Ninguna escritura externa sin confirmación.
