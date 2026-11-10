# Evaluar una skill

## Índice
1. Prueba rápida con subagentes (siempre)
2. Evals de disparo
3. Evals formales: `claude plugin eval`
4. Benchmark con `skill-creator`

## 1. Prueba rápida con subagentes (siempre)

Para cada uno de 2-3 pedidos realistas (con rutas, tono casual, un caso borde):
- Lanza **en el mismo turno** un subagente con la skill y otro sin ella (o con la versión anterior si
  es una mejora). Prompt: "Ejecuta esta tarea. Skill: <ruta o ninguna>. Tarea: <pedido>. Guarda la
  salida en <scratchpad>/eval-<n>/<con|sin>/".
- Anota de cada notificación los tokens y la duración (no quedan guardados en otro lado).
- Compara: ¿la skill corrigió la falla que viste sin ella? ¿cuántos tokens de más cuesta?
- Si los tres subagentes escribieron el mismo script auxiliar, ese script va a `scripts/`.

Una skill que no mejora el resultado frente a la base se retira o se reescribe: la base también se
mide, no se supone.

## 2. Evals de disparo

- 8-10 frases que **deben** activarla: distintas formas de pedir lo mismo, alguna sin nombrarla,
  alguna con errores de tipeo, en el idioma real del usuario.
- 8-10 que **no**: casi-aciertos que comparten palabras clave pero necesitan otra cosa. Las negativas
  obvias no prueban nada.
- Los pedidos deben ser sustanciales: una tarea de un paso no dispara ninguna skill.
- Para optimizar la descripción automáticamente (60/40 entrenamiento/prueba, 3 corridas por frase),
  usa el script de `skill-creator` (§4).

## 3. Evals formales: `claude plugin eval`

Para skills dentro de un plugin (Claude Code ≥ 2.1.269). Cada caso corre con y sin el plugin.

```
evals/<caso>/prompt.md            # el pedido; frontmatter: max_turns, timeout_seconds, runs, allowed_tools
evals/<caso>/graders/disparo.md   # comprueba que se usó la skill
evals/<caso>/graders/<otro>.md    # regex | tool_used | tool_order | file_exists | llm | baseline
```

Grader de disparo:
```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?nombre-de-la-skill"'
---
```

Comandos: `claude plugin eval init` (propone casos), `claude plugin eval .` (corre; `--case`,
`--runs`, `--threshold`, `--allow-tools`). Resultado en `evals/results/<fecha>/report.html`. Cada
corrida es una llamada real al modelo: avisa el costo antes de lanzar muchas. Confirma flags con
`claude plugin eval --help`.

## 4. Benchmark con `skill-creator`

Cuando el usuario quiera rigor (varias iteraciones, visor para revisar salidas, optimización de la
descripción), invoca la skill `skill-creator`: trae `run_loop.py` (optimiza la descripción),
`aggregate_benchmark.py`, el visor `generate_review.py` y agentes de calificación y comparación
ciega. Su formato es `evals/evals.json`, distinto del de `claude plugin eval`: no mezclarlos.
