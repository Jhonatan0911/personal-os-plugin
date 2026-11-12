---
name: informe-desarrollo
description: Produce el informe general de un desarrollo, módulo, proceso o sistema ya construido, entendible por quien no sabe nada del tema y verificable línea por línea por un dev — qué es, para quién, actores, repos y por dónde entrar a cada uno, objetos de base de datos, flujo de punta a punta y cómo levantarlo. Por defecto es de orientación (sin avance, pendientes ni deuda); el diagnóstico, solo si lo piden. Úsala cuando digan "informe del desarrollo", "informe de flujo y procesos", "documenta este módulo para presentarlo", "arma el informe de este sistema", "informe gerencial" o pidan algo "como el informe de otro proyecto". No es para el estado del equipo (status-celula), ni para planear un requerimiento (planear-sprint), ni para un manual de usuario.
argument-hint: "[módulo o sistema] [orientación|diagnóstico]"
---

# Informe general de un desarrollo

**Qué es esto:** el documento de referencia de un desarrollo ya construido. No es un informe de
gerencia, ni un manual de usuario, ni una propuesta: es la foto verificable de qué se hizo, para
quién y cómo funciona de punta a punta. **Quién lo va a leer y para qué sirve se preguntan en la
Fase 0**, y eso mueve la profundidad de cada sección — nunca la evidencia ni la honestidad del
documento.

## Hay dos informes distintos, y confundirlos arruina el documento

| | **Orientación** (por defecto) | **Diagnóstico** (solo si lo piden) |
|---|---|---|
| Para qué sirve | Que alguien entienda el proyecto y sepa **dónde tocar**: *"cambia este botón" → ya sabe a qué archivo ir* | Que alguien **decida**: priorizar, asignar, aprobar salida a producción |
| Quién lo lee | Un dev que entra, otro equipo que recibe, un funcional nuevo | Gerencia, el líder que planifica, el cliente que certifica |
| Qué lleva | Qué resuelve · actores · repos con por dónde entrar · flujo · arquitectura · objetos de BD · ciclos de vida · contratos · cómo levantarlo | Todo lo de orientación **más** estado de avance, puntos abiertos y deuda |
| Qué **no** lleva | **Estado de avance, lista de pendientes, deuda técnica, tareas, escalamientos** | — |

**Por defecto se produce el de orientación.** Es el que piden nueve de cada diez veces cuando dicen
"documenta este módulo", y es el que envejece bien: el estado cambia cada semana, la arquitectura no.

> **Por qué:** cuando el núcleo exigía estado y pendientes, la primera corrida real salió con 31
> páginas, tres de diagnóstico y deuda, y el usuario la devolvió: *"que quien lo lea sepa cómo está
> armado el proyecto y, si le digo modifica este botón, ya sepa; no tiene deuda, ni pendientes, ni
> tareas"*. El estado y los pendientes **se llevan en el tracker** (Jira), donde tienen dueño y fecha;
> un informe no es un tablero.

## Configuración

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. De
`<stateDir>/config/fuentes.yaml` se lee, si existe, la sección opcional `informe_desarrollo`:

- `referencias`: informes anteriores que sirven de **referencia de forma**
  (`[{ nombre, ruta }]`). Cuando pidan "como el de <nombre>", se abre esa ruta. Sin la clave, se
  pregunta una vez en el modal y se guarda.

La política de base de datos (solo test, solo lectura, wrapper del proyecto, OK explícito por
consulta) es la del `CLAUDE.md` del usuario y del proyecto; esta skill no la relaja.

Tiene **dos lectores a la vez** y debe servirle a los dos:

- **El que no sabe nada** (un funcional nuevo, un cliente, un gerente): entiende qué resuelve, quién
  hace qué y en qué va, sin abrir código ni preguntar nada.
- **El que sabe todo** (un dev, un líder técnico): no encuentra ni una frase que no pueda
  comprobar en el repo o en la base de datos.

Si la versión que produces le sirve solo a uno de los dos, está mal hecha.

---

## Las cinco reglas duras

Estas reglas mandan sobre cualquier otra cosa en este archivo. Si alguna se rompe, el informe no
se entrega.

### 1. Evidencia o no existe

**Cada afirmación del informe apunta a algo real que leíste.** Un nombre de tabla, de SP, de
endpoint, de perfil, de sistema externo o de estado solo entra si lo viste en el código, en un
script SQL del repo, en un documento del proyecto o en una consulta autorizada a la BD de test.

- Mientras redactas, cada dato viaja con su origen (`archivo:línea`, ruta del script, nombre del
  doc). El origen **no sale** en el informe final, pero queda en el borrador y en la verificación.
