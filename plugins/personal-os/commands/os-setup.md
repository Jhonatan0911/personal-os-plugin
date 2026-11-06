---
description: Configura el Personal OS la primera vez (o completa una instalación anterior)
---

Onboarding del Personal OS. Objetivo: dejar la carpeta de estado sembrada, la configuración escrita y
el usuario sabiendo qué completar. Todas las preguntas van con **AskUserQuestion** (2-4 opciones, la
recomendada primero; si es abierta, el usuario escribe en «Other»). Nada se pisa: el script es idempotente.

1. **Carpeta de estado.** Pregunta dónde la quiere:
   - "En mi home (`~/.claude/personal-os/estado`)" — simple, privada, local. (Recomendada)
   - "En una carpeta o repo propio (le doy la ruta)" — para versionarla en git privado.
   Si ya existe `~/.claude/personal-os/config.json` con `stateDir`, ofrécele conservarla.
2. **Datos básicos** (una tanda de modales): su nombre, su zona horaria (IANA; propone la del sistema,
   p. ej. `America/Bogota`, `America/Mexico_City`, `Europe/Madrid`) y su **país para los festivos**.
   Con el país, arma la lista de festivos del año en curso y el siguiente (AAAA-MM-DD), **muéstrasela y
   pide confirmación** antes de usarla: los días hábiles del vigía y del timesheet dependen de ella.
3. **Siembra** con el script del plugin (la raíz aparece en la línea "Scripts del plugin:" del contexto):
   `node "<raíz del plugin>/scripts/os-setup.js" --estado "<ruta absoluta>" --owner "<nombre>" --zona "<zona>" --festivos "AAAA-MM-DD,AAAA-MM-DD,..."`
   Crea `riesgos/`, `compromisos/`, `decisiones/`, `alcances/`, `personas/`, `bitacora/`, `proyectos/`,
   `_datos/`, `handoff/`, `timesheet/`, `config/` (cada una con su README de contrato), `tablero.md`,
   `config/fuentes.yaml`, `config/consola-layout.json` y un `.gitignore` que deja fuera personas,
   bitácora, `_datos` y los HTML. Escribe `~/.claude/personal-os/config.json`, `state.flag` (`active`)
   y `exigencia.json` (`estricto`). Muestra al usuario el resumen que imprime.
4. **Integraciones** (`<estado>/config/fuentes.yaml`): si tiene conectado el MCP de Atlassian, ofrece
   llenar `jira.cloud_id` (getAccessibleAtlassianResources) y `jira.mi_account_id` (atlassianUserInfo)
   — **nunca los adivines**. Pregunta qué proyectos de Jira sigue y de qué cliente es cada uno, y el
   nombre del campo de personas "aprobador" en su instancia (si no lo sabe, déjalo y avísale). Si
   tiene **otra fuente externa de tareas** (p. ej. un Excel de seguimiento), exige una ruta accesible
   (carpeta sincronizada o URL, no "de memoria") y regístrala en `tareas_externas`.
5. **Equipo y timesheet** (opcional, se puede dejar para después): pregunta si lidera un equipo; si sí,
   ofrece registrar a cada persona en `fuentes.yaml → equipo` y crear su nota en `personas/`. Pregunta
   si quiere usar el timesheet: entonces ajusta en `config.json → timesheet` su jornada por día,
   categorías y clientes (los de la plantilla son de ejemplo), su pausa de almuerzo (`pausas`), si
   quiere que la primera franja del día cuente como planeación (`planeacionInicial`) y si acepta
   trabajo interno sin issue. El motor del timesheet usa Python 3; en Windows, para que respete la
   zona horaria, sugiere `pip install tzdata` (y `openpyxl` si quiere exportar a XLSX).
6. **Búsqueda en todas las fuentes** (opcional): pregunta si tiene una carpeta de documentos del
   equipo (acuerdos, actas, políticas) o una carpeta sincronizada con PDF/Office; regístrala en
   `config.json → busqueda.fuentes` / `busqueda.binarios` para que `os-buscar.js` la barra.
7. **(Opcional · solo Windows) Recordatorios automáticos.** Pregunta si quiere recordatorios L–V:
   8:00 (brief matutino que lanza Claude, regenera el tablero y lo abre) y 17:00 (recordatorio de
   cierre). Si acepta: `python "<raíz del plugin>/scripts/reminders/setup_reminders.py"`
   (`--uninstall` para quitarlos, `--status` para verlos). Límites: corre solo con la sesión de
   Windows iniciada; lanzar Claude consume tokens; la entrega es local. En macOS/Linux aún no está
   soportado: sugiere un recordatorio recurrente manual.
8. Cierra en 3 líneas: que conecte los MCP de Atlassian y Microsoft 365 si no lo ha hecho, que su
   estado es privado (no se comparte ni viaja con el plugin) y que arranque con **"brief"**. NO
   siembres datos de clientes: cada quien los trae de su propio Jira.
