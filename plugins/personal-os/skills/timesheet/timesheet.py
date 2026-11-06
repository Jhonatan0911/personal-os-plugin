#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Personal OS · motor genérico del timesheet.

Arma el timesheet a partir de las líneas TS de la bitácora del Personal OS, lo valida contra
la configuración del usuario (~/.claude/personal-os/config.json → "timesheet"), lo cuadra
contra la jornada, reporta huecos, solapes y cobertura con issue, y exporta el archivo de
envío (CSV siempre; XLSX si openpyxl está instalado).

Nada de lo que valida está fijo aquí: jornada, categorías, clientes, formato de clave,
palabras prohibidas y meta de cobertura salen de config.json.

Contrato de la línea TS (una por tramo laboral, en <stateDir>/bitacora/AAAA-MM-DD.md):
  - **TS:** HH:MM-HH:MM | PROY-123 | Categoría | Cliente | est=4h | qué se hizo | evidencia
  (clave SIN-ISSUE —o SIN-JIRA— si de verdad no hay issue; est=SIN-EST si la issue no tiene horas)

Uso:
  python3 timesheet.py dia AAAA-MM-DD [--agenda agenda.json] [--equipo equipo.json]
  python3 timesheet.py semana AAAA-MM-DD
  python3 timesheet.py exportar --desde AAAA-MM-DD --hasta AAAA-MM-DD [--formato csv|xlsx]

Opciones comunes: --config <config.json>  --estado <carpeta de estado>  --hoy AAAA-MM-DD

Reglas que el motor no negocia:
  · No rellena horas: lo que no tiene línea TS queda como HUECO declarado.
  · Las horas fuera de la jornada configurada no entran como filas (las horas extra van en
    su propio formato, fuera de este timesheet).
  · Toda fila lleva fecha, clave de issue (o SIN-ISSUE permitido) y cliente.
  · Nunca envía nada: deja el archivo en <stateDir>/timesheet/ para adjuntarlo.

Solo usa la biblioteca estándar de Python 3.8+; openpyxl es opcional (solo para XLSX).
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

try:  # la consola de Windows no siempre habla UTF-8
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

RE_TS = re.compile(r"^\s*-\s*\*\*TS:\*\*\s*(.+?)\s*$")
RE_RANGO = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
RE_EST = re.compile(r"(?i)^\s*(?:est\s*=\s*)?(\d+(?:[.,]\d+)?)\s*h?\s*$")
CLAVES_SIN_ISSUE = {"SIN-ISSUE", "SIN-JIRA"}
SIN_ISSUE = "SIN-ISSUE"
SIN_EST = "SIN-EST"
RELLENOS = {"", "-", "--", "n/a", "na", "n.a.", "ninguno", "sin cliente", "varios", "?", ".", "x"}
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
CLAVE_DEFECTO = r"^[A-Z][A-Z0-9]{1,9}-\d+$"
# Una reunión del calendario se da por registrada si las filas cubren al menos esta fracción:
# la reunión que se corrió diez minutos sigue siendo la misma reunión.
CUBRE_MIN = 0.5
# Identificadores que solo existen en notas privadas y que el lector del timesheet no puede
# rastrear. Es aviso, no error: pueden aparecer falsos positivos.
CODIGOS_INTERNOS = [
    (re.compile(r"\b[A-Z]-\d{1,4}\b"), "identificador de una sola letra (tipo «D-9», «C-011»)"),
    (re.compile(r"(?i)\bpunto\s+\d+\s+del\s+mvp\b"), "«punto N del MVP»"),
    (re.compile(r"(?i)\bpendiente\s+#\s*\d+"), "«pendiente #N»"),
]


# ------------------------------------------------------------------ utilidades
def st(s):
    """Minúsculas y sin tildes: las consolas manglan acentos y el usuario escribe rápido."""
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "").strip().lower())
                   if unicodedata.category(c) != "Mn")


def a_min(hhmm):
    h, m = str(hhmm).strip().split(":")
    h, m = int(h), int(m)
    if not (0 <= h <= 24 and 0 <= m < 60) or (h == 24 and m):
        raise ValueError(hhmm)
    return h * 60 + m


def hm(minutos):
    minutos = int(round(minutos))
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def horas(minutos):
    return round(minutos / 60.0, 2)


def solape(a1, a2, b1, b2):
    return max(0, min(a2, b2) - max(a1, b1))


def fecha_iso(s):
    try:
        return dt.date.fromisoformat(str(s))
    except ValueError:
        sys.exit(f"Fecha inválida: '{s}' (usa AAAA-MM-DD).")


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", st(s)).strip("-")
    return s or "usuario"


def fmt_num(x, decimal):
    t = f"{x:.2f}"
    return t.replace(".", ",") if decimal == "," else t


# ------------------------------------------------------------------ configuración
def os_home():
    e = os.environ.get("PERSONAL_OS_HOME")
    return Path(e).expanduser().resolve() if e else Path.home() / ".claude" / "personal-os"


