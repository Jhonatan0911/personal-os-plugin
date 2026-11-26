#!/usr/bin/env python3
"""
bd-ejecutar.py — el único camino para que Claude corra SQL en una base registrada (D-073, 26/11/2026).

Claude no conecta a la base: deja un plan y este script lo corre.

  <OS_HOME>/bd-planes/<id>/plan.json      {"conexion": "<id de ⚙ Config · Bases de datos>", "base": "<catálogo>",
                                            "explicacion": "qué hace, en una frase", "limite": 200}
  <OS_HOME>/bd-planes/<id>/consulta.sql   el SQL (lotes separados por GO)
  <OS_HOME>/bd-planes/<id>/rollback.sql   obligatorio si el SQL escribe

  python bd-ejecutar.py <id> [--rollback] [--simular]

El permiso lo decide el guardia de Claude Code (guardia-empresa.js) con la tabla de la consola: bloqueado, me
pregunta (diálogo con destino, servidor, IP, usuario, qué hace y el SQL) o automático. El guardia deja un pase de un
solo uso atado a la huella del plan; sin pase vigente y con la misma huella, este script no corre.
Escrituras: en una transacción; si un lote falla, se deshace todo. Lecturas: READ UNCOMMITTED y límite de filas.
Nunca imprime la contraseña ni la cadena de conexión. Deja resultado.json en el plan y una línea en bd-ejecutor.log.
--simular valida todo (plan, permiso, pase) y dice qué correría, sin conectar.
"""
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

OS_HOME = os.path.abspath(os.environ.get("PERSONAL_OS_HOME") or os.path.join(os.path.expanduser("~"), ".claude", "personal-os"))
MODOS = ("bloqueado", "preguntar", "automatico")
ESCRITURA = ("crear", "actualizar", "borrar", "estructura", "ejecutar")
NOMBRE = {"leer": "Leer", "crear": "Crear", "actualizar": "Actualizar", "borrar": "Borrar", "estructura": "Estructura", "ejecutar": "Ejecutar"}
# Misma clasificación que lib/bd-permisos.js (de la acción más fuerte a la más débil).
SQL = [
    ("estructura", re.compile(r"\b(CREATE|ALTER|DROP|GRANT|REVOKE|DENY|sp_rename)\b", re.I)),
    ("borrar", re.compile(r"\b(DELETE|TRUNCATE)\b", re.I)),
    ("actualizar", re.compile(r"\b(UPDATE|MERGE)\b", re.I)),
    ("crear", re.compile(r"\b(INSERT|BULK\s+INSERT)\b|\bSELECT\b[^;]*?\bINTO\s+[#@\w\[]", re.I)),
    ("ejecutar", re.compile(r"\b(EXEC(UTE)?|xp_cmdshell|sp_executesql)\b", re.I)),
]


class Alto(Exception):
    """Se detiene sin conectar; el mensaje es para el usuario."""


def leer_json(ruta):
    with open(ruta, encoding="utf-8-sig") as f:
        return json.load(f)


def bytes_de(ruta):
    try:
        with open(ruta, "rb") as f:
            return f.read()
    except OSError:
        return None


def limpiar_sql(sql):
    sql = re.sub(r"/\*[\s\S]*?\*/", " ", sql)
    sql = re.sub(r"--[^\r\n]*", " ", sql)
    return re.sub(r"N?'(?:[^']|'')*'", "''", sql)


def tiene_sql(txt):
    return bool(re.sub(r"\bGO\b", "", limpiar_sql(txt), flags=re.I).strip())


def acciones(sql):
    s = limpiar_sql(sql)
    out = [a for a, rx in SQL if rx.search(s)]
    return out or ["leer"]


def huella(*partes):
    h = hashlib.sha256()
    for b in partes:
        h.update(b or b"")
        h.update(b"\n--\n")
    return h.hexdigest()


def permisos(d):
    p = (d or {}).get("permisos") or {}
    leer = p.get("leer") if p.get("leer") in MODOS else ("automatico" if (d or {}).get("modo_lectura") == "automatico" else "preguntar")
    out = {"leer": leer}
    for a in ESCRITURA:
        out[a] = p.get(a) if p.get(a) in MODOS else "bloqueado"
    return out


def modo_para(perm, accs):
    ms = [perm.get(a, "bloqueado") for a in accs]
    return "bloqueado" if "bloqueado" in ms else "preguntar" if "preguntar" in ms else "automatico"


def resolver_plan(ref):
    ref = ref.strip("\"'")
    if re.fullmatch(r"[A-Za-z0-9][\w.-]{0,80}", ref):
        return os.path.join(OS_HOME, "bd-planes", ref)
    return os.path.abspath(ref)


