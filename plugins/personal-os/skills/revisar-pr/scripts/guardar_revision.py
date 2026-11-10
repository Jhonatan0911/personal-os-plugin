"""Calcula el veredicto, escribe el informe con los comentarios BORRADOR y guarda la revisión en el expediente.

  python -I guardar_revision.py --capa0 capa0.json --revision revision_ia.json --informe informe.md
                                [--expediente expediente.json] [--carpeta DIR_DE_TRABAJO] [--fecha AAAA-MM-DD]

Veredicto (determinista, no lo decide la IA):
  devolver             hallazgo «alta» de la capa 0, algún CA «no», o hallazgo IA «alta» confirmado
  revisa_esto          CA «parcial», sin criterios, entregables faltantes o hallazgos «media»
  listo_para_aprobar   nada de lo anterior (la aprobación sigue siendo del líder: esto no aprueba nada)

Nada se publica: los comentarios quedan como borrador en el informe y en el expediente con `publicado: false`.
Con --carpeta borra el diff_completo.diff de esa carpeta al terminar (tenía secretos sin tachar).
"""
import argparse, datetime, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun  # noqa: E402

NOMBRE = {"devolver": "Devolver al desarrollador", "revisa_esto": "Revisa esto antes de aprobar",
          "listo_para_aprobar": "Listo para aprobar"}


def estado_ca(v):
    return v.get("estado") if isinstance(v, dict) else v


def veredicto(c0, rev):
    razones = {"devolver": [], "revisa_esto": []}
    for h in c0["hallazgos"]:
        if h["severidad"] == "alta":
            razones["devolver"].append(f"Capa 0: {h['mensaje']}" + (f" ({h['archivo']}:{h['linea']})" if h["archivo"] else ""))
        elif h["severidad"] == "media":
            razones["revisa_esto"].append(f"Capa 0: {h['mensaje']}" + (f" ({h['archivo']})" if h["archivo"] else ""))
    cas = rev.get("veredicto_por_ca") or {}
    if not cas:
        razones["revisa_esto"].append("No hay criterios de aceptación: el PR no se pudo juzgar contra la especificación.")
    for ca, v in cas.items():
        e = estado_ca(v)
        if e == "no":
            razones["devolver"].append(f"{ca} no se cumple.")
        elif e == "parcial":
            razones["revisa_esto"].append(f"{ca} se cumple a medias.")
        if isinstance(v, dict) and v.get("evidencia_verificada") is False and e in ("cumple", "parcial"):
            razones["revisa_esto"].append(f"La evidencia de {ca} no cae en el diff: verifícala a mano.")
    for h in confirmados(rev):
        if h.get("severidad") == "alta":
            razones["devolver"].append(f"{h.get('titulo')} ({h.get('archivo')}:{h.get('linea')})")
        elif h.get("severidad") == "media":
            razones["revisa_esto"].append(f"{h.get('titulo')} ({h.get('archivo')}:{h.get('linea')})")
    if razones["devolver"]:
        return "devolver", razones["devolver"] + razones["revisa_esto"]
    if razones["revisa_esto"]:
        return "revisa_esto", razones["revisa_esto"]
    return "listo_para_aprobar", []


def confirmados(rev):
    return [h for h in rev.get("hallazgos", []) if h.get("verificacion") == "confirmado"]


def comentario(h):
    return h.get("comentario_borrador") or " ".join(x for x in (h.get("explicacion"), h.get("sugerencia")) if x)


