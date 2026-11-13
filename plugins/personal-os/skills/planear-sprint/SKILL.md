---
name: planear-sprint
description: Planea un sprint o un requerimiento de punta a punta para un líder técnico — revisa con agentes el código actual de los repos que toca, entiende las historias de usuario, la especificación, los mockups, las transcripciones y los correos del tema, separa lo que ya existe de lo nuevo y de lo que el cliente no ha definido, estima con la matriz de tiempos del equipo (devs que usan IA de copiloto, por nivel y familiaridad), pasa un revisor adversarial y entrega un cronograma interactivo para aceptar y exportar a Jira, con el expediente del requerimiento y el borrador del correo de escalada. Úsala cuando el usuario diga "planeemos el sprint de X", "haz el planning de", "estima estas historias", "arma las subtareas de", "cuánto se demora este requerimiento", "aceptemos este requerimiento", "¿esto choca con la norma?", "calibra la matriz de tiempos" o pase una épica o historia para planear. No es para el estado diario del equipo (status-celula) ni para registrar horas (timesheet). NUNCA escribe en Jira por su cuenta.
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
- **Horas de atención, no de escritura** (si la matriz trae `factor_atencion_aplicado`): sus cifras ya son
  las horas del dev para encargar, revisar, ajustar y probar; la generación la hace el agente en tiempo de
  máquina y no se cuenta. No se vuelven a multiplicar ni se suben «por legado» (esa incertidumbre va en
  `rango` y en la observación). La revisión y las pruebas no se recortan.
- **Varios frentes en paralelo**: un dev lleva hasta `planeacion.frentes_paralelos` frentes a la vez (por
  defecto 3, con varias sesiones de IA). Nunca se propone dedicación exclusiva ni se dice que un frente le
  «quita» horas a otro: solo se cuida que la suma de atención del día no pase de la capacidad.
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
- **El refutador corre antes de exportar** y sus recortes bajan al plan. En un caso real se exportaron
  27 subtareas y después apareció que una disparaba facturación desde la interfaz, otras usaban cortes
  clínicos sin fuente y una escala estaba fuera del alcance: nadie lo había clasificado antes.
- **Lo claro avanza, lo dudoso espera** (DoR por niveles, no compuerta): una pregunta abierta bloquea solo
  los criterios que nombra, nunca el requerimiento entero.
- **Un expediente por requerimiento** en `<stateDir>/requerimientos/<slug>/expediente.json` (esquema v2).
  Es la fuente única: la página del cronograma y la lista de trabajo del líder cargan copias de él.

## Fase 0 · Insumos (preguntar solo lo que falte)

1. Lee `fuentes.yaml` (`jira`, `equipo`, `m365`, `planeacion`). Si existe `planeacion.reglas_org`, son reglas de la organización que se cumplen en **toda** subtarea (quién corre scripts y jobs, convenciones de BD, etc.): léelas antes de descomponer y no propongas nada que las contradiga. Claves, valores por defecto y perfiles:
   `references/configuracion.md`.
2. **Matriz:** `planeacion.matriz_archivo` → `planeacion.matriz_tiempos` con tipos → la de ejemplo del
   plugin (`matriz-tiempos-ejemplo.yaml`), y en ese caso **dilo** en el resumen. Las referencias de
   tamaño salen **siempre de la matriz**, nunca de este texto; si trae `factor_atencion_aplicado`, dilo
   («horas de atención ×<factor>»).
3. **Propuesta de calibración pendiente:** si `<mineria_dir>/propuesta-matriz.md` es más nueva que la
   matriz, muéstrale al líder en 3-5 líneas qué tipos propone ajustar o crear y pregunta si los aplica
   antes de estimar (`references/calibracion.md`). Sin su OK la matriz no cambia.
4. **Nivel del caso:** si `flujo.niveles_activos` es `true`, clasifica primero el caso (trámite, bug,
   requerimiento…) con `references/paso0.md` §0. Un nivel con `p0: corto` se resuelve con la ficha corta
   y termina ahí, sin Fases 1-5. Sin sección `flujo`, todo caso sigue el flujo completo
   (`references/niveles.md`).
5. **Nivel y familiaridad por persona** son ejes distintos: un júnior que conoce todo el negocio puede
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

Con lo leído arma el expediente v2 en `<stateDir>/requerimientos/<slug>/expediente.json` (forma y reglas
en `references/expediente.md`). **Cada afirmación lleva su fuente.** Lo que el cliente ya respondió va
como decisión y su pendiente se marca resuelto con la resolución. Además de lo de siempre (resumen,
historias, decisiones, pendientes, riesgos, hallazgos, fuentes, historial), en esta fase llenas:

