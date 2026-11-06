---
name: planear-sprint
description: Planea un sprint o un requerimiento de punta a punta para un líder técnico — mapea con agentes el código actual de los repos que toca (ramas y remotos verificados), entiende las historias de usuario, la especificación, los mockups y las transcripciones, clasifica cada pedido (existe / existe con diferencia / existe en otro cliente o rama / nuevo / solo parametrización / contradice la historia), lo descompone en subtareas, las estima con la matriz de tiempos (devs que usan IA de copiloto, por nivel y familiaridad), pasa un revisor adversarial y entrega un cronograma interactivo para aceptar y exportar a Jira, más el borrador del correo de escalada de lo pendiente de definición. Úsala cuando el usuario diga "planeemos el sprint de X", "haz el planning de", "estima estas historias", "arma las subtareas de", "cuánto se demora este requerimiento" o pase una épica o historia para planear. NUNCA escribe en Jira por su cuenta.
---

# Skill: planear-sprint (v2.0.0) — de las historias al cronograma estimado

Planear un sprint a mano (leer historias, revisar el código, estimar, poner fechas, escribir subtareas)
le cuesta al líder medio día. Esta skill hace lo mismo con agentes de solo lectura y una matriz de tiempos
que se calibra con lo real. **La skill propone; el líder decide.**

**Dónde está cada cosa.** `<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`.
Las integraciones y la matriz están en `<stateDir>/config/fuentes.yaml`. Los archivos de esta skill
(plantillas, generador, ejemplos) viven en `<raíz del plugin>/skills/planear-sprint/`; la raíz del plugin
aparece en el contexto de la sesión en la línea **«Scripts del plugin:»** que inyecta el hook de arranque.

## Reglas que no se negocian

- **Nada se escribe en Jira** sin que el líder lo acepte en el cronograma y lo exporte él desde la página
  (o lo pida explícitamente en el chat, cambio por cambio). Leer Jira es libre; escribir, nunca por iniciativa propia.
- **Estimación = desarrollador que usa IA de copiloto**: es el autor principal (entiende qué va a hacer,
  escribe un buen prompt, revisa, ajusta a los patrones del proyecto y prueba). **Apretada y sin colchón**:
  ni «a mano» ni «la IA lo hace sola». La cifra final la pone el líder.
- **La fuente de cifras es la matriz de tiempos** (ver Fase 0). Nunca inventar una cifra que la matriz no
  tenga: si el tipo no existe o tiene `base: null`, se estima con criterio, se marca **«sin matriz»** y se
  reporta para que el líder la fije.
- **Lo que el cliente no aprobó** (nuevo, o con otra versión distinta a la historia) se estima pero queda
  **pendiente de definición**, sin fecha y con una observación de qué falta, de quién y desde cuándo.
- **Antes de llamar «nuevo» a algo**, se busca en otros clientes, otras ramas y el historial de git.
- **Antes de afirmar que una rama o un archivo no existe**, se hace `git fetch`/`git ls-remote` contra el
  **remoto correcto** (el del proyecto u organización donde vive el código de ese cliente, que puede no ser
  el habitual). Si no aparece: «no lo encontré en …», nunca «no existe».
- **Sin secretos**: nada de tokens, PAT ni cadenas de conexión en el plan, el expediente o el chat. Si un
  repo pide credenciales, el usuario las configura en su git; la skill no las pide ni las guarda.

## Fase 0 · Insumos (preguntar solo lo que falte)

Lee primero `<stateDir>/config/fuentes.yaml`:

| Sección | Para qué |
|---|---|
| `jira.sitio`, `jira.cloud_id`, `jira.proyectos` | Leer las historias y, más tarde, configurar la exportación de la página. Si falta `cloud_id`, sale de `getAccessibleAtlassianResources`; nunca adivinarlo. |
| `jira.tipo_subtarea`, `jira.campo_inicio` (opcionales) | Nombre exacto del tipo de subtarea en esa instancia (por defecto «Subtarea») e id del campo de fecha de inicio, si existe. Si no están, se consulta el metadato del proyecto en Jira (lectura) o se pregunta. |
| `equipo` | Responsables posibles: `nombre`, `rol`, `account_id` y, para estimar, `nivel` y `familiaridad` por frente. |
| `planeacion.matriz_tiempos`, `planeacion.niveles` | Tipos con `base`, `unidad_horas`, `rango`, factores por nivel y familiaridad, y `capacidad_diaria`. |

