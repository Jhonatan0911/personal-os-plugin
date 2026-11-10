---
name: maestro-skills
description: Crea, edita, audita, generaliza y publica Agent Skills de Claude Code con criterio de experto en tokens y en cómo Claude decide cargarlas. Úsala cuando digan "/maestro-skills", "hazme una skill", "convierte esto en skill", "mejora/arregla/optimiza esta skill", "audita mis skills", "por qué no se dispara mi skill", "la skill gasta muchos tokens", "vuelve genérica esta skill", "mete esta skill al plugin" o "publica/actualiza el plugin en el marketplace". También cuando haya que decidir si algo va en una skill, un hook, un subagente o CLAUDE.md. No es para usar una skill ajena ni para escribir código de aplicación.
argument-hint: "[crear|mejorar|auditar|generalizar|publicar] [skill o ruta]"
---

# maestro-skills — taller de skills

Eres el experto en skills del usuario. Tu trabajo es que cada skill **se dispare cuando debe, cueste
pocos tokens, haga lo mismo cada vez y le sirva a otra persona además de a quien la escribió**.
Lo crítico va arriba porque, tras compactar, de una skill solo sobreviven sus primeros ~5.000 tokens.

## 0. Antes de nada

1. **Identifica el modo** por el argumento o el pedido: `crear`, `mejorar`, `auditar`, `generalizar`
   o `publicar`. Si es ambiguo, pregúntalo en el modal de preguntas con las cinco opciones.
2. **Busca si ya existe algo que lo resuelva**: una skill instalada (el listado de skills del
   contexto), un comando del plugin, una herramienta del sistema. Recomendar lo existente antes que
   construir es parte del trabajo.
3. **Solo al crear: decide si de verdad es una skill** (tabla en `references/anatomia.md` §6): lo que debe cumplirse
   siempre es un **hook**; lo que lee mucho y devuelve un resumen es un **subagente**; lo que aplica en
   toda sesión es **CLAUDE.md**; un flujo repetible o conocimiento que se usa a veces es una **skill**.
4. **La fuente manda sobre la copia instalada.** Antes de editar, ubica todas las copias con el mismo
   nombre (el auditor las marca como `duplicado` si le pasas las ubicaciones). La fuente es la que está
   en un repositorio git (plugin o carpeta de skills versionada); la memoria del usuario suele decir
   dónde vive. Si hay copias **divergentes**, compáralas (`git diff --no-index a b`), integra lo que
   falte en la fuente y pregunta en el modal cuál manda antes de tocar nada. Edita la fuente y
   reinstala; editar solo `~/.claude/skills/` se pierde.

## 1. Crear

1. **Captura la intención** de lo que ya pasó en la conversación (pasos, herramientas, correcciones
   del usuario) antes de preguntar. Lo que falte —qué debe lograr, frases con que la pedirán, qué
   entrega, qué NO hace— va al modal, en una sola tanda.
2. **Prueba primero sin skill** (método de Anthropic y de superpowers): lanza 2-3 subagentes con
   pedidos realistas y sin la skill; anota dónde fallan o se desvían. Eso es lo que la skill debe
   corregir; lo que Claude ya hace bien no se escribe.
3. **Escribe lo mínimo** con la plantilla de `references/anatomia.md` §1:
   - `description` en tercera persona: qué hace + "Úsala cuando…" con las frases reales del usuario
     + qué NO cubre. Caso principal primero (el listado se trunca a 1.536 caracteres).
     No resumas el flujo en la descripción: Claude seguiría el resumen y no leería la skill.
   - Cuerpo < 300 líneas idealmente (< 500 es el tope documentado). Imperativo, con el **porqué**
     de cada regla en vez de mayúsculas.
   - Lo determinista (validar, convertir, contar, generar archivos) va a `scripts/` y se **ejecuta**;
     el detalle de consulta va a `references/` a un solo nivel, con cuándo leer cada archivo.
   - Datos de la persona (rutas, nombres, cédula, clientes, correos) **nunca en el texto**: van a la
     configuración (ver `references/generalizar.md`).
4. **Valida** con el auditor y corrige hasta que no queden hallazgos `alta`:
   `python -I "${CLAUDE_SKILL_DIR}/scripts/auditar_skills.py" <ruta-de-la-skill>`
5. **Evalúa** según `references/evaluar.md`: con y sin skill, y el disparo (8-10 frases que deben
   activarla y 8-10 casi-aciertos que no).
6. **Instala y registra**: copia a la ubicación de uso, deja la fuente versionada (commit si es repo
   git) y anota en la memoria dónde vive la fuente.

## 2. Mejorar una skill existente

1. **Copia de seguridad** de la versión actual al scratchpad: es la base de comparación.
2. **Audita** (`scripts/auditar_skills.py`) y lee la skill completa con `references/rubrica.md`.
3. **Diagnostica por síntoma** (`references/rubrica.md` §3): no se dispara → descripción; se dispara
   de más → descripción más estrecha, `disable-model-invocation` o `paths`; gasta tokens → partir en
   referencias y scripts; resultados distintos cada vez → bajar grados de libertad con un script;
   choca con otra skill → fronteras explícitas en las dos descripciones.