- **Historias con criterios `CA-n`**, cada uno con su `como_verificar` (test, consulta o captura). Es la
  única especificación: la usan la subtarea, la revisión del PR y la matriz de pruebas.
- **Pendientes con `bloquea`** (los CA que frenan) y un dueño corto (`a_quien`), no un párrafo.
- **Ficha de impacto (paso 1):** `cabecera` (para qué, quién lo pide, motivo, expectativas, si lo pide
  gerencia, fecha comprometida) e `impacto` (ejes del módulo tocado, peso en la operación y, si un eje vale
  4 o más, 3-5 modos de falla). Cómo llenarla: `references/especificacion.md` §1.

No se incrusta en el HTML: se carga en la base de la página publicada (Fase 4), donde quedan el chat del
analista y el botón «Actualizar requerimiento».

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
  arrancan en el primer día hábil disponible, aunque el sprint ya haya empezado. La capacidad es de
  atención y se comparte entre los frentes del dev: otro frente activo no corre este plan si la suma del
  día cabe.
- **Línea fija de revisión y pruebas** por historia con lógica (tipo `prueba_funcional_logica`): revisar
  lo que generó la IA cuesta, y DORA muestra que sin esa revisión cae la estabilidad. Va al final del sprint.
- **Legado e integración**: en repos maduros la IA acelera menos (METR). Con una matriz sin
  `factor_atencion_aplicado`, el descuento de copiloto aplica solo a lo nuevo y acotado. Con factor de
  atención, la cifra de la matriz manda y el riesgo de legado se expresa en `rango`, no subiendo la base.
- **Segunda estimación independiente:** además de la suma por matriz (abajo-arriba), estima cada historia
  completa por analogía con una ya hecha (arriba-abajo). Si difieren más de 30 %, revísalo antes de seguir.
- **La observación (`obs`) la lee el líder, no la máquina: lenguaje claro desde el primer análisis.**
  Tres partes fijas, en palabras de negocio:
  `Qué hace: <qué construye el dev y para qué; qué valida, qué guarda, quién lo usa> · Horas: <por qué
  esa cifra, en una frase> · Depende de: <quién responde y qué pregunta del correo es>` (en una subtarea
  en espera, `Por qué está en espera:` en vez de `Depende de`). Quien no conoce el código debe entender
  qué va a hacer el dev sin abrir la descripción. Nada de jerga sola: ni tipo de matriz, factores,
  «Revisor (fecha)», «Refutador», RN-xx, P-xx o CA-xx sin explicar.
  - La traza técnica (tipo y cantidad de la matriz, factores, **confianza**, ajustes del revisor y del
    refutador) va en `obs_tecnica`; lo de confianza baja se menciona en `obs` como riesgo en palabras
    («podría subir a 5 h si…»), no se esconde.
  - Mal: «Sin matriz (endpoint_nuevo sin cifra) · 1,5 h senior × 1,6 ≈ 2,5 h · confianza media.»
    Bien: «Qué hace: el servicio que guarda una solicitud nueva; antes valida que el servicio pedido esté
    habilitado, que el cliente no tenga otra solicitud activa del mismo servicio y que traiga un teléfono;
    calcula el vencimiento en días hábiles y deja lista la notificación. · Horas: 2,5 h, servicio nuevo con
    sus reglas. · Lo usa: el formulario de registro de la pantalla principal.»
  - El generador avisa por cada `obs` que no empiece con «Qué hace:»: corrígelas antes de publicar.
- **Modelo de BD en toda subtarea que crea o cambia tablas** (campo `modelo` del ítem): las tablas nuevas y
  las existentes que solo se leen, con columnas (`n`, `t`, `pk`, `fk: "Tabla.Columna"`, `nulo`) y una `nota`
  por tabla. Los nombres de las tablas y columnas existentes se verifican en el código o el modelo EF del repo
  (archivo:línea), nunca se suponen. Lo que ya vive en otra tabla se lee, no se copia (p. ej. datos de contacto).
  En la página, el líder lo ve como diagrama de relaciones, lo edita (borrar o agregar tablas y columnas) y lo
  aprueba; el modelo aprobado sale en la descripción de Jira y manda sobre el texto.
  Tras exportar, la imagen del diagrama se genera con `modelo_png.py` y se incrusta en la descripción de la
  subtarea en Jira (con OK del líder): `references/cronograma.md`, «Modelo de BD en Jira».
