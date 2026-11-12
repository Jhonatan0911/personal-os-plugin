# Orquestación multi-agente

## Índice
- Los tres roles
- Fase 1a — Primera pasada (tú, barata, sin subagentes)
- Fase 1b — El reparto
- El encargo
- Fase 3 — Síntesis (tú)
- Fase 5 — Verificación por un dev sin contexto
- Reglas de encargo que evitan que el fan-out se caiga
- Presupuesto y honestidad del reparto

Este informe **no lo escribe un solo agente**. Un desarrollo de 12 repos no cabe en una ventana de
contexto, y un agente que intenta leerlo todo termina resumiendo de memoria, que es exactamente
como se inventan las cosas.

**Tú eres el jefe de documentación.** No lees código: reparte el trabajo, define qué te tiene que
entregar cada uno, recibe parciales en disco, los une con un propósito, y al final los somete a una
auditoría hecha por alguien sin contexto.

Regla de oro del contexto: **los parciales viven en archivos, no en tu ventana.** Cada subagente
escribe su `.md` y te devuelve un acuse de 15 líneas. Tú lees los archivos completos solo en la
síntesis, y por secciones.

---

## Los tres roles

| Rol | Cuántos | Qué hace | Qué entrega |
|---|---|---|---|
| **Orquestador** (tú) | 1 | Encuadra, reparte, sintetiza, corrige | El informe |
| **Levantador** | 1 a 3 por repo + transversales | Lee un repo/capa y documenta lo que encuentra | Un `.md` parcial + acuse |
| **Verificador** | 1 a 3, contexto limpio | Entra como dev nuevo y trata de romper el informe | Un `.md` de observaciones |

---

## Fase 1a — Primera pasada (tú, barata, sin subagentes)

Antes de repartir tienes que saber qué estás repartiendo. Sin leer código a fondo:

- Lista de repos/carpetas del alcance; el `package.json` / `.csproj` / `pom.xml` de cada uno para
  el stack y la rama viva.
- Los documentos del proyecto que ya existen (`HANDOFF.md`, `docs/`, `CONTRATOS/`, `README`): dicen
  qué está mapeado y qué no.
- Los scripts de BD y las carpetas de migraciones.
- Un `git log --oneline -15` por repo: revela cuáles están vivos y cuáles llevan meses quietos.

Con eso decides el reparto. **Esta pasada es la que evita mandar 3 agentes a un repo que solo
aporta una librería.**

## Fase 1b — El reparto

Asigna **1 a 3 levantadores por repo**, según lo que la primera pasada mostró:

| Cuántos | Cuándo | Ejemplo |
|---|---|---|
| **1** | Repo periférico, pequeño, o de una sola capa | un visor, un servicio de una función |
| **2** | Front y back separados, o app + su acceso a datos | `Acceso` (front) + `AccesoV2Api` (back) |
| **3** | El repo tiene front, back y objetos de BD propios | front / API / SP y tablas |

Y siempre estos **transversales**, que no pertenecen a ningún repo:

- **Base de datos global**: todos los scripts de publicación/rollback, y el inventario de objetos
  agrupado por función. Es el agente que más valor da y el que más se olvida.
- **Contratos entre repos**: qué se prometen entre sí, y dónde están las promesas escritas.
- **Vigencia**: git log, `HANDOFF.md`, documentos del proyecto. Produce el **mapa repo → commit y
  fecha** (las fechas casi nunca son iguales, y sin el mapa nadie sabe si una afirmación quedó vieja)
  y la lista de **qué documentos del proyecto están mintiendo**. Va siempre: es orientación pura.
- **Estado e historia**: `HANDOFF.md`, bitácora, issues, git log. Produce la tabla de estado real y
  la lista de lo abierto. **Solo si la Fase 0 pidió diagnóstico.** En un informe de orientación no se
  lanza: su salida no tiene sección donde ir, y lanzarlo es lo que empuja el documento hacia la
  auditoría.
- **Integraciones externas** (solo si la primera pasada encontró un tercero de verdad).

Tandas: lanza en paralelo los que quepan cómodos (6 a 8 por tanda es un buen número), y no lances
la siguiente tanda hasta cerrar la anterior. Así los acuses no se te apilan.

## El encargo

Cada levantador recibe un encargo **cerrado**: `plantillas/encargo-subagente.md`. Lo que no puede
faltar:

1. **Su alcance exacto** y, explícitamente, **qué no es suyo** (lo cubre otro agente).
2. **Las 4 reglas duras** de `SKILL.md`, copiadas. Sobre todo la 2: prohibido arrastrar el ejemplo.
3. **La ruta exacta** donde debe escribir su `.md`, y el esqueleto que debe respetar
   (`plantillas/parcial-repo.md`). Mismos encabezados en todos: así unir es mecánico.
4. **`archivo:línea` obligatorio** en cada afirmación del parcial.
5. **La instrucción de declarar huecos** en vez de rellenarlos, con una sección propia.
6. **El acuse**: lo único que devuelve por el canal del agente son 15 líneas — ruta del archivo,
   conteos (endpoints, SP, tablas, pantallas), los 3 hallazgos que más le sorprendieron, y sus
   huecos. **Nunca el contenido del parcial.**
7. **Política de BD**: si necesita la base, no la consulta — la pide. Solo TEST, solo lectura, y
   cada consulta necesita el OK del usuario. Ver `descubrimiento.md`.

Un encargo mal cerrado produce dos parciales que dicen lo mismo con nombres distintos, y eso lo
pagas tú en la síntesis.

