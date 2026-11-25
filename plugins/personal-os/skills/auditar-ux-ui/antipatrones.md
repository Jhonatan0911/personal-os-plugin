# Antipatrones: lo que delata una plantilla o una UI hecha por IA

Cada antipatrón que aparece baja la dimensión **Carácter** y, según el caso, también la de jerarquía o la de
densidad. Se nombra en el hallazgo con su código (p. ej. «AP-03») y una evidencia: la captura o la línea de
código.

Hay una excepción: si la marca (perfil o `DESIGN.md`) pide expresamente uno de estos recursos, no cuenta como
antipatrón. Se cita la regla de la marca que lo pide.

## Forma
- **AP-01 · Todo es una tarjeta.** Cuadrículas de tarjetas idénticas para contenido que se compara, se lee
  en secuencia o se configura. Se reemplazan por una tabla, una lista, una gráfica o un formulario agrupado.
- **AP-02 · Tarjetas dentro de tarjetas.** Panel dentro de panel dentro de panel. Se aplana a un solo nivel
  con separadores o espacio.
- **AP-03 · Dashboard de adorno.** Cifras grandes que no responden a ninguna decisión, o gráficas sin
  pregunta. Cada cifra debe llevar contexto: comparación, tendencia o meta.
- **AP-04 · Panel hueco.** Una ficha vacía del alto de la lista, o columnas vacías junto a contenido apretado.
- **AP-05 · Scroll dentro de scroll.** Listas con altura fija y barra propia dentro de una página que ya se
  desplaza.

## Tipografía y texto
- **AP-06 · Etiqueta en mayúsculas espaciadas sobre cada título.** Un «eyebrow» monoespaciado y en gris en
  cada bloque. Se reserva para uno o dos lugares; lo demás se resuelve con la escala tipográfica.
- **AP-07 · Mayúsculas y monoespaciada para todo.** Botones, pestañas, chips y encabezados en mono y en
  mayúsculas: baja la legibilidad y aplana la jerarquía.
- **AP-08 · Sopa de tamaños.** Más de 6 tamaños, o tamaños sueltos en estilos en línea. También el texto de
  interfaz por debajo de 11 px.
- **AP-09 · Una palabra acentuada en el titular.** Un color distinto en una sola palabra en cada título o
  gancho, como recurso por defecto.
- **AP-10 · Metadatos «A · B · C» y flechas «→»** en cada enlace o en cada meta, como decoración.
- **AP-11 · Numeración falsa** (01, 02, 03) cuando el contenido no es una secuencia.
- **AP-12 · Texto escrito para el sistema:** ids técnicos, «Úsala cuando…», jerga interna o errores que
  piden perdón en vez de decir qué pasó.

## Color y superficie
- **AP-13 · Degradados morado y azul, glow, neón o vidrio** como decoración.
- **AP-14 · Demasiados acentos.** Más de un color de acento fuerte compitiendo en la misma pantalla.
- **AP-15 · Texto gris sobre fondo de color**, o texto apagado por debajo de AA.
- **AP-16 · Color semántico como decoración.** Rojo, ámbar o verde usados sin que indiquen un estado.
- **AP-17 · Bordes por todas partes.** Cada elemento con su borde y su sombra; el espacio no hace su trabajo.

## Iconos, motion y componentes
- **AP-18 · Emoji como icono.** Se usa SVG con `aria-hidden` y una etiqueta.
- **AP-19 · Un cuadrado redondeado con icono sobre cada título.**
- **AP-20 · Fade y slide-up en cada sección,** o animaciones dispersas en vez de un solo momento orquestado.
  Además, sin respetar `prefers-reduced-motion`.
- **AP-21 · Tres variantes del mismo componente** (ítems de lista, botones, pastillas) en la misma
  herramienta.
- **AP-22 · Barras de scroll y controles nativos sin tematizar** en un tema oscuro.
- **AP-23 · Filtros o controles que no aplican** a la vista actual pero siguen visibles.
