"""Refresco de ramas pedido desde la página (botón «Refrescar ramas»). Solo lectura en Azure DevOps.
Vuelve a leer las ramas de los repos pedidos y deja un JSON por repo, listo para escribirlo con
ArtifactData en la colección `ramas` (doc_id = nombre del repo con los caracteres no válidos cambiados por _).

Uso: python refrescar.py <data.json> <carpeta_salida> repo1 [repo2 ...]   (la organización sale de data.json o de --org)"""
import os, re, sys, json, datetime
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

DATA, OUT, pedidos = sys.argv[1], sys.argv[2], sys.argv[3:]
meta = json.load(open(DATA, encoding="utf-8"))
azdo.exigir_org(meta.get("org"))
by = {r["n"]: r for r in meta["repos"]}
os.makedirs(OUT, exist_ok=True)


def doc_id(n):
    return re.sub(r"[^A-Za-z0-9_\-.~:@+]", "_", n)


def repo(n):
    x = by.get(n)
    if not x:
        return n, {"error": "no está en data.json"}
    origen = x.get("o") or meta["origen"][0]
    base = f"{azdo.BASE}/{azdo.q(origen)}/_apis/git/repositories/{azdo.q(n)}"
    stats = azdo.get(f"{base}/stats/branches?api-version=7.0")
    if "error" in stats:
        return n, {"error": stats["error"][:200]}
    ramas = []
    for b in stats.get("value", []):
        c = b.get("commit", {})
        hist = azdo.get(f"{base}/commits?searchCriteria.itemVersion.version={azdo.q(b['name'])}&searchCriteria.$top=12&api-version=7.0")
        ramas.append({
            "r": b["name"], "b": b.get("isBaseVersion", False),
            "f": (c.get("author") or {}).get("date") or (c.get("committer") or {}).get("date"),
            "a": (c.get("author") or {}).get("name"), "ad": b.get("aheadCount"), "at": b.get("behindCount"),
            "m": (c.get("comment") or "")[:160],
            "h": [[(h.get("author") or {}).get("date", "")[:10], (h.get("author") or {}).get("name"), (h.get("comment") or "")[:140]]
                  for h in hist.get("value", [])],
        })
    ramas.sort(key=lambda r: r["f"] or "", reverse=True)
    antes = {r["r"] for r in x["ramas"]}
    return n, {"repo": n, "origen": origen, "fecha": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
               "ramas": ramas, "nuevas": [r["r"] for r in ramas if r["r"] not in antes],
               "borradas": sorted(antes - {r["r"] for r in ramas})}


with ThreadPoolExecutor(6) as ex:
    for n, d in ex.map(repo, pedidos):
        p = os.path.join(OUT, doc_id(n) + ".json")
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
        if "error" in d:
            print(f"{n}: ERROR {d['error']}")
        else:
            print(f"{n}: {len(d['ramas'])} ramas · nuevas: {', '.join(d['nuevas']) or '—'} · ya no están: {', '.join(d['borradas']) or '—'} → {p}")
