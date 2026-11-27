---
description: Aplica a la terminal el tema de la marca activa (Windows Terminal, Claude Code y prompts de PowerShell y CMD)
---

Tema de la terminal según la marca activa del usuario. Todo sale de `<stateDir>/config/marca/terminal.json`; nunca escribas colores a mano en Windows Terminal, en el perfil de PowerShell ni en el mod.

1. Si no existe el archivo de marcas, créalo con **`node "<raíz del plugin>/scripts/marca-terminal.js" --iniciar`** (la raíz del plugin está en la línea **«Scripts del plugin:»** del contexto de la sesión) y pregúntale al usuario, en el modal, los colores de su marca (principal, acento) y si tiene logo para la marca de agua y el ícono. Escríbelos en el JSON.
2. Si pide otra marca o cambiar la activa, edita `activa` (o usa `--marca <id>`).
3. Corre el script **sin `--aplicar`** y muéstrale el plan en 3-5 líneas.
4. Con su OK, córrelo con **`--aplicar`**. Deja un respaldo `.respaldo-AAAA-MM-DD` de cada archivo que toca, una vez por día.
5. Dile que abra una consola nueva (Claude Code carga el mod al iniciar sesión) y, si el fondo es claro, que ponga Claude Code en tema claro con `/theme`.

Qué toca: imágenes en `~/.claude/marca-terminal/`, el mod en `~/.claude/marca-terminal/mod/` (línea de estado en el color principal, barra en las respuestas, mensajes del usuario sin fondo gris, marca sobre la bienvenida), `CLAUDE_CODE_PLUGIN_DIRS` en `~/.claude/settings.json`, Windows Terminal (esquema, tema, ícono y marca de agua en todos los perfiles), el bloque entre marcadores de `$PROFILE` y la variable `PROMPT` de CMD.

Las imágenes se usan tal cual (Windows Terminal no las escala con `stretchMode: none`): una marca de agua de unos 340 px de ancho y un ícono cuadrado PNG de 64-96 px.
