---
name: certificar-funcional
description: Certifica que un requerimiento funciona antes de cerrarlo — genera la matriz de pruebas desde su especificación (una fila por criterio de aceptación, por escenario de calidad y por modo de falla marcado a regresión), recibe la matriz que llenó el desarrollador (Excel, CSV o Markdown), verifica cobertura y evidencias, rechaza si aparecen datos reales de pacientes (cédulas, nombres, teléfonos, historias), da el veredicto funcional y arma la retro con un borrador de correo en la voz del líder y un comentario de Jira, ambos sin enviar. Llena matriz_pruebas y retro del expediente. Úsala cuando digan "certificar-funcional", "certifica el requerimiento X", "arma la matriz de pruebas de", "revisa la matriz que llenó", "¿ya podemos cerrar X?", "haz la retro de" o "verifica las evidencias". No es para revisar el código del PR (revisar-pr) ni para la regresión completa de un sistema.
argument-hint: "<slug del requerimiento o CLAVE-JIRA> [generar|verificar|retro]"
---

# certificar-funcional — matriz de pruebas, evidencias y retro

Entrega tres cosas, en este orden según el momento: la **matriz** para que el desarrollador pruebe, el
**veredicto funcional** sobre la matriz llenada y la **retro** del requerimiento. Nada sale de la máquina:
correo y comentario de Jira quedan en borrador hasta que el líder los envíe.

## Reglas que no se negocian

- **Cero datos reales de personas** en la matriz y en las evidencias: solo datos sintéticos o seudónimos.
  Si aparecen, la matriz se **devuelve completa** (veredicto `rechazada`), sin certificar «lo demás». Los
  scripts enmascaran lo detectado: nunca copies el dato al chat, a un archivo o a un borrador.
- **Las capturas se miran.** Imágenes, PDF y video no se pueden escanear con texto: ábrelos tú (lectura de
  imagen) uno por uno antes de dar el veredicto y mira nombres, documentos, teléfonos y encabezados de la HC.
- **Sin evidencia no hay OK.** Una fila OK o Falla sin evidencia deja la matriz `incompleta`.
- **Nada se envía ni se escribe en Jira.** Se entregan los textos; el líder los manda.

