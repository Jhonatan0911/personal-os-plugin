---
name: reglas-organizacion
description: Mantiene el registro único de reglas de la organización (políticas, lineamientos de Arquitectura, guías obligatorias, convenciones de BD, ramas, acceso a producción) y lo convierte en lo que las hace cumplir — reglas siempre presentes o por tipo de archivo para Claude Code, un hook que bloquea producción, ramas protegidas y escrituras en BD, un vigía al iniciar sesión y las verificaciones que aplica cada skill —, más una página de convenciones para mostrar al equipo. Úsala cuando digan "llegó una política nueva", "agrega esta regla", "registra este lineamiento", "esto es obligatorio desde hoy", "qué reglas tenemos", "regenera las reglas", "este repo es nuevo" o "arma la página de convenciones". No es para decisiones propias del usuario sin fuente de la organización (van a decisiones) ni para el paquete de un despliegue (paso-a-produccion).
argument-hint: "[agregar|regenerar|listar|vista]"
---

# reglas-organizacion — registro único de reglas y lo que las hace cumplir

Una regla de la organización vive **una sola vez** en `<config>/reglas-empresa/registro.yaml` (`<config>` = la
carpeta de `<stateDir>/config/fuentes.yaml`) y de ahí se genera todo lo demás con `build.py`. No se inyectan
reglas en cada prompt: se acumulan en la conversación y, con muchas a la vez, el modelo cumple menos. Por
eso van en capas, y lo que no admite excepción va en un hook.

| Capa | Qué genera | Cuándo pesa en el contexto |
|---|---|---|
| `nucleo` | `<salida.rules>/00-nucleo.md` (sin `paths:`) | Siempre, una vez por sesión. Tope de 40 reglas |
| `archivo` | `<salida.rules>/2x-*.md` con `paths:` | Solo al leer o editar archivos que coinciden |
| `momentos: [skill]` | `reglas_empresa.por_skill.<skill>` en `fuentes.yaml` | Cuando esa skill corre |
| `bloqueos` | `~/.claude/personal-os/guardia-empresa.json` → hook `guardia-empresa.js` | Nunca: lo aplica el código |
| `documentos_vigilados` | `~/.claude/personal-os/reglas-vigia.json` → `reglas-scan.js` | Solo si hay hallazgos al iniciar sesión |

## Agregar una política o una regla

1. **Lee la fuente completa** (correo, documento, acta). Si es formal y cambia cómo se trabaja, crea su nota en
   `<stateDir>/normativas/N-###` con el formato del README de esa carpeta: quién la emite, desde cuándo, qué
   exige, qué le toca al usuario y qué no, y choques con el trabajo en curso.
2. **Pártela en reglas atómicas** en el registro: una línea accionable por regla, con `fuente` (N-### o
   D-###), `vigente_desde`, `capa`, `cumplimiento` y `momentos` (qué skills la aplican). La forma de cada
   campo está en `${CLAUDE_SKILL_DIR}/plantillas/registro-ejemplo.yaml`. Si algo debe cumplirse siempre y es
   técnico (un servidor, una rama, un comando), va también en `bloqueos`.
3. **Muestra al usuario las reglas nuevas** antes de regenerar: el texto exacto y la capa de cada una, en el modal.
4. **Regenera**: `python -I "${CLAUDE_SKILL_DIR}/scripts/build.py" --config-dir <config>`. Sale con 1 si el
   registro tiene errores (ids repetidos, campos que faltan, núcleo de más de 40 reglas) y no escribe nada.
5. **Verifica**: el hook se prueba con comandos simulados (el JSON del evento por la entrada estándar de
   `guardia-empresa.js`, sin ejecutar nada), y el vigía con `node reglas-scan.js --json`. Las reglas de
   `~/.claude/rules/` se cargan al iniciar sesión: se confirman con `/context` en la sesión siguiente.

## Otros pedidos

- **«Este repo es nuevo»**: agrégalo a `repos.yaml` (`nuevos`) y regenera; `revisar-pr` y las reglas por
  archivo le aplican desde ahí las guías de arquitectura.
- **«Qué reglas tenemos»**: lee el registro y resume por capa, con su fuente. No lo copies entero.
- **Un documento vigilado cambió** (aviso del vigía): reléelo, actualiza su normativa y las reglas, regenera y
  marca la revisión con `node reglas-scan.js --aceptar`.
- **Página de convenciones**: `build.py --config-dir <config> --vista <archivo.html>` usa `organizacion` y
  `marca` del registro. Publicarla o enviarla es una salida externa: pregúntalo antes.

## Reglas

- **Lo generado no se edita a mano**: se edita el registro y se regenera; si no, el vigía lo avisa.
- **Cada regla cita su fuente.** Una regla sin documento o sin decisión no entra: va primero a decisiones.
- **El hook compara el texto del comando**: es una red de seguridad, no una frontera de seguridad. No lo
  presentes como control de acceso.

## Cuándo NO usarla

- Decisiones del propio usuario sin fuente de la organización → `<stateDir>/decisiones/`.
- Armar el paquete de un despliegue → `paso-a-produccion`.
- Revisar un PR contra las guías → `revisar-pr` (usa lo que esta skill genera).

## Archivos

| Archivo | Cuándo |
|---|---|
| `plantillas/registro-ejemplo.yaml` | Al crear el registro o una regla con un campo que no conoces |
| `plantillas/repos-ejemplo.yaml` | Al crear la lista de repos nuevos y legados |
| `scripts/build.py` | Se ejecuta. Pruebas: `python -I -m unittest discover -s "${CLAUDE_SKILL_DIR}/scripts/pruebas"` |
