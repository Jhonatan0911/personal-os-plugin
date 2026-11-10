"""Arma worklist.html (lo que se publica con la herramienta Artifact) desde plantilla.html.

Incrusta en la página, leído de <stateDir>/config/fuentes.yaml:
  - la sección `flujo` (niveles, nombres y pasos por nivel). Sin ella, o con niveles_activos: false, todo caso
    recorre el flujo completo y la página no muestra el filtro de nivel;
  - jira.cloud_id y jira.sitio, y el nombre visible del conector de Jira y del de correo en claude.ai
    (worklist.conector_jira | jira.servidor_mcp, por defecto «Atlassian Rovo»; worklist.conector_correo, por
    defecto «Microsoft 365», "" o m365.outlook: false = sin correo);
  - los estados de revisión (status_celula.estados.revision) y el nombre del líder (owner.nombre);
  - la marca opcional: --marca <marca.json> o worklist.marca en fuentes.yaml, con la forma de planear-sprint
    {"nombre", "logo", "claro": {"--variable": "valor"}, "oscuro": {…}}. Sin marca la página sale neutra.

El expediente nunca se incrusta: vive en la base de la página (colecciones req/expediente, ver cargar.py).

Uso:
  python -I build.py [--estado <stateDir>] [--fuentes <fuentes.yaml>] [--marca <marca.json>] [--logo <imagen>]
                     [--salida <ruta.html>]      (por defecto <stateDir>/worklist/worklist.html)
"""
import argparse
import base64
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
PLANTILLA = os.path.join(os.path.dirname(AQUI), "plantilla.html")
MIME_LOGO = {".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
             ".webp": "image/webp"}
VAR_CSS = re.compile(r"^--[a-z][a-z0-9-]*$")
VALOR_CSS = re.compile(r"^[^;{}<>\\]{1,80}$")
CLOUD = re.compile(r"^[0-9a-fA-F-]{36}$")
SITIO = re.compile(r"^[a-z0-9][a-z0-9.-]{1,120}$")


