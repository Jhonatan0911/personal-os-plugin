"""Vista numerada del diff para la revisión IA: cada línea lleva su número en la versión NUEVA del archivo.

  python -I vista.py --diff diff_para_ia.diff --lista                       # archivos con +/- y tipo
  python -I vista.py --diff diff_para_ia.diff --incluir "src/**" --salida grupo-a.txt [--excluir "**/*.spec.ts"]

Formato:  `  123 + texto` (agregada) · `  124   texto` (contexto) · `   -- - texto` (borrada; sin número nuevo,
lleva el de la versión vieja entre corchetes). Con esto el revisor cita `ruta:123` sin contar a mano.
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun, diffutil  # noqa: E402


def render(texto, incluir, excluir):
    out, ruta, activo, vieja, nueva = [], None, False, 0, 0
    for linea in texto.splitlines():
        if linea.startswith("diff --git "):
            ruta = linea.split(" b/", 1)[-1]
            activo = (not incluir or comun.coincide(ruta, incluir)) and not comun.coincide(ruta, excluir)
            if activo:
                out.append(f"\n===== {ruta}")
            continue
        if not activo or linea.startswith(("--- ", "+++ ", "new file", "deleted file", "rename ", "index ")):
            continue
        if linea.startswith("@@"):
            m = diffutil._HUNK.match(linea)
            if m:
                vieja, nueva = int(m.group(1)), int(m.group(3))
            out.append(linea)
        elif linea.startswith("+"):
            out.append(f"{nueva:6d} + {linea[1:]}")
            nueva += 1
        elif linea.startswith("-"):
            out.append(f"  [{vieja}] - {linea[1:]}")
            vieja += 1
        else:
            out.append(f"{nueva:6d}   {linea[1:]}")
            vieja += 1
            nueva += 1
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff", required=True)
    ap.add_argument("--lista", action="store_true")
    ap.add_argument("--incluir", action="append", default=[])
    ap.add_argument("--excluir", action="append", default=[])
    ap.add_argument("--salida")
    a = ap.parse_args()
    texto = Path(a.diff).read_text(encoding="utf-8", errors="replace")
    if a.lista:
        for f in diffutil.parsear(texto):
            print(f"{len(f['agregadas']):6d} + {len(f['borradas']):6d} -  {f['tipo'][:4]}  {f['ruta']}")
        return
    v = render(texto, a.incluir, a.excluir)
    if a.salida:
        Path(a.salida).write_text(v, encoding="utf-8")
        print(f"{a.salida}: {v.count(chr(10))} líneas")
    else:
        print(v)


if __name__ == "__main__":
    main()
