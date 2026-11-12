---
name: regresion-guiada
description: Conduce en 10 fases la regresión de un sistema antes de publicarlo — confirma con cada persona sus proyectos y ramas (producción o la de la publicación), los clona, arma una base de conocimiento por proyecto, lee de staging la operación real de un periodo, levanta los proyectos en localhost contra staging con aislamiento de red (proxy-sumidero, relevo local de terceros, guardia), reproduce esa operación caso por caso con el mismo usuario, por API y por pantalla, agrupa los errores por causa, los revisa con el responsable y certifica la cobertura por inventario. Muestra el avance en una página local. Úsala cuando digan "/regresion-guiada", "arranca la regresión", "sigamos con la regresión", "regresión del grupo N", "reproduce la operación del mes contra staging" o "prueba post-publicación por pantalla". No es para certificar un solo requerimiento (certificar-funcional) ni para revisar un PR (revisar-pr).
argument-hint: "[grupo o persona]"
---

# regresion-guiada — demostrar que lo que se publica rehace la operación real

**Objetivo.** Demostrar que lo que se va a publicar puede **volver a hacer la operación real del periodo de
referencia** igual que producción. No se validan historias de usuario: se replica la operación. Lo que ya no
se pueda hacer se reporta con su causa; el responsable decide si es un cambio pedido o un defecto.

`references/reglamento.md` manda en seguridad, evidencias y Excel; esta skill, en el orden de trabajo.

## Seguridad (no admite excepciones)

- **Nunca producción.** Solo bases de staging con host confirmado en el modal; si un host podría ser de
  producción, alto.
- **Nada sale del equipo** salvo localhost y las conexiones de BD a staging: proxy-sumidero, relevo local y
  guardia (`references/aislamiento.md`). Sin aislamiento comprobado no se arranca nada.
- **Bases de datos:** la única vía es `staging.py`. Si `staging.lectura_autonoma` no es `true`, cada consulta se
  muestra antes (sentencia exacta + servidor + base) y espera el OK del responsable, como pide su política de
  bases de datos. Escribir solo dentro de `staging.escritura_hasta` (sin ventana, solo lectura); nunca DDL.
- **Nunca se imprime** una cadena de conexión, clave o token, ni un dato de paciente más allá de lo necesario
  (proyecciones, límites, seudónimos). Credenciales en `<mesa>/credenciales/` o variables `REGV_*`, nunca en un
  repo; se borran al cerrar.
- **Con OK, cada vez:** agregar un host de staging, push, PR, Jira, instalar software, firewall y borrado final.
  Nunca se envía un mensaje a una persona real.

