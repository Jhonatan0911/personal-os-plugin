GOAL:    quien ve la landing entiende en 34 s que el Personal OS convierte la semana en lecciones
         mientras «duerme», y que ese saber lo acompaña también en lo personal sin las alarmas de la empresa.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps. Loop silencioso en la web (autoplay muted); música opcional aparte.
TIME:    34 s x 30 = 1020 frames.
LOOK:    el medio es la propia consola neuronal del plugin (su UI real, no un mockup):
         ground #070b12 con los mismos tintes radiales de la consola (azul 10 % arriba a la derecha,
         violeta 9 % arriba a la izquierda, cian 6 % abajo); paneles #0f1622 con borde rgba(120,150,200,.22), radio 18 px.
         ink #e6ecf7, tenue #7688a4. Acento SABER = cian #35e0d0 (solo lecciones y sinapsis).
         CONTROL de la empresa = azul #4c9bff; PERSONAL = violeta #a97bff; PROPUESTA/sueño = ámbar #f6c760.
         Display: Inter 900, 92 px, tracking -3 %. UI y bitácora: JetBrains Mono 400/700, 28-30 px.
         El brillo es el de la consola real (shadowBlur de nodos), no decoración añadida.
OBJECTS: terminal de la bitácora (cabecera con 3 puntos, ruta «estado/bitacora · semana 47», líneas «## HH:MM» + «- OS:»);
         etiquetas de ámbito por línea (empresa / personal); reloj «vie 17:30»;
         tarjeta de lección con el formato real de una nota CO (id · tema · nivel · casos, título-afirmación, Regla, Por qué);
         corteza: elipse con lóbulos por tema, neuronas, sinapsis curvas, arco de control con rombos; selector AMBAS/LABORAL/PERSONAL real.
MOTION:  llegada expo.out 0.5-0.7 s; cámara power2.inOut 0.8-1.2 s; salidas power3.in, 40 % más cortas.
         Títulos por palabra con blur 6→0 en 0.13 s, 0.07 s entre palabras; quietos al aterrizar.
SHOTS:   f0-210    bitácora lun→vie a 1.15x de escala, las líneas entran una a una (0.35 s), etiquetas de ámbito;
                   f150 reloj «vie 17:30» aterriza; texto «Viernes, 17:30.» (s1 pie).
         f210-300  la luz baja al 45 %; «El Personal OS se va a dormir.» por palabra; 5 líneas del mismo patrón se encienden en ámbar.
         f300-570  sueño: las 5 líneas se desprenden (carry across) y se vuelven 5 neuronas ámbar que se conectan;
                   «El sueño junta los casos.»; se funden y nace la tarjeta CO-077 (morph círculo→tarjeta);
                   sello «Aprobada por ti» a f520.
         f570-900  la tarjeta encoge hacia el lóbulo Método de la corteza (carry across); el cerebro se enciende lóbulo a lóbulo;
                   pulsos por las sinapsis; f760 el cursor toca PERSONAL: el control de la empresa se apaga (rayado),
                   las lecciones quedan encendidas; leyenda «En lo personal se apaga el control de la empresa. El saber, no.»
         f900-1020 «Ahora sueña.» 120 px; debajo lockup «Personal OS 3.17» + chip de comando «/consola», quieto 2.5 s.
BANNED:  personajes o mascotas de Anana; datos reales (clientes, personas, servidores); tres tarjetas en fila;
         título sobre captura atenuada; logo en una esquina; partículas decorativas; todo entrando con fade + slide-up.
QA:      f100 (bitácora legible), f280 (título dormir + ámbar), f450 (neuronas del sueño), f540 (tarjeta legible),
         f700 (corteza encendida), f820 (control apagado en personal), f990 (cierre).
