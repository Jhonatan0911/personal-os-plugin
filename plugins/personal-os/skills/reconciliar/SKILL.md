---
name: reconciliar
description: Reconcilia el estado sembrado del Personal OS (notas de riesgos, compromisos, alcances y proyectos) contra las fuentes en vivo (Jira, Outlook, Teams y tareas externas). Úsala una vez en el primer brief real o cuando el estado deba contrastarse de nuevo con las fuentes.
---

# Skill: reconciliar

Se ejecuta UNA vez, en el primer brief real dentro de Claude Code (o cuando el estado sembrado deba
contrastarse otra vez con las fuentes en vivo). Pone el estado en verdad contra Jira, Outlook, Teams y las
`tareas_externas` de `config/fuentes.yaml`. **NO resuelve tickets**: solo corrige el estado local.

## Regla de origen
Lo sembrado (lo que el usuario cargó en `/os-setup` o importó de una hoja de seguimiento) es base, no
verdad operativa. **Jira gana en estado técnico**; las fuentes externas aportan contexto que Jira no tiene
(dependencias externas, notas del cliente, compromisos de comunicación).

## Dónde está el estado
Notas-objeto con frontmatter YAML en `<stateDir>`: `riesgos/*.md`, `compromisos/*.md`, `decisiones/*.md`,
`alcances/*.md` y `proyectos/*.md`. Una nota por objeto; no hay archivos únicos de riesgos o compromisos.

## Procedimiento
Por cada nota abierta de `riesgos/`, `compromisos/`, `alcances/` y cada `proyectos/*.md` activo:

1. **Lee el estado real** en Jira (issue **por su clave**, nunca por título) y, si aplica, los correos o
   mensajes de Teams relacionados. Solo lectura; para volumen, delega en los agentes `brief-jira`,
   `brief-outlook` y `brief-teams`.
2. Resuelve en uno de tres:
   - **Confirmar**: la fuente coincide con lo sembrado → se mantiene y se escribe `reconciliado: AAAA-MM-DD`
     en el frontmatter.
   - **Actualizar**: la fuente difiere → gana la fuente; anota en la nota qué cambió y la fecha.
   - **Cerrar**: hay evidencia objetiva de cierre → `estado` cerrado y `evidencia_cierre` (skill
     `cerrar-tarea`).
3. **Riesgos y compromisos abiertos NO se cierran solo porque Jira diga «hecho».** Ejemplos genéricos:
   - un compromiso de «enviar la fecha de publicación al cliente» se cierra con el correo enviado, no con
     la issue resuelta: Jira no lo sabe;
   - un compromiso que espera la respuesta del cliente se cierra con esa respuesta;
   - un riesgo de inestabilidad sigue abierto hasta tener evidencia de que se estabilizó.
   Y un estado de `jira.estados_que_parecen_cerrados` («Redefinido» y similares) **nunca** es un cierre.
4. **Alcances**: si una nota de `alcances/` no tiene `fuente:` declarada o nunca se cruzó, cruzarla punto
   por punto como indica la skill `brief-diario` (paso 3) y escribir `verificado_el` y los contadores.
5. **Detecta lo que lo sembrado no capturó**: correos sin responder, menciones en Teams, issues asignadas
   al usuario que no estén en ninguna nota, compromisos con fecha sin nota de alcance. Créales su nota
   (riesgo, compromiso o alcance).
6. **Regenera `<stateDir>/tablero.md`** con el estado reconciliado y pide al usuario que confirme la
   prioridad #1 con `AskUserQuestion`.

## Salida
Un resumen de cuántas notas se confirmaron, actualizaron y cerraron, qué entró nuevo, y qué compromisos
siguen `por_verificar` porque dependen de evidencia que solo tiene el usuario.
