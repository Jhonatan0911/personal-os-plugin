---
name: planear-sprint
description: Planea un sprint o un requerimiento de punta a punta para un líder técnico — revisa con agentes el código actual de los repos que toca (ramas y remotos verificados), entiende las historias de usuario, la especificación, los mockups, las transcripciones y los correos del tema, separa lo que ya existe de lo nuevo y de lo que el cliente no ha definido, estima con la matriz de tiempos del equipo (devs que usan IA de copiloto, por nivel y familiaridad), pasa un revisor adversarial y entrega un cronograma interactivo para aceptar y exportar a Jira, con el expediente del requerimiento y el borrador del correo de escalada. Úsala cuando el usuario diga "planeemos el sprint de X", "haz el planning de", "estima estas historias", "arma las subtareas de", "cuánto se demora este requerimiento", "calibra la matriz de tiempos" o pase una épica o historia para planear. No es para el estado diario del equipo (status-celula) ni para registrar horas (timesheet). NUNCA escribe en Jira por su cuenta.
---

# planear-sprint — de las historias al cronograma estimado

Planear un sprint a mano (leer historias, revisar el código, estimar, poner fechas, escribir subtareas)
le cuesta al líder medio día. Esta skill lo hace con agentes de solo lectura y una matriz de tiempos
que se calibra con lo real. **La skill propone; el líder decide.**

**Dónde está cada cosa.** `<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`;
la configuración, en `<stateDir>/config/fuentes.yaml`. Los archivos de esta skill (generador, plantillas,
ejemplos, referencias) están en `${CLAUDE_SKILL_DIR}`. Los scripts del plugin se citan como
`node "<raíz del plugin>/scripts/<script>.js"`; la raíz aparece en el contexto de la sesión en la línea
**«Scripts del plugin:»** que inyecta el hook de arranque.

## Reglas que no se negocian

- **Nada se escribe en Jira** sin que el líder lo acepte en el cronograma y lo exporte él desde la página
  (o lo pida explícitamente en el chat, cambio por cambio). Leer Jira es libre.
- **Estimación = desarrollador que usa IA de copiloto**: autor principal (entiende qué va a hacer, escribe
  un buen prompt, revisa, ajusta a los patrones del proyecto y prueba). **Apretada y sin colchón**: ni «a
  mano» ni «la IA lo hace sola»; estimar a mano dio más del doble de lo que luego se aceptó. La cifra
  final la pone el líder.
- **La fuente de cifras es la matriz de tiempos.** Si el tipo no existe o tiene `base: null`, se estima
  con criterio, se marca **«sin matriz»** y se reporta para que el líder la fije. Nunca una cifra inventada.
- **Lo que el cliente no aprobó** (nuevo, o con otra versión distinta a la historia) se estima pero queda
  **pendiente de definición**, sin fecha y con qué falta, de quién y desde cuándo.
- **Antes de llamar «nuevo» a algo**, se busca en otros clientes, otras ramas y el historial de git.
- **Antes de afirmar que una rama o un archivo no existe**, `git fetch`/`git ls-remote` contra el **remoto
  del proyecto u organización donde vive el código de ese cliente**, que puede no ser el habitual. Si no
  aparece: «no lo encontré en <remoto/ref>», nunca «no existe».
- **Las fechas del cliente son fijas.** Las fases salen tal cual de su cronograma y no se corren para que
  el plan «quepa»: el desborde se muestra como atraso, con las horas que no caben.
- **Sin secretos**: nada de tokens, PAT ni cadenas de conexión en el plan, el expediente o el chat. Si un
  repo pide credenciales, el usuario las configura en su git.

## Fase 0 · Insumos (preguntar solo lo que falte)

1. Lee `fuentes.yaml` (`jira`, `equipo`, `m365`, `planeacion`). Claves, valores por defecto y perfiles:
   `references/configuracion.md`.
2. **Matriz:** `planeacion.matriz_archivo` → `planeacion.matriz_tiempos` con tipos → la de ejemplo del
   plugin (`matriz-tiempos-ejemplo.yaml`), y en ese caso **dilo** en el resumen. Referencias base:
   componente nuevo con lógica ≈ 1,5-3 h; mostrar un dato ya calculado ≤ 1 h; traslado o refactor ≈ −30 %
   frente a la cifra a mano.
