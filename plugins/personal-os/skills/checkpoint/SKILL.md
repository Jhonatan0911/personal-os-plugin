---
name: checkpoint
description: Cierra un tramo de trabajo en cualquier proyecto dejándolo retomable. En un proyecto normal genera o actualiza HANDOFF.md en la raíz; en una raíz multi-frente (donde existe handoff/_indice.json) clasifica la conversación en su frente, escribe solo handoff/<frente>.md y actualiza su fila del índice HANDOFF.md con candado, para que varias pestañas no se pisen. Guarda en memoria persistente si hay, verifica que compile y deja commit si es repo git. Úsalo cuando el usuario diga "checkpoint", "guarda el avance", "deja un punto de control" o vaya a cerrar la sesión con trabajo hecho.
---

# Checkpoint — cierre de tramo

Objetivo: dejar el proyecto actual en un estado consistente y retomable por la skill `retomar` en la
próxima sesión. Funciona en cualquier raíz de proyecto.
Si el proyecto tiene su propia skill `checkpoint` local, esa tiene precedencia: esta es la general.

**Script del índice:** `node "<raíz del plugin>/scripts/handoff.js" <comando> --root <raíz>`.
La raíz del plugin aparece en el contexto de la sesión, en la línea **«Scripts del plugin:»** que inyecta
el hook de arranque. Comandos: `init`, `list`, `match`, `set`, `render` (detalle en la cabecera del script).

## 1. Detectar la raíz y el modo
- Raíz = `git rev-parse --show-toplevel` si es repo; si no, el directorio de trabajo actual.
- **Modo multi-frente** si existe `<raíz>/handoff/_indice.json`: ahí varias pestañas trabajan temas
  distintos a la vez. Sigue la **sección 3-bis** en lugar de la 3.
- Si no existe, **modo simple**: un solo `HANDOFF.md` en la raíz (sección 3).
- Una carpeta que no es un proyecto (tu home, tu carpeta de estado del Personal OS) suele servir mejor
  como raíz multi-frente. Para convertirla: `handoff.js init --root <raíz>`. No lo hagas por tu cuenta en
  un repo de código: propónlo y que el usuario decida.

## 2. Resumen de la sesión
- `git status --short`, `git diff --stat` y `git log --oneline` de los commits del tramo (si es repo).
- Si no es repo: lista los archivos creados o modificados en la sesión.
- Resume en 3-8 puntos: qué se hizo, decisiones clave y **gotchas** nuevos (el porqué, no solo el qué).

## 3. Modo simple — generar/actualizar `HANDOFF.md` en la raíz
Es una ACTUALIZACIÓN, no una reescritura: conserva las notas previas útiles y mueve lo viejo al
historial si estorba. Plantilla (créala si no existe):

```markdown
# HANDOFF — <nombre del proyecto>
> Memoria de sesión. La genera el checkpoint y la lee retomar. Actualizado: AAAA-MM-DD HH:MM

## Estado actual
(2-4 líneas: qué funciona, en qué fase va)

## Última sesión — AAAA-MM-DD
(qué se hizo en este tramo, en viñetas)

## Decisiones y gotchas
(acumulativo; cada entrada con fecha. Lo que a tu yo futuro le dolería no saber)

## Pendientes priorizados
1. (alta) ...
2. (media) ...

## Cómo levantar
(comandos exactos para correr el proyecto: build, serve, contenedores, etc.)

## Siguiente paso sugerido
(UNA cosa concreta por la que arrancar la próxima sesión)
```

## 3-bis. Modo multi-frente (en lugar de la sección 3)
**`HANDOFF.md` de la raíz es solo el índice y lo genera el script: nunca lo edites con Edit ni Write.**

