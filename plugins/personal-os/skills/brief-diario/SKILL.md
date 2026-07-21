---
name: brief-diario
description: Genera el brief operativo del día: lee el estado y lo cruza con Jira/Outlook/Teams.
---

# Skill: brief-diario

Genera el resumen operativo del día. Se ejecuta cuando Jhonatan lo pide ("brief", "arranquemos el día")
o al inicio de una sesión si no ha habido brief hoy.

## Pasos

1. **Lee el estado actual**: `estado/tablero.md`, `estado/riesgos.md`, `estado/compromisos.md`
   y los `estado/proyectos/*.md` activos.
2. **Actualiza con fuentes** (solo lectura): revisa en Jira los issues asignados a Jhonatan y sus
   vencimientos; revisa Outlook (correos sin responder / reuniones de hoy) y Teams (menciones pendientes).
   Recuerda: leer es libre; cualquier escritura en esos sistemas se confirma aparte.
3. **Cruza y detecta**:
   - Riesgos abiertos → sube nivel de escalamiento si reaparecen sin atención desde el último brief.
   - Tareas vencidas o que vencen hoy.
   - Compromisos esperando respuesta.
   - Conflictos de prioridad (nunca aceptar dos "#1").
4. **Entrega el brief** (conciso, ejecutivo):
   - Prioridad #1 vigente.
   - Riesgos abiertos con su nivel y una mitigación propuesta por cada uno.
   - Vencido / vence hoy.
   - Compromisos pendientes de respuesta.
   - Foco recomendado para el día — pero la decisión es de Jhonatan.
5. **Cierra el loop**: pregunta (modal, máx. 4 opciones) qué prioriza hoy. Registra su elección.
6. **Regenera `estado/tablero.md`** con el estado resultante y la fecha de hoy, **y luego `estado/tablero.html`** (la vista visual; procedimiento en `skills/tablero-diario.md`).

## Reglas
- No inventes datos que no leíste. Si una fuente no respondió, dilo.
- No cierres nada por tu cuenta. Solo Jhonatan cierra, y con evidencia (ver `cerrar-tarea.md`).
- Si el tiempo no alcanza para los compromisos del día, dilo y propón comunicar el riesgo.
