# -*- coding: utf-8 -*-
"""
Personal OS · timesheet en LIBRO CORPORATIVO (modo con perfil de organización).

Escribe el timesheet semanal sobre la plantilla .xlsx de la organización: un libro por
semana, un bloque de filas por día, sin tocar el formato base. Todo lo que es de la
organización o de la persona (plantilla, filas, columnas, categorías, clientes, jornada,
almuerzo, reglas de cobertura, nombre del archivo de envío, destinatarios, rutas) sale del
PERFIL, un JSON que el usuario guarda fuera del plugin. El plugin trae `perfiles/ejemplo.json`.

Dónde se busca el perfil (el primero que exista):
  --perfil <ruta>  ·  $TIMESHEET_PERFIL  ·  config.json → timesheet.perfil
  ·  <PERSONAL_OS_HOME o ~/.claude/personal-os>/timesheet-perfil.json

Uso:
  python libro.py perfil                                   (qué perfil está activo y sus reglas)
  python libro.py week     --date AAAA-MM-DD
  python libro.py show     --date AAAA-MM-DD
  python libro.py borrador --date AAAA-MM-DD --agenda agenda.json --out dia.json
  python libro.py set      --date AAAA-MM-DD --json dia.json --agenda agenda.json [--parcial | --hueco "<razón>"]
  python libro.py envio    --date AAAA-MM-DD [--force]
  python libro.py remap    --date AAAA-MM-DD
  python libro.py fechas   --date AAAA-MM-DD
"""
import argparse, datetime as dt, json, re, shutil, sys
from copy import copy
from pathlib import Path

import os

try:  # la consola de Windows no siempre habla UTF-8
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DIAS_CLAVE = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
NOMBRES_DIA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


# --------------------------------------------------------------------- perfil
def os_home():
    e = os.environ.get("PERSONAL_OS_HOME")
    return Path(e).expanduser() if e else Path.home() / ".claude" / "personal-os"


def leer_config():
    ruta = os_home() / "config.json"
    if not ruta.exists():
        return {}
    try:
        return json.loads(ruta.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}


def ruta_perfil(arg=None):
    if arg:
        return Path(arg).expanduser()
    if os.environ.get("TIMESHEET_PERFIL"):
        return Path(os.environ["TIMESHEET_PERFIL"]).expanduser()
    p = (leer_config().get("timesheet") or {}).get("perfil")
    if p:
        return Path(p).expanduser()
    return os_home() / "timesheet-perfil.json"


def cargar_perfil(arg=None):
    ruta = ruta_perfil(arg)
    if not ruta.exists():
        sys.exit(f"No hay perfil de organizacion en {ruta}. Este modo (libro corporativo) lo "
                 "necesita: copia perfiles/ejemplo.json de la skill a esa ruta y ajustalo, o "
                 "usa el modo generico (timesheet.py).")
    try:
        return ruta, json.loads(ruta.read_text(encoding="utf-8-sig"))
    except Exception as e:
        sys.exit(f"{ruta} no es JSON valido: {e}")


def _ruta_env(nombres, defecto):
    for n in nombres:
        if n and os.environ.get(n):
            return Path(os.environ[n])
    return Path(defecto).expanduser() if defecto else None


def _hora_dec(hhmm):
    h, m = str(hhmm).split(":")
    return int(h) + int(m) / 60


def configurar(ruta, P):
    """Carga el perfil en las constantes del módulo. Las funciones de abajo las usan igual que
    si fueran fijas: así el comportamiento no depende de quién sea el usuario."""
    global PERFIL, RUTA_PERFIL, BASE, TIMESHEET, TPL, SHEET, NDIAS, DAY_ROWS, ROWS_PER_DAY
    global MAX_ROWS_PER_DAY, TOTAL_ROW, FIRST_ROW, LAST_ROW, COLS, COL_FECHA, COL_EJEC, NCOLS
    global CELDA_NOMBRE, CELDA_ID, CELDA_DESDE, CELDA_HASTA, ETIQUETA_TOTAL, MARCA_TOTAL
    global PREFIJO_PARAM, COL_PARAM, FORMATO_FECHA, CATEGORIAS, ALIAS_CATEGORIAS, CATS_LIDER
    global CATS_SIN_ISSUE_OK, CATS_REUNION, VIGENCIA_REUNIONES_JIRA, CLIENTES, CLIENTE_INTERNO
    global CLIENTE_RELLENO, EXTRA, EXTENDIDA, MARCAS_FUERA, SIN_ISSUE, RE_JIRA, COBERTURA_MIN
    global VIGENCIA_COBERTURA, BITACORA, UTC_OFFSET, CUBRE_MIN, JORNADA, HORAS_JORNADA
    global ALMUERZO, FORM_I, FORM_I_SIN_DESCUENTO, MSG_REUNION_JIRA, PERSONA, NOMBRE
    global IDENTIFICACION, ENVIO, CITAS, PLANTILLAS_RUTA, NOMBRE_BORRADOR
    from openpyxl.utils import get_column_letter

    PERFIL, RUTA_PERFIL = P, ruta
    per = P.get("persona") or {}
    NOMBRE = str(per.get("nombre") or "").strip()
    IDENTIFICACION = str(per.get("identificacion") or "").strip()
    PERSONA = str(per.get("nombreCorto") or "").strip()

    r = P.get("rutas") or {}
    env = r.get("variablesEntorno") or {}
    BASE = _ruta_env([env.get("base"), "TIMESHEET_DIR"], r.get("base"))
    if BASE is None:
        sys.exit(f"{ruta}: falta rutas.base (la carpeta donde viven plantilla y libros).")
    TIMESHEET = BASE / (r.get("libros") or "timesheet")
    TPL = BASE / (r.get("plantilla") or "formatos/plantilla.xlsx")
    PLANTILLAS_RUTA = {"mes": r.get("carpetaMes") or "{lunes:%Y-%m}",
                       "semana": r.get("archivoSemana")
                       or "Timesheet {lunes:%Y-%m-%d} al {viernes:%Y-%m-%d}.xlsx",
                       "envio": r.get("envio") or "envio"}
    bit = _ruta_env([env.get("bitacora"), "TIMESHEET_BITACORA"], r.get("bitacora"))
    if bit is None:
        sd = leer_config().get("stateDir")
        bit = Path(sd).expanduser() / "bitacora" if sd else Path("bitacora")
    BITACORA = bit

    lb = P.get("libro") or {}
    SHEET = lb.get("hoja") or "Timesheet Semanal"
    NDIAS = int(lb.get("dias") or 5)
    ROWS_PER_DAY = int(lb.get("filasPorDia") or 8)
    FIRST_ROW = int(lb.get("primeraFila") or 6)
    DAY_ROWS = [FIRST_ROW + i * ROWS_PER_DAY for i in range(NDIAS)]
    MAX_ROWS_PER_DAY = int(lb.get("maxFilasPorDia") or 20)
    LAST_ROW = DAY_ROWS[-1] + ROWS_PER_DAY - 1
    TOTAL_ROW = int(lb.get("filaTotal") or LAST_ROW + 2)
    col = lb.get("columnas") or {"fecha": 1, "cliente": 2, "categoria": 3, "jira": 4, "tarea": 5,
                                 "desde": 6, "hasta": 7, "asignadas": 8, "ejecutadas": 9,
                                 "observaciones": 10}
    COL_FECHA, COL_EJEC = int(col["fecha"]), int(col["ejecutadas"])
    COLS = {k: int(v) for k, v in col.items() if k not in ("fecha", "ejecutadas")}
    NCOLS = max(int(v) for v in col.values())
    cel = lb.get("celdas") or {}
    CELDA_NOMBRE, CELDA_ID = cel.get("nombre") or "B1", cel.get("identificacion") or "B2"
    CELDA_DESDE, CELDA_HASTA = cel.get("desde") or "G1", cel.get("hasta") or "I1"
    ETIQUETA_TOTAL = lb.get("etiquetaTotal") or "TOTAL SEMANA"
    MARCA_TOTAL = (lb.get("marcaTotal") or "TOTAL").upper()
    PREFIJO_PARAM = (lb.get("hojaParametros") or "parametriza").lower()
    COL_PARAM = int(lb.get("columnaParametros") or 2)
    FORMATO_FECHA = lb.get("formatoFecha") or "dd/mm/yyyy"

    CATEGORIAS = list(P.get("categorias") or [])
    if not CATEGORIAS:
        sys.exit(f"{ruta}: 'categorias' esta vacio.")
    ALIAS_CATEGORIAS = dict(P.get("aliasCategorias") or {})
    CATS_LIDER = set(P.get("categoriasLider") or [])
    CATS_SIN_ISSUE_OK = set(P.get("categoriasSinIssue") or [])
    CATS_REUNION = set(P.get("categoriasReunion") or [])
    v = P.get("reunionesExigenIssueDesde")
    VIGENCIA_REUNIONES_JIRA = dt.date.fromisoformat(v) if v else dt.date.max
    CLIENTES = list(P.get("clientes") or [])
    CLIENTE_INTERNO = P.get("clienteInterno") or ""
    CLIENTE_RELLENO = set(P.get("clientesRelleno")
                          or ["-", "--", "n/a", "na", "n.a.", "ninguno", "sin cliente", "varios", "?", "."])
    m = P.get("marcas") or {}
    EXTRA = m.get("extra") or "Horas extra"
    EXTENDIDA = m.get("extendida") or "Jornada extendida"
    MARCAS_FUERA = (EXTRA, EXTENDIDA)
    SIN_ISSUE = m.get("sinIssue") or "Sin issue"
    RE_JIRA = re.compile(P.get("formatoClave") or r"^[A-Z]{2,10}-\d+$")
    cob = P.get("cobertura") or {}
    COBERTURA_MIN = float(cob.get("minimo", 90.0))
    VIGENCIA_COBERTURA = dt.date.fromisoformat(cob["vigenteDesde"]) if cob.get("vigenteDesde") else None
    if P.get("utcOffsetHoras") is not None:
        UTC_OFFSET = float(P["utcOffsetHoras"])
    else:
        UTC_OFFSET = dt.datetime.now().astimezone().utcoffset().total_seconds() / 3600
    CUBRE_MIN = float(P.get("cubreMin", 0.5))

    jor = P.get("jornada") or {}
    JORNADA, HORAS_JORNADA = {}, {}
    for i in range(NDIAS):
        tramos = [tuple(t) for t in (jor.get(DIAS_CLAVE[i]) or [])]
        if not tramos:
            sys.exit(f"{ruta}: jornada.{DIAS_CLAVE[i]} no tiene tramos (p. ej. [[\"08:00\",\"12:00\"]]).")
        JORNADA[i] = tramos
        HORAS_JORNADA[i] = round(sum(_hora_dec(b) - _hora_dec(a) for a, b in tramos), 4)
    alm = P.get("almuerzo")
    ALMUERZO = (_hora_dec(alm[0]), _hora_dec(alm[1])) if alm else None
    F, G = get_column_letter(COLS["desde"]), get_column_letter(COLS["hasta"])
    FORM_I_SIN_DESCUENTO = f'=IF(OR({F}{{r}}="",{G}{{r}}=""),"",MAX(0,({G}{{r}}-{F}{{r}})*24))'
    if alm:
        (ah, am), (bh, bm) = (map(int, alm[0].split(":")), map(int, alm[1].split(":")))
        FORM_I = (f'=IF(OR({F}{{r}}="",{G}{{r}}=""),"",MAX(0,({G}{{r}}-{F}{{r}})*24'
                  f'-MAX(0,(MIN({G}{{r}},TIME({bh},{bm},0))-MAX({F}{{r}},TIME({ah},{am},0)))*24)))')
    else:
        FORM_I = FORM_I_SIN_DESCUENTO

    ENVIO = P.get("envio") or {}
    CITAS = P.get("citas") or {}
    NOMBRE_BORRADOR = (P.get("borrador") or {}).get("archivo") or "timesheet-borrador-{fecha:%Y-%m-%d}.json"
    MSG_REUNION_JIRA = ("toda reunion cuelga de una tarea de Jira: la issue del proyecto que se "
                        "trato, la tarea Reuniones del mes si es una ceremonia recurrente, o una tarea "
                        "Reuniones nueva si es puntual (estimacion = la duracion agendada; se crea con "
                        f"el OK {de_persona()})")


