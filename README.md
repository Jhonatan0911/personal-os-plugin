# Everest Personal OS — Marketplace

Marketplace de Claude Code para instalar el **Personal OS** (Chief of Staff digital) en un comando.

## Instalación (lo que corre cada compañero)

1. Agregar el marketplace (una vez):
   ```
   /plugin marketplace add <owner>/<repo-de-este-marketplace>
   ```
   > Reemplaza `<owner>/<repo>` por el repo git donde publiques esta carpeta `distribucion/`.
   > También sirve la URL completa: `/plugin marketplace add https://github.com/<owner>/<repo>.git`

2. Instalar el plugin:
   ```
   /plugin install personal-os@everest-personal-os
   ```

3. Configurar la primera vez:
   ```
   /os-setup
   ```
   Crea tu carpeta de estado (privada) y registra tus fuentes. **Nadie comparte su `estado/`**: cada quien
   siembra el suyo desde su propio Jira/PITS.

4. Conectar los MCP de **Atlassian** y **Microsoft 365** en Claude Code, y arrancar con `brief`.

## Toggle
- `/os-off` — pausa el OS en todas tus sesiones (doble confirmación).
- `/os-on` — lo reactiva.

## Qué se reparte y qué no
- ✅ Se reparte: comportamiento (núcleo, skills, comando, hook de activación).
- ❌ NO se reparte: datos operativos. El `estado/` es privado y local de cada usuario.

## Estructura
```
distribucion/
├── .claude-plugin/marketplace.json   ← lista de plugins
└── plugins/personal-os/              ← el plugin
    ├── .claude-plugin/plugin.json
    ├── hooks/hooks.json              ← SessionStart → carga el OS si está activo
    ├── scripts/session-init.js       ← loader (lee ~/.claude/personal-os/state.flag)
    ├── commands/                     ← /os-on /os-off /os-setup /brief /tablero
    ├── skills/                       ← brief-diario, cerrar-tarea, reconciliar, tablero-diario
    ├── CORE.md / preamble.md         ← comportamiento
    └── README.md
```
