#!/usr/bin/env python3
"""
Lector SOLO LECTURA contra MongoDB de TEST de esta mesa.

Espeja las reglas de scripts/dbread.ps1 (SQL) pero para Mongo:
  - Lee la cadena de conexion ACTIVA (no comentada con //) del appsettings.json indicado
    (key MongoServerConnectionString o ConnectionMongo), la decodifica de Base64 si aplica.
  - NUNCA imprime la cadena de conexion ni la contrasena (solo host + BD).
  - Solo lectura: unicamente ejecuta find(); no hay ningun path de escritura.
  - --ConfirmDb OBLIGATORIO y debe coincidir con la BD activa; ademas bloquea cualquier
    BD que no contenga 'test' ni 'prueba'.
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
    from pymongo import MongoClient
    from bson import ObjectId
    from bson.json_util import default as bson_default
except Exception as e:
    print("Falta pymongo. Instala con: python -m pip install pymongo", file=sys.stderr)
    raise

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


def _obj_hook(d):
    if "$oid" in d and len(d) == 1:
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
    if not re.search(r"(?i)(test|prueba)", dbname):
        raise SystemExit(f"BLOQUEADO: la BD activa '{dbname}' no contiene 'test' ni 'prueba'. Solo TEST.")
    if args.ConfirmDb != dbname:
        raise SystemExit(f"BLOQUEADO: --ConfirmDb '{args.ConfirmDb}' no coincide con la BD activa '{dbname}'.")

    print("==================== mongoread (SOLO LECTURA) ====================")
    print(f"Host       : {host}")
    print(f"BD         : {dbname}")
    print(f"Coleccion  : {args.Collection}")
    print(f"Filtro     : {args.Filter}")
    print(f"Proyeccion : {args.Project or '(completo - AllowNoProject)'}")
    print(f"Limit      : {args.Limit}")
    print("-----------------------------------------------------------------")
    if args.DryRun:
        print("[DryRun] No se ejecuto nada. Confirma el destino antes de ejecutar.")
        return

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
