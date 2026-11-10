"""Valida los expedientes v2 y deja el JSON de carga para la base de la Worklist del líder.

Lee <stateDir>/requerimientos/<slug>/expediente.json, valida contra el esquema v2
(skills/planear-sprint/references/expediente.md) y el contrato de niveles (references/niveles.md),
calcula la completitud solo con los pasos del nivel del caso y escribe en la carpeta de carga
(por defecto <stateDir>/worklist/carga/):
  expediente-<slug>.json   el expediente completo   -> colección `expediente`, doc <slug>
  req-<slug>.json          el índice de la lista     -> colección `req`, doc <slug>
  cola-actual.json         la cola de revisión       -> colección `cola`, doc actual (si sync-jira.py la dejó)
  lote.json                las escrituras para ArtifactData batch (máx. 50 por lote)
  resumen.json             nivel, completitud, compromisos, cortes y avisos por expediente

La colección `marcas` (chequeos, nivel, estado de pendientes y notas que el líder edita en la página)
NUNCA se escribe desde aquí: es del líder.

Uso:
  python -I cargar.py [--estado <stateDir>] [--fuentes <fuentes.yaml>] [--salida <carpeta>]
                      [--versiones versiones.json]
    versiones.json = {"expediente/<slug>": 3, "req/<slug>": 3, "cola/actual": 2} con la `version` leída de la
    base (ArtifactData list). Sin él, el lote sirve solo para crear documentos nuevos.
Sale con código 1 si algún expediente no valida (y no lo incluye en el lote).
"""
import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun  # noqa: E402

MAX_DOC = 240 * 1024  # la base admite 256 KiB por documento
TIPOS = {"requerimiento", "bug"}
EST_P0 = {"aceptado", "parcial", "por_entender", "pendiente"}
EST_PASO = {"pendiente", "en_curso", "hecho", "no_aplica"}
EST_PEND = {"abierto", "resuelto"}
EST_CORTE = {"pendiente", "ok", "desviado"}
TIPOS_CORTE = {"desarrollo", "revision_lider", "tercero", "validacion", "acta"}
EST_PRUEBA = {"pendiente", "ok", "falla"}
EST_REFUTA = {"propuesta", "aceptada", "descartada"}
VEREDICTOS = {"cumple", "parcial", "no"}
EST_COMPROMISO = {"vigente", "cumplida", "incumplida", "reemplazada"}
EJES = ("transaccionalidad", "dinero", "norma", "usuarios", "reversibilidad")
LISTAS = ("jira", "modulos", "refutacion", "calidad", "adr", "proyectos", "historias", "subtareas", "cortes",
          "pendientes", "decisiones", "riesgos", "hallazgos_codigo", "fuentes", "historial", "revisiones_pr",
          "matriz_pruebas", "compromisos")
DICTS = ("cabecera", "impacto", "chequeos", "documentacion", "retro", "ficha_corta")
FICHA = (("que", "Qué se pide"), ("para_cuando", "Para cuándo"), ("quien_pidio", "Quién lo pidió"),
         ("evidencia_cierre", "Evidencia de cierre"))
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,80}$")
NUM_SOSPECHOSO = re.compile(r"(?<![\w-])\d{7,10}(?![\w-])")