class Conf:
    """La sección "timesheet" de config.json, ya normalizada. Las claves opcionales que el
    motor entiende además de la plantilla: pausas, planeacionInicial, formatoEnvio."""

    def __init__(self, ruta_config=None, estado=None):
        ruta = Path(ruta_config) if ruta_config else os_home() / "config.json"
        if not ruta.exists():
            sys.exit(f"No encuentro la configuración en {ruta}. Corre /os-setup o define "
                     "la variable PERSONAL_OS_HOME.")
        try:
            cfg = json.loads(ruta.read_text(encoding="utf-8-sig"))
        except Exception as e:
            sys.exit(f"{ruta} no es JSON válido: {e}")
        ts = cfg.get("timesheet")
        if not isinstance(ts, dict):
            sys.exit(f"{ruta} no tiene la sección \"timesheet\". Cópiala de la plantilla del "
                     "plugin (plantillas/config.json) y ajústala.")
        self.avisos_config = []
        self.ruta = ruta
        self.owner = str(cfg.get("owner") or "").strip()
        sd = estado or cfg.get("stateDir")
        if not sd:
            sys.exit("config.json no define \"stateDir\" (la carpeta de estado). Corre /os-setup.")
        self.state_dir = Path(sd).expanduser().resolve()
        self.bitacora = self.state_dir / "bitacora"
        self.salida = self.state_dir / "timesheet"
        self.festivos = {str(x) for x in (cfg.get("festivos") or [])}
        self.zona = cfg.get("zonaHoraria") or None
        self.tz = None
        if self.zona:
            try:
                from zoneinfo import ZoneInfo
                self.tz = ZoneInfo(self.zona)
            except Exception:
                self.avisos_config.append(
                    f"no pude cargar la zona horaria '{self.zona}' (en Windows hace falta "
                    "`pip install tzdata`); uso la hora local del sistema")

        jor = ts.get("jornada")
        if not isinstance(jor, dict):
            jor = {"lun": 8, "mar": 8, "mie": 8, "jue": 8, "vie": 8, "sab": 0, "dom": 0}
            self.avisos_config.append("timesheet.jornada no está definida: asumo 8 h de lunes a viernes")
        self.jornada = {d: float(jor.get(d) or 0) for d in DIAS}
        try:
            self.inicio = a_min(ts.get("inicioJornada") or "08:00")
        except Exception:
            sys.exit(f"timesheet.inicioJornada inválido: '{ts.get('inicioJornada')}' (usa HH:MM).")

        self.pausas = []
        for p in ts.get("pausas") or []:
            try:
                if isinstance(p, dict):
                    a, b = a_min(p["desde"]), a_min(p["hasta"])
                else:
                    a, b = (a_min(x) for x in str(p).split("-", 1))
                if b > a:
                    self.pausas.append((a, b))
            except Exception:
                self.avisos_config.append(f"pausa ilegible en timesheet.pausas: {p!r}")
        self.pausas.sort()

        cats = [str(c).strip() for c in (ts.get("categorias") or []) if str(c).strip()]
        if not cats:
            sys.exit("timesheet.categorias está vacío: define tus categorías en config.json.")
        self.categorias = {st(c): c for c in cats}
        self.alias = {}
        for k, v in (ts.get("aliasCategorias") or {}).items():
            destino = self.categorias.get(st(v))
            if destino:
                self.alias[st(k)] = (str(k), destino)
            else:
                self.avisos_config.append(f"aliasCategorias: '{k}' apunta a '{v}', que no está en categorias")
        self.cats_reunion = {self.categorias.get(st(c), c) for c in ts.get("categoriasReunion") or []}
        self.cats_sin_issue = {self.categorias.get(st(c), c) for c in ts.get("categoriasSinIssuePermitidas") or []}
        self.clientes = {st(c): str(c) for c in (ts.get("clientes") or []) if str(c).strip()}
        self.cliente_interno = str(ts.get("clienteInterno") or "").strip() or None
        rd = ts.get("reunionesExigenIssueDesde")
        self.reuniones_desde = None
        if rd:
            try:
                self.reuniones_desde = dt.date.fromisoformat(str(rd))
            except ValueError:
                self.avisos_config.append(f"reunionesExigenIssueDesde ilegible: '{rd}' (se ignora)")
        try:
            self.re_clave = re.compile(ts.get("formatoClave") or CLAVE_DEFECTO)
        except re.error:
            self.avisos_config.append("formatoClave no es una expresión regular válida: uso la de defecto")
            self.re_clave = re.compile(CLAVE_DEFECTO)
        self.prohibidos = [str(w) for w in (ts.get("prohibidoEnTarea") or []) if str(w).strip()]
        meta = float(ts.get("metaCoberturaIssue", 0.9) or 0)
        self.meta = meta / 100.0 if meta > 1 else meta

        pl = ts.get("planeacionInicial")
        self.planeacion = None
        if isinstance(pl, dict) and int(pl.get("minutos") or 0) > 0:
            self.planeacion = {
                "minutos": int(pl["minutos"]),
                "clave": str(pl.get("clave") or SIN_ISSUE),
                "categoria": str(pl.get("categoria") or ""),
                "cliente": str(pl.get("cliente") or self.cliente_interno or ""),
                "tarea": str(pl.get("tarea") or "Planeación del día y organización de prioridades"),
            }
        fe = str(ts.get("formatoEnvio") or "csv").lower()
        self.formato_envio = fe if fe in ("csv", "xlsx") else "csv"

    # ---- jornada
    def ventanas(self, fecha):
        """Tramos laborables del día (en minutos), descontando las pausas configuradas.
        Día no hábil (fin de semana con jornada 0 o festivo) → lista vacía."""
        if fecha.isoformat() in self.festivos:
            return []
        objetivo = int(round(self.jornada[DIAS[fecha.weekday()]] * 60))
        if objetivo <= 0:
            return []
        out, cursor, falta = [], self.inicio, objetivo
        for a, b in self.pausas:
            if b <= cursor:
                continue
            if a > cursor:
                tramo = min(falta, a - cursor)
                out.append((cursor, cursor + tramo))
                falta -= tramo
                if falta <= 0:
                    break
            cursor = max(cursor, b)
        if falta > 0:
            out.append((cursor, min(cursor + falta, 24 * 60)))
        return out

    def ahora(self):
        n = dt.datetime.now(self.tz) if self.tz else dt.datetime.now()
        return n.date(), n.hour * 60 + n.minute


