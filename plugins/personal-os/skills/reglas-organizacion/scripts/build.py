"""Genera las reglas de la organización a partir de su registro único.

Entrada:  <config>/reglas-empresa/registro.yaml y repos.yaml   (<config> = carpeta de fuentes.yaml)
Salidas:
  <salida.rules>/00-nucleo.md          reglas de capa `nucleo` (sin paths: siempre presentes)
  <salida.rules>/2x-<slug>.md          reglas de capa `archivo` (con paths: se cargan al tocar esos archivos)
  <os-home>/guardia-empresa.json        configuración del hook PreToolUse guardia-empresa.js
  <os-home>/reglas-vigia.json           configuración del vigía reglas-scan.js (SessionStart)
  <config>/fuentes.yaml                 bloques `revision_pr` y `reglas_empresa` entre marcadores
  --vista <archivo.html>                página de convenciones vigentes para mostrar a la organización

Uso:  python -I build.py --config-dir <carpeta de fuentes.yaml> [--estado <stateDir>] [--os-home <dir>] [--seco] [--vista <html>]
"""
import argparse, base64, hashlib, html, json, os, re, sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Falta PyYAML (pip install pyyaml).")

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

HOME = Path(os.path.expanduser("~"))
MAX_NUCLEO = 40
AVISO = ("<!-- GENERADO por la skill reglas-organizacion (scripts/build.py) desde reglas-empresa/registro.yaml. "
         "No editar a mano: editar el registro y regenerar. -->")
MARCAS = {
    "revision_pr": ("# >>> revision_pr (GENERADO por reglas-organizacion/build.py; no editar a mano)", "# <<< revision_pr"),
    "reglas_empresa": ("# >>> reglas_empresa (GENERADO por reglas-organizacion/build.py; no editar a mano)", "# <<< reglas_empresa"),
}


def leer(p):
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def expandir(p):
    return Path(os.path.expandvars(os.path.expanduser(str(p))))


def validar(reg, repos):
    errores, ids = [], set()
    for r in reg.get("reglas", []):
        rid = r.get("id")
        if not rid or not re.fullmatch(r"[A-Z]+-\d{3}", str(rid)):
            errores.append(f"id inválido: {rid!r}")
        if rid in ids:
            errores.append(f"id repetido: {rid}")
        ids.add(rid)
        for campo in ("titulo", "capa", "regla", "fuente", "vigente_desde"):
            if not r.get(campo):
                errores.append(f"{rid}: falta `{campo}`")
        if r.get("capa") not in ("nucleo", "archivo", "momento"):
            errores.append(f"{rid}: capa desconocida {r.get('capa')!r}")
        if r.get("capa") == "archivo" and not r.get("paths"):
            errores.append(f"{rid}: capa archivo sin `paths`")
    if sum(1 for r in reg.get("reglas", []) if r.get("capa") == "nucleo") > MAX_NUCLEO:
        errores.append(f"el núcleo pasa de {MAX_NUCLEO} reglas: mueve las de un momento o un tipo de archivo a su capa")
    dup = set(repos.get("nuevos") or []) & set(repos.get("legados") or [])
    if dup:
        errores.append(f"repos a la vez nuevos y legados: {sorted(dup)}")
    return errores


def org(reg):
    return reg.get("organizacion") or "la organización"


def nucleo_md(reg):
    lineas = [AVISO, "", f"# Reglas de {org(reg)} — siempre vigentes", "",
              f"Reglas de {org(reg)} que aplican a todo el trabajo laboral. Cada una cita su fuente (N-### en "
              "`<estado>/normativas/`, D-### en `<estado>/decisiones/`). Si algo pedido las contradice, decirlo "
              "antes de hacerlo.", ""]
    for r in reg["reglas"]:
        if r["capa"] == "nucleo":
            lineas.append(f"- **{r['id']} · {r['titulo']}.** {r['regla'].strip()} _({r['fuente']})_")
    lineas += ["", "Fuente única: `reglas-empresa/registro.yaml` junto a `fuentes.yaml` (skill reglas-organizacion)."]
    return "\n".join(lineas) + "\n"


