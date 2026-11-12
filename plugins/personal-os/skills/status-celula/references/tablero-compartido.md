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
| `config/celula`, `config/organizacion` | Pestaña ⚙ Configuración | Solo el dueño (`write: owner`); todos la leen porque la página la aplica al abrir |
| `privado/config_extras`, `privado/config_motor` | Pestaña ⚙ Configuración | Solo el dueño; los usa esta skill al regenerar (§2-bis) |

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

## 2-bis. La configuración que el líder guarda en la página (va ANTES de armar la página)

La pestaña ⚙ Configuración (solo el dueño la ve) edita lo mismo que los JSON de `status_celula.tablero`: la
célula y la organización se aplican apenas guarda (la página se recarga para todos); los extras y el motor,
cuando esta skill regenera. **Lo guardado en la pestaña manda sobre los archivos**, así que cada corrida lo
baja primero:

1. `ArtifactData` `list` de `config` y de `privado`, ambos con `out_dir: "<carpeta temporal>/base"`. Anota la
   `version` de cada documento que traiga (la necesitas si toca subir).
2. Sincroniza:
   ```bash
   node "<raíz del plugin>/scripts/status-celula-config.js" --base "<carpeta temporal>/base" \
     --celula "<tablero.celula>" --organizacion "<tablero.organizacion>" \
     --extras "<tablero.extras>" --motor "<tablero.motor>" --subir "<carpeta temporal>/subir" --aplicar
   ```
   `↓` = lo guardado en la pestaña bajó al archivo (deja respaldo `.antes-config-AAAAMMDD`). `↑` = alguien
   editó el archivo a mano después: sube el JSON de `--subir` con `ArtifactData` `set` (`file_path`,
   `if_version` de la lectura), o la página seguirá mostrando lo de la base. Salida 1 = un documento roto: no
   se escribió nada; se dice y no se regenera con datos a medias.
3. Si no existía `tablero.motor`, guarda en `fuentes.yaml` la ruta del `motor.json` que se creó (junto a la
   célula).

## 3. Lo que no se sube

Sin datos de pacientes, credenciales ni salud; una ausencia se escribe «ausente». Las claves de
`tablero_compartido.excluir` no aparecen en la foto. La pestaña del líder nunca va a una colección legible
por todos.

## 4. Capacidades de la página (solo la primera publicación)

En las siguientes se publica **sin** `capabilities` para conservar las que ya tiene. La primera vez se carga
la skill `artifact-capabilities` y se declaran:

| Capacidad | Para qué |
|---|---|
| `db` con reglas: `estado` (leer: view, escribir: owner) · `propuestas` (view / owner) · `privado` (owner / owner) · `config` (view / owner) · `cal` (view / owner) · `cal/{self}` (escribir: interact) | La foto, la mesa, la pestaña del líder, la configuración y el calendario que cada quien suma |
| `mcp` con el servidor de Jira de `jira.servidor_mcp` (buscar, leer, transiciones, transicionar, comentar, editar, crear, enlazar, buscar cuenta) y el de Microsoft 365 de `m365.servidor_mcp` (`outlook_calendar_search`) | «Actualizar Jira y calendario», la ficha y las reuniones de Teams. Sin Microsoft 365 el calendario queda vacío y la página lo dice |
| `sample` | La sugerencia de la IA en «Backlog sin dueño» |
| `user` (perfil) | Saber quién es el dueño y en qué carril está quien mira |

Las colecciones `plan`, `jira`, `cronogramas`, `sugerencias` y `backlog` usan la regla por defecto de la base.

**Tablero publicado antes de la pestaña ⚙ Configuración** (su declaración guardada no trae la regla `config`;
se ve al leerlo con `Artifact` `read`): sin esa regla, cualquiera con permiso de interactuar podría cambiar la
configuración. En esa publicación, **y solo en esa**, se pasan las capacidades completas: las que ya tiene
(copiadas de la declaración guardada, sin quitar nada) más `{path: "config", read: "view", write: "owner"}`.
Se le avisa al usuario en una línea. Las siguientes vuelven a publicarse sin `capabilities`.