1. **Clasificar la conversación.** Junta las claves de issue y los temas de ESTA conversación y corre
   `handoff.js match --root <raíz> "<claves y temas>"`, más `handoff.js list --root <raíz>` para ver todos
   los frentes. Decide tú, sin preguntar:
   - Coincide con un frente → ese. Si la conversación tocó **varios frentes**, actualiza cada uno con lo suyo.
   - Ninguno encaja → **frente nuevo**: slug kebab-case corto (con la clave principal si la hay, p. ej.
     `proy-142-login`), título legible y `--ambito laboral` o `personal` (u otra palabra si el usuario
     organiza sus frentes de otra forma). Solo si de verdad no se sabe el ámbito, pregúntalo.
   - Algo muy chico que no merece frente propio va al más cercano (o a un frente `general`).
2. **Escribir el archivo del frente** `<raíz>/handoff/<slug>.md`: léelo justo antes (otra pestaña pudo
   tocarlo) y edítalo con Edit por secciones; Write solo si es nuevo. Misma plantilla de la sección 3, con
   cabecera `# HANDOFF · <título>` y `> Frente <slug> · <ámbito> · Actualizado: AAAA-MM-DD`.
   La sesión va en `## Últimas sesiones` como `### AAAA-MM-DD — <tema>`; **solo se conservan las 2 más
   recientes**: la tercera se mueve al final de `<raíz>/handoff/historial/<slug>.md`. Si un pendiente
   pertenece a otro frente, escríbelo en ese otro archivo, no aquí.
3. **Actualizar el índice** (una llamada por frente tocado):
   `handoff.js set --root <raíz> --slug <slug> --estado "<1 línea>" --siguiente "<1 línea>" --etiquetas "<claves nuevas, separadas por coma>"`
   (+ `--titulo` y `--ambito` si es nuevo; `--cerrado AAAA-MM-DD` si el frente terminó, `--abierto` para
   reabrirlo). Agrega como etiqueta toda clave de issue nueva que aparezca, para que el próximo `match`
   lo encuentre. El script usa candado y escritura atómica; si avisa de cambios ajenos en `HANDOFF.md`,
   pásalos al frente que corresponda desde `handoff/_entrada/` y borra ese archivo.
4. En el reporte final di **a qué frente(s) fue** y si creaste uno nuevo.

Gotcha: en los textos de `--estado` y `--siguiente` no escribas nombres de comando con barra inicial
(`/checkpoint`, `/retomar`): algunos guardianes de shell los toman por rutas del sistema y bloquean la
llamada. Escribe «el checkpoint», «retomar».

## Reglas de los archivos de handoff
- **Nunca** incluyas secretos, credenciales, tokens ni datos personales de terceros (clientes, pacientes…).
- Si el repo es **público**, mantén el contenido apto para ojos externos, o agrega `HANDOFF.md` y
  `handoff/` al `.gitignore` y dilo en el reporte.

## 4. Memoria persistente (si tienes una configurada)
- Si la sesión tiene una herramienta de memoria persistente, guarda cada decisión, arreglo o
  descubrimiento relevante (con el porqué) y un resumen de la sesión: objetivo, logrado, pendientes.
- Si no hay, sáltalo sin ruido: el handoff es la fuente mínima.

## 5. Verificar que compila (si hubo cambios de código)
Usa el chequeo más barato que dé señal real:
- Node/TypeScript: `npx tsc --noEmit` (o el `typecheck`/`build` del package.json).
- Angular: `npx ng build` · .NET: `dotnet build` · otro: el build o test que documente el repo.
- No dejes commit con errores de compilación: arréglalos o repórtalos como pendiente explícito.

## 6. Commit (+ push si hay remoto)
Solo si es repo git **y el usuario no ha pedido lo contrario**:
- Sigue las convenciones del repo (mira `git log` para el estilo).
- Cierra el mensaje con la línea de coautoría que exija tu entorno.
- `git add -A`, commit y `git push` si hay remoto configurado. Reporta hash y resumen de una línea.
- Si NO es repo git, dilo y sugiere `git init` (sin hacerlo por tu cuenta).

## 7. Reporte final
En el chat: commit(s), handoff o frente(s) actualizados (ruta), memoria guardada, qué quedó pendiente y el
**siguiente paso sugerido**: lo mismo que verá retomar.
