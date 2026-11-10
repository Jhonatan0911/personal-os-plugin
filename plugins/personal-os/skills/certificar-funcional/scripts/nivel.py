"""Qué versión de la revisión funcional (paso p5) le toca a este caso según su nivel.

  python -I nivel.py [--config fuentes.yaml] [--expediente expediente.json] [--variante matriz|evidencia]

Imprime un JSON {niveles_activos, nivel, origen, paso, variante, aplica, forzado, aviso, evidencia_cierre}.
Sin sección `flujo` (o con `niveles_activos: false`) la variante es `matriz`: lo de siempre. Sale con 3 si el
paso p5 no aplica al nivel (y no se forzó una variante).
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import base  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config")
    ap.add_argument("--expediente")
    ap.add_argument("--variante")
    a = ap.parse_args()
    exp = base.leer_json(a.expediente) if a.expediente else None
    r = base.resolver_nivel(a.config or {}, exp, variante=a.variante)
    r["evidencia_cierre"] = ((exp or {}).get("ficha_corta") or {}).get("evidencia_cierre") or None
    print(json.dumps(r, ensure_ascii=False))
    if not r["aplica"]:
        sys.exit(3)


if __name__ == "__main__":
    main()
