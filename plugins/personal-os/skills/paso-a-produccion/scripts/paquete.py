"""Verifica el paquete de paso a producción de un requerimiento contra la configuración `paso_produccion`.

  python -I paquete.py --caso <slug-o-clave> --raiz <stateDir> --config <fuentes.yaml> [--carpeta <P>] [--escribir]
  python -I paquete.py --expediente <ruta> --config <fuentes.yaml> [...]

Sale con 0 si el paquete está completo, 1 si falta algo, 2 si no hay expediente o configuración.
Escribe <P>/paquete.json y <P>/paquete.md. Con --escribir guarda el resultado en `paso_produccion` del expediente.
"""
import argparse, datetime, fnmatch, json, os, re, sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except AttributeError:
        pass


def leer_config(ruta):
    texto = Path(ruta).read_text(encoding="utf-8")
    if str(ruta).lower().endswith((".yaml", ".yml")):
        try:
            import yaml
        except ImportError:
            sys.exit("La configuración es YAML y falta PyYAML (pip install pyyaml).")
        datos = yaml.safe_load(texto) or {}
    else:
        datos = json.loads(texto)
    return datos.get("paso_produccion") or ({} if "entregables" not in datos else datos)


CLAVE = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")


def _textos(v):
    if isinstance(v, dict):
        for x in v.values():
            yield from _textos(x)
    elif isinstance(v, list):
        for x in v:
            yield from _textos(x)
    elif v is not None:
        yield str(v)


def claves_de(exp):
    """id del expediente y toda clave de Jira en `jira` (texto, lista u objeto), historias y subtareas."""
    out = {str(exp.get("id") or "").upper()}
    for grupo in ("jira", "historias", "subtareas"):
        for t in _textos(exp.get(grupo)):
            out.update(CLAVE.findall(t.upper()))
    return {c for c in out if c}


def buscar(caso, raiz):
    raiz = Path(raiz)
    candidatos = []
    for sub in ("requerimientos", "estimaciones"):
        candidatos += sorted((raiz / sub).glob("*/expediente.json"))
    for p in candidatos:
        if p.parent.name.lower() == caso.lower():
            return p
    for p in candidatos:
        try:
            exp = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if caso.upper() in claves_de(exp):
            return p
    return None


def valor(exp, ruta):
    v = exp
    for parte in ruta.split("."):
        if not isinstance(v, dict):
            return None
        v = v.get(parte)
    return v


def tiene_contenido(v):
    if v is None:
        return False
    if isinstance(v, (str, list, dict)):
        if isinstance(v, dict):
            return any(tiene_contenido(x) for x in v.values())
        return len(v) > 0 if not isinstance(v, str) else bool(v.strip())
    return True


def archivos_en(carpeta, patrones):
    if not carpeta.exists():
        return []
    nombres = [p for p in carpeta.iterdir() if p.is_file()]
    return sorted(p.name for p in nombres if any(fnmatch.fnmatch(p.name.lower(), g.lower()) for g in patrones))


def evaluar(exp, cfg, carpeta):
    filas = []
    for e in cfg.get("entregables") or []:
        campos = [c for c in (e.get("campos") or []) if tiene_contenido(valor(exp, c))]
        archivos = archivos_en(carpeta, e.get("archivos") or [f"{e['id']}.*"])
        evidencia = [f"expediente.{c}" for c in campos] + archivos
        filas.append({"tipo": "entregable", "id": e["id"], "nombre": e.get("nombre", e["id"]),
                      "responsable": e.get("responsable"), "estado": "listo" if evidencia else "falta",
                      "evidencia": evidencia})
    aprob = carpeta / "aprobaciones"
    for a in cfg.get("aprobaciones") or []:
        archivos = archivos_en(aprob, a.get("archivos") or [f"{a['id']}.*"])
        filas.append({"tipo": "aprobacion", "id": a["id"], "nombre": a.get("nombre", a["id"]),
                      "responsable": a.get("responsable"), "estado": "listo" if archivos else "falta",
                      "evidencia": [f"aprobaciones/{x}" for x in archivos]})
    return filas


def markdown(exp, cfg, filas, completo):
    titulo = exp.get("titulo") or exp.get("id") or "requerimiento"
    lin = [f"# Paquete de paso a producción — {titulo}", "",
           f"Normativa: {cfg.get('normativa') or '—'} · Aprobador: {cfg.get('aprobador') or '—'} · "
           f"Verificado: {datetime.date.today().isoformat()} · **{'COMPLETO' if completo else 'INCOMPLETO'}**", "",
           "| Tipo | Entregable | Estado | Responsable | Evidencia |", "|---|---|---|---|---|"]
    for f in filas:
        marca = "✅ listo" if f["estado"] == "listo" else "❌ falta"
        lin.append(f"| {'Aprobación' if f['tipo'] == 'aprobacion' else 'Entregable'} | {f['nombre']} | {marca} | "
                   f"{f['responsable'] or '—'} | {', '.join(f['evidencia']) or '—'} |")
    return "\n".join(lin) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--caso")
    ap.add_argument("--raiz")
    ap.add_argument("--expediente")
    ap.add_argument("--config", required=True)
    ap.add_argument("--carpeta")
    ap.add_argument("--escribir", action="store_true")
    a = ap.parse_args()

    cfg = leer_config(a.config)
    if not cfg.get("entregables") and not cfg.get("aprobaciones"):
        print("No hay sección `paso_produccion` con entregables en la configuración.")
        sys.exit(2)
    ruta = Path(a.expediente) if a.expediente else (buscar(a.caso, a.raiz) if a.caso and a.raiz else None)
    if not ruta or not ruta.exists():
        print(f"No encontré el expediente de «{a.caso or a.expediente}».")
        sys.exit(2)
    exp = json.loads(ruta.read_text(encoding="utf-8"))
    carpeta = Path(a.carpeta or cfg.get("carpeta") or ruta.parent / "paso-produccion")
    filas = evaluar(exp, cfg, carpeta)
    completo = all(f["estado"] == "listo" for f in filas)

    carpeta.mkdir(parents=True, exist_ok=True)
    resultado = {"expediente": str(ruta), "carpeta": str(carpeta), "verificado_el": datetime.date.today().isoformat(),
                 "completo": completo, "faltan": [f["id"] for f in filas if f["estado"] != "listo"], "filas": filas}
    (carpeta / "paquete.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md = markdown(exp, cfg, filas, completo)
    (carpeta / "paquete.md").write_text(md, encoding="utf-8")
    print(md)
    print(f"Carpeta del paquete: {carpeta}")

    if a.escribir:
        exp["paso_produccion"] = {k: resultado[k] for k in ("verificado_el", "completo", "faltan", "carpeta")}
        tmp = ruta.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(exp, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, ruta)
        print("Resultado guardado en `paso_produccion` del expediente.")
    sys.exit(0 if completo else 1)


if __name__ == "__main__":
    main()
