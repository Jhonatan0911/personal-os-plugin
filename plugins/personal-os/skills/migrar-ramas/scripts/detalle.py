"""Paso 3. Detalle de todas las ramas de los repos pendientes (solo lectura) y reparto en lotes para los agentes.
Por rama: adelante/atrás de la base, último autor y fecha, 15 últimos commits y los archivos que tocaron sus commits propios.
Uso: python detalle.py <carpeta_trabajo> [--org <organizacion>] [--lotes N]
Lee pendientes.json y escribe ramas_detalle.json y lotes/loteN.json."""
import os, sys, json, argparse
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

ap = argparse.ArgumentParser()
ap.add_argument("trabajo")
ap.add_argument("--lotes", type=int, default=0, help="0 = uno por cada ~30 repos, máximo 8")
a = ap.parse_args()
P = json.load(open(os.path.join(a.trabajo, "pendientes.json"), encoding="utf-8"))
azdo.exigir_org(P.get("org"))
pend = P["repos"]


def api(origen, repo):
    return f"{azdo.BASE}/{azdo.q(origen)}/_apis/git/repositories/{azdo.q(repo)}"


def archivos(base, rama, adelante):
    top = max(3, min(adelante or 0, 6))
    lst = azdo.get(f"{base}/commits?searchCriteria.itemVersion.version={azdo.q(rama)}&searchCriteria.$top={top}&api-version=7.0")
    rutas = []
    for it in lst.get("value", []):
        ch = azdo.get(f"{base}/commits/{it['commitId']}/changes?top=60&api-version=7.0")
        for x in ch.get("changes", []):
            i = x.get("item", {})
            if not i.get("isFolder") and i.get("path") not in rutas:
                rutas.append(i.get("path"))
    return rutas[:50]


def repo(nombre):
    v = pend[nombre]
    base = api(v["origen"], nombre)
    stats = azdo.get(f"{base}/stats/branches?api-version=7.0")
    ramas = []
    for b in stats.get("value", []):
        c = b.get("commit", {})
        hist = azdo.get(f"{base}/commits?searchCriteria.itemVersion.version={azdo.q(b['name'])}&searchCriteria.$top=15&api-version=7.0")
        ramas.append({
            "rama": b["name"], "esBase": b.get("isBaseVersion", False),
            "adelante": b.get("aheadCount"), "atras": b.get("behindCount"),
            "autor": (c.get("author") or {}).get("name"),
            "fecha": (c.get("author") or {}).get("date") or (c.get("committer") or {}).get("date"),
            "mensaje": (c.get("comment") or "")[:300],
            "historial": [{"fecha": (h.get("author") or {}).get("date", "")[:10], "autor": (h.get("author") or {}).get("name"),
                           "mensaje": (h.get("comment") or "")[:200]} for h in hist.get("value", [])],
            "archivos": archivos(base, b["name"], b.get("aheadCount")),
        })
    ramas.sort(key=lambda x: x["fecha"] or "", reverse=True)
    return nombre, {**v, "ramas": ramas, "error": stats.get("error")}


with ThreadPoolExecutor(12) as ex:
    det = dict(ex.map(repo, sorted(pend, key=str.lower)))
json.dump(det, open(os.path.join(a.trabajo, "ramas_detalle.json"), "w", encoding="utf-8"), ensure_ascii=False)

n = a.lotes or max(1, min(8, round(len(det) / 30) or 1))
lotes, peso = [[] for _ in range(n)], [0] * n
for k, v in sorted(det.items(), key=lambda kv: -len(kv[1]["ramas"])):
    i = peso.index(min(peso)); lotes[i].append(k); peso[i] += len(v["ramas"]) + 1
dl = os.path.join(a.trabajo, "lotes")
os.makedirs(dl, exist_ok=True)
for i, l in enumerate(lotes, 1):
    json.dump({k: det[k] for k in l}, open(os.path.join(dl, f"lote{i}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"lote{i}: {len(l)} repos, {peso[i-1] - len(l)} ramas")
print("repos:", len(det), "| ramas:", sum(len(v["ramas"]) for v in det.values()),
      "| con error:", [k for k, v in det.items() if v["error"]])
