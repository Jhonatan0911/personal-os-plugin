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
  "equipo": [                                             # opcional: ← equipo[] de fuentes.yaml (capacidad real)
    {"nombre": "Luis", "produce_pr": true,                #   produce_pr false: no suma capacidad de desarrollo
     "prestado": {"a": "<otra célula>", "desde": "2026-03-09", "hasta": null}}   # sin capacidad en ese rango
  ],
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
                "desc": "borrador markdown de la descripción para Jira",
                "modelo": {"tablas": [{"nombre": "Tabla", "tipo": "nueva|existente", "nota": "opcional",
                           "columnas": [{"n": "Id", "t": "int", "pk": true, "fk": "Otra.Id", "nulo": false}]}],
                           "aprobado": null}}]}
  ]
}
Los ítems salen como «propuesta» (el líder los acepta en la página) o «espera» (pendiente de definición).

Subtarea-instrucción (opcional, en vez de «desc»): si el ítem trae «contexto», «que_hacer», «donde»,
«no_tocar», «criterios» (["CA-1"] o [{"id","texto","como_verificar"}]), «entregables» y «corte», y no trae
«desc», el generador compone «desc» con la plantilla de references/especificacion.md §3. Los CA citados por
id se buscan en las historias del expediente v2.

Equipo (opcional): sin «equipo» todo funciona como antes. Con él, la capacidad de cada persona es 0 si
«produce_pr» es false o en los días en que está «prestado» (hasta null = sin fecha de regreso); la página
muestra cuántas personas producen PR entre «inicio» y «fin_desarrollo» y avisa si una subtarea cae en días
en que su responsable está prestado. El generador hace la misma cuenta y la imprime.

