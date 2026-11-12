"""Paso 2. Cruza los repos del proyecto de origen contra los destinos y deja los pendientes de migrar.

Uso:
  python inventario.py <carpeta_trabajo> --org <organizacion> --origen <Proyecto origen> --destinos <Destino1>,<Destino2>
         [--incluir "<cliente>|<prefijo>"] [--excluir "test|poc"] [--repos lista.txt]
         [--destino-regex "<Destino2>=<regex>"] [--incluir-existentes]

- El cruce es por nombre (sin mayúsculas). Un repo renombrado en el destino sale como pendiente: el líder lo marca.
- --incluir / --excluir se prueban contra el nombre del repo Y contra los nombres de sus ramas
  (así se encuentran los repos de un cliente en un proyecto compartido: ramas <cliente>/*, <prefijo>-*...).
- --repos: archivo con un nombre de repo por línea; si se da, manda sobre los filtros.
- --destino-regex: a qué destino va cada repo según sus ramas. Sin regla, va al primer destino.
Lee proyectos.json del paso 1 y escribe pendientes.json."""
import os, re, sys, json, argparse, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

ap = argparse.ArgumentParser()
ap.add_argument("trabajo")
ap.add_argument("--origen", required=True)
ap.add_argument("--destinos", required=True)
ap.add_argument("--incluir")
ap.add_argument("--excluir")
ap.add_argument("--repos")
ap.add_argument("--destino-regex", action="append", default=[])
ap.add_argument("--incluir-existentes", action="store_true")
a = ap.parse_args()
azdo.exigir_org()

P = json.load(open(os.path.join(a.trabajo, "proyectos.json"), encoding="utf-8"))
origenes = [x.strip() for x in a.origen.split(",") if x.strip()]
destinos = [x.strip() for x in a.destinos.split(",") if x.strip()]
for p in origenes + destinos:
    if p not in P:
        sys.exit(f"El proyecto «{p}» no está en la organización. Corre proyectos.py y copia el nombre exacto.")
reglas = []
for r in a.destino_regex:
    d, rx = r.split("=", 1)
    reglas.append((d.strip(), re.compile(rx, re.I)))

en_destino = {d: {x["name"].lower() for x in P[d]} for d in destinos}
otros = {}
for p, rs in P.items():
    if p in origenes or p in destinos:
        continue
    for x in rs:
        otros.setdefault(x["name"].lower(), []).append(p)

candidatos = [(o, x) for o in origenes for x in P[o] if not x["isDisabled"]]


def heads(c):
    o, x = c
    pr = subprocess.run(["git", "ls-remote", "--heads", azdo.git_url(o, x["name"])],
                        capture_output=True, text=True, encoding="utf-8", timeout=120)
    if pr.returncode != 0:
        return c, None
    return c, [l.split("\t")[1].replace("refs/heads/", "") for l in pr.stdout.splitlines() if "\t" in l]


with ThreadPoolExecutor(10) as ex:
    H = list(ex.map(heads, candidatos))

lista = None
if a.repos:
    lista = {l.strip().lower() for l in open(a.repos, encoding="utf-8") if l.strip()}
inc = re.compile(a.incluir, re.I) if a.incluir else None
exc = re.compile(a.excluir, re.I) if a.excluir else None

pend, existentes, vacios, errores, fuera = {}, [], [], [], 0
for (o, x), ramas in H:
    n = x["name"]
    if ramas is None:
        errores.append(n); continue
    if not ramas:
        vacios.append(n); continue
    texto = " ".join([n] + ramas)
    if lista is not None:
        if n.lower() not in lista:
            fuera += 1; continue
    else:
        if inc and not inc.search(texto):
            fuera += 1; continue
        if exc and exc.search(n):
            fuera += 1; continue
    ya = [d for d in destinos if n.lower() in en_destino[d]]
    if ya and not a.incluir_existentes:
        existentes.append((n, ya)); continue
    dest = [d for d, rx in reglas if rx.search(texto)] or [destinos[0]]
    pend[n] = {"origen": o, "destinos": dest, "base": (x.get("defaultBranch") or "").replace("refs/heads/", ""),
               "yaEnDestino": ya, "otros": otros.get(n.lower(), [])}

json.dump({"org": azdo.ORG, "origen": origenes, "destinos": destinos, "filtro": a.incluir or "", "repos": pend},
          open(os.path.join(a.trabajo, "pendientes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Origen {', '.join(origenes)}: {len(candidatos)} repos habilitados")
print(f"  pendientes de migrar: {len(pend)}")
print(f"  ya existen en el destino (mismo nombre): {len(existentes)}")
print(f"  fuera del filtro: {fuera} | vacíos: {len(vacios)} | sin acceso: {len(errores)}")
print(f"  pendientes que ya existen en OTRO proyecto: {sum(1 for v in pend.values() if v['otros'])}")
for d in destinos:
    print(f"  → {d}: {sum(1 for v in pend.values() if d in v['destinos'])}")
if errores:
    print("  sin acceso:", ", ".join(errores))
