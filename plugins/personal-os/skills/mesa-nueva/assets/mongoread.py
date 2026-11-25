#!/usr/bin/env python3
"""
Lector SOLO LECTURA contra MongoDB de TEST de esta mesa.

Espeja las reglas de scripts/dbread.ps1 (SQL) pero para Mongo:
  - Lee la cadena de conexion ACTIVA (no comentada con //) del appsettings.json indicado
    (key MongoServerConnectionString o ConnectionMongo), la decodifica de Base64 si aplica.
  - NUNCA imprime la cadena de conexion ni la contrasena (solo host + BD).
  - Solo lectura: unicamente ejecuta find(); no hay ningun path de escritura.
  - --ConfirmDb OBLIGATORIO y debe coincidir con la BD activa.
  - Permisos de Config > Bases de datos del Personal OS (D-072): si el host y la BD estan
    registrados, manda su permiso de Leer (bloqueado = no se consulta; me pregunta / automatico =
    se permite, el guardia de Claude Code pide el OK cuando toca). Si no estan registrados, solo
    se permite una BD que contenga 'test' o 'prueba'. Un servidor de produccion de las reglas de
    la organizacion (guardia-empresa.json -> servidores_deny) se bloquea siempre: gana la regla
    mas estricta.
  - --Limit OBLIGATORIO en toda consulta (analogo al TOP(N) de SQL); sin proyeccion se
    rechaza salvo --AllowNoProject (para no volcar datos sensibles de pacientes).
  - --DryRun muestra el destino sin ejecutar.
  - En --Filter se aceptan ObjectId como {"$oid": "..."} y fechas como {"$date": "..."}.

Regla de uso (politica global del usuario): antes de CADA consulta se muestra el destino con
--DryRun y se espera OK explicito. Una aprobacion no cubre la siguiente.

Uso tipico:
  # Ver destino sin ejecutar (para pedir OK)
  python scripts/mongoread.py --ConfirmDb <bd_test> --Collection <coleccion> \
      --Filter "{\"_id\": {\"$oid\": \"...\"}}" --Project "{\"Estado\":1}" --Limit 5 --DryRun
  # Ejecutar (tras OK del usuario)
  python scripts/mongoread.py --ConfirmDb <bd_test> --Collection <coleccion> \
      --Filter "{\"_id\": {\"$oid\": \"...\"}}" --Project "{\"Estado\":1}" --Limit 5
"""
import argparse, base64, json, os, re, sys
from urllib.parse import urlsplit

try:
    from bson import ObjectId
except Exception:   # sin pymongo igual funcionan las validaciones y --DryRun
    ObjectId = None

MESA_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_APPSETTINGS = os.path.join(MESA_ROOT, "__APPSETTINGS_DEFAULT_MONGO__")
CONN_KEYS = ("MongoServerConnectionString", "ConnectionMongo")


def _leer_conn_activa(appsettings):
    if not os.path.exists(appsettings):
        raise SystemExit(f"No existe appsettings: {appsettings}")
    with open(appsettings, encoding="utf-8-sig") as fh:
        for line in fh:
            if line.lstrip().startswith("//"):
                continue
            for key in CONN_KEYS:
                m = re.search(r'"' + key + r'"\s*:\s*"([^"]+)"', line)
                if m:
                    return m.group(1)
    raise SystemExit("No se encontro una cadena de conexion Mongo activa en el appsettings.")


def _decodificar(conn):
    if conn.lower().startswith("mongodb"):
        return conn
    try:
        return base64.b64decode(conn).decode("utf-8").strip()
    except Exception:
        return conn


def _host(servidor):
    h = str(servidor or "").strip().lower()
    if h.startswith("tcp:"):
        h = h[4:]
    return re.split(r"[,\\:]", h)[0].strip()


def _leer_json(ruta):
    try:
        with open(ruta, encoding="utf-8-sig") as fh:
            return json.load(fh)
    except Exception:
        return None


def _os_home():
    return os.environ.get("PERSONAL_OS_HOME") or os.path.join(os.path.expanduser("~"), ".claude", "personal-os")


def _permiso_destino(host, dbname):
    """(nombre de la conexion, modo de leer) si el destino esta registrado en la consola; (None, None) si no."""
    reg = _leer_json(os.path.join(_os_home(), "conexiones-bd.json")) or {}
    for c in reg.get("conexiones") or []:
        d = _leer_json(c.get("archivo") or "") or {}
        if _host(d.get("servidor")) != host.lower():
            continue
        if dbname.lower() not in [str(x).lower() for x in (d.get("catalogos") or [])]:
            continue
        p = (d.get("permisos") or {}).get("leer")
        modo = p if p in ("bloqueado", "preguntar", "automatico") else ("automatico" if d.get("modo_lectura") == "automatico" else "preguntar")
        return c.get("nombre") or c.get("id"), modo
    return None, None