Expediente: v1 (sin «esquema») o v2 («esquema»: 2, references/expediente.md). En v2 se avisa si falta el
chequeo del paso 0 o la refutación: sin ellos no se exporta.
"""
import base64
import html
import json
import os
import re
import sys
from datetime import date, timedelta

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
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
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


def mismo_nombre(a, b):
    """«Ana» y «Ana Pérez» son la misma persona (igual que en la página)."""
    a, b = str(a or "").strip(), str(b or "").strip()
    return bool(a and b) and (a == b or a.startswith(b + " ") or b.startswith(a + " "))


def cargar_equipo(crudo, avisos):
    """Normaliza «equipo»: [{nombre, produce_pr (bool, por defecto true), prestado {a, desde, hasta} | None}]."""
    if not crudo:
        return []
    if not isinstance(crudo, list):
        falla("«equipo» debe ser una lista de personas ({\"nombre\", \"produce_pr\", \"prestado\"})")
    out = []
    for p in crudo:
        if not isinstance(p, dict) or not str(p.get("nombre") or "").strip():
            avisos.append("equipo: una persona sin «nombre» se ignoró")
            continue
        x = {"nombre": str(p["nombre"]).strip(), "produce_pr": p.get("produce_pr", True) is not False}
        pr = p.get("prestado")
        if isinstance(pr, dict) and pr.get("desde"):
            desde, hasta = str(pr.get("desde")), (str(pr["hasta"]) if pr.get("hasta") else None)
            if not FECHA.match(desde) or (hasta and not FECHA.match(hasta)):
                avisos.append(f"equipo: «prestado» de {x['nombre']} con fechas inválidas (AAAA-MM-DD); se ignoró")
            else:
                x["prestado"] = {"a": str(pr.get("a") or "otra célula"), "desde": desde, "hasta": hasta}
        elif pr:
            avisos.append(f"equipo: «prestado» de {x['nombre']} necesita al menos «desde»; se ignoró")
        out.append(x)
    return out


def prestado_en(persona, dia):
    pr = persona.get("prestado")
    return bool(pr) and dia >= pr["desde"] and (not pr["hasta"] or dia <= pr["hasta"])


def dias_habiles(ini, fin, festivos):
    d, e, out = date.fromisoformat(ini), date.fromisoformat(fin), []
    while d <= e:
        if d.weekday() < 5 and d.isoformat() not in festivos:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def capacidad_real(equipo, plan, festivos, asignado, avisos):
    """Cuántas personas producen PR en el rango de desarrollo y qué subtareas caen en días de préstamo."""
    try:
        dias = dias_habiles(plan["inicio"], plan["fin_desarrollo"], set(festivos))
    except ValueError:
        return ""
    if not dias:
        return ""
    producen, notas = 0, []
    for p in equipo:
        if not p["produce_pr"]:
            notas.append(f"{p['nombre']} no produce PR")
            continue
        fuera = [d for d in dias if prestado_en(p, d)]
        if len(fuera) == len(dias):
            notas.append(f"{p['nombre']} prestada a {p['prestado']['a']} todo el rango")
            continue
        producen += 1
        if fuera:
            notas.append(f"{p['nombre']} prestada a {p['prestado']['a']} desde {p['prestado']['desde']}"
                         f" ({len(fuera)} de {len(dias)} días)")
    dueno = next((p for p in equipo if mismo_nombre(p["nombre"], asignado)), None)
    if dueno and not dueno["produce_pr"]:
        avisos.append(f"{asignado} (dueño del cronograma) no produce PR: su capacidad de desarrollo es 0")
    if dueno and dueno.get("prestado"):
        for h in plan["historias"]:
            for it in h.get("items", []):
                if it.get("estado", "propuesta") == "espera" or not it.get("ini"):
                    continue
                malos = [d for d in dias_habiles(it["ini"], it.get("fin") or it["ini"], set(festivos))
                         if prestado_en(dueno, d)]
                if malos:
                    avisos.append(f"{h['key']} «{it['titulo']}» cae el {malos[0]} y {asignado} está prestada"
                                  f" a {dueno['prestado']['a']} desde {dueno['prestado']['desde']}")
    if producen == 0:
        avisos.append("nadie del equipo produce PR en el rango de desarrollo: no comprometas fecha")
    return (f"equipo: {producen} de {len(equipo)} producen PR del {dias[0]} al {dias[-1]}"
            + (" · " + " · ".join(notas) if notas else ""))


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
    equipo = cargar_equipo(plan.get("equipo"), avisos)

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
            for campo in ("obs", "desc", "tipo", "modelo"):
                if it.get(campo):
                    x[campo] = it[campo]
            if x.get("modelo"):
                m = x["modelo"]
                if not isinstance(m, dict) or not isinstance(m.get("tablas"), list) or not all(
                        t.get("nombre") and isinstance(t.get("columnas"), list) for t in m["tablas"]):
                    falla(f"«modelo» inválido en {h['key']} «{it['titulo'][:50]}»: usa {{tablas:[{{nombre, tipo, columnas:[{{n, t, pk, fk, nulo}}]}}]}}")
                m.setdefault("aprobado", None)
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
    if equipo:   # sin «equipo», el CFG queda idéntico al de siempre
        cfg["equipo"] = equipo
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
    vagas = [it.get("titulo", "?")[:60] for h in plan["historias"] for it in h.get("items", [])
             if it.get("estado") != "descartada" and not (it.get("obs") or "").lstrip().startswith("Qué hace:")]
    if vagas:
        avisos.append(f"{len(vagas)} observaciones no empiezan con «Qué hace:» (el líder no entiende qué hará el dev; "
                      "la jerga de matriz va en obs_tecnica): " + "; ".join(vagas[:5]) + (" …" if len(vagas) > 5 else ""))
    p0 = ((exp.get("chequeos") or {}).get("p0") or {}).get("estado") if exp else None
    linea_equipo = capacidad_real(equipo, plan, festivos, asignado["nombre"], avisos) if equipo else ""
    print(f"ok {out} · {len(hus)} historias · propuesto {tot:g} h · pendiente de definición {pen:g} h"
          + (f" · marca «{alt}»" if marca or logo else " · marca neutra")
          + (f" · {compuestas} subtareas compuestas como instrucción" if compuestas else "")
          + (f"\n{linea_equipo}" if linea_equipo else "")
          + (f"\npaso 0: {p0} · refutaciones: {len(exp.get('refutacion') or [])} · cortes: {len(exp.get('cortes') or [])}"
             if p0 else "")
          + (f"\nexpediente: {exp_ruta} → tras publicar, cárgalo con ArtifactData set en expediente/actual"
             if exp_ruta else "")
          + "".join("\naviso: " + a for a in avisos))


if __name__ == "__main__":
    main(sys.argv)
