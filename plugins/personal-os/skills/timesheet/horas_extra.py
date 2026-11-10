#!/usr/bin/env python3
"""Formato de horas extra por CORTE de radicación (modo con perfil de organización).

Las horas extra no van en el timesheet semanal: van en el formato propio de la organización,
un archivo por corte de radicación. Todo lo de la organización (carpeta, nombre del archivo,
filas y columnas del formato, cortes, franja diurna, a quién se radica, qué códigos no pueden
ir en las observaciones) sale de la sección "horasExtra" del perfil (ver perfiles/ejemplo.json).
Los festivos salen del perfil y de config.json → festivos.

Cortes (perfil → horasExtra.cortes, p. ej. [{"hasta": 11, "nombre": "10-11"}, {"hasta": 21, "nombre": "20-21"}]):
  el día cae en el primer corte cuyo "hasta" sea >= día; después del último, va al primer
  corte del mes siguiente.

Uso:
  python horas_extra.py add  --fecha 2026-10-19 --desde 21:00 --hasta 00:00 --obs "..." [--novedades "..."] [--festivo]
  python horas_extra.py show --fecha 2026-10-19        (muestra el corte que contiene esa fecha)
  python horas_extra.py del  --fecha 2026-10-19 --desde 21:00   (quita esa fila)
  Opción común: --perfil <ruta del perfil>

Reglas:
  - Una fila no cruza medianoche: «--hasta 00:00» significa 24:00 del mismo día; lo que sigue va
    en otra fila con la fecha del día siguiente.
  - Diurna / nocturna según horasExtra.diurna. Domingo o festivo va en las columnas de
    dominical/festivo.
  - Las observaciones van sin códigos de issue: el formato sale a gerencia y nómina.
  - Si ya hay una fila con la misma fecha y hora de inicio, se reemplaza (no se duplica).
"""
import argparse, datetime as dt, glob, json, os, re, shutil, sys
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import MergedCell

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


# --------------------------------------------------------------------- perfil
def os_home():
    e = os.environ.get("PERSONAL_OS_HOME")
    return Path(e).expanduser() if e else Path.home() / ".claude" / "personal-os"


def leer_config():
    ruta = os_home() / "config.json"
    try:
        return json.loads(ruta.read_text(encoding="utf-8-sig")) if ruta.exists() else {}
    except Exception:
        return {}


def ruta_perfil(arg=None):
    if arg:
        return Path(arg).expanduser()
    if os.environ.get("TIMESHEET_PERFIL"):
        return Path(os.environ["TIMESHEET_PERFIL"]).expanduser()
    p = (leer_config().get("timesheet") or {}).get("perfil")
    return Path(p).expanduser() if p else os_home() / "timesheet-perfil.json"


def configurar(arg=None):
    global BASE, NOMBRE, PRIMERA, ULTIMA, COL, LIMPIAR, ORDEN, HORAS, SUMA, NOVEDADES, MESES
    global FESTIVOS, CORTES, DIURNA, PROHIBIDO, RADICAR, ARCHIVO, PATRON
    ruta = ruta_perfil(arg)
    if not ruta.exists():
        sys.exit(f"No hay perfil de organizacion en {ruta}: copia perfiles/ejemplo.json de la skill "
                 "y llena su seccion horasExtra.")
    P = json.loads(ruta.read_text(encoding="utf-8-sig"))
    H = P.get("horasExtra") or {}
    if not H:
        sys.exit(f"{ruta} no tiene la seccion horasExtra.")
    r = P.get("rutas") or {}
    env = r.get("variablesEntorno") or {}
    base = next((os.environ[n] for n in (env.get("base"), "TIMESHEET_DIR") if n and os.environ.get(n)),
                r.get("base"))
    if not base:
        sys.exit(f"{ruta}: falta rutas.base.")
    BASE = os.path.join(os.path.expanduser(base), H.get("carpeta") or "horas extra")
    NOMBRE = str((P.get("persona") or {}).get("nombre") or "").strip()
    PRIMERA, ULTIMA = (H.get("filas") or [11, 21])
    COL = H.get("columnas") or dict(fecha="A", desde="B", hasta="C", ed="D", en="E", edf="F",
                                    enf="G", obs="J")
    LIMPIAR = H.get("columnasLimpiar") or "ABCDEFGHIJKL"
    ORDEN = H.get("columnasOrden") or "ABCDEFGHIJL"
    HORAS = H.get("columnasHorasLimpiar") or "DEFGHI"
    SUMA = H.get("columnasSuma") or "DEFG"
    NOVEDADES = H.get("celdaNovedades") or "A23"
    MESES = H.get("meses") or ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep",
                               "oct", "nov", "dic"]
    FESTIVOS = {str(x) for x in (H.get("festivos") or [])} | \
               {str(x) for x in (leer_config().get("festivos") or [])}
    CORTES = H.get("cortes") or [{"hasta": 15, "nombre": "15"}, {"hasta": 31, "nombre": "fin"}]
    DIURNA = H.get("diurna") or ["06:00", "19:00"]
    PROHIBIDO = re.compile(H.get("codigosProhibidos") or r"\b[A-Z][A-Z0-9]{1,9}-\d+", re.I)
    RADICAR = H.get("radicarA") or ""
    ARCHIVO = H.get("archivo") or "Horas extra - {nombre} - corte {corte}{mes} {anio}.xlsx"
    PATRON = H.get("patronPlantilla") or "*.xlsx"