# ------------------------------------------------------------------ bitácora
def leer_ts(conf, fecha):
    """Líneas TS de la bitácora del día, en el orden en que se escribieron."""
    ruta = conf.bitacora / f"{fecha.isoformat()}.md"
    if not ruta.exists():
        return [], []
    buenas, malas = [], []
    for n, linea in enumerate(ruta.read_text(encoding="utf-8-sig").splitlines(), 1):
        m = RE_TS.match(linea)
        if not m:
            continue
        p = [x.strip() for x in m.group(1).split("|")]
        if len(p) < 6:
            malas.append({"linea": n, "error": f"tiene {len(p)} campos y se esperan al menos 6",
                          "texto": linea.strip()})
            continue
        r = RE_RANGO.match(p[0])
        try:
            if not r:
                raise ValueError(p[0])
            d = a_min(f"{r.group(1)}:{r.group(2)}")
            h = a_min(f"{r.group(3)}:{r.group(4)}")
        except ValueError:
            malas.append({"linea": n, "error": f"rango horario ilegible '{p[0]}' (usa HH:MM-HH:MM)",
                          "texto": linea.strip()})
            continue
        if h <= d:
            malas.append({"linea": n, "error": f"rango '{p[0]}' invertido o vacío (una fila no "
                          "cruza la medianoche: pártela en dos días)", "texto": linea.strip()})
            continue
        evid = " | ".join(x for x in p[6:] if x)
        if st(evid).startswith("evid="):
            evid = evid[5:].strip()
        buenas.append({"linea": n, "desde": d, "hasta": h, "clave_raw": p[1],
                       "cat_raw": p[2], "cli_raw": p[3], "est_raw": p[4],
                       "tarea": p[5], "evidencia": evid, "origen": "bitácora"})
    return buenas, malas


def resolver_solapes(lineas):
    """Si una línea TS se cruza con otra escrita ANTES, manda la posterior: la bitácora es de
    solo anexar y escribir el mismo rango de nuevo es la forma de corregirlo. La anterior se
    recorta (o se parte) en lo que choca; no se descarta entera."""
    activas, corregidas = [], []
    for t in lineas:
        nuevas = []
        for v in activas:
            if solape(v["desde"], v["hasta"], t["desde"], t["hasta"]) <= 0:
                nuevas.append(v)
                continue
            corregidas.append((v, t))
            if v["desde"] < t["desde"]:
                nuevas.append({**v, "hasta": t["desde"]})
            if v["hasta"] > t["hasta"]:
                nuevas.append({**v, "desde": t["hasta"]})
        activas = nuevas + [t]
    return sorted(activas, key=lambda x: (x["desde"], x["linea"])), corregidas


def validar(f, fecha, conf):
    """Normaliza la fila y devuelve (errores, avisos). Escribe en f: clave, con_issue,
    categoria, cliente, est."""
    err, av = [], []
    # clave de issue
    raw = str(f.get("clave_raw") or "").strip().upper()
    f["con_issue"] = False
    if raw in CLAVES_SIN_ISSUE:
        f["clave"] = SIN_ISSUE
    elif not raw:
        f["clave"] = ""
        err.append("falta la clave de issue (escribe SIN-ISSUE solo si de verdad no existe)")
    elif not conf.re_clave.match(raw):
        f["clave"] = raw
        err.append(f"la clave '{raw}' no cumple timesheet.formatoClave")
    else:
        f["clave"], f["con_issue"] = raw, True
    # categoría
    c = st(f.get("cat_raw"))
    if c in conf.categorias:
        f["categoria"] = conf.categorias[c]
    elif c in conf.alias:
        viejo, nuevo = conf.alias[c]
        f["categoria"] = nuevo
        av.append(f"categoría '{viejo}' reescrita como '{nuevo}' (aliasCategorias)")
    else:
        f["categoria"] = str(f.get("cat_raw") or "")
        extra = " Las horas extra no van como filas del timesheet." if "extra" in c else ""
        err.append(f"categoría '{f['categoria']}' no está en timesheet.categorias ni en "
                   f"aliasCategorias.{extra}")
    # cliente
    cr = str(f.get("cli_raw") or "").strip()
    if st(cr) in RELLENOS:
        f["cliente"] = ""
        err.append("falta el cliente (no valen rellenos como '-', 'N/A' o 'varios'; si el tramo "
                   "sirvió a dos clientes, se parte en dos líneas)")
    elif st(cr) in conf.clientes:
        f["cliente"] = conf.clientes[st(cr)]
    else:
        f["cliente"] = cr
        av.append(f"el cliente '{cr}' no está en timesheet.clientes: confirma cómo se nombra")
    # excepción sin issue
    if f["clave"] == SIN_ISSUE:
        if (conf.reuniones_desde and fecha >= conf.reuniones_desde
                and f["categoria"] in conf.cats_reunion):
            err.append(f"reunión sin issue: desde el {conf.reuniones_desde:%d/%m/%Y} toda reunión "
                       "cuelga de una issue (la del proyecto que se trató o una tarea de reuniones)")
        elif f["categoria"] not in conf.cats_sin_issue:
            err.append(f"SIN-ISSUE no se acepta en la categoría '{f['categoria']}' (solo en "
                       f"{sorted(conf.cats_sin_issue) or 'ninguna'}): consigue o crea la issue")
        elif not conf.cliente_interno or st(f["cliente"]) != st(conf.cliente_interno):
            err.append(f"SIN-ISSUE solo vale con el cliente interno "
                       f"('{conf.cliente_interno or 'sin definir'}'); el trabajo de un cliente "
                       "lleva su issue")
    # estimación
    er = str(f.get("est_raw") or "").strip()
    f["est"] = None
    if er and st(er) != st(SIN_EST) and st(er) != "est=sin-est":
        m = RE_EST.match(er)
        if m:
            f["est"] = float(m.group(1).replace(",", "."))
        else:
            err.append(f"estimación ilegible '{er}' (usa est=4h, est=1,5h o SIN-EST)")
    if f["est"] and not f["con_issue"]:
        av.append("estimación en una fila sin issue: se ignora")
        f["est"] = None
    # tarea
    tarea = str(f.get("tarea") or "").strip()
    if not tarea:
        err.append("falta la descripción de la tarea")
    for w in conf.prohibidos:
        if st(w) and st(w) in st(tarea):
            err.append(f"la tarea menciona '{w}' (timesheet.prohibidoEnTarea): redacta el resultado "
                       "de negocio, no la herramienta")
    for rx, que in CODIGOS_INTERNOS:
        hallado = rx.search(tarea)
        if hallado and not conf.re_clave.match(hallado.group(0)):
            av.append(f"posible código interno en la tarea ({que}: '{hallado.group(0)}'): escribe qué era")
    for w in conf.prohibidos:
        if st(w) and st(w) in st(f.get("evidencia")):
            av.append(f"la evidencia menciona '{w}': revísala antes de enviar")
            break
    return err, av


