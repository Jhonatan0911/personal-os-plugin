---
description: Aplica a la terminal el tema de una de tus marcas (Windows Terminal, Claude Code y prompts de PowerShell y CMD)
---

Tema de la terminal con una marca del registro del usuario. Las marcas (colores, logo, marca de agua, ícono, ámbito) viven en ⚙ Config · Marcas (`<config>/marca/marcas.json`, CORE §16-bis); qué marca usa la terminal y sus interruptores, en ⚙ Config · Terminal (`<config>/marca/terminal.json`). Nunca escribas colores a mano en Windows Terminal, en el perfil de PowerShell ni en el mod. La raíz del plugin está en la línea **«Scripts del plugin:»** del contexto de la sesión.

1. Si no hay marcas (`node "<raíz del plugin>/scripts/marcas.js" --estado` → `existe: false`), pregúntale en el modal si **tiene un código de acceso** de su organización o si quiere **partir de una referencia** (`marcas.js --referencias`; se crea con `--desde-referencia <id> --ambito <laboral|personal>`). El código **nunca** se pide en el chat ni va en un comando: lo escribe él en ⚙ Config · Marcas o corre él mismo `marcas.js --desbloquear`, que lo pide sin mostrarlo.
2. Si pide otra marca para la terminal, que la elija en ⚙ Config · Terminal, o corre `marca-terminal.js --marca <id>` para ver el plan con esa.
3. Corre `node "<raíz del plugin>/scripts/marca-terminal.js"` **sin `--aplicar`** y muéstrale el plan en 3-5 líneas.
4. Con su OK, córrelo con **`--aplicar`**. Deja un respaldo `.respaldo-AAAA-MM-DD` de cada archivo que toca, una vez por día.
5. Dile que abra una consola nueva (Claude Code carga el mod al iniciar sesión) y, si el fondo es claro, que ponga Claude Code en tema claro con `/theme`.

Qué toca: imágenes en `~/.claude/marca-terminal/`, el mod en `~/.claude/marca-terminal/mod/` (línea de estado en el color principal, barra en las respuestas, mensajes del usuario sin fondo gris, marca sobre la bienvenida), `CLAUDE_CODE_PLUGIN_DIRS` en `~/.claude/settings.json`, Windows Terminal (esquema, tema, ícono y marca de agua en todos los perfiles), el bloque entre marcadores de `$PROFILE` y la variable `PROMPT` de CMD.

Para repartir una marca propia con código: `marcas.js --empaquetar <id> --salida <raíz del plugin>/plantillas/marcas-protegidas/<id>.marca` (el código por stdin; mínimo 6 letras o números).

Las imágenes de la terminal se usan tal cual (Windows Terminal no las escala con `stretchMode: none`): una marca de agua de unos 340 px de ancho y un ícono cuadrado PNG de 64-96 px.