def de_persona():
    return f"de {PERSONA}" if PERSONA else "del usuario"


def a_persona():
    return f"a {PERSONA}" if PERSONA else "al usuario"


def quien():
    return PERSONA or "el usuario"


def marca_fuera(obs):
    """True si la observacion declara que la fila esta fuera de la jornada."""
    return str(obs or "").startswith(MARCAS_FUERA)


def cuerpo_obs(obs):
    """La observacion sin su marca de fuera de jornada, para poder combinarla con
    "Sin issue - <razon>": una reunion interna que se alargo es las dos cosas a la vez."""
    o = str(obs or "")
    for m in MARCAS_FUERA:
        if o.startswith(m):
            return o[len(m):].lstrip(" -–—")
    return o


def formula_i(ws, r):
    """La formula de Horas Ejecutadas que le toca a la fila r, segun su observacion. Una fila
    declarada fuera de jornada que cruza el almuerzo cuenta el tiempo completo."""
    return (FORM_I_SIN_DESCUENTO if marca_fuera(ws.cell(row=r, column=COLS["observaciones"]).value)
            else FORM_I).format(r=r)


# --------------------------------------------------------------------- utilidades
def sin_tildes(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", str(s).strip().lower())
                   if unicodedata.category(c) != "Mn")


def canonico(valor, validos):
    """Forma canonica comparando sin tildes ni mayusculas: las consolas manglan los acentos."""
    for v in validos:
        if sin_tildes(v) == sin_tildes(valor):
            return v
    return None


def canon_categoria(valor):
    """(categoria_vigente, etiqueta_retirada_si_hubo_remapeo). None si no se reconoce."""
    cat = canonico(valor, CATEGORIAS)
    if cat:
        return cat, None
    for viejo, nuevo in ALIAS_CATEGORIAS.items():
        if sin_tildes(viejo) == sin_tildes(valor):
            return nuevo, viejo
    return None, None


def canon_cliente(valor):
    """(cliente, es_desconocido). None si viene vacio o es un relleno tipo '-' o 'N/A'."""
    v = str(valor or "").strip()
    if not v or sin_tildes(v) in CLIENTE_RELLENO:
        return None, False
    cli = canonico(v, CLIENTES)
    return (cli, False) if cli else (v, True)


def parse_hora(v):
    if isinstance(v, dt.time):
        return v
    if isinstance(v, dt.datetime):
        return v.time()
    h, m = str(v).strip().split(":")
    return dt.time(int(h), int(m))


def dec(hora):
    return hora.hour + hora.minute / 60


def horas_netas(desde, hasta, descontar_almuerzo=True):
    """Horas entre desde y hasta descontando el cruce con el almuerzo del perfil.
    Con descontar_almuerzo=False cuenta el tiempo completo (fila declarada fuera de jornada)."""
    a, b = dec(desde), dec(hasta)
    bruto = max(0.0, b - a)
    if not descontar_almuerzo or not ALMUERZO:
        return round(bruto, 4)
    ini, fin = ALMUERZO
    return round(max(0.0, bruto - max(0.0, min(b, fin) - max(a, ini))), 4)


def es_fuera_de_jornada(desde, hasta, dow):
    """True si el bloque se sale del horario laboral de ese dia."""
    a, b = dec(desde), dec(hasta)
    for ini, fin in JORNADA[dow]:
        i, f = dec(parse_hora(ini)), dec(parse_hora(fin))
        if a >= i - 1e-9 and b <= f + 1e-9:
            return False
    return True


def semana_de(fecha):
    lunes = fecha - dt.timedelta(days=fecha.weekday())
    return lunes, lunes + dt.timedelta(days=NDIAS - 1)


def carpeta_mes(fecha):
    """Carpeta del mes a la que pertenece la semana: la del LUNES, para que una semana que
    cruza de mes no quede partida en dos carpetas."""
    lunes, viernes = semana_de(fecha)
    return TIMESHEET / PLANTILLAS_RUTA["mes"].format(lunes=lunes, viernes=viernes)


def ruta_semana(fecha):
    lunes, viernes = semana_de(fecha)
    return carpeta_mes(fecha) / PLANTILLAS_RUTA["semana"].format(lunes=lunes, viernes=viernes)


# --------------------------------------------------------------------- cobertura, bitacora, agenda
def cobertura(filas):
    """(ejecutadas, horas_sin_issue, pct) de un conjunto de filas (del JSON o del libro)."""
    ejec = sinj = 0.0
    for f in filas:
        if not (f.get("desde") and f.get("hasta")):
            continue
        h = horas_netas(parse_hora(f["desde"]), parse_hora(f["hasta"]),
                        descontar_almuerzo=not marca_fuera(f.get("observaciones")))
        ejec += h
        if not str(f.get("jira") or "").strip():
            sinj += h
    return ejec, sinj, (100 * (ejec - sinj) / ejec if ejec else 100.0)


def exige_cobertura(fecha):
    return VIGENCIA_COBERTURA is not None and fecha >= VIGENCIA_COBERTURA


def exige_reunion_jira(fecha, categoria):
    return fecha >= VIGENCIA_REUNIONES_JIRA and categoria in CATS_REUNION


RE_TS = re.compile(r"^\s*-\s*\*\*TS:\*\*\s*(.+?)\s*$")


def lineas_ts(fecha):
    """Lineas TS de la bitacora del dia, ya partidas. Lista vacia si no hay bitacora."""
    ruta = BITACORA / f"{fecha:%Y-%m-%d}.md"
    if not ruta.exists():
        return []
    out = []
    for n, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), 1):
        m = RE_TS.match(linea)
        if not m:
            continue
        p = [x.strip() for x in m.group(1).split("|")]
        if len(p) < 6 or "-" not in p[0]:
            out.append({"_linea": n, "_error": "linea TS mal formada", "_texto": linea.strip()})
            continue
        try:
            d, h = (parse_hora(x) for x in p[0].split("-", 1))
        except Exception:
            out.append({"_linea": n, "_error": "rango horario invalido", "_texto": linea.strip()})
            continue
        jira = "" if p[1].upper().startswith("SIN") else p[1].upper()
        est = 0.0
        me = re.match(r"(?i)est\s*=\s*([\d.,]+)", p[4])
        if me:
            est = float(me.group(1).replace(",", "."))
        evid = next((x[5:].strip() for x in p[6:] if x.lower().startswith("evid=")), "")
        out.append({"_linea": n, "desde": d.strftime("%H:%M"), "hasta": h.strftime("%H:%M"),
                    "jira": jira, "categoria": p[2], "cliente": p[3], "est": est,
                    "tarea": p[5], "evid": evid})
    return out


def solape_min(a1, a2, b1, b2):
    """Minutos de cruce entre dos rangos expresados en horas decimales."""
    return max(0.0, min(a2, b2) - max(a1, b1)) * 60


def cubierto(desde, hasta, filas):
    """Fraccion del rango [desde, hasta] que cubren las filas."""
    a, b = dec(parse_hora(desde)), dec(parse_hora(hasta))
    if b <= a:
        return 1.0
    tramos = sorted((dec(parse_hora(f["desde"])), dec(parse_hora(f["hasta"])))
                    for f in filas if f.get("desde") and f.get("hasta"))
    total, cursor = 0.0, a
    for x, y in tramos:
        x, y = max(x, cursor), min(y, b)
        if y > x:
            total += y - x
            cursor = y
    return total / (b - a)


def ts_sin_pasar(fecha, filas):
    """Lineas TS de la bitacora cuyo rango no quedo en el libro: el tramo declarado que la
    sesion dio por cerrado sin escribirlo."""
    return [t for t in lineas_ts(fecha)
            if "_error" not in t and cubierto(t["desde"], t["hasta"], filas) < CUBRE_MIN]


