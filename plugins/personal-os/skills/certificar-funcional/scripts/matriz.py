"""Genera la matriz de pruebas desde la especificación del expediente, y lee una matriz llenada.

  python -I matriz.py --expediente expediente.json --salida matriz.xlsx|.csv|.md [--plantilla plantilla.xlsx] [--config X]

Filas esperadas (una por cada una):
  CA-n   cada criterio de aceptación de `historias[].criterios` (si un id se repite entre historias: <historia>/CA-n)
  QA-n   cada escenario de calidad de `calidad[]`
  MF-n   cada modo de falla de `impacto.modos_falla[]` con `a_regresion: true` (n = su posición en la lista)
Con --plantilla (una matriz existente del equipo, p. ej. la de regresión) copia el libro y llena su hoja de
matriz por nombre de columna; sin plantilla arma un libro propio. Sin openpyxl, usa .csv o .md.
"""
import argparse, csv, re, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import base  # noqa: E402

COLUMNAS = ["ID", "Origen", "Historia", "Qué se verifica", "Cómo verificar", "Precondiciones", "Pasos",
            "Resultado esperado", "Resultado obtenido", "Evidencia", "Estado", "Observaciones"]
ESTADOS_LISTA = ["Pendiente", "OK", "Falla", "Bloqueado", "No aplica"]
INSTRUCCIONES = [
    "Cómo llenar esta matriz",
    "1. Cada fila es un criterio de aceptación (CA), un escenario de calidad (QA) o un modo de falla que debe probarse en regresión (MF). No borres filas ni cambies el ID.",
    "2. Llena Precondiciones, Pasos, Resultado obtenido, Evidencia y Estado (OK, Falla, Bloqueado o No aplica con su porqué en Observaciones).",
    "3. Evidencia: nombre del archivo dentro de la carpeta evidencias/<ID>/ (captura, video, exportación). Toda fila OK o Falla lleva evidencia.",
    "4. SOLO datos sintéticos o seudónimos (PAC-0001). Una cédula, nombre, teléfono, correo o número de historia de una persona real en la matriz o en una evidencia hace que la matriz se devuelva completa.",
    "5. Si una evidencia muestra datos reales, tacha o recorta antes de guardarla.",
]


def filas_esperadas(exp):
    filas = []
    ids = [c.get("id") for h in exp.get("historias", []) for c in h.get("criterios", [])]
    repetidos = {i for i in ids if ids.count(i) > 1}
    for h in exp.get("historias", []):
        clave = h.get("clave") or h.get("key") or ""
        for c in h.get("criterios", []):
            fid = f"{clave}/{c['id']}" if c.get("id") in repetidos else c.get("id")
            filas.append({"ID": fid, "Origen": "Criterio de aceptación", "Historia": clave, "Qué se verifica": c.get("texto", ""),
                          "Cómo verificar": c.get("como_verificar", ""), "_prioridad": "Alta", "_tipo": "Funcional"})
    for q in exp.get("calidad", []):
        filas.append({"ID": q.get("id"), "Origen": f"Escenario de calidad ({q.get('atributo', '')})", "Historia": "",
                      "Qué se verifica": f"{q.get('escenario', '')} — medida: {q.get('medida', '')}".strip(" —"),
                      "Cómo verificar": q.get("como_verificar", ""), "_prioridad": "Media", "_tipo": "Funcional"})
    for i, m in enumerate((exp.get("impacto") or {}).get("modos_falla", []), 1):
        if not m.get("a_regresion"):
            continue
        sev = int(m.get("severidad") or 0)
        filas.append({"ID": f"MF-{i}", "Origen": f"Modo de falla (severidad {sev})", "Historia": "",
                      "Qué se verifica": f"Que no pase: {m.get('modo', '')}. Efecto: {m.get('efecto', '')}",
                      "Cómo verificar": "Prueba de regresión del modo de falla",
                      "_prioridad": "Crítica" if sev >= 5 else "Alta" if sev == 4 else "Media" if sev == 3 else "Baja",
                      "_tipo": "Regresión"})
    return filas


def _xlsx():
    try:
        import openpyxl
        return openpyxl
    except ImportError:
        sys.exit("Para .xlsx hace falta openpyxl (pip install openpyxl). Usa --salida .csv o .md.")


