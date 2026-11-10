"""Configuración y utilidades comunes de revisar-pr. Sin dependencias raras (PyYAML solo si la config es .yaml)."""
import copy, fnmatch, json, os, sys

for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

# Valores por defecto genéricos. Lo propio de una organización va en la sección `revision_pr`
# de la configuración del usuario (ver config-ejemplo.yaml), nunca aquí.
DEFECTO = {
    "azure_devops": {"organizacion": None, "proyectos": []},
    "rama": {
        "patron": r"^(feature|bugfix|hotfix)/(?P<clave>[A-Z][A-Z0-9]+-\d+)\+.+$",
        "patron_tolerante": r"(?P<clave>[A-Z][A-Z0-9]+-\d+)",
        "destinos": {"feature": ["develop"], "bugfix": ["develop"], "hotfix": ["staging"],
                     "develop": ["qa"], "qa": ["staging"], "staging": ["main"]},
    },
    "jira": {"estados_validos": []},
    "tamano_max_lineas": 400,
    "entregables_por_defecto": [],
    "excluir_de_ia": ["**/appsettings*.json", "appsettings*.json", "**/*.env", "*.env", "**/.env*", ".env*",
                      "**/*.pfx", "**/*.p12", "**/*.pem", "**/*.key", "**/*.bak", "**/*.dump",
                      "**/settings.local.json", "**/emails.json", "**/*.csv", "**/*.xlsx", "**/*.xls"],
    "no_tocar_de_la_rama": [".claude/**", ".mcp.json", "**/CLAUDE.md", "CLAUDE.md", ".vscode/**", ".githooks/**",
                            ".husky/**"],
    "patrones_extra": {"secretos": [], "pacientes": []},
    "proyectos_nuevos": {"dotnet_min": None, "angular_min": None, "guia_backend": None, "guia_frontend": None,
                         "repos_nuevos": [], "repos_legados": []},
    "feeds_internos_prefijos": [],
    "carpeta_trabajo": None,
    # Lo que todo PR cumple aunque su nivel no corra la revisión completa (variantes ia_y_humana y regla_minima):
    # si falla, la capa 0 lo sube a «alta» y el PR se devuelve.
    "regla_minima": {"rama_con_clave": True, "bd_con_rollback": True},
}


def _mezclar(base, extra):
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _mezclar(out[k], v)
        elif v is not None:
            out[k] = v
    return out


def leer_config(ruta):
    """El archivo de configuración completo (.yaml/.yml/.json) como dict. Sin ruta, {}."""
    if not ruta:
        return {}
    ruta = str(ruta)
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    if ruta.lower().endswith((".yaml", ".yml")):
        try:
            import yaml
        except ImportError:
            sys.exit("La configuración es YAML y falta PyYAML (pip install pyyaml), o pasa la sección como JSON.")
        return yaml.safe_load(texto) or {}
    return json.loads(texto)


def cargar_config(ruta=None, seccion="revision_pr"):
    """Lee la sección `seccion` de un .yaml/.yml/.json. Sin ruta, devuelve los valores por defecto."""
    if not ruta:
        return copy.deepcopy(DEFECTO)
    datos = leer_config(ruta)
    sec = datos.get(seccion)
    if sec is None and any(k in datos for k in DEFECTO):  # un JSON que ya es la sección
        sec = datos
    cfg = _mezclar(DEFECTO, sec or {})
    for k in ("excluir_de_ia", "no_tocar_de_la_rama"):  # estas listas se suman: el usuario no puede quitar las de fábrica
        cfg[k] = DEFECTO[k] + [p for p in cfg[k] if p not in DEFECTO[k]]
    return cfg


# ─── Nivel del caso (contrato: planear-sprint/references/niveles.md) ───────────────────────────────
# Duplicada a propósito en certificar-funcional/scripts/base.py: las skills se instalan sueltas.
VARIANTES_P4 = ("completo", "ia_y_humana", "regla_minima")


def resolver_nivel(config, exp=None, paso="p4", variante=None, validas=VARIANTES_P4, por_defecto="completo"):
    """Qué versión del paso corre este caso según `flujo` de fuentes.yaml y el `nivel` del expediente.

    `config` es la ruta de fuentes.yaml/.json o el dict ya leído. Sin sección `flujo` o con `niveles_activos`
    falso devuelve la variante de siempre (`por_defecto`). `variante` la fuerza (el líder insiste).
    Devuelve {niveles_activos, nivel, origen, paso, variante, aplica, forzado, aviso}.
    """
    datos = leer_config(config) if isinstance(config, (str, os.PathLike)) else (config or {})
    flujo = datos.get("flujo") or {}
    r = {"niveles_activos": bool(flujo.get("niveles_activos")), "nivel": None, "origen": "sin_flujo", "paso": paso,
         "variante": por_defecto, "aplica": True, "forzado": False, "aviso": None}
    if r["niveles_activos"]:
        propio = (exp or {}).get("nivel")
        r["origen"] = "expediente" if propio else "nivel_por_defecto"
        r["nivel"] = nivel = str(propio or flujo.get("nivel_por_defecto") or "C").upper()
        conf = (flujo.get("niveles") or {}).get(nivel)
        if conf is None:
            r["aviso"] = f"El nivel «{nivel}» no está en flujo.niveles: se usa la variante «{por_defecto}»."
        else:
            v = (conf.get("pasos") or {}).get(paso)
            if v is None:
                r.update(variante=None, aplica=False, aviso=f"El paso {paso} no aplica al nivel {nivel}.")
            elif v not in validas:
                r["aviso"] = f"Variante «{v}» de {paso} no reconocida en el nivel {nivel}: se usa «{por_defecto}»."
            else:
                r["variante"] = v
    if variante:
        if variante not in validas:
            sys.exit(f"Variante «{variante}» no válida para {paso} (válidas: {', '.join(validas)}).")
        r["forzado"] = variante != r["variante"]
        r.update(variante=variante, aplica=True)
    return r


def coincide(ruta, patrones):
    ruta = ruta.replace("\\", "/").lstrip("/")
    nombre = ruta.rsplit("/", 1)[-1]
    return any(fnmatch.fnmatch(ruta, p) or fnmatch.fnmatch(nombre, p) for p in patrones)


def enmascarar(valor, visibles=4):
    """Nunca se muestra un secreto ni un dato de paciente completo: solo sus primeros caracteres."""
    valor = str(valor).strip()
    if len(valor) <= visibles:
        return "*" * len(valor)
    return valor[:visibles] + "…[" + str(len(valor)) + " car.]"


def escribir_json(ruta, datos):
    os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)


def leer_json(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)
