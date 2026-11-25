---
name: paso-a-produccion
description: Arma y verifica el paquete que exige la organización antes de desplegar un requerimiento a producción — cruza la lista de entregables y aprobaciones configurada (especificaciones, análisis de impacto, diagramas, evidencias de pruebas, plan de despliegue, manual, guías, comunicado con video tutorial, certificación de QA, aprobación del cliente y de Arquitectura) contra el expediente y la carpeta del paquete, dice qué falta y quién lo debe, produce los faltantes desde el código y la pantalla real y deja en borrador el correo de solicitud de aprobación. Úsala cuando digan "paso a producción", "vamos a publicar X en producción", "arma el paquete para Arquitectura", "¿qué falta para desplegar X?", "pide la aprobación de despliegue", "haz el comunicado y el video de X" o se planee una publicación nocturna. No es para certificar las pruebas funcionales (certificar-funcional) ni para revisar el PR (revisar-pr), y nunca despliega ni envía nada.
argument-hint: "<slug del requerimiento o CLAVE-JIRA> [verificar|armar|correo]"
---

# paso-a-produccion — el paquete antes de desplegar

Entrega el **estado del paquete** (cada entregable y cada aprobación: listo, falta, parcial o «no se genera»,
con su evidencia), produce lo que falta y deja **en borrador** el correo que pide la aprobación. Ningún
despliegue a producción se recomienda mientras falte un entregable o una aprobación: la política de la
organización lo prohíbe y un despliegue sin paquete es un incumplimiento visible para Arquitectura y el cliente.

