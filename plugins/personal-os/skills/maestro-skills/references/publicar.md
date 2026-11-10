# Publicar en el plugin y el marketplace

## 1. Estructura

```
<repo-marketplace>/
├── .claude-plugin/marketplace.json      name, owner{name}, plugins[{name, source, description, version}]
└── plugins/<plugin>/
    ├── .claude-plugin/plugin.json        name (kebab, permanente), version, description, author…
    ├── skills/<skill>/SKILL.md           se invoca como /<plugin>:<skill>
    ├── commands/  agents/  hooks/hooks.json  scripts/  plantillas/
    └── README.md
```

- Solo `plugin.json` va dentro de `.claude-plugin/`; todo lo demás en la raíz del plugin.
- Un `CLAUDE.md` en la raíz del plugin **no se carga**: las instrucciones van en skills.
- Dentro del plugin, las rutas a sus archivos usan `${CLAUDE_PLUGIN_ROOT}` y los datos persistentes
  `${CLAUDE_PLUGIN_DATA}`.
- El `name` del plugin no se cambia nunca una vez publicado.

## 2. Pasos para sacar una versión

1. **Fuente única**: la skill vive en `plugins/<plugin>/skills/`. Si había una copia en
   `~/.claude/skills/` con el mismo nombre, se retira (si no, compiten). Antes de borrarla, compara
   que la del plugin tenga todo; si la personal tiene algo más, se integra primero.
2. **Auditor** sobre `plugins/<plugin>/skills/`: sin hallazgos `alta` y 0 datos personales.
3. **Versión**: sube `version` en `plugin.json` **y** en la entrada de `marketplace.json`
   (semver: parche = arreglos, menor = skills o comandos nuevos, mayor = cambia la configuración o
   rompe algo). Sin subir la versión, `claude plugin update` dice "ya está al día" y nadie recibe
   el cambio.
4. **CHANGELOG / README**: qué cambió, en lenguaje del usuario.
5. **Validar**: `claude plugin validate --strict ./plugins/<plugin>` y
   `claude plugin validate ./` (marketplace).
6. **Probar local**: `claude --plugin-dir ./plugins/<plugin>` o
   `/plugin marketplace add <ruta-local>` + `/plugin install <plugin>@<marketplace>`; invocar la skill
   nueva una vez.
7. **Evals** si hay suite: `claude plugin eval .`
8. **Commit** con mensaje de versión. **Push y tag solo con el OK explícito del usuario.**

## 3. Cómo lo reciben los usuarios

- `/plugin marketplace update <marketplace>` refresca el catálogo (no actualiza lo instalado).
- `/plugin` → Installed → **Update now**, o `claude plugin update <plugin>@<marketplace>`.
- `/reload-plugins` para aplicarlo en la sesión abierta.
- La actualización automática viene apagada en marketplaces de terceros: dilo en el README.
