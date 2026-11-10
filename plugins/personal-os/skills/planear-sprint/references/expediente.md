# Expediente del requerimiento

Léelo en la Fase 1-bis (armar `expediente.json`) y cuando el líder pida actualizar el requerimiento.

## 1. Forma de `expediente.json`

```json
{
  "version": 1, "actualizado": "AAAA-MM-DD",
  "requerimiento": "Nombre corto", "resumen": "Qué se pide y para qué, en 3-5 líneas",
  "historias":        [{"key": "PROY-142", "titulo": "…", "resumen": "…"}],
  "decisiones":       [{"id": "D1", "texto": "…", "quien": "…", "fecha": "AAAA-MM-DD", "fuente": "F3"}],
  "pendientes":       [{"id": "P1", "texto": "…", "a_quien": "…", "desde": "AAAA-MM-DD",
                        "estado": "abierto|resuelto", "resolucion": "…", "fuente": "F2"}],
  "riesgos":          [{"id": "R1", "texto": "…", "fuente": "F1"}],
  "hallazgos_codigo": [{"id": "H1", "texto": "… (repo/archivo:línea)", "fuente": "F4"}],
  "cronograma": "Fases del cliente en una línea, tal cual",
  "fuentes":          [{"id": "F1", "tipo": "jira|correo|acta|especificación|mockup|código|transcripción",
                        "titulo": "…", "fecha": "AAAA-MM-DD", "ref": "clave, asunto o ruta"}],
  "historial":        [{"fecha": "AAAA-MM-DD", "resumen": "Creado en la planeación"}]
}
```

La página agrega sola `decisiones_lider` (lo que el líder decide en el cronograma) y `estimaciones` (los
tiempos que acepta). Una decisión que otra reemplaza lleva `reemplazada_por`; no se borra.

## 2. Reglas

- **Cada afirmación lleva su fuente** (`fuente` → `fuentes[].id`). Sin fuente no entra: el chat de la
  página responde citando, y una cita vacía no le sirve al líder frente al cliente.
- Lo que el cliente ya respondió va como **decisión**, y su pendiente pasa a `resuelto` con la
  `resolucion`, aunque la historia en Jira aún lo muestre abierto.
- Un pendiente dice **a quién** se le preguntó y **desde cuándo**: un bloqueo de un tercero que nadie
  persigue termina siendo un incumplimiento propio.
- Sin secretos ni datos sensibles de personas: proyecciones mínimas.
- El generador lo valida si el plan trae `"expediente": "expediente.json"` (secciones y fuentes) y avisa.

## 3. Carga y uso en la página

- **Nunca se incrusta en el HTML** (la página se comparte y el expediente cambia). Tras publicar:
  `ArtifactData set` en la colección `expediente`, documento `actual`.
- En la página quedan el expediente legible, un **chat** que responde solo con el expediente (y Jira en
  vivo, en lectura) citando la fuente, y el botón **«Actualizar requerimiento»** (solo el dueño).

## 4. «Actualizar requerimiento»

1. Un **analista** busca novedades desde `actualizado`: hijas nuevas de la `epica`, cambios y comentarios
   en las historias, y —si hay conector de correo— correos con los `correos_busqueda`.
2. Un **revisor** debate cada novedad contra el expediente: ¿contradice algo decidido?, ¿la fuente alcanza?,
   ¿es repetida?
3. El líder marca qué se aplica; se sube `version` y se anota en `historial`.

Si el líder lo pide desde Claude Code, haz lo mismo con subagentes de solo lectura y escribe con
`ArtifactData` pasando `if_version` (si alguien la cambió en la página, relee y mezcla; no pises).
