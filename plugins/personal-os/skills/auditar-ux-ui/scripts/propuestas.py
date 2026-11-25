"""Arma la página de comparación de propuestas de diseño (A/B/C + Actual, con selector de ancho) y la abre.

Uso:
    python propuestas.py --carpeta <proyecto>/.diseno/propuestas/<AAAA-MM-DD>-<vista> [--abrir]

La carpeta lleva:
    propuestas.json      { "titulo", "vista", "fecha", "recomendada": "A",
                           "propuestas": [ { "id": "A", "idea", "gana", "pierde", "nivel", "antipatrones",
                                             "archivo": "propuesta-a.html" }, ... ],          # 2 o 3
                           "actual": [ { "img": "actual-1440.png", "ancho": 1440, "texto": "Skills" }, ... ] }
    propuesta-a.html …   cada propuesta es un HTML autocontenido y responsive (se ve dentro de un marco de
                         1440, 768 o 390 px)
    actual-*.png         capturas de hoy (opcional, pero recomendado)

Escribe <carpeta>/index.html desde ../plantillas/comparador.html. Sale con 1 y dice qué falta si algo no
cuadra: nunca deja una página a medias (nació el 25/11/2026: en otros equipos la skill se quedaba en el
informe escrito porque armar esta página a mano era opcional en la práctica).
"""
import argparse
import json
import sys
import webbrowser
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PLANTILLA = AQUI.parent / "plantillas" / "comparador.html"
CAMPOS = ("id", "idea", "gana", "pierde", "nivel", "archivo")


def validar(carpeta: Path, d: dict) -> list:
    errores = []
    for k in ("titulo", "propuestas"):
        if not d.get(k):
            errores.append(f"propuestas.json: falta «{k}»")
    props = d.get("propuestas") or []
    if not 2 <= len(props) <= 3:
        errores.append(f"van 2 o 3 propuestas, hay {len(props)}")
    ids = [p.get("id") for p in props]
    if len(set(ids)) != len(ids):
        errores.append("hay ids de propuesta repetidos")
    for p in props:
        for k in CAMPOS:
            if not str(p.get(k, "")).strip():
                errores.append(f"propuesta {p.get('id', '?')}: falta «{k}»")
        arch = p.get("archivo")
        if arch:
            f = (carpeta / arch).resolve()
            if f.parent != carpeta.resolve():
                errores.append(f"propuesta {p.get('id')}: «{arch}» debe estar en la misma carpeta")
            elif not f.is_file():
                errores.append(f"propuesta {p.get('id')}: no existe {arch}")
            else:
                t = f.read_text(encoding="utf-8", errors="replace").lower()
                if "<meta name=\"viewport\"" not in t and "<meta name='viewport'" not in t:
                    errores.append(f"propuesta {p.get('id')}: {arch} no tiene <meta name=\"viewport\">; a 390 px se verá como escritorio encogido")
    if d.get("recomendada") and d["recomendada"] not in ids:
        errores.append(f"«recomendada» = {d['recomendada']} no es ninguna propuesta")
    for a in d.get("actual") or []:
        if not (carpeta / str(a.get("img", ""))).is_file():
            errores.append(f"captura actual inexistente: {a.get('img')}")
        if a.get("ancho") and a["ancho"] not in (1440, 768, 390):
            errores.append(f"captura {a.get('img')}: ancho {a['ancho']} no es 1440, 768 ni 390")
    return errores


def main() -> int:
    for flujo in (sys.stdout, sys.stderr):   # consola de Windows en cp1252: sin esto «✓» tumba el script
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--carpeta", required=True)
    ap.add_argument("--abrir", action="store_true", help="abre la página en el navegador por defecto")
    a = ap.parse_args()
    carpeta = Path(a.carpeta).resolve()
    fj = carpeta / "propuestas.json"
    if not fj.is_file():
        print(f"✖ no existe {fj}", file=sys.stderr)
        return 1
    try:
        d = json.loads(fj.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        print(f"✖ propuestas.json no es JSON válido: {e}", file=sys.stderr)
        return 1
    d.setdefault("recomendada", (d.get("propuestas") or [{}])[0].get("id"))
    d.setdefault("actual", [])
    errores = validar(carpeta, d)
    if errores:
        print("✖ La página de propuestas no se generó:", file=sys.stderr)
        for e in errores:
            print(f"  - {e}", file=sys.stderr)
        return 1
    datos = json.dumps(d, ensure_ascii=False).replace("</", "<\\/")
    html = PLANTILLA.read_text(encoding="utf-8").replace("/*__DATOS__*/null", datos, 1)
    salida = carpeta / "index.html"
    salida.write_text(html, encoding="utf-8")
    print(f"✓ {salida} · propuestas {', '.join(p['id'] for p in d['propuestas'])} · recomendada {d['recomendada']}"
          f" · capturas actuales: {len(d['actual'])}")
    if a.abrir:
        webbrowser.open(salida.as_uri())
        print("  abierta en el navegador por defecto")
    return 0


if __name__ == "__main__":
    sys.exit(main())
