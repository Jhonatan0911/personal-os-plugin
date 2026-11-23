# REVIEW · «Ahora tiene equipo» (23/11/2026)

Historia A (un agente, de punta a punta). 36 s, 1920x1080, 30 fps, sin audio (loop silencioso de la landing).
Estado: `check` sin errores; **sin render** (espera aprobación de la vista previa).

## Escenas

| Host | Archivo | Tiempo | Beat del SPEC |
| --- | --- | --- | --- |
| `lista` | `compositions/lista.html` | 0–11 s | gancho (lista ⚙ CONFIG a ~2.1x) · la lista se va al borde · despierta + «Tus agentes ya tienen cara.» |
| `terminal` | `compositions/terminal.html` | 3–8.2 s (encima de la lista) | pedido a 28 car/s y línea «● revisor-de-codigo(Revisar el cambio del login)» |
| `ficha` | `compositions/ficha.html` | 11–24 s | morph tarjeta → ficha, límites uno a uno, baja a Memoria, abre el conocimiento, aterriza la experiencia ✓ |
| `oficina` | `compositions/oficina.html` | 24–30 s | iris desde la mascota a la captura real, carry across al escritorio, ✓, la cámara entra |
| `cierre` | `compositions/cierre.html` | 30–36 s | «Ahora tiene equipo.» 120 px + lockup Personal OS 4.0 + `/consola`, quieto 3.8 s |

## Decisiones creativas

- Ficha y Memoria van en **una sola escena** (`ficha`): son el mismo panel; la cabecera (mascota, nombre, chips) se queda fija y
  solo baja el cuerpo, así no hay corte ni cabecera duplicada.
- La terminal es su propia escena montada **encima** de la lista (3–8.2 s), para que la lista siga viva a la izquierda.
- **Desvío de tiempos del SPEC:** el despertar arranca en 6.3 s (f189) en vez de 7.0 s (f210), y la terminal se queda hasta
  8.2 s. Motivo: `check` marcaba `line_unread` en el pedido y la línea del agente (≈1 s en pantalla); ahora la línea del agente
  se lee 2.3 s y la mascota despierta **mientras** se ve la línea que la llamó (causa y efecto en el mismo plano). El título
  «Tus agentes ya tienen cara.» entra a 8.35 s y se lee 2.1 s. QA f290 sigue mostrando revisor trabajando + título.
- Zonas seguras: la lista termina en x=96, el panel de la ficha en 96–1176 y los títulos a la derecha desde x≈1064/1222.
- En la oficina la mascota 2D vuela a su escritorio, se encoge al tamaño de la escena y **se funde** con su versión 3D de la
  captura (no se pega encima); el ✓ va sobre la etiqueta «revisor-de-codigo», sin taparla.
- Las mascotas salen siempre de `assets/identidad-agente.js` (`IdentidadAgente.svg`), con los ids del gradiente
  reescritos por escena (`lrev`, `frev`, `orev`…) para que no choquen entre composiciones.
- Respirar, parpadear, rebotar (−5 cada 0.7 s) y chispas: tweens con número fijo de repeticiones; nada de `repeat:-1`.
- Fuentes: Inter y JetBrains Mono, ambas incluidas por HyperFrames (sin `@font-face`).

## Medido vs. solo mirado

- Medido: `check --json` → 0 errores. Frames QA del SPEC (1.5, 5.67, 9.67, 15.67, 21.67, 27.67, 34.67 s) en
  `.hyperframes/qa-final/`; hoja de beats, 5 costuras y hoja de teléfono en `.hyperframes/review/`.
- Solo mirado: la fluidez de los movimientos entre beats (no se hizo `keyframes --shot`).
- Nadie lo comprobó: el render final ni la reproducción en la landing.

## Advertencias que se mantienen a propósito

- `text_below_floor` (28 px): el SPEC fija la UI en JetBrains Mono 26–30 px (≥ 26 tras el zoom) para que sea fiel a la consola
  real; las etiquetas, metadatos y chips quedan en 26 px. Subirlas a 28 obliga a recortar el lema de las tarjetas.
- `film_silent`: el pedido es loop silencioso para la web.
- `container_overflow` en `#f-body` (info): es el scroll deliberado de la ficha dentro de su visor.
- `content_overlap` en `#l-idle` (info): el estado «hace 2 h» y «trabajando» están apilados y se cruzan por opacidad.

## Notas abiertas

- P2 · t=11.0 s · costura lista → ficha: en el primer frame del morph el panel recortado muestra solo el borde izquierdo
  (el derecho y el inferior caen fuera del recorte) → dibujar el borde con un `outline` interior que viaje con el recorte.
- P2 · t=21.67 s · la mitad inferior del panel queda vacía en Memoria → si se quiere, mostrar debajo «MEMORY.md · índice».
- P2 · t=30.0–30.3 s · 0.3 s de suelo vacío antes del claim (respiro deliberado; acortar si se siente muerto).
- Ojo con la captura `assets/oficina-principal.png`: es la real y muestra también la etiqueta `master-angular-20` (un agente
  propio, no del SPEC). No es un dato de cliente, pero conviene que el autor decida si queda en un video público.
- Plano más débil: la oficina (24–30 s) es una captura fija con zoom; con más tiempo, un recorrido real grabado de la
  oficina 3D le daría el «producto actuando» que hoy solo da el ✓.