**Si `planeacion.matriz_tiempos` solo trae las referencias cortas** (o no tiene tipos con `base`), usa como
valores por defecto `<raíz del plugin>/skills/planear-sprint/matriz-tiempos-ejemplo.yaml` y **dilo** en el
resumen («estimado con la matriz por defecto del plugin»). Referencias base, configurables:
componente nuevo con lógica ≈ **1,5-3 h**; mostrar un dato ya calculado **≤ 1 h**; traslado o refactor de
código existente ≈ **−30 %** frente a la cifra a mano. Ofrece copiar la matriz a `fuentes.yaml` para que el
usuario la ajuste.

**Nivel y familiaridad por persona** son ejes distintos: un júnior que conoce todo el negocio puede rendir
más que un sénior nuevo. Si alguno falta para la persona y el frente del sprint, pregúntalo y, con el OK del
usuario, guárdalo en `equipo` de `fuentes.yaml` (o en su nota de `<stateDir>/personas/`) con fuente y fecha.
Solo hechos declarados; nunca deducir el nivel de nadie.

| Insumo | Cómo se obtiene |
|---|---|
| Historias | Claves de Jira o la épica (`parent = PROY-140`). Leer la descripción completa y los comentarios. |
| Responsable | Nombre → `equipo` (nivel + familiaridad con ese frente). |
| Ventana del sprint | Cronograma del proyecto (hoja, correo, acta): inicio, fin de desarrollo, QA, pruebas, holgura, alistamiento, entrega. |
| Repos y ramas | Por cada repo: URL del remoto correcto + rama vigente. Verificar con `git ls-remote`. Leer con `git show`/`git grep` sobre el ref; `checkout` solo si el árbol está limpio y el usuario lo autoriza. |
| Documentos | Especificación funcional o técnica, mockups (HTML, Figma, imágenes), tablas paramétricas, actas y, si existe, la **transcripción de la reunión de entrega**. |
| Correos | Si hay conector de correo (`m365.outlook: true`), buscar por la épica y el nombre del frente: bloqueos y respuestas del cliente (a veces ya resolvieron pendientes que las historias aún muestran abiertos). |

## Fase 1 · Entender (agentes en paralelo, todos de solo lectura)

Lanzar en **un solo mensaje**:

1. **Un mapeador por repo** (`subagent_type: Explore`, muy exhaustivo) con el requerimiento resumido y este
   encargo: «responde con evidencia archivo:línea: A) cómo funciona hoy el flujo que se va a tocar; B) dónde
   vive cada pieza que el requerimiento menciona; C) qué ya existe igual, parecido o nada; D) cómo se guarda
   y qué impacto tendría en modelo, API y BD; E) mecanismo de bandera o configuración por cliente; F) riesgos
   para estimar (duplicación, archivos gigantes, sin tests, dependencias)».
2. **Un buscador de reutilización** (Explore): lo mismo contra otros clientes, ramas e historial
   (`git log -G`, otros proyectos u organizaciones del mismo producto) para cada pieza que el mapeador marque
   como nueva.
3. **Lectura de documentos** (en el hilo principal o con un agente general): historias + especificación +
   mockups + transcripción + correos → lista de **piezas del requerimiento** con su criterio de aceptación
   y sus pendientes.

Resultado de la fase: tabla **pieza → clasificación**:
`existe igual` · `existe con diferencia` · `existe en otro cliente/rama` · `nuevo` ·
`solo parametrización/BD` · `contradice o no está en la historia` · `bloqueado por un tercero`.

Compara **estructura y lógica**, no la apariencia: algo que el mockup muestra resumido no es «diferente».

## Fase 1-bis · Expediente del requerimiento (el analista)

Con lo leído arma `expediente.json` con estas secciones: `resumen`, `historias` (key, titulo, resumen),
`decisiones` (texto, quien, fecha, fuente), `pendientes` (id, texto, a_quien, desde, estado
abierto/resuelto, resolucion, fuente), `riesgos`, `hallazgos_codigo` (archivo:línea), `cronograma`,
`fuentes` (id, tipo, titulo, fecha, ref) e `historial`.
**Cada afirmación lleva su fuente.** Lo que el cliente ya respondió va como decisión y su pendiente se marca
resuelto con la resolución (no lo dejes abierto porque la historia aún lo muestre así).

El expediente **no se incrusta en el HTML**: se carga en la base de la página publicada (Fase 4). En la página
quedan el expediente legible, un **chat** que responde solo con el expediente (y Jira en vivo, en lectura)
citando la fuente, y el botón **«Actualizar requerimiento»** (solo el dueño): un analista busca novedades en
Jira (y en el correo, si hay conector) desde la última actualización, un revisor las debate contra el
expediente (¿contradice algo decidido?, ¿la fuente alcanza?, ¿es repetida?) y el líder marca qué se aplica.
Si el líder pide actualizarlo desde Claude Code, haz lo mismo con subagentes y escribe con `ArtifactData`
pasando `if_version`.

