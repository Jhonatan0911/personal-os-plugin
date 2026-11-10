"""Verifica la matriz llenada por el desarrollador: cobertura, evidencias y datos de personas reales.

  python -I verificar_matriz.py --expediente expediente.json --matriz matriz.xlsx|.csv|.md
                                [--evidencias <carpeta>] [--config X] [--salida veredicto.json]
                                [--imagenes-revisadas] [--dato-real "<archivo o ID>: <tipo>"]… [--escribir] [--fecha AAAA-MM-DD]

Veredicto (determinista):
  rechazada                       hay datos de personas reales (en la matriz o en una evidencia): se devuelve completa
  no_certificada                  alguna fila esperada en «falla»
  incompleta                      faltan filas, hay pendientes/bloqueadas, OK/Falla sin evidencia, evidencia que no existe,
                                  o imágenes/PDF sin revisar a ojo
  certificada_con_observaciones   todo OK salvo filas «no aplica» (con su porqué) u observaciones
  certificada                     todas las filas esperadas en OK con evidencia
Evidencia de una fila: lo que diga su columna Evidencia (rutas separadas por ; , o salto de línea, relativas a
--evidencias) más todo archivo en <evidencias>/<ID>/. Los textos (.txt .md .json .csv .log .html .xml .har) y los
.xlsx se escanean; imágenes, PDF y video se listan en `revisar_a_ojo` para que alguien los mire.
--dato-real lo pasa la skill cuando, al mirar una imagen, encuentra un dato real. --escribir llena `matriz_pruebas`
y el chequeo p5 del expediente (con copia .antes-certificar).
"""
import argparse, datetime, re, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import base, matriz  # noqa: E402

TEXTO = {".txt", ".md", ".json", ".csv", ".log", ".html", ".htm", ".xml", ".har", ".tsv", ".sql"}
MAX_BYTES = 5_000_000


def evidencias_de(fila, carpeta):
    rutas = []
    for parte in re.split(r"[;\n,]+", fila.get("evidencia") or ""):
        parte = parte.strip()
        if not parte or parte.lower() in ("-", "n/a", "na", "no aplica"):
            continue
        if re.match(r"(?i)^https?://", parte):
            rutas.append(("url", parte))
            continue
        p = Path(parte)
        if not p.is_absolute() and carpeta:
            p = Path(carpeta) / parte
        rutas.append(("archivo", p))
    if carpeta:
        sub = Path(carpeta) / fila["id"].replace("/", "_")
        if sub.is_dir():
            ya = {str(r[1]) for r in rutas if r[0] == "archivo"}
            rutas += [("archivo", f) for f in sorted(sub.rglob("*")) if f.is_file() and str(f) not in ya]
    return rutas


