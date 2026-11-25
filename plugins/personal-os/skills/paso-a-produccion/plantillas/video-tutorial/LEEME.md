# Plantilla del video tutorial (paso-a-produccion)

Base neutral del video que acompaña al comunicado. **No se edita a mano:** `scripts/video.py` la copia a
`<P>/video/` y escribe las escenas desde un guion JSON (`guion-ejemplo.json` muestra la forma).

```
python -I scripts/video.py --guion <P>/video.json --carpeta <P> --config <fuentes.yaml>
```

Escenas: gancho (1-2 líneas) → un paso por captura (título a la izquierda, captura en una ventana con cámara
`F(px, py, zoom)`, cursor con clic opcional) → beneficios (opcional) → cierre con logo, producto y ruta del menú.
Cada sonido tiene su causa en pantalla (entra la ventana, clic, bloques, cierre).

Si la persona tiene videos anteriores como referencia (`paso_produccion.video.ejemplos` en su configuración),
léelos antes de escribir el guion: muestran hasta dónde se puede pulir una escena a mano después de generarla.

Luego: `musica.py` (cama musical local) → volver a correr `video.py` para enlazarla → `npx hyperframes check`,
`snapshot`, `REVIEW.md` → `npx hyperframes render -o ../video-tutorial.mp4`.
