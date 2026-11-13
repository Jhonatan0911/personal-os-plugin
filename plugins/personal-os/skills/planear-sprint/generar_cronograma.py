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

Modo requerimiento multi-sprint (opcional): si el plan trae «sprints», la página abre en una vista general
(Gantt por persona, meta, escenarios) y cada sprint se ve aparte. Campos nuevos: «sprints», «meta»,
«escenarios»; en cada historia «sprint» y «keys»; en cada ítem «id», «responsable», «cierre», «depende» y
«comparte». Las fechas de los ítems las calcula este script (el primer escenario) y la página con el
escenario activo; las del plan se ignoran. Ejemplo: plan-multisprint-ejemplo.json. Detalle:
references/cronograma.md §6. Sin «sprints», todo funciona igual que antes.
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
ESTADOS_SPRINT = ("por_planear", "planeado", "en_curso", "en_revision", "hecho")
CIERRE_TIPOS = ("prueba_funcional_logica", "pruebas_en_dispositivos")   # revisión y pruebas: al final de su sprint
HORIZONTE_DIAS = 730   # el calendario multi-sprint busca hueco hasta dos años después del inicio
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


# ---------- Modo requerimiento multi-sprint ----------

def es_fecha(v):
    if not isinstance(v, str) or not FECHA.match(v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def clave_orden(k):
    """El mismo orden por clave que la página (cmpKey): proyecto y luego número."""
    partes = str(k).split("-")
    num = partes[1] if len(partes) > 1 else ""
    return (partes[0], int(num) if num.isdigit() else 0)


def cargar_multisprint(plan, avisos):
    """Valida y normaliza «sprints», «meta» y «escenarios». Devuelve None si el plan no es multi-sprint."""
    crudo = plan.get("sprints")
    if not crudo:
        sueltas = [h.get("key") for h in plan.get("historias") or [] if isinstance(h, dict) and h.get("sprint")]
        if sueltas:
            avisos.append(f"{len(sueltas)} historias traen «sprint» pero el plan no tiene «sprints»: se ignora "
                          f"({', '.join(map(str, sueltas[:5]))}{' …' if len(sueltas) > 5 else ''})")
        return None
    if not isinstance(crudo, list):
        falla("«sprints» debe ser una lista: [{\"id\": \"S01\", \"nombre\", \"orden\", \"estado\", \"responsable\"}]")
    asignado = (plan.get("asignado") or {}).get("nombre") or ""
    sprints, vistos = [], set()
    for i, s in enumerate(crudo):
        if not isinstance(s, dict) or not str(s.get("id") or "").strip():
            falla(f"el sprint #{i + 1} no trae «id»")
        sid = str(s["id"]).strip()
        if sid in vistos:
            falla(f"sprint repetido «{sid}»")
        vistos.add(sid)
        est = s.get("estado") or "planeado"
        if est not in ESTADOS_SPRINT:
            avisos.append(f"sprint {sid}: estado «{est}» no válido (usa {', '.join(ESTADOS_SPRINT)}); queda «planeado»")
            est = "planeado"
        try:
            orden = float(s.get("orden", i + 1))
        except (TypeError, ValueError):
            avisos.append(f"sprint {sid}: «orden» no es un número; uso su posición ({i + 1})")
            orden = float(i + 1)
        x = {"id": sid, "nombre": str(s.get("nombre") or ""), "orden": int(orden) if orden == int(orden) else orden,
             "estado": est, "responsable": str(s.get("responsable") or asignado).strip()}
        if s.get("inicio_min"):
            if es_fecha(s["inicio_min"]):
                x["inicio_min"] = s["inicio_min"]
            else:
                avisos.append(f"sprint {sid}: «inicio_min» no es una fecha AAAA-MM-DD; se ignora")
        if s.get("avance"):
            x["avance"] = str(s["avance"])
        if s.get("fases"):
            f = s["fases"]
            if isinstance(f, list) and all(isinstance(p, list) and len(p) == 4 and es_fecha(p[2]) and es_fecha(p[3])
                                           for p in f):
                x["fases"] = f
            else:
                avisos.append(f"sprint {sid}: «fases» debe ser [[id, nombre, inicio, fin], …]; se ignora")
        sprints.append(x)
    sprints.sort(key=lambda s: s["orden"])   # estable: en empate manda el orden del plan (igual que la página)
    ids = {s["id"] for s in sprints}

    meta = plan.get("meta") or {}
    if not isinstance(meta, dict):
        falla("«meta» debe ser un objeto {\"fin_desarrollo\", \"entrega\", \"texto\"}")
    meta = {k: v for k, v in meta.items() if k in ("fin_desarrollo", "entrega", "texto") and v}
    for k in ("fin_desarrollo", "entrega"):
        if k in meta and not es_fecha(meta[k]):
            falla(f"meta.{k} no es una fecha AAAA-MM-DD: {meta[k]}")

    escenarios, vistos = [], set()
    for i, e in enumerate(plan.get("escenarios") or []):
        if not isinstance(e, dict) or not str(e.get("id") or "").strip():
            avisos.append(f"el escenario #{i + 1} no trae «id»; se ignora")
            continue
        eid = str(e["id"]).strip()
        if eid in vistos:
            avisos.append(f"escenario repetido «{eid}»; se ignora el segundo")
            continue
        vistos.add(eid)
        asig = e.get("asignacion") or {}
        if not isinstance(asig, dict):
            avisos.append(f"escenario «{eid}»: «asignacion» debe ser {{\"S01\": \"Persona\"}}; se ignora")
            asig = {}
        malos = [k for k in asig if k not in ids]
        if malos:
            avisos.append(f"escenario «{eid}» asigna sprints que no existen: {', '.join(malos)}")
        x = {"id": eid, "nombre": str(e.get("nombre") or eid),
             "asignacion": {k: str(v).strip() for k, v in asig.items() if k in ids and str(v or "").strip()}}
        if e.get("desde"):
            if es_fecha(e["desde"]):
                x["desde"] = e["desde"]
            else:
                avisos.append(f"escenario «{eid}»: «desde» no es una fecha AAAA-MM-DD; se ignora")
        escenarios.append(x)

    sin, malos = [], []
    for h in plan.get("historias") or []:
        sp = h.get("sprint") if isinstance(h, dict) else None
        if not sp:
            sin.append(str(h.get("key")))
        elif sp not in ids:
            malos.append(f"{h.get('key')} → {sp}")
    if malos:
        avisos.append("historias con un sprint que no existe en «sprints» (no se programan): " + ", ".join(malos))
    if sin:
        avisos.append(f"{len(sin)} historias sin «sprint» en modo multi-sprint (no se programan): "
                      + ", ".join(sin[:8]) + (" …" if len(sin) > 8 else ""))
    return {"sprints": sprints, "meta": meta, "escenarios": escenarios}


def dias_rango(ini, fin):
    """Lunes a viernes entre dos fechas (los festivos se incluyen con capacidad 0, como en la página)."""
    d, e, out = date.fromisoformat(ini), date.fromisoformat(fin), []
    while d <= e:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def indice_desde(dias, s):
    """Índice del día o del primero posterior (diIn de la página)."""
    if not s:
        return -1
    for i, d in enumerate(dias):
        if d >= s:
            return i
    return len(dias) - 1


def planificar(ms, esc, reasig, ctx):
    """Calendario del requerimiento: el mismo algoritmo que planificar() de la página.

    Por persona, sprints en su orden (los «hecho» no aportan); dentro de cada sprint, primero el desarrollo
    y al final la revisión y las pruebas (cierre); luego las dependencias («depende»). Cada día se llena hasta
    la capacidad sin pasarla; lo que no cabe pasa al día siguiente. Lo «espera» no lleva fecha.
    """
    main_, rd, fd = ctx["main"], ctx["rd"], ctx["fd"]
    gente = list(ctx["gente"])
    for v in reasig.values():
        if not any(mismo_nombre(g, v) for g in gente):
            gente.append(v)

    def cn(n):
        n = str(n or "") or main_
        if mismo_nombre(n, main_):
            return main_
        return next((g for g in gente if mismo_nombre(g, n)), n)

    def resp_sprint(sid):
        s = ctx["smap"].get(sid)
        if not s:
            return main_
        return reasig.get(sid) or esc.get("asignacion", {}).get(sid) or s.get("responsable") or main_

    base = [main_] + [s.get("responsable") or main_ for s in ms["sprints"]]

    def desde_de(p):
        return esc.get("desde") if esc.get("desde") and not any(mismo_nombre(b, p) for b in base) else None

    i0 = max(0, indice_desde(rd, ctx["inicio"]))

    def mk(p):
        ds = desde_de(p)
        return {"cap": [0.0 if (i < i0 or (ds and d < ds)) else ctx["jor_de"](p, d) for i, d in enumerate(rd)], "cur": i0}

    def quien(s, it):
        r = it.get("resp")
        return cn(r["nombre"] if isinstance(r, dict) and r.get("nombre") else resp_sprint(s["id"]))

    lista = []
    for s in ms["sprints"]:
        if s["estado"] == "hecho":
            continue
        ks = [k for k in ctx["keys"] if ctx["hmap"][k].get("sprint") == s["id"]]
        for cierre in (False, True):
            for k in ks:
                for it in ctx["hmap"][k]["items"]:
                    if it["estado"] in ("espera", "descartada") or es_cierre(it) != cierre:
                        continue
                    lista.append({"k": k, "it": it, "s": s, "p": quien(s, it)})
    pos = {}
    for i, x in enumerate(lista):
        if x["it"].get("id") and x["it"]["id"] not in pos:
            pos[x["it"]["id"]] = i
    dep = [[pos[d] for d in (x["it"].get("depende") or []) if d in pos and pos[d] != i] for i, x in enumerate(lista)]
    orden = list(range(len(lista)))
    if any(dep):
        hecho, orden = [False] * len(lista), []
        while len(orden) < len(lista):
            pick = next((i for i in range(len(lista)) if not hecho[i] and all(hecho[j] for j in dep[i])), -1)
            if pick < 0:
                pick = hecho.index(False)   # ciclo: se rompe en el orden del plan
            hecho[pick] = True
            orden.append(pick)
    cals, res = {}, [None] * len(lista)
    for i in orden:
        x = lista[i]
        if x["p"] not in cals:
            cals[x["p"]] = mk(x["p"])
        c = cals[x["p"]]
        e = c["cur"]
        if x["s"].get("inicio_min"):
            e = max(e, indice_desde(rd, x["s"]["inicio_min"]))
        for j in dep[i]:
            if res[j] and res[j]["b"] is not None:
                e = max(e, res[j]["b"])
        hh = float(x["it"].get("horas") or 0)
        r, a, b, k, antes = hh, None, None, e, 0.0
        while k < len(rd) and c["cap"][k] <= 1e-9:
            k += 1
        if r <= 1e-9:
            if k < len(rd):
                a = b = k
        else:
            while r > 1e-9 and k < len(rd):
                t = min(r, c["cap"][k])
                if t > 1e-9:
                    if a is None:
                        a = k
                    b = k
                    c["cap"][k] -= t
                    r -= t
                    if rd[k] <= fd:
                        antes += t
                if r > 1e-9:
                    k += 1
        if b is not None:
            c["cur"] = max(c["cur"], b)
        res[i] = {"k": x["k"], "it": x["it"], "s": x["s"]["id"], "p": x["p"], "h": hh, "a": a, "b": b,
                  "ini": rd[a] if a is not None else None, "fin": rd[b] if b is not None else None,
                  "antes": antes, "sobra": r if r > 1e-9 else 0.0}
    per, spr = {}, {}

    def P(p):
        return per.setdefault(p, {"p": p, "h": 0.0, "antes": 0.0, "espera": 0.0, "fin": None, "sprints": [], "sobra": 0.0})

    def S(sid):
        return spr.setdefault(sid, {"h": 0.0, "espera": 0.0, "por": {}})

    for r in res:
        q = P(r["p"])
        q["h"] += r["h"]
        q["antes"] += r["antes"]
        q["sobra"] += r["sobra"]
        if r["fin"] and (not q["fin"] or r["fin"] > q["fin"]):
            q["fin"] = r["fin"]
        if r["s"] not in q["sprints"]:
            q["sprints"].append(r["s"])
        z = S(r["s"])
        z["h"] += r["h"]
        b = z["por"].setdefault(r["p"], {"ini": None, "fin": None, "h": 0.0})
        b["h"] += r["h"]
        if r["ini"] and (not b["ini"] or r["ini"] < b["ini"]):
            b["ini"] = r["ini"]
        if r["fin"] and (not b["fin"] or r["fin"] > b["fin"]):
            b["fin"] = r["fin"]
    for s in ms["sprints"]:
        if s["estado"] == "hecho":
            continue
        for k in ctx["keys"]:
            if ctx["hmap"][k].get("sprint") != s["id"]:
                continue
            for it in ctx["hmap"][k]["items"]:
                if it["estado"] != "espera":
                    continue
                q = P(quien(s, it))
                q["espera"] += float(it.get("horas") or 0)
                if s["id"] not in q["sprints"]:
                    q["sprints"].append(s["id"])
                S(s["id"])["espera"] += float(it.get("horas") or 0)
    for q in per.values():
        c = mk(q["p"])
        q["cap"] = sum(c["cap"][i] for i, d in enumerate(rd) if d <= fd)
        q["despues"] = max(0.0, q["h"] - q["antes"])
    return {"res": res, "per": per, "spr": spr}


def es_cierre(it):
    c = it.get("cierre")
    return c is True or (c is not False and it.get("tipo") in CIERRE_TIPOS)


def fmt_h(n):
    return f"{round(n * 10) / 10:g}".replace(".", ",")


def resumen_multisprint(ms, ctx, avisos):
    """Texto del resumen por sprint y por persona (primer escenario) y una línea por cada otro escenario."""
    fd, entrega = ctx["fd"], ctx["entrega"]
    escs = ms["escenarios"] or [{"id": "plan", "nombre": "Plan base", "asignacion": {}}]
    lineas = []
    for n, esc in enumerate(escs):
        pl = planificar(ms, esc, {}, ctx)
        pers = sorted(pl["per"].values(), key=lambda q: (q["p"] != ctx["main"], q["p"]))
        fin = max((q["fin"] for q in pers if q["fin"]), default=None)
        desp = sum(q["despues"] for q in pers)
        estado = (f"atraso: {fmt_h(desp)} h no caben antes del {fd}" if desp > 1e-9 else f"cabe antes del {fd}")
        if n == 0:
            lineas.append(f"modo multi-sprint · {len(ms['sprints'])} sprints · escenario «{esc['nombre']}» "
                          f"(el que abre la página)")
            for s in ms["sprints"]:
                z = pl["spr"].get(s["id"], {"h": 0.0, "espera": 0.0, "por": {}})
                partes = [f"{p} {fmt_h(b['h'])} h {b['ini'] or '—'}→{b['fin'] or '—'}" for p, b in z["por"].items()]
                txt = " · ".join(partes) if partes else ("sin horas pendientes" if s["estado"] == "hecho" else "sin horas propuestas")
                lineas.append(f"  {s['id']} {s['nombre']} · {s['estado']} · {txt}"
                              + (f" · en espera {fmt_h(z['espera'])} h" if z["espera"] else ""))
                if s["estado"] == "hecho" and any(it["estado"] != "espera" for k in ctx["keys"]
                                                  if ctx["hmap"][k].get("sprint") == s["id"]
                                                  for it in ctx["hmap"][k]["items"]):
                    avisos.append(f"el sprint {s['id']} está «hecho» y trae subtareas propuestas: no se programan")
            for q in pers:
                at = q["despues"] > 1e-9
                lineas.append(f"  {q['p']}: {fmt_h(q['h'])} h propuestas · {fmt_h(q['espera'])} h en espera · "
                              f"capacidad hasta {fd}: {fmt_h(q['cap'])} h · "
                              + (f"ATRASO {fmt_h(q['despues'])} h no caben" if at else f"holgura {fmt_h(q['cap'] - q['h'])} h")
                              + f" · fin estimado {q['fin'] or '—'}")
            lineas.append(f"meta: fin de desarrollo {fd}" + (f" · entrega {entrega}" if entrega and entrega != fd else "")
                          + f" → fin estimado {fin or '—'} · {estado}")
            if len(escs) > 1:
                lineas.append("otros escenarios:")
        else:
            lineas.append(f"  «{esc['nombre']}»: fin estimado {fin or '—'} · {estado}")
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

    avisos = []
    ms = cargar_multisprint(plan, avisos)
    if ms:   # con varios sprints, el rango y las fases salen de la meta si el plan no los trae
        meta_ = ms["meta"]
        plan.setdefault("fin_desarrollo", meta_.get("fin_desarrollo"))
        if not plan.get("fin_desarrollo"):
            falla("modo multi-sprint: falta «meta.fin_desarrollo» (o «fin_desarrollo»)")
        meta_.setdefault("fin_desarrollo", plan["fin_desarrollo"])
        plan.setdefault("fin", meta_.get("entrega") or plan["fin_desarrollo"])
        if plan.get("inicio") and not plan.get("fases"):
            fases = [["dev", "Desarrollo", plan["inicio"], plan["fin_desarrollo"]]]
            if plan["fin"] > plan["fin_desarrollo"]:
                sig = date.fromisoformat(plan["fin_desarrollo"]) + timedelta(days=1)
                fases.append(["pru", "Pruebas y entrega", sig.isoformat(), plan["fin"]])
            plan["fases"] = fases
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

    exp_ruta, exp = (cargar_expediente(plan["expediente"], base_plan, avisos) if plan.get("expediente")
                     else (None, {}))
    cas = criterios_del_expediente(exp)
    compuestas = 0
    equipo = cargar_equipo(plan.get("equipo"), avisos)

    hus, ids_vistos, con_fecha = [], set(), 0
    cuentas_ = plan.get("cuentas", {})
    for h in plan["historias"]:
        if not h.get("key") or not h.get("t"):
            falla("cada historia necesita «key» y «t» (título)")
        items = []
        for n_it, it in enumerate(h.get("items", []), 1):
            x = {"titulo": it["titulo"], "horas": it.get("horas"), "ini": it.get("ini"), "fin": it.get("fin"),
                 "estado": it.get("estado", "propuesta"), "autor": "claude"}
            if x["estado"] not in ("propuesta", "espera"):
                falla(f"estado inválido «{x['estado']}» en {h['key']} (usa propuesta o espera)")
            for campo in ("obs", "desc", "tipo", "modelo"):
                if it.get(campo):
                    x[campo] = it[campo]
            # Campos opcionales (sobre todo del modo multi-sprint); sin ellos el ítem queda como siempre
            if it.get("id") or ms:
                x["id"] = str(it.get("id") or f"{h['key']}.{n_it}")
                if x["id"] in ids_vistos:
                    falla(f"id de subtarea repetido «{x['id']}» (en {h['key']})")
                ids_vistos.add(x["id"])
            if it.get("responsable"):
                nom = str(it["responsable"]).strip()
                x["resp"] = {"nombre": nom, "accountId": cuentas_.get(nom)}
            if isinstance(it.get("cierre"), bool):
                x["cierre"] = it["cierre"]
            if it.get("depende"):
                dep = it["depende"] if isinstance(it["depende"], list) else [it["depende"]]
                x["depende"] = [str(d) for d in dep]
            if it.get("comparte"):
                x["comparte"] = str(it["comparte"])
            if ms and (it.get("ini") or it.get("fin")):
                con_fecha += 1
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
        hu = {"key": h["key"], "t": h["t"], "nota": h.get("nota", ""), "esc": h.get("esc", []),
              **({"coment": h["coment"]} if h.get("coment") else {}),
              **({"ficticia": True} if h.get("ficticia") else {}), "items": items}
        if ms:
            if h.get("sprint"):
                hu["sprint"] = str(h["sprint"])
            if h.get("keys"):
                if isinstance(h["keys"], list) and all(isinstance(k, str) for k in h["keys"]):
                    hu["keys"] = h["keys"]
                else:
                    avisos.append(f"{h['key']}: «keys» debe ser una lista de claves de Jira; se ignora")
        hus.append(hu)
    if ms:
        todos = {it["id"] for hu in hus for it in hu["items"]}
        rotas = [f"{it['id']} → {d}" for hu in hus for it in hu["items"] for d in it.get("depende", []) if d not in todos]
        if rotas:
            avisos.append("«depende» nombra subtareas que no existen (se ignora): " + ", ".join(rotas[:6])
                          + (" …" if len(rotas) > 6 else ""))
        if con_fecha:
            avisos.append(f"modo multi-sprint: las fechas de lo que se programa las calcula el generador "
                          f"({con_fecha} subtareas del plan traían fecha propia)")

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
    texto_ms = ""
    if ms:       # sin «sprints», el CFG queda idéntico al de siempre
        cfg["sprints"], cfg["meta"], cfg["escenarios"] = ms["sprints"], ms["meta"], ms["escenarios"]
        fest_set = set(festivos)

        def jor_de(p, d):   # jorDe de la página: festivo 0, viernes y lunes-jueves, sin PR o prestado 0
            ficha = next((q for q in equipo if mismo_nombre(q["nombre"], p)), None)
            if ficha and (not ficha["produce_pr"] or prestado_en(ficha, d)):
                return 0.0
            if d in fest_set:
                return 0.0
            return float(cap[1]) if date.fromisoformat(d).weekday() == 4 else float(cap[0])

        keys = sorted((hu["key"] for hu in hus), key=clave_orden)
        hmap = {hu["key"]: hu for hu in hus}
        gente = []
        for n in ([asignado["nombre"]] + list(personas) + [s["responsable"] for s in ms["sprints"]]
                  + [v for e in ms["escenarios"] for v in e["asignacion"].values()]
                  + [it["resp"]["nombre"] for k in keys for it in hmap[k]["items"] if it.get("resp")]):
            n = str(n or "").strip()
            if n and not any(mismo_nombre(g, n) for g in gente):
                gente.append(n)
        fin_h = (date.fromisoformat(plan["inicio"]) + timedelta(days=HORIZONTE_DIAS)).isoformat()
        ctx = {"main": asignado["nombre"], "rd": dias_rango(plan["inicio"], fin_h), "fd": ms["meta"]["fin_desarrollo"],
               "entrega": ms["meta"].get("entrega"), "inicio": plan["inicio"], "gente": gente,
               "smap": {s["id"]: s for s in ms["sprints"]}, "keys": keys, "hmap": hmap, "jor_de": jor_de}
        esc0 = ms["escenarios"][0] if ms["escenarios"] else {"id": "plan", "nombre": "Plan base", "asignacion": {}}
        for r in planificar(ms, esc0, {}, ctx)["res"]:   # las fechas que abre la página: las del primer escenario
            r["it"]["ini"], r["it"]["fin"] = r["ini"], r["fin"]
        texto_ms = resumen_multisprint(ms, ctx, avisos)
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
          + (f"\n{texto_ms}" if texto_ms else "")
          + (f"\npaso 0: {p0} · refutaciones: {len(exp.get('refutacion') or [])} · cortes: {len(exp.get('cortes') or [])}"
             if p0 else "")
          + (f"\nexpediente: {exp_ruta} → tras publicar, cárgalo con ArtifactData set en expediente/actual"
             if exp_ruta else "")
          + "".join("\naviso: " + a for a in avisos))


if __name__ == "__main__":
    main(sys.argv)
