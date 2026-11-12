"""Paso 5. Une el detalle de las ramas con lo que escribieron los agentes (lotes/recN.json) en artefacto/data.json.
Uso: python unir.py <carpeta_trabajo> --lider "<Nombre del líder>" [--clave "<regex>"] [--transversal "<Proyecto>"] [--marca "<texto>"]
--clave: regex de las ramas «del cliente»; alimenta el filtro «Con rama del cliente» de la página.
--transversal: proyecto compartido (activa el filtro «Ya existen en <Proyecto>»).
--marca: texto del encabezado de la página (por defecto «Branching V2»)."""
import os, sys, json, glob, argparse, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

ap = argparse.ArgumentParser()
ap.add_argument("trabajo")
ap.add_argument("--lider", required=True)
ap.add_argument("--clave", default="")
ap.add_argument("--transversal", default="")
ap.add_argument("--marca", default="Branching V2")
a = ap.parse_args()
S = a.trabajo
pend = json.load(open(os.path.join(S, "pendientes.json"), encoding="utf-8"))
azdo.exigir_org(pend.get("org"))
det = json.load(open(os.path.join(S, "ramas_detalle.json"), encoding="utf-8"))
rec = {}
for f in glob.glob(os.path.join(S, "lotes", "rec*.json")):
    rec.update(json.load(open(f, encoding="utf-8")))

repos, faltan = [], []
for n, v in sorted(det.items(), key=lambda kv: kv[0].lower()):
    r = rec.get(n) or {}
    if not r:
        faltan.append(n)
    res, fn = r.get("ramas") or {}, r.get("fn") or {}
    repos.append({
        "n": n, "o": v["origen"], "base": v["base"], "dest": v["destinos"], "otros": v.get("otros", []),
        "ya": v.get("yaEnDestino", []),
        "rec": {k: r.get(k, "") for k in ("recomendada", "confianza", "porque", "riesgo", "nota")},
        "ramas": [{
            "r": b["rama"], "b": b["esBase"], "f": b["fecha"], "a": b["autor"], "ad": b["adelante"], "at": b["atras"],
            "m": b["mensaje"][:160], "s": res.get(b["rama"], ""), "fn": fn.get(b["rama"], ""),
            "h": [[h["fecha"], h["autor"], h["mensaje"][:140]] for h in b["historial"][:12]],
        } for b in v["ramas"]],
    })

os.makedirs(os.path.join(S, "artefacto"), exist_ok=True)
dest = os.path.join(S, "artefacto", "data.json")
json.dump({"generado": datetime.date.today().strftime("%d/%m/%Y"), "org": azdo.ORG, "lider": a.lider, "transversal": a.transversal, "marca": a.marca,
           "origen": pend["origen"], "destinos": pend["destinos"], "clave": a.clave,
           "proyectos": sorted(json.load(open(os.path.join(S, "proyectos.json"), encoding="utf-8")), key=str.lower),
           "repos": repos},
          open(dest, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("repos:", len(repos), "| sin recomendación:", faltan, "| KB:", os.path.getsize(dest) // 1024)