def _produccion_de_la_org(host):
    g = _leer_json(os.path.join(_os_home(), "guardia-empresa.json")) or {}
    return any(_host(h) == host.lower() for h in (g.get("servidores_deny") or []))


def _obj_hook(d):
    if "$oid" in d and len(d) == 1 and ObjectId is not None:
        return ObjectId(d["$oid"])
    return d


def main():
    ap = argparse.ArgumentParser(description="Lector SOLO LECTURA de Mongo TEST.")
    ap.add_argument("--ConfirmDb", required=True, help="Debe coincidir con la BD activa y contener 'test'/'prueba'.")
    ap.add_argument("--Collection", required=True)
    ap.add_argument("--Filter", default="{}", help='Filtro JSON. ObjectId como {"$oid":"..."}.')
    ap.add_argument("--Project", default=None, help='Proyeccion JSON, p.ej. {"Estado":1}.')
    ap.add_argument("--Limit", type=int, default=None, help="Obligatorio (analogo a TOP(N)).")
    ap.add_argument("--AppSettings", default=DEFAULT_APPSETTINGS)
    ap.add_argument("--DryRun", action="store_true")
    ap.add_argument("--AllowNoProject", action="store_true", help="Permite traer el documento completo.")
    args = ap.parse_args()

    # ---- Validaciones de la CONSULTA ----
    if args.Limit is None or args.Limit <= 0:
        raise SystemExit("BLOQUEADO: --Limit(N) es obligatorio y > 0 (analogo al TOP de SQL).")
    if args.Project is None and not args.AllowNoProject:
        raise SystemExit("BLOQUEADO: indica --Project para no volcar el documento completo, o usa --AllowNoProject.")

    try:
        filtro = json.loads(args.Filter, object_hook=_obj_hook)
    except Exception as ex:
        raise SystemExit(f"BLOQUEADO: --Filter no es JSON valido: {ex}")
    proyeccion = None
    if args.Project is not None:
        try:
            proyeccion = json.loads(args.Project)
        except Exception as ex:
            raise SystemExit(f"BLOQUEADO: --Project no es JSON valido: {ex}")

    # ---- Cadena de conexion + destino ----
    conn = _decodificar(_leer_conn_activa(args.AppSettings))
    sp = urlsplit(conn)
    host = sp.hostname or "?"
    dbname = (sp.path or "/").lstrip("/").split("?")[0] or None

    # ---- Validaciones de DESTINO ----
    if not dbname:
        raise SystemExit("BLOQUEADO: la cadena activa no especifica base de datos en la URI.")
    if _produccion_de_la_org(host):
        raise SystemExit(f"BLOQUEADO: {host} es un servidor de produccion segun las reglas de la organizacion.")
    conexion, modo = _permiso_destino(host, dbname)
    if conexion:
        if modo == "bloqueado":
            raise SystemExit(f"BLOQUEADO: leer en la conexion '{conexion}' esta bloqueado en Config > Bases de datos.")
    elif not re.search(r"(?i)(test|prueba)", dbname):
        raise SystemExit(f"BLOQUEADO: '{dbname}' no esta registrada en Config > Bases de datos y no contiene 'test' ni 'prueba'.")
    if args.ConfirmDb != dbname:
        raise SystemExit(f"BLOQUEADO: --ConfirmDb '{args.ConfirmDb}' no coincide con la BD activa '{dbname}'.")

    print("==================== mongoread (SOLO LECTURA) ====================")
    print(f"Host       : {host}")
    print(f"BD         : {dbname}")
    print(f"Coleccion  : {args.Collection}")
    print(f"Filtro     : {args.Filter}")
    print(f"Proyeccion : {args.Project or '(completo - AllowNoProject)'}")
    print(f"Limit      : {args.Limit}")
    print(f"Permiso    : {('conexion ' + repr(conexion) + ' · leer ' + modo) if conexion else 'no registrada en la consola: solo TEST'}")
    print("-----------------------------------------------------------------")
    if args.DryRun:
        print("[DryRun] No se ejecuto nada. Confirma el destino antes de ejecutar.")
        return

    try:
        from pymongo import MongoClient
        from bson.json_util import default as bson_default
    except Exception:
        raise SystemExit("Falta pymongo. Instala con: python -m pip install pymongo")
    client = MongoClient(conn, serverSelectionTimeoutMS=5000)
    col = client.get_default_database()[args.Collection]
    n = 0
    for doc in col.find(filtro, proyeccion).limit(args.Limit):
        print(json.dumps(doc, default=bson_default, ensure_ascii=False))
        n += 1
    print("-----------------------------------------------------------------")
    print(f"{n} documento(s).")
    print("=================================================================")


if __name__ == "__main__":
    main()
