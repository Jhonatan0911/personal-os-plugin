# Especificación del requerimiento (pasos 1 a 3)

Léelo al llenar la ficha de impacto (Fase 1-bis) y al descomponer (Fase 2). Base documental:
`planeacion.investigacion` si existe (SEI, ADR de Nygard, Kiro/Spec Kit, Google eng-practices).

## Índice
1. Ficha de impacto
2. Escenarios de calidad y ADR
3. Subtarea-instrucción
4. Cortes de seguimiento

## 1. Ficha de impacto (paso 1)

**Cabecera** (`cabecera`): se llena con lo que dicen la historia, el correo o el acta, con fuente. Lo que no
esté se deja vacío y se pregunta; no se deduce. `expectativas` es lo que el cliente espera ver (alta =
lo prometió alguien con fecha). `pedido_por_gerencia` solo si hay evidencia escrita.

**Criticidad** (`impacto.criticidad_modulo`): por cada módulo de `modulos`, copia los cinco ejes (1-5) de
`<stateDir>/criticidad/modulos.json` y guarda el **máximo por eje** entre los módulos tocados. Si el mapa
no existe o el módulo no está, deja 0 y escribe en `peso_operacion` «sin mapa de criticidad para <módulo>»:
nunca inventes la calificación. Si el módulo no está validado por el líder, dilo igual.

**Peso en la operación** (`peso_operacion`): una o dos líneas de qué pasa en la operación si sale mal
(quién se frena, qué se deja de facturar, qué se reporta mal).

**Mini-AMFE** (`modos_falla`): solo si algún eje vale 4 o 5. De 3 a 5 modos, cada uno con su efecto y su
severidad (1-5). `a_regresion: true` si debe probarse en la regresión del paso 5.

**WSJF** (`prioridad_wsjf`, opcional): `(valor para el cliente + criticidad en el tiempo + reducción de
riesgo o norma) ÷ tamaño`, cada término en escala 1-10 y el tamaño en horas propuestas / 8. Propones el
número; el líder lo ajusta.

## 2. Escenarios de calidad y ADR (paso 2)

Escoge 2-3 escenarios por los ejes altos: transaccionalidad o usuarios altos → rendimiento; dinero o
norma altos → integridad y trazabilidad; reversibilidad baja → recuperación. Cada uno en seis partes
(fuente, estímulo, entorno, artefacto, respuesta, **medida**), guardado así:

```json
{"id": "QA-1", "atributo": "rendimiento",
 "escenario": "Un profesional abre el registro en hora pico (300 usuarios); la validación nueva corre en segundo plano y avisa si falla.",
 "medida": "p95 de apertura sin cambio (≤ +50 ms); la validación no bloquea la pantalla",
 "como_verificar": "Medición antes/después en pruebas con el mismo volumen; captura del tiempo en la consola de red"}
```

Sin medida no se puede revisar en el PR: «rápido» o «seguro» no son medidas.

**ADR** cuando la solución introduce algo síncrono en una ruta crítica, una tabla o columna nueva, una
integración o un cambio de contrato entre repos: `decision` (una frase), `contexto` (qué fuerzas la
empujan), `consecuencias` (lo que se gana y lo que se paga). Uno por decisión; el que reemplaza a otro
lo dice.

## 3. Subtarea-instrucción (paso 3)

Una subtarea es una **instrucción exacta**: el dev (o su asistente de IA) la ejecuta sin volver a
preguntar y el revisor del PR la usa como lista de chequeo. Va en `desc` del plan (markdown). Si el ítem
trae los campos sueltos `contexto`, `que_hacer`, `donde`, `no_tocar`, `criterios`, `entregables` y `corte`,
el generador compone `desc` con esta misma plantilla.

```markdown
**Contexto:** <por qué existe, en 1-2 líneas; historia padre y CA que atiende>.
**Qué hacer:**
1. <paso verificable>
2. …
**Dónde:** <repo y rama · archivo:línea · tabla, SP o endpoint · archivo del repo que sirve de patrón>.
**Qué NO tocar:** <lo que debe seguir igual: otros clientes, contratos, módulos vecinos>.
**Criterios de aceptación:**
- CA-1: CUANDO <disparador> EL SISTEMA DEBERÁ <respuesta>. Cómo verificar: <test con nombre, consulta o captura>.
**Entregables:** tests unitarios de cada CA · documentación de <qué> · script de BD de publicación y de
rollback, idempotentes (solo si toca BD).
**Corte:** <fecha y qué evidencia se revisa>.
**Si dudas, pregunta:** si <lo ambiguo> no está claro, detente y pregunta al líder; no inventes.
```

Reglas:
- Entre 150 y 250 palabras: es una subtarea, no una historia. El contexto de negocio vive en la historia.
- Los CA son los de la historia (`historias[].criterios`), con su mismo id: la subtarea los cita, no
  inventa otros. Si hace falta uno nuevo, se agrega primero a la historia.
- **Qué NO tocar** nunca va vacío en código legado o compartido entre clientes.
- Los escenarios `QA-n` que apliquen se citan en los criterios con su medida.
- Lo que el refutador dejó como alternativa aceptada se escribe como instrucción, no como opinión.

## 4. Cortes de seguimiento

Un corte es una fecha en la que el líder revisa **evidencia**, no avance declarado: rama empujada con la
clave de Jira, PR parcial a la rama de integración con tests verdes, o una captura del CA funcionando.

- Al menos uno por historia con lógica, y uno cada 2-3 días hábiles en sprints largos. Nunca solo al final.
- Cada corte nombra los CA que se revisan y cae en un día hábil, antes del fin de desarrollo.
- Se guardan en `cortes[]` con `estado: pendiente`. El resultado (`ok` o `desviado` con nota) lo escribe
  el seguimiento del líder; un corte desviado es un riesgo que se dice ese mismo día.