def validar(E, slug, F):
    """Devuelve (errores, avisos, nivel, pasos)."""
    err, avisos = [], []
    if E.get("esquema") not in ("v2", 2, "2"):
        err.append("esquema: debe ser 2 (o 'v2')")
    if E.get("id") != slug or not SLUG.match(slug):
        err.append(f"id: debe ser igual a la carpeta y en minúsculas con guiones ({slug})")
    if E.get("tipo") not in TIPOS:
        err.append("tipo: requerimiento|bug")
    if not str(E.get("titulo") or "").strip():
        err.append("titulo: vacío")
    for k in LISTAS:
        if E.get(k) is not None and not isinstance(E[k], list):
            err.append(f"{k}: se esperaba una lista")
    for k in DICTS:
        if E.get(k) is not None and not isinstance(E[k], dict):
            err.append(f"{k}: se esperaba un objeto")
    if err:
        return err, avisos, None, {}

    # Nivel del caso
    decl = E.get("nivel")
    if decl not in (None, ""):
        if not F["niveles_declarados"]:
            avisos.append(f"nivel «{decl}»: fuentes.yaml no tiene flujo.niveles; el caso recorre el flujo completo")
        elif str(decl) not in F["niveles_declarados"]:
            err.append(f"nivel «{decl}»: no existe en flujo.niveles ({', '.join(F['niveles_declarados'])})")
        elif not F["activos"]:
            avisos.append(f"nivel «{decl}» declarado, pero flujo.niveles_activos es false: flujo completo")
    if err:
        return err, avisos, None, {}
    nivel, pasos = comun.nivel_efectivo(E, F)
    if pasos.get("p0") == "corto":
        fc = E.get("ficha_corta")
        if not isinstance(fc, dict):
            err.append(f"ficha_corta: obligatoria en el nivel {nivel} (su paso 0 es corto)")
        else:
            if not str(fc.get("que") or "").strip():
                err.append("ficha_corta.que: vacío (qué se pide)")
            for k, nombre in FICHA[1:]:
                if not str(fc.get(k) or "").strip():
                    avisos.append(f"ficha_corta.{k}: falta ({nombre})")
            if fc.get("para_cuando") and not comun.FECHA.match(str(fc["para_cuando"])):
                avisos.append("ficha_corta.para_cuando: mejor AAAA-MM-DD para que el vigía la persiga")

    c = E.get("cabecera") or {}
    for k in ("descripcion_corta", "cliente", "solicitante", "motivo", "para_que", "expectativas"):
        if k in c and c[k] is not None and not isinstance(c[k], str):
            err.append(f"cabecera.{k}: texto")
    if c.get("pedido_por_gerencia") not in (True, False, None):
        err.append("cabecera.pedido_por_gerencia: true|false|null")
    if c.get("prioridad_wsjf") is not None and not isinstance(c["prioridad_wsjf"], (int, float)):
        err.append("cabecera.prioridad_wsjf: número o null")
    if c.get("fecha_compromiso") and not comun.FECHA.match(str(c["fecha_compromiso"])):
        err.append("cabecera.fecha_compromiso: AAAA-MM-DD o null")
    if not isinstance(c.get("responsables", []), list):
        err.append("cabecera.responsables: lista")

    pa = E.get("paso_actual")
    if pa is not None and (not isinstance(pa, int) or isinstance(pa, bool) or not 0 <= pa <= 6):
        err.append("paso_actual: 0-6 o null")
    elif pa is not None and f"p{pa}" not in pasos:
        avisos.append(f"paso_actual {pa}: ese paso no aplica al nivel {nivel}")

    ch = E.get("chequeos") or {}
    for i in range(7):
        k = f"p{i}"
        p = ch.get(k)
        if k not in pasos:
            if isinstance(p, dict) and p.get("estado") not in (None, "", "pendiente", "no_aplica"):
                avisos.append(f"chequeos.{k}: el paso no aplica al nivel {nivel}; se carga como no_aplica")
            continue
        if not isinstance(p, dict):
            err.append(f"chequeos.{k}: falta (el paso aplica al nivel {nivel or 'completo'})")
            continue
        validos = EST_P0 if i == 0 else EST_PASO
        if p.get("estado") not in validos:
            err.append(f"chequeos.{k}.estado: {sorted(validos)}")

    cm = (E.get("impacto") or {}).get("criticidad_modulo") or {}
    for eje in EJES:
        v = cm.get(eje)
        if v is not None and v != 0 and (not isinstance(v, int) or not 1 <= v <= 5):
            err.append(f"impacto.criticidad_modulo.{eje}: 1-5 o null")
        if v == 0:
            avisos.append(f"impacto.criticidad_modulo.{eje}: 0 se lee como sin evaluar (usa null)")
    for m in (E.get("impacto") or {}).get("modos_falla", []) or []:
        if not m.get("modo"):
            err.append("impacto.modos_falla: cada modo necesita 'modo'")
    ids = set()
    for p in E.get("pendientes") or []:
        if not p.get("id"):
            err.append("pendientes: cada uno necesita id")
        elif p["id"] in ids:
            err.append(f"pendientes: id repetido {p['id']}")
        ids.add(p.get("id"))
        if p.get("estado") not in EST_PEND:
            err.append(f"pendientes.{p.get('id')}.estado: abierto|resuelto")
        if not isinstance(p.get("bloquea", []), list):
            err.append(f"pendientes.{p.get('id')}.bloquea: lista de CA")
    for r in E.get("refutacion") or []:
        if r.get("estado") not in EST_REFUTA:
            err.append("refutacion.estado: propuesta|aceptada|descartada")
        if r.get("refuta") and not r.get("alternativa"):
            err.append("refutacion: sin alternativa no hay refutación")
    for k in E.get("cortes") or []:
        if k.get("estado") not in EST_CORTE:
            err.append("cortes.estado: pendiente|ok|desviado")
        if k.get("tipo") and k["tipo"] not in TIPOS_CORTE:
            err.append(f"cortes.tipo: {'|'.join(sorted(TIPOS_CORTE))}")
        if k.get("fecha") and not comun.FECHA.match(str(k["fecha"])):
            err.append("cortes.fecha: AAAA-MM-DD")
        if k.get("estado") == "pendiente" and not k.get("responsable"):
            avisos.append(f"corte {k.get('fecha') or '(sin fecha)'}: sin responsable")
    for m in E.get("matriz_pruebas") or []:
        if m.get("estado") not in EST_PRUEBA:
            err.append("matriz_pruebas.estado: pendiente|ok|falla")
    for rv in E.get("revisiones_pr") or []:
        for ca, v in (rv.get("veredicto_por_ca") or {}).items():
            if v not in VEREDICTOS:
                err.append(f"revisiones_pr.veredicto_por_ca.{ca}: cumple|parcial|no")
    for h in E.get("historias") or []:
        for ca in h.get("criterios", []) or []:
            if not isinstance(ca, dict) or not ca.get("id"):
                err.append("historias.criterios: objetos con id CA-n")
                break
    for s in E.get("subtareas") or []:
        if not s.get("titulo"):
            err.append("subtareas: cada una necesita titulo")
            break
    for cp in E.get("compromisos") or []:
        if cp.get("estado") not in EST_COMPROMISO:
            err.append(f"compromisos.{cp.get('id')}.estado: {sorted(EST_COMPROMISO)}")
        if not comun.FECHA.match(str(cp.get("fecha") or "")):
            err.append(f"compromisos.{cp.get('id')}.fecha: AAAA-MM-DD")
    if E.get("hijos") is not None and not isinstance(E.get("hijos"), list):
        err.append("hijos: lista de slugs")
    return err, avisos, nivel, pasos


