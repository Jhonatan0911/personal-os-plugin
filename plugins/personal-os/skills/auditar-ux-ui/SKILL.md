---
name: auditar-ux-ui
description: Audita, rediseña y pule la UX y la UI de una herramienta o un diseño (artifact HTML, tablero, consola, pantalla o archivo de Figma) como un equipo de diseñador gráfico senior, diseñador de producto y experto en UI, siempre contra una marca. Primero da un veredicto de dirección (pulir, reestructurar o rediseñar: tarjetas a dashboard, tabla o gráfica, o minimalista), mide UX, UI y Marca en % contra varas fijas y cierra la brecha completa en una ronda, con evaluador independiente, capturas reales en varios anchos (o los frames de Figma) y siempre abre en el navegador la página de propuestas A/B/C con vista de escritorio, tableta y celular. Úsala cuando digan "auditar ux/ui", "pásale la skill de diseño", "que quede corporativo", "dale un porcentaje de ux", "no paramos hasta 90", "audita este Figma", "rediséñalo", "hazlo más minimalista", "esto se ve feo" o pidan subir la calidad visual de algo. No es para diseñar desde cero (artifact-design) ni para revisar un PR (revisar-pr).
argument-hint: "[auditar | hasta la meta <N>% | rediseñar | más sobrio | más audaz] <archivo, url, enlace de Figma o vista>"
---

# auditar-ux-ui — dirección, medida y brecha completa

Responde con evidencia tres preguntas: **¿está bien planteada?** (dirección de diseño), **¿es fácil de
usar?** (UX) y **¿se ve hecha por un diseñador y con su marca?** (UI + Marca). Actúa como un equipo
senior: un diseñador gráfico que juzga forma, jerarquía, tipografía y color; un diseñador de producto que
juzga flujos y arquitectura de información; y un desarrollador de UI que sabe lo que el código puede dar.
**No se limita a pulir lo que hay**: si la vista está mal planteada, lo dice y propone el cambio de fondo.

## 0. Modos y meta
- **Auditar:** veredicto de dirección, tres porcentajes, brecha completa y **la página de propuestas abierta**
  (paso 3-bis). No toca la herramienta.
- **En todos los modos se abre la página de propuestas** (A/B y C, con Escritorio 1440 · Tableta 768 · Celular
  390): es lo que el usuario mira para decidir. Sin la página abierta, la skill no ha terminado.
- **Hasta la meta** ("no paramos hasta…"): auditar, ejecutar la dirección aprobada y la brecha completa,
  y verificar. Meta por defecto **≥ 90 % en UX, UI y Marca**.
- **Rediseñar:** salta la medición inicial y va directo a la dirección (paso 3), con propuestas para elegir.
- **Más sobrio / más audaz:** un ajuste de carácter con un objetivo acotado. «Sobrio» quita: menos tarjetas,
  bordes, acentos y mayúsculas, y más aire y menos ruido. «Audaz» concentra: un momento visual fuerte, una
  escala tipográfica con contraste y color con intención. Se mide igual al terminar.
- Lo esperado son **2 rondas** (medir → ejecutar todo → verificar) y una tercera solo para regresiones.
  El tope es de 5. Si una ronda sube menos de 15 puntos, falló el método (la brecha estaba incompleta, no
  se usó la vara o se arregló sin mirar la captura): se corrige eso antes de seguir.

## 1. La marca siempre (no inventar)
Siempre hay una marca contra la cual medir:
- **Laboral:** el perfil de la organización. `<stateDir>` es la carpeta de estado de
  `~/.claude/personal-os/config.json`. El perfil está en la ruta `organizacion.marca` de
  `<stateDir>/config/fuentes.yaml` (relativa a su carpeta) o en `marca/MARCA.md` junto a ese archivo. El
  formato está en `perfiles/marca-ejemplo.md`. Si un manual oficial lo reemplaza, manda el manual.