- **Las notas del líder mandan.** Antes de regenerar el cronograma o tocar una historia, lee su documento en la
  base de la página (`plan/<historia>` con ArtifactData) y trabaja sobre él: conserva sus ediciones, ids y
  estados, y si una nota del líder contradice la descripción (menos validaciones, otro alcance), ajusta la
  descripción a la nota y dilo; si deja un criterio de la historia sin cubrir, avísale para que lo hable con el
  cliente. Toda subtarea escrita a mano en la base lleva `id` único, o sus botones no responden.
- **Responsable por subtarea:** por defecto el dueño del cronograma; la de otra persona (soporte, por
  ejemplo) no suma a su carga y al exportar sale asignada a ella (accountId de `equipo` o buscado en Jira
  por nombre; nunca se adivina).
- **Definición técnica (paso 2):** 2-3 **escenarios de calidad** `QA-n` con medida numérica, escogidos
  por los ejes altos de la ficha de impacto, y un **ADR** por cada decisión estructural (algo síncrono en
  una ruta crítica, una tabla nueva, una integración, un cambio de contrato). Sin medida no se puede
  revisar en el PR. Formato y ejemplos: `references/especificacion.md` §2.
- **Cada subtarea es una instrucción exacta** que el dev (o su asistente) ejecuta sin volver a preguntar:
  contexto · qué hacer · dónde · **qué NO tocar** · criterios `CA-n` con cómo verificarlos · entregables
  (tests, docs, script de BD con publicación y rollback si toca BD) · corte · «si dudas, pregunta». Va en
  `desc` (o en campos sueltos que el generador compone). Plantilla: `references/especificacion.md` §3.
  Una subtarea aceptada con horas **no lleva «Por confirmar»**: lo que falte definir es otra subtarea, en
  pendiente de definición. Nada inventado. Al exportar, la página la vuelve a interpretar con el analista.
- **Cortes de seguimiento:** propón fechas en las que el líder revisa evidencia (rama empujada, PR parcial
  con tests verdes) contra CA concretos, al menos uno por historia con lógica y nunca solo al final.
  Van a `cortes[]` del expediente (`references/especificacion.md` §4).

Si existe `planeacion.investigacion`, es la base documental de estas reglas: cítala cuando el líder
pregunte por qué.

## Fase 3 · Revisores adversariales y chequeo del paso 0

Lanza **en un solo mensaje** los dos agentes de este plugin (pueden aparecer con el prefijo
`personal-os:`):

1. **`revisor-estimacion`** con: la ruta de la matriz usada, la tabla de piezas clasificadas, las subtareas
   (tipo, cantidad, horas, estado, observación), las rutas de los repos con su ref y los criterios de
   aceptación. Busca sobreestimación, piezas que ya existen, duplicados, subtareas sin criterio detrás y lo
   legado que quedó corto. Aplica sus hallazgos o déjalos anotados con el porqué.
2. **`refutador-requerimiento`** con: la ruta del expediente, las subtareas, la tabla de normas
   (`<stateDir>/criticidad/normas.json`; si no existe, la de ejemplo del plugin y avisa que no está
   verificada), el mapa de criticidad si existe y `normas.jurisdicciones` si está configurado (con niveles
   activos, solo si el nivel está en `flujo.refutador.completo_en`). Devuelve, por punto, interés del usuario, qué se acepta,
   qué se refuta y con qué regla, la alternativa y su costo.

Con lo que devuelvan (`references/paso0.md`):
- Guarda la refutación en `refutacion[]` del expediente, con estado `propuesta`: el líder la acepta o la
  descarta, el refutador no decide.
- **Baja los recortes al plan**: lo refutado pasa a `espera` con la alternativa en la observación, lo que
  el refutador propone agregar entra como `propuesta` nueva, y lo que pide descartar se marca en la
  observación para que el líder lo descarte en la página (no se borra en silencio).
- Calcula el **chequeo del paso 0** (`aceptado`, `parcial` o `por_entender`) con la DoR por niveles y
  escríbelo en `chequeos.p0`. Con `por_entender` no se publica para exportar: se publica para decidir.

## Fase 4 · Entregables