def normalizar(E, nivel, pasos):
    """Copia con valores por defecto y los pasos que no aplican marcados no_aplica."""
    N = comun.clonar(E)
    for k in LISTAS:
        N[k] = N.get(k) or []
    for k in ("cabecera", "documentacion", "retro"):
        N[k] = N.get(k) or {}
    imp = N.get("impacto") or {}
    imp["criticidad_modulo"] = {k: (v or None) for k, v in (imp.get("criticidad_modulo") or {}).items()}
    imp["modos_falla"] = imp.get("modos_falla") or []
    N["impacto"] = imp
    ch = N.get("chequeos") or {}
    for i in range(7):
        k = f"p{i}"
        if k not in pasos:
            ch[k] = {"estado": "no_aplica", "por_nivel": True, "nota": (ch.get(k) or {}).get("nota", "")}
        else:
            ch[k] = ch.get(k) or {"estado": "pendiente"}
    N["chequeos"] = ch
    if nivel:
        N["nivel"] = nivel
    return N


def _ficha(E, k):
    return bool(str((E.get("ficha_corta") or {}).get(k) or "").strip())


# (paso, variante, nombre, prueba). variante None = cualquier variante del paso; paso None = siempre.
# Con el flujo completo suman los 24 chequeos de siempre.
CHEQUEOS = [
    ("p0", "completo", "Descripción corta", lambda E: bool(E["cabecera"].get("descripcion_corta"))),
    ("p0", "completo", "Cliente", lambda E: bool(E["cabecera"].get("cliente"))),
    ("p0", "completo", "Quién lo pidió", lambda E: bool(E["cabecera"].get("solicitante"))),
    ("p0", "completo", "Por qué lo pidió", lambda E: bool(E["cabecera"].get("motivo"))),
    ("p0", "completo", "Para qué sirve", lambda E: bool(E["cabecera"].get("para_que"))),
    ("p0", "completo", "Importancia y expectativas",
     lambda E: bool(E["cabecera"].get("importancia") or E["cabecera"].get("expectativas"))),
    ("p0", "completo", "¿Lo pidió gerencia?", lambda E: E["cabecera"].get("pedido_por_gerencia") is not None),
    ("p0", "completo", "Prioridad (WSJF)", lambda E: E["cabecera"].get("prioridad_wsjf") is not None),
    ("p0", "completo", "Fecha de compromiso", lambda E: bool(E["cabecera"].get("fecha_compromiso"))),
    ("p0", "corto", "Ficha corta: qué se pide", lambda E: _ficha(E, "que")),
    ("p0", "corto", "Ficha corta: para cuándo", lambda E: _ficha(E, "para_cuando")),
    ("p0", "corto", "Ficha corta: quién lo pidió", lambda E: _ficha(E, "quien_pidio")),
    ("p0", "corto", "Ficha corta: evidencia de cierre", lambda E: _ficha(E, "evidencia_cierre")),
    ("p0", None, "Responsables", lambda E: bool(E["cabecera"].get("responsables"))),
    (None, None, "Paso actual", lambda E: E.get("paso_actual") is not None),
    ("p0", None, "Chequeo del paso 0", lambda E: E["chequeos"]["p0"].get("estado") != "pendiente"),
    ("p1", "completo", "Criticidad en 5 ejes", lambda E: all(E["impacto"]["criticidad_modulo"].get(k) for k in EJES)),
    ("p1", "completo", "Peso en la operación", lambda E: bool(E["impacto"].get("peso_operacion"))),
    ("p1", "completo", "Modos de falla", lambda E: bool(E["impacto"].get("modos_falla"))),
    ("p1", "corto", "Módulo ubicado en el mapa de criticidad", lambda E: bool(E.get("modulos"))),
    ("p0", "completo", "Historias", lambda E: bool(E.get("historias"))),
    ("p0", "completo", "Criterios CA-n", lambda E: any(h.get("criterios") for h in E.get("historias", []))),
    ("p3", "completo", "Subtareas", lambda E: bool(E.get("subtareas"))),
    ("p3", "completo", "Subtareas como instrucción",
     lambda E: bool(E.get("subtareas")) and all(s.get("que_hacer") for s in E["subtareas"])),
    ("p2", "completo", "Escenarios de calidad", lambda E: bool(E.get("calidad"))),
    ("p2", "completo", "Decisiones de arquitectura (ADR)", lambda E: bool(E.get("adr"))),
    ("p2", "completo", "Proyectos y ramas", lambda E: bool(E.get("proyectos"))),
    ("p3", "completo", "Cortes de seguimiento", lambda E: bool(E.get("cortes"))),
    ("p6", "completo", "Documentación", lambda E: any(E["documentacion"].values())),
]


