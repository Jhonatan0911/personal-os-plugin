# Personal OS — plugin

Chief of Staff digital para Claude Code: protege tu ejecución (riesgos, compromisos, prioridades) sobre
Jira/Outlook/Teams, con brief diario y tablero HTML.

## Cómo funciona
- Un hook `SessionStart` corre `scripts/session-init.js`, que lee `~/.claude/personal-os/state.flag`:
  - `active` → inyecta `preamble.md` (persona + protocolo) como contexto de la sesión.
  - `paused` → no inyecta nada (sesión limpia).
- El contenido del comportamiento (`CORE.md`, `preamble.md`) viaja con el plugin y se actualiza al actualizarlo.
- El **estado** del usuario (bandera, `config.json`, y su carpeta `estado/`) vive en `~/.claude/personal-os/`
  y en la `stateDir` que configure — nunca dentro del plugin, nunca compartido.

## Comandos
| Comando | Qué hace |
|---|---|
| `/os-setup` | Configura la carpeta de estado la primera vez |
| `/os-on` · `/os-off` | Activa / pausa (doble confirmación) el OS en todas las sesiones |
| `/brief` | Brief operativo del día |
| `/tablero` | Regenera el tablero visual HTML |

## Skills incluidos
`brief-diario` · `cerrar-tarea` · `reconciliar` · `tablero-diario`.

## Seguridad
Leer Jira/Outlook/Teams es libre; **toda escritura o envío se confirma antes**. El estado es privado y local.
