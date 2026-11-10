"""Qué versión de la revisión del PR (paso p4) le toca a este caso según su nivel.

  python -I nivel.py [--config fuentes.yaml] [--expediente expediente.json] [--variante completo|ia_y_humana|regla_minima]

Imprime un JSON {niveles_activos, nivel, origen, paso, variante, aplica, forzado, aviso}. Sin sección `flujo`
(o con `niveles_activos: false`) la variante es `completo`: lo de siempre. Sin expediente, el nivel es
`flujo.nivel_por_defecto`. Sale con 3 si el paso p4 no aplica al nivel (y no se forzó una variante).
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config")
    ap.add_argument("--expediente")
    ap.add_argument("--variante")
    a = ap.parse_args()
    exp = comun.leer_json(a.expediente) if a.expediente else None
    r = comun.resolver_nivel(a.config or {}, exp, variante=a.variante)
    print(json.dumps(r, ensure_ascii=False))
    if not r["aplica"]:
        sys.exit(3)


if __name__ == "__main__":
    main()