def completitud(E, pasos):
    aplican = [(n, f) for paso, var, n, f in CHEQUEOS
               if paso is None or (paso in pasos and (var is None or pasos[paso] == var))]
    falta = [n for n, f in aplican if not f(E)]
    pct = round(100 * (len(aplican) - len(falta)) / len(aplican)) if aplican else 100
    return pct, falta


def criticidad_max(E):
    vals = [v for v in E["impacto"]["criticidad_modulo"].values() if isinstance(v, int)]
    return max(vals) if vals else None


def indice(E, pct, falta, por_nivel):
    c = E["cabecera"]
    abiertos = [p["id"] for p in E["pendientes"] if p["estado"] == "abierto"]
    fc = E.get("ficha_corta") or {}
    cortes_p = sorted((k for k in E["cortes"] if k.get("estado") == "pendiente"), key=lambda k: str(k.get("fecha") or "9999"))
    pa = E.get("paso_actual")
    return {
        "titulo": E["titulo"], "tipo": E["tipo"], "nivel": E.get("nivel"), "paso_actual": pa,
        "chequeo_paso": (E["chequeos"].get(f"p{pa}") or {}).get("estado") if pa is not None else None,
        "modulos": E["modulos"], "cliente": c.get("cliente", "") or "", "jira": E["jira"][:6],
        "descripcion_corta": (c.get("descripcion_corta") or fc.get("que") or "")[:400],
        "responsables": c.get("responsables", []),
        "fecha_compromiso": c.get("fecha_compromiso") or (fc.get("para_cuando") if comun.FECHA.match(str(fc.get("para_cuando") or "")) else None),
        "ficha_corta": {k: fc.get(k) for k in ("que", "para_cuando")} if fc else None,
        "criticidad_max": criticidad_max(E),
        "dudas_abiertas": len(abiertos), "pendientes_abiertos_ids": abiertos,
        "subtareas": len(E["subtareas"]), "completitud": pct, "por_completar": falta,
        "completitud_niveles": {n: v["porcentaje"] for n, v in por_nivel.items()},
        "actualizado": E.get("actualizado"), "origen": (E.get("migrado_de") or {}).get("origen", ""),
        "cola_revision": {k: (E.get("cola_revision") or {}).get(k) for k in ("tareas", "horas", "desde")},
        "compromiso": next(({k: cp.get(k) for k in ("fecha", "que", "a_quien")} for cp in E["compromisos"]
                            if cp.get("estado") == "vigente"), None),
        "cortes_pendientes": len(cortes_p),
        "proximo_corte": {k: cortes_p[0].get(k) for k in ("fecha", "que_se_revisa", "responsable", "tipo")} if cortes_p else None,
        "hijos": E.get("hijos") or [], "jira_sync": (E.get("jira_sync") or {}).get("fecha"),
    }