def _eventos_crudos(texto):
    """Acepta la salida de outlook_calendar_search tal cual: un JSON (lista u objeto con
    'value'/'events') o varios objetos JSON pegados uno tras otro (varias paginas)."""
    texto = texto.strip()
    try:
        data = json.loads(texto)
        if isinstance(data, dict):
            data = data.get("value") or data.get("events") or [data]
        return data
    except json.JSONDecodeError:
        pass
    dec_, i, out = json.JSONDecoder(), 0, []
    while i < len(texto):
        while i < len(texto) and texto[i] not in "{[":
            i += 1
        if i >= len(texto):
            break
        obj, i = dec_.raw_decode(texto, i)
        out.extend(obj if isinstance(obj, list) else [obj])
    return out


def _hora_local(campo):
    """{dateTime, timeZone} -> datetime en la hora local del perfil (utcOffsetHoras). El
    calendario suele devolver UTC: no convertir deja la manana 'sin reuniones'."""
    if isinstance(campo, dict):
        valor, tz = campo.get("dateTime", ""), str(campo.get("timeZone") or "UTC")
    else:
        valor, tz = str(campo), "UTC"
    t = dt.datetime.fromisoformat(valor[:19])
    if tz.upper() in ("UTC", "GMT", "Z", "COORDINATED UNIVERSAL TIME"):
        t += dt.timedelta(hours=UTC_OFFSET)
    return t


def cargar_agenda(ruta, fecha):
    """Reuniones del dia en hora local. Devuelve (vigentes, descartadas_automaticamente).
    Se descartan: canceladas, bloques sin asistentes, 'free'/'oof' y todo dia completo.
    Lo 'tentative' se conserva: las ceremonias recurrentes suelen llegar asi y se atienden."""
    vigentes, fuera = [], []
    for e in _eventos_crudos(Path(ruta).read_text(encoding="utf-8-sig")):
        if not isinstance(e, dict) or not e.get("subject") or not e.get("start"):
            continue
        try:
            ini, fin = _hora_local(e["start"]), _hora_local(e["end"])
        except Exception:
            continue
        if ini.date() != fecha:
            continue
        asunto = str(e["subject"]).strip()
        razon = None
        if e.get("isCancelled") or sin_tildes(asunto).startswith(("cancelado", "canceled")):
            razon = "cancelada"
        elif e.get("isAllDay"):
            razon = "todo el dia"
        elif not e.get("attendees"):
            razon = "sin asistentes (bloque propio)"
        elif str(e.get("showAs") or "").lower() in ("free", "oof"):
            razon = f"showAs={e.get('showAs')}"
        r = {"asunto": asunto, "desde": ini.strftime("%H:%M"), "hasta": fin.strftime("%H:%M"),
             "organizador": e.get("organizer") or "", "asistentes": len(e.get("attendees") or [])}
        (fuera if razon else vigentes).append({**r, "razon": razon} if razon else r)
    vigentes.sort(key=lambda r: r["desde"])
    return vigentes, fuera


def reuniones_sin_registrar(agenda, filas, descartadas=()):
    """Reuniones de la agenda que ninguna fila cubre y que no se declararon como no atendidas."""
    decl = [sin_tildes(d.get("reunion", "")) for d in descartadas if d.get("reunion")]
    faltan = []
    for r in agenda:
        if cubierto(r["desde"], r["hasta"], filas) >= CUBRE_MIN:
            continue
        if any(x and x in sin_tildes(r["asunto"]) for x in decl):
            continue
        faltan.append(r)
    return faltan


def huecos_jornada(filas, dow):
    """Tramos de la jornada que ninguna fila cubre, en HH:MM."""
    tramos = sorted((dec(parse_hora(f["desde"])), dec(parse_hora(f["hasta"])))
                    for f in filas if f.get("desde") and f.get("hasta"))
    out = []
    for ini, fin in JORNADA[dow]:
        cursor, b = dec(parse_hora(ini)), dec(parse_hora(fin))
        for x, y in tramos:
            if y <= cursor or x >= b:
                continue
            if x > cursor + 1e-9:
                out.append((cursor, x))
            cursor = max(cursor, y)
        if cursor < b - 1e-9:
            out.append((cursor, b))
    fmt = lambda h: f"{round(h * 60) // 60:02d}:{round(h * 60) % 60:02d}"
    return [(fmt(a), fmt(b)) for a, b in out if (b - a) * 60 >= 1]


# --------------------------------------------------------------------- estructura real
def layout(ws):
    """Lee del propio libro donde empieza cada dia y donde esta el TOTAL. La columna de fecha
    trae la fecha en toda fila del bloque, asi que el inicio de un dia es la fila donde la
    fecha cambia. Una fila sin fecha pertenece al dia en curso (libros viejos). Con esto el
    motor no depende del tamano nominal de los bloques: si un dia se amplio, lo refleja."""
    starts, total, actual = [], None, None
    for r in range(FIRST_ROW, ws.max_row + 1):
        v = ws.cell(row=r, column=COL_FECHA).value
        if v not in (None, "") and str(v).strip().upper().startswith(MARCA_TOTAL):
            total = r
            break
        if v in (None, ""):
            continue
        clave = str(v).strip()
        if clave != actual:                     # cambio de fecha = arranca otro dia
            starts.append(r)
            actual = clave
    if len(starts) != NDIAS or total is None:
        sys.exit(f"No se reconoce la estructura del libro: se esperaban {NDIAS} dias y la fila TOTAL, "
                 f"y se leyeron {len(starts)} fechas distintas en la columna A. Si editaste las "
                 "fechas a mano, todas las filas de un mismo dia deben llevar la misma.")
    return starts, total


def bloque(ws, dow):
    """(primera, ultima) fila del dia, segun la estructura real del libro."""
    starts, total = layout(ws)
    return starts[dow], (starts[dow + 1] if dow < NDIAS - 1 else total) - 1


def lunes_del_libro(ws):
    """El lunes de la semana, leido de la celda 'desde' del encabezado."""
    v = ws[CELDA_DESDE].value
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    sys.exit(f"{CELDA_DESDE} (Fecha Desde) no trae una fecha: no puedo fechar las filas del libro.")


def fecha_dia(ws, i):
    """Fecha del dia i (0=lunes) como VALOR, no como formula: openpyxl guarda la formula sin
    valor calculado y todo visor que no recalcula (vista previa del correo, Excel web o movil)
    mostraria la columna Fecha en blanco."""
    return dt.datetime.combine(lunes_del_libro(ws) + dt.timedelta(days=i), dt.time())


def fila_con_datos(ws, r):
    return any(ws.cell(row=r, column=c).value not in (None, "") for c in COLS.values())


def sellar_fechas(ws, starts, total):
    """Deja la fecha del dia en TODAS las filas de su bloque, con actividad o vacias: quien lee
    el libro lee filas sueltas, y un dia con pocas filas no puede verse con la columna a medias.
    Reescribe el libro entero, asi que tambien convierte formulas viejas en fechas fijas."""
    for i, ini in enumerate(starts):
        fin = (starts[i + 1] if i < len(starts) - 1 else total) - 1
        for r in range(ini, fin + 1):
            c = ws.cell(row=r, column=COL_FECHA)
            c.value = fecha_dia(ws, i)
            c.number_format = FORMATO_FECHA


def filas_sin_fecha(ws):
    """Filas del bloque cuya columna de fecha no trae la fecha fija de su dia. Debe salir
    vacia despues de sellar_fechas(); week y envio la verifican."""
    starts, total = layout(ws)
    malas = []
    for i, ini in enumerate(starts):
        fin = (starts[i + 1] if i < len(starts) - 1 else total) - 1
        esperada = fecha_dia(ws, i)
        for r in range(ini, fin + 1):
            if ws.cell(row=r, column=COL_FECHA).value != esperada:
                malas.append(r)
    return malas


def _col(k):
    from openpyxl.utils import get_column_letter
    return get_column_letter(COLS[k])


def reescribir_formulas(ws):
    """Reescribe las formulas que dependen del numero de fila. Obligatorio despues de
    insertar filas: openpyxl mueve los valores pero NO reajusta las referencias."""
    starts, total = layout(ws)
    sellar_fechas(ws, starts, total)
    primera, ultima = starts[0], total - 1
    for r in range(primera, ultima + 1):
        ws.cell(row=r, column=COL_EJEC).value = formula_i(ws, r)
    from openpyxl.utils import get_column_letter
    he = get_column_letter(COL_EJEC)
    ws.cell(row=total, column=COLS["asignadas"]).value = f"=SUM({_col('asignadas')}{primera}:{_col('asignadas')}{ultima})"
    ws.cell(row=total, column=COL_EJEC).value = f"=SUM({he}{primera}:{he}{ultima})"


def ampliar_dia(ws, dow, filas_necesarias):
    """Inserta filas al final del bloque del dia si no caben, copiando el formato de la
    ultima fila del bloque, y reescribe las formulas. Devuelve cuantas filas agrego."""
    ini, fin = bloque(ws, dow)
    capacidad = fin - ini + 1
    faltan = filas_necesarias - capacidad
    if faltan <= 0:
        return 0
    ws.insert_rows(fin + 1, faltan)
    # openpyxl NO mueve las celdas combinadas al insertar filas: si no se corren, el TOTAL cae
    # dentro de una combinacion ajena y queda de solo lectura.
    corridas = []
    for m in list(ws.merged_cells.ranges):
        if m.min_row > fin:
            corridas.append((m.min_col, m.min_row + faltan, m.max_col, m.max_row + faltan))
            # No se usa ws.unmerge_cells: insert_rows deja placeholders de la combinacion
            # fuera de _cells, y unmerge_cells los borra sin guard (KeyError). Se hace a mano.
            ws.merged_cells.remove(m)
            celdas = iter(m.cells)
            next(celdas, None)                      # la ancla conserva el valor
            for fr, fc in celdas:
                ws._cells.pop((fr, fc), None)
    for c1, r1, c2, r2 in corridas:
        ws.merge_cells(start_row=r1, start_column=c1, end_row=r2, end_column=c2)
    for r in range(fin + 1, fin + 1 + faltan):
        for c in range(1, NCOLS + 1):
            ws.cell(row=r, column=c)._style = copy(ws.cell(row=fin, column=c)._style)
        ws.row_dimensions[r].height = ws.row_dimensions[fin].height
    reescribir_formulas(ws)
    return faltan


