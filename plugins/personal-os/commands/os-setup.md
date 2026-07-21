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
3. Escribe `~/.claude/personal-os/config.json` con `{ "owner": "<nombre>", "stateDir": "<ruta absoluta a estado>" }`.
4. Escribe `active` en `~/.claude/personal-os/state.flag`.
5. Explica en 3 líneas: que conecte los MCP de Atlassian y Microsoft 365, que su estado es privado (no se comparte), y que arranque con "brief". NO siembres datos de clientes: cada quien los trae de su propio Jira/PITS.
