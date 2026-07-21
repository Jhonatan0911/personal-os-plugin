---
description: Pausa el Personal OS en todas las sesiones (doble confirmación)
---

El usuario quiere PAUSAR el Personal OS (se apaga su red de seguridad: alertas de riesgos, vencidos y prioridad #1). Procede con DOBLE confirmación:

1. Pregunta con **AskUserQuestion**: "¿Seguro que quieres pausar el Personal OS en TODAS tus sesiones?" — "Sí, continuar" / "No, cancelar". Si cancela, detente.
2. Si dijo sí, nombra el riesgo (dejarás de recibir recordatorios de compromisos y vencidos) y pregunta UNA SEGUNDA VEZ con **AskUserQuestion**: "Confirmación final: ¿pausar hasta que uses /os-on?" — "Sí, pausar" / "No". Si cancela, detente.
3. Solo tras las DOS confirmaciones, escribe exactamente `paused` (una palabra, sin comillas ni salto) en `~/.claude/personal-os/state.flag` (crea la carpeta si no existe).
4. Confirma: "🔕 Personal OS PAUSADO. Reactívalo con /os-on. Aplica desde la próxima sesión."