- Si crees que algo existe pero no lo encontraste: **no es un dato, es una pregunta.** Va a la
  lista de vacíos, no al cuerpo del informe.

### 2. Prohibido arrastrar el ejemplo

Los informes anteriores (`informe_desarrollo.referencias`) son **referencia de forma, nunca de
contenido**.

Concretamente, está prohibido: nombrar un proveedor externo, una integración, una normativa, un
protocolo, un estado o un actor **porque el informe anterior lo tenía**. Un informe de facturación
electrónica trae ente tributario, SOAP, códigos únicos de factura, resoluciones y un tercero que
firma; casi ningún otro desarrollo tiene nada de eso. Un módulo interno de agendamiento no tiene
"integraciones con terceros" solo porque llama a otra API del mismo producto.

**Antes de nombrar un actor o sistema externo, di dónde lo viste.** Si la respuesta es "así era en
el otro informe", bórralo.

### 3. Las secciones se ganan su lugar

Este documento **no es una plantilla de relleno**. Hay un núcleo obligatorio (6 secciones) y un
catálogo de secciones condicionales; cada condicional entra **solo si su evidencia aparece**. Un
informe honesto de 7 páginas vale más que uno de 20 con tres secciones inventadas para cuadrar la
estructura.

Ver `referencias/dimensiones.md`: cada sección trae su **gatillo** (qué evidencia la habilita) y
su **prohibido si**.

### 4. Lo que no está definido se declara, no se rellena

Lo incompleto es información valiosa para quien decide y hay que **mostrarlo como incompleto**:
"Por definir", "En definición", "No se probó". Nunca se completa con lo razonable, lo probable o
lo que suele hacerse. Si hay un módulo hermano a medio hacer, va en un anexo separado con su
propio estado y con una línea que diga por qué se incluye.

