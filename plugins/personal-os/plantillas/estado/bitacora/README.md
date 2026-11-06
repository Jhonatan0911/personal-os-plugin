# Bitácora — memoria reciente

Un diario por día: `AAAA-MM-DD.md`. Lo escriben:
- el hook `prompt-logger.js`: `## HH:MM` + `- **Tú:** <prompt>` en cada mensaje;
- el asistente al cerrar el turno, con `bitacora-append.js`:
  - `- **OS:** <resumen de 1-2 líneas>`
  - `- **TS:** HH:MM-HH:MM | PROY-123 | Categoría | Cliente | est=4h | qué se hizo | evidencia`
    (una línea por tramo laboral; alimenta la skill `timesheet`).

`bitacora-rotate.js` borra los diarios más viejos que `config.json → bitacora.retencionDias`.
Es privada: no se publica ni se versiona en un repo público.