def lineas_seguimiento(E):
    out = []
    for cp in sorted(E["compromisos"], key=lambda x: str(x.get("fecha") or "")):
        out.append(f"compromiso {cp.get('fecha')} · {cp.get('que', '')} → {cp.get('a_quien') or 'sin destinatario'}"
                   f" ({cp.get('estado')}{', reemplaza ' + str(cp['reemplaza']) if cp.get('reemplaza') else ''})")
    for k in sorted(E["cortes"], key=lambda x: str(x.get("fecha") or "")):
        out.append(f"corte {k.get('fecha') or 'sin fecha'} · {k.get('tipo') or 'sin tipo'} · "
                   f"{k.get('responsable') or 'SIN RESPONSABLE'} · {k.get('que_se_revisa', '')} ({k.get('estado')})")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Valida expedientes y arma el lote de carga de la Worklist del líder.")
    ap.add_argument("--estado", help="carpeta de estado (por defecto stateDir de config.json)")
    ap.add_argument("--fuentes", help="fuentes.yaml (por defecto <stateDir>/config/fuentes.yaml)")
    ap.add_argument("--salida", help="carpeta de carga (por defecto <stateDir>/worklist/carga)")
    ap.add_argument("--versiones", help="JSON {'expediente/<slug>': version, 'req/<slug>': version, 'cola/actual': v}")
    a = ap.parse_args(argv)
    estado = comun.state_dir(a.estado)
    F = comun.flujo(comun.fuentes(estado, a.fuentes))
    req = estado / "requerimientos"
    carga = os.path.abspath(a.salida) if a.salida else str(estado / "worklist" / "carga")
    versiones = comun.leer_json(a.versiones) if a.versiones else {}
    os.makedirs(carga, exist_ok=True)
    for viejo in glob.glob(os.path.join(carga, "*.json")):
        os.remove(viejo)
    print(f"Flujo: {'niveles ' + ', '.join(F['niveles']) + ' (por defecto ' + F['defecto'] + ')' if F['activos'] else 'completo (sin niveles)'}")
    writes, resumen, malos = [], {}, 0
    for p in sorted(glob.glob(os.path.join(str(req), "*", "expediente.json"))):
        slug = os.path.basename(os.path.dirname(p))
        try:
            E = comun.leer_json(p)
        except json.JSONDecodeError as e:
            malos += 1
            resumen[slug] = {"valido": False, "errores": [f"JSON inválido: {e}"], "avisos": []}
            print(f"  [NO VALIDA] {slug}: JSON inválido ({e})")
            continue
        err, avisos, nivel, pasos = validar(E, slug, F)
        texto = json.dumps(E, ensure_ascii=False)
        sosp = sorted(set(NUM_SOSPECHOSO.findall(texto)))
        if sosp:
            avisos.append(f"{len(sosp)} número(s) de 7-10 dígitos (¿documento de una persona?) — revisar antes de cargar")
        if len(texto.encode("utf-8")) > MAX_DOC:
            err.append(f"tamaño {len(texto.encode('utf-8'))} bytes > {MAX_DOC}")
        if err:
            malos += 1
            resumen[slug] = {"valido": False, "errores": err, "avisos": avisos}
            print(f"  [NO VALIDA] {slug}: " + "; ".join(err))
            continue
        N = normalizar(E, nivel, pasos)
        pct, falta = completitud(N, pasos)
        por_nivel = {}
        for n, nv in F["niveles"].items():
            pn, fn = completitud(N, nv["pasos"])
            por_nivel[n] = {"porcentaje": pn, "por_completar": fn}
        N["completitud"] = {"porcentaje": pct, "por_completar": falta, "nivel": nivel}
        if por_nivel:
            N["completitud_niveles"] = por_nivel
        R = indice(N, pct, falta, por_nivel)
        for col, doc in (("expediente", N), ("req", R)):
            ruta = os.path.join(carga, f"{col}-{slug}.json")
            comun.escribir_json(ruta, doc)
            w = {"op": "set", "collection": col, "doc_id": slug, "file_path": ruta}
            v = versiones.get(f"{col}/{slug}")
            if v:
                w["if_version"] = v
            writes.append(w)
        seg = lineas_seguimiento(N)
        resumen[slug] = {"valido": True, "nivel": nivel, "pasos": sorted(pasos), "completitud": pct,
                         "por_completar": falta, "avisos": avisos, "subtareas": len(N["subtareas"]),
                         "dudas_abiertas": R["dudas_abiertas"], "seguimiento": seg}
        print(f"  [ok] {slug}{' (nivel ' + nivel + ')' if nivel else ''}: {pct} % · faltan {len(falta)}")
        for linea in seg:
            print(f"       {linea}")
        for av in avisos:
            print(f"       AVISO: {av}")
    cola_src = req / "_cola_revision.json"
    if cola_src.exists():
        ruta = os.path.join(carga, "cola-actual.json")
        comun.escribir_json(ruta, comun.leer_json(cola_src))
        w = {"op": "set", "collection": "cola", "doc_id": "actual", "file_path": ruta}
        if versiones.get("cola/actual"):
            w["if_version"] = versiones["cola/actual"]
        writes.append(w)
        print("  [ok] cola/actual desde _cola_revision.json")
    lotes = [writes[i:i + 50] for i in range(0, len(writes), 50)]
    comun.escribir_json(os.path.join(carga, "lote.json"), {"lotes": lotes}, indent=1)
    comun.escribir_json(os.path.join(carga, "resumen.json"), resumen, indent=1)
    print(f"{len(writes)} escrituras en {len(lotes)} lote(s) · {os.path.join(carga, 'lote.json')}; "
          f"{malos} expediente(s) sin validar")
    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main())
