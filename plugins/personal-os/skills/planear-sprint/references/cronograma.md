# El cronograma interactivo

Léelo en la Fase 4: al generar, publicar y registrar el cronograma, o cuando el líder pregunte cómo se
comporta la página (carga, reprogramar, exportar).

## 1. Generar

```
python "${CLAUDE_SKILL_DIR}/generar_cronograma.py" plan.json cronograma.html [--perfil <perfil.json>] [--marca <marca.json>]
```

Con `python` o `python3`. Pasa `--perfil` si existe `planeacion.perfil` y `--marca` si existe
`planeacion.marca` (ver `configuracion.md`). Lee los avisos que imprime: sin `cloud_id` la página no
consulta ni exporta; si nombra un expediente que no existe o al que le faltan fuentes, corrígelo antes.

## 2. Publicar

- **Con la herramienta `Artifact`**: carga antes la skill `artifact-capabilities` y declara
  `db` (colecciones `plan`, `orden` y `expediente`: lectura para quien ve, escritura solo el dueño),
  `user`, `sample`, `downloads` y `mcp` (Atlassian: `searchJiraIssuesUsingJql`, `createJiraIssue`,
  `addCommentToJiraIssue`, `getTransitionsForJiraIssue`, `transitionJiraIssue`; y, si hay correo,
  `outlook_email_search` y `read_resource`). Después, `ArtifactData set` del expediente en
  `expediente/actual`.
- **Sin `Artifact`**: entrega el HTML local. Se ve el plan en solo lectura (sin guardado, sin Jira y sin
  analista); la exportación queda para cuando se publique.
- La página es responsive y respeta modo claro/oscuro; la marca es opcional.

## 3. Cómo se comporta (para explicarlo sin abrir el código)

- **Dos estados**: `propuesta` (Claude la sugiere; el líder la acepta, la cambia o la descarta; no se pinta
  hasta aceptarla) y `espera` (pendiente de definición, vinotinto, sin fecha).
- **Fila de carga real**: reparte cada subtarea con la capacidad que le queda al día desde su inicio y pasa
  al día hábil siguiente lo que no cabe. No divide parejo ni duplica. Festivos con carga 0.
- **«Programar en secuencia desde…»**: rehace las fechas de lo aceptado sin clave de Jira, en el orden de
  las historias y sus subtareas, desde el siguiente día hábil, con **un calendario por persona**.
- **Responsable por subtarea**: por defecto el dueño del cronograma. La de otra persona no suma a la carga
  del dueño y al exportar sale asignada a ella (accountId de `cuentas`, o la página lo busca en Jira por
  nombre; nunca se adivina).
- **Revisión y pruebas** van al final del sprint, no pegadas a la historia donde quedaron escritas.
- **Desborde**: si lo aceptado pasa del fin de desarrollo, se muestra como atraso con las horas que no
  caben. Las fases del cliente no se mueven; un replanteo va en `fases_replan` (en rojo, debajo).
- Los datos que entrega el almacén vienen congelados: la página los clona antes de editarlos.

## 4. Exportar a Jira (lo hace el líder desde la página)

1. **Paso 1 · interpretar**: el analista toma el borrador de cada subtarea, la historia, las subtareas
   hermanas y el expediente, y redacta la descripción (Objetivo · Qué hacer · Dónde · Criterios técnicos
   · Depende de). El líder la revisa y corrige en el modal.
2. **Paso 2 · escribir**: solo lo marcado, uno por uno, con la cuenta del líder. **Una subtarea con menos
   de 120 caracteres de descripción no sale** (`DESC_MIN` de la plantilla). La página agrega el pie con
   horas, fechas y responsable, la estimación original, la fecha límite y, si existe `campo_inicio`, la
   fecha de inicio.

## 5. Después de publicar

- **Tablero central** (si existe `planeacion.tablero_central`): `ArtifactData set` en
  `<coleccion>/<slug>` con `{titulo, url, tipo: "cronograma", epica, historias[], responsable, inicio,
  entrega, estado, nota}`. Al cerrar o mover la entrega, actualiza ese documento con `if_version`.
- **Compromiso con fecha**: si el sprint tiene una entrega comprometida, propón crear su nota en
  `<stateDir>/alcances/` con el cronograma como fuente viva (los puntos se leen de ahí, no se copian).


## Panel de cada subtarea (desde 3.4.0)

- **Análisis previo de la IA y notas del líder** (`obs`): no va a Jira. Es lo que la IA dedujo del código y de
  las definiciones, y donde el líder escribe sus decisiones. El analista de la página («Ajustar con el analista a
  mis notas») trata esas notas y el modelo de BD como mandatorios sobre el borrador.
- **Descripción que se crea en Jira** (`desc`): siempre visible debajo; es exactamente lo que sale al exportar,
  más el modelo de BD y el pie de estimación.
- **🗄 Ver modelo de BD** (si el ítem trae `modelo`, o «+ Modelo de BD» para crearlo): diagrama de relaciones
  (tablas nuevas en azul, existentes en gris, 🔑 llave, 🔗 referencia, zoom) y editor para borrar o agregar
  tablas y columnas. «Guardar» anota el cambio como decisión; «Guardar y aprobar» marca el modelo aprobado.


## Modelo de BD en Jira (desde 3.5.0)

La subtarea que trae `modelo` sale a Jira con el modelo completo en la descripción (una tabla por cada tabla
de BD, las existentes que solo se leen y la lista de relaciones) **y el diagrama como imagen incrustada**:

1. Después de que el líder exporte, por cada subtarea creada que tenga `modelo`, genera la imagen con el mismo
   dibujo de la página: `python <skill>/modelo_png.py <plan.json o el documento de la base> <id o parte del título> <salida.png>`
   (necesita Edge o Chrome; sale a doble resolución). Lee el documento de la base de la página, no el plan
   local: ahí están las ediciones y la aprobación del líder.
2. Sube la imagen con la operación `uploadAttachmentToJiraIssue` del conector de Atlassian (`discover` →
   `executeWrite`): fase 1 con `filePath` devuelve un `uploadCommand`; córrelo en la terminal y toma el `fileId`.
3. Incrústala en la descripción con `editJiraIssue` e `inlineFileId` (queda al final de la descripción, debajo
   del modelo en texto). No corras la fase 2 para ese mismo archivo: duplicaría el adjunto.
4. Es una escritura en Jira: confírmala con el líder antes, issue por issue o en un solo OK para el lote.

Sin terminal (el líder solo en la página): el botón **⬇ Imagen PNG** del visor descarga la misma imagen para
adjuntarla a mano.