# ------------------------------------------------------------------ armado del día
def armar_dia(conf, fecha):
    v = conf.ventanas(fecha)
    lineas, malas = leer_ts(conf, fecha)
    activas, corregidas = resolver_solapes(lineas)
    res = {"fecha": fecha, "ventanas": v, "filas": [], "errores": [], "avisos": [],
           "fuera": [], "corregidas": corregidas, "malas": malas, "planeacion": None,
           "n_ts": len(lineas)}
    for m in malas:
        res["errores"].append(f"línea {m['linea']} de la bitácora ilegible: {m['error']}")

    ini_dia = v[0][0] if v else None
    fin_dia = v[-1][1] if v else None
    for t in activas:
        largo = t["hasta"] - t["desde"]
        if not v:
            res["fuera"].append((t, largo, "día sin jornada (fin de semana o festivo)"))
            continue
        d2, h2 = max(t["desde"], ini_dia), min(t["hasta"], fin_dia)
        dentro = sum(solape(t["desde"], t["hasta"], a, b) for a, b in v)
        if h2 <= d2 or dentro <= 0:
            por = ("cae dentro de una pausa configurada" if h2 > d2
                   else "fuera de la jornada configurada")
            res["fuera"].append((t, largo, por))
            continue
        recortado = largo - (h2 - d2)
        if recortado > 0:
            res["fuera"].append((t, recortado, f"se recortó a {hm(d2)}-{hm(h2)}"))
        res["filas"].append({**t, "desde": d2, "hasta": h2})

    # primera franja como planeación (opcional, solo si el usuario la configuró y el día tiene
    # actividad declarada: un día sin ninguna línea TS no se "abre" con una fila inventada)
    if conf.planeacion and v and res["filas"]:
        ini = v[0][0]
        fin = min(ini + conf.planeacion["minutos"], v[0][1],
                  min(f["desde"] for f in res["filas"]))
        if fin - ini >= 5:
            p = conf.planeacion
            fila = {"linea": 0, "desde": ini, "hasta": fin, "clave_raw": p["clave"],
                    "cat_raw": p["categoria"], "cli_raw": p["cliente"], "est_raw": SIN_EST,
                    "tarea": p["tarea"], "evidencia": "", "origen": "planeación configurada"}
            res["filas"].insert(0, fila)
            res["planeacion"] = fila

    for f in res["filas"]:
        e, a = validar(f, fecha, conf)
        donde = (f"línea {f['linea']}" if f["linea"] else "franja de planeación configurada")
        tramo = f"{hm(f['desde'])}-{hm(f['hasta'])}"
        res["errores"] += [f"{tramo} ({donde}): {x}" for x in e]
        res["avisos"] += [f"{tramo} ({donde}): {x}" for x in a]
        f["errores"] = e
        f["min"] = sum(solape(f["desde"], f["hasta"], a2, b2) for a2, b2 in v)
        if f["con_issue"] and f["est"] is None:
            res["avisos"].append(f"{tramo}: la issue {f['clave']} no tiene estimación (SIN-EST)")

    res["min_jornada"] = sum(b - a for a, b in v)
    res["min_total"] = sum(f["min"] for f in res["filas"])
    res["min_issue"] = sum(f["min"] for f in res["filas"] if f["con_issue"])
    res["cobertura"] = (res["min_issue"] / res["min_total"]) if res["min_total"] else None
    res["huecos"] = huecos(v, res["filas"])
    hoy, ahora = conf.ahora()
    res["en_curso"] = fecha == hoy
    res["ahora"] = ahora if fecha == hoy else None
    res["futuro"] = fecha > hoy
    return res


def huecos(ventanas, filas):
    tramos = sorted((f["desde"], f["hasta"]) for f in filas)
    out = []
    for a, b in ventanas:
        cursor = a
        for x, y in tramos:
            if y <= cursor or x >= b:
                continue
            if x > cursor:
                out.append((cursor, x))
            cursor = max(cursor, y)
        if cursor < b:
            out.append((cursor, b))
    return [(x, y) for x, y in out if y - x >= 1]


def partir_huecos(res):
    """(huecos que ya pasaron, huecos por transcurrir) — solo distingue si el día es hoy."""
    if res["futuro"]:
        return [], list(res["huecos"])
    if res["ahora"] is None:
        return list(res["huecos"]), []
    ya, luego = [], []
    for a, b in res["huecos"]:
        if b <= res["ahora"]:
            ya.append((a, b))
        elif a >= res["ahora"]:
            luego.append((a, b))
        else:
            ya.append((a, res["ahora"]))
            luego.append((res["ahora"], b))
    return ya, luego


# ------------------------------------------------------------------ calendario y equipo
def _eventos_crudos(texto):
    """Acepta la salida de la búsqueda de calendario tal cual: un JSON (lista u objeto con
    'value'/'events') o varios objetos JSON pegados uno tras otro (varias páginas)."""
    texto = texto.strip()
    try:
        data = json.loads(texto)
        if isinstance(data, dict):
            data = data.get("value") or data.get("events") or [data]
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        pass
    dec, i, out = json.JSONDecoder(), 0, []
    while i < len(texto):
        while i < len(texto) and texto[i] not in "{[":
            i += 1
        if i >= len(texto):
            break
        try:
            obj, i = dec.raw_decode(texto, i)
        except json.JSONDecodeError:
            i += 1
            continue
        if isinstance(obj, dict) and ("value" in obj or "events" in obj):
            obj = obj.get("value") or obj.get("events") or []
        out.extend(obj if isinstance(obj, list) else [obj])
    return out


