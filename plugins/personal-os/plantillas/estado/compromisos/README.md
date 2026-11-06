# Compromisos — una nota por compromiso

Algo que el usuario prometió a alguien (o alguien le prometió a él) con fecha. Si es una entrega con
varios puntos, va en `alcances/`, no aquí. El vigía lista los vencidos que siguen abiertos y
convierte en hito los que vencen hoy o mañana. Los archivos que empiezan por `_` son plantillas.

```yaml
---
id: C-001
titulo: Enviar la estimación del módulo de pagos
con: Cliente B            # a quién se le debe (o de quién se espera)
direccion: debo           # debo | me_deben
estado: abierto           # abierto | cumplido | cancelado
fecha_limite: 2026-12-04
recurrente: no            # sí = se cumple o incumple cada día (no se reporta como vencido)
evidencia: ""             # obligatorio al cumplir
---
```