# --------------------------------------------------------------------- categorias
def hoja_param(wb):
    return next(s for s in wb.sheetnames if s.lower().startswith(PREFIJO_PARAM))


def asegurar_categorias(wb, ws):
    """Deja la lista de categorias completa en la hoja de parametros del LIBRO SEMANAL (nunca
    en la plantilla) y apunta el desplegable de la columna de categoria a ese rango.
    Devuelve True si hubo que agregar algo."""
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation
    hp = wb[hoja_param(wb)]
    actuales = [hp.cell(row=r, column=COL_PARAM).value for r in range(2, hp.max_row + 1)]
    actuales = [str(v).strip() for v in actuales if v not in (None, "")]
    faltan = [c for c in CATEGORIAS if c not in actuales]
    if not faltan:
        return False
    fila = 2 + len(actuales)
    for c in faltan:
        hp.cell(row=fila, column=COL_PARAM).value = c
        fila += 1
    ultima = fila - 1
    ws.data_validations.dataValidation = [
        dv for dv in ws.data_validations.dataValidation
        if PREFIJO_PARAM not in str(dv.formula1).lower()]
    lp = get_column_letter(COL_PARAM)
    dv = DataValidation(type="list",
                        formula1=f"='{hoja_param(wb)}'!${lp}$2:${lp}${ultima}", allow_blank=True)
    ws.add_data_validation(dv)
    starts, total = layout(ws)
    dv.add(f"{_col('categoria')}{starts[0]}:{_col('categoria')}{total - 1}")
    return True


# --------------------------------------------------------------------- apertura
def abrir(fecha, crear=True):
    """Devuelve (workbook, worksheet, ruta). Crea el archivo de la semana si no existe."""
    import openpyxl
    from openpyxl.utils import get_column_letter
    ruta = ruta_semana(fecha)
    lunes, viernes = semana_de(fecha)
    nuevo = not ruta.exists()
    if nuevo:
        if not crear:
            sys.exit(f"No existe {ruta.name}")
        if not TPL.exists():
            sys.exit(f"No se encuentra la plantilla {TPL}")
        ruta.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TPL, ruta)

    try:
        wb = openpyxl.load_workbook(ruta)
    except PermissionError:
        sys.exit(f"{ruta.name} esta abierto en Excel. Cierralo y vuelve a intentar.")
    ws = wb[SHEET]

    if nuevo:
        # la plantilla trae textos de ejemplo dentro de los bloques: se limpian
        for r in range(FIRST_ROW, LAST_ROW + 1):
            for c in COLS.values():
                ws.cell(row=r, column=c).value = None
        ws[CELDA_DESDE], ws[CELDA_HASTA] = lunes, viernes
        ws[CELDA_DESDE].number_format = ws[CELDA_HASTA].number_format = FORMATO_FECHA
        for i, r0 in enumerate(DAY_ROWS):
            # la fecha va en TODAS las filas del bloque desde que nace el libro
            for r in range(r0, r0 + ROWS_PER_DAY):
                c = ws.cell(row=r, column=COL_FECHA)
                c.value = fecha_dia(ws, i)
                c.number_format = FORMATO_FECHA
        for r in range(FIRST_ROW, LAST_ROW + 1):
            ws.cell(row=r, column=COL_EJEC).value = FORM_I.format(r=r)
        fa, he = get_column_letter(COL_FECHA), get_column_letter(COL_EJEC)
        ws[f"{fa}{TOTAL_ROW}"] = ETIQUETA_TOTAL
        ws[f"{_col('asignadas')}{TOTAL_ROW}"] = f"=SUM({_col('asignadas')}{FIRST_ROW}:{_col('asignadas')}{LAST_ROW})"
        ws[f"{he}{TOTAL_ROW}"] = f"=SUM({he}{FIRST_ROW}:{he}{LAST_ROW})"
        # con el TOTAL ya puesto, la misma funcion que usan set/fechas/envio: cubre tambien
        # la fila separadora antes del TOTAL, que layout() cuenta como parte del ultimo dia
        sellar_fechas(ws, *layout(ws))

    asegurar_categorias(wb, ws)
    return wb, ws, ruta


def leer_dia(ws, dow):
    ini, fin = bloque(ws, dow)
    filas = []
    for r in range(ini, fin + 1):
        fila = {k: ws.cell(row=r, column=c).value for k, c in COLS.items()}
        if any(v not in (None, "") for v in fila.values()):
            for k in ("desde", "hasta"):
                if fila[k] is not None:
                    fila[k] = parse_hora(fila[k]).strftime("%H:%M")
            fila["_fila"] = r
            filas.append(fila)
    return filas


# --------------------------------------------------------------------- comandos
def cmd_perfil():
    """Resumen del perfil activo: lo que la sesion necesita saber antes de armar el dia."""
    P = PERFIL
    print(f"PERFIL ACTIVO: {RUTA_PERFIL}")
    print(f"  Organizacion: {P.get('organizacion') or '-'} | Colaborador: {NOMBRE or '-'} "
          f"| Identificacion: {IDENTIFICACION or '-'}")
    print(f"  Carpeta base: {BASE}\n  Plantilla: {TPL}\n  Bitacora: {BITACORA}")
    print(f"  Libro de la semana: {TIMESHEET}/{PLANTILLAS_RUTA['mes']}/{PLANTILLAS_RUTA['semana']}")
    for i in range(NDIAS):
        print(f"  Jornada {NOMBRES_DIA[i]}: {', '.join(f'{a}-{b}' for a, b in JORNADA[i])} = {HORAS_JORNADA[i]} h")
    print(f"  Cobertura Jira minima: {COBERTURA_MIN:.0f}% "
          + (f"(bloquea desde {VIGENCIA_COBERTURA:%d/%m/%Y})" if VIGENCIA_COBERTURA else "(EN AVISO, no bloquea)"))
    if (P.get("cobertura") or {}).get("nota"):
        print(f"    {P['cobertura']['nota']}")
    if VIGENCIA_REUNIONES_JIRA != dt.date.max:
        print(f"  Reuniones exigen issue desde {VIGENCIA_REUNIONES_JIRA:%d/%m/%Y}")
    guia = P.get("guiaCategorias") or {}
    print("  Categorias vigentes:")
    for c in CATEGORIAS:
        print(f"   - {c}" + (f": {guia[c]}" if guia.get(c) else ""))
    if ALIAS_CATEGORIAS:
        print("  Etiquetas retiradas -> vigente: "
              + "; ".join(f"{k} -> {v}" for k, v in ALIAS_CATEGORIAS.items()))
    for k, v in (P.get("notasAlias") or {}).items():
        print(f"    {k}: {v}")
    if CATS_LIDER:
        print(f"  Uso exclusivo del lider: {', '.join(sorted(CATS_LIDER))}")
    print(f"  Sin issue solo con '{CLIENTE_INTERNO}' en: {', '.join(sorted(CATS_SIN_ISSUE_OK))}")
    print(f"  Clientes conocidos: {', '.join(CLIENTES)}")
    if P.get("guiaClientes"):
        print(f"    {P['guiaClientes']}")

    def bloque_txt(titulo, valor):
        if not valor:
            return
        print(f"  {titulo}:")
        if isinstance(valor, dict):
            for k, v in valor.items():
                print(f"   - {k}: {v if not isinstance(v, list) else ', '.join(map(str, v))}")
        elif isinstance(valor, list):
            for x in valor:
                print(f"   - {x if not isinstance(x, dict) else json.dumps(x, ensure_ascii=False)}")
        else:
            print(f"   {valor}")

    bloque_txt("Envio", {k: v for k, v in ENVIO.items() if k != "reglas"})
    bloque_txt("Reglas de envio", ENVIO.get("reglas"))
    bloque_txt("Reuniones en Jira", P.get("reuniones"))
    bloque_txt("Planeacion inicial (fila fija)", P.get("planeacionInicial"))
    bloque_txt("Timesheets del equipo (cruce)", P.get("equipo"))
    bloque_txt("No va al timesheet", P.get("excluir"))
    bloque_txt("Ejemplos de redaccion", P.get("ejemplosRedaccion"))
    bloque_txt("Insumos externos", P.get("insumosExternos"))
    he = P.get("horasExtra") or {}
    bloque_txt("Horas extra", {k: v for k, v in he.items()
                               if k in ("carpeta", "archivo", "cortes", "diurna", "radicarA", "politica")})
    bloque_txt("Notas", P.get("notas"))


def cmd_show(fecha):
    if not ruta_semana(fecha).exists():
        print(f"Aun no existe el archivo de la semana: {ruta_semana(fecha).name}")
        return
    wb, ws, ruta = abrir(fecha, crear=False)
    dow = fecha.weekday()
    filas = leer_dia(ws, dow)
    ini, fin = bloque(ws, dow)
    print(f"{ruta.name} | {fecha:%A %d/%m/%Y} | bloque filas {ini}-{fin}")
    if not filas:
        print("  (dia vacio)")
    for f in filas:
        print(f"  {f['_fila']:>3} {f['desde']}-{f['hasta']} [{f['categoria']}] "
              f"jira={f['jira'] or 'SIN-ISSUE':<12} asig={f['asignadas']} "
              f"obs={f['observaciones'] or '-'} :: {str(f['tarea'])[:70]}")