## Configuración

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. La configuración es la sección
`regresion` de `<stateDir>/config/fuentes.yaml` (forma en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`). Lo propio
del cliente vive en `regresion.perfil_dir`: `asignaciones.json` (reparto), `grupos/grupo-N-*.md` (parámetros
del grupo), `instruccion-cliente.md` (complemento del reglamento: insumos, bases legadas, terceros, decisiones)
y plantillas propias. Si falta `sistema`, `slug`, `periodo` o `repos.organizacion`, pregúntalo en el modal una
vez y ofrece guardarlo. Sin perfil, usa las plantillas de `${CLAUDE_SKILL_DIR}/plantillas/`.

Los scripts se corren desde `${CLAUDE_SKILL_DIR}/scripts/` con `REGRESION_MESA=<mesa>`; leen
`<mesa>/kit/perfil.json`, que escribes en la fase 1 con la forma del final de `config-ejemplo.yaml`.

## Cómo se conduce

- **Muy guiada.** Al cerrar cada fase: «Fase N lista: <qué quedó>. Sigue la fase N+1: <qué va a pasar>». No
  saltes fases; si una se bloquea, dilo y no avances. Toda pregunta va en el modal, con 2-4 opciones y la
  recomendada primero.
- **Página en vivo.** Al arrancar, `node scripts/vista/servidor.js [puerto]` en segundo plano (puerto
  `regresion.vista_puerto`, 4747 por defecto) y dale el enlace. Actualiza con `node scripts/estado.js …` en
  cada cambio de fase, paso, proyecto o contador (`init --persona --grupo --issue --titulo`, `fase`, `paso`,
  `evento`, `proyecto`, `contador`, `ver`).
- **Retomar.** Si existe `<mesa>/.regresion/estado.json`, léelo con `PRIMER_CLAVO.md` y sigue desde la fase
  en curso. No repitas lo hecho.
- **Grupo que ya terminó por API antes de la publicación:** su corrida queda como línea base; después de
  publicar se hace solo la pasada por pantalla de la fase 7 (reusa `conocimiento/` y `golden/`) y las fases 8,
  9 y 9-bis sobre lo nuevo. Lo que falle se compara con su resultado por API y con el periodo para separar
  «cambio pedido», «defecto del front» y «defecto de la publicación». Si es contra staging desplegado, sigue
  `references/aislamiento.md` §8.

## Estructura de la mesa (se crea en la fase 1)

```
asignaciones.json   reparto del líder (del perfil o de plantillas/asignaciones.ejemplo.json)
credenciales/       conexiones.json, usuarios-prueba.json, contacto-pruebas.json — nunca a un repo, se borra al cerrar
kit/                perfil.json, hosts-permitidos.json, relevos.json, mirilla.json, sitios.json
repos/  docs/       proyectos clonados en su rama · clon del repo de documentación
conocimiento/<repo>/  base de conocimiento por proyecto (+ CONTRATOS.md, DEPENDENCIAS_EXTERNAS.*)
golden/             casos del periodo leídos de staging (entradas y resultado guardado)
ejecucion/          log.jsonl, pantallas.jsonl, capturas.jsonl, errores_agrupados.md
evidencias/         guardia/, relevo/, capturas/, cobertura/, <ID>/
entregables/        Matriz_Regresion_<slug>_G<N>.xlsx
.regresion/         estado.json, staging.log, dependencias.json
PRIMER_CLAVO.md  OBSERVACIONES.md
```

Agrega `credenciales/` y `.regresion/` al `.gitignore` de cualquier repo que esté dentro de la mesa.

## Fase 1 · Persona y proyectos

1. Lee la configuración y el perfil; escribe `kit/perfil.json`. Copia `asignaciones.json` del perfil a la mesa
   si no está. Muestra las `alertas` de la persona y los `pendientes_reparto` que la tocan.
2. Identifica a la persona por `git config user.email` o en el modal.
3. Muéstrale sus proyectos (aplicativo, repo, proyecto) y pregunta si la lista está completa, si agrega o quita.
4. `estado.js init`. **Compuerta:** la persona confirma la lista.

## Fase 2 · Ramas y clonado

1. Por proyecto, pregunta la rama: **producción** o, si sale con la publicación, **la de la publicación**.
   Guarda `rama_a_probar`.
2. Clona con la URL de `repos.url_plantilla` en `repos/<repo>` y haz checkout. Sin PAT: si Git pide
   autenticación, la persona entra con su cuenta (Git Credential Manager).
3. Registra el commit y cruza con las ramas adelante de main de los insumos: avisa si puede faltar código.
4. `estado.js proyecto --repo <r> --campo clonado --valor ok|error`. **Compuerta:** todo clonado o bloqueado con motivo.

## Fase 3 · Base de conocimiento por proyecto

Un agente por proyecto, en paralelo (`gsd-codebase-mapper` si existe; si no, `general-purpose`), escribe en
`conocimiento/<repo>/`: `FUNCIONAL.md` (cada operación paso a paso, qué ve el usuario y qué queda guardado),
`TECNICO.md` (arquitectura, endpoints, servicios, configuración), `DATOS.md` (tablas, SP, vistas y colecciones
por operación, con la **regla** de cada SP), `PERMISOS.md`, `INTEGRACIONES.md` y `REPRODUCIR.md` (cómo se
reconstruye cada operación del periodo: qué la registra, con qué campos, qué usuario y cómo se compara). Luego
un agente escribe `conocimiento/CONTRATOS.md`: cómo se conectan los proyectos de esta persona. Cada afirmación
lleva `archivo:línea` o SP; lo no confirmado, «inferido». Esta base es el especialista de la fase 9.

**3-bis · Dependencias externas (compuerta).** Un agente recorre todas las llamadas HTTP de los fronts y backs
del grupo y escribe `conocimiento/DEPENDENCIAS_EXTERNAS.md` y `.json`: qué proyectos fuera del grupo hacen
falta, quién los llama (repo, pantalla, elemento, endpoint, clave de config, `archivo:línea`, efecto si falta),
si es bloqueante o degradante, qué funciones del grupo habilita, dueño (del reparto) y rama sugeridos, puerto
local, claves a apuntar y de qué otros depende; recomienda «bajar» si bloquea un flujo que se prueba y «no
bajar» si solo habilita funciones fuera de alcance. Forma del `.json` (la leen `dependencias.js` y la página):
`{"items": [{"id", "api", "repo", "proyecto_azure", "organizacion"?, "impacto": "bloqueante|degradante",
"funciones": [], "llamadores": [{"repo", "pantalla", "elemento", "endpoint", "efecto_si_falta"}], "depende_de": [],
"dueno_sugerido", "rama_sugerida", "recomendacion": "bajar|no_bajar", "motivo_recomendacion"}]}`.
1. `node scripts/dependencias.js importar` arma `.regresion/dependencias.json` (ramas reales con `git ls-remote`,
   conserva decisiones).
2. El responsable decide fila por fila en la página: **Bajar** (con rama) o **No bajar** (sale de las pruebas),
   y puede corregir dueño, proyecto y rama. Si prefiere el modal, escribe su decisión con un POST a
   `/dependencias` de la página (`{id, accion: bajar|no_bajar, dueno, proyecto_azure, rama, nota}`).
3. `node scripts/dependencias.js exigir` tiene que salir 0; sin eso no hay fase 4.
4. Lo que se baja se clona en solo lectura, entra a la base de conocimiento (sus 6 archivos) y al arranque de la
   fase 6; nunca se llama el desplegado. Lo que no, va a `PRIMER_CLAVO.md` como exclusión (motivo, funciones que
   no se prueban, quién lo autorizó) y sus casos quedan «no probado (dependencia externa)», sin contar como aprobados.
5. Repite agente + `importar` cuando en las fases 6-7 aparezca un combo vacío o una conexión rechazada.

**Compuerta:** 6 archivos por proyecto, `CONTRATOS.md` y `dependencias.js exigir` en 0.

## Fase 4 · Documentación funcional

Si hay `repos.docs`: clónalo en `docs/`, crea la rama `docs/regresion-<slug>-<persona>`, actualiza o crea la
guía de cada proyecto con el estilo del repo y haz commit. Push y PR con OK. Las capturas llegan en la fase 10.

## Fase 5 · Credenciales y conexión a staging

1. Credenciales: `REGV_STAGING_SQL`/`REGV_STAGING_MONGO` (mandan) o `credenciales/conexiones.json` (forma en
   `plantillas/credenciales.ejemplo.json`). Nunca imprimas su contenido.
2. Copia `plantillas/hosts-permitidos.json` a `kit/`. Saca de las cadenas **solo host, puerto y base** y pide en
   el modal que confirme que cada host es de staging.
3. Arranca el **proxy-sumidero** y haz la prueba de salida (`references/aislamiento.md` §2).
4. `python -I scripts/staging.py verificar` (hosts en la lista, ventana de escritura); lectura mínima
   (`sql-leer --sql "SELECT TOP 1 name FROM sys.tables"`) y `sys.servers` para los servidores vinculados.
5. Guardia: `node scripts/guardia.js` en verde, más el agente revisor de apuntamientos (§3).
6. Con `DATOS.md` y `REPRODUCIR.md` arma las consultas del periodo y su contexto; córrelas con `staging.py
   sql-leer` / `mongo-leer --salida golden/<flujo>.jsonl` (con OK por consulta si la lectura no es autónoma).
7. Registra en `PRIMER_CLAVO.md` qué se leyó, cuántas filas y de qué rango.

`staging.py` bloquea siempre DDL, administración, UPDATE/DELETE sin WHERE y, en Mongo, drop y filtros vacíos.
La escritura directa es solo para preparar o limpiar datos de prueba; la reproducción va por las APIs. Si
falta el driver (`pyodbc` o `python-tds`), instalarlo pide OK.

**Compuerta:** hosts confirmados, sumidero con prueba de salida, `verificar` en orden, lectura mínima OK,
servidores vinculados revisados, guardia en verde y `golden/` con el periodo.

## Fase 6 · Integración y arranque local

1. Con `CONTRATOS.md`, decide qué proyectos corren juntos y en qué puertos.
2. Cada proyecto en localhost, en su rama, contra las bases de staging y los demás por localhost, en
   configuración **local** que no se commitea (`appsettings.Development.json`, `environment.ts`, variables).
3. Terceros al **relevo local** y tráfico por la **mirilla** (`references/aislamiento.md` §5-6).
4. Sin el proxy, baja paquetes (`dotnet restore`, `npm ci` con el `ng` local); compila; arranca sumidero y
   guardia; con los dos en verde arranca todo con `HTTP_PROXY`/`HTTPS_PROXY` y prueba que cada servicio
   responde. `estado.js proyecto --campo arranca`.

**Compuerta:** proyectos arriba contra staging, relevo, mirilla y sumidero arriba, guardia en verde.

## Fase 7 · Reproducir la operación del periodo

1. Ordena las operaciones de `golden/<flujo>.jsonl` en orden cronológico con su usuario.
   `estado.js contador --nombre casos_total --valor N`.
2. **Entrar como el mismo usuario sin conocer ni cambiar su clave:** con la base de conocimiento del servicio de
   autenticación (`regresion.auth`; si el grupo no lo tiene, se baja en solo lectura y se levanta en local) se
   genera un token por usuario original. Nunca se reinician claves ni se tocan usuarios para entrar; los tokens
   no se imprimen ni se guardan en evidencias.
3. Reproduce **una por una**, por la misma vía (API del proyecto en localhost), como el mismo usuario. Antes de
   la primera escritura de la sesión: guardia en verde y sumidero verificado.
4. Después de cada caso, lee lo que quedó en staging y compáralo con el periodo (sin IDs, consecutivos, fechas
   de creación ni tokens). Lo que no se pueda replicar se registra y se sigue: los choques esperables también.
5. Cada caso a `ejecucion/log.jsonl`: `{id, flujo, fecha_original, usuario, entrada_ref, resultado:
   ok|error|diferente, mensaje, sp, regla, diferencias, integraciones: [{servicio, status}]}`. Actualiza
   `casos_ok` y `casos_error`.
6. **Pasada por pantalla con Playwright — obligatoria** (`references/pantallas.md`): mapa `PANTALLAS.md`,
   scripts sobre las plantillas, capturas enmascaradas. Copia la plantilla del Excel a
   `entregables/Matriz_Regresion_<slug>_G<N>.xlsx` al arrancar esta fase y llénala a medida que avanzas.

**Compuerta:** `ejecucion/pantallas.jsonl` con al menos una entrada por pantalla del inventario (o su exclusión).

## Fase 8 · Errores agrupados por causa

Agrupa `log.jsonl` por causa (mismo mensaje, SP y regla) y escribe `ejecucion/errores_agrupados.md`, de la más
frecuente a la menos: cuántos casos y ejemplos seudonimizados, qué regla del SP o del código lo produce (desde
`DATOS.md`) y si es un choque esperable porque staging ya tenía el periodo. `estado.js contador --nombre causas`.

## Fase 9 · Revisión con el responsable

Una causa por vez, en el modal: muéstrala con sus números y su explicación; si pregunta «¿por qué?», responde
desde `conocimiento/` y staging con la evidencia; que la clasifique: **choque esperable** · **cambio pedido** ·
**defecto** · **dato de la operación** · **por revisar**. Los defectos van como borrador a la hoja 05; en Jira
solo con el OK del líder. `estado.js contador --nombre revisadas --sumar 1`.

## Fase 9-bis · Cobertura por inventario (compuerta del cierre)

Sigue `references/cobertura.md`: inventario desde el código por repo, cruce con la evidencia, agente barredor
final y cobertura reportada en dos niveles. Bloquea la fase 10.

## Fase 10 · Matriz reutilizable y cierre

1. Deja `golden/` y `ejecucion/reproducir.md` con el comando para repetir los mismos casos contra otra rama.
2. Excel completo: una fila por caso (hoja 01), defectos (05), veredicto por sitio (08); no borres fórmulas.
   Escríbelo con lo que tenga el equipo (openpyxl, una skill de xlsx o el propio Excel).
3. Capturas revisadas a docs y a la matriz (`references/pantallas.md` §3).
4. Resume en `PRIMER_CLAVO.md` y en el chat: casos, causas, defectos y riesgos.
5. **Borrado con constancia** (con OK): `credenciales/`, variables `REGV_*`, `golden/` si tiene datos de
   pacientes, capturas no enmascaradas o no revisadas y la tabla de seudónimos; detén el sumidero, quita
   `HTTP_PROXY`/`HTTPS_PROXY` y, si se usó, el firewall (`candado-red.ps1 -Quitar`). Deja en la issue del grupo
   fecha, hora, equipo y qué se borró. La base de conocimiento y la matriz sin datos de pacientes se conservan.

## Cuándo NO usarla

- Certificar un requerimiento contra sus criterios de aceptación → `certificar-funcional`.
- Revisar el código de un PR → `revisar-pr`. Planear o estimar la regresión → `planear-sprint`.
- Consultas sueltas a una base sin regresión de por medio: usa el wrapper de lectura del proyecto.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/reglamento.md` | Al arrancar: autonomía, golden master, matriz, Excel, clasificación y cierre |
| `references/aislamiento.md` | Fases 5-6 y post-publicación: sumidero, agente revisor, firewall, relevo, mirilla, staging desplegado |
| `references/pantallas.md` | Fase 7 (Playwright) y fase 10 (capturas) |
| `references/cobertura.md` | Fase 9-bis |
| `config-ejemplo.yaml` | Si falta configuración |
| `scripts/estado.js`, `scripts/vista/servidor.js` | Página en vivo (se ejecutan) |
| `scripts/dependencias.js` | Fase 3-bis: `importar`, `estado`, `exigir` |
| `scripts/staging.py` | Única vía a las bases: `verificar`, `sql-leer`, `sql-escribir`, `mongo-leer`, `mongo-escribir` |
| `scripts/sumidero-proxy.js`, `scripts/guardia.js`, `scripts/candado-red.ps1` | Aislamiento (fase 5) |
| `scripts/relevo.js`, `scripts/mirilla.js` | Terceros y tráfico en vivo (fase 6) |
| `plantillas/` | `asignaciones.ejemplo.json`, `grupo-ejemplo.md`, `credenciales.ejemplo.json`, `contacto-pruebas.ejemplo.json`, `hosts-permitidos.json`, `relevos.json`, `mirilla.json`, `sitios.json`, `playwright/`, `Matriz_Regresion_plantilla.xlsx` |
