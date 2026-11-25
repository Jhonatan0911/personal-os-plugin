# Varas: qué es un 5 en cada dimensión

La nota se pone contra estas varas, no por intuición. Un 5 cumple **todo** lo de su línea. Un 4 falla en un
punto menor, un 3 en uno mayor o en dos menores, un 2 en varios mayores, y un 1 es un bloqueante. Todo debe
poder verificarse en una captura o en el código.

## UX
- **Claridad de propósito.** Cada vista y cada sección dice en una línea para qué sirve, y ningún control deja
  duda sobre lo que hace.
- **Carga cognitiva.** Una lista de más de 10 ítems tiene filtro o grupos. Los formularios largos se agrupan en
  bloques con nombre. Solo hay una acción primaria por zona. No hay ids técnicos a la vista.
- **Navegación y nombres.** Se llega a cualquier sección en un clic, el indicador de «dónde estoy» siempre
  acierta y los nombres son del usuario, no del sistema.
- **Primer uso y estados vacíos.** Todo vacío dice qué hacer y ofrece la acción. Nunca aparece un panel hueco.
- **Consistencia.** Un solo modelo de guardado por tipo de dato (o la diferencia se explica en la propia
  pantalla). Los mismos verbos, el mismo orden de botones y el mismo indicador de «sin guardar» en toda la
  herramienta.
- **Prevención de errores.** Lo destructivo se confirma y se puede deshacer o tiene respaldo. No se pierden
  cambios al salir, recargar ni cambiar de pestaña. Guardar se deshabilita si no hay cambios. Lo riesgoso avisa
  antes.
- **Lenguaje claro.** No hay jerga interna (fases, wrappers, ids) y todo está escrito para quien lo lee, no para
  el sistema.
- **Visibilidad del estado.** Cada acción deja un resultado visible y persistente (guardado y a qué hora),
  cada dato dice de cuándo es y nada promete lo que no hace.
- **Celular (390 px).** No hay scroll horizontal en el body, los objetivos táctiles miden 44 px o más, no hay
  scroll anidado, la tabla cabe sin partir encabezados, la ficha elegida aparece donde está el dedo y la
  pestaña activa se ve.
- **Accesibilidad.** Todo funciona con teclado y el foco es visible. Los grupos de radios son `radiogroup` o
  `fieldset`, los controles tienen etiquetas reales y el contraste es AA en el texto y de 3:1 en los bordes
  de los controles. Los diálogos atrapan y devuelven el foco y se cierran con Escape.

## UI
- **Forma adecuada al contenido.** Cada bloque usa la forma que su contenido pide: tabla para comparar,
  gráfica para una tendencia o una proporción, dashboard de pocas cifras con contexto para el estado,
  formulario agrupado para configurar y lista con filtro para elegir. No hay tarjetas por defecto (AP-01 a
  AP-05).
- **Carácter.** La pantalla tiene una identidad reconocible de su marca y no se confunde con una plantilla.
  No hay ningún antipatrón de `antipatrones.md` sin justificación de la marca, y la audacia está en un solo
  lugar.
- **Jerarquía visual.** El título de sección se distingue del ítem y del metadato, y solo hay un acento
  fuerte por pantalla. Los filtros que no aplican a la vista no se muestran.
- **Ritmo de espaciado.** Hay una escala de espacios y la separación entre secciones es mayor que la que hay
  dentro de ellas. Las columnas quedan alineadas.
- **Color y contraste.** Los tokens son del tema y el color semántico solo marca estado. El tema claro y el
  oscuro tienen AA, o el producto declara que solo usa uno.
- **Tipografía y escala.** Hay una escala de 4 a 6 tamaños en variables, sin tamaños sueltos en línea, y nada
  de texto de interfaz por debajo de 11 px.
- **Consistencia de componentes.** Hay un solo componente de ítem de lista, de botón y de pastilla, y la
  selección se marca igual en todas partes. No hay estilos en línea donde ya existe una clase.
- **Estados.** El vacío, la carga, el error, el hover, el foco y el deshabilitado existen y se distinguen.
- **Motion.** Es sutil y con propósito, y respeta `prefers-reduced-motion`.
- **Densidad y respiración.** No queda espacio muerto grande junto a contenido apretado, y la ficha se ajusta
  a lo que tiene.
- **Remate responsive.** En 390, 768, 1024 y 1440 px no hay textos ni barras cortadas y los encabezados
  no se parten mal.

## Marca
- **Paleta y disciplina del color.** Solo se usan los colores de la marca, por tokens. Los semánticos solo
  marcan estado y hay un acento principal.
- **Tipografía de la marca.** Familias y roles (título, cuerpo, dato) según la marca, con su escala y sin
  sustitutos genéricos.
- **Logo.** Aparece donde la marca lo pide, en la versión correcta para el fondo y sin pasar de su tamaño
  nativo. Ni deformado ni recoloreado.
- **Patrón de tablas y cifras.** Tablas, números, unidades y callouts como los define la marca.
- **Tono.** Los textos suenan a la marca y nada parece de otra empresa o de una plantilla.
