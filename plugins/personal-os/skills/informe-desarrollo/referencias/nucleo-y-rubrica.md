# Núcleo obligatorio y rúbrica de aceptación

Léelo en la Fase 2 (al armar el plan de secciones) y en la Fase 5 (al autoauditar y verificar).

## Índice
- 1. Núcleo obligatorio
- 2. Rúbrica de aceptación
- 3. Autoauditoría (Fase 5)
- 4. Lo aprendido al verificar

## 1. Núcleo obligatorio de un informe de orientación (siempre, en este orden)

1. **Portada** — título, subtítulo de una línea, párrafo de 3 líneas que dice qué es esto, y el
   bloque de metadatos (preparado por / dirigido a / fecha / alcance / versión).
2. **Qué resuelve** — el problema de negocio en lenguaje de negocio, y las operaciones que el
   sistema ofrece. Aquí **no** se nombran tecnologías. Incluye **qué NO cubre**.
3. **Actores y perfiles** — cada humano por rol y cada sistema, con una línea de "qué hace".
4. **El mapa de las piezas** — un repo (o módulo) por fila, y una columna que no es negociable:
   **por dónde entrar** — qué archivo abrir primero para tocar esa pieza. Más su puerto, si aplica.
   *Esta columna es la que hace que el informe responda "cambia este botón".*
5. **El flujo de punta a punta** — fases numeradas. La tabla que mejor funciona:
   *fase / qué lo dispara / qué ocurre de verdad*. Distingue a una persona de un disparo automático:
   confundirlos hace que el lector busque un llamador que no existe.
6. **Cómo verlo funcionando** — qué servicios hay que tener arriba **a la vez**, con qué puertos,
   qué datos de prueba y con qué script se siembran. Un caso de referencia sin el dato para
   reproducirlo no es reproducible.

Todo lo demás es condicional y se elige con `referencias/dimensiones.md`. En la práctica, en un
sistema con base de datos y varios repos, casi siempre se ganan su lugar: **objetos de base de
datos**, **ciclos de vida / máquinas de estado**, **contratos entre repos**, **arquitectura por
capas** y **despliegue**.

### Y solo si la Fase 0 dijo *diagnóstico*, se añaden al final

7. **Estado real del desarrollo** — componente / estado / nota. Estados permitidos: Implementado,
   Implementado sin desplegar, Parcial, En definición, No iniciado. Cada "Implementado" dice
   **dónde se probó**. Si las tablas son una selección y no la lista completa, **dilo**: si no,
   parece que el documento se contradice con sus propias cifras.
8. **Lo abierto** — decisiones pendientes, riesgos, supuestos, preguntas sin responder, con dueño
   cuando se sepa.
9. **Deuda heredada**, si la hay y si el diagnóstico la pidió — el hecho y **dónde está**. Sin
   valores de secretos, sin datos de personas.

**En un informe de orientación estos tres no existen**, ni resumidos, ni como nota al pie, ni como
"para más detalle ver". Su material se entrega aparte (Fase 6).

---

## 2. Rúbrica de aceptación

Sirve para revisar el informe propio y para exigirle lo mismo a otro dev. Un informe **de
orientación** se acepta si un lector ajeno, con solo el documento en la mano, puede responder:

- [ ] Qué es esto y qué problema resuelve.
- [ ] Por qué existe y para quién es (roles y perfiles con nombre).
- [ ] Qué actores y sistemas entran en juego, y qué hace cada uno.
- [ ] En qué orden ocurren las cosas de punta a punta, y qué dispara cada paso.
- [ ] Qué piezas de software lo sustentan, y **por dónde entrar a cada una**.
- [ ] Qué objetos de base de datos lo soportan y para qué sirve cada grupo.
- [ ] **Si le dicen "cambia este botón" o "arregla este caso": a qué repo, a qué archivo y a qué
      procedimiento ir.** Es la prueba de fuego; si esta falla, las otras no salvan el documento.
- [ ] **Cómo levantar el sistema y verlo funcionando**, con los datos de prueba y su script.
- [ ] Qué este informe NO cubre.

Y si un dev del proyecto lo lee, no encuentra ni una afirmación falsa.

**Dos que se revisan al revés** — si la respuesta es sí, el informe de orientación está mal:

- [ ] ¿Tiene tabla de avance, lista de pendientes, deuda o tareas?
- [ ] ¿Promete algún documento, anexo o entrega que no existe, o afirma que algo "está escalado" sin
      que se haya comprobado en el tracker?

Si la Fase 0 pidió **diagnóstico**, entonces sí se añaden: qué está hecho, qué está probado y dónde,
qué no; y qué quedó por definir y quién tiene que definirlo.

## 3. Autoauditoría (Fase 5)

Antes de lanzar al verificador, responde por escrito como auditor hostil:

1. ¿Hay algún sustantivo propio (sistema, tabla, SP, actor, estado, norma) que **no** puedas
   anclar a evidencia? Bórralo o muévelo a vacíos.
2. ¿Queda alguna huella del informe anterior que este proyecto no tiene? Bórrala.
3. ¿Algún "Implementado" que en realidad no se probó, o se probó con datos falsos? Corrige el
   estado y dilo.
4. ¿Los conteos cuadran con el inventario? Recuenta. Y de cada conteo: **¿está dicha la unidad?**
   "21 nombres" que en realidad son 21 entradas agrupando 35 identificadores hace que quien estime
   esfuerzo se equivoque por el doble. Si la unidad es frágil y el número no le sirve al lector,
   **quita el número**, no lo expliques.
5. Lee solo la portada y la sección 1: ¿alguien ajeno entiende qué es esto y para qué sirve?
6. ¿El informe dice explícitamente qué NO cubre?
7. **La pasada de la regla 5:** recorre el documento buscando lo que tiene forma de tarea —avance,
   pendientes, deuda, hallazgos de calidad, "por confirmar", "está escalado"— y aplica la raya:
   ¿cambia lo que el lector va a hacer, o solo califica el proyecto? Lo segundo sale del informe y va
   al bloque de la Fase 6.
8. **¿Prometí algún anexo, documento o entrega que no existe?** Si sí: o lo escribo, o borro la
   promesa. No hay tercera opción.

## 4. Lo aprendido al verificar

Tres cosas que se aprendieron corriéndolo de verdad:

- **Reparte la verificación por rangos de sección** (uno hace 1-8, otro 9-15) con verificadores
  distintos, y dile a cada uno qué rango cubre el otro. Una segunda tanda así encontró 8 ERROR que la
  primera no podía ver.
- **Mientras un verificador lee el informe, no edites el informe.** Reúne la evidencia de las
  correcciones y aplícalas de una pasada cuando entregue.
- **Re-verifica sus ERROR antes de reescribir.** Los que no compruebes se convierten en errores
  propios con firma ajena. Y no te fíes de los parciales: **un parcial no es evidencia, la evidencia
  es el código** — ya pasó que dos parciales coincidieran en un error por haber leído el mismo script
  superado, y el informe declaró "no iniciado" un frente resuelto dos semanas antes porque un parcial
  dijo "nadie llena esa lista" y existía el método que la llenaba.