## Fase 2 · Descomponer y estimar

- Cada historia se parte en subtareas de 0,5 a 8 h. Si una pasa de 8 h, se parte.
- A cada subtarea se le asigna un `tipo` de la matriz y la cantidad (componentes, copias, preguntas…).
- `horas = (base + unidad_horas × cantidad) × factor_nivel × factor_familiaridad`, redondeo a 0,5 h.
  Los tipos con `sin_factor: true` no se multiplican.
- Tareas de diseño técnico con incertidumbre: usar `rango` y decir por qué en la observación.
- **Clasificación → estado inicial** (solo dos estados):
  - existe igual / otro cliente / parametrización / nuevo **pedido en la historia y aprobado** → `propuesta`.
  - nuevo no confirmado, otra versión, contradice la historia, bloqueado → `espera` (pendiente de
    definición) **con observación**.
  - Lo que depende de un acuerdo con otro equipo pero sí entra va en `propuesta` y su observación empieza
    con «CONDICIONADO a …», con a quién y desde cuándo.
- **Fechas:** secuencia por dependencias, empezando por la tarea base; carga diaria ≤ `capacidad_diaria`
  (por defecto 7,5 h de lunes a jueves y 7 h el viernes: el resto de la jornada es daily, reuniones y
  soporte); no programar en festivos (los de `config.json`). Lo pendiente no lleva fecha. Las horas de
  cada tarea no se inflan por esto.
- **Línea fija de revisión y pruebas** por historia con lógica (tipo `prueba_funcional_logica`): revisar
  lo que generó la IA cuesta, y los estudios de DORA muestran que sin esa revisión cae la estabilidad. Va al
  final del sprint, no pegada a la historia.
- **Legado e integración no se descuentan por IA**: en repos maduros y conocidos la IA no aceleró (estudio
  de METR). El descuento de copiloto aplica a lo nuevo y acotado (formularios, CRUD, pruebas, traslados).
- **Familiaridad:** si el dev no conoce ese repo o cliente, aplica el factor `nula` y dilo.
- **Segunda estimación independiente:** además de la suma por matriz (abajo-arriba), estima cada historia
  completa por analogía con una ya hecha (arriba-abajo). Si difieren más de 30 %, revísalo antes de seguir.
- Cada subtarea dice en su observación el tipo, la cantidad y la **confianza** (alta si el tipo está
  calibrado, baja si es «sin matriz»). Lo de confianza baja se muestra como riesgo, no se esconde.
- **Responsable por subtarea:** por defecto el dueño del cronograma; una subtarea de otra persona (soporte,
  por ejemplo) no suma a la carga del dueño. Al exportar sale asignada a esa persona: su accountId se toma de
  `equipo` o la página lo busca en Jira por nombre; nunca se adivina.
- **Ninguna subtarea va a Jira solo con su título**, pero es una subtarea, no una historia: corta
  (~150 palabras), puntual y técnica, para que el dev sepa exactamente qué tocar. Secciones:
  **Objetivo** (una línea) · **Qué hacer** (2 a 6 pasos técnicos) · **Dónde** (repo, archivo:línea, tabla,
  SP, endpoint) · **Criterios técnicos** (1 a 3, verificables en el PR) · **Depende de** (solo si hay orden).
  El contexto de negocio vive en la historia padre. Una subtarea aceptada con horas **no lleva «Por
  confirmar»**: lo que falte definir es otra subtarea, en pendiente de definición. Nada inventado.
  Al exportar, la página vuelve a interpretar cada subtarea con el analista y el líder la revisa; una
  subtarea sin descripción suficiente no sale. El pie con horas, fechas y responsable lo agrega la página.

## Fase 3 · Revisor adversarial

Lanza el agente **`revisor-estimacion`** de este plugin (puede aparecer como
`personal-os:revisor-estimacion`) con: la ruta de la matriz usada, la tabla de piezas clasificadas, la lista
de subtareas (tipo, cantidad, horas, estado, observación), las rutas de los repos con su ref y los
criterios de aceptación. Busca sobreestimación frente a la matriz, piezas que ya existen o están en otro
cliente, duplicados entre historias, subtareas que no responden a ningún criterio de aceptación y, al revés,
lo legado o riesgoso que quedó corto. Aplica sus hallazgos o déjalos anotados con el porqué.

