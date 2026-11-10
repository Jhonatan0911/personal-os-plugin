"""Segunda pasada, parte determinista: cada hallazgo de la IA tiene que caer en el diff.

  python -I verificar_hallazgos.py --diff diff_para_ia.diff --revision revision_ia.json

Por hallazgo escribe `ancla`:
  ok                     el archivo está en el diff, la línea cae en un cambio y la cita coincide
  general                el hallazgo no apunta a una línea (p. ej. «falta la prueba del CA-2»)
  archivo_fuera_del_diff el archivo no está en el PR → se descarta
  linea_fuera_del_cambio la línea no está en ningún hunk → se descarta (no se comenta código que el PR no tocó)
  cita_no_coincide       el texto citado no está en esa línea ni cerca → se descarta
Revisa también la evidencia de cada CA marcado «cumple» o «parcial» (formato `ruta:línea`).
El archivo se reescribe en su sitio; imprime el conteo. La refutación de fondo la hace después un subagente.
"""
import argparse, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun, diffutil  # noqa: E402

MALAS = {"archivo_fuera_del_diff", "linea_fuera_del_cambio", "cita_no_coincide"}


def _norm(t):
    return re.sub(r"\s+", " ", (t or "")).strip().lower()


def anclar(h, archivos):
    ruta = (h.get("archivo") or "").replace("\\", "/").lstrip("/")
    if not ruta:
        return "general"
    a = archivos.get(ruta)
    if not a:
        return "archivo_fuera_del_diff"
    linea = h.get("linea")
    if not linea:
        return "ok"
    lado = h.get("lado", "agregada")
    lineas = a["borradas"] if lado == "borrada" else a["agregadas"]
    if lado != "borrada" and not diffutil.linea_en_cambio(a, int(linea)):
        return "linea_fuera_del_cambio"
    cita = _norm(h.get("cita"))
    if cita:
        cercanas = [t for n, t in lineas if abs(n - int(linea)) <= 2]
        if not any(cita in _norm(t) or _norm(t) in cita for t in cercanas if _norm(t)):
            return "cita_no_coincide"
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff", required=True)
    ap.add_argument("--revision", required=True)
    a = ap.parse_args()
    archivos = diffutil.por_ruta(diffutil.leer(a.diff))
    rev = comun.leer_json(a.revision)
    cuenta = {}
    for h in rev.get("hallazgos", []):
        h["ancla"] = anclar(h, archivos)
        if h["ancla"] in MALAS:
            h["verificacion"] = "descartado"
            h["motivo_verificacion"] = f"ancla: {h['ancla']}"
        cuenta[h["ancla"]] = cuenta.get(h["ancla"], 0) + 1
    for ca, v in (rev.get("veredicto_por_ca") or {}).items():
        if not isinstance(v, dict):
            continue
        ev = v.get("evidencia") or ""
        m = re.match(r"^(.+?):(\d+)", ev.strip())
        if not m:
            if v.get("estado") in ("cumple", "parcial"):
                v["evidencia_verificada"] = False  # «cumple» sin archivo:línea no es evidencia
            continue
        v["evidencia_verificada"] = anclar({"archivo": m.group(1), "linea": int(m.group(2))}, archivos) == "ok"
    comun.escribir_json(a.revision, rev)
    sin_ev = [ca for ca, v in (rev.get("veredicto_por_ca") or {}).items()
              if isinstance(v, dict) and v.get("evidencia_verificada") is False]
    print("Anclas: " + ", ".join(f"{k} {v}" for k, v in sorted(cuenta.items())) if cuenta else "Sin hallazgos de la IA.")
    if sin_ev:
        print("CA con evidencia que no cae en el diff (revísalos): " + ", ".join(sin_ev))


if __name__ == "__main__":
    main()
