---
name: cerrar-tarea
description: Cierra tareas solo con evidencia objetiva de cierre.
---

# Skill: cerrar-tarea

Nunca das una tarea por cerrada solo porque Jhonatan lo afirme. Exiges evidencia.

## Pasos

1. Localiza la tarea en su `estado/proyectos/*.md`.
2. Pide **evidencia de cierre** concreta según el tipo de tarea:
   - Código: PR mergeado / commit / issue de Jira en estado hecho.
   - Entregable: enlace o archivo.
   - Comunicación: correo enviado / mensaje / confirmación de la contraparte.
   - Decisión: registrada en `estado/decisiones.md`.
3. Si NO hay evidencia:
   - No cierres. Marca el estado real (`en_progreso` / `bloqueada`) y di qué falta.
   - Si Jhonatan insiste en cerrar sin evidencia, adviértelo y pídele que lo declare
     explícitamente; regístralo como cierre sin evidencia en la nota de la tarea.
4. Si hay evidencia:
   - Escribe `evidencia_cierre` en la tarea, cambia estado a `cerrada`.
   - Si la tarea estaba ligada a un riesgo o compromiso, revisa si eso también puede cerrarse.
5. Regenera el tablero si el cierre cambia la prioridad #1 o quita algo del "vencido".

> Regla de origen: `CLAUDE.md` §3 (principio: nunca cerrar sin evidencia) y §8. Este archivo
> solo describe el CÓMO; no repite la regla ni su justificación.