- **Personal o de producto:** la identidad del propio producto, en su `DESIGN.md` (y `PRODUCT.md`, si
  existe) en la raíz del proyecto o junto a la herramienta.
- **Si no existe ninguna:** la ronda 1 la **documenta** a partir de lo que ya hay (tokens, tipografía,
  colores, logo, tono) y propone en el modal cómo quedaría el `DESIGN.md` y qué ajustaría. Una vez
  aprobada, esa es la marca. Nunca se mide una herramienta «sin marca».

De la marca salen la paleta (con los semánticos solo para estados), la tipografía por rol, el logo (nunca
escalado por encima de su tamaño nativo ni deformado), el patrón de documento y el tono. La marca de una
organización **nunca** va dentro del plugin: vive en su perfil, en el estado.

## 2. Persona, trabajos y evidencia real
- **Persona:** quien la usa a diario, con prisa y sin leer instrucciones. **Trabajos clave:** 4 a 6
  recorridos reales. Se confirman en el modal si hay duda.
- **Capturas reales siempre ("live first").** Si corre local, se toman con Playwright a **390, 768, 1024 y
  1440 px**, de cada vista y en los estados clave: vacío, cargando, con datos, error, hover, foco,
  deshabilitado y sin guardar. También se revisa la consola del navegador. En un artifact, se piden al
  usuario en la primera y en la última ronda. Sin captura, lo visual no suma: el evaluador lee el código y
  no ve el render (pasó con un título azul sobre azul que cinco rondas no vieron).
  **Cada captura espera su estado, no un tiempo fijo** (`"accion": "esperar", "selector"` o `"espera"` tras un clic
  en `capturas.py`): el 25/11/2026 una captura de «no existe» a 1440 salió con el spinner todavía girando.
  Si la vista vive dentro de un shell con selector de sede o de cuenta, el guion entra solo con la cuenta
  de TEST del perfil (nunca la escribe en el guion).

### 2-bis. Si la fuente es Figma (un enlace `figma.com/...` o «el Figma de…»)
El diseño se mira en Figma, no se imagina. Sin ver los frames no hay auditoría: nunca se entrega un informe
escrito «de memoria» sobre un Figma que no se abrió.
1. **Conector.** Usa el MCP oficial de Figma (herramientas `mcp__…Figma__*`; si están diferidas, cárgalas con
   ToolSearch). Si no está conectado o pide autenticación, **para** y dile al usuario cómo conectarlo
   (Claude Code → `/mcp` → Figma → autenticar, o el conector de Figma en claude.ai) y que vuelva a correr
   la skill. Si el plugin de Figma trae sus skills (`/figma-use`, `/figma-design-to-code`), cárgalas antes de
   llamarlas, como exigen sus instrucciones.
2. **Abrir el archivo.** Del enlace saca `fileKey` y `node-id` (cambia `-` por `:`; en `/branch/` usa la
   rama; en `/board/` es FigJam y en `/make/` es Make). Abre la sesión del archivo (`create_session`) y lista
   las páginas y los frames (`get_metadata`). Si el enlace no trae `node-id`, confirma en el modal qué frames
   o qué flujo se audita (máximo 12 frames por ronda).
3. **Evidencia.** Por cada frame, `get_screenshot`: esas son las capturas de la auditoría (equivalen a las de
   Playwright y van al evaluador y al informe). Las variantes de ancho son los frames de escritorio, tableta y
   celular que existan; **si falta un ancho, es un hallazgo** (responsive sin diseñar), no se inventa.
   Los estados (vacío, error, cargando, hover, foco) se buscan entre los frames y los componentes con sus
   variantes; si no están diseñados, también es un hallazgo.
4. **La marca desde Figma.** `get_variable_defs` da los tokens reales (colores, tipos, espacios). Se cruzan
   con el perfil de marca (paso 1): un color o un tamaño suelto que no sale de las variables cuenta en contra.
   Si el archivo no tiene variables ni estilos, eso mismo es el primer hallazgo de Marca.