3. **Propuesta de calibración pendiente:** si `<mineria_dir>/propuesta-matriz.md` es más nueva que la
   matriz, muéstrale al líder en 3-5 líneas qué tipos propone ajustar o crear y pregunta si los aplica
   antes de estimar (`references/calibracion.md`). Sin su OK la matriz no cambia.
4. **Nivel y familiaridad por persona** son ejes distintos: un júnior que conoce todo el negocio puede
   rendir más que un sénior nuevo. Salen de `equipo` o de `personas` de la matriz. Si falta alguno para
   la persona y el frente, pregúntalo y, con su OK, guárdalo con fuente y fecha. Nunca deducirlo.

| Insumo | Cómo se obtiene |
|---|---|
| Historias | Claves de Jira o la épica (`parent = PROY-140 AND assignee = …`). Descripción completa y comentarios. |
| Responsable | Nombre → nivel + familiaridad con ese frente. |
| Ventana del sprint | Cronograma del cliente (hoja, correo, acta): inicio, fin de desarrollo, QA, pruebas, holgura, alistamiento, entrega. |
| Repos y ramas | Por repo: URL del **remoto correcto** + rama vigente, verificadas con `git ls-remote`. Leer con `git show`/`git grep` sobre el ref; `checkout` solo con el árbol limpio y la autorización del usuario. |
| Documentos | Especificación funcional o técnica, mockups (HTML, Figma, imágenes), tablas paramétricas, actas y, si existe, la **transcripción de la reunión de entrega**. |
| Correos | Si `m365.outlook` es `true`: buscar por la clave de la épica y el nombre del frente. Bloqueos y respuestas del cliente (a veces ya resolvieron pendientes que las historias aún muestran abiertos). Estos términos van luego a `correos_busqueda`. |

## Fase 1 · Entender (agentes en paralelo, todos de solo lectura)

Lanza en **un solo mensaje**:

1. **Un mapeador por repo** (`subagent_type: Explore`, muy exhaustivo) con el requerimiento resumido, el
   remoto y el ref, y este encargo: «responde con evidencia archivo:línea: **A)** cómo funciona hoy el flujo
   que se va a tocar; **B)** dónde vive cada pieza que el requerimiento menciona; **C)** qué ya existe igual,
   parecido o nada; **D)** cómo se guarda y qué impacto tendría en modelo, API y BD; **E)** mecanismo de
   bandera o configuración por cliente; **F)** riesgos para estimar (duplicación, archivos gigantes, sin
   tests, dependencias)».
2. **Un buscador de reutilización** (Explore): lo mismo contra otros clientes, ramas e historial
   (`git log -G`, otros proyectos u organizaciones del mismo producto) para cada pieza que el mapeador
   marque como nueva.
3. **Lectura de documentos** (en el hilo principal o con un agente general): historias + especificación
   + mockups + transcripción + correos → lista de **piezas del requerimiento** con su criterio de
   aceptación y sus pendientes.

Resultado: tabla **pieza → clasificación**: `existe igual` · `existe con diferencia` · `existe en otro
cliente/rama` · `nuevo` · `solo parametrización/BD` · `contradice o no está en la historia` ·
`bloqueado por un tercero`.

- Compara **estructura y lógica**, no la apariencia: lo que el mockup muestra resumido o con menos ítems
  de ejemplo no es «diferente».
- Lo que solo aparece en la especificación o el mockup, y no en la historia de Jira, es «no está en la
  historia»: no entra en propuesta.

## Fase 1-bis · Expediente del requerimiento (el analista)

Con lo leído arma `expediente.json` (forma y reglas en `references/expediente.md`): `resumen`,
`historias`, `decisiones`, `pendientes`, `riesgos`, `hallazgos_codigo`, `cronograma`, `fuentes` e
`historial`. **Cada afirmación lleva su fuente.** Lo que el cliente ya respondió va como decisión y su
pendiente se marca resuelto con la resolución. No se incrusta en el HTML: se carga en la base de la
página publicada (Fase 4), donde quedan el chat del analista y el botón «Actualizar requerimiento».

