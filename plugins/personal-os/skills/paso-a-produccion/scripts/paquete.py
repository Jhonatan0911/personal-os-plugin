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


MARCADORES_DEFECTO = ["[Captura", "por definir", "TODO", "PARCIAL", "sin resultados", "sin evidencia", "POR CONFIRMAR", "pendiente:"]
TEXTO = (".md", ".html", ".htm", ".txt", ".csv")


def _texto(p):
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _tiene_marcador(texto, marcador):
    """Un marcador de una sola palabra en MAYÚSCULAS (TODO, PARCIAL) se busca exacto y como palabra completa,
    para no confundirlo con el español («todo», «parcial»). Los demás, sin distinguir mayúsculas."""
    if re.fullmatch(r"[A-ZÁÉÍÓÚÑ]+", marcador):
        return re.search(rf"(?<![A-Za-zÁÉÍÓÚÑáéíóúñ]){re.escape(marcador)}(?![A-Za-zÁÉÍÓÚÑáéíóúñ])", texto) is not None
    return marcador.lower() in texto.lower()


def _imagenes(p):
    """Cuenta imágenes reales: <img> con src en HTML/MD; objetos /Image en PDF."""
    if p.suffix.lower() == ".pdf":
        return p.read_bytes().count(b"/Subtype /Image") + p.read_bytes().count(b"/Subtype/Image")
    t = _texto(p)
    return len(re.findall(r"<img\b[^>]*\bsrc=\"(?:data:image/|[^\"]+\.(?:png|jpe?g|webp))", t, re.I)) + \
        len(re.findall(r"!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|webp)\)", t, re.I))


def _medir_video(p):
    """Duración (s), ancho, alto y si trae pista de audio, leídos con ffprobe. None si no se puede medir."""
    import json as _json
    import shutil
    import subprocess
    if not shutil.which("ffprobe"):
        return None
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                            "-of", "json", str(p)], capture_output=True, text=True, timeout=60)
        d = _json.loads(r.stdout or "{}")
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    streams = d.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    return {"duracion": float((d.get("format") or {}).get("duration") or 0), "ancho": v.get("width"),
            "alto": v.get("height"), "audio": any(s.get("codec_type") == "audio" for s in streams)}


def revisar_video(rutas, req):
    """Motivos por los que el video no está listo. req: {min_s, max_s, ancho, alto, audio}."""
    videos = [r for r in rutas if r.suffix.lower() in (".mp4", ".webm", ".mov")]
    if not videos:
        return ["falta el video renderizado (.mp4)"]
    m = _medir_video(videos[0])
    if m is None:
        return [f"no se pudo medir {videos[0].name} (¿ffprobe instalado?)"]
    motivos = []
    lo, hi = float(req.get("min_s", 15)), float(req.get("max_s", 120))
    if not lo <= m["duracion"] <= hi:
        motivos.append(f"{videos[0].name} dura {m['duracion']:.1f} s; se espera entre {lo:g} y {hi:g} s")
    if req.get("ancho") and (m["ancho"], m["alto"]) != (req["ancho"], req.get("alto")):
        motivos.append(f"{videos[0].name} es {m['ancho']}x{m['alto']}; se espera {req['ancho']}x{req.get('alto')}")
    if req.get("audio", True) and not m["audio"]:
        motivos.append(f"{videos[0].name} no tiene pista de audio")
    return motivos


def revisar_calidad(e, carpeta, archivos, cfg):
    """Devuelve la lista de motivos por los que un entregable con archivo NO está listo. Vacía = listo.
    Reglas por entregable en `requiere` (todas opcionales):
      pdf: true          -> debe existir un .pdf entre sus archivos (lo que leen personas va en PDF)
      imagenes: N        -> al menos N imágenes reales (manual con capturas)
      contiene: [regex]  -> cada patrón debe aparecer en algún archivo de texto
      evidencia: [glob]  -> debe existir al menos un archivo en <P>/evidencias/ que case
      sin_marcadores     -> por defecto true: ningún archivo de texto lleva marcadores de borrador
      video: {min_s, max_s, ancho, alto, audio} -> un .mp4 renderizado que cumpla duración, tamaño y sonido
    """
    req = e.get("requiere") or {}
    rutas = [carpeta / a for a in archivos]
    motivos = []
    if req.get("video"):
        motivos += revisar_video(rutas, req["video"] if isinstance(req["video"], dict) else {})
    if req.get("pdf") and not any(r.suffix.lower() == ".pdf" for r in rutas):
        motivos.append("falta el PDF (lo que leen personas se entrega en PDF)")
    n = int(req.get("imagenes") or 0)
    if n:
        total = max([_imagenes(r) for r in rutas if r.suffix.lower() in (".pdf", ".html", ".htm", ".md")] or [0])
        if total < n:
            motivos.append(f"tiene {total} imagen(es) real(es); se exigen {n}")
    textos = [(r, _texto(r)) for r in rutas if r.suffix.lower() in TEXTO]
    for patron in req.get("contiene") or []:
        if not any(re.search(patron, t, re.I | re.M) for _, t in textos):
            motivos.append(f"no aparece «{patron}»")
    globs = req.get("evidencia") or []
    if globs and not archivos_en(carpeta / "evidencias", globs):
        motivos.append(f"no hay evidencia en evidencias/ ({', '.join(globs)})")
    if req.get("sin_marcadores", True):
        marcas = cfg.get("marcadores_borrador") or MARCADORES_DEFECTO
        for r, t in textos:
            hall = sorted({m for m in marcas if _tiene_marcador(t, m)})
            if hall:
                motivos.append(f"{r.name} tiene marcadores de borrador: {', '.join(hall)}")
    return motivos


