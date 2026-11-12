# Fase 4 — Maquetación y salida

## Índice
- Estructura del archivo
- Tokens
- Componentes
- Diagramas SVG
- Salida a PDF
- Comprobar la regla de una idea por página (no se supone, se mide)
- PPTX (opcional)
- Dónde se guarda

Formato: **un solo archivo HTML autocontenido**, A4 apaisado, pensado para imprimirse a PDF. Sin
CDN, sin imágenes externas, sin JavaScript. Los diagramas son SVG en línea.

Punto de partida: `plantillas/base.html` (esqueleto, tokens y componentes, sin contenido).

---

## Estructura del archivo

Cada página es un `<section class="page">`; el salto lo da la impresión. La secuencia que funciona:

1. **Portada** (`.cover`): marca, título, subtítulo, párrafo de 3 líneas, y el bloque `.meta` con
   preparado por / dirigido a / solicitado por / fecha / alcance / versión.
2. **Secciones de contenido**: cada una abre con `.sec-head` — un `.kicker` ("Sección 3", o
   "Sección 4 · Flujograma B"), el `h2`, y un `.lead` de una línea que dice de qué va.
3. **Anexos** al final, con el kicker "Anexo".

Regla de página: **una idea por página**. Un diagrama grande ocupa su página completa. Si una tabla
se parte en dos páginas, o la reduces o la divides en dos tablas con sentido propio.

## Tokens

Los de `base.html` (ya probados en impresión A4 apaisada):

- Texto `--ink` sobre blanco, secundario `--muted`, líneas `--line`.
- Un solo color de acento (`--blue`) para `h2`, cabeceras de tabla y bordes de tarjeta.
- `--amber` solo para lo pendiente, `--green` solo para lo confirmado. **El color comunica estado;
  no se usa para decorar.**
- Cuerpo 10.5pt, tablas 9pt, `.kicker` 8pt en mayúsculas espaciadas.

No agregues colores nuevos. Un informe con cinco acentos parece una presentación de ventas.

## Componentes

| Componente | Cuándo |
|---|---|
| `table` | Lo que tiene 2+ dimensiones. Es el caballo de batalla del informe |
| `.grid2` / `.grid3` + `.card` | Actores, conceptos paralelos cortos. 3 a 6 tarjetas, no 12 |
| `.tag ok` / `.tag wip` | Estados dentro de una tabla |
| `.note` | Aclaración al pie de una sección |
| `.pending` | Lo que falta acordar. Ámbar punteado, se ve distinto a propósito |
| `.cols2` | Texto corrido largo (raro; casi todo debería ser tabla o tarjeta) |

## Diagramas SVG

Se escriben a mano, con `viewBox`, clases CSS dentro del `<svg>` y `height` fijo en mm para que
quepan en la página (`svg.fig-a{ height:143mm }`). Cada figura lleva su `.figcap` debajo, y el pie
dice algo que el dibujo no puede decir (por ejemplo, que dos fases se repiten N veces).

Los tres que valen la pena:

- **Carriles**: un carril por actor (con su subtítulo de rol), columnas por fase, flechas de ida
  sólidas y de vuelta punteadas. Es el diagrama que más entiende quien no sabe nada.
- **Capas**: una caja por capa con sus componentes reales dentro, y entre capas el protocolo
  escrito en la flecha. Al pie, la regla real de dependencia si existe ("cada capa solo conoce a la
  inmediatamente inferior") — solo si es cierta.
- **Estados**: cajas de estado y flechas etiquetadas con la acción que dispara la transición.

Cada texto del diagrama es un nombre real. Un carril sin evidencia es un actor inventado.

## Salida a PDF

Impresión headless desde el navegador instalado. **Ejecútalo por PowerShell, no por Bash**: en Git
Bash los argumentos que empiezan con `/` o rutas se transforman por MSYS y el comando termina en
exit 0 sin producir nada.

```powershell
$exe = "C:\Program Files\Google\Chrome\Application\chrome.exe"   # o msedge.exe
& $exe --headless --disable-gpu --no-pdf-header-footer `
  --print-to-pdf="<ruta absoluta>\informe-<tema>.pdf" `
  "file:///<ruta absoluta con / >/informe-<tema>.html"
```

**Dos trampas de Chrome headless, las dos comprobadas:**

- Usa **`--headless=new`**. El headless viejo no escribe el PDF.
- **Un `--user-data-dir` nuevo en cada invocación.** Reutilizar el perfil hace que Chrome termine
  **sin error y sin escribir el archivo**, así que te quedas con el PDF anterior creyendo que
  regeneraste. Si falla, `Stop-Process` sobre chrome y otro perfil. **Comprueba siempre la fecha de
  modificación del PDF, no solo que exista.**

## Comprobar la regla de una idea por página (no se supone, se mide)

El conteo total no basta: dice *cuántas* páginas hay, no *cuál* se desbordó. La forma que funciona:

1. Extrae cada `<section class="page">` a un HTML propio, con el mismo `<head>`.
2. Imprime cada uno a su propio PDF.
3. Cuenta páginas de cada uno: **el que dé 2 es el que se desborda**.

Con eso sabes exactamente qué sección cortar. Ya pasó que la primera pasada diera **35 páginas para 24
secciones** —desbordamiento sistemático e invisible— y esta comprobación localizó las cinco culpables;
tras partirlas quedó en **31 para 31**, y después del recorte final en **23 para 23**.

Cuando una sección se desborda hay dos salidas, en este orden: **cortarla en un punto con sentido**
(otra página con su propio `.sec-head` y su kicker de "continuación"), o **bajar la densidad de sus
tablas** con una clase que reduzca un punto la fuente y el `padding`. Lo que no se hace es dejar que
la tabla se corte sola: parte una fila por la mitad y se lee como un defecto de impresión.

Verifica también que **cada diagrama cabe en su página**: mismo truco, envolviéndolo en un `div` con
el alto útil de la hoja (A4 apaisada con márgenes de 13 mm ≈ 184 mm).

En Windows suelen estar Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) y
Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).

## PPTX (opcional)

Solo si el usuario lo pide. Se genera con `python-pptx` desde un script
(`build_pptx.py`), en una pasada aparte: **la presentación se deriva del informe ya aprobado**, no
se mantienen dos fuentes en paralelo. Una diapositiva por sección, el texto ya escrito, sin
diagramas nuevos.

## Dónde se guarda

En el proyecto, en su propia carpeta: `informe-desarrollo/` o `docs/informe-<tema>/`, con el
borrador Markdown, el HTML, el PDF y los assets. El borrador se conserva: es lo que permite
actualizar el informe dentro de dos meses sin repetir la Fase 1.