def escribir_propia(filas, salida, titulo):
    opx = _xlsx()
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation
    wb = opx.Workbook()
    ws = wb.active
    ws.title = "Matriz de pruebas"
    ws.append(COLUMNAS)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F3A5F")
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for f in filas:
        ws.append([f.get(k, "") if k != "Estado" else "Pendiente" for k in COLUMNAS])
    anchos = [10, 22, 12, 45, 35, 30, 45, 35, 35, 28, 12, 30]
    for i, w in enumerate(anchos):
        ws.column_dimensions[chr(65 + i)].width = w
    for fila in ws.iter_rows(min_row=2):
        for c in fila:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    dv = DataValidation(type="list", formula1='"' + ",".join(ESTADOS_LISTA) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"K2:K{max(len(filas) + 1, 2)}")
    ws.freeze_panes = "B2"
    ins = wb.create_sheet("Instrucciones")
    ins.append([titulo])
    for t in INSTRUCCIONES:
        ins.append([t])
    ins.column_dimensions["A"].width = 140
    wb.save(salida)


def _encabezados(ws):
    for fila in ws.iter_rows(min_row=1, max_row=5):
        nombres = [base.norm(c.value) for c in fila]
        if "id" in nombres and "estado" in nombres:
            return fila[0].row, {n: i for i, n in enumerate(nombres) if n}
    return None, None


def escribir_con_plantilla(filas, salida, plantilla, titulo, subtitulo, modulo=""):
    opx = _xlsx()
    shutil.copy(plantilla, salida)
    wb = opx.load_workbook(salida)
    hoja = None
    for ws in wb.worksheets:
        fila, cols = _encabezados(ws)
        if fila and (hoja is None or "matriz" in base.norm(ws.title)):
            hoja, fila_enc, idx = ws, fila, cols
    if hoja is None:
        sys.exit("La plantilla no tiene una hoja con columnas «ID» y «Estado».")
    mapa = {"id": "ID", "funcionalidad": "Historia", "escenario": "Qué se verifica", "objetivo": "Cómo verificar",
            "precondiciones": "Precondiciones", "pasos": "Pasos", "resultado esperado": "Resultado esperado",
            "observaciones": "Observaciones"}
    for n, f in enumerate(filas, fila_enc + 1):
        valores = {k: f.get(v, "") for k, v in mapa.items()}
        valores.update({"modulo": modulo, "tipo de prueba": f["_tipo"], "origen": "Sintético", "prioridad": f["_prioridad"],
                        "estado": "Pendiente",
                        "evidencia requerida": f"Archivo en evidencias/{f['ID']}/ con datos sintéticos"})
        for k, v in valores.items():
            if k in idx:
                hoja.cell(row=n, column=idx[k] + 1, value=v)
    portada = wb.worksheets[0]
    if portada is not hoja:
        portada.cell(row=1, column=1, value=titulo)
        portada.cell(row=2, column=1, value=subtitulo)
    wb.save(salida)
    return hoja.title