def omitidos(cfg):
    """Ids de entregables que esta persona decidió no generar.

    Por defecto se genera todo. Se omite un entregable si su id está en `omitir`, si trae `genera: false`
    o si depende (`con: <id>`) de otro omitido (el video va con el comunicado).
    Un id de `omitir` que no existe se denuncia (CO-076): no se ignora en silencio.
    """
    ents = cfg.get("entregables") or []
    ids = {e["id"] for e in ents}
    pedidos = {str(x) for x in (cfg.get("omitir") or [])}
    desconocidos = sorted(pedidos - ids)
    if desconocidos:
        print(f"Aviso: `omitir` nombra entregables que no existen: {', '.join(desconocidos)}", file=sys.stderr)
    fuera = (pedidos & ids) | {e["id"] for e in ents if e.get("genera") is False}
    cambio = True
    while cambio:  # dependencias encadenadas
        cambio = False
        for e in ents:
            if e["id"] not in fuera and e.get("con") in fuera:
                fuera.add(e["id"])
                cambio = True
    return fuera


def evaluar(exp, cfg, carpeta):
    filas = []
    fuera = omitidos(cfg)
    for e in cfg.get("entregables") or []:
        if e["id"] in fuera:
            motivo = (f"va con «{e['con']}», que no se genera" if e.get("con") in fuera
                      else "no se genera por configuración (omitir)")
            filas.append({"tipo": "entregable", "id": e["id"], "nombre": e.get("nombre", e["id"]),
                          "responsable": e.get("responsable"), "estado": "omitido",
                          "evidencia": [], "motivos": [motivo]})
            continue
        campos = [c for c in (e.get("campos") or []) if tiene_contenido(valor(exp, c))]
        archivos = archivos_en(carpeta, e.get("archivos") or [f"{e['id']}.*"])
        evidencia = [f"expediente.{c}" for c in campos] + archivos
        motivos = revisar_calidad(e, carpeta, archivos, cfg) if archivos else []
        if not evidencia:
            estado = "falta"
        elif archivos and motivos:
            estado = "incompleto"
        elif e.get("requiere") and not archivos:
            estado, motivos = "incompleto", ["solo hay un campo en el expediente; este entregable exige archivo"]
        else:
            estado = "listo"
        filas.append({"tipo": "entregable", "id": e["id"], "nombre": e.get("nombre", e["id"]),
                      "responsable": e.get("responsable"), "estado": estado,
                      "evidencia": evidencia, "motivos": motivos})
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
    marcas = {"listo": "✅ listo", "falta": "❌ falta", "incompleto": "🟡 incompleto", "omitido": "⚪ no se genera"}
    for f in filas:
        marca = marcas.get(f["estado"], f["estado"])
        ev = ", ".join(f["evidencia"]) or "—"
        if f.get("motivos"):
            ev += " · **" + "; ".join(f["motivos"]) + "**"
        lin.append(f"| {'Aprobación' if f['tipo'] == 'aprobacion' else 'Entregable'} | {f['nombre']} | {marca} | "
                   f"{f['responsable'] or '—'} | {ev} |")
    return "\n".join(lin) + "\n"


def raiz_mesa(p):
    """Si la carpeta está dentro de una mesa de trabajo (MESA.json o carpeta repos/), devuelve su raíz."""
    for d in [p, *p.parents]:
        if (d / "MESA.json").exists() or (d / "repos").is_dir():
            return d
    return None


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
    carpeta = Path(a.carpeta or cfg.get("carpeta") or ruta.parent / "paso-produccion").resolve()
    mesa = raiz_mesa(carpeta)
    if mesa and carpeta != (mesa / "final").resolve():
        print(f"El paquete está dentro de la mesa {mesa} pero no en su carpeta final/. "
              f"Muévelo a {mesa / 'final'} (convención de mesa-nueva) y vuelve a correr con --carpeta.")
        sys.exit(2)
    filas = evaluar(exp, cfg, carpeta)
    completo = all(f["estado"] in ("listo", "omitido") for f in filas)

    carpeta.mkdir(parents=True, exist_ok=True)
    resultado = {"expediente": str(ruta), "carpeta": str(carpeta), "verificado_el": datetime.date.today().isoformat(),
                 "completo": completo, "faltan": [f["id"] for f in filas if f["estado"] not in ("listo", "omitido")],
                 "omitidos": [f["id"] for f in filas if f["estado"] == "omitido"], "filas": filas}
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