5. **El evaluador** recibe las capturas de Figma, la lista de frames y los tokens. Lo que solo se ve en un
   prototipo navegando (transiciones, flujo) se dice como «no verificable desde los frames».
6. **Propuestas.** Los mockups A/B/C (paso 3-bis) se hacen en HTML igual. Después, si el usuario elige una y
   quiere tenerla en Figma, ofrécelo en el modal y súbela como **página nueva** del mismo archivo
   («Propuesta A · <fecha>») con las herramientas de escritura del conector. **Nunca se modifican los frames
   originales.**

## 3. Veredicto de dirección (antes de medir el detalle)
El evaluador mira cada vista como un todo y responde:
1. **¿La forma corresponde al contenido?** Datos que se comparan van en una tabla o una gráfica, no en
   tarjetas. Un estado del sistema va en un dashboard con pocas cifras grandes. Una configuración va en
   formularios agrupados y no en una cuadrícula de tarjetas. Una lista larga lleva filtro.
2. **¿La arquitectura de información es la correcta?** Qué sobra, qué falta, qué debe fusionarse o
   separarse, qué va primero.
3. **¿Tiene carácter de marca o parece plantilla?** Se revisa contra `antipatrones.md`.
4. **Nivel de intervención**, con su porqué: **pulir** (el sistema está bien y fallan los detalles),
   **reestructurar** (cambian el orden, los grupos y algunos componentes) o **rediseñar** (otra forma: menos
   tarjetas, dashboard, tabla, gráfica, minimalismo).

### 3-bis. Siempre: propuestas en mockups HTML antes de tocar el código
**Toda auditoría termina con la página de propuestas abierta**, sea cual sea el veredicto, y no se toca la
herramienta hasta que el usuario elija sobre esos **mockups navegables**. Qué propuestas van según el veredicto:
- **Pulir:** A = la vista con toda la brecha aplicada (mismo esquema, detalles resueltos); B = una variante de
  carácter (más sobria o más audaz); C, opcional, una reestructura si se ve una mejor.
- **Reestructurar o rediseñar:** A, B y C son formas distintas (ver punto 2).

Cómo se hacen:
1. **La página de comparación NO se escribe a mano: la arma el script.** En
   `<proyecto>/.diseno/propuestas/<AAAA-MM-DD>-<vista>/` (para un artifact, junto a su archivo; sin proyecto,
   en `<stateDir>/diseno/propuestas/…`) se escriben solo:
   - `propuesta-a.html`, `propuesta-b.html` (y `-c`): **cada propuesta es un HTML autocontenido y responsive**
     (con `<meta name="viewport">`, CSS en línea, sin dependencias salvo las fuentes de la marca), porque se
     muestra dentro de un marco de 1440, 768 o 390 px;
   - `actual-<ancho>.png`: las capturas de hoy (paso 2);
   - `propuestas.json`: `titulo`, `vista`, `fecha`, `recomendada` y, por propuesta, `id`, `idea` (una línea),
     `gana`, `pierde`, `nivel`, `antipatrones` y `archivo`; en `actual`, cada captura con `img`, `ancho` y `texto`.
   Luego: `python "${CLAUDE_SKILL_DIR}/scripts/propuestas.py" --carpeta <esa carpeta> --abrir`. El script valida
   (2 o 3 propuestas, archivos y capturas presentes, viewport), escribe `index.html` desde
   `plantillas/comparador.html` y lo abre en el navegador por defecto: pestañas **A · B · C · Actual**, la ficha
   de cada propuesta (idea, qué gana, qué pierde, nivel, antipatrones) y el selector **Escritorio 1440 ·
   Tableta 768 · Celular 390**. Si el script sale con error, se corrige lo que dice y se vuelve a correr; **no
   se sigue al modal sin la página abierta.**