RE_ISO = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?)(?:\.\d+)?(Z|[+-]\d\d:?\d\d)?$")


def _hora_local(campo, conf):
    """{dateTime, timeZone} → datetime ingenuo en la zona del usuario. Las APIs de calendario
    suelen devolver UTC: armar la ventana o leer la hora sin convertir deja la mañana fuera."""
    if isinstance(campo, dict):
        valor, zona = str(campo.get("dateTime") or ""), str(campo.get("timeZone") or "UTC")
    else:
        valor, zona = str(campo), "UTC"
    m = RE_ISO.match(valor.strip())
    if not m:
        raise ValueError(valor)
    t = dt.datetime.fromisoformat(m.group(1))
    suf = m.group(2)
    if suf == "Z" or (not suf and zona.upper() in ("UTC", "GMT", "Z", "COORDINATED UNIVERSAL TIME")):
        t = t.replace(tzinfo=dt.timezone.utc)
    elif suf:
        s = suf.replace(":", "")
        delta = dt.timedelta(hours=int(s[1:3]), minutes=int(s[3:5]))
        t = t.replace(tzinfo=dt.timezone(delta if s[0] == "+" else -delta))
    else:
        try:
            from zoneinfo import ZoneInfo
            t = t.replace(tzinfo=ZoneInfo(zona))
        except Exception:
            return t  # zona no reconocible (p. ej. nombres de Windows): se asume ya local
    t = t.astimezone(conf.tz) if conf.tz else t.astimezone()
    return t.replace(tzinfo=None)


def cargar_agenda(ruta, fecha, conf):
    """Reuniones del día en hora local → (vigentes, descartadas solas con su razón).
    Se descartan canceladas, de todo el día, sin asistentes (bloques propios) y libres/fuera
    de la oficina. Lo tentativo se conserva: muchas ceremonias recurrentes llegan así."""
    try:
        texto = Path(ruta).read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.exit(f"No puedo leer la agenda {ruta}: {e}")
    vig, fuera = [], []
    for e in _eventos_crudos(texto):
        if not isinstance(e, dict) or not e.get("subject") or not e.get("start"):
            continue
        try:
            ini, fin = _hora_local(e["start"], conf), _hora_local(e.get("end") or e["start"], conf)
        except Exception:
            continue
        if ini.date() != fecha:
            continue
        asunto = str(e["subject"]).strip()
        razon = None
        if e.get("isCancelled") or st(asunto).startswith(("cancelado", "canceled", "cancelled")):
            razon = "cancelada"
        elif e.get("isAllDay"):
            razon = "todo el día"
        elif not e.get("attendees"):
            razon = "sin asistentes (bloque propio)"
        elif str(e.get("showAs") or "").lower() in ("free", "oof"):
            razon = f"marcada como {e.get('showAs')}"
        fin_m = fin.hour * 60 + fin.minute if fin.date() == fecha else 24 * 60
        r = {"asunto": asunto, "desde": ini.hour * 60 + ini.minute, "hasta": fin_m,
             "asistentes": len(e.get("attendees") or [])}
        if razon:
            fuera.append({**r, "razon": razon})
        else:
            vig.append(r)
    vig.sort(key=lambda r: r["desde"])
    return vig, fuera


def cubierto(desde, hasta, filas):
    if hasta <= desde:
        return 1.0
    total = 0
    cursor = desde
    for x, y in sorted((f["desde"], f["hasta"]) for f in filas):
        x, y = max(x, cursor), min(y, hasta)
        if y > x:
            total += y - x
            cursor = y
    return total / (hasta - desde)


def cargar_equipo(ruta, fecha):
    """Filas que el equipo declaró en sus timesheets y que mencionan al usuario. Formato:
    lista JSON de {fecha, desde, hasta, persona, clave, tarea}. Lo arma la sesión leyendo los
    correos en solo lectura; aquí solo se cruza contra el día."""
    try:
        data = json.loads(Path(ruta).read_text(encoding="utf-8-sig"))
    except Exception as e:
        sys.exit(f"No puedo leer el archivo del equipo {ruta}: {e}")
    out = []
    for x in data if isinstance(data, list) else []:
        try:
            if str(x.get("fecha")) != fecha.isoformat():
                continue
            out.append({**x, "desde": a_min(x["desde"]), "hasta": a_min(x["hasta"])})
        except Exception:
            continue
    return sorted(out, key=lambda r: r["desde"])


# ------------------------------------------------------------------ comandos
def linea_fila(f):
    marca = "  [planeación configurada]" if f["origen"] != "bitácora" else ""
    err = "  <-- ERROR" if f.get("errores") else ""
    return (f"  {hm(f['desde'])}-{hm(f['hasta'])}  {horas(f['min']):5.2f} h  "
            f"{f['clave']:<12} [{f['categoria']}] {f['cliente']} :: {f['tarea'][:70]}{marca}{err}")


def imprimir_cobertura(res, conf):
    if res["cobertura"] is None:
        return "sin horas registradas"
    pct = 100 * res["cobertura"]
    tope = res["min_total"] * (1 - conf.meta) / 60
    ok = res["cobertura"] + 1e-9 >= conf.meta
    return (f"{pct:5.1f} % con issue (meta {100 * conf.meta:.0f} %; caben {tope:.2f} h sin issue)"
            + ("" if ok else "  -> NO CUMPLE LA META"))


