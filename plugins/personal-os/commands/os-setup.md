---
description: Configura el Personal OS la primera vez (carpeta de estado + fuentes)
---

Onboarding de un usuario nuevo del Personal OS. Objetivo: dejar su carpeta de estado lista y registrada.

1. Pregunta con **AskUserQuestion** dónde quiere su carpeta de estado:
   - "En mi home (`~/.claude/personal-os/estado`)" — simple, privada, local.
   - "En un repo/carpeta propia (le doy la ruta)" — para versionarla en git (recomendado si ya usa uno).
2. Crea esa carpeta `estado/` con los archivos base (frontmatter YAML + cuerpo), todos VACÍOS de datos reales:
   `tablero.md`, `riesgos.md`, `compromisos.md`, `decisiones.md` (append-only) y `proyectos/` (una carpeta).
   Crea también `config/fuentes.yaml` con plantilla para sus proyectos Jira y flags de M365 (sin credenciales reales inventadas).
   Pregunta además (**AskUserQuestion**) si tiene **otra fuente externa de tareas** (p. ej. un PITS en Excel). Si sí:
   **exige una ruta accesible** (SharePoint/OneDrive sincronizado, NO "memoria") y regístrala en `tareas_externas`
   (`nombre`, `tipo`, `web_url`/ruta, `hoja`, `mi_nombre_en_fuente`, y mapa de `columnas` incl. responsable/líder).
   Deja también en `jira.consultas_extra` las búsquedas de **Aprobador** (`Aprobadores = currentUser()`), **sin fecha**
   (`duedate IS EMPTY`) y **próximos a vencer**, y la sección `roles` (responsable = ejecuto · líder = superviso ·
   aprobador = visto bueno). El campo "aprobador" es un campo de personas de Jira; su nombre puede variar por
   instancia (en Everest es `Aprobadores`) — confírmalo con el usuario.
3. Escribe `~/.claude/personal-os/config.json` con `{ "owner": "<nombre>", "stateDir": "<ruta absoluta a estado>" }`.
4. Escribe `active` en `~/.claude/personal-os/state.flag`.
5. Explica en 3 líneas: que conecte los MCP de Atlassian y Microsoft 365, que su estado es privado (no se comparte), y que arranque con "brief". NO siembres datos de clientes: cada quien los trae de su propio Jira/PITS.
6. **(Opcional · solo Windows) Recordatorios automáticos.** Pregunta con **AskUserQuestion** si quiere recordatorios diarios (L–V): 8:00 a.m. (brief matutino que lanza Claude, regenera el tablero y lo abre) y 5:00 p.m. (recordatorio de dejar el comentario de avances). Si acepta, ejecuta `python "<ruta del plugin>/scripts/reminders/setup_reminders.py"` (registra 2 tareas en el Programador de Windows; `--uninstall` para quitarlas, `--status` para verlas).
   - Explica los límites con franqueza: corre **solo con la sesión de Windows iniciada** (no en PC apagado); lanzar Claude consume tokens; la entrega es **local** (notificación + abrir tablero) porque no depende del permiso de envío de correo.
   - En **Mac/Linux** aún no está soportado (pendiente cron/launchd); en ese caso, sugiérele crear un recordatorio recurrente manual mientras tanto.
