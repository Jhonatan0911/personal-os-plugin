#!/usr/bin/env python3
"""Acceso de Claude a las bases de STAGING de la regresión guiada (lectura y escritura).

Solo contra los hosts de staging declarados en <mesa>/kit/hosts-permitidos.json -> "staging". Nunca producción.
La escritura exige una ventana aprobada por el líder: <mesa>/kit/perfil.json -> staging.escritura_hasta
("AAAA-MM-DD" o "sin-limite") o la variable REGV_ESCRITURA_HASTA (manda si existe). Sin ventana, solo lectura.
Si la lectura es autónoma o pide OK por consulta lo decide la configuración (staging.lectura_autonoma), no este script.

Credenciales (nunca se imprimen):
  1) Variables de entorno REGV_STAGING_SQL y REGV_STAGING_MONGO (mandan si existen), o
  2) <mesa>/credenciales/conexiones.json -> {"staging": {"sqlserver": "...", "mongo": "..."}}
  La cadena SQL es estilo ADO: Server=host[,puerto];Database=...;User Id=...;Password=...

Uso:
  python staging.py verificar
  python staging.py sql-leer   --sql "SELECT TOP 100 ..." [--salida archivo.jsonl] [--max 500]
  python staging.py sql-escribir --sql "UPDATE ... WHERE ..." | --sql "EXEC dbo.Sp @p=1"
  python staging.py mongo-leer --base B --coleccion C --filtro '{"a":1}' [--proyeccion '{"x":1}'] [--max 500] [--salida f.jsonl]
  python staging.py mongo-escribir --base B --coleccion C --op insert|update|delete --filtro '{...}' [--doc '{...}'] [--muchos]

Bloqueado siempre: DDL y administración (DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, DENY, BACKUP,
RESTORE, SHUTDOWN, DBCC, xp_*, sp_configure, sp_addlogin…), UPDATE/DELETE sin WHERE, varias sentencias
en sql-leer, y en Mongo drop/dropDatabase y update/delete con filtro vacío.
Registro: <mesa>/.regresion/staging.log (fecha, motor, host, base, tipo, filas; el texto de la sentencia
va recortado a 300 caracteres). Driver SQL: pyodbc (ODBC Driver 17/18) o python-tds; instalar
cualquiera de los dos necesita el OK del responsable.
"""
import argparse, datetime, hashlib, json, os, re, sys
from pathlib import Path

MESA = Path(os.environ.get("REGRESION_MESA", os.getcwd()))


def _perfil():
    try:
        return json.loads((MESA / "kit" / "perfil.json").read_text(encoding="utf-8-sig"))
    except Exception:
        return {}


PERFIL = _perfil()
APP = str(PERFIL.get("app_nombre") or "regresion-guiada")
# Ventana de escritura aprobada por el líder. Sin ventana -> VENCE = None -> solo lectura.
_h = (os.environ.get("REGV_ESCRITURA_HASTA") or str((PERFIL.get("staging") or {}).get("escritura_hasta") or "")).strip().lower()
if _h == "sin-limite":
    VENCE = datetime.datetime(2099, 12, 31, 23, 59)
elif _h:
    VENCE = datetime.datetime.strptime(_h, "%Y-%m-%d").replace(hour=23, minute=59)
else:
    VENCE = None
LOG = MESA / ".regresion" / "staging.log"

DDL = re.compile(r"\b(DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN|DBCC|RECONFIGURE|KILL|OPENROWSET|OPENDATASOURCE|BULK\s+INSERT)\b|\bxp_\w+|\bsp_(configure|addlogin|addsrvrolemember|addrolemember|droplogin|password|executesql\s+N?'\s*(DROP|ALTER|CREATE))", re.I)
ESCRIBE = re.compile(r"\b(INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE)\b", re.I)


def alto(msg, codigo=2):
    print(f"ALTO: {msg}", file=sys.stderr)
    sys.exit(codigo)


def bitacora(**d):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    d = {"t": datetime.datetime.now().isoformat(timespec="seconds"), **d}
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False, default=str) + "\n")


def vigente():
    if VENCE is None:
        alto("no hay ventana de escritura aprobada (kit/perfil.json -> staging.escritura_hasta o REGV_ESCRITURA_HASTA). Solo lectura.")
    if datetime.datetime.now() > VENCE:
        alto(f"la excepción de escritura en staging venció el {VENCE:%d/%m/%Y %H:%M}. Pídele al líder una nueva (REGV_ESCRITURA_HASTA).")


def hosts_staging():
    try:
        j = json.loads((MESA / "kit" / "hosts-permitidos.json").read_text(encoding="utf-8-sig"))
        return {str(h).lower() for h in j.get("staging", [])}
    except Exception:
        return set()