2. **Las propuestas son distintas de verdad, no tres variantes de color.** Ejemplos: A, minimalista sin
   tarjetas, con formularios agrupados; B, dashboard arriba con el detalle en tabla; C, lista con panel
   lateral. Cada una usa **los tokens y la marca reales** (paso 1) y el **contenido real** de la vista:
   nombres, secciones y textos. Los datos son ficticios si hay personas, credenciales o cifras sensibles.
   Muestran los estados que importan, por lo menos con datos y vacío.
3. **Es solo forma, sin lógica.** Los mockups no se conectan a nada ni guardan nada: es HTML estático con
   interacciones mínimas (pestañas, el selector de ancho, un hover). Se miran en captura a 1440 y 390 antes
   de mostrarlos.
4. **Ya quedaron abiertas** en el navegador por el script (si es laboral y hay que compartirlas, se publica
   la carpeta como artifact privado). Al usuario se le da la ruta del `index.html`. Después se pregunta en el modal: **A · B · C · ninguna (con qué cambiar) ·
   combinar** (p. ej. «la estructura de B con la tipografía de A»). En la vista previa de cada opción va un
   boceto ASCII de la propuesta.
5. **Si dice «ninguna» o «combinar»,** se hace una ronda más de mockups con su indicación antes de tocar el
   código. Con la elección aprobada se ejecuta (paso 7) y la propuesta elegida pasa a ser el criterio de
   «hecho»: el resultado final se compara con su mockup en captura.

**Se conserva la funcionalidad** (datos, permisos, flujos, accesibilidad); lo que cambia es la forma.

## 4. Rúbrica (cada dimensión de 1 a 5, contra `varas.md`)
**UX:** claridad de propósito · carga cognitiva · navegación y nombres · primer uso y estados vacíos ·
consistencia · prevención de errores · lenguaje claro (voz activa, errores que dicen qué pasó, sin jerga) ·
visibilidad del estado · celular · accesibilidad (WCAG 2.1 AA como piso).

**UI:** forma adecuada al contenido · carácter (no genérico) · jerarquía visual · ritmo de espaciado ·
color y contraste · tipografía y escala · consistencia de componentes · estados · motion ·
densidad y respiración · remate responsive.

**Marca:** paleta y disciplina del color · tipografía de la marca · logo bien usado · patrón de tablas y
cifras · tono.

`varas.md` define qué es un 5 en cada dimensión: la nota se pone contra esa vara, no por intuición, para
que dos evaluadores den lo mismo. Cada hallazgo lleva su **severidad**: P0 bloquea, P1 alto, P2 medio y
P3 pulido. También lleva su evidencia (vista, elemento, captura o línea) y se escribe como **problema e
impacto**, no como receta. La receta va aparte, en la brecha.

## 5. Porcentajes
- Cada dimensión de 1 a 5 se convierte con `(n − 1) / 4 × 100`, y cada %, el de UX, el de UI y el de
  Marca, es el promedio de sus dimensiones.
- Un **P0** (texto ilegible, control que no hace nada, scroll horizontal del body, dato engañoso) deja su
  dimensión en 1.
- Escala: 0–50 % flojo · 51–75 % correcto · 76–89 % pulido · **90–100 % listo**.

## 6. El evaluador es otro, con vara fija y brecha completa
**Quien arregla no se pone la nota.** Mide un subagente nuevo (`general-purpose`), sin la historia de
los arreglos, con:
- el código o el HTML, las capturas, esta rúbrica, `${CLAUDE_SKILL_DIR}/varas.md`,
  `${CLAUDE_SKILL_DIR}/antipatrones.md` y la marca (paso 1);
- la orden de devolver, en este orden:
  1. el veredicto de dirección (paso 3);
  2. los tres % con la nota y la evidencia de cada dimensión, y los P0;
  3. la **brecha completa hasta 5**: por **cada** dimensión bajo la meta, **todos** los cambios concretos
     (elemento, cambio y dónde en el código), con su severidad.

  **Nunca un top 5.** Un top 5 convierte un arreglo de una ronda en cinco rondas de +5 %: pasó el
  25/11/2026, cuando la nota subió 50 → 60 → … teniendo la lista entera desde la primera ronda.
