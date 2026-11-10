"""Arma los números de la retro desde el expediente y llena su sección `retro`.

  python -I retro.py --expediente expediente.json [--horas-reales 14.5] [--retrabajo "…"] [--leccion "…"]… [--escribir]

Sin --escribir solo imprime el resumen (JSON) que la skill usa para redactar los borradores.
horas_estimadas = suma de `subtareas[].horas`. El retrabajo se cuenta solo: revisiones de PR devueltas o con
«revisa esto», filas de la matriz en falla y CA que no cumplieron en la revisión técnica. Las lecciones las propone
la skill y las confirma el líder; aquí solo se guardan.
"""
import argparse, datetime, json, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import base  # noqa: E402


def resumen(exp, horas_reales):
    est = round(sum(float(s.get("horas") or 0) for s in exp.get("subtareas", [])), 2)
    revs = exp.get("revisiones_pr", [])
    devueltas = [r for r in revs if r.get("veredicto") == "devolver"]
    con_obs = [r for r in revs if r.get("veredicto") == "revisa_esto"]
    ca_no = sorted({ca for r in revs for ca, e in (r.get("veredicto_por_ca") or {}).items() if e in ("no", "parcial")})
    fallas = [m.get("ca") for m in exp.get("matriz_pruebas", []) if m.get("estado") == "falla"]
    desvio = round((horas_reales - est) / est * 100, 1) if horas_reales is not None and est else None
    return {"titulo": exp.get("titulo") or exp.get("requerimiento") or exp.get("id"), "jira": exp.get("jira", []),
            "horas_estimadas": est, "horas_reales": horas_reales, "desvio_pct": desvio,
            "revisiones_pr": len(revs), "pr_devueltos": len(devueltas), "pr_con_observaciones": len(con_obs),
            "ca_que_no_cumplieron_en_revision": ca_no, "filas_en_falla": fallas,
            "hallazgos_altos": sum(1 for r in revs for h in r.get("hallazgos", []) if h.get("severidad") == "alta"),
            "certificacion": (exp.get("chequeos") or {}).get("p5", {}).get("nota"),
            "pendientes_abiertos": [p.get("texto") for p in exp.get("pendientes", []) if p.get("estado") == "abierto"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--expediente", required=True)
    ap.add_argument("--horas-reales", type=float)
    ap.add_argument("--retrabajo")
    ap.add_argument("--leccion", action="append", default=[])
    ap.add_argument("--escribir", action="store_true")
    ap.add_argument("--fecha", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    exp = base.leer_json(a.expediente)
    r = resumen(exp, a.horas_reales)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    if not a.escribir:
        return
    retrabajo = a.retrabajo or (f"{r['pr_devueltos']} PR devueltos, {r['pr_con_observaciones']} con observaciones, "
                                f"{len(r['filas_en_falla'])} filas de la matriz en falla")
    shutil.copy2(a.expediente, a.expediente + ".antes-retro")
    previa = exp.get("retro") or {}
    exp["retro"] = {**previa, "horas_estimadas": r["horas_estimadas"],
                    "horas_reales": a.horas_reales if a.horas_reales is not None else previa.get("horas_reales", 0),
                    "desvio_pct": r["desvio_pct"], "retrabajo": retrabajo,
                    "lecciones": (previa.get("lecciones") or []) + [l for l in a.leccion if l not in (previa.get("lecciones") or [])],
                    "fecha": a.fecha, "enviada": False}
    exp.setdefault("historial", []).append({"fecha": a.fecha, "resumen": "Retro registrada (borradores sin enviar)"})
    if isinstance(exp.get("chequeos"), dict):
        exp["chequeos"]["p6"] = {"estado": "parcial", "fecha": a.fecha, "nota": "Retro en borrador: falta que el líder la envíe"}
    base.escribir_json(a.expediente, exp)
    print(f"Retro guardada en {a.expediente}")


if __name__ == "__main__":
    main()