*(En un informe de orientación esta regla se aplica a lo que **no se pudo levantar** —"esta capa no se
leyó", "el nombre de la base no está en el código"—, no al avance del proyecto.)*

### 5. El informe orienta; el diagnóstico vive en el tracker

**En un informe de orientación no entra nada que tenga la forma de una tarea.** Ni tabla de avance,
ni lista de pendientes, ni deuda técnica, ni hallazgos de calidad, ni escalamientos, ni "por
confirmar con el equipo". Si el levantamiento produce ese material —y lo va a producir—, se entrega
**aparte**, en la Fase 6, como insumo para el tracker. No se cuela en el documento.

La raya, que es la única parte con criterio y no mecánica: **¿cambia lo que el lector va a hacer, o
solo califica el proyecto?**

| Se queda (es instrucción de operación) | Sale (es diagnóstico) |
|---|---|
| Un `200 OK` de esta fachada puede esconder un rechazo del tercero | 29 bloques `catch` vacíos en un repo |
| `PEN` significa tres cosas distintas según la tabla | 192 pruebas en 14 repos |
| Estos nombres tienen errata y son contrato: no se tocan | Ocho documentos del proyecto desactualizados |
| El rollback equivocado deshace trabajo ajeno y la guarda no lo impide | Compilados versionados en cuatro repos |
| La cita de prueba desaparece del worklist al día siguiente | El módulo X está "implementado sin desplegar" |
| Un checkout limpio de este repo conecta contra producción | 1.629 líneas de código muerto |

Y dos prohibiciones que salieron de un error real:

- **No prometas un documento que no existe.** Nada de "esto se entrega en un escalamiento aparte" si
  ese anexo no está escrito y acordado. Un informe que promete un entregable inexistente es peor que
  uno que calla.
- **No escribas "está escalado", "está en seguimiento" o "ya tiene ticket" sin comprobarlo.** Se
  verifica en el tracker, por nombre de issue, antes de afirmarlo. Ya pasó que un informe afirmara
  cuatro frentes escalados y **ninguno tuviera ticket**: las 41 issues del frente eran de otra cosa. Decir "alguien se está ocupando" cuando nadie se ocupa es el peor error posible en un
  documento de arranque.

---

## El proceso: 7 fases, multi-agente

**Este informe no lo escribe un solo agente.** Tú actúas como **jefe de documentación**: repartes el
levantamiento entre subagentes (1 a 3 por repo, según lo que aporte), recibes de cada uno un `.md`
parcial **en disco** — no en tu contexto —, los unes con un propósito, y al final sometes el
resultado a un **dev sin contexto** que trata de romperlo. Un desarrollo de 12 repos no cabe en una
ventana; el agente que lo intenta acaba resumiendo de memoria, que es como se inventan las cosas.

La mecánica completa del reparto, los encargos y la verificación está en
`referencias/orquestacion.md`. Sigue el orden de las fases. Las fases 0, 1b y 2 tienen **puerta de
aprobación del usuario**: no las cruces solo.

### Fase 0 — Encuadre (con el usuario, antes de leer código)

Sin esto sale un informe genérico. Pregunta lo que no puedas deducir (usa `AskUserQuestion`
cuando haya opciones claras):

| Qué | Por qué importa |
|---|---|
| **Orientación o diagnóstico** | **La primera y la que más cambia el documento.** Ver la tabla de arriba. Si no lo dicen, es **orientación**: dilo en voz alta —"lo hago de orientación, sin estado ni pendientes; el avance va en Jira"— y sigue. Solo se hace diagnóstico si lo piden con esas palabras o si el destinatario es gerencia decidiendo |
| **Quién lo pidió** (nombre y rol) | Define el nivel de detalle y qué da por sabido |
| **A quién va dirigido** | Un gerente comercial y un líder técnico no leen lo mismo |
| **Alcance exacto** | Qué subsistema/módulo/flujo. En una mesa multi-repo esto es *obligatorio*: "todo el proyecto" no es un alcance |
| **Qué NO entra** | Se escribe en el informe. Evita que el lector asuma cobertura que no hay |
| **Formato de salida** | HTML + PDF (por defecto), y si además quiere PPTX |

Registra las respuestas: van literales en la portada (`Preparado por`, `Dirigido a`, `Solicitado
por`, `Alcance`, `Fecha`, `Versión`). **Si "quién lo pidió" no se sabe, la fila no se pone con
"pendiente de confirmar": se omite.** Andamiaje del autor en la portada de un entregable es ruido, y
un lector nuevo no debe enterarse ahí de que nadie sabe quién pidió el desarrollo.

**La pregunta de control, antes de cruzar esta fase:** *si el lector viene y le digo "cambia este
botón" o "arregla este caso", ¿el documento le dice a qué repo, a qué archivo y a qué procedimiento
ir?* Todo lo que no sirva a esa pregunta es candidato a salir.

### Fase 1a — Primera pasada (tú, barata)

**Primero sincroniza: `fetch` de todos los repos antes de repartir.** Un informe levantado sobre un
árbol atrasado nace desactualizado, y lo que otro subió es justo lo que nadie documentó todavía. Mira
los commits entrantes antes de decidir: dicen qué se movió y qué documento del proyecto quedó
mintiendo. **Actualizar la rama es decisión del usuario, no tuya**, y si el árbol tiene configuración
local modificada, respáldala antes de mover nada.

Después, y sin quemar contexto: stack y rama viva de cada
repo (`package.json`, `.csproj`), los documentos que el proyecto ya tiene (`HANDOFF.md`, `docs/`,
`CONTRATOS/`, `README`), los scripts de BD, y un `git log --oneline -15` por repo para ver cuáles
están vivos. Detalle en `referencias/descubrimiento.md`.

Esta pasada es la que evita mandar tres agentes a un repo que solo aporta una librería.

### Fase 1b — El reparto (puerta de aprobación)

Asigna **1 a 3 levantadores por repo** — 1 si es periférico, 2 si separa front y back, 3 si además
tiene objetos de BD propios — más los **transversales**, que no pertenecen a ningún repo y son los
que más se olvidan:

- **Base de datos global** (scripts de publicación/rollback, inventario por función).
- **Contratos entre repos**.
- **Vigencia** (git log, `HANDOFF.md`, documentos del proyecto): produce el **mapa repo → commit y
  fecha**, y la lista de **qué documentos del proyecto están mintiendo**. Las dos cosas son de
  orientación pura: sin el mapa nadie sabe si una afirmación quedó vieja, y sin la segunda un dev
  nuevo cree lo que dice un `HANDOFF` de hace tres meses.
- **Estado e historia** — **solo si la Fase 0 pidió diagnóstico.** Produce la tabla de estado real y
  la lista de lo abierto. En un informe de orientación **este agente no se lanza**: su salida no
  tiene dónde ir, y lanzarlo es lo que empuja el documento hacia la auditoría.
- **Integraciones externas**, solo si la primera pasada encontró un tercero de verdad.

Dile al usuario **cuántos agentes vas a lanzar y en qué tandas** antes de empezar. Tabla de reparto
y criterios en `referencias/orquestacion.md`.

### Fase 1c — Fan-out

Lanza los levantadores en tandas (6 a 8 en paralelo), con el encargo cerrado de
`plantillas/encargo-subagente.md`. Cada uno escribe su parcial siguiendo **exactamente**
`plantillas/parcial-repo.md` — mismos encabezados, mismo orden — y devuelve solo un **acuse de 15
líneas**. El contenido vive en el archivo, no en tu ventana.

Si un levantador vuelve vacío o muere: relánzalo con alcance más estrecho. Si vuelve a fallar,
**declara ese repo como no documentado**; no rellenes su parte.

**Base de datos**: los levantadores no consultan la BD; escriben la consulta que haría falta como
hueco. Si hay que ejecutarla es **solo TEST, solo lectura, por el wrapper del proyecto y con OK
explícito del usuario para cada consulta**, como manda su política de base de datos.

### Fase 2 — Plan de secciones (puerta de aprobación)

Antes de escribir una sola línea de informe, entrega al usuario una tabla corta:

| Sección | ¿Entra? | Evidencia que la habilita |
|---|---|---|
| Actores y perfiles | Sí | 4 roles en `Seg_Perfil`, 2 sistemas |
| Integraciones con terceros | **No** | No hay cliente HTTP a host externo; todo es intra-producto |
| Objetos de BD | Sí | 11 SP + 6 tablas + 1 trigger |
| Normativa | **No** | Ninguna resolución referenciada en código ni en el requerimiento |
| Módulo hermano (anexo) | Sí, como "en definición" | Existe la carpeta, sin pantallas |

Esta tabla es el antídoto contra el arrastre: obliga a justificar cada sección **y a declarar las
que se omiten**, en vez de copiar el índice del informe anterior. Espera el OK antes de seguir.

### Fase 3 — Síntesis: contenido antes que forma

Ahora sí lees los parciales, y **por sección transversal, no por repo**: abres el bloque "Objetos de
BD" de todos y compones el inventario global; luego el bloque "Flujo"; y así. El esqueleto común es
lo que hace esto mecánico. Tu trabajo real aquí es resolver contradicciones entre parciales (dos
versiones distintas es información: ve al código y decide, o llévalas a "lo abierto"), deduplicar lo
que documentaron dos agentes, unificar el vocabulario, y **recontar los números tú mismo** sobre el
inventario unido — no copiarlos de un acuse.

Redacta el borrador en Markdown (`informe-<tema>.borrador.md`), con el origen de cada dato al
lado. Reglas de redacción en `referencias/lenguaje.md`. Lo esencial:

- Frases cortas, voz activa, presente. Se explica **qué hace**, no qué tecnología usa.
- Cero adjetivos de venta: nada de robusto, escalable, potente, moderno, de clase mundial.
- El primer párrafo de cada sección se entiende sin leer la anterior.
- Los términos del dominio se explican la primera vez, en la misma frase, sin nota al pie.
- Los números son exactos y contados, no estimados: "11 procedimientos", no "varios".

### Fase 4 — Maquetación

Pasa el borrador aprobado a un HTML autocontenido de una sola pieza (imprimible a PDF) usando
`plantillas/base.html`. Tokens, componentes y diagramas en `referencias/maquetacion.md`. Los
diagramas son **SVG escrito a mano**, no imágenes, y solo existen si hay algo real que dibujar:

- **Carriles (swimlanes)**: solo con 3+ actores y un orden temporal claro.
- **Capas**: solo con 2+ capas reales de código.
- **Estados**: solo si hay una columna de estado con valores discretos y transiciones reales.

Un diagrama que repite lo que dice la tabla de al lado sobra. Bórralo.

### Fase 5 — Verificación por un dev sin contexto (obligatoria)

Primero **autoauditas** el informe terminado como auditor hostil, con las 8 preguntas de
`referencias/nucleo-y-rubrica.md` §3, y respondes por escrito. Lo que tiene forma de tarea sale del
informe y va al bloque de la Fase 6; lo que se prometió y no existe, o se escribe o se borra.

**Y después lanza el verificador**: uno o varios subagentes con **contexto limpio, que no
participaron en la redacción**, con el encargo de `plantillas/verificacion.md`. Su perfil es
deliberado: un dev competente de nivel medio que entra al proyecto la semana que viene y no sabe
nada. Lee el informe primero sin abrir código, intenta seguir el flujo solo con el documento, y
después comprueba en el código lo concreto — que ese SP exista, que ese endpoint exista, que los
conteos cuadren.

**En el encargo va escrito el propósito del informe.** Si es de orientación, dilo con estas palabras:
*"este informe no lleva estado de avance, pendientes ni deuda; no los pidas como hueco"*. Un
verificador al que no se le dice esto pide un diagnóstico —es lo natural cuando se pregunta "¿te
sirve?"— y el orquestador que lo obedece convierte el informe en auditoría. **Así se desvió la primera corrida real.**

Devuelve observaciones clasificadas: `ERROR` (el código contradice al informe, con evidencia),
`HUECO`, `CONFUSO`, `SOBRA` y `PREGUNTA` — **y aparte, en su propio bloque, los hallazgos sobre el
proyecto** (defectos, riesgos, calidad) que **no** son material del informe. Ese bloque no se aplica:
se entrega al usuario en la Fase 6 para el tracker.

Reparte la verificación por rangos de sección, no edites el informe mientras un verificador lo lee y
re-verifica cada ERROR contra el código antes de reescribir (un parcial no es evidencia): detalle en
`referencias/nucleo-y-rubrica.md` §4.

**Tú corriges.** Los ERROR siempre; los HUECO se completan o se declaran como vacíos; los CONFUSO se
reescriben. Lo que descartes, **respóndelo por escrito con el motivo**: un ERROR descartado en
silencio es una corrección que te vas a comer en la reunión. Máximo **2 rondas**, y la segunda revisa
solo lo corregido. Las `PREGUNTA` no se contestan desde el informe: van al usuario en el cierre.

**Al corregir, no dejes rastro del proceso en el documento.** Nada de "la versión anterior de este
informe decía", "esto lo corrigió la verificación" ni "el dato accionable que faltaba". El lector no
tiene por qué enterarse de cómo se hizo la salchicha: se escribe el hecho derecho.

### Fase 6 — Entrega

Entrega el HTML, el PDF (y el PPTX si se pidió), el resumen de verificación con lo corregido y lo
descartado, y las preguntas del verificador que siguen abiertas. Si recortaste el barrido — repos que
no se leyeron, capas sin cubrir — **dilo**: un informe que calla lo que no miró se lee como si lo
hubiera cubierto todo. Los vacíos son el insumo de la siguiente conversación, no un defecto.

**Y entrega aparte, en un archivo propio, lo que la regla 5 sacó del informe:** los defectos, riesgos
de exposición, deuda y hallazgos de calidad que el levantamiento encontró. Se presenta como **insumo
para el tracker, no como documento terminado**, y se le dice al usuario en una línea qué contiene y
por qué no está en el informe. Ese material cuesta caro de levantar y tirarlo sería absurdo; meterlo
en el informe, también.

Antes de proponer un documento nuevo con ese material —un escalamiento, un plan de remediación—
**mira si ya existe en el tracker**. Ya pasó que el usuario tuviera 20 hallazgos cargados en Jira con
estado y comentarios: proponerle un documento paralelo habría abierto una segunda vía de seguimiento
para lo mismo. Se comprueba por nombre de issue, no de memoria.

---

---

## Núcleo obligatorio y rúbrica

El núcleo de 6 secciones de un informe de orientación (portada, qué resuelve, actores, mapa de las
piezas con **por dónde entrar**, flujo de punta a punta, cómo verlo funcionando), lo que se añade solo
en un diagnóstico y la rúbrica de aceptación están en `referencias/nucleo-y-rubrica.md`. Léelo en la
Fase 2 y en la Fase 5: la prueba de fuego es que, si al lector le dicen *«cambia este botón»*, el
informe le diga a qué repo, archivo y procedimiento ir.

## Cuándo NO usarla

- Estado del equipo o avance de un sprint → `status-celula`.
- Planear o estimar un requerimiento → `planear-sprint`.
- Revisar un PR o certificar un requerimiento → `revisar-pr` · `certificar-funcional`.
- Manual de usuario final o propuesta comercial: no es este documento.

## Archivos

| Archivo | Cuándo leerlo |
|---|---|
| `referencias/nucleo-y-rubrica.md` | Fase 2 y Fase 5: secciones obligatorias, rúbrica, autoauditoría y lo aprendido al verificar |
| `referencias/descubrimiento.md` | Fase 1a: primera pasada barata |
| `referencias/orquestacion.md` | Fases 1b, 1c y 5: reparto, encargos y verificación |
| `referencias/dimensiones.md` | Fase 2: gatillo de cada sección condicional |
| `referencias/lenguaje.md` | Fase 3: reglas de redacción |
| `referencias/maquetacion.md` | Fase 4: tokens, componentes, diagramas y PDF |
| `plantillas/encargo-subagente.md` · `parcial-repo.md` · `verificacion.md` | Fases 1c y 5: encargos cerrados |
| `plantillas/base.html` | Fase 4: esqueleto del HTML |