def js(v):
    # JSON seguro dentro de <script>: nada de «</» que cierre la etiqueta antes de tiempo
    return (json.dumps(v, ensure_ascii=False)
            .replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def cargar_marca(ref, base):
    if not ref:
        return {}, base
    if isinstance(ref, dict):
        return ref, base
    ruta = ref if os.path.isabs(ref) else os.path.join(base, ref)
    if not os.path.exists(ruta):
        comun.falla(f"no encontré el archivo de marca: {ruta}")
    return comun.leer_json(ruta), os.path.dirname(os.path.abspath(ruta))


def css_marca(marca):
    bloques = []
    for modo in ("claro", "oscuro"):
        vars_ = marca.get(modo) or {}
        if not isinstance(vars_, dict):
            comun.falla(f"marca.{modo} debe ser un objeto {{\"--variable\": \"valor\"}}")
        decl = []
        for k, v in vars_.items():
            v = str(v).strip()
            if not VAR_CSS.match(k) or not VALOR_CSS.match(v):
                comun.falla(f"marca.{modo}: variable o valor no permitido «{k}: {v}»")
            decl.append(f"{k}:{v}")
        if not decl:
            continue
        cuerpo = ";".join(decl)
        if modo == "claro":
            bloques.append(":root{" + cuerpo + "}")
        else:
            bloques.append('@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + cuerpo + "}}")
            bloques.append(':root[data-theme="dark"]{' + cuerpo + "}")
    return "\n".join(bloques)


def logo_html(ruta, alt):
    ext = os.path.splitext(ruta)[1].lower()
    if ext not in MIME_LOGO:
        comun.falla(f"logo con extensión no soportada: {ruta} (usa {', '.join(MIME_LOGO)})")
    if not os.path.exists(ruta):
        comun.falla(f"no encontré el logo: {ruta}")
    with open(ruta, "rb") as f:
        datos = base64.b64encode(f.read()).decode()
    return (f'<img src="data:{MIME_LOGO[ext]};base64,{datos}" alt="{html.escape(alt)}">'
            '<span class="sep" aria-hidden="true"></span>')


def config_pagina(fu, avisos):
    jira = fu.get("jira") or {}
    wl = fu.get("worklist") or {}
    cloud = str(jira.get("cloud_id") or "").strip()
    if comun.es_placeholder(cloud) or not CLOUD.match(cloud):
        avisos.append("jira.cloud_id vacío o con placeholder: el chat no consultará Jira")
        cloud = ""
    sitio = str(jira.get("sitio") or "").strip().removeprefix("https://").rstrip("/")
    if comun.es_placeholder(sitio) or not SITIO.match(sitio):
        avisos.append("jira.sitio vacío o con placeholder: las claves no enlazan a Jira")
        sitio = ""
    srv = wl.get("conector_jira") or jira.get("servidor_mcp") or ["Atlassian Rovo"]
    srv = [str(s) for s in (srv if isinstance(srv, list) else [srv]) if str(s).strip()]
    m365 = fu.get("m365") or {}
    correo = wl.get("conector_correo", "Microsoft 365")
    if m365.get("outlook") is False:
        correo = ""
    F = comun.flujo(fu)
    owner = (fu.get("owner") or {}).get("nombre")
    return {
        "jira": {"servidores": srv if cloud else [], "cloud_id": cloud,
                 "web": f"https://{sitio}/browse/" if sitio else ""},
        "correo": str(correo or ""),
        "lider": "" if comun.es_placeholder(owner) else str(owner),
        "revision": comun.estados_revision(fu),
        "flujo": {"activos": F["activos"], "defecto": F["defecto"], "niveles": F["niveles"]},
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Arma la página de la Worklist del líder.")
    ap.add_argument("--estado", help="carpeta de estado (por defecto stateDir de config.json)")
    ap.add_argument("--fuentes", help="fuentes.yaml (por defecto <stateDir>/config/fuentes.yaml)")
    ap.add_argument("--marca", help="JSON de marca (manda sobre worklist.marca de fuentes.yaml)")
    ap.add_argument("--logo", help="imagen para la franja superior (manda sobre el logo de la marca)")
    ap.add_argument("--salida", help="HTML de salida (por defecto <stateDir>/worklist/worklist.html)")
    a = ap.parse_args(argv)
    estado = comun.state_dir(a.estado)
    ruta_fu = a.fuentes or str(estado / "config" / "fuentes.yaml")
    fu = comun.fuentes(estado, ruta_fu)
    avisos = []
    if not fu:
        avisos.append(f"no encontré {ruta_fu}: página sin Jira ni niveles")
    cfg = config_pagina(fu, avisos)
    if a.marca:
        marca, base_marca = cargar_marca(a.marca, os.getcwd())
    else:
        marca, base_marca = cargar_marca((fu.get("worklist") or {}).get("marca"), os.path.dirname(os.path.abspath(ruta_fu)))
    logo = a.logo or (marca.get("logo") and (marca["logo"] if os.path.isabs(marca["logo"]) else os.path.join(base_marca, marca["logo"])))
    alt = str(marca.get("nombre") or "Logo")
    with open(PLANTILLA, encoding="utf-8") as f:
        page = f.read()
    reemplazos = {"/*__MARCA_CSS__*/": css_marca(marca), "__LOGO_HTML__": logo_html(logo, alt) if logo else "",
                  "__CONFIG__": js(cfg)}
    for k, v in reemplazos.items():
        if k not in page:
            comun.falla(f"falta el marcador {k} en la plantilla")
        page = page.replace(k, v)
    salida = os.path.abspath(a.salida) if a.salida else str(estado / "worklist" / "worklist.html")
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    with open(salida, "w", encoding="utf-8") as f:
        f.write(page)
    fl = cfg["flujo"]
    print(f"{salida}: {len(page.encode('utf-8'))} bytes · "
          + (f"niveles {', '.join(fl['niveles'])} (por defecto {fl['defecto']})" if fl["activos"] else "flujo completo, sin niveles")
          + (f" · marca «{alt}»" if marca or logo else " · marca neutra"))
    for av in avisos:
        print("AVISO: " + av)
    return 0


if __name__ == "__main__":
    sys.exit(main())