## Dónde está cada cosa

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. La configuración es la sección
`paso_produccion` de `<stateDir>/config/fuentes.yaml` (forma completa en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`):
los `entregables`, las `aprobaciones`, el aprobador, la `marca`, lo que se `omitir` y el `video`. **Sin esa
sección no hay paquete que verificar**: ofrece copiar el ejemplo completo (en el modal) y ajustar normativa y
aprobador antes de seguir. El expediente se busca por slug o clave de Jira con
`python -I "${CLAUDE_SKILL_DIR}/scripts/paquete.py" --caso <slug-o-clave> --raiz <stateDir> --config <fuentes.yaml>`.
Carpeta del paquete `<P>`: **si se trabaja en una mesa (`MESA.json` o carpeta `repos/`), es `<mesa>/final/`**,
con `aprobaciones/` y un `README.md` que se genera desde `paso_produccion`. Nunca se deja dentro de `docs/`.
Fuera de una mesa: `paso_produccion.carpeta` o `<carpeta del expediente>/paso-produccion/`. Siempre se pasa
`--carpeta <P>` a `paquete.py`.

## Qué se genera

**Por defecto, todo lo que trae `entregables`**: el paquete completo. Quien corre la skill puede producir menos
con `paso_produccion.omitir: [ids]` (o desmarcando casillas en ⚙ Config de la consola, que escribe esa línea).
Un entregable con `con: <id>` se omite junto con su padre: el video va con el comunicado. `paquete.py` muestra
lo omitido como «⚪ no se genera», no lo exige y lo lista en `omitidos`. **Lo omitido no se produce ni se
ofrece producir**; si el líder lo pide para un caso puntual, se produce sin tocar la configuración. Las
aprobaciones no se omiten nunca.

## 1. Verificar

1. Corre `paquete.py --caso <slug-o-clave> --raiz <stateDir> --config <fuentes.yaml> --carpeta <P>`. Sale con 0
   si el paquete está completo, 1 si falta algo y 2 si no encuentra el expediente o la configuración. Escribe
   `<P>/paquete.json` y `<P>/paquete.md`. Revisa el **contenido**, no solo el nombre del archivo: `requiere`
   dice qué se exige (PDF, N capturas reales, textos obligatorios como la fecha y la hora del plan, evidencia en
   `evidencias/`, un MP4 medido con ffprobe). Ningún archivo de texto puede llevar marcadores de borrador
   (`marcadores_borrador`). Lo que existe pero no cumple sale **🟡 incompleto**, con el motivo. No se renombran
   archivos para esquivar al verificador.
2. Muestra la tabla de `paquete.md` tal cual y, por cada faltante, **quién lo debe** (`responsable`) y desde
   cuándo está la fecha de despliegue. Si `fuentes.yaml` trae `reglas_empresa.por_skill.paso-a-produccion`,
   nombra la regla (`id`) que exige el paquete. Si el despliegue ya tiene fecha y falta algo, es un riesgo:
   dilo en la primera línea, no al final.

## 2. Armar lo que falta

Para los entregables técnicos, prodúcelos desde la fuente real, nunca inventados:

| Entregable | De dónde sale |
|---|---|
| Análisis de impacto | `git diff --stat <destino>...<rama>` en cada repo del expediente (`proyectos`): componentes, endpoints, tablas y pantallas tocadas |
| Diagrama de clases | Las clases nuevas o modificadas del diff, en Mermaid `classDiagram` |
| Modelo entidad-relación | Los scripts de BD del cambio, en Mermaid `erDiagram` |
| Especificación técnica | `adr`, `hallazgos_codigo`, `documentacion.tecnica` del expediente más el diff |
| Evidencia de pruebas unitarias | Salida de las pruebas del repo con cobertura (la corre el dev o el líder; Claude solo lee el resultado) |
| Matrices funcionales | `certificar-funcional` (no se duplica aquí) |

### Lo que leen personas va en PDF, corto y con capturas reales

- **Manual, guías, especificaciones, impacto, diagramas y plan** se entregan en **PDF con la marca**:
  `python -I "${CLAUDE_SKILL_DIR}/scripts/pdf.py" --config <fuentes.yaml> --carpeta <P>` (dibuja Mermaid, toma la
  marca de `paso_produccion.marca` y revisa su propio PDF con `verificar_pdf.py`). El `.md` es la fuente; un
  `.md` suelto no cuenta como entregable para quien lo recibe.
- **El manual de usuario es corto**: una página por tarea, con **captura real** y 3 a 5 pasos numerados. Sin
  tablas de mensajes ni explicaciones técnicas. **Prohibidos los recuadros «[Captura: …]»**.
- **Las capturas las toma Claude** con `python -I "${CLAUDE_SKILL_DIR}/scripts/capturas.py" --guion <P>/capturas/guion.json
  --salida <P>/capturas`, contra el ambiente local o de TEST, en Chromium headless de pantalla completa (no se ve
  la URL). El guion queda en el paquete para repetirlas. Solo **datos ficticios**. Un paso que guarda en la base
  lleva `"escribe": true` y no corre sin `--permitir-escritura`, que se pasa solo con el OK del líder. Mira cada
  captura antes de usarla.
- **Un microfrontend se captura dentro de su menú**, como lo verá el usuario. Si el menú pide sesión, el guion
  trae `login` con la ruta de un archivo de credenciales de TEST fuera de todo repo; Claude no ve ni copia la
  clave. Sin ese archivo, abre un Chromium visible y el líder inicia sesión.
- **Comunicado**: boletín de una página con diseño (titular, captura destacada, 2 o 4 beneficios con iconos,
  perfiles y ruta del menú). No es el manual.
  `python -I "${CLAUDE_SKILL_DIR}/scripts/comunicado.py" --config <fuentes.yaml> --contenido <P>/comunicado.json --carpeta <P>`
  genera HTML, PNG (chat) y PDF (correo) y revisa su PDF: una página y sin franjas blancas. Antes de generarlo,
  contrasta el titular con lo que el módulo cubre de verdad: **el encabezado nombra el producto completo, no un
  área** (si el módulo sirve a dos áreas, nombra las dos).
- **Video tutorial** (va con el comunicado salvo que esté omitido): 20 a 90 s, 1920x1080, con audio, en
  **HyperFrames** (carga `/hyperframes` y sigue su contrato). Vive en `<P>/video/` y se renderiza a
  `<P>/video-tutorial.mp4`.
  1. **Guion.** Tres guiones en el modal con el recomendado primero: un usuario haciendo una tarea real con un
     dato ficticio que recorre el flujo. Sonido en el mismo modal: música y efectos sin voz por defecto (funciona
     sin audio en un chat). Si `paso_produccion.video.ejemplos` trae videos anteriores, léelos antes: muestran el
     nivel de pulido esperado.
  2. **Proyecto.** Escribe `<P>/video.json` (formato en el docstring de `scripts/video.py`: gancho, un paso por
     captura con su foco de cámara, beneficios opcionales, cierre con producto y ruta) usando las capturas del
     manual y el titular y los beneficios de `comunicado.json`. Corre
     `python -I "${CLAUDE_SKILL_DIR}/scripts/video.py" --guion <P>/video.json --carpeta <P> --config <fuentes.yaml>`.
     El script valida antes de escribir: que cada captura exista, que ningún foco deje ver lo que
     `video.recorte` oculta (menú, cabecera con el usuario) ni se salga de la captura, y la duración. No edites
     el HTML a mano para esquivar una validación: corrige el guion.
  3. **Música** sin servicios externos: `python "${CLAUDE_SKILL_DIR}/scripts/musica.py" <P>/video/assets/music/bgm.wav
     <segundos> "<prompt>"` (MusicGen local; pide un entorno con torch y transformers) y vuelve a correr
     `video.py` para enlazarla. Cada efecto tiene su causa en pantalla.
  4. **Pulido opcional.** Tras generar, una escena se puede enriquecer a mano (resaltados, transiciones propias)
     siguiendo el contrato de HyperFrames; el guion sigue siendo la fuente si se regenera (el script respalda el
     proyecto anterior en `<P>/video.anterior/`).
  5. **Revisión:** `npx hyperframes check` sin errores, fotogramas con `snapshot` revisados a ojo (sin cabecera,
     títulos legibles, primer fotograma con contenido), `REVIEW.md` en el proyecto y render. El sonido se mide, no
     se escucha: dilo.

Lo que es de otros (certificación de QA, aprobación del cliente) no se produce: se pide a quien corresponde y se
guarda su evidencia en `<P>/aprobaciones/`. Guarda cada entregable en `<P>/` con el prefijo de su `id` (p. ej.
`<P>/impacto.md`) y vuelve a verificar.

## 3. Pedir la aprobación

Con el paquete completo (salvo la aprobación que se va a pedir), redacta el correo a `paso_produccion.aprobador`
con la lista de entregables y sus rutas, la fecha, hora y asistentes del despliegue y el responsable de la
apertura. Usa la skill de voz del usuario si está instalada (`redactar`). Guárdalo en `<P>/correo-aprobacion.md`,
muéstralo completo y cierra con el modal: ¿ajusto algo? · lo dejo listo para que lo envíes. Con
`paquete.py … --escribir` el resultado queda en `paso_produccion` del expediente.

## Reglas

- **Nunca despliegues, publiques ni envíes nada.** Se entregan textos y archivos; el líder los manda.
- **El estado lo da el script**, no la conversación: un entregable «ya está» sin archivo ni campo en el
  expediente sigue faltando.
- **Sin datos reales de personas** en el paquete (capturas, video y matrices con datos sintéticos).

## Cuándo NO usarla

- Certificar la matriz de pruebas funcionales → `certificar-funcional`.
- Revisar el código del PR contra los criterios → `revisar-pr`.
- Planear o estimar el requerimiento → `planear-sprint`.

## Archivos

| Archivo | Cuándo |
|---|---|
| `config-ejemplo.yaml` | Para crear la sección `paso_produccion` completa (16 entregables, aprobaciones, marca, omitir, video) |
| `scripts/paquete.py` | Se ejecuta. Pruebas: `python -I -m unittest discover -s "${CLAUDE_SKILL_DIR}/scripts/pruebas"` |
| `scripts/capturas.py` | Capturas reales desde un guion JSON (Playwright). Formato de pasos en su docstring |
| `scripts/pdf.py` | PDF con marca de los entregables que leen personas (Mermaid incluido) |
| `scripts/comunicado.py` | Boletín de una página (HTML, PNG y PDF), contenido en JSON (formato en su docstring) |
| `scripts/video.py` | Proyecto HyperFrames del video desde `video.json`, con validación de focos y duración |
| `plantillas/video-tutorial/` | Base del video (sonidos, package.json) y `guion-ejemplo.json`; la copia `video.py` |
| `scripts/musica.py` | Cama musical local con MusicGen (`<salida.wav> <segundos> "<prompt>"`) |
| `scripts/verificar_pdf.py` | Revisa un PDF ya generado (páginas, franjas blancas, desborde). Lo llaman `pdf.py` y `comunicado.py` |
