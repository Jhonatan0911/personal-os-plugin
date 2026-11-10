"""Valida el mapa de criticidad de módulos y calcula su índice. Solo lee: no escribe ni consulta bases.

  python -I criticidad.py --archivo <stateDir>/criticidad/modulos.json             # resumen
  python -I criticidad.py --archivo ... --pendientes                                # sin validar y huecos
  python -I criticidad.py --archivo ... --modulo <id>                               # ficha de un módulo
  python -I criticidad.py --archivo ... --modulos id1,id2                           # criticidad combinada (impacto)
  python -I criticidad.py --archivo ... --volumetria <id>                           # propone conteos (NO los ejecuta)
  python -I criticidad.py --archivo ... --json                                      # salida para otras skills

Sin --archivo busca stateDir en ~/.claude/personal-os/config.json.
Código de salida: 0 válido, 1 errores de esquema, 2 archivo no encontrado o ilegible.
"""
import argparse
import json
import re
import sys
from pathlib import Path

EJES = ["transaccionalidad", "dinero", "norma", "usuarios", "reversibilidad"]
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass


def ruta_por_defecto():
    cfg = Path.home() / ".claude" / "personal-os" / "config.json"
    try:
        state = json.loads(cfg.read_text(encoding="utf-8-sig"))["stateDir"]
        return Path(state) / "criticidad" / "modulos.json"
    except (OSError, KeyError, ValueError):
        return None


def validar(doc):
    errores, avisos = [], []
    mods = doc.get("modulos")
    if not isinstance(mods, list) or not mods:
        return ["'modulos' debe ser una lista no vacía"], avisos
    pesos = doc.get("pesos", {})
    for k, v in pesos.items():
        if k not in EJES or not isinstance(v, (int, float)) or v <= 0:
            errores.append(f"pesos.{k}: eje desconocido o peso no positivo")
    vistos = set()
    for i, m in enumerate(mods):
        mid = m.get("id", f"#{i}")
        p = f"[{mid}]"
        if not isinstance(m.get("id"), str) or not SLUG.match(m["id"]):
            errores.append(f"{p} id debe ser slug en minúsculas con guiones")
        if mid in vistos:
            errores.append(f"{p} id repetido")
        vistos.add(mid)
        for campo in ("modulo", "descripcion"):
            if not str(m.get(campo, "")).strip():
                errores.append(f"{p} falta '{campo}'")
        ejes = m.get("ejes")
        if not isinstance(ejes, dict):
            errores.append(f"{p} falta 'ejes'")
            continue
        for e in EJES:
            if e not in ejes:
                errores.append(f"{p} falta el eje '{e}' (usa null si no hay evidencia)")
            elif ejes[e] is not None and (not isinstance(ejes[e], int) or isinstance(ejes[e], bool) or not 1 <= ejes[e] <= 5):
                errores.append(f"{p} {e}={ejes[e]!r}: debe ser entero 1-5 o null")
        for e in ejes:
            if e not in EJES:
                errores.append(f"{p} eje desconocido '{e}'")
        ev = m.get("evidencia", [])
        if not isinstance(ev, list):
            errores.append(f"{p} 'evidencia' debe ser lista")
            ev = []
        por_eje = {e: [x for x in ev if isinstance(x, dict) and x.get("eje") == e] for e in EJES}
        for x in ev:
            if not isinstance(x, dict) or x.get("eje") not in EJES + ["general"]:
                errores.append(f"{p} evidencia con eje inválido: {x!r:.80}")
        for e in EJES:
            val = ejes.get(e)
            if val is not None:
                if not any(str(x.get("fuente", "")).strip() for x in por_eje[e]):
                    errores.append(f"{p} {e}={val} sin evidencia con 'fuente': un valor sin fuente es inventado")
            elif not por_eje[e]:
                avisos.append(f"{p} {e}=null sin nota «por validar»: di qué falta para calificarlo")
        if not isinstance(m.get("validado_por_lider"), bool):
            errores.append(f"{p} 'validado_por_lider' debe ser true/false")
        elif m["validado_por_lider"]:
            if not FECHA.match(str(m.get("validado_el", ""))):
                errores.append(f"{p} validado sin 'validado_el' (AAAA-MM-DD)")
            if any(ejes.get(e) is None for e in EJES):
                avisos.append(f"{p} validado por el líder con ejes en null")
        if m.get("fecha") and not FECHA.match(str(m["fecha"])):
            errores.append(f"{p} 'fecha' debe ser AAAA-MM-DD")
        vol = m.get("volumetria", {})
        for med in vol.get("mediciones", []) if isinstance(vol, dict) else []:
            if not med.get("ok_lider") or not med.get("ambiente"):
                errores.append(f"{p} medición de volumetría sin 'ok_lider' o 'ambiente': no se registra lo que no se autorizó")
    return errores, avisos