def cargar(ref, objetivo):
    d = resolver_plan(ref)
    b_plan = bytes_de(os.path.join(d, "plan.json"))
    b_sql = bytes_de(os.path.join(d, "consulta.sql"))
    b_rb = bytes_de(os.path.join(d, "rollback.sql"))
    if b_plan is None:
        raise Alto(f"no existe {os.path.join(d, 'plan.json')}")
    try:
        plan = json.loads(b_plan.decode("utf-8-sig"))
    except ValueError:
        raise Alto("plan.json no es JSON válido")
    crudo = b_rb if objetivo == "rollback" else b_sql
    if not crudo or not tiene_sql(crudo.decode("utf-8-sig")):
        raise Alto("el plan no tiene rollback.sql" if objetivo == "rollback" else "consulta.sql no existe o está vacío")
    sql = crudo.decode("utf-8-sig")
    try:
        reg = leer_json(os.path.join(OS_HOME, "conexiones-bd.json"))
    except (OSError, ValueError):
        raise Alto("no hay registro de conexiones (⚙ Config · Bases de datos)")
    ent = next((c for c in reg.get("conexiones", []) if c.get("id") == plan.get("conexion")), None) \
        or next((c for c in reg.get("conexiones", []) if c.get("nombre") == plan.get("conexion")), None)
    if not ent:
        raise Alto(f"la conexión «{plan.get('conexion')}» no está registrada en ⚙ Config · Bases de datos")
    try:
        con = leer_json(ent["archivo"])
    except (OSError, ValueError, KeyError):
        raise Alto(f"no se puede leer el archivo de la conexión «{ent.get('nombre') or ent.get('id')}»")
    if (ent.get("motor") or "sqlserver") != "sqlserver":
        raise Alto(f"el ejecutor todavía no corre {ent.get('motor')}: solo SQL Server")
    catalogos = [str(x) for x in con.get("catalogos") or []]
    base = plan.get("base") or (catalogos[0] if catalogos else None)
    if not base or (catalogos and base not in catalogos):
        raise Alto(f"la base «{plan.get('base')}» no está entre las de «{ent.get('nombre')}»")
    if not str(plan.get("explicacion") or "").strip():
        raise Alto("plan.json no dice qué hace la consulta («explicacion»)")
    accs = acciones(sql)
    escribe = any(a != "leer" for a in accs)
    if escribe and objetivo == "consulta" and not (b_rb and tiene_sql(b_rb.decode("utf-8-sig"))):
        raise Alto("una escritura necesita su rollback.sql antes de correr")
    perm = permisos(con)
    modo = modo_para(perm, accs)
    if modo == "bloqueado":
        raise Alto(f"{', '.join(NOMBRE[a] for a in accs if perm.get(a) == 'bloqueado')} en «{ent.get('nombre')}» está bloqueado en ⚙ Config · Bases de datos")
    try:
        lim = int(plan.get("limite") or 200)
    except (TypeError, ValueError):
        lim = 200
    return {"dir": d, "plan": plan, "ent": ent, "con": con, "base": base, "sql": sql, "acciones": accs, "escribe": escribe,
            "modo": modo, "huella": huella(b_plan, b_sql, b_rb), "objetivo": objetivo, "limite": max(1, min(lim, 5000))}


def usar_pase(p):
    ruta = os.path.join(p["dir"], ".pase.json")
    try:
        pase = leer_json(ruta)
    except (OSError, ValueError):
        raise Alto("sin pase del guardia: este plan no pasó por el permiso de ⚙ Config (córrelo desde Claude Code)")
    try:
        os.remove(ruta)   # un solo uso
    except OSError:
        pass
    if pase.get("huella") != p["huella"]:
        raise Alto("el plan cambió después del permiso (huella distinta): vuelve a correrlo para que se revise de nuevo")
    if pase.get("objetivo") != p["objetivo"]:
        raise Alto("el pase era para otra cosa (consulta / rollback)")
    if (pase.get("expira") or 0) < time.time() * 1000:
        raise Alto("el pase venció: vuelve a correr el plan")


def lotes(sql):
    partes, actual = [], []
    for linea in sql.replace("\r\n", "\n").split("\n"):
        if re.fullmatch(r"\s*GO\s*(--.*)?", linea, re.I):
            partes.append("\n".join(actual))
            actual = []
        else:
            actual.append(linea)
    partes.append("\n".join(actual))
    return [x for x in partes if tiene_sql(x)]


def _datetimeoffset(valor):
    """SQL Server datetimeoffset (tipo ODBC -155) → texto ISO 8601 con su desfase."""
    if valor is None:
        return None
    import struct
    a, mes, d, h, mi, s, ns, oh, om = struct.unpack("<6hI2h", valor)
    signo = "-" if oh < 0 or om < 0 else "+"
    return f"{a:04d}-{mes:02d}-{d:02d}T{h:02d}:{mi:02d}:{s:02d}.{ns // 1000:06d}{signo}{abs(oh):02d}:{abs(om):02d}"


