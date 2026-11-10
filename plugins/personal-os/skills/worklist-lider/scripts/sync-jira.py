"""Sincroniza con Jira (solo lectura) el estado de las issues de cada expediente y arma la cola de revisión del líder.

No consulta Jira: recibe uno o varios JSON tal como los devuelve `searchJiraIssuesUsingJql` del conector
Atlassian (cloudId de fuentes.yaml → jira.cloud_id) y, en cada <stateDir>/requerimientos/<slug>/expediente.json,
reemplaza solo estos campos derivados:

  jira_estado   {clave: {titulo, tipo, estado, categoria, responsable, vence, estimacion_h, actualizado, padre, padre_titulo}}
                para las claves del expediente (jira, historias, subtareas) y sus hijas (hasta 2 niveles)
  jira_sync     {fecha, encontradas, faltantes[]}  las claves del expediente que no vinieron en los JSON
  cola_revision {tareas, horas, desde, claves[]}   lo que está en un estado de revisión (la cola del líder)
  sin_expediente  (solo en un expediente paraguas, el que tiene `hijos`): issues hijas de su jira que no
                  cubre ningún hijo, es decir, lo que aún no tiene expediente ni plan

Y deja <stateDir>/requerimientos/_cola_revision.json con toda la cola agrupada por requerimiento, que
cargar.py sube a la base como `cola/actual`.

Estados de revisión: fuentes.yaml → status_celula.estados.revision («Nombre*» = prefijo, sin distinguir
mayúsculas). Sin esa lista: «Listo para revisión», «En revisión*», «In Review*», «Code Review*».

Uso:
  python -I sync-jira.py --consultas [--estado <stateDir>] [--fuentes <fuentes.yaml>]
      imprime las JQL que hay que correr (claves de los expedientes y accountId del equipo)
  python -I sync-jira.py [--estado <stateDir>] [--fuentes <fuentes.yaml>] <respuesta.json> [...]
      campos de las consultas: summary,status,assignee,duedate,timeoriginalestimate,parent,updated,issuetype
"""
import argparse
import glob
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun  # noqa: E402

CAMPOS = "summary,status,assignee,duedate,timeoriginalestimate,parent,updated,issuetype"


def nodos(ruta):
    d = comun.leer_json(ruta)
    n = d.get("issues", d) if isinstance(d, dict) else d
    n = n.get("nodes", n) if isinstance(n, dict) else n
    return n if isinstance(n, list) else []


def plano(i):
    f = i.get("fields") or {}
    p = f.get("parent") or {}
    est = f.get("timeoriginalestimate")
    return {
        "titulo": f.get("summary", ""),
        "tipo": (f.get("issuetype") or {}).get("name", ""),
        "estado": (f.get("status") or {}).get("name", ""),
        "categoria": ((f.get("status") or {}).get("statusCategory") or {}).get("key", ""),
        "responsable": (f.get("assignee") or {}).get("displayName", ""),
        "vence": f.get("duedate"),
        "estimacion_h": round(est / 3600, 2) if isinstance(est, (int, float)) else None,
        "actualizado": (f.get("updated") or "")[:10] or None,
        "padre": p.get("key"),
        "padre_titulo": (p.get("fields") or {}).get("summary", ""),
    }


def claves_propias(E):
    ks = set(E.get("jira") or [])
    ks |= {h.get("clave") or h.get("key") for h in E.get("historias") or []}
    ks |= {s.get("clave") for s in E.get("subtareas") or []}
    return {k for k in ks if k}


def con_hijas(ks, I, niveles=2, excluir=()):
    total = set(ks)
    for _ in range(niveles):
        nuevas = {k for k, v in I.items() if v["padre"] in total and k not in total and v["padre"] not in excluir}
        if not nuevas:
            break
        total |= nuevas
    return total


def cola(ks, I, rev):
    c = sorted(k for k in ks if k in I and comun.es_revision(I[k]["estado"], rev))
    fechas = [I[k]["actualizado"] for k in c if I[k]["actualizado"]]
    return {"tareas": len(c), "horas": round(sum(I[k]["estimacion_h"] or 0 for k in c), 2),
            "desde": min(fechas) if fechas else None, "claves": c}


def crit(E):
    vals = [v for v in ((E.get("impacto") or {}).get("criticidad_modulo") or {}).values() if isinstance(v, int) and v]
    return max(vals) if vals else None


def expedientes(req):
    exps = {}
    for p in sorted(glob.glob(os.path.join(str(req), "*", "expediente.json"))):
        exps[os.path.basename(os.path.dirname(p))] = (p, comun.leer_json(p))
    return exps