def calcular(m, pesos):
    ejes = m["ejes"]
    w = {e: pesos.get(e, 1) for e in EJES}
    conocidos = [e for e in EJES if ejes.get(e) is not None]
    tope = sum(w[e] * 5 for e in EJES)

    def indice(relleno):
        return round(100 * sum(w[e] * (ejes[e] if ejes.get(e) is not None else relleno) for e in EJES) / tope)

    # Con menos de 3 ejes calificados el promedio engaña (un solo 5 daría 100): no hay índice, solo rango.
    if len(conocidos) >= 3:
        idx = round(100 * sum(w[e] * ejes[e] for e in conocidos) / sum(w[e] * 5 for e in conocidos))
    else:
        idx = None
    vals = [ejes[e] for e in conocidos]
    cincos = vals.count(5)
    if idx is None:
        nivel = "por calificar"
    elif cincos >= 2 or idx >= 80:
        nivel = "crítico"
    elif cincos == 1 or idx >= 60:
        nivel = "alto"
    elif 4 in vals or idx >= 40:
        nivel = "medio"
    else:
        nivel = "bajo"
    return {
        "id": m["id"],
        "modulo": m["modulo"],
        "indice": idx,
        "rango": [indice(1), indice(5)],
        "nivel": nivel,
        "provisional": len(conocidos) < 3,
        "cobertura": f"{len(conocidos)}/5",
        "huecos": [e for e in EJES if e not in conocidos],
        "mini_amfe": any(v >= 4 for v in vals),
        "validado_por_lider": m.get("validado_por_lider", False),
        "ejes": {e: ejes.get(e) for e in EJES},
    }


def combinar(fichas):
    """Criticidad de un cambio que toca varios módulos: el peor valor por eje (no el promedio)."""
    ejes = {}
    for e in EJES:
        vals = [f["ejes"][e] for f in fichas if f["ejes"][e] is not None]
        ejes[e] = max(vals) if vals else None
    return ejes


def imprimir_tabla(fichas):
    print(f"{'módulo':32} {'índice':>6} {'rango':>9} {'nivel':13} {'cob':>4} {'T D N U R':10} validado")
    for f in sorted(fichas, key=lambda f: (f["indice"] is None, -(f["indice"] or 0), -f["rango"][1])):
        ej = " ".join("-" if f["ejes"][e] is None else str(f["ejes"][e]) for e in EJES)
        idx = "—" if f["indice"] is None else str(f["indice"])
        print(f"{f['id'][:32]:32} {idx:>6} {f['rango'][0]:>4}-{f['rango'][1]:<4} {f['nivel']:13} {f['cobertura']:>4} {ej:10} {'sí' if f['validado_por_lider'] else 'no'}")
    print("\nÍndice = promedio ponderado de los ejes calificados (0-100); «—» si hay menos de 3. "
          "Rango = índice con los huecos en 1 y en 5. Ejes: T D N U R = transaccionalidad, dinero, norma, usuarios, reversibilidad.")


