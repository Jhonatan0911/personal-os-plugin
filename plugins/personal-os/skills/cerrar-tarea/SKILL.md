---
name: cerrar-tarea
description: Cierra tareas, compromisos, riesgos o puntos de un alcance solo con evidencia objetiva de cierre, y lo deja escrito en su nota. Úsala cuando el usuario diga que algo ya está hecho, o cuando el brief encuentre evidencia de cierre.
---

# Skill: cerrar-tarea

Nunca das algo por cerrado solo porque el usuario lo afirme. Exiges evidencia.

## Pasos

1. **Localiza el objeto** en su nota de `<stateDir>`: `compromisos/*.md`, `riesgos/*.md`,
   `alcances/*.md` (si es un punto de un alcance) o la tarea dentro de `proyectos/*.md`.
2. **Pide evidencia de cierre** concreta según el tipo:
   - Código: PR integrado, commit o issue de Jira en un estado de hecho **real**.
   - Entregable: enlace o archivo.
   - Comunicación: correo enviado, mensaje o confirmación de la contraparte. Un correo enviado ES evidencia.
   - Decisión: registrada como nota en `decisiones/`.
   - Punto de un alcance: el `status` de su issue en Jira. **El comentario del desarrollador no es
     evidencia**, y un estado de `jira.estados_que_parecen_cerrados` («Redefinido» y similares) tampoco:
     se lista aparte con su nombre, no se cierra.
3. **Si NO hay evidencia:**
   - No cierres. Marca el estado real (`en_progreso` / `bloqueada`) y di qué falta.
   - Si el usuario insiste en cerrar sin evidencia, adviértelo y pídele que lo declare explícitamente;
     regístralo como **cierre sin evidencia** en la nota (`evidencia_cierre: "declarado por el usuario,
     sin evidencia"`).
4. **Si hay evidencia:**
   - Escribe `evidencia_cierre` (fecha + enlace, asunto o clave) en el frontmatter de la nota y cambia su
     `estado` a cerrado (`cerrada` / `cumplido`, según el tipo de nota).
   - Si estaba ligado a un riesgo, compromiso o alcance, revisa si eso también puede cerrarse. Un alcance
     solo se cierra (`estado: cumplido`) cuando **todos** sus puntos tienen evidencia.
5. **Regenera el tablero** si el cierre cambia la prioridad #1 o quita algo de «vencido».

> Regla de origen: el núcleo (`CORE.md`, principio «nunca cerrar sin evidencia»). Este archivo solo
> describe el CÓMO; no repite la regla ni su justificación.
