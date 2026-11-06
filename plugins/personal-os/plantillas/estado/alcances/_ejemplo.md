---
id: A-001
nombre: Ajustes del módulo de reportes (10 puntos)
cliente: Cliente A
estado: activo
fecha_entrega: 2026-12-15
fuente:
  ruta: "Documentos/Cliente A/alcance-reportes.xlsx"
  jql: 'project = PROY AND labels = alcance-reportes'
verificado_el: 2026-12-01
puntos_total: 10
puntos_con_dueno: 7
puntos_sin_issue: 1
puntos_sin_responsable: 2
puntos_sin_fecha: 2
puntos_estado_enganoso: 0
puntos_bloqueados: 1
bloqueo_detalle: "Punto 6 espera el archivo de prueba del cliente, pedido el 25/11 a su coordinador."
puntos_brecha_estado: 0
issue_paraguas: PROY-142
alias: reportes
hitos:
  - "2026-12-05 | Publicar en pruebas los puntos 1-4 | pendiente"
  - "2026-12-01 | Enviar acta de alcance firmada | hecho: correo del 01/12"
---

# A-001 · Ajustes del módulo de reportes — Cliente A (EJEMPLO)

Nota de ejemplo: el vigía la ignora porque su nombre empieza por `_`. Cópiala con otro nombre
(p. ej. `A-001-reportes.md`) para empezar a vigilar un compromiso real.

## Fusiones y aclaraciones
- Los puntos 3 y 4 viven juntos en PROY-150 (declarado aquí para que no salgan "sin ticket").

## Último cruce
- 01/12: punto 2 sin issue; puntos 5 y 8 sin responsable; punto 6 bloqueado por el cliente.
