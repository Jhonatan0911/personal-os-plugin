# Catálogo de dimensiones

## Índice
- Arquitectura por capas
- Integraciones con terceros
- Objetos de base de datos
- Ciclo de vida / máquina de estados
- Perfiles, roles y permisos
- Normativa / cumplimiento
- Catálogos y parametrización
- Trazabilidad y auditoría
- Despliegue y publicación
- Multi-repo / contratos entre repos
- Cómo verlo funcionando
- Rendimiento y volumen
- Anexo: módulo hermano en definición

El **núcleo obligatorio** (6 secciones) está en `SKILL.md`. Aquí están las **condicionales**: cada
una entra solo si su gatillo aparece en la evidencia. Recorre la lista completa en la Fase 2 y
decide una por una — incluir, omitir, o incluir declarada como "en definición".

Nada de esta lista es un requisito del informe. Es un cuestionario para no dejar fuera algo que sí
existe, y para no meter algo que no.

---

## Arquitectura por capas

- **Gatillo**: 2 o más capas reales de código en el alcance (front, API, BD, worker, servicio).
- **Contenido**: qué hace cada capa, con qué nombre real, y el protocolo entre ellas
  (`HTTPS · REST JSON`, `SOAP`, `SqlCommand + SP`, cola, archivo compartido).
- **Prohibido si**: es una sola capa. Entonces basta un párrafo, no una sección con diagrama.
- **Trampa**: no inventes patrones. Si el controlador habla directo a la BD, eso es lo que se
  dibuja; no lo maquilles con una capa de servicio que no existe.

## Integraciones con terceros

Es la sección que más se arrastra por error. Lee esto completo antes de incluirla.

- **Gatillo**: hay una llamada a un sistema **fuera del producto y fuera de la organización** —
  cliente HTTP/SOAP con host externo, SDK de un proveedor, credenciales de un tercero, webhook
  entrante. Debes poder señalar el archivo donde se construye la llamada.
- **Prohibido si**: lo "externo" es otra API del mismo producto, otra base de datos de la casa, u
  otro repo de la misma mesa. Eso es **arquitectura interna**, no integración con terceros, y va en
  la sección de capas o en una de "sistemas que participan".
- **Contenido**: qué hace el tercero que no podemos hacer nosotros, qué se le manda, qué devuelve,
  qué pasa si no responde, y cómo se autentica (el mecanismo, **nunca** las credenciales).
- **Si el tercero es de la misma organización** (otro producto de la casa, un ERP interno): dilo
  así, "sistema interno de la organización", y no lo pintes como proveedor.

## Objetos de base de datos

- **Gatillo**: el alcance toca BD.
- **Contenido**: dos tablas que funcionan muy bien juntas:
  1. **Por operación**: qué SP sustenta cada operación que ve el usuario. Es la tabla que le
     permite a un dev nuevo entrar por donde entra el negocio.
  2. **Por grupo funcional**: transaccional / catálogos / parametrización / auditoría / relaciones.
     Agrupar por rol, no listar alfabéticamente.
- **Cubre el inventario completo**, no solo tablas y SP: vistas, triggers, funciones, tipos tabla,
  jobs, índices si alguno es determinante. Si hay **triggers**, dilos y di qué disparan: son la
  causa favorita de comportamientos que nadie entiende.
- **Prohibido**: listar un objeto que no viste definido o referenciado. Y prohibido decir "todo el
  acceso es por SP" sin haberlo comprobado.

## Ciclo de vida / máquina de estados

- **Gatillo**: hay una columna de estado con valores discretos y transiciones disparadas por
  acciones. Debes poder nombrar los valores reales y quién los cambia.
- **Contenido**: los estados, la acción que mueve de uno a otro, y qué significa cada estado para
  el negocio. Si hay estados terminales o de error, van.
- **Prohibido si**: los "estados" son en realidad flags booleanos sueltos.

## Perfiles, roles y permisos

- **Gatillo**: hay tabla de perfiles/roles/menús, guardas en el front, o validación de permisos en
  la API.
- **Contenido**: qué rol puede hacer qué, con los nombres reales del sistema. Si un rol existe en
  la parametrización pero nadie lo usa, dilo.
- Los actores humanos del núcleo obligatorio y los perfiles técnicos no son lo mismo: el actor es
  "quien trabaja"; el perfil es "cómo lo autoriza el sistema".

## Normativa / cumplimiento

- **Gatillo**: una ley, resolución, circular o norma **referenciada en el código, en el
  requerimiento o en el ticket**.
- **Contenido**: qué exige, qué se hizo para cumplirla, desde cuándo aplica, y cómo se despliega.
- **Prohibido si**: nadie la mencionó. No la deduzcas del sector.

## Catálogos y parametrización

- **Gatillo**: el comportamiento depende de datos configurables, no de código.
- **Contenido**: qué se parametriza, quién lo parametriza, y qué se rompe si está mal. Esta sección
  suele explicar la mitad de los "errores" que reporta el cliente.

## Trazabilidad y auditoría

- **Gatillo**: existe una tabla de log, un registro de operaciones, o campos de auditoría poblados
  de verdad.
- **Contenido**: qué queda registrado, con qué granularidad, si guarda payload y respuesta, y para
  qué sirve al soportar un caso.
- **Prohibido si**: hay columnas `FechaCreacion`/`UsuarioCreacion` que nadie llena.

## Despliegue y publicación

- **Gatillo**: hay scripts de publicación, de reversión, pipelines, o pasos manuales conocidos.
- **Contenido**: qué se publica, en qué orden, qué se hace para revertir, y qué queda pendiente de
  desplegar hoy. Muy valioso para quien decide: separa "está hecho" de "está arriba".

## Multi-repo / contratos entre repos

- **Gatillo**: el alcance cruza 2 o más repos.
- **Contenido**: qué repo es dueño de qué, y qué se prometen entre ellos (endpoint, contrato de
  datos, nombre de columna). Si la mesa tiene `CONTRATOS/`, esa es la fuente.

## Cómo verlo funcionando

- **Gatillo**: existen datos de prueba, un ambiente de test navegable, o casos ya ejecutados.
- **Contenido**: el caso concreto con el que se probó (identificador real de test), en qué orden se
  navega, y qué se debería ver. Es la sección que un dev nuevo agradece más.
- **Nunca** datos de un paciente o persona real, ni de producción.

## Rendimiento y volumen

- **Gatillo**: hay medición, no impresión. Conteos reales, tiempos observados, paginación con
  tamaños definidos.
- **Prohibido si**: solo hay intuición. Mejor una línea en "lo abierto" diciendo que no se midió.

## Anexo: módulo hermano en definición

- **Gatillo**: existe algo adyacente al alcance, a medio hacer, que el lector va a confundir con lo
  documentado o va a preguntar por él.
- **Contenido**: qué existe hoy, qué falta acordar (como preguntas, no como plan), y una línea que
  diga por qué se incluye el anexo — "para dar la foto completa" — con la aclaración de que el
  cuerpo del informe no lo cubre.
