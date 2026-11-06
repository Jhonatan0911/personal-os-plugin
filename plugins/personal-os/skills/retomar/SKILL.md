---
name: retomar
description: Reconstruye el contexto de cualquier proyecto al iniciar sesión leyendo el HANDOFF.md de la raíz (generado por el checkpoint), la memoria persistente si hay y git, y entrega un status con pendientes priorizados. En raíces multi-frente (donde existe handoff/_indice.json) primero muestra el índice de frentes y pregunta de qué se va a hablar; solo después lee el frente elegido. Úsalo cuando el usuario diga "retomemos", "retomar", "dame el status", "en qué quedamos" o al arrancar una sesión nueva en un proyecto.
---

# Retomar — reconstruir contexto

Objetivo: en una sola pasada, entender dónde quedó el proyecto actual y entregar un status accionable.
Solo LEE y reporta: no reescribas documentos ni programes hasta que el usuario confirme qué sigue
(escribir es trabajo del checkpoint).
Si el proyecto tiene su propia skill `retomar` local, esa tiene precedencia: esta es la general.

**Script del índice:** `node "<raíz del plugin>/scripts/handoff.js" <comando> --root <raíz>`.
La raíz del plugin aparece en el contexto de la sesión, en la línea **«Scripts del plugin:»** que inyecta
el hook de arranque.

## 0. Modo multi-frente (va primero)
Raíz = `git rev-parse --show-toplevel` si es repo; si no, el directorio de trabajo actual.
Si existe `<raíz>/handoff/_indice.json`:

1. **No leas ningún archivo de frente todavía** ni vuelques todos los temas.
   Corre `handoff.js list --root <raíz>`.
2. Si el mensaje del usuario **ya dice el tema** (una clave de issue, el nombre de un frente o un tema
   reconocible), corre `handoff.js match --root <raíz> "<su mensaje>"`; con un solo candidato claro, salta
   la pregunta y ve al paso 4.
3. Si no, muestra el índice **compacto**, agrupado por ámbito (Laboral, Personal…): una línea por frente
   con su título en lenguaje normal, la fecha de su última actualización y el siguiente paso. Los cerrados
   no se muestran salvo que los pida (`list --todos`). Lo vencido del vigía de compromisos, si lo hay en el
   contexto, puede ir en una línea aparte arriba.
   Luego **pregunta con la herramienta `AskUserQuestion`** «¿De qué vamos a hablar hoy?», con los 2-4
   frentes más recientes como opciones (el más reciente primero; el usuario escribe otro en «Other»).
   **Detente** hasta tener la respuesta: no leas ningún frente antes.
4. Con la respuesta, corre `match` sobre ella y **lee solo `<raíz>/handoff/<slug>.md`** del frente elegido
   (o de los 2-3 que nombre). Si no encaja con ninguno, dilo y propón crear el frente nuevo en el próximo
   checkpoint. Luego sigue con los pasos 2-6 de abajo aplicados a ese frente.
5. Si a mitad de la conversación el usuario cambia de tema a otro frente, vuelve a correr `match` y lee ese
   otro archivo antes de responder sobre él.

Si no existe `handoff/_indice.json`, es **modo simple**: sigue desde el paso 1.

## 1. Detectar la raíz y leer el handoff
- Lee **`HANDOFF.md`** en la raíz: es la fuente principal (estado, última sesión, gotchas, pendientes,
  cómo levantar y el siguiente paso sugerido).
- Si NO existe: dilo con claridad («no hay handoff; reconstruyo desde git y la documentación») y al final
  sugiere cerrar este tramo con el checkpoint para que exista la próxima vez.

## 2. Completar con el contexto del repo
Lee lo que exista (sin exhaustividad, es un arranque):
- `CLAUDE.md` de la raíz (convenciones y arquitectura).
- `README.md` si el proyecto es nuevo para ti en esta sesión.
- Si el proyecto lleva un backlog o un plan en archivos (`.planning/`, `docs/pendientes.md`…), revisa lo vigente.

## 3. Memoria persistente (si tienes una configurada)
- Si la sesión tiene una herramienta de memoria persistente, pide el resumen de las sesiones anteriores
  del proyecto.
- Busca algo puntual solo si el handoff lo menciona sin detalle (en multi-frente, con las etiquetas del frente).
- Si no hay, sigue sin ruido.

## 4. Estado de git (si es repo)
- `git log --oneline -10`, `git status --short` y la rama actual.
- Señala si el árbol está limpio o sucio, y si hay trabajo sin commitear que el handoff no menciona
  (eso significa que el último tramo cerró SIN checkpoint: adviértelo).

## 5. Servicios (solo si el handoff documenta cómo levantar)
- Verifica sin levantar nada: los puertos o health checks que indique el handoff.
- Ofrece levantarlos; no lo hagas sin que el usuario lo pida.

## 6. Entregar el status (en el chat)
Conciso y accionable:
- **Qué es** el proyecto o frente (1-2 líneas) y su **estado actual**.
- **Última sesión** (del handoff) + **último commit** (de git).
- **Gotchas vigentes** que afecten lo que se va a hacer hoy.
- **Pendientes priorizados** (alta/media/baja).
- **Siguiente paso sugerido** (el del handoff, o el tuyo si no hay).
- Cierra preguntando **en qué quiere continuar** con `AskUserQuestion` (2-4 opciones, la recomendada
  primero), no con una pregunta suelta en el texto.