def cmd_week(fecha):
    if not ruta_semana(fecha).exists():
        print(f"Aun no existe el archivo de la semana: {ruta_semana(fecha).name}")
        return
    wb, ws, ruta = abrir(fecha, crear=False)
    lunes, _ = semana_de(fecha)
    print(f"{ruta.name}")
    print(f"Colaborador: {ws[CELDA_NOMBRE].value or '(vacio)'} | Identificacion: {ws[CELDA_ID].value or '(vacio)'}")
    ta = te = tsj = 0.0                 # asignadas, ejecutadas, ejecutadas sin issue
    por_issue = {}                      # jira -> {"est": h, "ejec": h}
    nfilas_sj = 0
    huerfanas = []                      # filas sin codigo Jira o sin cliente
    cats_retiradas = {}                 # etiqueta retirada -> filas del libro donde sigue
    sin_pasar_sem = []                  # (dia, lineas TS de la bitacora que no llegaron al libro)
    for dow in range(NDIAS):
        filas = leer_dia(ws, dow)
        d = lunes + dt.timedelta(days=dow)
        asig = sum(f["asignadas"] or 0 for f in filas)
        ejec = extra = extend = sinj = 0.0
        for f in filas:
            if not (f["desde"] and f["hasta"]):
                continue
            obs_f = str(f["observaciones"] or "")
            h = horas_netas(parse_hora(f["desde"]), parse_hora(f["hasta"]),
                            descontar_almuerzo=not marca_fuera(obs_f))
            ejec += h
            if obs_f.startswith(EXTRA):
                extra += h
            elif obs_f.startswith(EXTENDIDA):
                extend += h
            jira = str(f["jira"] or "").strip().upper()
            if jira:
                e = por_issue.setdefault(jira, {"est": 0.0, "ejec": 0.0})
                e["ejec"] += h
                # la estimacion se declara UNA vez por semana: se toma el maximo, no la suma
                e["est"] = max(e["est"], float(f["asignadas"] or 0))
            else:
                sinj += h
                nfilas_sj += 1
            # codigo Jira y nombre del cliente son obligatorios; "Sin issue - <razon>" es una
            # excepcion declarada, no un campo olvidado: ya sale contada en sin_issue
            declarada = cuerpo_obs(f["observaciones"]).startswith(SIN_ISSUE)
            falta = [nm for nm, v in (("Jira", jira or ("declarada" if declarada else "")),
                                      ("cliente", str(f["cliente"] or "").strip())) if not v]
            if falta:
                huerfanas.append(f"fila {f['_fila']} ({d:%a %d/%m} {f['desde']}-{f['hasta']}): "
                                 f"falta {' y '.join(falta)}")
            retirada = canonico(str(f["categoria"] or ""), list(ALIAS_CATEGORIAS))
            if retirada:
                cats_retiradas.setdefault(retirada, []).append(f["_fila"])
        ta += asig; te += ejec; tsj += sinj
        jor = ejec - extra - extend
        estado = "vacio" if not filas else ("OK" if abs(jor - HORAS_JORNADA[dow]) < 0.011 else "REVISAR")
        cob_d = 100 * (ejec - sinj) / ejec if ejec else 100.0
        if filas and cob_d < COBERTURA_MIN - 1e-9:
            estado += (f"  INVALIDO cobertura<{COBERTURA_MIN:.0f}%" if exige_cobertura(d)
                       else f"  cobertura<{COBERTURA_MIN:.0f}% (regla en aviso)")
        pendientes_ts = ts_sin_pasar(d, filas)
        if pendientes_ts:
            estado += f"  {len(pendientes_ts)} TS DE LA BITACORA SIN PASAR AL LIBRO"
            sin_pasar_sem.append((d, pendientes_ts))
        print(f"  {d:%a %d/%m}  filas={len(filas)}  jornada={jor:5.2f}/{HORAS_JORNADA[dow]}"
              f"  extra={extra:5.2f}  extendida={extend:5.2f}  ejecutadas={ejec:5.2f}"
              f"  asignadas(Jira)={asig:5.2f}  sin_issue={sinj:5.2f}  jira={cob_d:5.1f}%  {estado}")
    print(f"  TOTAL       ejecutadas={te:5.2f}  asignadas(Jira)={ta:5.2f}")
    sin_fecha = filas_sin_fecha(ws)
    if sin_fecha:
        print(f"  FILAS SIN FECHA FIJA EN LA COLUMNA A: {sin_fecha} -> corrige con 'fechas'")
    for d, pend in sin_pasar_sem:
        print(f"  {d:%a %d/%m}: lineas TS de la bitacora que NO estan en el libro:")
        for t in pend:
            print(f"   - {t['desde']}-{t['hasta']} {t['jira'] or 'SIN-JIRA'} [{t['categoria']}] "
                  f"{t['tarea'][:70]}  (bitacora linea {t['_linea']})")

    # --- trazabilidad: los dos numeros que se le muestran a quien recibe el timesheet
    cob = 100 * (te - tsj) / te if te else 0.0
    print(f"\nTRAZABILIDAD  cobertura Jira={cob:5.1f}% de las horas"
          f"  |  sin issue={tsj:.2f} h en {nfilas_sj} fila(s)")
    if huerfanas:
        quien_pide = f"el {CITAS['campos']}" if CITAS.get("campos") else "el perfil"
        print(f"  CAMPOS QUE GERENCIA EXIGE Y FALTAN ({len(huerfanas)} fila(s)) - {quien_pide} "
              f"pide codigo Jira Y nombre del cliente en toda actividad:")
        for x in huerfanas:
            print("   -", x)
    if cats_retiradas:
        print("  CATEGORIAS RETIRADAS todavia escritas en el libro (reescribe el dia con 'set' "
              "para que salgan con la etiqueta vigente):")
        for k, v in cats_retiradas.items():
            print(f"   - '{k}' -> '{ALIAS_CATEGORIAS[k]}' en la(s) fila(s) {v}")
    if por_issue:
        print("  issue          estimado  ejec_sem  consumo")
        for k in sorted(por_issue):
            v = por_issue[k]
            if v["est"] == 0:
                cons = "SIN ESTIMAR"
            else:
                pct = 100 * v["ejec"] / v["est"]
                cons = f"{pct:5.0f}%" + ("  SOBREPASA" if v["ejec"] > v["est"] else "")
            print(f"  {k:<14}{v['est']:8.2f}{v['ejec']:10.2f}  {cons}")
        sin_est = [k for k, v in por_issue.items() if v["est"] == 0]
        if sin_est:
            print(f"  SIN ESTIMACION en Jira ({len(sin_est)}): {', '.join(sorted(sin_est))}"
                  f"  -> esas horas no son evaluables contra cronograma")


