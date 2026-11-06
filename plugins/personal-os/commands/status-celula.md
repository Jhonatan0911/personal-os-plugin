---
description: Tablero de estado de la célula con cronograma de ocupación (Personal OS)
argument-hint: "[abrir | ejemplo]"
---

Sigue la skill `status-celula` del plugin.

Genera el tablero con el que presentas **el estado de tu célula** en la mesa de líderes. Antes de escribir
nada de la mesa, aplica el filtro de la sección A de la skill: entran bloqueos de cliente, bloqueos de
equipo, solicitudes de recurso, requerimientos nuevos y estado de frentes. **No entran bloqueos técnicos
ni el detalle interno de la célula.**

El **cronograma es el corazón del tablero** y ahí **todo está a la vista**: el líder con su carril (el
primero) y sus colas de revisión e implementación, lo terminado como traza, lo pausado, lo vencido antes de
la ventana y lo transversal con su nombre. Ninguna regla oculta issues de alguien con carril, y el script
avisa qué se pierde.

Pasos:

1. Lee la configuración (`<stateDir>/config/fuentes.yaml`: `equipo`, `jira.proyectos`, `jira.cloud_id`,
   `jira.mi_account_id`) y el estado (`personas/`, `riesgos/`, `compromisos/`, `alcances/`, `tablero.md`).
   Si falta algo obligatorio, pregúntalo con el modal de preguntas.
2. Lee Jira en **SOLO LECTURA**: responsable, estimación, fechas y estado frescos de cada issue (Jira manda).
3. Escribe `<stateDir>/_datos/status-celula/datos-<fecha>.json` con el formato del script.
4. Ejecuta `node "<raíz del plugin>/scripts/status-celula.js" "<ese JSON>"` (la raíz está en la línea
   «Scripts del plugin:» del contexto). Si imprime avisos de cobertura, resuélvelos o dilos.
5. Abre el HTML local y entrega **tres frases**: qué necesito de esta mesa, qué está en riesgo, qué ya está
   resuelto. Aparte, para ti: la carga del equipo y la cobertura.

Cada bloqueo lleva sus días de antigüedad. Lo que no tenga estimación o issue se marca como hallazgo, no se
rellena. Todo se cuenta en días hábiles con los festivos de `~/.claude/personal-os/config.json`. El tablero
**no escribe en Jira**: produce cambios propuestos. Es un archivo local y privado: no lo publiques salvo que
lo pidas.

- Con argumento `abrir`: solo abre el último `status-celula-*.html` de la carpeta de estado, sin regenerarlo.
- Con argumento `ejemplo`: genera el tablero con datos ficticios (`--ejemplo`) para ver cómo funciona.
