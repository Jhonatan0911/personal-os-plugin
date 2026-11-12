"""Paso 1. Lista los proyectos de la organización con su número de repos, para que el líder escoja origen y destinos.
Uso: python proyectos.py <carpeta_trabajo> --org <organizacion>"""
import os, sys, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

azdo.exigir_org()
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
nombres = azdo.proyectos()
with ThreadPoolExecutor(8) as ex:
    res = dict(zip(nombres, ex.map(azdo.repos, nombres)))
json.dump({p: [{"name": r["name"], "defaultBranch": r.get("defaultBranch"), "isDisabled": r.get("isDisabled", False)}
               for r in rs] for p, rs in res.items()},
          open(os.path.join(out, "proyectos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Organización {azdo.ORG}: {len(nombres)} proyectos")
for p in nombres:
    print(f"  {p:40} {len(res[p]):4} repos")
