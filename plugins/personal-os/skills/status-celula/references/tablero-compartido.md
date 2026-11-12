# Tablero compartido

El tablero de planeación es un Artifact con base de datos compartida. La skill arma la página desde
`tablero/plantilla.html` y la publica, y en cada corrida le sube los datos. La mesa y el equipo ven el estado
por el enlace, sin que el usuario pase un archivo. No hay HTML local de respaldo: la página es la salida.

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

## 4. Capacidades de la página (solo la primera publicación)

En las siguientes se publica **sin** `capabilities` para conservar las que ya tiene. La primera vez se carga
la skill `artifact-capabilities` y se declaran:

| Capacidad | Para qué |
|---|---|
| `db` con reglas: `estado` (leer: view, escribir: owner) · `propuestas` (view / owner) · `privado` (owner / owner) · `cal` (view / owner) · `cal/{self}` (escribir: interact) | La foto, la mesa, la pestaña del líder y el calendario que cada quien suma |
| `mcp` con el servidor de Jira de `jira.servidor_mcp` (buscar, leer, transiciones, transicionar, comentar, editar, crear, enlazar, buscar cuenta) y el de Microsoft 365 de `m365.servidor_mcp` (`outlook_calendar_search`) | «Actualizar Jira y calendario», la ficha y las reuniones de Teams. Sin Microsoft 365 el calendario queda vacío y la página lo dice |
| `sample` | La sugerencia de la IA en «Backlog sin dueño» |
| `user` (perfil) | Saber quién es el dueño y en qué carril está quien mira |

Las colecciones `plan`, `jira`, `cronogramas`, `sugerencias` y `backlog` usan la regla por defecto de la base.