def conectar(p):
    import pyodbc  # solo al correr de verdad
    disponibles = pyodbc.drivers()
    driver = next((x for x in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server") if x in disponibles), None)
    if not driver:
        raise Alto("no hay driver ODBC de SQL Server instalado")
    partes = [f"DRIVER={{{driver}}}", f"SERVER={p['con'].get('servidor')}", f"DATABASE={p['base']}",
              f"UID={p['con'].get('usuario') or ''}", f"PWD={{{(p['con'].get('password') or '').replace('}', '}}')}}}",
              "APP=Personal OS bd-ejecutar"]
    if driver != "SQL Server":
        partes += ["Encrypt=yes", "TrustServerCertificate=yes"]
    try:
        cn = pyodbc.connect(";".join(partes), autocommit=False, timeout=8)
        cn.add_output_converter(-155, _datetimeoffset)   # pyodbc no trae convertidor para datetimeoffset
        return cn
    except pyodbc.Error as e:
        # el mensaje del driver no trae la contraseña; igual se recorta por si acaso
        raise Alto("no se pudo conectar: " + re.sub(r"PWD=\{[^}]*\}", "PWD=***", str(e))[:300])


def celda(v):
    s = "NULL" if v is None else str(v)
    return s if len(s) <= 120 else s[:119] + "…"


def imprimir_resultados(cur, limite, salida):
    while True:
        if cur.description:
            cols = [c[0] for c in cur.description]
            filas = cur.fetchmany(limite + 1)
            corto = len(filas) > limite
            filas = filas[:limite]
            print(" | ".join(cols))
            for f in filas:
                print(" | ".join(celda(v) for v in f))
            print(f"({len(filas)} filas{', hay más: sube «limite» en plan.json si hace falta' if corto else ''})")
            salida["filas_leidas"] += len(filas)
        elif cur.rowcount is not None and cur.rowcount >= 0:
            salida["filas_afectadas"] += cur.rowcount
        if not cur.nextset():
            break


def correr(p):
    salida = {"filas_leidas": 0, "filas_afectadas": 0, "lotes": 0}
    cn = conectar(p)
    cur = cn.cursor()
    try:
        if not p["escribe"]:
            cur.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
        for lote in lotes(p["sql"]):
            cur.execute(lote)
            imprimir_resultados(cur, p["limite"], salida)
            salida["lotes"] += 1
        if p["escribe"]:
            cn.commit()
        else:
            cn.rollback()
        return salida
    except Exception:
        try:
            cn.rollback()
        except Exception:
            pass
        raise
    finally:
        cn.close()


def anotar(p, estado, detalle):
    linea = {"fecha": datetime.now().astimezone().isoformat(timespec="seconds"), "plan": os.path.basename(p["dir"]) if p else None,
             "conexion": p["ent"].get("nombre") if p else None, "base": p["base"] if p else None,
             "acciones": p["acciones"] if p else None, "objetivo": p["objetivo"] if p else None,
             "huella": p["huella"][:16] if p else None, "estado": estado, **(detalle or {})}
    try:
        with open(os.path.join(OS_HOME, "bd-ejecutor.log"), "a", encoding="utf-8") as f:
            f.write(json.dumps(linea, ensure_ascii=False) + "\n")
        if p:
            nombre = "resultado-rollback.json" if p["objetivo"] == "rollback" else "resultado.json"
            with open(os.path.join(p["dir"], nombre), "w", encoding="utf-8") as f:
                json.dump(linea, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    banderas = {a for a in argv if a.startswith("--")}
    if len(args) != 1 or banderas - {"--rollback", "--simular"}:
        print("Uso: bd-ejecutar.py <id-del-plan> [--rollback] [--simular]", file=sys.stderr)
        return 2
    objetivo = "rollback" if "--rollback" in banderas else "consulta"
    p = None
    try:
        p = cargar(args[0], objetivo)
        usar_pase(p)
        cab = f"{'ROLLBACK · ' if objetivo == 'rollback' else ''}{' + '.join(NOMBRE[a] for a in p['acciones'])} en «{p['ent'].get('nombre')}» · base {p['base']}"
        if "--simular" in banderas:
            extra = " · en transacción" if p["escribe"] else f" · máx. {p['limite']} filas"
            print(f"SIMULACIÓN (no conecta): {cab} · {len(lotes(p['sql']))} lote(s) · modo {p['modo']}{extra}")
            anotar(p, "simulado", {})
            return 0
        print(cab)
        r = correr(p)
        if p["escribe"]:
            print(f"OK · confirmado (commit) · {r['lotes']} lote(s) · {r['filas_afectadas']} fila(s) afectadas")
        anotar(p, "ok", r)
        return 0
    except Alto as e:
        print(f"NO SE EJECUTÓ: {e}", file=sys.stderr)
        anotar(p, "detenido", {"motivo": str(e)})
        return 3
    except Exception as e:  # error de la base: ya se hizo rollback
        msg = re.sub(r"PWD=\{[^}]*\}", "PWD=***", str(e))[:500]
        print(f"FALLÓ y se deshizo (rollback): {msg}", file=sys.stderr)
        anotar(p, "fallo", {"error": msg})
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