def texto_de(ruta):
    if ruta.stat().st_size > MAX_BYTES:
        return None
    if ruta.suffix.lower() in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            return None
        wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
        return "\n".join(" ".join(str(c) for c in fila if c is not None)
                         for ws in wb.worksheets for fila in ws.iter_rows(values_only=True))
    return ruta.read_text(encoding="utf-8", errors="replace")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--expediente", required=True)
    ap.add_argument("--matriz", required=True)
    ap.add_argument("--evidencias")
    ap.add_argument("--config")
    ap.add_argument("--salida")
    ap.add_argument("--imagenes-revisadas", action="store_true")
    ap.add_argument("--dato-real", action="append", default=[])
    ap.add_argument("--escribir", action="store_true")
    ap.add_argument("--fecha", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    cfg = base.cargar_config(a.config)
    det = base.Detector(cfg)
    exp = base.leer_json(a.expediente)
    esperadas = {f["ID"]: f for f in matriz.filas_esperadas(exp)}
    filas, hoja = matriz.leer(a.matriz)
    carpeta = a.evidencias or str(Path(a.matriz).parent / "evidencias")

    por_id = {}
    for f in filas:
        por_id.setdefault(f["id"].strip(), f)
    faltan = [i for i in esperadas if i not in por_id]
    sobran = [i for i in por_id if i not in esperadas]
    datos, problemas, a_ojo, resultado = [], [], [], []
    for d in a.dato_real:
        datos.append({"tipo": "visto_en_evidencia", "severidad": "alta", "donde": d, "valor": "(revisión visual)"})

    for i, esperada in esperadas.items():
        f = por_id.get(i)
        if not f:
            continue
        est = base.estado(f.get("estado"))
        for col, valor in f["_texto"].items():
            datos += det.buscar(valor, f"matriz {i} · {col}")
        evs = evidencias_de(f, carpeta)
        existentes = []
        for tipo, ev in evs:
            if tipo == "url":
                existentes.append(ev)
                continue
            if not ev.exists():
                problemas.append(f"{i}: la evidencia «{ev.name}» no existe en {ev.parent}")
                continue
            existentes.append(str(ev))
            ext = ev.suffix.lower()
            if ext in TEXTO or ext in (".xlsx", ".xlsm"):
                t = texto_de(ev)
                if t is None:
                    a_ojo.append(str(ev))
                else:
                    datos += det.buscar(t, f"evidencia {i} · {ev.name}")
            else:  # imágenes, PDF, video y cualquier formato que no se pueda leer como texto
                a_ojo.append(str(ev))
        if est in ("ok", "falla") and not existentes:
            problemas.append(f"{i}: está en «{f.get('estado')}» sin evidencia")
        if est in ("pendiente", "bloqueado"):
            problemas.append(f"{i}: sigue «{f.get('estado') or 'pendiente'}»")
        if est == "desconocido":
            problemas.append(f"{i}: estado «{f.get('estado')}» no reconocido (usa OK, Falla, Bloqueado, No aplica)")
        if est == "no_aplica" and not (f.get("observaciones") or "").strip():
            problemas.append(f"{i}: «no aplica» sin decir por qué en Observaciones")
        resultado.append({"ca": i, "origen": esperada["Origen"], "caso": f.get("caso") or esperada["Qué se verifica"],
                          "pasos": f.get("pasos", ""), "esperado": f.get("esperado", ""), "resultado": f.get("resultado", ""),
                          "evidencia": "; ".join(Path(e).name if not str(e).startswith("http") else e for e in existentes),
                          "estado": {"ok": "ok", "falla": "falla"}.get(est, "pendiente"),
                          "estado_matriz": f.get("estado", ""), "observaciones": f.get("observaciones", "")})
    for i in faltan:
        problemas.append(f"{i}: la fila no está en la matriz")
        resultado.append({"ca": i, "origen": esperadas[i]["Origen"], "caso": esperadas[i]["Qué se verifica"], "pasos": "",
                          "esperado": "", "resultado": "", "evidencia": "", "estado": "pendiente"})
    if a_ojo and not a.imagenes_revisadas:
        problemas.append(f"{len(a_ojo)} evidencias visuales sin revisar a ojo (datos reales en capturas)")

    crudos = {d.pop("_v") for d in datos if "_v" in d}
    if crudos:
        for r in resultado:
            for k in ("caso", "pasos", "esperado", "resultado", "evidencia", "observaciones"):
                if k in r:
                    r[k] = base.tachar(r[k], crudos)
    fallas = [r["ca"] for r in resultado if r["estado"] == "falla"]
    if datos:
        veredicto = "rechazada"
    elif fallas:
        veredicto = "no_certificada"
    elif problemas:
        veredicto = "incompleta"
    elif any(base.estado(por_id[i].get("estado")) == "no_aplica" or (por_id[i].get("observaciones") or "").strip()
             for i in esperadas if i in por_id):
        veredicto = "certificada_con_observaciones"
    else:
        veredicto = "certificada"

    salida = {"fecha": a.fecha, "matriz": str(a.matriz), "hoja": hoja, "veredicto": veredicto,
              "esperadas": len(esperadas), "en_matriz": len(por_id), "faltan": faltan, "sobran": sobran,
              "fallas": fallas, "problemas": problemas, "datos_personales": datos, "revisar_a_ojo": a_ojo,
              "imagenes_revisadas": a.imagenes_revisadas, "filas": resultado}
    if a.salida:
        base.escribir_json(a.salida, salida)
    if a.escribir:
        shutil.copy2(a.expediente, a.expediente + ".antes-certificar")
        exp["matriz_pruebas"] = [{k: r[k] for k in ("ca", "caso", "pasos", "esperado", "resultado", "evidencia", "estado")}
                                 | {"origen": r["origen"]} for r in resultado]
        exp.setdefault("historial", []).append({"fecha": a.fecha, "resumen": f"Certificación funcional: {veredicto}"})
        if isinstance(exp.get("chequeos"), dict):
            exp["chequeos"]["p5"] = {"estado": {"certificada": "aceptado", "certificada_con_observaciones": "parcial"}.get(veredicto, "pendiente"),
                                     "fecha": a.fecha, "nota": f"Matriz {Path(a.matriz).name}: {veredicto}"}
        base.escribir_json(a.expediente, exp)

    print(f"Veredicto funcional: {veredicto} · {len(esperadas)} filas esperadas · {len(por_id)} en la matriz")
    if datos:
        print(f"  DATOS DE PERSONAS ({len(datos)}): se devuelve la matriz completa. Primeros:")
        for d in datos[:8]:
            print(f"   - {d['tipo']} ({d['severidad']}) en {d['donde']}: {d['valor']}")
    for p in problemas[:15]:
        print(f"  - {p}")
    if fallas:
        print(f"  Fallan: {', '.join(fallas)}")
    if a_ojo and not a.imagenes_revisadas:
        print(f"  Revisar a ojo ({len(a_ojo)}): " + "; ".join(Path(x).name for x in a_ojo[:10]))


if __name__ == "__main__":
    main()