def cmd_dia(conf, fecha, agenda=None, equipo=None):
    res = armar_dia(conf, fecha)
    nd = NOMBRES_DIA[fecha.weekday()]
    print(f"TIMESHEET {nd} {fecha:%d/%m/%Y}")
    if not res["ventanas"]:
        motivo = "festivo" if fecha.isoformat() in conf.festivos else "sin jornada configurada"
        print(f"  Día no laborable ({motivo}).")
    else:
        print("  Jornada: " + ", ".join(f"{hm(a)}-{hm(b)}" for a, b in res["ventanas"])
              + f"  = {horas(res['min_jornada']):.2f} h")
    print(f"  Líneas TS en la bitácora: {res['n_ts']}")
    for f in res["filas"]:
        print(linea_fila(f))
    if res["ventanas"]:
        print(f"  HORAS: {horas(res['min_total']):.2f} de {horas(res['min_jornada']):.2f}"
              + ("  (día en curso)" if res["en_curso"] else "")
              + ("  (día futuro)" if res["futuro"] else ""))
    print(f"  COBERTURA: {imprimir_cobertura(res, conf)}")

    ya, luego = partir_huecos(res)
    vig, desc = (cargar_agenda(agenda, fecha, conf) if agenda else ([], []))
    sin_ts = [r for r in vig if cubierto(r["desde"], r["hasta"], res["filas"]) < CUBRE_MIN]
    if ya:
        print("  HUECOS (sin línea TS; no se rellenan, se declaran o se registran con evidencia):")
        for a, b in ya:
            en = [r["asunto"] for r in sin_ts if solape(a, b, r["desde"], r["hasta"]) > 0]
            print(f"   - {hm(a)}-{hm(b)} ({horas(b - a):.2f} h)"
                  + (f"  calendario: {'; '.join(en)}" if en else ""))
    if luego:
        print("  POR TRANSCURRIR: " + ", ".join(f"{hm(a)}-{hm(b)}" for a, b in luego))
    if not ya and not luego and res["ventanas"] and res["filas"]:
        print("  Jornada cuadrada: sin huecos.")

    if agenda:
        print(f"  CALENDARIO: {len(vig)} reunión(es) vigentes; descartadas solas: "
              + (", ".join(f"{hm(d['desde'])} {d['asunto']} ({d['razon']})" for d in desc) or "ninguna"))
        if sin_ts:
            print("  Reuniones del calendario SIN línea TS (registrar con su issue si se atendieron):")
            for r in sin_ts:
                print(f"   - {hm(r['desde'])}-{hm(r['hasta'])} {r['asunto']} ({r['asistentes']} asistentes)")
        for i, x in enumerate(vig):
            for y in vig[i + 1:]:
                if solape(x["desde"], x["hasta"], y["desde"], y["hasta"]) > 0:
                    print(f"  SOLAPE EN EL CALENDARIO: {hm(x['desde'])} {x['asunto']} <-> "
                          f"{hm(y['desde'])} {y['asunto']}: solo una se pudo atender")
    else:
        print("  CALENDARIO: no cruzado (pasa --agenda <archivo> con la búsqueda del día).")

    if equipo:
        eq = cargar_equipo(equipo, fecha)
        print(f"  TIMESHEETS DEL EQUIPO: {len(eq)} fila(s) del día que te mencionan")
        for r in eq:
            cub = cubierto(r["desde"], r["hasta"], res["filas"])
            donde = ("ya cubierta por tus filas" if cub >= CUBRE_MIN
                     else "cae en un hueco: evidencia para registrarla" if any(
                         solape(r["desde"], r["hasta"], a, b) > 0 for a, b in ya)
                     else "fuera de tu jornada o por transcurrir")
            print(f"   - {hm(r['desde'])}-{hm(r['hasta'])} {r.get('persona', '?')} "
                  f"{r.get('clave') or ''} {str(r.get('tarea') or '')[:60]}  -> {donde}")

    for viejo, nuevo in res["corregidas"]:
        print(f"  CORREGIDA: línea {viejo['linea']} ({hm(viejo['desde'])}-{hm(viejo['hasta'])}) "
              f"se cruza con la línea {nuevo['linea']} ({hm(nuevo['desde'])}-{hm(nuevo['hasta'])}); "
              "manda la posterior")
    for t, mins, por in res["fuera"]:
        print(f"  FUERA DEL TIMESHEET: línea {t['linea']} {hm(t['desde'])}-{hm(t['hasta'])} "
              f"({horas(mins):.2f} h): {por}. Las horas extra no van como filas.")
    for x in conf.avisos_config:
        print(f"  CONFIG: {x}")
    for x in res["avisos"]:
        print(f"  AVISO: {x}")
    for x in res["errores"]:
        print(f"  ERROR: {x}")
    print(f"  ESTADO: {'con errores, no exportable' if res['errores'] else 'exportable'}")
    return res


def semana_de(fecha):
    lunes = fecha - dt.timedelta(days=fecha.weekday())
    return [lunes + dt.timedelta(days=i) for i in range(7)]