def corte(fecha):
    for c in CORTES:
        if fecha.day <= int(c["hasta"]):
            return fecha.year, fecha.month, c["nombre"]
    y, m = (fecha.year + 1, 1) if fecha.month == 12 else (fecha.year, fecha.month + 1)
    return y, m, CORTES[0]["nombre"]


def ruta_corte(fecha):
    y, m, dias = corte(fecha)
    return os.path.join(BASE, ARCHIVO.format(nombre=NOMBRE, corte=dias, mes=MESES[m - 1], anio=y))


def plantilla():
    """El formato mas reciente sirve de plantilla: conserva logos, estilos y encabezado."""
    cands = [f for f in glob.glob(os.path.join(BASE, PATRON))
             if not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit(f"No hay ningun formato en {BASE} para usar de plantilla.")
    return max(cands, key=os.path.getmtime)


def abrir(fecha):
    ruta = ruta_corte(fecha)
    if not os.path.exists(ruta):
        shutil.copy2(plantilla(), ruta)
        wb = openpyxl.load_workbook(ruta)
        ws = wb.active
        for r in range(PRIMERA, ULTIMA + 1):
            for c in LIMPIAR:
                if not isinstance(ws[f"{c}{r}"], MergedCell):
                    ws[f"{c}{r}"].value = None
        ws[NOVEDADES].value = None
        wb.save(ruta)
    wb = openpyxl.load_workbook(ruta)
    return ruta, wb, wb.active


def minutos(h):
    hh, mm = map(int, h.split(":"))
    return hh * 60 + mm


def partir(desde, hasta):
    """Devuelve (horas diurnas, horas nocturnas) del tramo."""
    a, b = minutos(desde), minutos(hasta)
    if b == 0:
        b = 24 * 60
    if b <= a:
        sys.exit("El tramo cruza medianoche: parte la fila en dos (hasta 00:00 y desde 00:00 del dia siguiente).")
    d0, d1 = minutos(DIURNA[0]), minutos(DIURNA[1])
    diurno = max(0, min(b, d1) - max(a, d0))
    return round(diurno / 60, 2), round((b - a - diurno) / 60, 2)


def hora(h):
    hh, mm = map(int, h.split(":"))
    return dt.time(hh % 24, mm)


def ordenar(ws):
    """Deja las filas en orden cronologico (fecha y hora de inicio)."""
    cols = ORDEN
    filas = [[ws[f"{c}{r}"].value for c in cols] for r in range(PRIMERA, ULTIMA + 1)
             if ws[f"{COL['fecha']}{r}"].value is not None]
    filas.sort(key=lambda v: (v[0], v[1] or dt.time()))
    for i, r in enumerate(range(PRIMERA, ULTIMA + 1)):
        vals = filas[i] if i < len(filas) else [None] * len(cols)
        for c, v in zip(cols, vals):
            ws[f"{c}{r}"].value = v


def cmd_add(a):
    fecha = dt.date.fromisoformat(a.fecha)
    if PROHIBIDO.search(a.obs):
        sys.exit("Las observaciones no llevan codigos internos de Jira: escribe que era.")
    ruta, wb, ws = abrir(fecha)
    diur, noct = partir(a.desde, a.hasta)
    festivo = a.festivo or fecha.weekday() == 6 or fecha.isoformat() in FESTIVOS
    A, B, C = COL["fecha"], COL["desde"], COL["hasta"]
    fila = None
    for r in range(PRIMERA, ULTIMA + 1):
        v = ws[f"{A}{r}"].value
        if v is None:
            fila = fila or r
            continue
        if (v.date() if isinstance(v, dt.datetime) else v) == fecha and ws[f"{B}{r}"].value == hora(a.desde):
            fila = r
            break
    if fila is None:
        sys.exit(f"El formato ya tiene las {ULTIMA - PRIMERA + 1} filas llenas: {ruta}")
    ws[f"{A}{fila}"].value = dt.datetime.combine(fecha, dt.time())
    ws[f"{B}{fila}"].value = hora(a.desde)
    ws[f"{C}{fila}"].value = hora(a.hasta)
    for c in HORAS:
        ws[f"{c}{fila}"].value = None
    if festivo:
        ws[f"{COL['edf']}{fila}"].value = diur or None
        ws[f"{COL['enf']}{fila}"].value = noct or None
    else:
        ws[f"{COL['ed']}{fila}"].value = diur or None
        ws[f"{COL['en']}{fila}"].value = noct or None
    ws[f"{COL['obs']}{fila}"].value = a.obs
    if a.novedades:
        ws[NOVEDADES].value = a.novedades
    ordenar(ws)
    wb.save(ruta)
    print(f"ok fila {fila}: {fecha} {a.desde}-{a.hasta} diurna={diur} nocturna={noct}"
          f"{' (dominical/festivo)' if festivo else ''}\n{ruta}")
    show(ws, ruta, fecha)


def cmd_del(a):
    """Quita la fila de esa fecha y hora de inicio (para mover un tramo a otra hora)."""
    fecha = dt.date.fromisoformat(a.fecha)
    ruta = ruta_corte(fecha)
    if not os.path.exists(ruta):
        sys.exit(f"Aun no existe el formato de este corte: {ruta}")
    wb = openpyxl.load_workbook(ruta)
    ws = wb.active
    A, B = COL["fecha"], COL["desde"]
    for r in range(PRIMERA, ULTIMA + 1):
        v = ws[f"{A}{r}"].value
        if v is not None and (v.date() if isinstance(v, dt.datetime) else v) == fecha \
                and ws[f"{B}{r}"].value == hora(a.desde):
            for c in ORDEN:
                ws[f"{c}{r}"].value = None
            ordenar(ws)
            wb.save(ruta)
            print(f"ok borrada: {fecha} desde {a.desde}\n{ruta}")
            show(ws, ruta, fecha)
            return
    sys.exit(f"No hay fila del {fecha} que empiece a las {a.desde}.")


def show(ws, ruta, fecha):
    y, m, dias = corte(fecha)
    print(f"\nCorte {dias} {MESES[m-1]} {y}: se radica{' a ' + RADICAR if RADICAR else ''} "
          f"los dias {dias} de {MESES[m-1]}.")
    tot = 0.0
    A, B, C = COL["fecha"], COL["desde"], COL["hasta"]
    for r in range(PRIMERA, ULTIMA + 1):
        if ws[f"{A}{r}"].value is None:
            continue
        hs = sum((ws[f"{c}{r}"].value or 0) for c in SUMA)
        tot += hs
        f = ws[f"{A}{r}"].value
        obs = ws[f"{COL['obs']}{r}"].value
        print(f"  {f:%d/%m} {ws[f'{B}{r}'].value:%H:%M}-{ws[f'{C}{r}'].value:%H:%M}  {hs:4.2f} h  "
              f"{str(obs)[:70]}")
    print(f"  TOTAL {tot:.2f} h")


def cmd_show(a):
    fecha = dt.date.fromisoformat(a.fecha)
    ruta = ruta_corte(fecha)
    if not os.path.exists(ruta):
        sys.exit(f"Aun no existe el formato de este corte: {ruta}")
    wb = openpyxl.load_workbook(ruta)
    show(wb.active, ruta, fecha)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--perfil", help="ruta del perfil de organizacion (JSON)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("add")
    s.add_argument("--fecha", required=True)
    s.add_argument("--desde", required=True)
    s.add_argument("--hasta", required=True)
    s.add_argument("--obs", required=True)
    s.add_argument("--festivo", action="store_true")
    s.add_argument("--novedades")
    s.add_argument("--perfil", dest="perfil_sub")
    s.set_defaults(fn=cmd_add)
    s = sub.add_parser("del")
    s.add_argument("--fecha", required=True)
    s.add_argument("--desde", required=True)
    s.add_argument("--perfil", dest="perfil_sub")
    s.set_defaults(fn=cmd_del)
    s = sub.add_parser("show")
    s.add_argument("--fecha", required=True)
    s.add_argument("--perfil", dest="perfil_sub")
    s.set_defaults(fn=cmd_show)
    a = p.parse_args()
    configurar(getattr(a, "perfil_sub", None) or a.perfil)
    a.fn(a)


if __name__ == "__main__":
    main()
