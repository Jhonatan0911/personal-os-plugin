# Tablero compartido

Léelo solo si `status_celula.tablero_compartido.url` está configurado. Es un Artifact con base de datos
compartida (la página la mantiene el usuario; esta skill solo le sube los datos de cada corrida). Ahí la mesa
ve el estado sin que el usuario le pase un archivo; el HTML local sigue saliendo como respaldo y no se comparte.

## 1. Quién actualiza qué

| Documentos | Fuente | Quién escribe |
|---|---|---|
| `jira/cNN`, `jira/meta` (foto de Jira) | Jira | La página en vivo (con el conector de quien pulsa «Actualizar») o esta skill, la más reciente gana |
| `estado/bloqueos`, `estado/timesheets`, `estado/frentes` | Personal OS y correo del usuario | Solo el dueño (regla de la base: `write: owner`) |
| `privado/lider` | Personal OS | Solo el dueño lo ve y lo escribe (`read/write: owner`) |

Si la página no tiene esas reglas, se le dice al usuario antes de subir la pestaña del líder: lleva sus
compromisos y riesgos.

## 2. Cada corrida

1. Lee con `ArtifactData` `get` el documento `jira/meta` del tablero y guárdalo en un archivo; lee también la
   `version` de los documentos que vas a escribir y guárdalas como `{"estado/bloqueos": 7, …}`.
2. Prepara la carga:
   ```bash
   node "<raíz del plugin>/scripts/status-celula-compartido.js" "<datos.json>" --salida "<carpeta temporal>" \
     --corte-texto "<dd/mm/aaaa hh:mm>" --jira-at "<ISO de la lectura de Jira>" \
     --meta-actual "<jira-meta.json>" --versiones "<versiones.json>" \
     [--personas-extra "<displayName>,…"] [--excluir "<CLAVE>,…"]
   ```
   Deja un archivo por documento y `writes.json`. Si la foto del tablero es igual o más reciente que la tuya,
   **la omite** (alguien pulsó «Actualizar» después: la foto en vivo gana). Si la sube, agrega el borrado de
   los trozos sobrantes de la foto anterior.
3. Sube con **una sola** llamada `ArtifactData` `batch` al `url` configurado, pasando las entradas de
   `writes.json` (cada una con su `file_path`). Si una falla por `if_version`, alguien cambió ese documento:
   vuelve a leerlo, une y reintenta; nunca fuerces.
4. Di en la entrega qué se subió y si la foto de Jira se omitió.

## 3. Lo que no se sube

Sin datos de pacientes, credenciales ni salud; una ausencia se escribe «ausente». Las claves de
`tablero_compartido.excluir` no aparecen en la foto. La pestaña del líder nunca va a una colección legible
por todos.
