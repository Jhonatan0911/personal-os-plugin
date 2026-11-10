# Configuración y base de la Worklist del líder

Léelo para configurar `fuentes.yaml`, poner una marca o entender qué guarda la base de la página.

## 1. Lo que lee `build.py` de `<stateDir>/config/fuentes.yaml`

| Clave | Para qué | Sin ella |
|---|---|---|
| `flujo` | Niveles, nombres y pasos por nivel (contrato en `planear-sprint/references/niveles.md`) | Todo caso recorre el flujo completo; no hay filtro de nivel |
| `jira.cloud_id` | El chat consulta Jira (solo lectura) | El chat solo lee el expediente |
| `jira.sitio` | Las claves enlazan a `https://<sitio>/browse/<clave>` | Las claves salen como texto |
| `jira.servidor_mcp` | Nombre visible del conector de Jira en claude.ai (texto o lista: se prueba en orden) | «Atlassian Rovo» |
| `m365.outlook` | `false` quita las herramientas de correo del chat | Correo con el conector «Microsoft 365» |
| `status_celula.estados.revision` | Estados que forman la cola del líder («Nombre*» = prefijo) | «Listo para revisión», «En revisión*», «In Review*», «Code Review*» |
| `owner.nombre` | El chat se dirige al líder por su nombre | «el líder técnico» |

Sección opcional propia (todas sus claves son opcionales):

```yaml
worklist:
  url: "<url del Artifact>"            # para republicar en el mismo enlace
  marca: "marca/marca-worklist.json"     # relativa a la carpeta de fuentes.yaml
  conector_jira: "Atlassian Rovo"        # manda sobre jira.servidor_mcp
  conector_correo: "Microsoft 365"       # "" = sin correo
```

Si en claude.ai hay dos conectores de Jira con el mismo nombre visible, el chat responde `server_ambiguous`:
renombra o quita el duplicado en la configuración de conectores.

## 2. Marca (opcional)

Misma forma que la de planear-sprint. Sin marca, la página es neutra y sin logo.

```json
{"nombre": "Mi empresa", "logo": "logo-blanco.svg",
 "claro":  {"--marca": "#1B2A4A", "--accion": "#2F5BB7", "--profundo": "#1B2A4A"},
 "oscuro": {"--accion": "#86A8EC"}}
```

`--marca` es la franja superior (el logo va sobre ella: usa la versión clara). Otras variables: `--medio`,
`--sel`, `--fondo`, `--linea`, `--tinta`, `--gris`. `build.py --logo <imagen>` manda sobre el logo de la marca.

## 3. La base de la página

| Colección | Quién la escribe | Contenido |
|---|---|---|
| `req/<slug>` | `cargar.py` | Índice de la lista: título, tipo, **nivel**, paso, criticidad, dudas, completitud (y por nivel), compromiso vigente, próximo corte |
| `expediente/<slug>` | `cargar.py` | El expediente normalizado: pasos que no aplican = `no_aplica` (`por_nivel: true`), `completitud` y `completitud_niveles` |
| `cola/actual` | `cargar.py` desde `_cola_revision.json` | La cola de revisión agrupada por caso |
| `marcas/<slug>` | La página (el líder) | Chequeos, paso actual, **nivel**, estado de pendientes, campos simples de la cabecera y notas |
| `criticidad/<modulo>` | Skill mapa-criticidad (opcional) | Criticidad de los módulos de los casos sin ficha de impacto |

Las marcas se superponen al expediente en la página, así que no se pierden al recargar.

## 4. Completitud por nivel

Solo cuentan los chequeos de los pasos que aplican al nivel, según su variante:

| Paso y variante | Chequeos |
|---|---|
| p0 `completo` | descripción, cliente, quién lo pidió, por qué, para qué, importancia, ¿gerencia?, WSJF, fecha de compromiso, historias, CA-n |
| p0 `corto` | ficha corta: qué, para cuándo, quién lo pidió, evidencia de cierre |
| p0 (cualquiera) | responsables, chequeo del paso 0 |
| p1 `completo` / `corto` | criticidad en 5 ejes, peso, modos de falla / módulo ubicado |
| p2 `completo` | escenarios de calidad, ADR, proyectos y ramas |
| p3 `completo` | subtareas, subtareas como instrucción, cortes |
| p6 `completo` | documentación |
| siempre | paso actual |

Con el flujo completo son los 24 chequeos de siempre. p4 y p5 los llenan revisar-pr y certificar-funcional.

## 5. Detalle corto

Los niveles cuyo `pasos.p0` es `corto` abren la ficha corta (qué, para cuándo, quién lo pidió, evidencia de
cierre, responsables), la barra de pasos con los que no aplican en «No aplica», la completitud del nivel, las
notas, los compromisos y los cortes (con responsable y tipo). El botón «Ver el expediente completo» abre el resto.
