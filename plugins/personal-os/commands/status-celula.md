---
description: Tablero de estado de la célula con cronograma de ocupación (Personal OS)
argument-hint: "[abrir | ejemplo | carga]"
---

Sigue la skill `status-celula` del plugin.

Genera el tablero con el que presentas **el estado de tu célula** en la mesa de líderes. Antes de escribir
nada de la mesa, aplica el filtro de la sección A de la skill: entran bloqueos de cliente, bloqueos de
equipo, solicitudes de recurso, requerimientos nuevos y estado de frentes. **No entran bloqueos técnicos
ni el detalle interno de la célula**, ni lo que tengas en `status_celula.mesa_excluir`.

El **cronograma es el corazón del tablero** y ahí **todo está a la vista**: el líder con su carril (el
primero) y sus colas de revisión e implementación, lo terminado como traza, lo pausado, lo vencido antes de
la ventana y lo transversal con su nombre. Ninguna regla oculta issues de alguien con carril, y el motor
avisa qué se pierde.

Pasos:

1. Lee la configuración (`<stateDir>/config/fuentes.yaml`: `equipo`, `jira.proyectos`, `jira.cloud_id`,
   `jira.mi_account_id`, bloque `status_celula`) y el estado (`personas/`, `riesgos/`, `compromisos/`,
   `alcances/`, `tablero.md`). Si falta algo obligatorio, pregúntalo con el modal de preguntas.
2. Lee Jira en **SOLO LECTURA** y normaliza los volcados con `status-celula-jira.js` (Jira manda; para
   refrescar el mismo día, por delta).
3. Lee los timesheets del equipo por remitente, si los usa tu equipo.
4. Escribe `datos-<fecha>.json` en `status_celula.carpeta_datos` (por defecto `<stateDir>/_datos/status-celula/`).
5. Ejecuta `node "<raíz del plugin>/scripts/status-celula.js" "<ese JSON>" --carga 5` (la raíz está en la línea
   «Scripts del plugin:» del contexto). Si imprime avisos de cobertura, resuélvelos o dilos. Luego
   `status-celula-fichas.js` con el mismo JSON y, si hay tablero compartido, su carga (sección H).
6. Abre el HTML local y entrega **tres frases**: qué necesito de esta mesa, qué está en riesgo, qué ya está
   resuelto. Aparte, para ti: la carga del equipo, la cobertura y los timesheets.

Cada bloqueo lleva sus días de antigüedad. Lo que no tenga estimación o issue se marca como hallazgo, no se
rellena. Todo se cuenta en días hábiles con los festivos de `~/.claude/personal-os/config.json`. El tablero
**no escribe en Jira**: produce cambios propuestos. Es un archivo local y privado: no lo publiques salvo que
lo pidas.

- Con argumento `abrir`: solo abre el último `status-celula-*.html` de la carpeta de estado, sin regenerarlo.
- Con argumento `ejemplo`: genera el tablero con datos ficticios (`--ejemplo`) para ver cómo funciona.
- Con argumento `carga`: regenera desde el último `datos-*.json` solo para imprimir la carga de la semana.