## Dónde está cada cosa

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`. Configuración: sección
`certificacion` de `<stateDir>/config/fuentes.yaml` (forma en `${CLAUDE_SKILL_DIR}/config-ejemplo.yaml`). El
expediente se busca en `<stateDir>/requerimientos/<slug>/expediente.json` (o en `<stateDir>/estimaciones/<slug>/`
para los v1) por slug o por clave de Jira en `jira`, `historias` o `subtareas`, con
`buscar_expediente.py <slug-o-clave> --raiz <stateDir>`. Carpeta de trabajo `<C>`:
`certificacion.carpeta` o `<carpeta del expediente>/certificacion/`. Scripts:
`python -I "${CLAUDE_SKILL_DIR}/scripts/<script>.py"`.

## Según el nivel del caso

Si `fuentes.yaml` trae `flujo.niveles_activos: true`, la certificación se ajusta al nivel (A/B/C) del caso;
contrato en `planear-sprint/references/niveles.md` (si la skill está instalada). Antes de generar corre
`nivel.py --config <fuentes.yaml> --expediente <exp>`: nivel del expediente o `nivel_por_defecto`, variante de `p5`.
`matriz.py` y `verificar_matriz.py` la resuelven igual con `--config` y registran nivel y variante.

| Variante p5 | Qué se hace |
|---|---|
| `matriz` (o sin `flujo`) | Las secciones 1 y 2 tal cual |
| `evidencia` | Matriz de **una fila** (`EV-1`) con `ficha_corta.evidencia_cierre`. Si falta (`matriz.py` sale con 2), pídela en el modal y pásala con `--evidencia-cierre "<texto>"` (también a `verificar_matriz.py`). Se verifica solo que esa evidencia exista y no traiga datos reales: mismas reglas de arriba, capturas a ojo incluidas |
| sin `p5` (sale con 3) | El paso no aplica al nivel: dilo y no generes matriz. Si el líder insiste, pregunta la variante y pásala con `--variante` |

## 1. Generar la matriz

1. Lee el expediente. Si no tiene `historias[].criterios` con `como_verificar`, dilo: sin especificación no hay
   qué certificar (vuelve a `planear-sprint`). Avisa también si hay modos de falla sin `a_regresion` marcado.
2. `matriz.py --expediente <exp> --salida <C>/matriz-<slug>.xlsx --config <fuentes.yaml>`. Si
   `certificacion.plantilla_matriz` apunta a la plantilla de matriz del equipo (p. ej. la de regresión), se
   reutiliza llenando su hoja de matriz por nombre de columna; si no, sale el formato propio. Sin Excel: `.csv` o `.md`.
3. Entrega al líder la ruta, el conteo (criterios · calidad · modos de falla) y la instrucción para el dev:
   evidencias en `<C>/evidencias/<ID>/`, solo datos sintéticos.

## 2. Verificar la matriz llenada

1. `verificar_matriz.py --expediente <exp> --matriz <llenada> --evidencias <carpeta> --config <fuentes.yaml> --salida <C>/veredicto.json`
2. Si lista `revisar_a_ojo`, abre cada archivo. Si ves un dato real, repite con
   `--dato-real "<archivo>: <tipo>"` (sin copiar el dato); si todo está limpio, repite con `--imagenes-revisadas`.
3. Con el veredicto final, repite con `--escribir` para llenar `matriz_pruebas` y el chequeo `p5`.
4. Presenta: veredicto, filas que fallan o faltan, problemas de evidencia y, si es `rechazada`, **dónde** está
   cada dato (fila y columna o archivo, enmascarado) y qué hacer (borrar el archivo, tachar la captura, usar
   seudónimos). Una matriz rechazada no se guarda en ningún lado fuera de la carpeta de trabajo.

## 3. Retro y cierre

1. Horas reales: léelas en Jira (solo lectura: tiempo registrado de la historia y sus subtareas) o pídelas
   en el modal. `retro.py --expediente <exp> --horas-reales <h>` imprime el resumen (estimado vs. real,
   PR devueltos, CA que fallaron en revisión, filas en falla).
2. Propón 2-3 lecciones **con dato** («el CA-2 cambió en el desarrollo y nadie actualizó la historia»), nunca
   genéricas. El líder las elige en el modal; guárdalas con `retro.py … --leccion "<texto>" --escribir`.
3. Borradores, en `<C>/retro-correo.md` y `<C>/retro-comentario-jira.md` (forma en `references/retro.md`):
   - **Correo al equipo** en la voz del líder: usa la skill de voz del usuario si está instalada (`redactar`);
     si no, redacción sobria. Reconoce lo que salió bien con nombre propio y dice lo que se ajusta.
   - **Comentario de Jira** para la historia: veredicto, matriz, horas y enlace a la evidencia.
   Muéstralos completos en el chat y cierra con el modal: ¿ajusto algo? · los dejo listos para que los envíes.
4. Las lecciones alimentan la calibración de `planear-sprint` (lee `retro` de los expedientes cerrados).

## Cuándo NO usarla

- Revisar el código del PR contra los CA → `revisar-pr`.
- Regresión completa de un sistema contra la operación real → la skill de regresión del equipo, si existe.
- Planear o estimar el requerimiento → `planear-sprint`.

## Archivos

| Archivo | Cuándo |
|---|---|
| `references/retro.md` | Paso 3: estructura del correo y del comentario de Jira, qué lecciones sirven |
| `config-ejemplo.yaml` | Para crear la sección `certificacion` (plantilla, seudónimos, permitidos) |
| `scripts/*.py` | Se ejecutan (`base.py` es el módulo común: configuración y detector de datos personales). Pruebas: `python -I -m unittest discover -s "${CLAUDE_SKILL_DIR}/scripts/pruebas"` |
