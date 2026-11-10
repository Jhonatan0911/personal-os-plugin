# Expediente del requerimiento

Léelo en la Fase 1-bis (armar el expediente) y cuando el líder pida actualizar el requerimiento.

## 1. Dónde vive y quién lo usa

- **Fuente única:** `<stateDir>/requerimientos/<slug>/expediente.json`. El `slug` es corto y estable
  (`proyecto-tema`, sin fecha ni responsable). La copia local manda.
- **Copias:** la página del cronograma la carga en su base (colección `expediente`, documento `actual`)
  para su chat, y la lista de trabajo del líder, si existe, la carga en la suya. Antes de reescribir la
  copia local, lee la de la página (`ArtifactData get`): si su `version` es mayor (alguien usó
  «Actualizar requerimiento»), mezcla primero esos cambios. Nunca dos verdades.
- **Nunca se incrusta en el HTML** (la página se comparte y el expediente cambia).

## 2. Esquema v2 (extiende el v1 sin romperlo)

```json
{
  "esquema": 2, "version": 1, "actualizado": "AAAA-MM-DD",
  "id": "slug", "tipo": "requerimiento|bug", "titulo": "Nombre corto", "jira": ["PROY-142"], "modulos": ["hc"],
  "resumen": "Qué se pide y para qué, en 3-5 líneas",
  "cabecera": {"descripcion_corta": "", "cliente": "", "solicitante": "", "motivo": "", "para_que": "",
               "expectativas": "alta|media|baja", "pedido_por_gerencia": false, "prioridad_wsjf": null,
               "fecha_compromiso": null, "responsables": []},
  "paso_actual": 0,
  "chequeos": {"p0": {"estado": "aceptado|parcial|por_entender|pendiente", "fecha": null, "nota": ""},
               "p1": {}, "p2": {}, "p3": {}, "p4": {}, "p5": {}, "p6": {}},
  "refutacion": [{"punto": "", "tipo": "norma|producto|clinico|alcance|pregunta", "afecta": [],
                  "interes_usuario": "", "acepta": "", "refuta": "", "regla": "", "fuente": "",
                  "alternativa": "", "costo": "", "estado": "propuesta|aceptada|descartada"}],
  "impacto": {"criticidad_modulo": {"transaccionalidad": 0, "dinero": 0, "norma": 0, "usuarios": 0, "reversibilidad": 0},
              "peso_operacion": "", "modos_falla": [{"modo": "", "efecto": "", "severidad": 0, "a_regresion": true}]},
  "calidad": [{"id": "QA-1", "atributo": "rendimiento", "escenario": "", "medida": "", "como_verificar": ""}],
  "adr": [{"id": "ADR-1", "decision": "", "contexto": "", "consecuencias": ""}],
  "proyectos": [{"repo": "", "remoto": "", "rama": ""}],
  "historias": [{"clave": "PROY-142", "titulo": "", "resumen": "",
                 "criterios": [{"id": "CA-1", "texto": "", "como_verificar": ""}]}],
  "subtareas": [{"clave": null, "titulo": "", "historia": "PROY-142", "contexto": "", "que_hacer": "", "donde": "",
                 "no_tocar": "", "criterios": ["CA-1"], "entregables": ["tests", "docs", "script_bd+rollback"], "horas": 0}],
  "nivel": "A|B|C (opcional; ver niveles.md)",
  "ficha_corta": {"que": "", "para_cuando": "", "quien_pidio": "", "evidencia_cierre": "", "fuente": "F1"},
  "compromisos": [{"id": "K1", "fecha": "", "que": "", "a_quien": "", "fuente": "F2",
                   "estado": "vigente|cumplida|incumplida|reemplazada", "reemplaza": null, "nota": ""}],
  "cortes": [{"fecha": "", "que_se_revisa": "", "criterios": ["CA-1"], "responsable": "",
              "tipo": "desarrollo|revision_lider|tercero|validacion|acta", "fuente": null,
              "estado": "pendiente|ok|desviado", "nota": ""}],
  "pendientes": [{"id": "P1", "texto": "", "a_quien": "", "desde": "", "bloquea": ["CA-2"],
                  "estado": "abierto|resuelto", "resolucion": "", "fuente": "F2"}],
  "decisiones": [{"id": "D1", "texto": "", "quien": "", "fecha": "", "fuente": "F3"}],
  "riesgos": [{"id": "R1", "texto": "", "fuente": "F1"}],
  "hallazgos_codigo": [{"id": "H1", "texto": "… (repo/archivo:línea)", "fuente": "F4"}],
  "cronograma": "Fases del cliente en una línea, tal cual",
  "fuentes": [{"id": "F1", "tipo": "jira|correo|acta|especificación|mockup|código|transcripción|norma",
               "titulo": "", "fecha": "", "ref": "clave, asunto, ruta o URL"}],
  "historial": [{"fecha": "", "resumen": "Creado en la planeación"}],
  "revisiones_pr": [], "matriz_pruebas": [], "documentacion": {}, "retro": {}
}
```

