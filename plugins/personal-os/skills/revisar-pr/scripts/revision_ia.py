"""Une las respuestas de los revisores por grupo y aplica la refutación de la segunda pasada.

  python -I revision_ia.py unir --salida revision_ia.json --pr 123 --criterios-fuente expediente|jira grupo-a.json grupo-b.json …
  python -I revision_ia.py aplicar --revision revision_ia.json --refutacion refutacion.json

unir: un solo veredicto por CA (gana el más severo: no > parcial > cumple; `no_aplica_a_este_grupo` no cuenta;
las evidencias de los grupos quedan en la nota), hallazgos con id único y `fuera_de_alcance` sin repetir.
Acepta archivos con texto alrededor del JSON (toma el primer objeto JSON completo).
aplicar: copia `verificacion`, `severidad` y `motivo_verificacion` de la refutación por id; lo que la
refutación no menciona queda sin verificar (y guardar_revision.py se niega a seguir).
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun  # noqa: E402

RANGO = {"no": 3, "parcial": 2, "cumple": 1}


def leer_objeto(ruta):
    texto = Path(ruta).read_text(encoding="utf-8")
    dec = json.JSONDecoder()
    for i, c in enumerate(texto):
        if c in "{[":
            try:
                return dec.raw_decode(texto[i:])[0]
            except json.JSONDecodeError:
                continue
    sys.exit(f"{ruta}: no trae un JSON válido.")


def unir(a):
    cas, hallazgos, fuera = {}, [], []
    for ruta in a.grupos:
        g = leer_objeto(ruta)
        nombre = g.get("grupo") or Path(ruta).stem
        for ca, v in (g.get("veredicto_por_ca") or {}).items():
            v = v if isinstance(v, dict) else {"estado": v}
            if v.get("estado") not in RANGO:
                continue
            nota = f"[{nombre}] {v.get('estado')}: {v.get('nota', '')} ({v.get('evidencia', '')})".strip()
            if ca not in cas or RANGO[v["estado"]] > RANGO[cas[ca]["estado"]]:
                previas = cas.get(ca, {}).get("notas", [])
                cas[ca] = {"estado": v["estado"], "evidencia": v.get("evidencia", ""), "notas": previas}
            cas[ca]["notas"].append(nota)
        for h in g.get("hallazgos", []):
            h = dict(h)
            h["id"] = h.get("id") or f"{nombre}-{len(hallazgos) + 1}"
            h["grupo"] = nombre
            hallazgos.append(h)
        fuera += [x for x in g.get("fuera_de_alcance", []) if x not in fuera]
    veredicto = {ca: {"estado": v["estado"], "evidencia": v["evidencia"], "nota": " · ".join(v["notas"])}
                 for ca, v in sorted(cas.items(), key=lambda x: (len(x[0]), x[0]))}
    out = {"pr": a.pr, "criterios_fuente": a.criterios_fuente, "veredicto_por_ca": veredicto,
           "hallazgos": hallazgos, "fuera_de_alcance": fuera}
    comun.escribir_json(a.salida, out)
    print(f"{len(veredicto)} CA · {len(hallazgos)} hallazgos de {len(a.grupos)} grupos → {a.salida}")


def aplicar(a):
    rev = comun.leer_json(a.revision)
    ref = leer_objeto(a.refutacion)
    ref = ref.get("hallazgos", ref) if isinstance(ref, dict) else ref
    por_id = {r["id"]: r for r in ref}
    for h in rev.get("hallazgos", []):
        if h.get("verificacion") == "descartado":  # ya descartado por el ancla
            continue
        r = por_id.get(h["id"])
        if r:
            h["verificacion"] = r.get("verificacion")
            h["motivo_verificacion"] = r.get("motivo_verificacion", "")
            if r.get("severidad"):
                h["severidad_original"], h["severidad"] = h.get("severidad"), r["severidad"]
    comun.escribir_json(a.revision, rev)
    estados = [h.get("verificacion") or "sin_verificar" for h in rev.get("hallazgos", [])]
    print(", ".join(f"{e} {estados.count(e)}" for e in sorted(set(estados))))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("unir")
    u.add_argument("grupos", nargs="+")
    u.add_argument("--salida", required=True)
    u.add_argument("--pr", default="")
    u.add_argument("--criterios-fuente", default=None)
    p = sub.add_parser("aplicar")
    p.add_argument("--revision", required=True)
    p.add_argument("--refutacion", required=True)
    a = ap.parse_args()
    unir(a) if a.cmd == "unir" else aplicar(a)


if __name__ == "__main__":
    main()
