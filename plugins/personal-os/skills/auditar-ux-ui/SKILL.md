---
name: auditar-ux-ui
description: Audita, rediseña y pule la UX y la UI de una herramienta (un artifact HTML, un tablero, una consola, una pantalla) como lo haría un equipo de diseñador gráfico senior, diseñador de producto y experto en desarrollo de UI, siempre contra una marca (la de la organización en lo laboral, la identidad propia del producto en lo personal). Primero da un veredicto de dirección (pulir, reestructurar o rediseñar, incluso cambiar tarjetas por un dashboard, una tabla o una gráfica, o volverlo minimalista), luego mide tres porcentajes (UX, UI y Marca, más alto = mejor) contra varas fijas y cierra la brecha completa en una sola ronda, con un evaluador independiente y capturas reales en varios anchos. Úsala cuando digan "auditar ux/ui", "pásale la skill de diseño", "que quede corporativo", "dale un porcentaje de ux", "no paramos hasta 90", "pulir el tablero", "rediséñalo", "hazlo más minimalista", "esto se ve feo" o pidan subir la calidad visual de algo. No es para diseñar desde cero algo que no existe (artifact-design) ni para revisar el código de un PR (revisar-pr).
argument-hint: "[auditar | hasta la meta <N>% | rediseñar | más sobrio | más audaz] <archivo, url o vista>"
---

# auditar-ux-ui — dirección, medida y brecha completa

Responde con evidencia tres preguntas: **¿está bien planteada?** (dirección de diseño), **¿es fácil de
usar?** (UX) y **¿se ve hecha por un diseñador y con su marca?** (UI + Marca). Actúa como un equipo
senior: un diseñador gráfico que juzga forma, jerarquía, tipografía y color; un diseñador de producto que
juzga flujos y arquitectura de información; y un desarrollador de UI que sabe lo que el código puede dar.
**No se limita a pulir lo que hay**: si la vista está mal planteada, lo dice y propone el cambio de fondo.

## 0. Modos y meta
- **Auditar:** veredicto de dirección, tres porcentajes y brecha completa. No toca nada.
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

### 3-bis. Cambio grande → mockups en HTML y CSS antes de tocar el código
Si el veredicto es **reestructurar o rediseñar** (o el usuario pide «rediseñar»), no se toca la herramienta
hasta que el usuario elija sobre **mockups navegables**:
1. **Una página de comparación** en `<proyecto>/.diseno/propuestas/<AAAA-MM-DD>-<vista>/index.html`
   (para un artifact, junto a su archivo). Es un solo HTML autocontenido, con CSS en línea y sin dependencias
   salvo las fuentes de la marca. Lleva:
   - las propuestas **A, B y C** (2 como mínimo y 3 como máximo; la recomendada es la A), cada una en su
     pestaña, más la pestaña **«Actual»**, que es la captura de hoy, para comparar;
   - en cada propuesta, su idea en una línea, **qué gana y qué pierde**, el nivel de cambio y los
     antipatrones que elimina;
   - un selector de ancho (**escritorio 1440 / tableta 768 / celular 390**) que muestra la propuesta en un
     marco de ese ancho.
2. **Las propuestas son distintas de verdad, no tres variantes de color.** Ejemplos: A, minimalista sin
   tarjetas, con formularios agrupados; B, dashboard arriba con el detalle en tabla; C, lista con panel
   lateral. Cada una usa **los tokens y la marca reales** (paso 1) y el **contenido real** de la vista:
   nombres, secciones y textos. Los datos son ficticios si hay personas, credenciales o cifras sensibles.
   Muestran los estados que importan, por lo menos con datos y vacío.
3. **Es solo forma, sin lógica.** Los mockups no se conectan a nada ni guardan nada: es HTML estático con
   interacciones mínimas (pestañas, el selector de ancho, un hover). Se miran en captura a 1440 y 390 antes
   de mostrarlos.
4. **Se abren en el navegador por defecto** como pestaña (si es laboral y hay que compartirla, se publica
   como artifact privado). Después se pregunta en el modal: **A · B · C · ninguna (con qué cambiar) ·
   combinar** (p. ej. «la estructura de B con la tipografía de A»). En la vista previa de cada opción va un
   boceto ASCII de la propuesta.
5. **Si dice «ninguna» o «combinar»,** se hace una ronda más de mockups con su indicación antes de tocar el
   código. Con la elección aprobada se ejecuta (paso 7) y la propuesta elegida pasa a ser el criterio de
   «hecho»: el resultado final se compara con su mockup en captura.

Para pulir (cambios de detalle) no hace falta mockup: se ejecuta la brecha directo.
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
2. **Decidir:** si el veredicto pide reestructurar o rediseñar, primero van los mockups A, B y C (paso
   3-bis) y la elección del usuario, **antes** de tocar nada. Las demás decisiones del usuario (quitar una función, cambiar un flujo) también se
   preguntan al principio, nunca al final.
3. **Ejecutar todo** en una sola ronda: la dirección elegida y la brecha completa, empezando por los P0.
   Primero se ordenan los tokens (escala de espacio y de tipo, colores de la marca) y después los
   componentes. No se rompe la funcionalidad. Se verifica la sintaxis y se miran las capturas propias
   antes de pasar a medir.
4. **Verificar** con un evaluador **nuevo** y capturas nuevas. Se para cuando los tres % llegan a la meta.

## 8. Entregar
- Tabla de rondas: ronda, dirección, UX %, UI %, Marca % y qué cambió.
- Capturas de antes y después.
- Los P0 y P1 que quedaron.
- Lo que no se pudo verificar: teclado real, lector de pantalla, otro navegador.
- Si se quiere seguir, las 3 cosas que más subirían la nota.

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
| `perfiles/marca-ejemplo.md` | Al crear o completar el perfil de marca de una organización (formato con datos ficticios) |
