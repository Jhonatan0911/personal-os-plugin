#!/usr/bin/env python3
"""Genera el cronograma interactivo de un sprint a partir de un plan.json.

Uso:
    python generar_cronograma.py <plan.json> <salida.html> [--perfil <perfil.json>] [--marca <marca.json>]
                                 [--logo <imagen>]

La plantilla (cronograma-plantilla.html) y el bloque del analista (analista-bloque.html) se leen de la
misma carpeta de este script. Formato completo de ejemplo: plan-ejemplo.json (datos ficticios).

--perfil  JSON con valores por defecto del plan para una organización (jira, correo, lider, quien_define,
          personas, cuentas, capacidad, marca…). El plan manda: el perfil solo llena lo que el plan no trae
          («jira» y «correo» se mezclan campo por campo). Sirve también para regenerar planes viejos que no
          traen la sección «jira». Formato en references/configuracion.md.
--marca   JSON de marca: {"nombre", "logo", "claro": {"--brand": "#…", …}, "oscuro": {…}}. Sin marca la
          página sale neutra. También puede venir como «marca» dentro del plan o del perfil (ruta u objeto).
--logo    Imagen (png, svg, jpg, webp) para la franja superior; manda sobre el logo de la marca.

plan.json (campos):
{
  "titulo": "Sprint 12 · Reportes de Cliente A",          # obligatorio
  "subtitulo": "Épica PROY-140 · ...",                    # opcional
  "asignado": {"nombre": "Ana", "accountId": null},       # obligatorio el nombre; accountId opcional
                                                          #   (si falta, la página lo busca en Jira por nombre)
  "proyecto": "PROY",                                     # obligatorio: clave del proyecto de Jira
  "jira": {                                               # sale de <stateDir>/config/fuentes.yaml → jira
    "sitio": "tu-sitio.atlassian.net",                    #   para los enlaces «Abrir en Jira»
    "cloud_id": "<cloudId>",                              #   sin él la página no consulta ni exporta
    "servidor_mcp": "Atlassian Rovo",                     #   nombre del conector en claude.ai
    "tipo_subtarea": "Subtarea",                          #   nombre exacto del tipo de subtarea en TU Jira
    "campo_inicio": null                                  #   id del campo «fecha de inicio» (p. ej. customfield_NNNNN) o null
  },
  "correo": {"servidor_mcp": "Microsoft 365"},            # opcional: conector de correo del analista ("" = sin correo)
  "lider": "Nombre de quien planea",                      # queda como autor de las decisiones en el expediente
  "quien_define": "el cliente",                           # texto de la leyenda de lo pendiente de definición
  "inicio": "2026-03-02", "fin": "2026-03-13", "fin_desarrollo": "2026-03-10",
  "festivos": ["2026-03-09"],
  "fases": [["dev","Desarrollo","2026-03-02","2026-03-10"], ["qa","QA","2026-03-11","2026-03-12"], ...],
                                                          #   ids de fase con color: dev, qa, pru, hol, ali
  "fases_replan": [],                                     # opcional: fases replaneadas (se pintan en rojo)
  "texto_nueva": "Nuevo: entra solo si el cliente lo confirma.",
  "descripcion_subtarea": "Subtarea del sprint 12 (PROY-140).",
  "personas": ["Ana", "Luis"],                            # opcional: responsables posibles por subtarea
  "cuentas": {"Luis": "<accountId>"},                     # opcional: accountId conocidos
  "capacidad": [7.5, 7],                                  # h de desarrollo lunes-jueves y viernes (matriz)
  "epica": "PROY-140",                                    # para que el analista busque hijas nuevas
  "correos_busqueda": ["Reportes Cliente A"],             # términos para buscar correos del tema
  "expediente": "expediente.json",                        # opcional: semilla del expediente (relativa al plan);
                                                          #   se valida aquí y se carga con ArtifactData, nunca en el HTML
  "marca": "marca.json",                                  # opcional: perfil de marca (ruta relativa al plan u objeto)
  "historias": [
    {"key": "PROY-142", "t": "Título corto", "nota": "Qué hay hoy", "esc": [["Pieza","ok|dif|nueva"]],
     "coment": "Comentario opcional para Jira", "ficticia": false,
     "items": [{"titulo": "...", "horas": 2, "ini": "2026-03-02", "fin": "2026-03-02",
                "estado": "propuesta|espera", "obs": "opcional", "tipo": "id de la matriz (opcional)",
                "desc": "borrador markdown de la descripción para Jira"}]}
  ]
}
Los ítems salen como «propuesta» (el líder los acepta en la página) o «espera» (pendiente de definición).
"""
import base64
import html
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SECCIONES_EXPEDIENTE = ("resumen", "historias", "decisiones", "pendientes", "riesgos", "hallazgos_codigo",
                        "cronograma", "fuentes", "historial")
