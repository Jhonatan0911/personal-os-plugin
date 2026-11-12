# Cómo se escribe

La prueba de fuego: **alguien que no sabe qué es el sistema lee la sección y entiende.** Si para
entender una frase hay que saber ya la respuesta, la frase está mal escrita.

---

## Reglas de redacción

1. **Presente, voz activa, sujeto explícito.** "El facturador registra la factura", no "las
   facturas son registradas".
2. **Frases cortas.** Una idea por frase. Si tiene tres comas y un "el cual", pártela.
3. **Explica al usar, no al final.** El término del dominio se explica en la misma frase la primera
   vez: "el CUCON (Código Único de Contrato)". Nunca un glosario al final que nadie lee.
4. **Qué hace, no con qué está hecho.** En las secciones de negocio no aparecen tecnologías. Los
   nombres técnicos viven en las secciones técnicas, y ahí sí completos y exactos.
5. **Cero adjetivos de venta.** Prohibidos: robusto, escalable, potente, moderno, eficiente,
   completo, de clase mundial, best practice. Si algo es bueno, se demuestra con un hecho.
6. **Números contados.** "11 procedimientos almacenados", "8 catálogos", "4 formatos". Contarlos es
   parte del trabajo. Si no los contaste, no pongas número.
7. **Nombres literales del sistema en `código`.** Tablas, SP, endpoints, columnas y estados se
   escriben tal como están, sin traducir ni corregir. Si el nombre real tiene una errata, así va —
   y si la errata importa, se dice.
8. **Sin condicional ni futuro.** "Permitiría", "se podría", "va a permitir" son señales de que
   estás describiendo algo que no existe. Si no existe, va a "lo abierto".
9. **Las negaciones importan tanto como las afirmaciones.** "No hay reintento automático", "el
   consecutivo no lo elige el usuario", "esto no cubre X". Eso es lo que evita malentendidos.
10. **Sin metáforas ni analogías de manual.** No hay "orquestas", ni "corazones del sistema", ni
    "el cerebro de la operación".

## Cómo se explica una decisión

Cuando el informe cuenta una decisión técnica que alguien puede cuestionar, va con su razón en la
misma línea, y en términos de consecuencia, no de gusto:

> Los cuatro turnos de la misma hora se muestran por separado y no agrupados: mostrarlos como uno
> haría creer que queda un solo espacio cuando quedan cuatro.

Eso es utilizable en una reunión. "Se optó por no agrupar por claridad" no lo es.

## Cómo se dice que algo no está listo

Directo, con el hecho y su consecuencia:

- **Bien**: "El módulo está desarrollado y probado en test, pero aún no se ha desplegado; hasta que
  se despliegue, el usuario no lo ve."
- **Bien**: "La firma se probó de punta a punta con un documento sustituto: la mecánica quedó
  validada, el contenido del documento no."
- **Mal**: "Se encuentra en proceso de estabilización final."

## Estados permitidos

Usa siempre estos, y nada más:

| Estado | Significa |
|---|---|
| Implementado | Escrito, publicado y probado. Se dice dónde y con qué caso |
| Implementado sin desplegar | Escrito y probado, pero el usuario todavía no lo ve |
| Parcial | Funciona una parte; se dice cuál y cuál no |
| En definición | Falta un acuerdo de negocio, no código |
| No iniciado | No hay nada |

Nunca "en progreso", "casi listo", "en curso", "pendiente de QA final": no dicen nada verificable.

## Lo que no va nunca en el informe

- Credenciales, cadenas de conexión, tokens, rutas de red internas con usuario.
- Datos de pacientes o personas reales. Los casos de prueba solo con identificadores de test.
- Nombres de personas asociados a errores. Los hechos no necesitan culpables.
- Rutas `archivo:línea`: son para el borrador y la verificación, no para el lector.
- Especulación sobre plazos que nadie comprometió.