## Fase 2 · Descomponer y estimar

- Cada historia se parte en subtareas de 0,5 a 8 h; si una pasa de 8 h, se parte.
- A cada subtarea, un `tipo` de la matriz y la cantidad (componentes, copias, preguntas…).
- `horas = (base + unidad_horas × cantidad) × factor_nivel × factor_familiaridad`, redondeo a 0,5 h. Los
  tipos con `sin_factor: true` no se multiplican. Si el dev no conoce ese repo o cliente, aplica la
  familiaridad `nula` (equivale a subir un escalón de nivel, como la experiencia en la aplicación de
  COCOMO) y dilo.
- Diseño técnico con incertidumbre: usa `rango` y di por qué en la observación.
- **Clasificación → estado inicial** (solo dos estados):
  - existe igual / otro cliente / parametrización / nuevo **pedido en la historia y aprobado** → `propuesta`.
  - nuevo no confirmado, otra versión, contradice la historia, bloqueado → `espera` **con observación**.
  - Lo que depende de un acuerdo con otro equipo pero sí entra va en `propuesta` y su observación empieza
    con «CONDICIONADO a …», con a quién y desde cuándo.
- **Fechas:** secuencia por dependencias desde la tarea base; carga diaria ≤ capacidad de desarrollo
  (por defecto 7,5 h de lunes a jueves y 7 h el viernes: el resto es daily, reuniones y soporte); sin
  festivos. Lo pendiente no lleva fecha. Las horas de cada tarea no se inflan por esto. Las subtareas
  arrancan en el primer día hábil disponible, aunque el sprint ya haya empezado.
- **Línea fija de revisión y pruebas** por historia con lógica (tipo `prueba_funcional_logica`): revisar
  lo que generó la IA cuesta, y DORA muestra que sin esa revisión cae la estabilidad. Va al final del sprint.
- **Legado e integración no se descuentan por IA**: en repos maduros y conocidos la IA no aceleró
  (METR). El descuento de copiloto aplica a lo nuevo y acotado (formularios, CRUD, pruebas, traslados).
- **Segunda estimación independiente:** además de la suma por matriz (abajo-arriba), estima cada historia
  completa por analogía con una ya hecha (arriba-abajo). Si difieren más de 30 %, revísalo antes de seguir.
- Cada subtarea dice en su observación el tipo, la cantidad y la **confianza** (alta si el tipo está
  calibrado, baja si es «sin matriz»). Lo de confianza baja se muestra como riesgo, no se esconde.
- **Responsable por subtarea:** por defecto el dueño del cronograma; la de otra persona (soporte, por
  ejemplo) no suma a su carga y al exportar sale asignada a ella (accountId de `equipo` o buscado en Jira
  por nombre; nunca se adivina).
- **Ninguna subtarea va a Jira solo con su título**, pero es una subtarea, no una historia: corta
  (~150 palabras), puntual y técnica, para que el dev sepa exactamente qué tocar sin volver a preguntar.
  Borrador en `desc` con: **Objetivo** (una línea) · **Qué hacer** (2 a 6 pasos) · **Dónde** (repo,
  archivo:línea, tabla, SP, endpoint) · **Criterios técnicos** (1 a 3, verificables en el PR) · **Depende
  de** (solo si hay orden). El contexto de negocio vive en la historia padre. Una subtarea aceptada con
  horas **no lleva «Por confirmar»**: lo que falte definir es otra subtarea, en pendiente de definición.
  Nada inventado. Al exportar, la página la vuelve a interpretar con el analista y el líder la revisa.

Si existe `planeacion.investigacion`, es la base documental de estas reglas: cítala cuando el líder
pregunte por qué.

## Fase 3 · Revisor adversarial

Lanza el agente **`revisor-estimacion`** de este plugin (puede aparecer como
`personal-os:revisor-estimacion`) con: la ruta de la matriz usada, la tabla de piezas clasificadas, las
subtareas (tipo, cantidad, horas, estado, observación), las rutas de los repos con su ref y los criterios
de aceptación. Busca sobreestimación frente a la matriz, piezas que ya existen o están en otro cliente,
duplicados entre historias, subtareas que no responden a ningún criterio de aceptación y, al revés, lo
legado o riesgoso que quedó corto. Aplica sus hallazgos o déjalos anotados con el porqué.

