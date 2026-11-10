# Configuración de planear-sprint

Léelo en la Fase 0 cuando falte algo de la configuración, al armar el `plan.json` o al activar un perfil
de organización o de marca.

## 1. Claves de `<stateDir>/config/fuentes.yaml`

| Clave | Para qué | Si falta |
|---|---|---|
| `jira.sitio`, `jira.cloud_id`, `jira.proyectos` | Leer historias; enlaces y exportación de la página | `cloud_id` sale de `getAccessibleAtlassianResources`; nunca se adivina |
| `jira.tipo_subtarea`, `jira.campo_inicio` | Tipo exacto de subtarea e id del campo de fecha de inicio | Metadato del proyecto en Jira (lectura) o se pregunta |
| `equipo[]` | `nombre`, `rol`, `account_id`, `nivel`, `familiaridad` por frente | Se pregunta y se guarda con fuente y fecha |
| `m365.outlook` | Si hay correo para buscar respuestas y bloqueos | Sin correo: solo Jira |
| `rutas.perfil_voz` | Voz del usuario para el borrador del correo de escalada | Redacción neutra |
| `planeacion.capacidad_diaria` | Horas de desarrollo por día para poner fechas | 7,5 h lunes a jueves, 7 h viernes |
| `planeacion.matriz_archivo` | Ruta a un YAML de matriz completo (forma de `matriz-tiempos-ejemplo.yaml`) | `<stateDir>/config/estimaciones/matriz-tiempos.yaml` si existe |
| `planeacion.matriz_tiempos` | Matriz en línea (referencias cortas o tipos con `base`) | — |
| `planeacion.niveles` | Nombres de nivel válidos | Los de la matriz |
| `planeacion.perfil` | JSON de perfil de la organización para el generador (§3) | Sin perfil |
| `planeacion.marca` | JSON de marca del cronograma (§4) | Página neutra |
| `planeacion.carpeta_trabajo` | Dónde dejar `plan.json`, `expediente.json` y el HTML | `<stateDir>/estimaciones/<slug>/` |
| `planeacion.tablero_central` | `{url, coleccion}` del tablero donde se registran los cronogramas | No se registra |
| `planeacion.mineria_dir` | Salidas de la minería de estimaciones | `<stateDir>/estimaciones/mineria/` |
| `planeacion.minero_dir` | Carpeta con los encargos/scripts propios del minero, si el usuario los tiene | Se usan los encargos de `calibracion.md` |
| `planeacion.catalogo_matriz_url` | Página publicada de la matriz donde el líder decide tipo por tipo | Propuesta en el chat |
| `planeacion.investigacion` | Documento propio con la base de las reglas de estimación | Las reglas de la skill |

## 2. Qué matriz se usa (en este orden)

1. `planeacion.matriz_archivo` (o el archivo por defecto de la tabla, si existe).
2. `planeacion.matriz_tiempos` en línea, **si trae tipos con `base`**.
3. `${CLAUDE_SKILL_DIR}/matriz-tiempos-ejemplo.yaml`, y se **dice** en el resumen («estimado con la matriz
   por defecto del plugin»). Ofrece copiarla a `matriz_archivo` para ajustarla.

Nivel y familiaridad por persona salen de `equipo` o, si la matriz trae una sección `personas`
(`<id>: {nivel, familiaridad: {<frente>: alta|media|nula}, fuente}`), de ahí. Si están en los dos sitios y
difieren, pregunta cuál vale. Solo hechos declarados, con fuente y fecha; nunca deducir el nivel de nadie.

## 3. Perfil de organización (`--perfil`)

Valores por defecto del plan que no cambian de un sprint a otro. El plan manda; el perfil solo llena lo
que falte (`jira`, `correo` y `cuentas` se mezclan campo por campo). Sirve también para regenerar planes
viejos que no traían la sección `jira`.

```json
{
  "jira": {"sitio": "<tu-sitio>.atlassian.net", "cloud_id": "<cloudId>", "servidor_mcp": "Atlassian Rovo",
           "tipo_subtarea": "<tipo de subtarea>", "campo_inicio": "<customfield_NNNNN o null>"},
  "correo": {"servidor_mcp": "Microsoft 365"},
  "lider": "<nombre de quien planea>",
  "quien_define": "<quién define lo pendiente, p. ej. el gerente del proyecto con el cliente>",
  "personas": ["<Nombre como aparece en Jira>", "..."],
  "cuentas": {"<Nombre>": "<accountId>"},
  "capacidad": [7.5, 7],
  "marca": "marca-cronograma.json"
}
```

Las rutas relativas del perfil se resuelven desde su carpeta. Guárdalo en `<stateDir>/config/` (privado).

## 4. Marca del cronograma (`--marca`, `--logo`)

La plantilla es neutra. Una marca sobrescribe variables CSS y pone un logo en la franja superior:

```json
{
  "nombre": "<Nombre de la empresa>",
  "logo": "<logo claro sobre fondo oscuro>.png",
  "claro":  {"--brand": "#123456", "--deep": "#…", "--action": "#…", "--mid": "#…",
             "--band-sub": "#…", "--ph-pru": "#…", "--shade-rgb": "18,52,86"},
  "oscuro": {"--bg": "#…", "--panel": "#…", "--card": "#…", "--brand": "#…", "--deep": "#…", "--action": "#…"}
}
```

- Variables útiles: `--brand` (franja), `--deep` (encabezados), `--action` (botones y barras), `--mid`,
  `--band-sub` (subtítulo de la franja), `--ph-pru` (fase de pruebas), `--shade-rgb` (sombra de modales,
  como `r,g,b`), y las de fondo y texto (`--bg`, `--panel`, `--card`, `--ink`, `--muted`, `--line`).
- El logo va incrustado (png, svg, jpg o webp); `--logo` manda sobre el de la marca. Usa la versión clara:
  la franja es oscura.
- **Activarla:** guarda el JSON (y el logo) en `<stateDir>/config/marca/`, apunta `planeacion.marca` a él
  (o ponlo como `marca` del perfil) y la skill pasa `--marca` al generar. La marca de una organización
  nunca va dentro del plugin.

## 5. Del config al `plan.json`

`jira` ← `fuentes.yaml → jira` · `correo.servidor_mcp` ← `"Microsoft 365"` solo si `m365.outlook` ·
`capacidad` ← `capacidad_diaria` · `personas` y `cuentas` ← `equipo` · `lider` ← `owner.nombre` ·
`expediente` ← ruta de `expediente.json` · `epica` y `correos_busqueda` ← Fase 0. Formato completo en el
docstring de `generar_cronograma.py` y en `plan-ejemplo.json`.