def cmd_set(fecha, payload, parcial=False, hueco=None, agenda=None, sin_agenda=None):
    dow = fecha.weekday()
    if dow > NDIAS - 1:
        sys.exit("Solo se registran dias de lunes a viernes.")
    filas = payload.get("rows", [])
    if len(filas) > MAX_ROWS_PER_DAY:
        sys.exit(f"{len(filas)} filas para el dia. El bloque crece segun haga falta, pero "
                 f"{MAX_ROWS_PER_DAY} es el tope de cordura: revisa si estas fragmentando "
                 f"de mas y agrupa lo que sea la misma actividad.")

    # ---- validaciones antes de escribir
    errores, jornada = [], 0.0
    remapeadas = []        # categorias retiradas que se reescribieron a la etiqueta vigente
    clientes_nuevos = {}   # cliente fuera de CLIENTES -> primera fila donde aparece
    vistos = []
    con_estimacion = {}    # jira -> fila donde ya se declaro su estimacion (no se repite)
    sin_estimacion = {}    # jira -> fila; issues trabajadas sin horas estimadas en Jira
    sin_issue = []         # filas sin codigo Jira (solo con "Sin issue - <razon>")
    for i, f in enumerate(filas, 1):
        for k in ("cliente", "categoria", "tarea", "desde", "hasta"):
            if not str(f.get(k) or "").strip():
                errores.append(f"fila {i}: falta '{k}'")
        if f.get("categoria"):
            cat, retirada = canon_categoria(f["categoria"])
            if cat is None:
                errores.append(f"fila {i}: categoria '{f['categoria']}' no esta en {CATEGORIAS} "
                               f"ni es una etiqueta retirada conocida")
            else:
                if retirada:
                    remapeadas.append(f"fila {i}: '{retirada}' -> '{cat}'")
                f["categoria"] = cat      # se escribe siempre la forma canonica vigente
        if f.get("cliente"):
            cli, desconocido = canon_cliente(f["cliente"])
            if cli is None:
                errores.append(f"fila {i}: 'cliente' es un relleno ('{f['cliente']}'). Gerencia "
                               f"exige el NOMBRE DEL CLIENTE en toda actividad; si el tramo "
                               f"sirvio a dos clientes, parte la fila")
            else:
                f["cliente"] = cli
                if desconocido:
                    clientes_nuevos.setdefault(cli, i)
        try:
            d, h = parse_hora(f["desde"]), parse_hora(f["hasta"])
        except Exception:
            errores.append(f"fila {i}: horas invalidas (usa HH:MM)")
            continue
        if dec(h) <= dec(d):
            errores.append(f"fila {i}: 'hasta' debe ser mayor que 'desde'")
            continue
        obs = str(f.get("observaciones") or "")
        fuera = es_fuera_de_jornada(d, h, dow)
        asig = float(f.get("asignadas") or 0)
        if fuera and not marca_fuera(obs):
            errores.append(f"fila {i} ({f['desde']}-{f['hasta']}): esta fuera de la jornada; "
                           f"la observacion debe empezar con \"{EXTRA}\" (si se radica como hora "
                           f"extra) o con \"{EXTENDIDA}\" (si solo se reporta y no se cobra)")
        if not fuera and marca_fuera(obs):
            errores.append(f"fila {i}: esta dentro de la jornada, no marques "
                           f"\"{EXTRA}\" ni \"{EXTENDIDA}\"")
        # ---- trazabilidad: toda fila cuelga de una issue de Jira
        jira = str(f.get("jira") or "").strip().upper()
        if jira:
            if not RE_JIRA.match(jira):
                errores.append(f"fila {i}: codigo Jira '{jira}' invalido (formato PROY-123)")
            if cuerpo_obs(obs).startswith(SIN_ISSUE):
                errores.append(f"fila {i}: tiene issue {jira}; quita la observacion \"{SIN_ISSUE}\"")
            if jira in con_estimacion and asig != 0:
                errores.append(f"fila {i}: la estimacion de {jira} ya se declaro en la fila "
                               f"{con_estimacion[jira]}; repetirla infla el total de asignadas. "
                               f"Deja 'asignadas' en 0 en esta fila")
            elif asig != 0:
                con_estimacion[jira] = i
        else:
            cat_f = str(f.get("categoria") or "")
            cli_f = str(f.get("cliente") or "")
            if exige_reunion_jira(fecha, cat_f):
                errores.append(f"fila {i} ({f['desde']}-{f['hasta']}): reunion [{cat_f}] sin codigo "
                               f"Jira. Desde el {VIGENCIA_REUNIONES_JIRA:%d/%m/%Y} "
                               f"{MSG_REUNION_JIRA}")
            elif not cuerpo_obs(obs).startswith(SIN_ISSUE):
                errores.append(f"fila {i} ({f['desde']}-{f['hasta']}): sin codigo Jira. Toda hora "
                               f"laboral cuelga de una issue; si de verdad no existe, la "
                               f"observacion debe empezar con \"{SIN_ISSUE} - <razon>\" (o con la "
                               f"marca de fuera de jornada seguida de \"- {SIN_ISSUE} - <razon>\")")
            elif (cat_f not in CATS_SIN_ISSUE_OK
                  or canonico(cli_f, [CLIENTE_INTERNO]) is None):
                errores.append(f"fila {i} ({f['desde']}-{f['hasta']}): \"{SIN_ISSUE}\" solo se "
                               f"acepta en trabajo interno ({CLIENTE_INTERNO}) y en las "
                               f"categorias {sorted(CATS_SIN_ISSUE_OK)}. Esta fila es trabajo "
                               f"de proyecto ({cli_f} / {cat_f}) y gerencia la exige con codigo "
                               f"Jira: consigue o crea la issue antes de registrar el tramo")
            if asig != 0:
                errores.append(f"fila {i}: 'asignadas'={asig} exige codigo Jira")
            sin_issue.append(i)
        if jira and asig == 0 and jira not in con_estimacion:
            sin_estimacion.setdefault(jira, i)
        if not fuera:
            jornada += horas_netas(d, h)
        for (od, oh, oi) in vistos:
            if dec(d) < oh and od < dec(h):
                errores.append(f"fila {i} se cruza con la fila {oi}")
        vistos.append((dec(d), dec(h), i))

    sin_estimacion = {k: v for k, v in sin_estimacion.items() if k not in con_estimacion}
    incompleto = filas and abs(jornada - HORAS_JORNADA[dow]) > 0.011
    if incompleto and not parcial and not hueco:
        errores.append(f"las horas ejecutadas dentro de la jornada suman {jornada:.2f} y deben "
                       f"sumar {HORAS_JORNADA[dow]}. Si el dia aun no termina, usa --parcial. "
                       f"NUNCA inventes actividades para cuadrar: si el dia cerro y no hay "
                       f"evidencia de esas horas, usa --hueco \"<razon>\" y se declara el faltante")

    # ---- cobertura Jira del dia: por debajo del minimo no es un dia valido (si la regla rige)
    ejec_d, sinj_d, cob_d = cobertura(filas)
    tope_sin_issue = ejec_d * (1 - COBERTURA_MIN / 100)
    cobertura_baja = filas and cob_d < COBERTURA_MIN - 1e-9
    if cobertura_baja and not parcial and exige_cobertura(fecha):
        errores.append(f"cobertura Jira del dia = {cob_d:.1f}% ({sinj_d:.2f} h sin issue de "
                       f"{ejec_d:.2f} h). El minimo es {COBERTURA_MIN:.0f}%: con {ejec_d:.2f} h "
                       f"caben {tope_sin_issue:.2f} h sin issue. Cuelga las reuniones internas y "
                       f"las dailys de su issue (del proyecto que se trato, o de la issue interna "
                       f"de la celula) antes de cerrar el dia")

    # ---- el calendario es obligatorio al cerrar el dia: sin el, el timesheet sale sin
    # reuniones que si ocurrieron
    agenda_vig = agenda_desc = []
    if agenda:
        agenda_vig, agenda_desc = cargar_agenda(agenda, fecha)
        faltan_r = reuniones_sin_registrar(agenda_vig, filas, payload.get("descartadas", []))
        if faltan_r and not parcial:
            for r in faltan_r:
                errores.append(f"reunion del calendario sin registrar: {r['desde']}-{r['hasta']} "
                               f"'{r['asunto']}' ({r['asistentes']} asistentes). Registrala, o si "
                               f"no la atendiste declarala en \"descartadas\": "
                               f"[{{\"reunion\": \"{r['asunto'][:30]}\", \"razon\": \"...\"}}]")
    elif not parcial and not sin_agenda:
        errores.append("para cerrar el dia hay que cruzarlo con el calendario de Teams/Outlook: "
                       "pasa --agenda <archivo con la salida de outlook_calendar_search> o, si de "
                       "verdad no se puede consultar, --sin-agenda \"<razon>\"")

    # ---- lo declarado en la bitacora tiene que llegar al libro
    pend_ts = ts_sin_pasar(fecha, filas)
    if pend_ts and not parcial:
        for t in pend_ts:
            errores.append(f"linea TS de la bitacora (linea {t['_linea']}) sin fila en el dia: "
                           f"{t['desde']}-{t['hasta']} {t['jira'] or 'SIN-JIRA'} {t['tarea'][:60]}")
    if errores:
        print("No se escribio nada. Corrige:")
        for e in errores:
            print("  -", e)
        sys.exit(1)

    # ---- escritura
    wb, ws, ruta = abrir(fecha)

    # la estimacion de una issue se declara UNA sola vez en la semana: si ya esta en otro
    # dia, aqui va en 0 (si no, el total de 'Horas Asignadas' de la semana queda inflado)
    choques = []
    for otro in range(NDIAS):
        if otro == dow:
            continue
        for prev in leer_dia(ws, otro):
            pj = str(prev["jira"] or "").strip().upper()
            if pj and (prev["asignadas"] or 0):
                sin_estimacion.pop(pj, None)   # ya declarada otro dia: no es "sin estimar"
            if pj and (prev["asignadas"] or 0) and pj in con_estimacion:
                dia = NOMBRES_DIA[otro]
                choques.append(f"{pj}: su estimacion ya esta declarada el {dia} "
                               f"(fila {prev['_fila']} del libro); en la fila "
                               f"{con_estimacion[pj]} de este dia debe ir en 0")
    if choques:
        print("No se escribio nada. Corrige:")
        for c in choques:
            print("  -", c)
        sys.exit(1)

    if payload.get("nombre"):
        ws[CELDA_NOMBRE] = payload["nombre"]
    if payload.get("identificacion"):
        ws[CELDA_ID] = payload["identificacion"]

    agregadas = ampliar_dia(ws, dow, len(filas))
    ini, fin = bloque(ws, dow)
    for j, r in enumerate(range(ini, fin + 1)):
        f = filas[j] if j < len(filas) else {}
        for k, c in COLS.items():
            v = f.get(k)
            if k in ("desde", "hasta") and v:
                v = parse_hora(v)
            if k == "asignadas":
                v = float(v) if v not in (None, "") else None
            ws.cell(row=r, column=c).value = v if v not in ("",) else None
    # siempre, no solo al ampliar: garantiza que las formulas por fila y el TOTAL de la
    # semana apunten al rango real, aunque los bloques se hayan corrido antes
    reescribir_formulas(ws)
    wb.save(ruta)

    ejec = sum(horas_netas(parse_hora(f["desde"]), parse_hora(f["hasta"]),
                           descontar_almuerzo=not marca_fuera(f.get("observaciones")))
               for f in filas)
    if agregadas:
        print(f"Bloque del dia ampliado en {agregadas} fila(s): el formato base traia "
              f"{ROWS_PER_DAY} y los dias siguientes quedaron corridos, con las formulas "
              f"y el total recalculados.")
    print(f"Escrito {fecha:%A %d/%m/%Y} en {ruta.name} (filas {ini}-{ini+len(filas)-1}): "
          f"{len(filas)} filas, jornada={jornada:.2f}/{HORAS_JORNADA[dow]}, "
          f"ejecutadas={ejec:.2f}, extra={ejec-jornada:.2f}")
    if incompleto and hueco:
        print(f"HUECO DECLARADO: {HORAS_JORNADA[dow]-jornada:.2f} h de la jornada quedan sin "
              f"actividad soportada. Razon: {hueco}")
        print("  No se rellenaron con nada. Decide tu si eso se explica al enviar el timesheet.")
    elif incompleto:
        print(f"PARCIAL: faltan {HORAS_JORNADA[dow]-jornada:.2f} h de jornada por declarar. "
              f"Vuelve a correr 'set' al cerrar el dia (reemplaza el bloque, no duplica).")
    print(f"COBERTURA JIRA del dia: {cob_d:.1f}% ({sinj_d:.2f} h sin issue; minimo "
          f"{COBERTURA_MIN:.0f}% = maximo {tope_sin_issue:.2f} h sin issue)"
          + ("" if not cobertura_baja else
             ("  -> NO VALIDO: el dia no se puede cerrar asi" if exige_cobertura(fecha)
              else "  -> por debajo del minimo (regla en aviso, no bloquea)")))
    if agenda:
        print(f"AGENDA cruzada: {len(agenda_vig)} reunion(es) vigentes, {len(agenda_desc)} "
              f"descartadas solas (canceladas / sin asistentes / libres)")
        for r in reuniones_sin_registrar(agenda_vig, filas, payload.get("descartadas", [])):
            print(f"  PENDIENTE {r['desde']}-{r['hasta']} {r['asunto']}")
    elif sin_agenda:
        print(f"AGENDA NO CRUZADA: {sin_agenda}")
    for t in pend_ts:
        print(f"  TS PENDIENTE (bitacora linea {t['_linea']}): {t['desde']}-{t['hasta']} "
              f"{t['jira'] or 'SIN-JIRA'} {t['tarea'][:60]}")
    if sin_estimacion:
        print("AVISO - issues trabajadas SIN horas estimadas en Jira (estimarlas es tarea del lider):")
        for k, v in sin_estimacion.items():
            print(f"  - {k} (fila {v})")
    if sin_issue:
        print(f"AVISO - {len(sin_issue)} fila(s) sin issue de Jira: {sin_issue}. "
              f"Eso es hora hombre no imputable a ningun proyecto.")
    if remapeadas:
        print("AVISO - categorias retiradas reescritas a la etiqueta vigente"
              + (f" ({CITAS['categorias']}):" if CITAS.get("categorias") else ":"))
        for r in remapeadas:
            print("  -", r)
    if clientes_nuevos:
        print(f"AVISO - cliente fuera de {CLIENTES}; confirma que se escribe asi en el reporte:")
        for k, v in clientes_nuevos.items():
            print(f"  - '{k}' (fila {v})")
    lunes, viernes = semana_de(fecha)
    print("Asunto del correo: " + (ENVIO.get("asuntoSet") or "Timesheet {fecha:%d/%m/%Y}").format(
        fecha=fecha, nombre=NOMBRE, lunes=lunes, viernes=viernes))