def slug(t):
    t = t.lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def archivo_md(r, repos, reg):
    paths = "\n".join(f'  - "{p}"' for p in r["paths"])
    cuerpo = [f"---\npaths:\n{paths}\n---", AVISO, "", f"# {r['id']} · {r['titulo']}", "", r["regla"].strip(), ""]
    if r.get("solo_repos_nuevos"):
        nuevos = repos.get("nuevos") or []
        guias = reg.get("guias") or {}
        cuerpo += ["**Repos nuevos (aplica):** " + (", ".join(f"`{x}`" for x in nuevos) or "ninguno declarado")
                   + ". Un repo que no está en la lista se trata como legado.", ""]
        docs = [f"`{v}`" for v in (guias.get("backend"), guias.get("frontend")) if v]
        if docs:
            cuerpo += ["Guías de arquitectura: " + " y ".join(docs) + ".", ""]
    cuerpo.append(f"_Fuente: {r['fuente']}._")
    return "\n".join(cuerpo) + "\n"


def guardia_json(reg):
    b = reg.get("bloqueos") or {}
    srv = b.get("servidores") or {}
    return {
        "_aviso": "GENERADO por reglas-organizacion/build.py desde registro.yaml. No editar a mano.",
        "servidores_deny": srv.get("deny") or [],
        "servidores_ask": srv.get("ask") or [],
        "servidores_test": b.get("servidores_test") or [],
        "remotos_org": b.get("remotos_org") or [],
        "ramas_protegidas": b.get("ramas_protegidas") or [],
        "patron_rama": b.get("patron_rama") or "",
        "sql_escritura": b.get("sql_escritura") or [],
        "clientes_sql": b.get("clientes_sql") or [],
    }


def regla_despliegue(reg):
    for r in reg["reglas"]:
        if "paso-a-produccion" in (r.get("momentos") or []):
            return r["id"]
    return None


def vigia_json(reg, conf, estado, rules_dir, guardia):
    return {
        "_aviso": "GENERADO por reglas-organizacion/build.py desde registro.yaml. No editar a mano.",
        "registro": [str(conf / "registro.yaml"), str(conf / "repos.yaml")],
        "huella": hashlib.sha256((conf / "registro.yaml").read_bytes() + (conf / "repos.yaml").read_bytes()).hexdigest(),
        "generados": [str(rules_dir / "00-nucleo.md"), str(guardia)],
        "build": str(Path(__file__).resolve()),
        "config_dir": str(conf.parent),
        "regla_despliegue": regla_despliegue(reg),
        "documentos_vigilados": reg.get("documentos_vigilados") or [],
        "carpetas_vigiladas": reg.get("carpetas_vigiladas") or [],
        "expedientes": [str(estado / "requerimientos"), str(estado / "estimaciones")] if estado else [],
    }


