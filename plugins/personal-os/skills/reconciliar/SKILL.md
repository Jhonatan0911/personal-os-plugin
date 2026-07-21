---
name: reconciliar
description: Reconcilia el estado sembrado contra las fuentes en vivo (Jira/Outlook/Teams).
---

# Skill: reconciliar

Se ejecuta UNA vez, en el primer brief real dentro de Claude Code (o cuando el estado
sembrado deba contrastarse con las fuentes en vivo). Reconcilia el estado sembrado del PITS
contra Jira / Outlook / Teams. NO resuelve tickets; solo pone el estado en verdad.

## Regla de origen
El seed del PITS es base, no verdad operativa (ver `estado/decisiones.md` D-004 y el contexto
del primer brief). Jira gana en estado técnico; el PITS aporta contexto que Jira no tiene
(dependencias externas, notas de cliente, compromisos de comunicación).

## Procedimiento

Por cada ítem en `estado/proyectos/*.md`, `estado/riesgos.md` y `estado/compromisos.md`:

1. **Lee el estado real** en Jira (issue por código) y, si aplica, correos/Teams relacionados. Solo lectura.
2. Resuelve en uno de tres:
   - **Confirmar** — Jira coincide con el seed → mantener, marcar `reconciliado: 2026-..`.
   - **Actualizar** — Jira difiere → gana Jira; anota en el ítem qué cambió y la fecha.
   - **Cerrar** — hay evidencia objetiva de cierre → mover a historial con su `evidencia_cierre`.
3. **Riesgos y compromisos abiertos NO se cierran solo porque Jira esté "hecho".** Ejemplos:
   - `C-001 (MAI-10)`: se cierra solo con evidencia de que el correo de fecha de publicación se envió. Jira no lo sabe.
   - `C-004 (Atriles VIVACO-224)`: se cierra solo con la respuesta del cliente.
   - `R-002 (VM-23)`: sigue abierto hasta evidencia de que el 3.0 se estabilizó y llegaron los insumos del cliente.
4. **Detecta lo que el PITS no capturó**: correos sin responder, menciones en Teams, issues de Jira asignados a Jhonatan que no estén en el seed. Agrégalos como tareas/compromisos nuevos.
5. **Regenera `estado/tablero.md`** con el estado reconciliado y pide a Jhonatan que confirme la prioridad #1.

## Salida
Un resumen de: cuántos ítems se confirmaron / actualizaron / cerraron, qué entró nuevo, y qué
compromisos siguen `por_verificar` porque dependen de evidencia que solo Jhonatan tiene.