def cmd_remap(fecha):
    """Reescribe en el libro de la semana las categorias retiradas por su etiqueta vigente.
    Solo toca la columna de categoria y solo valores que estan en aliasCategorias: no
    reordena filas, no recalcula horas y no inventa nada."""
    if not ruta_semana(fecha).exists():
        sys.exit(f"Aun no existe el archivo de la semana: {ruta_semana(fecha).name}")
    wb, ws, ruta = abrir(fecha, crear=False)
    cambios = []
    for dow in range(NDIAS):
        for f in leer_dia(ws, dow):
            viejo = canonico(str(f["categoria"] or ""), list(ALIAS_CATEGORIAS))
            if viejo:
                nuevo = ALIAS_CATEGORIAS[viejo]
                ws.cell(row=f["_fila"], column=COLS["categoria"]).value = nuevo
                cambios.append(f"fila {f['_fila']}: '{f['categoria']}' -> '{nuevo}'")
    if not cambios:
        print(f"{ruta.name}: nada por remapear, todas las categorias ya son vigentes.")
        return
    asegurar_categorias(wb, ws)
    wb.save(ruta)
    print(f"{ruta.name}: {len(cambios)} fila(s) remapeadas a la categoria vigente")
    for c in cambios:
        print("  -", c)
    print("Revisa el libro: el criterio nuevo cambia como lee gerencia esas filas.")


def cmd_fechas(fecha):
    """Normaliza la columna Fecha del libro de la semana sin tocar ninguna actividad."""
    if not ruta_semana(fecha).exists():
        sys.exit(f"Aun no existe el archivo de la semana: {ruta_semana(fecha).name}")
    wb, ws, ruta = abrir(fecha, crear=False)
    antes = filas_sin_fecha(ws)
    reescribir_formulas(ws)
    try:
        wb.save(ruta)
    except PermissionError:
        sys.exit(f"{ruta.name} esta abierto en Excel. Cierralo y vuelve a intentar.")
    despues = filas_sin_fecha(ws)
    print(f"{ruta.name}: {len(antes)} fila(s) sin fecha fija corregidas; pendientes: {len(despues)}")
    starts, total = layout(ws)
    for i, ini in enumerate(starts):
        fin = (starts[i + 1] if i < NDIAS - 1 else total) - 1
        n = sum(1 for r in range(ini, fin + 1) if fila_con_datos(ws, r))
        print(f"  {fecha_dia(ws, i):%a %d/%m/%Y}: filas {ini}-{fin} fechadas "
              f"({fin - ini + 1} filas, {n} con actividad)")
    if despues:
        sys.exit(f"Quedaron filas sin fecha: {despues}")


def cmd_envio(fecha, force=False):
    """Genera la copia del libro con el nombre que exige el perfil (envio.nombreArchivo) y la
    deja lista para adjuntar. El libro semanal sigue siendo la fuente de trabajo; el archivo es
    acumulativo y lleva la fecha del dia que se envia."""
    ruta = ruta_semana(fecha)
    if not ruta.exists():
        sys.exit(f"No existe {ruta.name}: registra el dia antes de generar el envio.")
    wb, ws, _ = abrir(fecha, crear=False)
    nombre = str(ws[CELDA_NOMBRE].value or "").strip()
    if not nombre:
        sys.exit(f"El libro no tiene nombre del colaborador en {CELDA_NOMBRE}; no puedo nombrar el archivo.")
    # --- gate: el archivo NO sale con filas sin codigo Jira o sin cliente
    faltantes, retiradas = [], []
    nombres_dia = NOMBRES_DIA[:NDIAS]
    for dow in range(NDIAS):
        for f in leer_dia(ws, dow):
            jira = str(f["jira"] or "").strip()
            cli = str(f["cliente"] or "").strip()
            obs = str(f["observaciones"] or "")
            falta = []
            dia_f = semana_de(fecha)[0] + dt.timedelta(days=dow)
            if not jira and (not cuerpo_obs(obs).startswith(SIN_ISSUE)
                             or exige_reunion_jira(dia_f, str(f["categoria"] or ""))):
                falta.append("codigo Jira")
            if not cli:
                falta.append("nombre del cliente")
            if falta:
                faltantes.append(f"{nombres_dia[dow]} fila {f['_fila']}: falta "
                                 f"{' y '.join(falta)} -> {str(f['tarea'] or '')[:60]}")
            if canonico(str(f["categoria"] or ""), list(ALIAS_CATEGORIAS)):
                retiradas.append(f"{nombres_dia[dow]} fila {f['_fila']}: "
                                 f"categoria retirada '{f['categoria']}'")
    # --- gate de cobertura y de lineas TS que no llegaron al libro. Ninguno se salta con
    # --force: un dia bajo el minimo no es valido, y un dia con tramos declarados que no estan
    # en el libro sale incompleto sin que nadie lo note.
    invalidos, avisos_cob, ts_pend = [], [], []
    lunes_env, _ = semana_de(fecha)
    for dow in range(fecha.weekday() + 1):
        d = lunes_env + dt.timedelta(days=dow)
        filas_d = leer_dia(ws, dow)
        if not filas_d:
            continue
        ejec_d, sinj_d, cob_d = cobertura(filas_d)
        if cob_d < COBERTURA_MIN - 1e-9:
            txt = (f"{nombres_dia[dow]} {d:%d/%m}: cobertura Jira {cob_d:.1f}% "
                   f"({sinj_d:.2f} h sin issue de {ejec_d:.2f} h)")
            (invalidos if exige_cobertura(d) else avisos_cob).append(txt)
        for t in ts_sin_pasar(d, filas_d):
            ts_pend.append(f"{nombres_dia[dow]} {d:%d/%m} {t['desde']}-{t['hasta']} "
                           f"{t['jira'] or 'SIN-JIRA'} {t['tarea'][:60]} (bitacora linea {t['_linea']})")
    if invalidos or ts_pend:
        print("NO se genero el archivo de envio.")
        if invalidos:
            print(f"  Dias por debajo del {COBERTURA_MIN:.0f}% de cobertura Jira (no son validos):")
            for x in invalidos:
                print("   -", x)
        if ts_pend:
            print("  Tramos declarados en la bitacora que NO estan en el libro:")
            for x in ts_pend:
                print("   -", x)
        print("Corrige con 'set' el dia afectado. Esta compuerta no se salta con --force.")
        sys.exit(1)

    if faltantes and not force:
        if CITAS.get("campos"):
            print("NO se genero el archivo de envio. Gerencia ya reporto exactamente esto "
                  f"({CITAS['campos']}): actividades sin codigo Jira y sin nombre de cliente.")
        else:
            print("NO se genero el archivo de envio: hay actividades sin codigo Jira o sin "
                  "nombre de cliente.")
        for x in faltantes:
            print("  -", x)
        print("Corrige con 'set' el dia afectado. Si de verdad tiene que salir asi, "
              "--force lo genera y tu asumes la explicacion.")
        sys.exit(1)

    # --- la copia que sale lleva la fecha FIJA en cada fila: se sella el libro antes de
    # copiarlo, por si alguna fila se escribio a mano o quedo de antes.
    reescribir_formulas(ws)
    try:
        wb.save(ruta)
    except PermissionError:
        sys.exit(f"{ruta.name} esta abierto en Excel. Cierralo y vuelve a intentar.")
    sin_fecha = filas_sin_fecha(ws)
    if sin_fecha:
        sys.exit(f"NO se genero el archivo de envio: filas sin su fecha en la columna A: "
                 f"{sin_fecha}. Esta compuerta no se salta con --force.")

    lunes, viernes = semana_de(fecha)
    fmt = dict(nombre=nombre, fecha=fecha, lunes=lunes, viernes=viernes)
    dest_dir = carpeta_mes(fecha) / PLANTILLAS_RUTA["envio"]
    dest_dir.mkdir(parents=True, exist_ok=True)
    destino = dest_dir / (ENVIO.get("nombreArchivo") or "Timesheet {nombre}-{fecha:%d-%m-%Y}.xlsx").format(**fmt)
    shutil.copy2(ruta, destino)

    dias = [i for i in range(NDIAS) if leer_dia(ws, i)]
    nombres = nombres_dia
    print(f"Listo para adjuntar: {destino}")
    print(f"  Contenido acumulado: {', '.join(nombres[i] for i in dias) or '(vacio)'}")
    if fecha.weekday() == NDIAS - 1:
        print("  Asunto sugerido: " + (ENVIO.get("asuntoUltimoDia") or
              "TimeSheet {nombre} semana {lunes:%d/%m/%Y} al {viernes:%d/%m/%Y} (total de la semana)").format(**fmt))
    else:
        print("  Asunto sugerido: " + (ENVIO.get("asunto") or "TimeSheet {nombre} {fecha:%d/%m/%Y}").format(**fmt))
    print("  " + (ENVIO.get("destinatarios") or "Para: (define envio.destinatarios en el perfil)"))
    if fecha.weekday() not in dias:
        print(f"  OJO: el dia que estas enviando ({nombres[fecha.weekday()]}) esta VACIO.")
    if faltantes and force:
        print(f"  FORZADO: {len(faltantes)} fila(s) salen sin codigo Jira o sin cliente. "
              + ("Es el hallazgo que gerencia ya reporto; explicalo en el correo."
                 if CITAS.get("campos") else "Explicalo en el correo."))
    if avisos_cob:
        print(f"  AVISO: dias que salen por debajo del {COBERTURA_MIN:.0f}% de cobertura Jira (regla en aviso):")
        for x in avisos_cob:
            print("   -", x)
    if retiradas:
        print("  AVISO: el libro todavia trae categorias retiradas:")
        for x in retiradas:
            print("   -", x)


