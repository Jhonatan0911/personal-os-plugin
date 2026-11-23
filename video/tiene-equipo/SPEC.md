GOAL:    quien ve la landing entiende en 36 s que en el Personal OS cada agente tiene cara, oficio y memoria que aprende,
         y una oficina donde verlo trabajar: se sigue a UN agente desde que se le pide algo hasta que vuelve a su escritorio.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps. Loop silencioso en la web (autoplay muted), igual que «Ahora sueña». Sin voz.
TIME:    36 s x 30 = 1080 frames.
DATA:    todo ficticio (repo público). Protagonista `revisor-de-codigo` (familia «Míos», color azul #4c9bff, accesorio lupa):
           oficio «Revisor de código» · lema «Leo el diff antes que el título.»
           límites: «No aprueba sin leer los criterios de aceptación.» · «No toca la base de datos.» · «No sube nada a producción.»
           conocimiento: «Criterios de revisión del equipo» · experiencia nueva: «Validaciones que no se pueden borrar»
         Compañeros en la lista: los 6 del Personal OS (brief-jira, brief-outlook, brief-teams, redactor-correos,
         refutador-requerimiento, revisor-estimacion: osito turquesa con sinapsis) — son nombres públicos del plugin.
         El pedido en la terminal: «revisa el cambio del login con revisor-de-codigo».
         NUNCA clientes, personas, servidores ni nombres de la empresa.
LOOK:    el medio es la UI REAL de la consola (no un mockup): suelo #070b12 con sus tintes radiales (azul 10 % arriba
         derecha, violeta 9 % arriba izquierda, cian 6 % abajo); paneles #0f1622 con borde rgba(120,150,200,.22), radio 16 px;
         ink #e6ecf7, tenue #8796ae. Acento = cian #35e0d0 (estado «trabajando», el ✓ de experiencia y el claim).
         Display: Inter 900, 92 px, tracking -3 %. UI: JetBrains Mono 400/700 26-30 px (≥ 26 px tras cualquier zoom).
         Mascotas: SIEMPRE con `assets/identidad-agente.js` → `IdentidadAgente.svg(agente)` (el mismo dibujo de la consola),
         a 1.6-2× su tamaño real en los planos de producto. Las clases del SVG: .cu cuerpo, .oj ojos, .chispa, .ok.
         Oficina: capturas reales en `assets/oficina-*.png` (escena 3D del producto, tema claro; se entra a ella, no se pega).
OBJECTS: lista de agentes (tarjeta: mascota 40 px · nombre mono 13 → escalado · lema/oficio · «hace 2 h» / «1 esta semana»);
         terminal de Claude Code (fondo #0b0f17, prompt «>», línea de agente «● revisor-de-codigo(Revisar el cambio del login)»);
         ficha (mascota 112 px, nombre, chips «✎ tuyo» · «Revisor de código» · «🧠 memoria», lema en cursiva, límites);
         memoria en dos columnas (Conocimiento · lo escribes tú / Experiencia · la escribe el agente) con tarjetas de archivo;
         oficina 3D (captura) con el revisor en su escritorio; cierre con lockup.
MOTION:  llegada expo.out 0.5-0.7 s; cámara power2.inOut 0.8-1.2 s; salidas power3.in, 40 % más cortas.
         Mascota en reposo: respira (escala 1.025/0.975 en 4.2 s) y parpadea; «trabajando»: rebote translateY -5 % cada 0.7 s
         + chispas (.chispa); al terminar se asienta y aparece .ok. Todo en función del tiempo del timeline (sin repeat:-1:
         repeticiones con número fijo de ciclos).
         Títulos por palabra con blur 6→0 en 0.13 s, 0.07 s entre palabras; quietos al aterrizar. ≤ 6 palabras por línea.
SHOTS:   f0-90     GANCHO: la lista ⚙ CONFIG a 1.6x: «Míos · 1» con el revisor arriba y 4 ositos del OS debajo, todos respiran;
                   el revisor tiene los ojos cerrados (parpadeo lento). Frame 0 ya muestra la lista (nunca negro).
         f90-210   PEDIDO: la tarjeta del revisor se desliza al borde y entra la terminal (objeto a objeto); se escribe el
                   pedido (28 caracteres/s) y aparece la línea «● revisor-de-codigo(Revisar el cambio del login)».
         f210-330  DESPIERTA: volvemos a la lista: el revisor abre los ojos, rebota con chispas; su estado pasa a
                   «trabajando · 0 min» en cian. Título: «Tus agentes ya tienen cara.»
         f330-540  FICHA: la tarjeta se expande en la ficha (morph del contenedor): mascota 112 px, chips, lema, límites que
                   entran uno a uno. Título: «Con oficio y límites.»
         f540-720  MEMORIA: baja a la sección Memoria; se abre «Criterios de revisión del equipo» (3 líneas se resaltan);
                   al cerrar, en Experiencia aterriza «Validaciones que no se pueden borrar» con el ✓ cian. Título: «Y aprenden de cada trabajo.»
         f720-900  OFICINA: la mascota se separa de la ficha y la cámara se aleja/entra a la captura de la oficina 3D hasta
                   su escritorio (carry across); se asienta, .ok encima. Título: «Con su oficina.»
         f900-1080 CIERRE: «Ahora tiene equipo.» 120 px (la palabra «equipo» en cian); debajo lockup «Personal OS 4.0» +
                   chip de comando «/consola», quieto 2.5 s.
BANNED:  mascotas de Anana; datos reales (clientes, personas, servidores, empresa); escribir en un prompt como apertura;
         tres tarjetas en fila; título sobre captura atenuada; logo en una esquina; partículas decorativas; todo entrando con
         fade + slide-up; cartas flotando en el vacío; UI inclinada en 3D; ventana pequeña en medio del lienzo vacío.
QA:      f45 (lista legible, mascotas), f170 (terminal legible), f290 (revisor trabajando + título), f470 (ficha legible),
         f650 (experiencia aterrizando), f830 (oficina con el revisor), f1040 (cierre).
