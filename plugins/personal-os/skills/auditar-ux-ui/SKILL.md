---
name: auditar-ux-ui
description: Audita y mejora la UX y la UI de una herramienta laboral (un artifact HTML, un tablero, una pantalla) con la marca de la organización del usuario, y entrega tres porcentajes (UX, UI y Marca, más alto = mejor). En modo «hasta la meta» repite medir → arreglar → volver a medir hasta que los tres pasen el umbral (90 % por defecto), con un evaluador independiente que no ve los arreglos. La marca sale del perfil de marca de la organización; sin perfil, mide UX y UI. Úsala cuando digan "auditar ux/ui", "pásale la skill de diseño", "que quede corporativo", "dale un porcentaje de ux", "no paramos hasta 90", "pulir el tablero" o pidan subir la calidad visual de algo laboral. No es para diseñar una pantalla desde cero ni para revisar el código de un PR (revisar-pr).
argument-hint: "[auditar | hasta la meta <N>%] <archivo o url del artifact>"
---

# auditar-ux-ui — medir en %, arreglar y volver a medir

Responde con evidencia dos preguntas sobre una herramienta laboral: **¿es fácil de usar?** (UX) y
**¿se ve bien hecha y con la marca de la organización?** (UI + Marca). Los puntajes van en
**porcentaje donde más alto es mejor**.

> Solo para lo **laboral** (ámbito de `CORE.md` §12: proyectos y clientes de `fuentes.yaml`). Si la
> herramienta es personal no aplica la marca: mide UX y UI, o usa las skills de UX propias del
> proyecto si las tiene. Si no está claro, se pregunta en el modal.

## 0. Modo y meta
- **Auditar:** diagnóstico + tres porcentajes + backlog. No toca nada.
- **Hasta la meta** (cuando digan "no paramos hasta…"): ciclos de medir → arreglar → medir. Meta por
  defecto **≥ 90 % en UX, UI y Marca**; si el usuario da otra, esa.
- Tope de seguridad: **5 ciclos**. Si al quinto no llega, se para y se dice qué lo frena (casi siempre
  algo estructural que necesita una decisión del usuario).

## 1. Cargar el perfil de marca (no inventar)
`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`; la configuración, en
`<stateDir>/config/fuentes.yaml`. El perfil de marca es la ruta `organizacion.marca` de ese archivo
(relativa a su carpeta); si la clave no está, `marca/MARCA.md` junto a `fuentes.yaml`. Formato en
`perfiles/marca-ejemplo.md`. Del perfil salen:
- **Paleta**: primarios, neutros y semánticos. Los semánticos (crítico, alto, ok) **solo dicen
  estado**, nunca decoran.
- **Tipografía** de títulos, cuerpo y datos.
- **Logos** (archivos junto al perfil): cuál va en cada fondo y su tamaño nativo. Nunca escalados por
  encima de ese tamaño, ni deformados ni recoloreados. En un artifact van como data URI.
- **Patrón de documento**: fondo dominante, bandas, tablas, cifras, callouts, pie.

Si el perfil dice que un manual oficial lo reemplazó, manda el manual. **Sin perfil**: pregunta una vez
en el modal si hay manual o archivo de marca y dónde (y guarda la ruta en `organizacion.marca`); si no
hay, la dimensión Marca queda **«sin perfil»**, no se puntúa y la meta aplica solo a UX y UI.

En un artifact también rigen `artifact-design` (tema claro/oscuro con tokens, celular a 400 px, sin
scroll horizontal del body): cárgala antes de tocar el HTML.

## 2. Fijar persona y trabajos clave
- **Persona:** quien usa la herramienta a diario (líder técnico, jefe de desarrollo, analista), con
  prisa, sin leer instrucciones.
- **Trabajos clave:** 4 a 6 caminos reales de la herramienta (p. ej. en un Gantt: ver la carga de hoy,
  replanear una vencida, revisar a una persona 1 a 1, actualizar desde Jira). Confírmalos si hay duda.