def cmd_semana(conf, fecha):
    dias = semana_de(fecha)
    print(f"SEMANA {dias[0]:%d/%m/%Y} al {dias[-1]:%d/%m/%Y}")
    tot = tot_j = tot_i = 0
    por_issue = {}
    con_error = 0
    for d in dias:
        res = armar_dia(conf, d)
        if not res["ventanas"] and not res["n_ts"]:
            if d.isoformat() in conf.festivos and conf.jornada[DIAS[d.weekday()]] > 0:
                print(f"  {NOMBRES_DIA[d.weekday()][:3]} {d:%d/%m}  festivo (sin jornada)")
            continue
        ya, luego = partir_huecos(res)
        hueco = sum(b - a for a, b in ya)
        estado = []
        if res["errores"]:
            estado.append(f"{len(res['errores'])} ERROR(ES)")
            con_error += 1
        if res["cobertura"] is not None and res["cobertura"] + 1e-9 < conf.meta:
            estado.append("COBERTURA BAJO LA META")
        if hueco:
            estado.append(f"HUECO {horas(hueco):.2f} h")
        if luego:
            estado.append("por transcurrir")
        if res["fuera"]:
            estado.append(f"{len(res['fuera'])} tramo(s) fuera del timesheet")
        if res["ventanas"] and not res["filas"] and not res["futuro"]:
            estado.append("SIN REGISTROS")
        cob = "  -  " if res["cobertura"] is None else f"{100 * res['cobertura']:5.1f}%"
        print(f"  {NOMBRES_DIA[d.weekday()][:3]} {d:%d/%m}  filas={len(res['filas']):2d}  "
              f"horas={horas(res['min_total']):5.2f}/{horas(res['min_jornada']):5.2f}  "
              f"issue={cob}  {'; '.join(estado) or 'OK'}")
        tot += res["min_total"]
        tot_j += res["min_jornada"]
        tot_i += res["min_issue"]
        for f in res["filas"]:
            if f["con_issue"]:
                e = por_issue.setdefault(f["clave"], {"est": None, "min": 0})
                e["min"] += f["min"]
                if f["est"] is not None:
                    e["est"] = max(e["est"] or 0, f["est"])
    cob = f"{100 * tot_i / tot:.1f} %" if tot else "-"
    print(f"  TOTAL  horas={horas(tot):.2f}/{horas(tot_j):.2f}  cobertura con issue={cob} "
          f"(meta {100 * conf.meta:.0f} %)")
    if por_issue:
        print("  issue          estimado  ejecutado  consumo")
        for k in sorted(por_issue):
            v = por_issue[k]
            if not v["est"]:
                cons = "SIN ESTIMACIÓN"
            else:
                pct = 100 * v["min"] / 60 / v["est"]
                cons = f"{pct:5.0f} %" + ("  SOBREPASA" if v["min"] / 60 > v["est"] else "")
            est = f"{v['est']:.2f}" if v["est"] else "-"
            print(f"  {k:<14}{est:>8}{horas(v['min']):>11.2f}  {cons}")
    for x in conf.avisos_config:
        print(f"  CONFIG: {x}")
    if con_error:
        print(f"  {con_error} día(s) con errores: corre `dia <fecha>` para ver el detalle.")


def cmd_exportar(conf, desde, hasta, formato, salida=None, separador=";", exigir_cobertura=False):
    if hasta < desde:
        sys.exit("--hasta es anterior a --desde.")
    dias, d = [], desde
    while d <= hasta:
        dias.append(armar_dia(conf, d))
        d += dt.timedelta(days=1)
    errores = [(r["fecha"], e) for r in dias for e in r["errores"]]
    bajos = [r for r in dias if r["cobertura"] is not None and r["cobertura"] + 1e-9 < conf.meta]
    if errores or (exigir_cobertura and bajos):
        print("NO se generó el archivo de envío. Corrige la bitácora (una línea TS nueva con el "
              "mismo rango reemplaza a la anterior) y vuelve a exportar:")
        for f, e in errores:
            print(f"  - {f:%d/%m/%Y} {e}")
        if exigir_cobertura:
            for r in bajos:
                print(f"  - {r['fecha']:%d/%m/%Y} cobertura {100 * r['cobertura']:.1f} % bajo la meta "
                      f"de {100 * conf.meta:.0f} %")
        sys.exit(1)

    # filas con fecha en TODAS; la estimación de una issue va una sola vez por semana ISO
    filas, ya = [], set()
    for r in dias:
        semana = r["fecha"].isocalendar()[:2]
        for f in r["filas"]:
            est = 0.0
            if f["con_issue"] and f["est"] and (semana, f["clave"]) not in ya:
                est = f["est"]
                ya.add((semana, f["clave"]))
            filas.append({"fecha": r["fecha"], "cliente": f["cliente"], "categoria": f["categoria"],
                          "clave": f["clave"], "tarea": f["tarea"], "desde": hm(f["desde"]),
                          "hasta": hm(f["hasta"]), "horas": horas(f["min"]), "est": est,
                          "evidencia": f.get("evidencia") or ""})

    conf.salida.mkdir(parents=True, exist_ok=True)
    nombre = f"timesheet-{slug(conf.owner)}-{desde.isoformat()}"
    if hasta != desde:
        nombre += f"_{hasta.isoformat()}"
    if formato == "xlsx":
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            print("AVISO: openpyxl no está instalado; genero CSV en su lugar "
                  "(para XLSX: pip install openpyxl).")
            formato = "csv"
    destino = Path(salida) if salida else conf.salida / f"{nombre}.{formato}"
    destino.parent.mkdir(parents=True, exist_ok=True)
    try:
        if formato == "xlsx":
            escribir_xlsx(destino, filas, dias, conf)
        else:
            escribir_csv(destino, filas, separador)
    except PermissionError:
        sys.exit(f"No puedo escribir {destino}: ¿está abierto en otra aplicación? Ciérralo y repite.")

    print(f"Listo para adjuntar: {destino}")
    print(f"  {len(filas)} fila(s), todas con fecha, clave y cliente; {sum(f['horas'] for f in filas):.2f} h")
    for r in dias:
        if not r["ventanas"] and not r["filas"]:
            continue
        ya_h, luego = partir_huecos(r)
        hueco = sum(b - a for a, b in ya_h)
        cob = "-" if r["cobertura"] is None else f"{100 * r['cobertura']:.1f} %"
        extra = []
        if hueco:
            extra.append(f"hueco declarado {horas(hueco):.2f} h (no se rellenó)")
        if luego:
            extra.append("día en curso")
        if r["ventanas"] and not r["filas"]:
            extra.append("sin registros")
        if r["cobertura"] is not None and r["cobertura"] + 1e-9 < conf.meta:
            extra.append("cobertura bajo la meta")
        print(f"  {NOMBRES_DIA[r['fecha'].weekday()][:3]} {r['fecha']:%d/%m}: "
              f"{horas(r['min_total']):.2f}/{horas(r['min_jornada']):.2f} h, issue {cob}"
              + (f"  ({'; '.join(extra)})" if extra else ""))
    avisos = [(r["fecha"], a) for r in dias for a in r["avisos"]]
    for f, a in avisos:
        print(f"  AVISO {f:%d/%m}: {a}")
    print("  El motor no envía nada: adjunta el archivo y manda el correo tú.")


