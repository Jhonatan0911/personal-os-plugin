"""Utilidades comunes de worklist-lider: carpeta de estado, fuentes.yaml y la sección `flujo`.

Contrato de niveles: skills/planear-sprint/references/niveles.md del plugin.
"""
import copy
import json
import os
import re
import sys
from pathlib import Path

for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

PASOS = tuple(f"p{i}" for i in range(7))
# El flujo completo (lo que recorre todo caso sin sección `flujo` o con niveles_activos: false).
PASOS_COMPLETOS = {"p0": "completo", "p1": "completo", "p2": "completo", "p3": "completo",
                   "p4": "completo", "p5": "matriz", "p6": "completo"}
# Estados de Jira que cuentan como «en revisión del líder» si fuentes.yaml no dice otros.
# «Nombre*» = prefijo; sin distinguir mayúsculas.
REVISION_POR_DEFECTO = ["Listo para revisión", "En revisión*", "In Review*", "Code Review*"]
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def falla(msg):
    sys.exit("error: " + msg)


def os_home():
    e = os.environ.get("PERSONAL_OS_HOME")
    return Path(e).expanduser() if e else Path.home() / ".claude" / "personal-os"


def state_dir(arg=None):
    """--estado manda; si no, stateDir de ~/.claude/personal-os/config.json (o PERSONAL_OS_HOME)."""
    if arg:
        return Path(arg).expanduser().resolve()
    ruta = os_home() / "config.json"
    if not ruta.exists():
        falla(f"no encuentro {ruta}. Corre /os-setup o pasa --estado <carpeta de estado>.")
    try:
        sd = json.loads(ruta.read_text(encoding="utf-8-sig")).get("stateDir")
    except Exception as e:  # noqa: BLE001
        falla(f"{ruta} no es JSON válido: {e}")
    if not sd:
        falla(f"{ruta} no define \"stateDir\". Corre /os-setup o pasa --estado.")
    return Path(sd).expanduser().resolve()


def leer_config(ruta):
    """Lee un .yaml/.yml (PyYAML) o un .json. Archivo ausente = {}."""
    ruta = Path(ruta)
    if not ruta.exists():
        return {}
    texto = ruta.read_text(encoding="utf-8-sig")
    if ruta.suffix.lower() in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            falla("fuentes.yaml es YAML y falta PyYAML (pip install pyyaml); o pasa --fuentes con un JSON equivalente.")
        return yaml.safe_load(texto) or {}
    return json.loads(texto or "{}")


def fuentes(estado, ruta=None):
    return leer_config(ruta or Path(estado) / "config" / "fuentes.yaml")


def es_placeholder(v):
    s = str(v or "").strip()
    return not s or (s.startswith("<") and s.endswith(">"))


def flujo(fu):
    """Normaliza la sección `flujo`. Devuelve {activos, defecto, niveles{n: {nombre, minutos_lider, pasos}}}."""
    sec = (fu or {}).get("flujo") or {}
    niveles = {}
    for k, v in (sec.get("niveles") or {}).items():
        v = v or {}
        pasos = {p: str(x) for p, x in (v.get("pasos") or {}).items() if p in PASOS and x}
        niveles[str(k)] = {"nombre": str(v.get("nombre") or k), "minutos_lider": str(v.get("minutos_lider") or ""),
                           "ejemplos": str(v.get("ejemplos") or ""), "pasos": pasos}
    activos = bool(sec.get("niveles_activos")) and bool(niveles)
    defecto = str(sec.get("nivel_por_defecto") or "")
    if activos and defecto not in niveles:
        falla(f"flujo.nivel_por_defecto «{defecto}» no está en flujo.niveles ({', '.join(niveles)})")
    return {"activos": activos, "defecto": defecto if activos else "", "niveles": niveles if activos else {},
            "niveles_declarados": sorted(niveles)}


def nivel_efectivo(E, F):
    """(nivel, pasos) del expediente. Sin niveles activos: (None, flujo completo)."""
    if not F["activos"]:
        return None, dict(PASOS_COMPLETOS)
    n = str(E.get("nivel") or F["defecto"])
    return n, dict(F["niveles"].get(n, F["niveles"][F["defecto"]])["pasos"])


def estados_revision(fu):
    est = (((fu or {}).get("status_celula") or {}).get("estados") or {}).get("revision")
    return [str(x) for x in est] if isinstance(est, list) and est else list(REVISION_POR_DEFECTO)


def es_revision(estado, patrones):
    e = str(estado or "").strip().lower()
    for p in patrones:
        p = str(p).strip().lower()
        if (p.endswith("*") and e.startswith(p[:-1])) or e == p:
            return True
    return False


def leer_json(ruta):
    with open(ruta, encoding="utf-8-sig") as f:
        return json.load(f)


def escribir_json(ruta, datos, indent=None):
    os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=indent)


def clonar(o):
    return copy.deepcopy(o)
