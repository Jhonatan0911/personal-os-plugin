"""Encuentra el expediente de un requerimiento por clave de Jira o por slug.

  python -I buscar_expediente.py <CLAVE-o-slug> --raiz <carpeta de estado>

Busca en <raiz>/requerimientos/*/expediente.json (esquema v2) y, si no hay, en <raiz>/estimaciones/*/expediente.json
(v1). Coincide si la clave está en `jira`, `historias[].clave` / `key` o `subtareas[].clave`, o si el slug es el
nombre de la carpeta o el `id`. Imprime una ruta por línea (la más reciente primero); sale con 1 si no hay ninguna.
"""
import argparse, json, sys
from pathlib import Path


def claves(exp):
    out = set(exp.get("jira") or [])
    out |= {h.get("clave") or h.get("key") for h in exp.get("historias", [])}
    out |= {s.get("clave") for s in exp.get("subtareas", [])}
    return {c.upper() for c in out if c}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("objetivo")
    ap.add_argument("--raiz", required=True)
    a = ap.parse_args()
    raiz, obj = Path(a.raiz), a.objetivo.strip()
    hallados = []
    for patron in ("requerimientos/*/expediente.json", "estimaciones/*/expediente.json"):
        for ruta in raiz.glob(patron):
            try:
                exp = json.loads(ruta.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if obj.upper() in claves(exp) or obj.lower() in (ruta.parent.name.lower(), str(exp.get("id", "")).lower()):
                hallados.append(ruta)
        if hallados:
            break
    if not hallados:
        sys.exit(1)
    for r in sorted(hallados, key=lambda p: p.stat().st_mtime, reverse=True):
        print(r)


if __name__ == "__main__":
    main()