def cadena(motor):
    env = {"sql": "REGV_STAGING_SQL", "mongo": "REGV_STAGING_MONGO"}[motor]
    if os.environ.get(env):
        return os.environ[env]
    try:
        c = json.loads((MESA / "credenciales" / "conexiones.json").read_text(encoding="utf-8-sig"))
        v = c.get("staging", {}).get("sqlserver" if motor == "sql" else "mongo")
        if v:
            return v
    except Exception:
        pass
    alto(f"no hay credenciales de staging para {motor} (variable {env} o credenciales/conexiones.json -> staging).")


def partes_ado(s):
    d = {}
    for p in s.split(";"):
        if "=" in p:
            k, v = p.split("=", 1)
            d[k.strip().lower()] = v.strip()
    srv = d.get("server") or d.get("data source") or d.get("address") or ""
    srv = srv.replace("tcp:", "")
    host, _, puerto = srv.partition(",")
    return {"host": host.split("\\")[0], "puerto": int(puerto or 1433), "srv": srv,
            "base": d.get("database") or d.get("initial catalog") or "",
            "usuario": d.get("user id") or d.get("uid") or d.get("user") or "",
            "clave": d.get("password") or d.get("pwd") or ""}


def host_mongo(uri):
    m = re.match(r"mongodb(?:\+srv)?://(?:[^@/]*@)?([^/?]+)", uri)
    return [h.split(":")[0].lower() for h in (m.group(1).split(",") if m else [])]


def exigir_staging(hosts):
    permitidos = hosts_staging()
    if not permitidos:
        alto("kit/hosts-permitidos.json no declara 'staging'. Sin esa lista no se conecta a nada.")
    fuera = [h for h in hosts if h.lower() not in permitidos]
    if fuera:
        alto(f"el host {fuera[0]} no está en la lista de staging. No se conecta (podría ser producción).")


def conectar_sql():
    p = partes_ado(cadena("sql"))
    exigir_staging([p["host"]])
    try:
        import pyodbc
        drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
        drv = next((d for d in drivers if "18" in d), None) or next((d for d in drivers if "17" in d), None) or (drivers[0] if drivers else None)
        if not drv:
            raise ImportError
        cs = f"DRIVER={{{drv}}};SERVER={p['srv']};DATABASE={p['base']};UID={p['usuario']};PWD={p['clave']};TrustServerCertificate=yes;APP={APP}"
        return pyodbc.connect(cs, autocommit=False), p
    except ImportError:
        pass
    try:
        import pytds
        return pytds.connect(server=p["host"], port=p["puerto"], database=p["base"], user=p["usuario"], password=p["clave"], autocommit=False, appname=APP), p
    except ImportError:
        alto("no hay driver de SQL Server para Python (pyodbc u python-tds). Instalarlo necesita el OK del responsable: pip install pyodbc")


def filas_a_dicts(cur, maximo):
    cols = [c[0] for c in cur.description] if cur.description else []
    out = []
    for r in cur.fetchmany(maximo):
        out.append({c: v for c, v in zip(cols, r)})
    return out


def salida(filas, archivo):
    if archivo:
        with open(archivo, "a", encoding="utf-8") as f:
            for r in filas:
                f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
        print(f"{len(filas)} filas -> {archivo}")
    else:
        for r in filas[:50]:
            print(json.dumps(r, ensure_ascii=False, default=str))
        if len(filas) > 50:
            print(f"... {len(filas)} filas en total (usa --salida para guardarlas)")


def sql_leer(a):
    s = a.sql.strip().rstrip(";")
    if not re.match(r"^(SELECT|WITH)\b", s, re.I) or ";" in s or DDL.search(s) or re.search(r"\bINTO\b", s, re.I) or ESCRIBE.search(s):
        alto("sql-leer solo acepta un SELECT/WITH sin INTO ni escrituras.")
    cn, p = conectar_sql()
    cur = cn.cursor()
    cur.execute(s)
    filas = filas_a_dicts(cur, a.max)
    cn.rollback()
    bitacora(motor="sql", op="leer", host=p["host"], base=p["base"], filas=len(filas), sentencia=s[:300])
    salida(filas, a.salida)


def sql_escribir(a):
    vigente()
    s = a.sql.strip()
    if DDL.search(s):
        alto("sentencia de estructura o administración bloqueada (DROP/ALTER/CREATE/TRUNCATE/permisos/xp_…).")
    for m in re.finditer(r"\b(UPDATE|DELETE)\b", s, re.I):
        resto = s[m.end():]
        sig = re.search(r"\b(UPDATE|DELETE|INSERT|MERGE|EXEC)\b", resto, re.I)
        tramo = resto[: sig.start()] if sig else resto
        if not re.search(r"\bWHERE\b", tramo, re.I):
            alto(f"{m.group(1).upper()} sin WHERE bloqueado.")
    cn, p = conectar_sql()
    cur = cn.cursor()
    try:
        cur.execute(s)
        n = cur.rowcount
        filas = filas_a_dicts(cur, a.max) if cur.description else []
        cn.commit()
    except Exception as e:
        cn.rollback()
        bitacora(motor="sql", op="escribir", host=p["host"], base=p["base"], resultado="error", error=str(e)[:300], sentencia=s[:300])
        alto(f"error SQL (se hizo rollback): {str(e)[:300]}", 1)
    bitacora(motor="sql", op="escribir", host=p["host"], base=p["base"], filas_afectadas=n, sentencia=s[:300])
    print(f"OK: {n} filas afectadas")
    if filas:
        salida(filas, a.salida)