def consultas(exps, fu, rev):
    ks = sorted({k for _, E in exps.values() for k in claves_propias(E)})
    ids = [m.get("account_id") for m in (fu.get("equipo") or []) if not comun.es_placeholder(m.get("account_id"))]
    print(f"Campos: {CAMPOS} · cloudId: fuentes.yaml → jira.cloud_id · solo lectura")
    if not ks:
        print("Ningún expediente tiene claves de Jira.")
    for i in range(0, len(ks), 100):
        lote = ", ".join(ks[i:i + 100])
        print(f"\nkey in ({lote})")
        print(f"\nparent in ({lote})   # paginar con nextPageToken")
    exactos = [e for e in rev if not e.endswith("*")]
    filtro = (f"status in ({', '.join(json.dumps(e, ensure_ascii=False) for e in exactos)})"
              if exactos and len(exactos) == len(rev) else "statusCategory != Done")
    quien = f" AND assignee in ({', '.join(ids)})" if ids else ""
    print(f"\n{filtro}{quien}   # la cola; sync-jira.py filtra localmente por {rev}")
    if not ids:
        print("(equipo[] de fuentes.yaml no tiene account_id: la consulta de la cola no se limita a la célula)")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Deriva el estado de Jira de cada expediente y la cola de revisión.")
    ap.add_argument("respuestas", nargs="*", help="JSON de searchJiraIssuesUsingJql (admite comodines)")
    ap.add_argument("--estado", help="carpeta de estado (por defecto stateDir de config.json)")
    ap.add_argument("--fuentes", help="fuentes.yaml (por defecto <stateDir>/config/fuentes.yaml)")
    ap.add_argument("--consultas", action="store_true", help="imprime las JQL a correr y sale")
    ap.add_argument("--hoy", help="fecha de la sincronización (AAAA-MM-DD); por defecto hoy")
    a = ap.parse_args(argv)
    estado = comun.state_dir(a.estado)
    fu = comun.fuentes(estado, a.fuentes)
    rev = comun.estados_revision(fu)
    req = estado / "requerimientos"
    exps = expedientes(req)
    if a.consultas:
        consultas(exps, fu, rev)
        return 0
    rutas = [r for x in a.respuestas for r in (glob.glob(x) or [x])]
    if not rutas:
        ap.error("faltan las respuestas de Jira (o usa --consultas)")
    I = {}
    for r in rutas:
        for i in nodos(r):
            k = i.get("key")
            if not k:
                continue
            v = plano(i)
            if k not in I or (v["actualizado"] or "") >= (I[k]["actualizado"] or ""):
                I[k] = v
    hoy = a.hoy or date.today().isoformat()
    paraguas = {s for s, (_, E) in exps.items() if E.get("hijos")}
    # Las hijas directas de un paraguas son historias de otros expedientes: no se expanden desde los hijos.
    raices = set()
    for s in paraguas:
        raices |= set(exps[s][1].get("jira") or [])
    cubiertas = {}
    for slug, (p, E) in exps.items():
        if slug not in paraguas:
            cubiertas[slug] = con_hijas(claves_propias(E) - raices, I) | (claves_propias(E) & raices)
    for slug in paraguas:
        p, E = exps[slug]
        ks = set()
        for h in E["hijos"]:
            ks |= cubiertas.get(h, set())
        directas = {k for k, v in I.items() if v["padre"] in (E.get("jira") or [])}
        sin = sorted(k for k in con_hijas(directas, I) if k not in ks)
        E["sin_expediente"] = [{"clave": k, **{c: I[k][c] for c in ("titulo", "tipo", "estado", "responsable", "estimacion_h", "padre")}}
                               for k in sin if I[k]["padre"] in (E.get("jira") or [])]
        cubiertas[slug] = ks | set(E.get("jira") or []) | set(sin)
    for slug, ks in cubiertas.items():
        p, E = exps[slug]
        propias = claves_propias(E)
        E["jira_estado"] = {k: I[k] for k in sorted(ks) if k in I}
        E["jira_sync"] = {"fecha": hoy, "encontradas": len(E["jira_estado"]),
                          "faltantes": sorted(k for k in propias if k not in I)}
        E["cola_revision"] = cola(ks, I, rev)
        comun.escribir_json(p, E, indent=1)
        print(f"  {slug}: {len(E['jira_estado'])} issues · cola {E['cola_revision']['tareas']} ({E['cola_revision']['horas']} h)"
              + (f" · faltan {len(E['jira_sync']['faltantes'])}" if E["jira_sync"]["faltantes"] else ""))
    # Cola global: cada issue en revisión va al expediente más específico que la contenga (no al paraguas).
    asignada = {}
    for slug, ks in cubiertas.items():
        if slug not in paraguas:
            for k in ks:
                asignada.setdefault(k, slug)
    for slug in paraguas:
        for k in cubiertas[slug]:
            asignada.setdefault(k, slug)
    grupos = {}
    for k, v in I.items():
        if not comun.es_revision(v["estado"], rev):
            continue
        slug = asignada.get(k)
        if slug:
            E = exps[slug][1]
            g = grupos.setdefault(slug, {"slug": slug, "titulo": E.get("titulo") or slug, "nivel": E.get("nivel"),
                                         "criticidad": crit(E), "items": []})
        else:
            pk = v["padre"] or k
            g = grupos.setdefault("sin:" + pk, {"slug": None, "titulo": (v["padre_titulo"] or v["titulo"]) + " · sin expediente",
                                                "padre": pk, "nivel": None, "criticidad": None, "items": []})
        g["items"].append({"clave": k, **v})
    lista = []
    for g in grupos.values():
        g["items"].sort(key=lambda x: (x["padre"] or "", x["clave"]))
        g["tareas"] = len(g["items"])
        g["horas"] = round(sum(x["estimacion_h"] or 0 for x in g["items"]), 2)
        fechas = [x["actualizado"] for x in g["items"] if x["actualizado"]]
        g["desde"] = min(fechas) if fechas else None
        lista.append(g)
    lista.sort(key=lambda g: (g["slug"] is None, -(g["criticidad"] or 0), -g["tareas"]))
    out = {"fecha": hoy, "tareas": sum(g["tareas"] for g in lista), "horas": round(sum(g["horas"] for g in lista), 2),
           "estados_revision": rev, "grupos": lista, "fuentes": [os.path.basename(r) for r in rutas]}
    comun.escribir_json(str(req / "_cola_revision.json"), out, indent=1)
    print(f"Cola de revisión: {out['tareas']} tareas · {out['horas']} h en {len(lista)} grupos "
          f"({sum(1 for g in lista if g['slug'] is None)} sin expediente)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
