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

Subtarea-instrucción (opcional, en vez de «desc»): si el ítem trae «contexto», «que_hacer», «donde»,
«no_tocar», «criterios» (["CA-1"] o [{"id","texto","como_verificar"}]), «entregables» y «corte», y no trae
«desc», el generador compone «desc» con la plantilla de references/especificacion.md §3. Los CA citados por
id se buscan en las historias del expediente v2.

Expediente: v1 (sin «esquema») o v2 («esquema»: 2, references/expediente.md). En v2 se avisa si falta el
chequeo del paso 0 o la refutación: sin ellos no se exporta.
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
SECCIONES_V2 = ("id", "titulo", "cabecera", "chequeos", "refutacion", "impacto", "historias", "pendientes",
                "fuentes", "historial")
ESTADOS_P0 = ("aceptado", "parcial", "por_entender")
CAMPOS_INSTRUCCION = ("contexto", "que_hacer", "donde", "no_tocar", "criterios", "entregables", "corte")
NOMBRE_ENTREGABLE = {"tests": "tests unitarios de cada CA", "docs": "documentación del cambio",
                     "script_bd+rollback": "script de BD de publicación y de rollback, idempotentes"}
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


def cargar_expediente(ref, base, avisos):
    """Devuelve (ruta, expediente) o (None, {}) si no existe. Valida v1 o v2 y deja avisos."""
    ruta = ref if os.path.isabs(ref) else os.path.join(base, ref)
    if not os.path.exists(ruta):
        avisos.append(f"el plan nombra el expediente «{ref}» pero no existe en {ruta}")
        return None, {}
    exp = leer_json(ruta, "el expediente")
    v2 = exp.get("esquema") == 2 or "chequeos" in exp
    faltan = [s for s in (SECCIONES_V2 if v2 else SECCIONES_EXPEDIENTE) if s not in exp]
    if faltan:
        avisos.append(f"al expediente {'v2' if v2 else 'v1'} le faltan secciones: " + ", ".join(faltan))
    sin_fuente = sum(1 for s in ("decisiones", "pendientes", "riesgos", "hallazgos_codigo")
                     for x in (exp.get(s) or []) if isinstance(x, dict) and not x.get("fuente"))
    if sin_fuente:
        avisos.append(f"{sin_fuente} afirmaciones del expediente no traen «fuente»")
    if v2:
        p0 = ((exp.get("chequeos") or {}).get("p0") or {}).get("estado")
        if p0 not in ESTADOS_P0:
            avisos.append("el expediente no tiene el chequeo del paso 0 (chequeos.p0): no exportes sin él")
        elif p0 == "por_entender":
            avisos.append("paso 0 «por_entender»: publica para decidir, no para exportar")
        if not exp.get("refutacion"):
            avisos.append("el expediente no trae «refutacion»: corre el refutador antes de exportar")
        sin_ca = [h.get("clave") or h.get("key") for h in exp.get("historias") or []
                  if isinstance(h, dict) and not h.get("criterios")]
        if sin_ca:
            avisos.append("historias sin criterios CA-n: " + ", ".join(str(x) for x in sin_ca))
        abiertos = [p for p in exp.get("pendientes") or [] if isinstance(p, dict) and p.get("estado") != "resuelto"]
        sin_bloquea = sum(1 for p in abiertos if "bloquea" not in p)
        if sin_bloquea:
            avisos.append(f"{sin_bloquea} pendientes abiertos no dicen qué CA bloquean («bloquea»)")
    return ruta, exp


def criterios_del_expediente(exp):
    out = {}
    for h in exp.get("historias") or []:
        for c in (h.get("criterios") or []) if isinstance(h, dict) else []:
            if isinstance(c, dict) and c.get("id"):
                out[(h.get("clave") or h.get("key"), c["id"])] = c
                out.setdefault((None, c["id"]), c)
    return out


def componer_desc(it, historia, cas):
    """Arma la subtarea-instrucción (references/especificacion.md §3) desde los campos sueltos."""
    lineas = []
    if it.get("contexto"):
        lineas.append(f"**Contexto:** {it['contexto']}")
    pasos = it.get("que_hacer")
    if pasos:
        if isinstance(pasos, list):
            lineas.append("**Qué hacer:**\n" + "\n".join(f"{i}. {p}" for i, p in enumerate(pasos, 1)))
        else:
            lineas.append(f"**Qué hacer:** {pasos}")
    if it.get("donde"):
        lineas.append(f"**Dónde:** {it['donde']}")
    if it.get("no_tocar"):
        lineas.append(f"**Qué NO tocar:** {it['no_tocar']}")
    crit = []
    for c in it.get("criterios") or []:
        if isinstance(c, str):
            c = cas.get((historia, c)) or cas.get((None, c)) or {"id": c}
        txt = f"- {c.get('id', '')}: {(c.get('texto') or '(ver la historia)').rstrip()}"
        if c.get("como_verificar"):
            txt += ("" if txt[-1] in ".:;)" else ".") + f" Cómo verificar: {c['como_verificar'].rstrip('.')}."
        crit.append(txt)
    if crit:
        lineas.append("**Criterios de aceptación:**\n" + "\n".join(crit))
    ent = [NOMBRE_ENTREGABLE.get(e, e) for e in it.get("entregables") or []]
    if ent:
        lineas.append("**Entregables:** " + " · ".join(ent) + ".")
    if it.get("corte"):
        lineas.append(f"**Corte:** {it['corte']}")
    lineas.append("**Si dudas, pregunta:** si algo de esto no está claro, detente y pregunta al líder; no inventes.")
    return "\n".join(lineas)


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

    avisos = []
    exp_ruta, exp = (cargar_expediente(plan["expediente"], base_plan, avisos) if plan.get("expediente")
                     else (None, {}))
    cas = criterios_del_expediente(exp)
    compuestas = 0

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
            if not x.get("desc") and any(it.get(c) for c in CAMPOS_INSTRUCCION):
                x["desc"] = componer_desc(it, h["key"], cas)
                compuestas += 1
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
    if not cfg["jira"]["cloud_id"]:
        avisos.append("sin jira.cloud_id: la página no consultará ni exportará a Jira (pásalo en el plan o con --perfil)")
    if not cfg["jira"]["sitio"]:
        avisos.append("sin jira.sitio: no habrá enlaces «Abrir en Jira»")
    p0 = ((exp.get("chequeos") or {}).get("p0") or {}).get("estado") if exp else None
    print(f"ok {out} · {len(hus)} historias · propuesto {tot:g} h · pendiente de definición {pen:g} h"
          + (f" · marca «{alt}»" if marca or logo else " · marca neutra")
          + (f" · {compuestas} subtareas compuestas como instrucción" if compuestas else "")
          + (f"\npaso 0: {p0} · refutaciones: {len(exp.get('refutacion') or [])} · cortes: {len(exp.get('cortes') or [])}"
             if p0 else "")
          + (f"\nexpediente: {exp_ruta} → tras publicar, cárgalo con ArtifactData set en expediente/actual"
             if exp_ruta else "")
          + "".join("\naviso: " + a for a in avisos))


if __name__ == "__main__":
    main(sys.argv)