1. **`plan.json` y el cronograma interactivo** en `planeacion.carpeta_trabajo` (por defecto
   `<stateDir>/estimaciones/<slug>/`). Formato en el docstring de `generar_cronograma.py` y en
   `plan-ejemplo.json`; de dónde sale cada campo, en `references/configuracion.md` §5. Incluye `epica`,
   `correos_busqueda`, `capacidad`, `personas`, `cuentas`, `equipo` (con `produce_pr` y `prestado`
   de `fuentes.yaml`: capacidad real) y `expediente` (ruta al expediente v2 de
   `<stateDir>/requerimientos/<slug>/`). Las fases, tal cual del cliente.

   ```
   python "${CLAUDE_SKILL_DIR}/generar_cronograma.py" plan.json cronograma.html [--perfil <perfil>] [--marca <marca>]
   ```

   Publicar (capacidades, sin herramienta `Artifact`, cargar el expediente con `ArtifactData`, registrar
   en el tablero central y la nota de alcance): `references/cronograma.md`.
   El generador avisa si el expediente v2 no tiene el chequeo del paso 0 o la refutación: **no exportes
   sin ellos**.
2. **Resumen en el chat:** chequeo del paso 0 y qué porción entra, refutaciones con su alternativa (cada
   una en una línea), horas propuestas frente a la capacidad del sprint, fin de desarrollo según el plan
   frente al cronograma, cortes propuestos, pendientes por definir con sus horas, bloqueos de terceros
   (desde cuándo y de quién) y los tipos «sin matriz».
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
- Decir que un frente nuevo le «quita» horas al plan de un dev, como si trabajara una cosa a la vez: los
  devs con IA llevan varios frentes en paralelo y la gerencia lo leyó como sobreestimación.
- Llamar «diferente» a algo que solo el mockup muestra resumido.
- Dejar en propuesta lo que la historia de Jira no pide (solo estaba en la especificación).
- Editar directamente datos que el almacén de la página entrega congelados: se clonan antes de editar.
- Exportar subtareas con una descripción fija de una línea: el dev no sabía qué hacer sin volver a preguntar.
- Entregar el primer análisis con observaciones en jerga de matriz y revisor («Sin matriz (endpoint_nuevo
  sin cifra) · 1,5 h senior × 1,6»): el líder abrió el cronograma de un plan de 48 subtareas y no entendió
  qué tenía que hacer el dev en ninguna. Hubo que reescribirlas todas.
- Regenerar sobre el plan local sin leer la base de la página: el líder había reducido a una sola validación
  una subtarea y había aceptado otras; se pisaban. Y subtareas movidas a mano sin `id` dejaron muertos los
  botones de la página.
- Guardar en una tabla nueva datos que ya existían en otra (los celulares del paciente): lo detectó el líder
  revisando el modelo; por eso el modelo de BD se muestra como diagrama antes de aceptar.
- Correr las fases para que el plan «quepa»: el desborde se muestra como atraso, no se esconde.
- Exportar antes de clasificar lo que chocaba con la norma o el producto: una subtarea hacía que llenar un
  formulario disparara facturación, y se descubrió con las subtareas ya en Jira.
- Aplicar una aceptación parcial del cliente en el correo pero no en el plan ya exportado.

## Cuándo NO usarla

- Para ver quién está ocupado y el cronograma de todo el equipo: `status-celula`.
- Para registrar o cuadrar horas trabajadas: `timesheet`.
- Para crear o mover issues en Jira sin un plan detrás: se hace directamente, con confirmación.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/configuracion.md` | Fase 0 y al armar el plan: claves de `fuentes.yaml`, orden de la matriz, perfil de organización y marca |
| `references/expediente.md` | Fase 1-bis y al actualizar el requerimiento: esquema v2, ubicación, compatibilidad con v1 |
| `references/especificacion.md` | Fases 1-bis y 2: ficha de impacto, escenarios de calidad y ADR, subtarea-instrucción, cortes |
| `references/paso0.md` | Fase 0 (nivel del caso) y Fase 3: encargo al refutador, cómo bajar sus recortes, DoR por niveles y chequeo del paso 0 |
| `references/niveles.md` | Contrato de los niveles de caso (A/B/C u otros) que comparten todas las piezas del flujo |
| `references/cronograma.md` | Fase 4: generar, publicar, cómo se comporta la página, exportar y registrar |
| `modelo_png.py` | Fase 4, tras exportar: imagen PNG del modelo de BD de una subtarea para incrustarla en Jira |
| `references/calibracion.md` | Fase 0 si hay propuesta pendiente, y Fase 5 |
| `generar_cronograma.py` | Se **ejecuta**: valida el plan y el expediente, aplica perfil y marca, genera el HTML |
| `cronograma-plantilla.html`, `analista-bloque.html` | Los usa el generador; no se leen |
| `matriz-tiempos-ejemplo.yaml` | Matriz por defecto si el usuario no tiene la suya |
| `plan-ejemplo.json` | Ejemplo ficticio del plan |
| `expediente-ejemplo.json` | Ejemplo ficticio del expediente v2 (lo valida el generador) |