def cmd_borrador(fecha, agenda=None, salida=None):
    """Arma el JSON del dia a partir de las lineas TS de la bitacora (1:1, sin reinterpretar) y
    lo cruza con el calendario: reuniones que ninguna linea TS cubre, huecos de la jornada y la
    cobertura Jira que tendria el dia. No escribe el libro: el JSON se revisa y se pasa a 'set'."""
    dow = fecha.weekday()
    if dow > NDIAS - 1:
        sys.exit("Solo se registran dias de lunes a viernes.")
    ts = lineas_ts(fecha)
    malas = [t for t in ts if "_error" in t]
    ts = sorted((t for t in ts if "_error" not in t), key=lambda t: (t["desde"], t["_linea"]))
    # si dos lineas TS se cruzan, manda la escrita despues: es la correccion de la primera
    elegidas, reemplazadas = [], []
    for t in ts:
        a, b = dec(parse_hora(t["desde"])), dec(parse_hora(t["hasta"]))
        choca = [e for e in elegidas
                 if solape_min(a, b, dec(parse_hora(e["desde"])), dec(parse_hora(e["hasta"]))) > 0]
        for e in choca:
            viejo, nuevo = (e, t) if e["_linea"] < t["_linea"] else (t, e)
            reemplazadas.append((viejo, nuevo))
        if all(e["_linea"] < t["_linea"] for e in choca):
            elegidas = [e for e in elegidas if e not in choca] + [t]
    elegidas.sort(key=lambda t: t["desde"])

    ya_estimadas = set()
    if ruta_semana(fecha).exists():
        _, ws, _ = abrir(fecha, crear=False)
        for otro in range(NDIAS):
            if otro != dow:
                ya_estimadas |= {str(f["jira"] or "").upper() for f in leer_dia(ws, otro)
                                 if f["jira"] and (f["asignadas"] or 0)}
    rows, revisar = [], []
    for t in elegidas:
        obs = ""
        if not t["jira"] and exige_reunion_jira(fecha, canon_categoria(t["categoria"])[0]):
            revisar.append(f"{t['desde']}-{t['hasta']} reunion sin issue: {MSG_REUNION_JIRA}")
        elif not t["jira"]:
            obs = f"{SIN_ISSUE} - trabajo interno sin issue asociada"
            revisar.append(f"{t['desde']}-{t['hasta']} sin issue: cuenta contra el "
                           f"{100 - COBERTURA_MIN:.0f}% permitido; si se trato un proyecto, ponle su issue")
        if es_fuera_de_jornada(parse_hora(t["desde"]), parse_hora(t["hasta"]), dow):
            revisar.append(f"{t['desde']}-{t['hasta']} fuera de jornada: la observacion debe empezar "
                           f"con \"{EXTRA}\" o \"{EXTENDIDA}\" (decide {quien()} cual)")
        asig = 0
        if t["jira"] and t["est"] and t["jira"] not in ya_estimadas:
            asig = t["est"]
            ya_estimadas.add(t["jira"])
        rows.append({"cliente": t["cliente"], "categoria": t["categoria"], "jira": t["jira"],
                     "tarea": t["tarea"], "desde": t["desde"], "hasta": t["hasta"],
                     "asignadas": asig, "observaciones": obs})

    vig, desc = cargar_agenda(agenda, fecha) if agenda else ([], [])
    candidatas = reuniones_sin_registrar(vig, rows)
    # dos reuniones a la misma hora: solo una se pudo atender
    solapes = [(x, y) for i, x in enumerate(vig) for y in vig[i + 1:]
               if solape_min(dec(parse_hora(x["desde"])), dec(parse_hora(x["hasta"])),
                             dec(parse_hora(y["desde"])), dec(parse_hora(y["hasta"]))) > 0]

    out = {"nombre": NOMBRE, "identificacion": IDENTIFICACION, "rows": rows,
           "descartadas": [], "_reuniones_sin_registrar": candidatas}
    import tempfile
    salida = Path(salida or Path(tempfile.gettempdir()) / NOMBRE_BORRADOR.format(fecha=fecha))
    salida.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    ejec, sinj, cob = cobertura(rows)
    print(f"BORRADOR {fecha:%A %d/%m/%Y}: {len(rows)} fila(s) desde {len(elegidas)} linea(s) TS "
          f"de la bitacora -> {salida}")
    for r in rows:
        print(f"  {r['desde']}-{r['hasta']} {r['jira'] or 'SIN-JIRA':<12} [{r['categoria']}] {r['tarea'][:60]}")
    jor = sum(horas_netas(parse_hora(r["desde"]), parse_hora(r["hasta"])) for r in rows
              if not es_fuera_de_jornada(parse_hora(r["desde"]), parse_hora(r["hasta"]), dow))
    print(f"JORNADA {jor:.2f}/{HORAS_JORNADA[dow]}  |  COBERTURA JIRA {cob:.1f}% "
          f"({sinj:.2f} h sin issue; minimo {COBERTURA_MIN:.0f}%)"
          + ("  -> NO VALIDO" if rows and cob < COBERTURA_MIN - 1e-9 else ""))
    if not agenda:
        print("AGENDA: no se paso --agenda. Consulta outlook_calendar_search del dia y vuelve a "
              "correr el borrador con el archivo: sin eso el dia no se puede cerrar.")
    else:
        print(f"AGENDA: {len(vig)} reunion(es) vigentes; descartadas solas: "
              + (", ".join(f"{d['desde']} {d['asunto']} ({d['razon']})" for d in desc) or "ninguna"))
        if candidatas:
            print("  Reuniones del calendario SIN linea TS (registrar con su issue, o declarar en "
                  "\"descartadas\" si no se atendieron):")
            for r in candidatas:
                print(f"   - {r['desde']}-{r['hasta']} {r['asunto']} ({r['asistentes']} asistentes, "
                      f"organiza {r['organizador']})")
        for x, y in solapes:
            print(f"  SOLAPE: {x['desde']}-{x['hasta']} {x['asunto']}  <->  {y['desde']}-{y['hasta']} "
                  f"{y['asunto']}: solo una se atendio, la otra va en \"descartadas\"")
    hs = huecos_jornada(rows, dow)
    if hs:
        print("HUECOS de la jornada sin linea TS:")
        for a, b in hs:
            en = [r for r in candidatas
                  if solape_min(dec(parse_hora(a)), dec(parse_hora(b)),
                                dec(parse_hora(r["desde"])), dec(parse_hora(r["hasta"]))) > 0]
            print(f"   - {a}-{b}" + (f"  (calendario: {'; '.join(r['asunto'] for r in en)})" if en
                                     else f"  (sin reunion en el calendario: preguntale {a_persona()})"))
    for viejo, nuevo in reemplazadas:
        print(f"CORREGIDA: linea {viejo['_linea']} ({viejo['desde']}-{viejo['hasta']}) se cruza con la "
              f"linea {nuevo['_linea']} ({nuevo['desde']}-{nuevo['hasta']}); manda la posterior")
    for t in malas:
        print(f"LINEA TS ILEGIBLE (bitacora linea {t['_linea']}, {t['_error']}): {t['_texto'][:100]}")
    for x in revisar:
        print("REVISAR:", x)


def main():
    p = argparse.ArgumentParser(description="Timesheet en libro corporativo (con perfil de organizacion).")
    p.add_argument("cmd", choices=["show", "set", "week", "envio", "remap", "borrador", "fechas", "perfil"])
    p.add_argument("--date", help="YYYY-MM-DD (todos los comandos menos 'perfil')")
    p.add_argument("--perfil", help="ruta del perfil de organizacion (JSON)")
    p.add_argument("--json", help="archivo JSON con el dia (solo para set)")
    p.add_argument("--parcial", action="store_true",
                   help="permite escribir un dia que aun no completa la jornada")
    p.add_argument("--force", action="store_true",
                   help="solo para 'envio': genera el archivo aunque haya filas sin codigo "
                        "Jira o sin cliente (asumes la explicacion)")
    p.add_argument("--hueco", metavar="RAZON",
                   help="dia cerrado cuyas horas no llegan a la jornada: declara el faltante "
                        "en vez de rellenar con actividades inventadas")
    p.add_argument("--agenda", metavar="ARCHIVO",
                   help="salida de outlook_calendar_search del dia (tal cual llega), "
                        "para 'set' y 'borrador'")
    p.add_argument("--sin-agenda", metavar="RAZON",
                   help="solo para 'set': cierra el dia sin cruzar el calendario, declarando por que")
    p.add_argument("--out", help="solo para 'borrador': ruta del JSON que genera")
    a = p.parse_args()
    configurar(*cargar_perfil(a.perfil))
    if a.cmd == "perfil":
        cmd_perfil()
        return
    if not a.date:
        sys.exit("--date AAAA-MM-DD es obligatorio para este comando.")
    fecha = dt.date.fromisoformat(a.date)
    if a.cmd == "borrador":
        cmd_borrador(fecha, agenda=a.agenda, salida=a.out)
    elif a.cmd == "show":
        cmd_show(fecha)
    elif a.cmd == "week":
        cmd_week(fecha)
    elif a.cmd == "envio":
        cmd_envio(fecha, force=a.force)
    elif a.cmd == "remap":
        cmd_remap(fecha)
    elif a.cmd == "fechas":
        cmd_fechas(fecha)
    else:
        if not a.json:
            sys.exit("set requiere --json")
        cmd_set(fecha, json.loads(Path(a.json).read_text(encoding="utf-8-sig")),
                parcial=a.parcial, hueco=a.hueco, agenda=a.agenda, sin_agenda=a.sin_agenda)


if __name__ == "__main__":
    main()