## Fase 3 — Síntesis (tú)

Ahora sí lees los parciales, y **por sección transversal, no por repo**: abres los 14 parciales por
su bloque "Objetos de BD" y compones el inventario global; luego por su bloque "Flujo"; y así. El
esqueleto común es lo que hace esto posible.

En la síntesis tu trabajo real es:

- **Resolver contradicciones.** Dos parciales que discrepan es información: significa que el sistema
  tiene dos comportamientos o que uno de los dos leyó mal. Ve al código y decide; si no se puede
  decidir, va a "lo abierto" con las dos versiones.
- **Deduplicar.** El mismo endpoint documentado por el agente del front y el del back se escribe una
  vez, del lado del dueño.
- **Unificar vocabulario.** Si tres parciales llaman de tres formas a la misma cosa, elige el nombre
  del sistema y úsalo en todo el informe.
- **Recontar.** Los números del informe los cuentas tú sobre el inventario unido, no los copias de
  un acuse.
- **Juntar los huecos** de todos los parciales en una sola lista, y **separarla en dos**: los que son
  vacíos *del informe* (algo que no se pudo levantar y hay que declarar) y los que son hallazgos *del
  proyecto* (defectos, riesgos, deuda). Los primeros se declaran en el documento; los segundos **no
  entran en un informe de orientación**: se entregan aparte en la Fase 6, como insumo del tracker.

## Fase 5 — Verificación por un dev sin contexto

Cuando el informe está terminado (borrador o HTML ya maquetado), lanza el **verificador**:
`plantillas/verificacion.md`. Su perfil es deliberado: **un dev promedio, competente, que entra al
proyecto la semana que viene y no sabe nada.** No es un experto ni un adversario: es el lector real.

⚠️ **En el encargo va escrito el propósito del informe** (orientación o diagnóstico) y, si es de
orientación, la frase completa: *"este informe no lleva estado de avance, pendientes ni deuda; no los
pidas como hueco; los hallazgos del proyecto van en el bloque aparte"*. Sin eso el verificador pide un
diagnóstico —es lo natural cuando se le pregunta si le sirve— y el informe termina siendo una
auditoría. Ya pasó.

**Y mientras un verificador está leyendo el informe, no edites el informe.** Reúne la evidencia de las
correcciones y aplícalas todas de una pasada cuando entregue; si no, revisa un documento que se mueve
bajo sus pies.

Su tarea, con el informe y el repo en la mano:

1. **Seguir el flujo leyendo solo el informe** y decir dónde se perdió.
2. **Comprobar en el código** las afirmaciones concretas: existe ese SP, ese endpoint, ese estado.
3. **Anotar lo que no entendió** y lo que el informe da por sabido sin explicar.
4. **Levantar preguntas** — las que le haría a su líder el primer día.

Devuelve observaciones clasificadas, con severidad:

| Tipo | Significa | Qué haces |
|---|---|---|
| `ERROR` | El informe dice algo que el código contradice | Corregir siempre |
| `HUECO` | Falta algo necesario para entender o para operar | Completar, o declararlo como vacío |
| `CONFUSO` | Está pero no se entiende | Reescribir |
| `SOBRA` | Ruido, o detalle que no le sirve al lector | Recortar |
| `PREGUNTA` | No lo puede resolver el documento | Al usuario, no la contestes inventando |

Reglas de esta fase:

- El verificador **no participó en la redacción**. Si un levantador escribió una sección, no la
  verifica él.
- Si el informe es grande, reparte: un verificador por línea de flujo o por bloque de secciones.
- **Corriges lo que es real y respondes por escrito lo que descartas**, con el motivo. Un `ERROR`
  descartado sin explicación es una corrección que te vas a comer en la reunión.
- Máximo **2 rondas**. La segunda solo revisa lo corregido, no todo otra vez.
- Las `PREGUNTA` van al usuario en el cierre. No se contestan desde el informe.

---

## Reglas de encargo que evitan que el fan-out se caiga

Dos que hay que poner **en todos los encargos**, levantadores y verificadores:

1. **"Trabaja tú directamente: no lances subagentes ni tareas paralelas."** Un agente al que no se lo
   prohíbes delega, y sus hijos delegan: el consumo se multiplica sin control y la tanda muere a
   mitad por límite de sesión. El único que reparte eres tú.
2. **"No hagas búsquedas de archivos sobre el árbol completo."** En un monorepo con `node_modules`,
   `bin`, `obj` y `dist`, un glob amplio se cuelga. Exige acotar por repo y excluir esas carpetas.

**Si un agente muere por error de API o límite**, no lo relances desde cero: **reanúdalo con un
mensaje** pidiéndole que escriba su entregable con lo que ya comprobó y que marque como pregunta lo
que quedó a medias. Su transcripción conserva el trabajo; repetirlo lo paga el usuario dos veces. Y
lo que un agente caído dejó dicho antes de morir puede valer: en una corrida real, una frase
suelta de un verificador que nunca entregó destapó una afirmación imprecisa del propio informe.

## Presupuesto y honestidad del reparto

- Si recortas el alcance del barrido (repos que no leíste, capas que no cubriste, tandas que no
  lanzaste), **dilo en el informe**. Un documento que calla lo que no miró se lee como si lo hubiera
  cubierto todo.
- Si un levantador devuelve vacío o muere, **no rellenes su parte**: relánzalo con el alcance más
  estrecho, y si vuelve a fallar, declara el repo como no documentado.
- El usuario autoriza el uso de subagentes. Dile cuántos vas a lanzar y en qué tandas antes de
  empezar.