- `nivel`, `ficha_corta`, `compromisos` y los campos `responsable`/`tipo`/`fuente` de `cortes` son
  opcionales (contrato en `niveles.md`). **Toda fecha prometida al cliente va en `compromisos[]`**: si se
  mueve, se agrega una nueva con `reemplaza` y la vieja queda `reemplazada` o `incumplida`, nunca se
  sobreescribe. El vigía persigue los `cortes` pendientes y los `compromisos` vigentes.
- `revisiones_pr`, `matriz_pruebas`, `documentacion` y `retro` los llenan los pasos 4 a 6 (otras
  skills); esta skill los crea vacíos.
- **Compatibilidad con v1:** un expediente sin `esquema` es v1 (`requerimiento`, `historias[].key`). La
  página y el generador aceptan `key` o `clave`. Al actualizar un v1, conviértelo: `requerimiento` →
  `titulo`, `key` → `clave`, `esquema: 2`, `chequeos.p0.estado: "pendiente"`, y nada se borra.
- La página agrega sola `decisiones_lider` y `estimaciones`. Una decisión que otra reemplaza lleva
  `reemplazada_por`; no se borra.

## 3. Reglas

- **Cada afirmación lleva su fuente** (`fuente` → `fuentes[].id`). Sin fuente no entra: el chat responde
  citando, y una cita vacía no le sirve al líder frente al cliente.
- Lo que el cliente ya respondió va como **decisión**, y su pendiente pasa a `resuelto` con la
  `resolucion`, aunque la historia en Jira aún lo muestre abierto.
- Un pendiente dice **a quién** (nombre corto), **desde cuándo** y **qué CA bloquea**: un bloqueo de un
  tercero que nadie persigue termina siendo un incumplimiento propio, y uno sin `bloquea` frena todo.
- Sin secretos ni datos sensibles de personas: proyecciones mínimas.
- El generador lo valida si el plan trae `"expediente": "<ruta>"` (secciones, fuentes y, en v2, chequeo
  del paso 0 y refutación) y avisa.

## 4. «Actualizar requerimiento»

1. Un **analista** busca novedades desde `actualizado`: hijas nuevas de la `epica`, cambios y comentarios
   en las historias, y —si hay conector de correo— correos con los `correos_busqueda`.
2. Un **revisor** debate cada novedad contra el expediente: ¿contradice algo decidido?, ¿la fuente alcanza?,
   ¿es repetida?
3. El líder marca qué se aplica; se sube `version` y se anota en `historial`.

Si el líder lo pide desde Claude Code, haz lo mismo con subagentes de solo lectura, escribe la copia
local y luego la de la página con `ArtifactData` pasando `if_version` (si alguien la cambió en la página,
relee y mezcla; no pises). Si la novedad cambia el alcance, vuelve a correr el refutador sobre lo nuevo.