MIME_LOGO = {".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
             ".webp": "image/webp"}
VAR_CSS = re.compile(r"^--[a-z][a-z0-9-]*$")
VALOR_CSS = re.compile(r"^[^;{}<>\\]{1,80}$")


def falla(msg):
    sys.exit("error: " + msg)


def js(v):
    # JSON seguro dentro de <script>: nada de «</» que cierre la etiqueta antes de tiempo
    return (json.dumps(v, ensure_ascii=False)
            .replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def leer(nombre):
    with open(os.path.join(AQUI, nombre), encoding="utf-8") as f:
        return f.read()


def leer_json(ruta, que):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        falla(f"no encontré {que}: {ruta}")
    except json.JSONDecodeError as e:
        falla(f"{que} no es JSON válido ({ruta}): {e}")


def argumentos(argv):
    pos, opc = [], {}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a in ("--perfil", "--marca", "--logo"):
            if i + 1 >= len(argv):
                falla(f"{a} necesita una ruta")
            opc[a[2:]] = argv[i + 1]
            i += 2
        elif a.startswith("--"):
            falla(f"opción desconocida {a}")
        else:
            pos.append(a)
            i += 1
    if len(pos) != 2:
        falla("uso: python generar_cronograma.py <plan.json> <salida.html> "
              "[--perfil perfil.json] [--marca marca.json] [--logo imagen]")
    return pos[0], pos[1], opc


def con_perfil(plan, perfil, base_perfil):
    """El plan manda; el perfil llena lo que falte. jira, correo y cuentas se mezclan campo por campo."""
    out = dict(perfil)
    out.pop("marca", None)
    for k, v in plan.items():
        if k in ("jira", "correo", "cuentas") and isinstance(v, dict) and isinstance(out.get(k), dict):
            mezcla = dict(out[k])
            mezcla.update({kk: vv for kk, vv in v.items() if vv not in (None, "")})
            out[k] = mezcla
        else:
            out[k] = v
    if "marca" not in plan and perfil.get("marca"):
        m = perfil["marca"]
        out["marca"] = os.path.join(base_perfil, m) if isinstance(m, str) and not os.path.isabs(m) else m
    return out


def cargar_marca(ref, base):
    """Devuelve (dict de marca, carpeta para resolver su logo)."""
    if not ref:
        return {}, base
    if isinstance(ref, dict):
        return ref, base
    ruta = ref if os.path.isabs(ref) else os.path.join(base, ref)
    return leer_json(ruta, "el archivo de marca"), os.path.dirname(os.path.abspath(ruta))


def css_marca(marca):
    bloques = []
    for modo in ("claro", "oscuro"):
        vars_ = marca.get(modo) or {}
        if not isinstance(vars_, dict):
            falla(f"marca.{modo} debe ser un objeto {{\"--variable\": \"valor\"}}")
        decl = []
        for k, v in vars_.items():
            v = str(v).strip()
            if not VAR_CSS.match(k) or not VALOR_CSS.match(v):
                falla(f"marca.{modo}: variable o valor no permitido «{k}: {v}»")
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
        falla(f"logo con extensión no soportada: {ruta} (usa {', '.join(MIME_LOGO)})")
    try:
        with open(ruta, "rb") as f:
            datos = base64.b64encode(f.read()).decode()
    except FileNotFoundError:
        falla(f"no encontré el logo: {ruta}")
    return f'<img src="data:{MIME_LOGO[ext]};base64,{datos}" alt="{html.escape(alt)}">'


def revisar_expediente(ref, base, avisos):
    ruta = ref if os.path.isabs(ref) else os.path.join(base, ref)
    if not os.path.exists(ruta):
        avisos.append(f"el plan nombra el expediente «{ref}» pero no existe en {ruta}")
        return None
    exp = leer_json(ruta, "el expediente")
    faltan = [s for s in SECCIONES_EXPEDIENTE if s not in exp]
    if faltan:
        avisos.append("al expediente le faltan secciones: " + ", ".join(faltan))
    sin_fuente = sum(1 for s in ("decisiones", "pendientes", "riesgos", "hallazgos_codigo")
                     for x in (exp.get(s) or []) if isinstance(x, dict) and not x.get("fuente"))
    if sin_fuente:
        avisos.append(f"{sin_fuente} afirmaciones del expediente no traen «fuente»")
    return ruta


def main(argv):
    for flujo in (sys.stdout, sys.stderr):  # consolas en cp1252 (con -I no vale PYTHONIOENCODING)
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    plan_path, out, opc = argumentos(argv)
    base_plan = os.path.dirname(os.path.abspath(plan_path))
    plan = leer_json(plan_path, "el plan")
    if opc.get("perfil"):
        perfil = leer_json(opc["perfil"], "el perfil")
        plan = con_perfil(plan, perfil, os.path.dirname(os.path.abspath(opc["perfil"])))

    for campo in ("titulo", "proyecto", "inicio", "fin", "fin_desarrollo", "fases", "historias"):
        if not plan.get(campo):
            falla(f"falta «{campo}» en {plan_path}")
    asignado = plan.get("asignado") or {}
    if not asignado.get("nombre"):
        falla("falta «asignado.nombre» (dueño del cronograma)")
    cap = plan.get("capacidad", [7.5, 7])
    if not (isinstance(cap, list) and len(cap) == 2):
        falla("«capacidad» debe ser [horas lunes-jueves, horas viernes]")
    festivos = plan.get("festivos", [])
    if isinstance(festivos, str):
        festivos = [festivos]

    hus = []
    for h in plan["historias"]:
        if not h.get("key") or not h.get("t"):
            falla("cada historia necesita «key» y «t» (título)")
        items = []
        for it in h.get("items", []):
            x = {"titulo": it["titulo"], "horas": it.get("horas"), "ini": it.get("ini"), "fin": it.get("fin"),
                 "estado": it.get("estado", "propuesta"), "autor": "claude"}
            if x["estado"] not in ("propuesta", "espera"):
                falla(f"estado inválido «{x['estado']}» en {h['key']} (usa propuesta o espera)")
            for campo in ("obs", "desc", "tipo"):
                if it.get(campo):
                    x[campo] = it[campo]
            if x["estado"] == "espera":
                x["ini"] = x["fin"] = None   # lo pendiente de definición no lleva fecha
            items.append(x)
        hus.append({"key": h["key"], "t": h["t"], "nota": h.get("nota", ""), "esc": h.get("esc", []),
                    **({"coment": h["coment"]} if h.get("coment") else {}),
                    **({"ficticia": True} if h.get("ficticia") else {}), "items": items})

    jira = dict(plan.get("jira") or {})
    correo = plan.get("correo") or {}
    cuentas = plan.get("cuentas", {})
    # Sin «personas», los responsables posibles son los que ya tienen cuenta conocida
    personas = plan.get("personas") or [n for n in cuentas if n != asignado["nombre"]]
    cfg = {
        "titulo": plan["titulo"],
        "asignado": {"nombre": asignado["nombre"], "accountId": asignado.get("accountId") or None},
        "proyecto": plan["proyecto"],
        "jira": {"sitio": jira.get("sitio") or "", "cloud_id": jira.get("cloud_id") or "",
                 "servidor_mcp": jira.get("servidor_mcp") or "Atlassian Rovo",
                 "tipo_subtarea": jira.get("tipo_subtarea") or "Subtarea",
                 "campo_inicio": jira.get("campo_inicio") or None},
        "lider": plan.get("lider") or "el líder",
        "inicio": plan["inicio"], "fin": plan["fin"], "fin_desarrollo": plan["fin_desarrollo"],
        "festivos": festivos,
        "fases": plan["fases"], "fases_replan": plan.get("fases_replan", []),
        "texto_nueva": plan.get("texto_nueva", "Nuevo: entra solo si el cliente lo confirma."),
        "descripcion_subtarea": plan.get("descripcion_subtarea", "Subtarea planeada en el cronograma del sprint."),
        "personas": personas,
        "cuentas": cuentas,
        "capacidad": [float(cap[0]), float(cap[1])],
        "historias": hus,
    }
    meta = {"titulo": plan["titulo"], "keys": [h["key"] for h in plan["historias"] if not h.get("ficticia")],
            "epica": plan.get("epica"), "correos": plan.get("correos_busqueda") or [plan["titulo"]],
            "cloud_id": cfg["jira"]["cloud_id"], "servidor_jira": cfg["jira"]["servidor_mcp"],
            "servidor_correo": correo.get("servidor_mcp") or "", "lider": cfg["lider"]}

    # Marca: --marca > «marca» del plan (o del perfil). Sin marca, la página queda neutra.
    if opc.get("marca"):
        marca, base_marca = cargar_marca(opc["marca"], os.getcwd())
    else:
        marca, base_marca = cargar_marca(plan.get("marca"), base_plan)
    logo = opc.get("logo")
    if not logo and marca.get("logo"):
        logo = marca["logo"] if os.path.isabs(marca["logo"]) else os.path.join(base_marca, marca["logo"])
    alt = marca.get("nombre") or "Logo"

    t = leer("cronograma-plantilla.html").rstrip() + "\n" + leer("analista-bloque.html")
    rep = {
        "__TITULO_HTML__": html.escape(plan["titulo"]),
        "__SUBTITULO_HTML__": html.escape(plan.get("subtitulo", "")),
        "__QUIEN_DEFINE_HTML__": html.escape(plan.get("quien_define", "el cliente")),
        "/*__MARCA_CSS__*/": css_marca(marca),
        "__LOGO_HTML__": logo_html(logo, alt) if logo else "",
        "__CFG__": js(cfg),
        "__EXP_META__": js(meta),
    }
    for k, v in rep.items():
        if k not in t:
            falla(f"falta el marcador {k} en la plantilla")
        t = t.replace(k, v)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(t)

    tot = sum((it.get("horas") or 0) for h in plan["historias"] for it in h.get("items", [])
              if it.get("estado", "propuesta") != "espera")
    pen = sum((it.get("horas") or 0) for h in plan["historias"] for it in h.get("items", [])
              if it.get("estado") == "espera")
    avisos = []
    if not cfg["jira"]["cloud_id"]:
        avisos.append("sin jira.cloud_id: la página no consultará ni exportará a Jira (pásalo en el plan o con --perfil)")
    if not cfg["jira"]["sitio"]:
        avisos.append("sin jira.sitio: no habrá enlaces «Abrir en Jira»")
    exp = revisar_expediente(plan["expediente"], base_plan, avisos) if plan.get("expediente") else None
    print(f"ok {out} · {len(hus)} historias · propuesto {tot:g} h · pendiente de definición {pen:g} h"
          + (f" · marca «{alt}»" if marca or logo else " · marca neutra")
          + (f"\nexpediente: {exp} → tras publicar, cárgalo con ArtifactData set en expediente/actual" if exp else "")
          + "".join("\naviso: " + a for a in avisos))


if __name__ == "__main__":
    main(sys.argv)
