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
}


def _mezclar(base, extra):
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _mezclar(out[k], v)
        elif v is not None:
            out[k] = v
    return out


def cargar_config(ruta=None, seccion="revision_pr"):
    """Lee la sección `seccion` de un .yaml/.yml/.json. Sin ruta, devuelve los valores por defecto."""
    if not ruta:
        return copy.deepcopy(DEFECTO)
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    if ruta.lower().endswith((".yaml", ".yml")):
        try:
            import yaml
        except ImportError:
            sys.exit("La configuración es YAML y falta PyYAML (pip install pyyaml), o pasa la sección como JSON.")
        datos = yaml.safe_load(texto) or {}
    else:
        datos = json.loads(texto)
    sec = datos.get(seccion)
    if sec is None and any(k in datos for k in DEFECTO):  # un JSON que ya es la sección
        sec = datos
    cfg = _mezclar(DEFECTO, sec or {})
    for k in ("excluir_de_ia", "no_tocar_de_la_rama"):  # estas listas se suman: el usuario no puede quitar las de fábrica
        cfg[k] = DEFECTO[k] + [p for p in cfg[k] if p not in DEFECTO[k]]
    return cfg


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