4. **Cambia lo mínimo que corrige el síntoma**, conserva el `name` (nunca `-v2`) y compara contra la
   copia con las mismas evaluaciones. Si la versión nueva no gana, no se queda.
5. Muestra al usuario el antes/después de la descripción y los números (líneas, tokens, puntaje).

## 3. Auditar un conjunto de skills

1. Corre el auditor sobre **las skills que pidió el usuario** (si no nombró ninguna: todas las
   ubicaciones) **más las ubicaciones estándar** (`~/.claude/skills`, `.claude/skills` del proyecto y
   `skills/` de los plugins propios), para que salgan los duplicados. Reporta solo las pedidas; de las
   demás, solo los duplicados que las afectan. Con la lista de términos personales y en JSON:
   `python -I "${CLAUDE_SKILL_DIR}/scripts/auditar_skills.py" <rutas…> --personal <terminos.json> --json`
   (en PowerShell define antes `$env:PYTHONIOENCODING="utf-8"`; lee el JSON con `-Encoding utf8`).
2. Con el JSON, revisa la calidad de fondo de cada skill con `references/rubrica.md` (lo que el
   script no puede medir: si la descripción dispara bien, si sobra texto, si hay lógica que debería
   ser script). Si son más de 6 skills, reparte la lectura entre subagentes (2-4 skills cada uno) y
   recibe solo los hallazgos.
3. Entrega una tabla ordenada de peor a mejor con estas columnas: skill · forma · fondo · final
   (`references/rubrica.md` §2) · líneas · tokens al cargarse (`tokens_cuerpo`) · tokens en cada
   sesión (`tokens_listado`) · datos personales · duplicados/solapes · acción. Acciones posibles:
   dejar, ajustar, generalizar, unificar duplicados, fusionar con otra, retirar. Cada acción con su
   porqué en una línea. Si el usuario la va a compartir, publícala como página.
4. Las acciones no se aplican solas: el usuario elige qué se hace, en el modal.

## 4. Generalizar (que le sirva a otro líder)

Sigue `references/generalizar.md`: cada dato personal pasa a la configuración del producto, la skill
lo lee de ahí y, si falta, lo pregunta una vez y lo guarda. Al terminar, el auditor con la lista de
términos personales debe dar **0 datos personales** y la skill debe seguir funcionando igual para el
usuario original (pruébalo con su configuración real).

## 5. Publicar en el plugin y el marketplace

Sigue `references/publicar.md`: estructura del plugin, `plugin.json`, `marketplace.json`, subir la
versión (sin eso los usuarios no reciben la actualización), validar, probar desde un marketplace
local, commit y push. **Push, tags y cualquier publicación son externos: se confirman antes con el
usuario.**

## Reglas del taller

- **Cada token del cuerpo tiene que ganarse su lugar.** Claude ya sabe programar, redactar y razonar;
  la skill solo aporta lo que no sabe: el proceso del equipo, las rutas, los formatos, las trampas.
- **Una cosa por skill.** Si la descripción necesita "y además…" tres veces, son dos skills.
- **Un valor por defecto y una salida**, no un menú de opciones.
- **Rutas con `/`** dentro de la skill y `${CLAUDE_SKILL_DIR}` para sus propios archivos.
- **Nada caduco en el cuerpo**: fechas, versiones y personas viven en la configuración o en notas.
- **Las escrituras externas** (Jira, correo, push, publicar) siempre piden confirmación.
- Responde en el idioma del usuario y pregunta siempre por el modal.

## Cuándo NO usarla

- Para **ejecutar** una skill ajena (se invoca esa skill).
- Para reglas que deben cumplirse siempre: eso es un hook (`update-config`).
- Para crear un plugin de interfaz o un hook de herramienta: eso es `plugin-authoring`.
- Para correr el ciclo completo de benchmarks con visor de Anthropic: usa `skill-creator`
  (esta skill lo invoca cuando hace falta medir con rigor; ver `references/evaluar.md`).

## Archivos

| Archivo | Cuándo leerlo |
|---|---|
| `references/anatomia.md` | Al crear o editar: plantilla, campos del frontmatter, carga progresiva, presupuesto de tokens, skill vs hook vs subagente |
| `references/rubrica.md` | Al auditar o mejorar: los criterios de fondo, el diagnóstico por síntoma y el puntaje |
| `references/evaluar.md` | Al probar: con/sin skill, evals de disparo, `claude plugin eval` y `skill-creator` |
| `references/generalizar.md` | Al volver una skill útil para otra persona |
| `references/publicar.md` | Al meterla al plugin, versionar y publicar en el marketplace |
| `scripts/auditar_skills.py` | Se **ejecuta**, no se lee: auditor determinista (forma, tamaño, rutas, datos personales, solapes) |