## Fase 4 · Entregables

1. **`plan.json` y el cronograma interactivo** en `planeacion.carpeta_trabajo` (por defecto
   `<stateDir>/estimaciones/<slug>/`). Formato en el docstring de `generar_cronograma.py` y en
   `plan-ejemplo.json`; de dónde sale cada campo, en `references/configuracion.md` §5. Incluye `epica`,
   `correos_busqueda`, `capacidad`, `personas`, `cuentas` y `expediente`. Las fases, tal cual del cliente.

   ```
   python "${CLAUDE_SKILL_DIR}/generar_cronograma.py" plan.json cronograma.html [--perfil <perfil>] [--marca <marca>]
   ```

   Publicar (capacidades, sin herramienta `Artifact`, cargar el expediente con `ArtifactData`, registrar
   en el tablero central y la nota de alcance): `references/cronograma.md`.
2. **Resumen en el chat:** horas propuestas frente a la capacidad del sprint, fin de desarrollo según el
   plan frente al cronograma, pendientes por definir con sus horas, bloqueos de terceros (desde cuándo y
   de quién) y los tipos «sin matriz».
3. **Borrador del correo de escalada** de lo pendiente: conteos, nombres clave y preguntas numeradas,
   para responder **en el hilo donde vive el tema**. Cada código interno va con su nombre en lenguaje
   normal. Si existe `rutas.perfil_voz` (o una skill de redacción del usuario), redáctalo con esa voz.
   **Nunca se envía**: lo manda el usuario.
4. **Bitácora:** una línea por fase con `node "<raíz del plugin>/scripts/bitacora-append.js" "<resumen>"`.
   Si el usuario lleva timesheet, el tramo de planeación va con su línea `--ts` colgada de la issue del
   proyecto (categoría de planeación de su configuración); las horas extra siguen las reglas de la skill
   `timesheet`.

## Fase 5 · Calibración (cuando haya datos)

Compara lo estimado con lo **registrado**, por tipo, y propone ajustes a la matriz (P50 como `base`, P80
en `rango`) solo con 5 o más muestras; nada cambia sin el OK del líder. Procedimiento completo, encargos
de los mineros, página del catálogo y Monte Carlo: `references/calibracion.md`.

## Errores que ya pasaron (no repetir)

- Buscar la rama en el remoto equivocado y afirmar que no existía: vivía en el proyecto de otro cliente.
- Estimar «a mano»: dio más del doble de lo que se aceptó con copiloto.
- Llamar «diferente» a algo que solo el mockup muestra resumido.
- Dejar en propuesta lo que la historia de Jira no pide (solo estaba en la especificación).
- Editar directamente datos que el almacén de la página entrega congelados: se clonan antes de editar.
- Exportar subtareas con una descripción fija de una línea: el dev no sabía qué hacer sin volver a preguntar.
- Correr las fases para que el plan «quepa»: el desborde se muestra como atraso, no se esconde.

## Cuándo NO usarla

- Para ver quién está ocupado y el cronograma de todo el equipo: `status-celula`.
- Para registrar o cuadrar horas trabajadas: `timesheet`.
- Para crear o mover issues en Jira sin un plan detrás: se hace directamente, con confirmación.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/configuracion.md` | Fase 0 y al armar el plan: claves de `fuentes.yaml`, orden de la matriz, perfil de organización y marca |
| `references/expediente.md` | Fase 1-bis y al actualizar el requerimiento |
| `references/cronograma.md` | Fase 4: generar, publicar, cómo se comporta la página, exportar y registrar |
| `references/calibracion.md` | Fase 0 si hay propuesta pendiente, y Fase 5 |
| `generar_cronograma.py` | Se **ejecuta**: valida el plan y el expediente, aplica perfil y marca, genera el HTML |
| `cronograma-plantilla.html`, `analista-bloque.html` | Los usa el generador; no se leen |
| `matriz-tiempos-ejemplo.yaml` | Matriz por defecto si el usuario no tiene la suya |
| `plan-ejemplo.json` | Ejemplo ficticio del plan |