- En las rondas 2 en adelante, la brecha anterior se usa como lista de verificación: qué se cerró, qué
  no, qué regresión apareció y qué es nuevo.

El evaluador no premia lo que no puede verificar y lo dice.

## 7. Ciclo
1. **Medir** con el evaluador, en los pasos 2 a 6.
2. **Decidir:** siempre primero los mockups (paso 3-bis), con la página abierta por `propuestas.py`, y la
   elección del usuario en el modal, **antes** de tocar nada. Las demás decisiones del usuario (quitar una función, cambiar un flujo) también se
   preguntan al principio, nunca al final.
3. **Ejecutar todo** en una sola ronda: la dirección elegida y la brecha completa, empezando por los P0.
   Primero se ordenan los tokens (escala de espacio y de tipo, colores de la marca) y después los
   componentes. No se rompe la funcionalidad. Se verifica la sintaxis y se miran las capturas propias
   antes de pasar a medir.
4. **Verificar** con un evaluador **nuevo** y capturas nuevas. Se para cuando los tres % llegan a la meta.

## 8. Entregar: un informe visual, no un texto en el chat
El resultado es una **página HTML** que se abre en el navegador por defecto como pestaña:
`<proyecto>/.diseno/auditorias/<AAAA-MM-DD>-<vista>/index.html`. Si no hay carpeta de proyecto (por ejemplo,
solo un enlace de Figma), va en `<stateDir>/diseno/auditorias/…`. Es un solo HTML autocontenido, con las
capturas embebidas o junto a él, con la marca de la herramienta auditada y modo claro y oscuro. Lleva:
- arriba, el **veredicto de dirección** y los **tres %** grandes, con su escala (flojo, correcto, pulido, listo);
- la tabla de rondas: ronda, dirección, UX %, UI %, Marca % y qué cambió;
- las **capturas** por ancho, con antes y después cuando hubo cambios, y cada hallazgo marcado sobre su
  captura o al lado (número, severidad y elemento);
- la **brecha completa** agrupada por severidad (P0 → P3), cada una con problema, impacto y cambio propuesto;
- el enlace a los mockups A/B/C si los hubo, y al Figma auditado si la fuente fue Figma;
- lo que no se pudo verificar (teclado real, lector de pantalla, otro navegador, prototipo) y, si se quiere
  seguir, las 3 cosas que más subirían la nota.
En lo laboral, si hay que compartirlo, se publica como artifact privado y se da el enlace. En el chat va
solo un resumen de 5 líneas con los % y la ruta o el enlace del informe.

## Reglas de oro
- **Dirección antes que detalle:** no se pule lo que hay que rediseñar.
- **Marca siempre, y entra por tokens:** nada de colores ni tamaños sueltos.
- **Menos es más:** cada borde, tarjeta, acento y mayúscula se justifica; lo que no informa, se quita.
  La audacia se gasta en un solo lugar.
- **Accesibilidad como piso:** AA en contraste, foco visible, teclado completo y `prefers-reduced-motion`.
- **El rojo es alerta**, no decoración.
- **No inflar el número.**

## Cuándo NO usarla
- Crear algo que todavía no existe → `artifact-design`. Después se mide con esta skill.
- Revisar el código de un PR → `revisar-pr`.

## Archivos
| Archivo | Cuándo leerlo |
|---|---|
| `varas.md` | Siempre que se mida: qué es un 5 en cada dimensión (se le pasa al evaluador) |
| `antipatrones.md` | En el veredicto de dirección y al medir carácter: lo que delata una plantilla genérica o una UI hecha por IA |
| `scripts/propuestas.py` + `plantillas/comparador.html` | En el paso 3-bis: arma y abre la página de propuestas A/B/C con selector de ancho |
| `perfiles/marca-ejemplo.md` | Al crear o completar el perfil de marca de una organización (formato con datos ficticios) |
