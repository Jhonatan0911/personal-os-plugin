"""Respaldo de las decisiones del artefacto en un Excel (una hoja «Decisiones» y una por destino).
Uso: python respaldo_excel.py <carpeta_decisiones> <data.json> <salida.xlsx>
<carpeta_decisiones> es la que deja ArtifactData list con out_dir (…/decisiones/*.json)."""
import sys, os, json, glob, openpyxl
from openpyxl.styles import PatternFill, Font, Alignment

sys.stdout.reconfigure(encoding="utf-8")
DEC_DIR, DATA, XLSX = sys.argv[1:4]
meta = json.load(open(DATA, encoding="utf-8"))
data = {r["n"]: r for r in meta["repos"]}
dec = {}
for f in glob.glob(os.path.join(DEC_DIR, "*.json")):
    d = json.load(open(f, encoding="utf-8"))
    d = d.get("data", d)
    dec[d["repo"]] = d
NOMBRE = {"migrar": "Migrar", "otro": "Va a otro proyecto", "no": "No migrar", "duda": "Duda"}
COLOR = {"migrar": "C6EFCE", "otro": "BDD7EE", "no": "FFC7CE", "duda": "FFEB9C"}
HDR = ["Repositorio", "Origen", "Destino", "Decisión", "Rama a migrar", "Ramas adicionales", "Fecha último commit",
       "Último autor", "Qué trae la rama (funcional)", "Recomendada por el análisis", "Coincide", "Nota", "Fecha decisión"]


def hoja(ws, filas):
    ws.append(HDR)
    for c in ws[1]:
        c.font = Font(bold=True)
    for repo in filas:
        x, d = data[repo], dec.get(repo)
        rb = next((b for b in x["ramas"] if d and b["r"] == d.get("rama")), {})
        rec = x["rec"].get("recomendada", "")
        ws.append([repo, x.get("o", ""), ", ".join((d or {}).get("destino") or x["dest"]),
                   NOMBRE.get((d or {}).get("decision"), "Sin decidir"),
                   d.get("rama", "") if d and d["decision"] in ("migrar", "otro") else "",
                   ", ".join(d.get("extras") or []) if d else "", (rb.get("f") or "")[:10], rb.get("a", ""), rb.get("fn", ""),
                   rec, ("Sí" if d.get("rama") == rec else "No") if d else "", (d or {}).get("nota", ""),
                   ((d or {}).get("fecha") or "")[:16].replace("T", " ")])
        if d:
            ws.cell(ws.max_row, 4).fill = PatternFill("solid", fgColor=COLOR.get(d["decision"], "FFFFFF"))
    for col, w in zip("ABCDEFGHIJKLM", (38, 18, 16, 12, 34, 30, 14, 26, 70, 30, 10, 50, 17)):
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for i in (8, 11):
            row[i].alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


wb = openpyxl.Workbook()
hoja(wb.active, sorted(dec, key=str.lower))
wb.active.title = "Decisiones"
for d in meta["destinos"]:
    hoja(wb.create_sheet(d[:31]), sorted((n for n, x in data.items() if d in ((dec.get(n) or {}).get("destino") or x["dest"])), key=str.lower))
wb.save(XLSX)
c = {k: sum(1 for d in dec.values() if d["decision"] == k) for k in NOMBRE}
print("decisiones:", len(dec), "de", len(data), c)
