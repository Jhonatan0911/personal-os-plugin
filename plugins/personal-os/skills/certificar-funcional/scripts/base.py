"""Utilidades comunes de certificar-funcional: configuración, JSON, normalización y detección de datos personales."""
import copy, json, os, re, sys, unicodedata

for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

DEFECTO = {
    "plantilla_matriz": None,      # .xlsx con una hoja de matriz (encabezados ID … Estado) para reutilizar
    "seudonimos": [r"(?i)\bPAC[-_ ]?\d+\b"],
    "permitidos": [],              # textos o regex de datos sintéticos que no son de personas reales
    "patrones_extra": [],          # [{nombre, patron, severidad}]
    "carpeta": None,               # por defecto <carpeta del expediente>/certificacion
}

ESTADOS = {"ok": "ok", "aprobado": "ok", "pasa": "ok", "paso": "ok", "cumple": "ok", "exitoso": "ok",
           "falla": "falla", "fallido": "falla", "fallo": "falla", "no pasa": "falla", "defecto": "falla", "no cumple": "falla",
           "pendiente": "pendiente", "en ejecucion": "pendiente", "no probado": "pendiente", "": "pendiente",
           "bloqueado": "bloqueado", "no aplica": "no_aplica", "n/a": "no_aplica", "na": "no_aplica"}


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t).strip().lower()


def estado(t):
    return ESTADOS.get(norm(t), "desconocido")


def cargar_config(ruta=None, seccion="certificacion"):
    cfg = copy.deepcopy(DEFECTO)
    if not ruta:
        return cfg
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    if ruta.lower().endswith((".yaml", ".yml")):
        try:
            import yaml
        except ImportError:
            sys.exit("La configuración es YAML y falta PyYAML (pip install pyyaml), o pásala como JSON.")
        datos = yaml.safe_load(texto) or {}
    else:
        datos = json.loads(texto)
    sec = datos.get(seccion)
    if sec is None and any(k in datos for k in DEFECTO):
        sec = datos
    for k, v in (sec or {}).items():
        if v is not None:
            cfg[k] = v if k != "seudonimos" else DEFECTO["seudonimos"] + list(v)
    return cfg


def leer_json(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def escribir_json(ruta, datos):
    os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)


def enmascarar(v, visibles=2):
    v = str(v).strip()
    return ("*" * len(v)) if len(v) <= visibles else v[:visibles] + "…[" + str(len(v)) + " car.]"


# ─── Datos de personas ─────────────────────────────────────────────────────────────────────────────
NOMBRE = r"[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+(?:la\s+)?)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}"
PATRONES = [
    ("documento", "alta",
     r"(?i)(?:c[eé]dula|documento(?:\s+de\s+identidad)?|identificaci[oó]n|n[uú]mero\s+de\s+documento|\bnuip\b|\bCC\b|\bTI\b|\bCE\b|\bRC\b)"
     r"\s*(?:n[o°º]\.?|#|:|=)?\s*(?P<v>\d[\d.]{5,13}\d)"),
    ("historia_clinica", "alta",
     r"(?i)(?:historia\s+cl[ií]nica|\bHC\b|n[uú]mero\s+de\s+ingreso|admisi[oó]n)\s*(?:n[o°º]\.?|#|:|=)?\s*(?P<v>\d{5,})"),
    ("nombre", "alta",
     r"(?:[Pp]aciente|[Nn]ombre(?:\s+del\s+paciente|\s+completo)?|[Uu]suario\s+atendido|[Ss]r\.|[Ss]ra\.|[Ss]eñor|[Ss]eñora)\s*[:=]?\s*(?P<v>" + NOMBRE + ")"),
    ("celular", "media", r"(?<![\d.])(?P<v>(?:\+?57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4})(?![\d.])"),
    ("correo", "media", r"(?P<v>[A-Za-z0-9._%+-]+@(?!example\.|ejemplo\.|test\.|prueba\.|dominio\.|correo\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,})"),
    ("fecha_nacimiento", "media",
     r"(?i)(?:fecha\s+de\s+nacimiento|nacid[oa]\s+el|f\.\s*nac\.?)\s*[:=]?\s*(?P<v>\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})"),
]
SINTETICO = re.compile(r"(?i)prueba|test|demo|ficticio|sint[eé]tico|ejemplo|dummy|fulano|mengano|zutano")


class Detector:
    def __init__(self, cfg):
        self.patrones = [(n, s, re.compile(p)) for n, s, p in PATRONES]
        for i, p in enumerate(cfg.get("patrones_extra") or []):
            p = p if isinstance(p, dict) else {"patron": p}
            self.patrones.append((p.get("nombre", f"extra_{i}"), p.get("severidad", "alta"), re.compile(p["patron"])))
        self.seudonimos = [re.compile(p) for p in cfg.get("seudonimos") or []]
        self.permitidos = cfg.get("permitidos") or []

    def _permitido(self, v):
        if SINTETICO.search(v) or any(rx.search(v) for rx in self.seudonimos):
            return True
        for p in self.permitidos:
            try:
                if p == v or re.fullmatch(p, v):
                    return True
            except re.error:
                if p == v:
                    return True
        return False

    def buscar(self, texto, donde):
        out = []
        for nombre, sev, rx in self.patrones:
            for m in rx.finditer(texto or ""):
                v = m.groupdict().get("v") or m.group(0)
                if self._permitido(v):
                    continue
                out.append({"tipo": nombre, "severidad": sev, "donde": donde, "valor": enmascarar(v), "_v": v})
        return out


def tachar(texto, valores):
    """Reemplaza cada dato detectado por una marca. Lo que sale a disco o al chat nunca lleva el dato."""
    texto = str(texto or "")
    for v in sorted(valores, key=len, reverse=True):
        texto = texto.replace(v, "«[dato personal tachado]»")
    return texto
