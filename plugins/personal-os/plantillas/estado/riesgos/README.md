# Riesgos — una nota por riesgo

Nombre de archivo: `R-001-<slug>.md`. Un riesgo queda `abierto` hasta que haya evidencia de cierre.
Escala: **1** (vigilar) → **2** (afecta el plan) → **3** (compromete una entrega o la reputación).
Los archivos que empiezan por `_` son plantillas.

```yaml
---
id: R-001
titulo: El cliente no ha entregado los datos de prueba
nivel: 2
estado: abierto            # abierto | mitigado | cerrado
proyecto: Cliente A
detectado_el: 2026-12-01
dueno: "<quién lo mueve>"
mitigacion: Escalar al coordinador del cliente con fecha límite del 05/12
cierre_evidencia: ""       # obligatorio al cerrar
---
```
Cuerpo: contexto, impacto si se materializa, historial de escalamiento con fechas.
