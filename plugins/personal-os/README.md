# Personal OS — plugin (v2.0.0)

Chief of Staff digital para Claude Code: protege tu ejecución (compromisos punto por punto, riesgos,
prioridades, horas trazables) sobre Jira/Outlook/Teams. Documentación completa en el
[README del repositorio](../../README.md) y novedades en el [CHANGELOG](../../CHANGELOG.md).

## Dónde vive cada cosa
- **Código** (este directorio): núcleo (`CORE.md`, `preamble.md`), `hooks/`, `scripts/`, `commands/`,
  `skills/`, `agents/` y `plantillas/`. Se actualiza al actualizar el plugin.
- **Configuración del usuario**: `~/.claude/personal-os/` → `config.json` (carpeta de estado, zona
  horaria, festivos, timesheet, carpetas de búsqueda), `state.flag` (`active` · `paused`) y
  `exigencia.json`. Se puede mover con la variable de entorno `PERSONAL_OS_HOME`.
- **Estado del usuario**: la carpeta `stateDir` que siembra `/os-setup` (notas-objeto, bitácora,
  `config/fuentes.yaml`). Nunca dentro del plugin, nunca compartido.

## Hooks
`SessionStart` → `session-init.js` + `alcances-scan.js` · `UserPromptSubmit` → `prompt-logger.js` +
`alcances-scan.js --hitos` + `reunion-detector.js` (solo si `timesheet.reunionesExigenIssueDesde` tiene
fecha) · `Stop` → `verificar-ausencia.js`. Todos con `node` portable, respetan `/os-off` y nunca rompen
la sesión. Los scripts también funcionan copiados sueltos a `~/.claude/personal-os/` (con su `lib/`).

## Probar los scripts sin tocar tu instalación
```
PERSONAL_OS_HOME=/tmp/os-prueba node scripts/os-setup.js --estado /tmp/os-prueba/estado --zona America/Bogota
PERSONAL_OS_HOME=/tmp/os-prueba node scripts/alcances-scan.js --hoy 2026-12-04
```

## Seguridad
Leer Jira/Outlook/Teams es libre; **toda escritura o envío se confirma antes**. El estado es privado y local.

## Agentes de solo lectura

Los exploradores del brief (`brief-jira`, `brief-outlook`, `brief-teams`) y `redactor-correos` declaran en su frontmatter `tools:` solo herramientas de lectura de los conectores de claude.ai (`claude_ai_Atlassian_MCP`, `claude_ai_Atlassian_Rovo`, `claude_ai_Microsoft_365`). Si tu servidor MCP de Jira u Outlook tiene otro nombre, cambia el prefijo `mcp__<servidor>__` en esa línea; no agregues herramientas de escritura.
