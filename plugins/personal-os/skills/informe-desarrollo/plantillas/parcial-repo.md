# Parcial — {{REPO}} · {{CAPA: front | API | BD | transversal}}

> Levantado por subagente el {{FECHA}}. Alcance de este parcial: {{qué cubre}}.
> **No cubre** (es de otro parcial): {{qué queda fuera}}.
> Rama leída: {{rama}} · commit: {{hash corto}}

<!--
  ESQUELETO OBLIGATORIO. No cambies los encabezados ni el orden: el orquestador une los
  parciales leyendo la MISMA seccion en todos. Una seccion sin evidencia se deja con la
  linea "Sin evidencia." y no se borra.
  Cada afirmacion lleva su origen entre parentesis: (ruta/archivo.ts:120)
-->

## 1. Qué es este repo en una frase

{{Qué hace, para quién, en lenguaje de negocio. Sin tecnologías.}}

## 2. Stack y forma

- Framework y versión: {{}} ({{archivo:línea}})
- Cómo se ejecuta / puerto: {{}} ({{archivo:línea}})
- Patrón interno real: {{controlador → servicio → datos, o lo que sea de verdad}} ({{archivo}})
- Convenciones propias que un dev nuevo debe respetar: {{envoltorio de respuesta, idioma, reglas de
  lint, ortografías intencionales que son contrato}} ({{archivo:línea}})

## 3. Qué expone o qué consume

Endpoints, pantallas, comandos o eventos. Uno por fila, con su origen.

| Nombre real | Qué hace | Origen |
|---|---|---|
| {{}} | {{}} | {{archivo:línea}} |

## 4. Flujo: los pasos que este repo aporta

Solo los pasos que ocurren aquí, numerados, y con quién los dispara y a quién llama después.

1. {{paso}} — dispara: {{actor}} → llama a: {{siguiente pieza}} ({{archivo:línea}})

## 5. Objetos de base de datos que toca

| Objeto | Tipo | Para qué | Origen |
|---|---|---|---|
| {{Nombre_Real}} | SP / tabla / vista / trigger / función / tipo tabla / job | {{}} | {{archivo:línea}} |

Si no toca BD: `Sin evidencia.`

## 6. Actores, perfiles y permisos

Quién opera esto, con los nombres reales del sistema (roles, perfiles, usuarios técnicos).
({{archivo:línea}} por cada uno.)

## 7. Estados que maneja

Valores discretos reales y qué acción mueve de uno a otro. ({{archivo:línea}})

## 8. Estado real de lo construido

| Componente | Estado | Dónde se probó / evidencia |
|---|---|---|

Estados permitidos: Implementado · Implementado sin desplegar · Parcial · En definición · No iniciado.
Un "Implementado" sin evidencia de prueba **no es** Implementado.

*(Esta sección solo se usa si el informe es de **diagnóstico**. En uno de orientación se llena
igual —cuesta poco y sirve para el tracker— pero no llega al documento.)*

## 9. Cómo verlo funcionando

Cómo se levanta, con qué usuario/dato de prueba (solo identificadores de TEST), qué debería verse.
**El puerto declarado y en qué archivo está declarado**, las colisiones con otros repos, y qué otros
servicios hay que tener arriba **a la vez**. Si hay un script que siembra el dato de prueba,
**nómbralo**: un caso de referencia sin el script no es reproducible.

Si el repo **no compila desde un clon limpio** (referencias a librerías fuera del repo, rutas
absolutas de otra máquina), dilo aquí: es lo primero que bloquea a quien llega.

## 10. Trampas de operación — lo que cambia lo que alguien VA A HACER

Comportamientos no obvios que hacen tropezar a quien llega: una respuesta que dice éxito y no lo es,
una etiqueta de estado que significa cosas distintas según la tabla, ortografías que son contrato y
no se tocan, un script cuya reversión deshace trabajo ajeno, un filtro que hace desaparecer el dato de
prueba. Con su origen.

**Esto sí va al informe**, porque son instrucciones de operación.

## 10b. Hallazgos del proyecto — lo que solo CALIFICA el código

Defectos, riesgos de exposición de datos, deuda, suciedad del repositorio: `catch` vacíos, secretos
versionados, compilados en el repo, código muerto, documentos desactualizados, ausencia de pruebas.

**Esto NO va al informe de orientación**: se entrega aparte como insumo del tracker. Sepáralo aquí y
el orquestador no tendrá que releerte para distinguirlo.

⚠️ **Sin valores.** La ubicación y el hecho, nunca la credencial, el token ni el dato de una persona.

## 11. Huecos — lo que NO pude comprobar

Lista explícita. Esto **no se rellena con lo probable**; se declara.

- {{qué falta}} — {{por qué no se pudo: sin acceso, sin evidencia, requiere consulta a BD, requiere
  decisión de negocio}}

## 12. Acuse para el orquestador

<!-- Esto es lo unico que el subagente devuelve por el canal del agente: 15 lineas maximo. -->

- Archivo: `{{ruta del parcial}}`
- Rama y commit leídos: `{{rama}}` @ `{{hash corto}}` ({{fecha}})
- Conteos: {{N endpoints · N pantallas · N SP · N tablas · N estados}}
- Por dónde se entra a este repo: {{el archivo que hay que abrir primero}}
- Puerto y cómo se levanta: {{}}
- 3 **trampas de operación** que más importan (sección 10): {{}}
- 3 **hallazgos del proyecto** que más importan (sección 10b): {{}}
- Huecos: {{}}
- Contradicciones con la documentación existente del proyecto: {{}}