COLUMNAS = ["Fecha", "Cliente", "Categoría", "Clave de issue", "Tarea / actividad",
            "Desde", "Hasta", "Horas", "Horas estimadas", "Evidencia"]


def escribir_csv(destino, filas, separador):
    decimal = "," if separador == ";" else "."
    # utf-8 con BOM a propósito: es lo que Excel necesita para leer bien las tildes de un CSV
    with open(destino, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=separador)
        w.writerow(COLUMNAS)
        for f in filas:
            w.writerow([f["fecha"].isoformat(), f["cliente"], f["categoria"], f["clave"],
                        f["tarea"], f["desde"], f["hasta"], fmt_num(f["horas"], decimal),
                        fmt_num(f["est"], decimal), f["evidencia"]])


def escribir_xlsx(destino, filas, dias, conf):
    import openpyxl
    from openpyxl.styles import Font, Alignment
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Timesheet"
    ws.append(COLUMNAS)
    for c in ws[1]:
        c.font = Font(bold=True)
    for f in filas:
        ws.append([dt.datetime.combine(f["fecha"], dt.time()), f["cliente"], f["categoria"],
                   f["clave"], f["tarea"], f["desde"], f["hasta"], f["horas"], f["est"],
                   f["evidencia"]])
        r = ws.max_row
        ws.cell(row=r, column=1).number_format = "dd/mm/yyyy"
        ws.cell(row=r, column=8).number_format = "0.00"
        ws.cell(row=r, column=9).number_format = "0.00"
        ws.cell(row=r, column=5).alignment = Alignment(wrap_text=True, vertical="top")
    total = ws.max_row + 1
    ws.cell(row=total, column=1, value="TOTAL").font = Font(bold=True)
    if filas:
        ws.cell(row=total, column=8, value=f"=SUM(H2:H{total - 1})").number_format = "0.00"
        ws.cell(row=total, column=9, value=f"=SUM(I2:I{total - 1})").number_format = "0.00"
    for col, ancho in zip("ABCDEFGHIJ", (12, 18, 20, 15, 70, 8, 8, 8, 10, 40)):
        ws.column_dimensions[col].width = ancho
    ws.freeze_panes = "A2"

    rs = wb.create_sheet("Resumen")
    rs.append(["Fecha", "Jornada (h)", "Registradas (h)", "Hueco declarado (h)",
               "Cobertura con issue", "Meta"])
    for c in rs[1]:
        c.font = Font(bold=True)
    for r in dias:
        if not r["ventanas"] and not r["filas"]:
            continue
        ya_h, _ = partir_huecos(r)
        rs.append([dt.datetime.combine(r["fecha"], dt.time()), horas(r["min_jornada"]),
                   horas(r["min_total"]), horas(sum(b - a for a, b in ya_h)),
                   r["cobertura"] if r["cobertura"] is not None else None, conf.meta])
        rs.cell(row=rs.max_row, column=1).number_format = "dd/mm/yyyy"
        rs.cell(row=rs.max_row, column=5).number_format = "0.0%"
        rs.cell(row=rs.max_row, column=6).number_format = "0%"
    for col in "ABCDEF":
        rs.column_dimensions[col].width = 20
    wb.save(destino)


# ------------------------------------------------------------------ main
def main():
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument("--config", help="ruta de config.json (por defecto PERSONAL_OS_HOME o ~/.claude/personal-os)")
    comun.add_argument("--estado", help="carpeta de estado (por defecto stateDir de config.json)")
    comun.add_argument("--hoy", help="fija 'hoy' (AAAA-MM-DD) para pruebas")

    p = argparse.ArgumentParser(description="Motor genérico del timesheet del Personal OS.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pd = sub.add_parser("dia", parents=[comun], help="arma y valida un día")
    pd.add_argument("fecha")
    pd.add_argument("--agenda", help="salida de la búsqueda de calendario del día (JSON tal cual)")
    pd.add_argument("--equipo", help="filas de los timesheets del equipo que te mencionan (JSON)")
    ps = sub.add_parser("semana", parents=[comun], help="resumen de lunes a domingo")
    ps.add_argument("fecha")
    pe = sub.add_parser("exportar", parents=[comun], help="genera el archivo de envío")
    pe.add_argument("--desde", required=True)
    pe.add_argument("--hasta")
    pe.add_argument("--formato", choices=["csv", "xlsx"])
    pe.add_argument("--salida", help="ruta del archivo (por defecto <stateDir>/timesheet/)")
    pe.add_argument("--separador", default=";", help="separador del CSV (';' por defecto)")
    pe.add_argument("--exigir-cobertura", action="store_true",
                    help="no exporta si algún día queda bajo metaCoberturaIssue")
    a = p.parse_args()

    conf = Conf(a.config, a.estado)
    if a.hoy:
        hoy_forzado = fecha_iso(a.hoy)
        conf.ahora = lambda: (hoy_forzado, 24 * 60)

    if a.cmd == "dia":
        cmd_dia(conf, fecha_iso(a.fecha), agenda=a.agenda, equipo=a.equipo)
    elif a.cmd == "semana":
        cmd_semana(conf, fecha_iso(a.fecha))
    else:
        desde = fecha_iso(a.desde)
        hasta = fecha_iso(a.hasta) if a.hasta else desde
        cmd_exportar(conf, desde, hasta, a.formato or conf.formato_envio, salida=a.salida,
                     separador=a.separador, exigir_cobertura=a.exigir_cobertura)


if __name__ == "__main__":
    main()