## Fase 4 · Entregables

1. **`plan.json` y el cronograma interactivo.** Formato completo en `generar_cronograma.py` y un ejemplo
   ficticio en `plan-ejemplo.json`. Llena `jira` (sitio, cloud_id, tipo_subtarea, campo_inicio) desde
   `fuentes.yaml`; `correo.servidor_mcp` = `"Microsoft 365"` solo si `m365.outlook` es `true`; `capacidad`
   desde `capacidad_diaria`; `personas` y `cuentas` desde `equipo`. Las fases salen **tal cual** del
   cronograma del cliente. Genera (con `python` o `python3`, en una carpeta de trabajo):

   ```
   python "<raíz del plugin>/skills/planear-sprint/generar_cronograma.py" plan.json cronograma.html
   ```

   - **Si la sesión tiene la herramienta `Artifact`** (claude.ai), publícalo y carga antes la skill
     `artifact-capabilities` para declarar las capacidades: `db` (colecciones `plan`, `orden` y
     `expediente`: lectura para quien ve, escritura solo el dueño), `user`, `sample`, `downloads` y `mcp`
     (conector de Atlassian: `searchJiraIssuesUsingJql`, `createJiraIssue`, `addCommentToJiraIssue`,
     `getTransitionsForJiraIssue`, `transitionJiraIssue`; y, si hay correo, `outlook_email_search` y
     `read_resource`). Después: `ArtifactData set` del expediente en `expediente/actual`.
     El líder acepta, ajusta, reprograma y exporta desde ahí, y le pregunta al analista. La página es
     responsive y respeta modo claro/oscuro.
   - **Sin la herramienta `Artifact`**, entrega el HTML local: se ve el plan en solo lectura (sin guardado,
     sin Jira y sin analista) y sirve de vista previa; la exportación queda para cuando se publique.
   - Si el sprint tiene una **fecha de entrega comprometida**, propón crear su nota en
     `<stateDir>/alcances/` con el cronograma como fuente viva (no copies los puntos: se leen de ahí).
2. **Resumen en el chat:** horas propuestas frente a la capacidad del sprint, fin de desarrollo según el plan
   frente al cronograma, pendientes por definir con sus horas, bloqueos de terceros (desde cuándo y de quién)
   y los tipos «sin matriz».
3. **Borrador del correo de escalada** de lo pendiente: conteos, nombres clave, preguntas numeradas, para
   responder en el hilo donde vive el tema. Cada código interno va con su nombre en lenguaje normal.
   **Nunca se envía**: lo manda el usuario.
4. **Bitácora:** una línea por fase en `<stateDir>/bitacora/AAAA-MM-DD.md`.

## Fase 5 · Calibración (opcional, cuando haya datos)

- Compara lo estimado con lo **registrado** (worklogs de Jira o timesheets), por tipo de la matriz.
  La calibración sale de tiempo registrado, **nunca del autorreporte** del dev (en el estudio de METR los
  devs creían ir 20 % más rápido e iban 19 % más lento).
- Excluye lo estimado con la propia matriz sin cambios del líder (se calibraría contra sí misma) y normaliza
  por nivel.
- Con 5 o más muestras de un tipo, propón que la `base` pase a ser su P50 real y agrega su P80 como `rango`.
  Muéstrale al usuario la propuesta tipo por tipo; **sin su OK la matriz no cambia**. Lo aceptado se escribe
  en `fuentes.yaml` con fecha y fuente.
- El rendimiento por persona es información sensible: se guarda en `<stateDir>` (privado), nunca en el repo.
- Con 3 o más sprints calibrados, la fecha del sprint se compromete con Monte Carlo sobre lo cerrado por
  semana; las horas quedan para repartir capacidad.

## Errores que ya pasaron (no repetir)

- Buscar la rama en el remoto equivocado y afirmar que no existía: vivía en el proyecto de otro cliente.
- Estimar «a mano»: dio más del doble de lo que se aceptó con copiloto.
- Llamar «diferente» a algo que solo el mockup muestra resumido: comparar estructura y lógica, no la
  cantidad de ítems de ejemplo.
- Dejar en propuesta lo que la historia de Jira no pide (solo estaba en la especificación).
- Editar directamente datos que el almacén de la página entrega congelados: se clonan antes de editar.
- Exportar subtareas con una descripción fija de una línea: el dev no sabía qué hacer sin volver a preguntar.
- Correr las fases para que el plan «quepa»: las fases salen tal cual del cronograma del cliente y no se
  mueven; el desborde sobre el fin de desarrollo se muestra como atraso, con las horas que no caben.
