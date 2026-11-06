# Decisiones — una nota por decisión (append-only)

Las decisiones no se reescriben: si una cambia, se agrega una nota nueva que la reemplaza
(`reemplaza: D-003`). Así queda el porqué de cada cambio de rumbo. Los archivos que empiezan por `_`
son plantillas.

```yaml
---
id: D-001
titulo: Priorizar la entrega al Cliente A sobre el refactor interno
fecha: 2026-12-01
decidio: "<quién>"
contexto: Dos frentes compiten por la misma persona esta semana
reemplaza: ""
---
```
Cuerpo: opciones consideradas, por qué se eligió esta, qué se deja de hacer.