def mezclar(base, extra):
    out = dict(base or {})
    for k, v in (extra or {}).items():
        out[k] = mezclar(out.get(k), v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def bloque(clave, datos):
    ini, fin = MARCAS[clave]
    return f"{ini}\n{yaml.safe_dump({clave: datos}, allow_unicode=True, sort_keys=False, width=200)}{fin}\n"


def con_bloque(texto, clave, contenido):
    nl = "\r\n" if "\r\n" in texto else "\n"
    t = texto.replace("\r\n", "\n")
    # el marcador se reconoce por su prefijo («# >>> clave»), aunque cambie el texto que lo acompaña
    patron = re.compile(rf"^# >>> {clave}\b[^\n]*\n.*?^# <<< {clave}[^\n]*\n?", re.S | re.M)
    if patron.search(t):
        t = patron.sub(lambda _: contenido, t)
    else:
        if re.search(rf"^{clave}:", t, re.M):
            sys.exit(f"fuentes.yaml ya tiene una sección {clave} escrita a mano: unificarla con el registro antes de generar.")
        t = t.rstrip("\n") + "\n\n" + contenido
    return t.replace("\n", nl)


def revision_pr(reg, repos):
    guias = reg.get("guias") or {}
    gen = {"proyectos_nuevos": {"repos_nuevos": repos.get("nuevos") or [], "repos_legados": repos.get("legados") or [],
                                "guia_backend": guias.get("backend"), "guia_frontend": guias.get("frontend")},
           "regla_minima": {"rama_con_clave": True, "bd_con_rollback": True}}
    return mezclar(reg.get("revision_pr_base") or {}, gen)


def reglas_empresa(reg, conf, rules_dir):
    por_skill = {}
    for r in reg["reglas"]:
        for s in r.get("momentos") or []:
            por_skill.setdefault(s, []).append({"id": r["id"], "titulo": r["titulo"], "regla": r["regla"].strip(),
                                                "fuente": r["fuente"]})
    return {"registro": str(conf / "registro.yaml").replace("\\", "/"),
            "nucleo": str(rules_dir / "00-nucleo.md").replace("\\", "/"),
            "por_skill": dict(sorted(por_skill.items()))}


def vista_html(reg, repos):
    m = reg.get("marca") or {}
    pri, sec = m.get("primario", "#1f4e79"), m.get("secundario", "#2e86c1")
    nombre = html.escape(org(reg))
    # La página es para personas: usa `texto_equipo` / `fuente_equipo` (la norma como la lee el equipo) cuando
    # existen; `regla` / `fuente` le hablan al asistente y solo se muestran si la regla no tiene versión de equipo.
    capas = [("nucleo", "Para todo desarrollo"), ("archivo", "Por tecnología"), ("momento", "En un momento del trabajo")]
    filas = []
    for clave, titulo in capas:
        rs = [r for r in reg["reglas"] if r["capa"] == clave]
        if not rs:
            continue
        filas.append(f"<h2>{titulo}</h2>")
        for r in rs:
            equipo = bool(r.get("texto_equipo"))
            extra = ""
            if r.get("paths"):
                extra += "<span class='tag'>" + " ".join(html.escape(p) for p in r["paths"]) + "</span>"
            if not equipo:
                for c in r.get("cumplimiento") or []:
                    extra += f"<span class='tag c-{html.escape(c)}'>{html.escape(c.replace('_', ' '))}</span>"
            texto = html.escape((r.get("texto_equipo") or r["regla"]).strip()).replace("\n", "<br>")
            fuente = r.get("fuente_equipo") or r["fuente"]
            filas.append(f"<article><h3><b>{html.escape(r['id'])}</b> {html.escape(r['titulo'])}</h3><p>{texto}</p>"
                         f"<footer>{extra}<span class='src'>Fuente: {html.escape(fuente)} · vigente desde "
                         f"{html.escape(str(r['vigente_desde']))}</span></footer></article>")
    nuevos = "".join(f"<li><code>{html.escape(x)}</code></li>" for x in repos.get("nuevos") or [])
    logo = ""
    if m.get("logo"):
        src = m["logo"]
        p = expandir(src)
        if p.is_file() and p.stat().st_size < 400_000:   # archivo local: se incrusta para que la página sea autocontenida
            tipo = {".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(p.suffix.lower(), "image/png")
            src = f"data:{tipo};base64," + base64.b64encode(p.read_bytes()).decode("ascii")
        logo = f"<img src='{html.escape(src)}' alt='' class='logo'>"
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Convenciones de desarrollo</title><style>
:root{{--pri:{pri};--sec:{sec};--bg:#f6f8fa;--card:#fff;--tx:#1b1f24;--mu:#57606a;--bd:#d0d7de}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#0d1117;--card:#161b22;--tx:#e6edf3;--mu:#9da7b3;--bd:#30363d}}}}
:root[data-theme="dark"]{{--bg:#0d1117;--card:#161b22;--tx:#e6edf3;--mu:#9da7b3;--bd:#30363d}}
body{{margin:0;background:var(--bg);color:var(--tx);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}}
header{{background:var(--pri);color:#fff;padding:28px 16px}} header div,main{{max-width:960px;margin:0 auto}}
header h1{{margin:0 0 4px;font-size:1.6rem}} header p{{margin:0;opacity:.9}} .logo{{height:36px;float:right}}
main{{padding:8px 16px 40px}} h2{{border-bottom:2px solid var(--sec);padding-bottom:4px;margin-top:32px}}
article{{background:var(--card);border:1px solid var(--bd);border-left:4px solid var(--sec);border-radius:8px;padding:12px 16px;margin:12px 0}}
article h3{{margin:0 0 6px;font-size:1rem}} article h3 b{{color:var(--sec);margin-right:6px}} article p{{margin:0 0 8px}}
footer{{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8rem;color:var(--mu)}}
.tag{{border:1px solid var(--bd);border-radius:999px;padding:1px 8px}} .c-bloqueo{{border-color:#cf222e;color:#cf222e}}
.src{{margin-left:auto}} code{{font-size:.85rem}} ul{{columns:2}} @media (max-width:600px){{ul{{columns:1}}.src{{margin-left:0}}}}
</style></head><body><header><div>{logo}<h1>Convenciones de desarrollo · {nombre}</h1>
<p>Reglas vigentes para todo desarrollo, se trabaje o no con asistentes de IA. Cada una cita el documento que la exige.</p></div></header>
<main>{''.join(filas)}<h2>Proyectos nuevos</h2><p>Aplican las guías de arquitectura:</p><ul>{nuevos or '<li>ninguno declarado</li>'}</ul></main></body></html>
"""


def escribir(p, contenido, seco):
    p = Path(p)
    previo = p.read_text(encoding="utf-8") if p.exists() else None
    estado = "igual" if previo == contenido else ("nuevo" if previo is None else "cambia")
    if not seco and estado != "igual":
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(contenido)
    print(f"  [{estado}] {p}")


def state_dir(arg):
    if arg:
        return Path(arg)
    try:
        cfg = json.loads((HOME / ".claude" / "personal-os" / "config.json").read_text(encoding="utf-8-sig"))
        return Path(cfg["stateDir"]) if cfg.get("stateDir") else None
    except (OSError, ValueError, KeyError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config-dir", required=True, help="carpeta de fuentes.yaml")
    ap.add_argument("--estado")
    ap.add_argument("--os-home", default=str(HOME / ".claude" / "personal-os"))
    ap.add_argument("--seco", action="store_true")
    ap.add_argument("--vista")
    a = ap.parse_args()

    config_dir = Path(a.config_dir)
    conf = config_dir / "reglas-empresa"
    fuentes = config_dir / "fuentes.yaml"
    if not (conf / "registro.yaml").exists():
        sys.exit(f"No hay registro en {conf / 'registro.yaml'}: créalo desde la plantilla de la skill.")
    reg = leer(conf / "registro.yaml")
    repos = leer(conf / "repos.yaml") if (conf / "repos.yaml").exists() else {}
    errores = validar(reg, repos)
    if errores:
        print("El registro tiene errores; no se genera nada:")
        for e in errores:
            print("  -", e)
        sys.exit(1)

    if a.vista:
        escribir(a.vista, vista_html(reg, repos), a.seco)
        return

    os_home = Path(a.os_home)
    rules_dir = expandir((reg.get("salida") or {}).get("rules") or "~/.claude/rules/organizacion")
    # fuentes.yaml se arma antes de escribir nada: si choca con una sección escrita a mano, no se toca ningún archivo
    texto_fuentes = None
    if fuentes.exists():
        texto_fuentes = fuentes.read_text(encoding="utf-8")
        texto_fuentes = con_bloque(texto_fuentes, "revision_pr", bloque("revision_pr", revision_pr(reg, repos)))
        texto_fuentes = con_bloque(texto_fuentes, "reglas_empresa", bloque("reglas_empresa", reglas_empresa(reg, conf, rules_dir)))
    guardia, vigia = os_home / "guardia-empresa.json", os_home / "reglas-vigia.json"
    print("Reglas de la organización" + (" (en seco)" if a.seco else "") + ":")
    esperados = {"00-nucleo.md"}
    escribir(rules_dir / "00-nucleo.md", nucleo_md(reg), a.seco)
    n = 20
    for r in reg["reglas"]:
        if r["capa"] == "archivo":
            nombre = f"{n}-{slug(r['titulo'])}.md"
            esperados.add(nombre)
            escribir(rules_dir / nombre, archivo_md(r, repos, reg), a.seco)
            n += 1
    if rules_dir.exists():
        for viejo in rules_dir.glob("*.md"):
            if viejo.name not in esperados and "GENERADO por" in viejo.read_text(encoding="utf-8"):
                print(f"  [sobra] {viejo}" + ("" if a.seco else " → borrado"))
                if not a.seco:
                    viejo.unlink()

    escribir(guardia, json.dumps(guardia_json(reg), ensure_ascii=False, indent=2) + "\n", a.seco)
    escribir(vigia, json.dumps(vigia_json(reg, conf, state_dir(a.estado), rules_dir, guardia), ensure_ascii=False, indent=2) + "\n", a.seco)
    if texto_fuentes is not None:
        escribir(fuentes, texto_fuentes, a.seco)

    nucleo = sum(1 for r in reg["reglas"] if r["capa"] == "nucleo")
    print(f"Núcleo: {nucleo} reglas · por archivo: {n - 20} · repos nuevos: {len(repos.get('nuevos') or [])}")
    srv = (reg.get("bloqueos") or {}).get("servidores") or {}
    if not srv.get("deny"):
        print("AVISO: no hay servidores de producción en bloqueos.servidores.deny: el hook no bloquea producción.")


if __name__ == "__main__":
    main()