def informe(c0, rev, ver, razones, fecha):
    pr = c0.get("pr") or {}
    L = [f"# Revisión del PR {pr.get('id', rev.get('pr', ''))} · {pr.get('repo', '')}", "",
         f"**Fecha:** {fecha} · **Rama:** `{pr.get('rama', '')}` → `{pr.get('destino', '')}` · **Autor:** {pr.get('autor', '')}"
         f" · **Issue:** {c0.get('clave') or '—'}", "",
         f"## Veredicto: {NOMBRE[ver]}", ""]
    L += [f"- {r}" for r in razones[:12]] or ["- Sin observaciones bloqueantes. La decisión de aprobar es del líder."]
    if len(razones) > 12:
        L.append(f"- … y {len(razones) - 12} más (ver abajo).")
    L += ["", "## Criterios de aceptación", "", "| CA | Estado | Evidencia | Nota |", "|---|---|---|---|"]
    for ca, v in (rev.get("veredicto_por_ca") or {}).items():
        v = v if isinstance(v, dict) else {"estado": v}
        L.append(f"| {ca} | {v.get('estado', '')} | {v.get('evidencia', '') or ''} | {(v.get('nota') or '').replace('|', '/')} |")
    if not rev.get("veredicto_por_ca"):
        L.append("| — | sin criterios | | Pedir los criterios antes de aprobar |")
    L += ["", f"Fuente de los criterios: {rev.get('criterios_fuente') or c0.get('criterios_fuente') or 'no declarada'}", "",
          "## Capa 0 (máquina)", "",
          f"{c0['tamano']['archivos']} archivos · {c0['tamano']['lineas_logica']} líneas de lógica · "
          f"{c0['resumen']['alta']} alta · {c0['resumen']['media']} media · {c0['resumen']['baja']} baja", ""]
    for h in c0["hallazgos"]:
        if h["severidad"] in ("alta", "media", "baja"):
            donde = f" `{h['archivo']}:{h['linea'] or ''}`" if h["archivo"] else ""
            ev = f" — {h['evidencia']}" if h.get("evidencia") else ""
            L.append(f"- **{h['severidad']}** {h['regla']}{donde}: {h['mensaje']}{ev}")
    ent = c0.get("entregables", {})
    L += ["", f"**Entregables** pedidos: {', '.join(ent.get('requeridos') or []) or 'ninguno declarado'} · "
              f"presentes: {', '.join(ent.get('presentes') or []) or 'ninguno'} · "
              f"faltan: {', '.join(ent.get('faltantes') or []) or 'nada'}"]
    if c0.get("dependencias"):
        L += ["", "**Dependencias que cambian:** " + "; ".join(
            f"{d['nombre']} {d['version']} ({d['tipo']}{', no existe en el registro' if d.get('existe_en_registro') is False else ''})"
            for d in c0["dependencias"])]
    conf = confirmados(rev)
    desc = [h for h in rev.get("hallazgos", []) if h.get("verificacion") == "descartado"]
    L += ["", "## Revisión IA (verificada)", "",
          f"{len(conf)} hallazgos confirmados · {len(desc)} descartados en la segunda pasada", ""]
    for h in conf:
        L.append(f"- **{h.get('severidad')}** [{h.get('punto_checklist') or '—'}] `{h.get('archivo') or 'general'}:{h.get('linea') or ''}` "
                 f"{h.get('titulo')}: {h.get('explicacion', '')}")
    if rev.get("fuera_de_alcance"):
        L += ["", "**Fuera de alcance:** " + "; ".join(rev["fuera_de_alcance"])]
    if desc:
        L += ["", "<details><summary>Descartados y por qué</summary>", ""]
        L += [f"- {h.get('titulo')} — {h.get('motivo_verificacion', '')}" for h in desc]
        L += ["", "</details>"]
    L += ["", "## Comentarios BORRADOR para el PR (no publicados)", "",
          "> Nada de esto está en Azure DevOps. Se publica solo si el líder lo pide expresamente.", ""]
    for i, h in enumerate(conf, 1):
        L += [f"**{i}. `{h.get('archivo') or 'general'}`" + (f" línea {h['linea']}" if h.get("linea") else "") + "**", "",
              comentario(h), ""]
    if not conf:
        L.append("Sin comentarios de código.")
    return "\n".join(L) + "\n"


def guardar_expediente(ruta, c0, rev, ver, informe_ruta, fecha):
    exp = comun.leer_json(ruta)
    shutil.copy2(ruta, f"{ruta}.antes-revisar-pr")
    pr = c0.get("pr") or {}
    entrada = {
        "pr": str(pr.get("url") or pr.get("id") or rev.get("pr", "")), "fecha": fecha, "veredicto": ver,
        "veredicto_por_ca": {ca: estado_ca(v) for ca, v in (rev.get("veredicto_por_ca") or {}).items()},
        "hallazgos": [{"id": h.get("id"), "severidad": h.get("severidad"), "archivo": h.get("archivo"), "linea": h.get("linea"),
                       "titulo": h.get("titulo"), "punto_checklist": h.get("punto_checklist")} for h in confirmados(rev)]
        + [{"id": h["id"], "severidad": h["severidad"], "archivo": h["archivo"], "linea": h["linea"], "titulo": h["mensaje"],
            "capa": 0} for h in c0["hallazgos"] if h["severidad"] in ("alta", "media")],
        "entregables_faltantes": (c0.get("entregables") or {}).get("faltantes", []),
        "comentarios_borrador": [{"archivo": h.get("archivo"), "linea": h.get("linea"), "texto": comentario(h)} for h in confirmados(rev)],
        "publicado": False, "informe": str(informe_ruta),
    }
    exp.setdefault("revisiones_pr", []).append(entrada)
    exp.setdefault("historial", []).append({"fecha": fecha, "resumen": f"Revisión técnica del PR {pr.get('id', '')}: {NOMBRE[ver]}"})
    if isinstance(exp.get("chequeos"), dict):
        exp["chequeos"]["p4"] = {"estado": {"listo_para_aprobar": "aceptado", "revisa_esto": "parcial"}.get(ver, "pendiente"),
                                 "fecha": fecha, "nota": f"PR {pr.get('id', '')}: {NOMBRE[ver]}"}
    comun.escribir_json(ruta, exp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--capa0", required=True)
    ap.add_argument("--revision", required=True)
    ap.add_argument("--informe", required=True)
    ap.add_argument("--expediente")
    ap.add_argument("--carpeta")
    ap.add_argument("--fecha", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    c0, rev = comun.leer_json(a.capa0), comun.leer_json(a.revision)
    sin_verificar = [h for h in rev.get("hallazgos", []) if h.get("verificacion") not in ("confirmado", "descartado")]
    if sin_verificar:
        sys.exit(f"{len(sin_verificar)} hallazgos sin segunda pasada (verificacion confirmado|descartado). "
                 "Ningún hallazgo se muestra sin verificar.")
    ver, razones = veredicto(c0, rev)
    Path(a.informe).parent.mkdir(parents=True, exist_ok=True)
    Path(a.informe).write_text(informe(c0, rev, ver, razones, a.fecha), encoding="utf-8")
    if a.expediente:
        guardar_expediente(a.expediente, c0, rev, ver, a.informe, a.fecha)
    if a.carpeta:
        d = Path(a.carpeta) / "diff_completo.diff"
        if d.exists():
            d.unlink()
    print(f"Veredicto: {NOMBRE[ver]}")
    for r in razones[:8]:
        print(f"  - {r}")
    print(f"Informe: {a.informe}" + (f" · guardado en revisiones_pr de {a.expediente}" if a.expediente else ""))


if __name__ == "__main__":
    main()
