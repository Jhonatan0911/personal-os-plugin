# Anatomía de una skill

## Índice
1. Plantilla
2. Campos del frontmatter
3. Carga progresiva y presupuesto de tokens
4. Ubicaciones y precedencia
5. Sustituciones e inyección dinámica
6. Skill, hook, subagente, CLAUDE.md o plugin

Fuentes: code.claude.com/docs/en/skills · platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices ·
code.claude.com/docs/en/features-overview (consultadas el 09/11/2026; si el comportamiento observado difiere, manda lo observado y se actualiza este archivo).

## 1. Plantilla

```markdown
---
name: verbo-objeto                # minúsculas, números y guiones; ≤ 64; sin "claude"/"anthropic"
description: <Qué hace, en tercera persona>. Úsala cuando digan "<frase real 1>", "<frase 2>" o <situación>. No es para <lo vecino que no cubre>.
argument-hint: "[argumento]"      # opcional
---

# <nombre> — <para qué existe, una línea>

<2-4 líneas: el resultado que entrega y la regla más importante, con su porqué.>

## Procedimiento
1. <paso verificable> — <porqué si no es obvio>
2. Ejecuta `python -I "${CLAUDE_SKILL_DIR}/scripts/x.py" <args>`; si falla, <qué hacer>.
3. ...

## Reglas
- <solo lo que Claude no haría bien por su cuenta>

## Cuándo NO usarla
- <pedido vecino> → <qué usar en su lugar>

## Archivos
| Archivo | Cuándo leerlo |
```

Estructura de carpeta:
```
nombre/
├── SKILL.md          índice y flujo (< 300 líneas ideal, < 500 tope)
├── references/       detalle que se lee solo si hace falta (un nivel; índice si > 100 líneas)
├── scripts/          lo determinista: se ejecuta, solo su salida cuesta tokens
└── assets/           plantillas, imágenes, fuentes que usa la salida
```

## 2. Campos del frontmatter (Claude Code)

| Campo | Uso |
|---|---|
| `name` | Comando `/name`. Por defecto, el nombre de la carpeta. |
| `description` | Lo único que Claude ve para decidir si la carga. Qué + cuándo + qué no. |
| `when_to_use` | Contexto extra de disparo; suma al mismo tope de 1.536 caracteres. |
| `argument-hint`, `arguments` | Pista de autocompletado; nombres para `$nombre`. |
| `disable-model-invocation: true` | Solo el usuario la invoca; la descripción sale del contexto (ahorra tokens). Para skills con efectos (publicar, enviar, borrar). |
| `user-invocable: false` | Oculta del menú `/`; Claude sí puede usarla (conocimiento de fondo). |
| `allowed-tools` / `disallowed-tools` | Herramientas sin pedir permiso / quitadas, durante el turno. Ej.: `Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/*)`. |
| `model`, `effort` | Modelo o esfuerzo para ese turno. |
| `context: fork` + `agent` | Corre la skill en un subagente aislado (sin el historial): debe ser autocontenida. |
| `paths` | Globs: solo se ofrece al tocar esos archivos. |
| `hooks`, `shell` | Hooks mientras dura la sesión; `bash` o `powershell` para `` !`cmd` ``. |

**Portabilidad:** fuera de Claude Code (claude.ai, Skills API, `package_skill.py`) solo valen `name`,
`description`, `license`, `compatibility`, `metadata` y `allowed-tools`; otra clave es error duro.
Description ≤ 1.024 caracteres allí.

## 3. Carga progresiva y presupuesto de tokens

1. **Listado** (siempre, en cada sesión): name + description de todas las skills. Presupuesto ≈ 1 % de
   la ventana; si se pasa, Claude Code recorta primero las descripciones de las skills menos usadas.
   Diagnóstico: `/doctor`, `/context`, `/skill-doctor`. Una skill que solo se invoca a mano debería
   llevar `disable-model-invocation: true` para no pagar listado.
2. **Cuerpo** (al invocarse): entra completo y se queda en la conversación. Tras compactar sobreviven
   los primeros 5.000 tokens de cada skill (25.000 entre todas). Lo crítico, arriba.
3. **Referencias**: se leen con herramientas solo si el cuerpo las nombra y hacen falta.
4. **Scripts**: se ejecutan; cuesta solo su salida. Haz que impriman poco y útil.

Cuenta rápida: ~4 caracteres por token. Un SKILL.md de 300 líneas ≈ 4.000-5.000 tokens.

## 4. Ubicaciones y precedencia

| Nivel | Ruta | Alcance |
|---|---|---|
| Empresa | ajustes gestionados `.claude/skills/` | todos los usuarios gestionados |
| Personal | `~/.claude/skills/<nombre>/` | todos tus proyectos |
| Proyecto | `.claude/skills/<nombre>/` | ese repositorio (se versiona) |
| Plugin | `<plugin>/skills/<nombre>/` | `/plugin:nombre`, nunca choca |

Choque de nombres: empresa > personal > proyecto. Una copia personal y otra en el plugin con el mismo
nombre **coexisten** (la del plugin va con prefijo) y compiten por los mismos pedidos: deja una.
Cambios en `~/.claude/skills/` y `.claude/skills/` se recargan solos; una carpeta nueva de primer
nivel pide `/reload-skills`; cambios de plugin, `/reload-plugins`.

## 5. Sustituciones e inyección dinámica

`$ARGUMENTS`, `$0..$N`, `$nombre`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`,
`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SESSION_ID}`.
`` !`comando` `` se ejecuta antes de que Claude lea la skill y se reemplaza por su salida (útil para
meter estado vivo sin razonamiento); si falla, aborta la invocación: añade `|| true` cuando aplique.

## 6. ¿Skill, hook, subagente, CLAUDE.md o plugin?

| Necesidad | Mecanismo | Por qué |
|---|---|---|
| Debe cumplirse siempre, sin excepción | Hook | Una instrucción es una petición; un hook es una garantía |
| Aplica en toda sesión de ese proyecto | CLAUDE.md (< 200 líneas) | Se carga siempre |
| Flujo repetible o conocimiento que se usa a veces | Skill | Solo paga listado hasta que se usa |
| Lee mucho y devuelve un resumen, o corre en paralelo | Subagente | Aísla el contexto |
| Conectar un servicio externo | MCP | Herramientas nativas |
| Repartir todo lo anterior a otros | Plugin | Se instala y se actualiza |
