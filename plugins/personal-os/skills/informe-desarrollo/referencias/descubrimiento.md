# Fase 1 — Cómo cazar la evidencia

## Índice
- 0. Antes de nada: los documentos del proyecto
- 1. Delimitar el software del alcance
- 2. Seguir una operación completa
- 3. Inventario de base de datos
- 4. Actores, perfiles y quién dispara qué
- 5. Estado real, no estado deseado
- 6. Lo abierto
- Cierre de la fase

El objetivo no es leer todo el repo: es poder sostener cada frase del informe. Trabaja de lo
concreto a lo general — **una operación completa de punta a punta primero**, y solo después
generaliza al resto.

---

## 0. Antes de nada: los documentos del proyecto

Suele haber meses de contexto ya escrito. Míralo antes de leer código:

- `HANDOFF.md` en la raíz (lo genera `/checkpoint`): estado real, lo que quedó sin desplegar, los
  gotchas, y con frecuencia el detalle de "se probó con la cita X".
- `docs/`, `CONTRATOS/`, `README.md`, `MESA.json`, `docs/codebase/`.
- La bitácora del Personal OS (`estado/bitacora/YYYY-MM-DD.md`) y `estado/` para riesgos y
  compromisos abiertos.
- Las issues de Jira del alcance: el requerimiento original dice **quién lo pidió y por qué**, que
  es exactamente lo que el informe necesita en la portada y en la sección 1.
- El historial de git del módulo: `git log --oneline -- <ruta>` cuenta qué se hizo y cuándo.

Lo que salga de aquí es evidencia de primera: es lo que el equipo mismo escribió sobre su trabajo.

## 1. Delimitar el software del alcance

**`fetch` de todos los repos antes de leer una sola línea.** Es la primera acción, siempre. Después
mira `rev-list --left-right --count HEAD...@{upstream}` en cada uno: lo que esté detrás significa que
alguien subió trabajo que **ningún documento del proyecto recoge todavía** — y los commits entrantes
dicen exactamente qué es y qué documento quedó mintiendo. Actualizar la rama lo decide el usuario, no
tú; si el árbol tiene configuración local modificada (`appsettings`, `environment`, `web.config`
apuntados a TEST), respáldala antes de mover nada, porque un `merge` la pisa.

Al reportar el estado de los remotes, **no pegues la salida de `git remote -v`**: puede traer el
token de acceso embebido en la URL.

- Qué repos participan y cuál es la capa de cada uno (front, API, servicio, BD, job).
- En qué rama está la verdad. En una mesa de trabajo multi-repo suele haber una rama de trabajo compartida; el
  informe describe **esa** rama, y lo dice si importa.
- Qué carpetas del repo son del alcance. Un repo grande puede aportar solo un módulo.

## 2. Seguir una operación completa

Elige la operación más representativa y recórrela entera, anotando nombres reales:

1. **Front**: la pantalla o el disparador. Componente, ruta, formulario, validaciones que hace.
2. **Cliente HTTP**: qué endpoint llama, con qué forma de datos.
3. **API**: controlador → servicio → acceso a datos. Qué valida cada uno, qué transforma.
4. **BD**: qué SP se ejecuta, qué tablas toca, qué devuelve.
5. **Vuelta**: qué ve el usuario al final, y qué pasa cuando falla.

Ese recorrido es el esqueleto de la sección de flujo y del diagrama de carriles. Repítelo, más
rápido, para las demás operaciones.

## 3. Inventario de base de datos

Preferencia por orden: **scripts del repo → contexto de datos / capa de acceso → BD de test**.

Búsquedas útiles (ajusta a la tecnología del proyecto):

- SP invocados desde el código: buscar `CommandType.StoredProcedure`, `EXEC `, `sp_executesql`, o
  el nombre del helper de acceso a datos del proyecto.
- Nombres de SP y tablas: buscar los prefijos del proyecto (`Fac_`, `Agd_`, `Alm_`, `Par_`, `Seg_`).
- Scripts de publicación y reversión: `*.sql` en `scripts/`, `db/`, `publicacion*`, `rollback*`.
- Definición de tablas y relaciones: migraciones, `DbContext`, `OnModelCreating`, `[Table(`.
- **Triggers, vistas, funciones, tipos tabla, jobs**: búscalos aparte y explícitamente
  (`CREATE TRIGGER`, `CREATE VIEW`, `CREATE FUNCTION`, `CREATE TYPE`, agente/scheduler). Son los que
  más se olvidan y los que más sorpresas causan.

**Si hace falta ir a la base de datos**: solo TEST, solo lectura, por el wrapper del proyecto
(p. ej. `scripts/dbread.ps1`), y **con OK explícito del usuario para cada consulta**, diciéndole
antes el script exacto y el servidor + base contra la que corre. Cada ejecución lleva su propio OK,
aunque ya hayas corrido una igual. Nunca imprimir cadenas de conexión ni datos de personas.

## 4. Actores, perfiles y quién dispara qué

- Actores humanos: búscalos en los roles del sistema, en los menús por perfil, y en el lenguaje del
  requerimiento ("el auxiliar de toma de muestras...").
- Sistemas que participan: cada host, cola, servicio o base distinta que aparece en configuración.
- Distingue **quién inicia** una acción de **quién la ejecuta**: en el diagrama de carriles esa
  diferencia es toda la información.

## 5. Estado real, no estado deseado

Para cada componente responde con evidencia: ¿está escrito? ¿está publicado? ¿se probó? ¿con qué
caso? ¿los datos de la prueba eran reales o suplantados?

Señales de que un "listo" no es listo:
- Código en la rama pero sin registro de despliegue.
- Pruebas hechas con un dato sustituto (ya pasó: consentimiento firmado con un PDF
  suplantado — la plomería quedó validada, el contenido no).
- Un flag o columna que nadie escribe.
- Un TODO, un `throw new NotImplementedException`, un endpoint comentado.

## 6. Lo abierto

Riesgos, decisiones pendientes, correos sin enviar, dudas sin responder, parametrización
sospechosa. Con dueño cuando se sepa. Esta lista es la mitad del valor del informe para quien lo
pidió: es lo que necesita decidir.

---

## Cierre de la fase

Antes de pasar a la Fase 2 deberías tener, por escrito: repos y capas, una tabla de operaciones con
su recorrido, el inventario de objetos de BD agrupado, la lista de actores y perfiles, el estado
componente por componente con su prueba, y la lista de vacíos. Si algo de eso está en blanco, no lo
inventes en la redacción — decláralo en la Fase 2 como sección omitida por falta de evidencia.