## 3. Rúbrica (cada dimensión 1–5, con evidencia: vista + elemento + qué se ve)
**UX** (fricción): claridad de propósito · carga cognitiva · navegación y nombres · primer uso y
estados vacíos · consistencia · prevención de errores y confirmaciones · lenguaje claro sin jerga ·
visibilidad del estado (qué pasó, de cuándo son los datos) · celular · accesibilidad (teclado, foco,
contraste, etiquetas).

**UI** (acabado visual): jerarquía visual · ritmo de espaciado · color y contraste en claro **y**
oscuro · tipografía y escala · consistencia de componentes · estados (vacío, carga, error, hover,
foco) · motion sutil con `prefers-reduced-motion` · densidad y respiración · remate responsive.

**Marca** (contra el perfil): paleta y uso disciplinado del color · tipografía de la marca · presencia
y uso correcto del logo · patrón de tablas y cifras del perfil · tono sobrio (nada que parezca
plantilla genérica).

## 4. Porcentajes
- Cada dimensión de 1–5 se lleva a %: `(n − 1) / 4 × 100`. **UX %, UI % y Marca %** = promedio de sus
  dimensiones. Más alto = mejor.
- Un **bloqueante** (texto ilegible, control que no hace nada, scroll horizontal del body, dato
  engañoso) deja esa dimensión en 1 hasta que se arregle, sin importar lo demás.
- Escala: 0–50 % flojo · 51–75 % correcto · 76–89 % pulido · **90–100 % listo**.

## 5. El evaluador es otro (para que el número no sea complaciente)
En modo «hasta la meta», **quien arregla no se pone la nota**. Cada medición la hace un subagente
nuevo (`general-purpose`), sin la historia de los arreglos, con:
- la ruta del archivo a evaluar (o el HTML leído del artifact),
- esta rúbrica (secciones 3 y 4) y la ruta del perfil de marca,
- la orden de devolver: los tres % con la nota de cada dimensión y su evidencia, los bloqueantes y el
  Top 5 de arreglos de mayor impacto.
El subagente evalúa el código y el marcado (no ve la página renderizada): que lo diga en su reporte y
que no premie lo que no puede verificar.

## 6. Ciclo
1. Medir (evaluador). Guardar los % de esa ronda.
2. Arreglar el Top 5 del evaluador, empezando por bloqueantes. Cambios acotados, sin romper la
   funcionalidad (conexiones, datos, permisos). Verificar la sintaxis del script tras cada tanda.
3. Publicar (si es artifact) y volver a 1 con un evaluador **nuevo**.
   **Pedir una captura al usuario en la primera y en la última ronda** (escritorio, y celular si
   aplica): el evaluador lee código y no ve el render. Ya pasó que cinco rondas no detectaran un título
   azul sobre azul (una regla vieja ganaba por especificidad) y la captura lo mostró en segundos. Si hay
   captura, pásasela al evaluador como evidencia.
4. Parar cuando los tres % ≥ meta, o al quinto ciclo.

## 7. Entregar
Tabla de rondas (ronda · UX % · UI % · Marca % · qué se arregló), los bloqueantes que quedaron y lo que
el evaluador no pudo verificar (render real, celular, modo oscuro) para que el usuario lo mire. Cierra
con las 3 cosas que más subirían el puntaje si se quisiera seguir.

## Reglas de oro
- **Refinar, no reinventar:** respeta la estructura y los tokens de la herramienta; la marca entra por
  los tokens.
- **Claro y oscuro siempre**, contraste AA en ambos.
- **El rojo es alerta**, no decoración ni tipo de trabajo.
- **No inflar el número:** si algo no se puede verificar sin verlo renderizado, se dice y no suma.
- **La marca de una organización nunca va dentro del plugin**: vive en su perfil, en el estado.

## Cuándo NO usarla
- Diseñar una pantalla o un artifact nuevo → `artifact-design` (y después esta skill para medirlo).
- Revisar el código de un PR → `revisar-pr`.
- Herramientas personales sin marca de organización → solo UX y UI, o las skills de UX del proyecto.

## Archivos
| Archivo | Cuándo leerlo |
|---|---|
| `perfiles/marca-ejemplo.md` | Al crear o completar el perfil de marca de una organización (formato con datos ficticios) |
