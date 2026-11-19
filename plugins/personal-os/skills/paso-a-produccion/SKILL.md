---
name: paso-a-produccion
description: Arma y verifica el paquete que exige la organización antes de desplegar un requerimiento a producción — cruza la lista de entregables y aprobaciones configurada (especificaciones, análisis de impacto, diagramas, evidencias de pruebas, plan de despliegue, certificación de QA, aprobación del cliente y de Arquitectura) contra el expediente y la carpeta del paquete, dice qué falta y quién lo debe, ayuda a producir los faltantes técnicos desde el código y deja en borrador el correo de solicitud de aprobación. Úsala cuando digan "paso a producción", "vamos a publicar X en producción", "arma el paquete para Arquitectura", "¿qué falta para desplegar X?", "pide la aprobación de despliegue" o se planee una publicación nocturna. No es para certificar las pruebas funcionales (certificar-funcional) ni para revisar el PR (revisar-pr), y nunca despliega ni envía nada.
argument-hint: "<slug del requerimiento o CLAVE-JIRA> [verificar|armar|correo]"
---

# paso-a-produccion — el paquete antes de desplegar

Entrega el **estado del paquete** (cada entregable y cada aprobación: listo, falta o parcial, con su evidencia),
ayuda a producir lo que falta y deja **en borrador** el correo que pide la aprobación. Ningún despliegue a
producción se recomienda mientras falte un entregable o una aprobación: la política de la organización lo
prohíbe y un despliegue sin paquete es un incumplimiento visible para Arquitectura y para el cliente.

## Dónde está cada cosa

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. La configuración es la sección
`paso_produccion` de `<stateDir>/config/fuentes.yaml` (forma en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`):
la lista de `entregables` y `aprobaciones`, a quién se pide la aprobación y qué normativa lo exige. **Sin esa
sección no hay paquete que verificar**: pide la lista al líder en el modal (o el documento de la política) y
guárdala antes de seguir. El expediente se busca por slug o clave de Jira con
`python -I "${CLAUDE_SKILL_DIR}/scripts/paquete.py" --caso <slug-o-clave> --raiz <stateDir> --config <fuentes.yaml>`.
Carpeta del paquete `<P>`: `paso_produccion.carpeta` o `<carpeta del expediente>/paso-produccion/`.

## 1. Verificar

1. Corre `paquete.py --caso <slug-o-clave> --raiz <stateDir> --config <fuentes.yaml>`. Sale con 0 si el paquete
   está completo, 1 si falta algo y 2 si no encuentra el expediente o la configuración. Escribe
   `<P>/paquete.json` y `<P>/paquete.md`.
2. Muestra la tabla de `paquete.md` tal cual y, por cada faltante, **quién lo debe** (`responsable` de la
   configuración) y desde cuándo está la fecha de despliegue. Si `fuentes.yaml` trae
   `reglas_empresa.por_skill.paso-a-produccion`, nombra la regla (`id`) que exige el paquete. Si el despliegue ya tiene fecha y falta algo,
   es un riesgo: dilo en la primera línea, no al final.

## 2. Armar lo que falta

Para los entregables técnicos, propón producirlos desde la fuente real, nunca inventados:

| Entregable | De dónde sale |
|---|---|
| Análisis de impacto | `git diff --stat <destino>...<rama>` en cada repo del expediente (`proyectos`): componentes, endpoints, tablas y pantallas tocadas |
| Diagrama de clases | Las clases nuevas o modificadas del diff, en Mermaid `classDiagram` |
| Modelo entidad-relación | Los scripts de BD del cambio (Apply), en Mermaid `erDiagram` |
| Especificación técnica | `adr`, `hallazgos_codigo`, `documentacion.tecnica` del expediente más el diff |
| Evidencia de pruebas unitarias | Salida de las pruebas del repo con cobertura (la corre el dev o el líder; Claude solo lee el resultado) |
| Matrices funcionales | `certificar-funcional` (no se duplica aquí) |

Lo que es de otros (certificación de QA, aprobación del cliente) no se produce: se pide a quien corresponde
y se guarda su evidencia en `<P>/aprobaciones/`. Guarda cada entregable en `<P>/` con el prefijo de su `id`
(p. ej. `<P>/impacto.md`) y vuelve a verificar.

## 3. Pedir la aprobación

Con el paquete completo (salvo la aprobación que se va a pedir), redacta el correo a
`paso_produccion.aprobador` con la lista de entregables y sus rutas, la fecha, hora y asistentes del
despliegue y el responsable de la apertura. Usa la skill de voz del usuario si está instalada (`redactar`).
Guárdalo en `<P>/correo-aprobacion.md`, muéstralo completo y cierra con el modal: ¿ajusto algo? · lo dejo listo
para que lo envíes. Con `paquete.py … --escribir` el resultado queda en `paso_produccion` del expediente.

## Reglas

- **Nunca despliegues, publiques ni envíes nada.** Se entregan textos y archivos; el líder los manda.
- **El estado lo da el script**, no la conversación: un entregable «ya está» sin archivo ni campo en el
  expediente sigue faltando.
- **Sin datos reales de personas** en el paquete (capturas y matrices con datos sintéticos): si aparecen,
  se sacan antes de pedir la aprobación.

## Cuándo NO usarla

- Certificar la matriz de pruebas funcionales → `certificar-funcional`.
- Revisar el código del PR contra los criterios → `revisar-pr`.
- Planear o estimar el requerimiento → `planear-sprint`.

## Archivos

| Archivo | Cuándo |
|---|---|
| `config-ejemplo.yaml` | Para crear la sección `paso_produccion` (entregables, aprobaciones, aprobador) |
| `scripts/paquete.py` | Se ejecuta. Pruebas: `python -I -m unittest discover -s "${CLAUDE_SKILL_DIR}/scripts/pruebas"` |