def mongo_cliente():
    uri = cadena("mongo")
    exigir_staging(host_mongo(uri))
    try:
        from pymongo import MongoClient
    except ImportError:
        alto("falta pymongo (pip install pymongo, con OK del responsable).")
    return MongoClient(uri, appname=APP, serverSelectionTimeoutMS=15000), host_mongo(uri)[0]


def mongo_leer(a):
    cli, h = mongo_cliente()
    filtro = json.loads(a.filtro or "{}")
    proy = json.loads(a.proyeccion) if a.proyeccion else None
    docs = list(cli[a.base][a.coleccion].find(filtro, proy).limit(a.max))
    bitacora(motor="mongo", op="leer", host=h, base=a.base, coleccion=a.coleccion, filas=len(docs), filtro=(a.filtro or "{}")[:300])
    salida(docs, a.salida)


def mongo_escribir(a):
    vigente()
    cli, h = mongo_cliente()
    col = cli[a.base][a.coleccion]
    filtro = json.loads(a.filtro or "{}")
    doc = json.loads(a.doc) if a.doc else None
    if a.op in ("update", "delete") and not filtro:
        alto(f"{a.op} con filtro vacío bloqueado.")
    if a.op == "insert":
        if doc is None:
            alto("insert necesita --doc")
        r = col.insert_many(doc) if isinstance(doc, list) else col.insert_one(doc)
        n = len(r.inserted_ids) if hasattr(r, "inserted_ids") else 1
    elif a.op == "update":
        if not doc or not all(k.startswith("$") for k in doc):
            alto("update necesita --doc con operadores ($set, $unset…), no un reemplazo completo.")
        r = (col.update_many if a.muchos else col.update_one)(filtro, doc)
        n = r.modified_count
    elif a.op == "delete":
        r = (col.delete_many if a.muchos else col.delete_one)(filtro)
        n = r.deleted_count
    else:
        alto("op no permitida")
    bitacora(motor="mongo", op=a.op, host=h, base=a.base, coleccion=a.coleccion, filas_afectadas=n, filtro=(a.filtro or "{}")[:300])
    print(f"OK: {n} documentos")


def verificar(_):
    hs = hosts_staging()
    print(f"Hosts de staging declarados: {len(hs)}")
    for motor in ("sql", "mongo"):
        try:
            c = cadena(motor)
        except SystemExit:
            print(f"{motor}: sin credenciales")
            continue
        hosts = [partes_ado(c)["host"]] if motor == "sql" else host_mongo(c)
        ok = all(h.lower() in hs for h in hosts)
        print(f"{motor}: host {'en la lista de staging' if ok else 'FUERA de la lista (no se conectará)'} (huella {hashlib.sha256(','.join(hosts).encode()).hexdigest()[:8]})")
    if VENCE is None:
        print("Ventana de escritura: no hay (solo lectura).")
    else:
        print(f"Excepción de escritura vigente hasta {VENCE:%d/%m/%Y %H:%M}: {'sí' if datetime.datetime.now() <= VENCE else 'NO, vencida'}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("verificar")
    for n in ("sql-leer", "sql-escribir"):
        p = sub.add_parser(n); p.add_argument("--sql", required=True); p.add_argument("--max", type=int, default=500); p.add_argument("--salida")
    p = sub.add_parser("mongo-leer")
    for k in ("--base", "--coleccion"): p.add_argument(k, required=True)
    p.add_argument("--filtro"); p.add_argument("--proyeccion"); p.add_argument("--max", type=int, default=500); p.add_argument("--salida")
    p = sub.add_parser("mongo-escribir")
    for k in ("--base", "--coleccion"): p.add_argument(k, required=True)
    p.add_argument("--op", required=True, choices=["insert", "update", "delete"]); p.add_argument("--filtro"); p.add_argument("--doc"); p.add_argument("--muchos", action="store_true")
    a = ap.parse_args()
    {"verificar": verificar, "sql-leer": sql_leer, "sql-escribir": sql_escribir, "mongo-leer": mongo_leer, "mongo-escribir": mongo_escribir}[a.cmd](a)


if __name__ == "__main__":
    main()