def escribir_texto(filas, salida):
    if salida.lower().endswith(".csv"):
        with open(salida, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(COLUMNAS)
            for x in filas:
                w.writerow([x.get(k, "") if k != "Estado" else "Pendiente" for k in COLUMNAS])
        return
    lineas = ["| " + " | ".join(COLUMNAS) + " |", "|" + "---|" * len(COLUMNAS)]
    for x in filas:
        lineas.append("| " + " | ".join(str(x.get(k, "") if k != "Estado" else "Pendiente").replace("|", "/") for k in COLUMNAS) + " |")
    Path(salida).write_text("\n".join(INSTRUCCIONES) + "\n\n" + "\n".join(lineas) + "\n", encoding="utf-8")


# ─── Lectura de la matriz llenada ──────────────────────────────────────────────────────────────────
ALIAS = {"id": "id", "estado": "estado", "evidencia": "evidencia", "resultado obtenido": "resultado", "resultado": "resultado",
         "pasos": "pasos", "resultado esperado": "esperado", "esperado": "esperado", "observaciones": "observaciones",
         "precondiciones": "precondiciones", "caso": "caso", "escenario": "caso", "que se verifica": "caso"}


def leer(ruta):
    """Devuelve (filas, hoja): cada fila es {id, estado, evidencia, resultado, pasos, esperado, observaciones, _texto}."""
    ruta = str(ruta)
    crudas = []
    hoja = None
    if ruta.lower().endswith((".xlsx", ".xlsm")):
        opx = _xlsx()
        wb = opx.load_workbook(ruta, data_only=True)
        elegido = None
        for ws in wb.worksheets:
            fila, cols = _encabezados(ws)
            if fila and (elegido is None or "matriz" in base.norm(ws.title)):
                elegido = (ws, fila, cols)
        if not elegido:
            sys.exit("El libro no tiene una hoja con columnas «ID» y «Estado».")
        ws, fila, cols = elegido
        hoja = ws.title
        nombres = {i: n for n, i in cols.items()}
        for r in ws.iter_rows(min_row=fila + 1, values_only=True):
            if not any(v not in (None, "") for v in r):
                continue
            crudas.append({nombres[i]: ("" if v is None else str(v)) for i, v in enumerate(r) if i in nombres})
    elif ruta.lower().endswith(".csv"):
        texto = Path(ruta).read_text(encoding="utf-8-sig")
        dialecto = csv.Sniffer().sniff(texto.splitlines()[0], delimiters=",;\t")
        for r in csv.DictReader(texto.splitlines(), dialect=dialecto):
            crudas.append({base.norm(k): (v or "") for k, v in r.items() if k})
    else:
        lineas = [l for l in Path(ruta).read_text(encoding="utf-8").splitlines() if l.strip().startswith("|")]
        enc = None
        for l in lineas:
            celdas = [c.strip() for c in l.strip().strip("|").split("|")]
            if enc is None:
                if "id" in [base.norm(c) for c in celdas]:
                    enc = [base.norm(c) for c in celdas]
                continue
            if set("".join(celdas)) <= set("-: "):
                continue
            crudas.append(dict(zip(enc, celdas)))
    filas = []
    for c in crudas:
        f = {ALIAS[k]: v for k, v in c.items() if k in ALIAS}
        if not f.get("id"):
            continue
        f["_texto"] = {k: v for k, v in c.items() if v}
        filas.append(f)
    return filas, hoja


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--expediente", required=True)
    ap.add_argument("--salida", required=True)
    ap.add_argument("--plantilla")
    ap.add_argument("--config")
    a = ap.parse_args()
    cfg = base.cargar_config(a.config)
    exp = base.leer_json(a.expediente)
    filas = filas_esperadas(exp)
    if not filas:
        sys.exit("El expediente no trae criterios, escenarios de calidad ni modos de falla a regresión: no hay qué certificar.")
    titulo = f"Certificación funcional · {exp.get('titulo') or exp.get('requerimiento') or exp.get('id', '')}"
    subtitulo = "Requerimiento " + ", ".join(exp.get("jira") or []) + " · solo datos sintéticos"
    Path(a.salida).parent.mkdir(parents=True, exist_ok=True)
    plantilla = a.plantilla or cfg.get("plantilla_matriz")
    if a.salida.lower().endswith(".xlsx"):
        if plantilla and Path(plantilla).exists():
            hoja = escribir_con_plantilla(filas, a.salida, plantilla, titulo, subtitulo, ", ".join(exp.get("modulos") or []))
            print(f"Matriz con la plantilla ({Path(plantilla).name}, hoja «{hoja}»): {a.salida}")
        else:
            if plantilla:
                print(f"No encontré la plantilla {plantilla}: uso el formato propio.")
            escribir_propia(filas, a.salida, titulo)
            print(f"Matriz: {a.salida}")
    else:
        escribir_texto(filas, a.salida)
        print(f"Matriz: {a.salida}")
    cuenta = {p: sum(1 for f in filas if f["ID"].split("/")[-1].startswith(p)) for p in ("CA", "QA", "MF")}
    print(f"{len(filas)} filas: {cuenta['CA']} criterios · {cuenta['QA']} de calidad · {cuenta['MF']} modos de falla a regresión")


if __name__ == "__main__":
    main()
