#!/usr/bin/env python3
"""Genera el cronograma interactivo de un sprint a partir de un plan.json.

Uso:
    python generar_cronograma.py <plan.json> <salida.html>

La plantilla (cronograma-plantilla.html) y el bloque del analista (analista-bloque.html) se leen de la
misma carpeta de este script. Formato completo de ejemplo: plan-ejemplo.json (datos ficticios).

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
  "fases_replan": [],                                     # opcional: fases replaneadas (se pintan en rojo)
  "texto_nueva": "Nuevo: entra solo si el cliente lo confirma.",
  "descripcion_subtarea": "Subtarea del sprint 12 (PROY-140).",
  "personas": ["Ana", "Luis"],                            # opcional: responsables posibles por subtarea
  "cuentas": {"Luis": "<accountId>"},                     # opcional: accountId conocidos
  "capacidad": [7.5, 7],                                  # h de desarrollo lunes-jueves y viernes (matriz)
  "epica": "PROY-140",                                    # para que el analista busque hijas nuevas
  "correos_busqueda": ["Reportes Cliente A"],             # términos para buscar correos del tema
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
import html
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))


def falla(msg):
    sys.exit("error: " + msg)


def js(v):
    # JSON seguro dentro de <script>: nada de «</» que cierre la etiqueta antes de tiempo
    return (json.dumps(v, ensure_ascii=False)
            .replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def leer(nombre):
    with open(os.path.join(AQUI, nombre), encoding="utf-8") as f:
        return f.read()


def main(argv):
    if len(argv) != 3:
        falla("uso: python generar_cronograma.py <plan.json> <salida.html>")
    plan_path, out = argv[1], argv[2]
    with open(plan_path, encoding="utf-8") as f:
        plan = json.load(f)

    for campo in ("titulo", "proyecto", "inicio", "fin", "fin_desarrollo", "fases", "historias"):
        if not plan.get(campo):
            falla(f"falta «{campo}» en {plan_path}")
    asignado = plan.get("asignado") or {}
    if not asignado.get("nombre"):
        falla("falta «asignado.nombre» (dueño del cronograma)")
    cap = plan.get("capacidad", [7.5, 7])
    if not (isinstance(cap, list) and len(cap) == 2):
        falla("«capacidad» debe ser [horas lunes-jueves, horas viernes]")

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
        "festivos": plan.get("festivos", []),
        "fases": plan["fases"], "fases_replan": plan.get("fases_replan", []),
        "texto_nueva": plan.get("texto_nueva", "Nuevo: entra solo si el cliente lo confirma."),
        "descripcion_subtarea": plan.get("descripcion_subtarea", "Subtarea planeada en el cronograma del sprint."),
        "personas": plan.get("personas", []),
        "cuentas": plan.get("cuentas", {}),
        "capacidad": [float(cap[0]), float(cap[1])],
        "historias": hus,
    }
    meta = {"titulo": plan["titulo"], "keys": [h["key"] for h in plan["historias"] if not h.get("ficticia")],
            "epica": plan.get("epica"), "correos": plan.get("correos_busqueda") or [plan["titulo"]],
            "cloud_id": cfg["jira"]["cloud_id"], "servidor_jira": cfg["jira"]["servidor_mcp"],
            "servidor_correo": correo.get("servidor_mcp") or "", "lider": cfg["lider"]}

    t = leer("cronograma-plantilla.html").rstrip() + "\n" + leer("analista-bloque.html")
    rep = {
        "__TITULO_HTML__": html.escape(plan["titulo"]),
        "__SUBTITULO_HTML__": html.escape(plan.get("subtitulo", "")),
        "__QUIEN_DEFINE_HTML__": html.escape(plan.get("quien_define", "el cliente")),
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
        avisos.append("sin jira.cloud_id: la página no consultará ni exportará a Jira")
    if not cfg["jira"]["sitio"]:
        avisos.append("sin jira.sitio: no habrá enlaces «Abrir en Jira»")
    print(f"ok {out} · {len(hus)} historias · propuesto {tot:g} h · pendiente de definición {pen:g} h"
          + ("".join("\naviso: " + a for a in avisos)))


if __name__ == "__main__":
    main(sys.argv)
