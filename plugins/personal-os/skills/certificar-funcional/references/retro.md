# Retro: borradores y lecciones

Léelo en el paso 3. Los dos textos son borradores: no se envían ni se publican desde aquí.

## 1. Correo al equipo (voz del líder)

- **Asunto:** `Cierre de <requerimiento> (<clave>): <veredicto en palabras>`.
- **Cuerpo, en este orden y corto (8-15 líneas):**
  1. Qué se entregó y para quién, en una frase sin códigos internos sueltos (la clave va con su nombre).
  2. Veredicto funcional y estado de la matriz: «12 de 12 criterios probados con evidencia».
  3. Lo que salió bien, **con nombre propio** y concreto.
  4. Lo que se ajusta la próxima vez: las lecciones elegidas, como acuerdo, no como reproche.
  5. Horas: estimado vs. real en una línea, sin justificar de más.
  6. Siguiente paso (despliegue, monitoreo, quién y cuándo).
- Sin datos de pacientes, sin capturas pegadas, sin nombres de herramientas de IA.

## 2. Comentario de Jira (historia)

```
Certificación funcional: <veredicto>.
Matriz: <n> filas (<criterios> criterios, <calidad> de calidad, <modos> modos de falla a regresión), <ok> OK, <falla> en falla.
Evidencias: <carpeta o enlace interno>, solo datos sintéticos.
Revisión técnica: <PR y veredicto final>.
Horas: estimado <e> h, real <r> h (<desvío> %).
Pendiente: <lo que quede abierto o «nada»>.
```

## 3. Lecciones que sirven

Una lección sirve si cambia algo concreto en la próxima planeación o revisión y trae su dato:
- «El CA-2 cambió durante el desarrollo y la historia no se actualizó: QA probó contra el texto viejo» →
  acción: actualizar el CA en la historia en el mismo momento en que se decide.
- «La subtarea de cargue masivo se estimó en 4 h y tomó 9 h: el validador de Excel no estaba en la matriz» →
  acción: agregar «validación de archivo» como tipo en la matriz de tiempos.
No sirven: «comunicarnos mejor», «probar más», «estimar mejor».
