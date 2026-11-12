---
description: Tablero de planeación de la célula, publicado y compartido con el equipo (Personal OS)
argument-hint: "[abrir | ejemplo | carga]"
---

Sigue la skill `status-celula` del plugin.

Genera y publica **el tablero de planeación de tu célula**: el Artifact compartido con el que planeas al
equipo y presentas su estado en la mesa de líderes. Antes de escribir nada de la mesa, aplica el filtro de la
sección A de la skill: entran bloqueos de cliente, bloqueos de equipo, solicitudes de recurso, requerimientos
nuevos y estado de frentes. **No entran bloqueos técnicos ni el detalle interno de la célula**, ni lo que
tengas en `status_celula.mesa_excluir`.

El **Gantt es el corazón del tablero** y ahí **todo está a la vista**: cada persona con su carril y su carga,
las colas de revisión, certificación y publicación, lo vencido y lo transversal con su nombre. Ninguna regla
oculta issues de alguien con carril, y el motor avisa qué se pierde.

Pasos (detalle en la sección C de la skill):

1. Lee la configuración (`<stateDir>/config/fuentes.yaml`: `equipo`, `jira`, bloque `status_celula` con
   `tablero_compartido` y `tablero`) y el estado (`personas/`, `riesgos/`, `compromisos/`, `alcances/`,
   `tablero.md`). Si falta algo obligatorio, pregúntalo con el modal de preguntas.
2. Lee Jira en **SOLO LECTURA** y normaliza los volcados con `status-celula-jira.js` (para refrescar el mismo
   día, por delta).
3. Lee los timesheets del equipo por remitente, si los usa tu equipo.
4. Escribe `datos-<fecha>.json` en `status_celula.carpeta_datos`.
5. Corre el motor (`status-celula.js --carga 5`), el inventario (`status-celula-inventario.js`), arma la
   página (`status-celula-tablero.js`) y guarda la actividad en las fichas (`status-celula-fichas.js`). La raíz
   está en la línea «Scripts del plugin:» del contexto. Si el motor o el inventario avisan de algo que se
   pierde, resuélvelo o dilo.
6. Sube los datos a la base del tablero y publica la página en su enlace (sección H), sin tocar sus
   capacidades.
7. Entrega el enlace y **tres frases**: qué necesito de esta mesa, qué está en riesgo, qué ya está resuelto.
   Aparte, para ti: la carga del equipo, la cobertura y los timesheets.

Cada bloqueo lleva sus días de antigüedad. Lo que no tenga estimación o issue se marca como hallazgo, no se
rellena. Todo se cuenta en días hábiles con los festivos de la configuración de la célula. **La skill no
escribe en Jira**; el tablero solo lo hace cuando alguien lo pide en la página, con confirmación.

- Con argumento `abrir`: abre el tablero publicado (su enlace de `status_celula.tablero_compartido.url`) sin
  regenerarlo.
- Con argumento `ejemplo`: arma la página con `tablero/ejemplo-celula.json` y `ejemplo-organizacion.json` para
  ver cómo funciona, sin publicarla.
- Con argumento `carga`: corre el motor sobre el último `datos-*.json` solo para imprimir la carga de la semana.