def proponer_volumetria(m):
    vol = m.get("volumetria") or {}
    tablas = vol.get("tablas_candidatas", [])
    print(f"Volumetría de «{m['modulo']}» — PROPUESTA, no se ejecuta nada.")
    if not tablas:
        print("Sin tablas candidatas: búscalas en la base de conocimiento del repo (DATOS) y agrégalas a volumetria.tablas_candidatas.")
        return
    print("Cada consulta necesita, antes de correr: el comando exacto, servidor + base (de pruebas/staging) y el OK explícito del líder EN ESA conversación.")
    print("Usa el wrapper de solo lectura del proyecto en modo DryRun para mostrar el destino.\n")
    for t in tablas:
        nombre = t.get("tabla") if isinstance(t, dict) else str(t)
        col = t.get("columna_fecha") if isinstance(t, dict) else None
        base = t.get("base", "<base de staging>") if isinstance(t, dict) else "<base de staging>"
        filtro = f" WHERE {col} >= DATEADD(day, -30, SYSUTCDATETIME())" if col else ""
        print(f"- [{base}] SELECT COUNT_BIG(*) AS filas FROM {nombre} WITH (NOLOCK){filtro};")
        if not col:
            print("    (sin columna de fecha: el total no dice el ritmo; pide la columna antes de medir)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--archivo")
    ap.add_argument("--pendientes", action="store_true")
    ap.add_argument("--modulo")
    ap.add_argument("--modulos")
    ap.add_argument("--volumetria")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    ruta = Path(a.archivo) if a.archivo else ruta_por_defecto()
    if not ruta or not ruta.exists():
        print(f"No encuentro el mapa: {ruta or '(sin --archivo ni stateDir)'}", file=sys.stderr)
        return 2
    try:
        doc = json.loads(ruta.read_text(encoding="utf-8-sig"))
    except ValueError as ex:
        print(f"JSON inválido en {ruta}: {ex}", file=sys.stderr)
        return 2

    errores, avisos = validar(doc)
    if errores:
        print(f"✗ {len(errores)} errores de esquema en {ruta.name}:")
        for e in errores:
            print("  - " + e)
        return 1
    pesos = doc.get("pesos", {})
    por_id = {m["id"]: m for m in doc["modulos"]}
    fichas = [calcular(m, pesos) for m in doc["modulos"]]
    fid = {f["id"]: f for f in fichas}

    if a.volumetria:
        if a.volumetria not in por_id:
            print(f"Módulo desconocido: {a.volumetria}. Ids: {', '.join(por_id)}")
            return 1
        proponer_volumetria(por_id[a.volumetria])
        return 0

    if a.modulo or a.modulos:
        ids = [a.modulo] if a.modulo else [x.strip() for x in a.modulos.split(",") if x.strip()]
        faltan = [i for i in ids if i not in fid]
        if faltan:
            print(f"Módulos desconocidos: {', '.join(faltan)}. Ids: {', '.join(fid)}")
            return 1
        sel = [fid[i] for i in ids]
        comb = combinar(sel)
        salida = {"modulos": sel, "criticidad_combinada": comb,
                  "sin_validar": [f["id"] for f in sel if not f["validado_por_lider"]],
                  "evidencia": {i: por_id[i].get("evidencia", []) for i in ids} if a.modulo else None}
        if a.json:
            print(json.dumps(salida, ensure_ascii=False, indent=1))
        else:
            imprimir_tabla(sel)
            print("\nCriticidad combinada (peor valor por eje):", comb)
            if salida["sin_validar"]:
                print("Sin validar por el líder:", ", ".join(salida["sin_validar"]), "→ la ficha de impacto lo dice.")
            if a.modulo:
                print("\nEvidencia:")
                for x in por_id[a.modulo].get("evidencia", []):
                    print(f"  [{x.get('eje')}] {x.get('texto')} — {x.get('fuente', 'sin fuente')}")
        return 0

    sin_validar = [f for f in fichas if not f["validado_por_lider"]]
    if a.json:
        print(json.dumps({"archivo": str(ruta), "avisos": avisos, "fichas": fichas,
                          "sin_validar": [f["id"] for f in sin_validar]}, ensure_ascii=False, indent=1))
        return 0
    print(f"✓ esquema válido · {len(fichas)} módulos · {len(sin_validar)} sin validar por el líder\n")
    if a.pendientes:
        for f in sorted(sin_validar, key=lambda f: -len(f["huecos"])):
            print(f"- {f['id']}: huecos {', '.join(f['huecos']) or 'ninguno'}")
    else:
        imprimir_tabla(fichas)
    if avisos:
        print(f"\nAvisos ({len(avisos)}):")
        for x in avisos:
            print("  - " + x)
    return 0


if __name__ == "__main__":
    sys.exit(main())
