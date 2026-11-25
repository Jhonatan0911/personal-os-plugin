"""Imprime en PDF con la marca de la organización los entregables que leen personas.

  python -I pdf.py --config <fuentes.yaml> --carpeta <P> [archivo.md|archivo.html ...]

Sin archivos, imprime todos los .md de <P> (salvo paquete.md, README.md y correo-*.md) y manual-usuario.html.
- .md  -> HTML con cabecera de marca (logo + subtítulo) y Mermaid dibujado -> PDF.
- .html -> se imprime tal cual (el manual ya trae su marca y sus capturas embebidas).
La marca sale de `paso_produccion.marca` en la configuración: { logo: <png>, color: "#0A1A4F", subtitulo: "..." }.
Los HTML intermedios quedan en <P>/pdf-fuente/. Pie de página con número de página.
"""
import argparse, base64, html, re, sys
from pathlib import Path
import markdown
from playwright.sync_api import sync_playwright

MERMAID = '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>'
CSS = """
body{font-family:"Segoe UI",system-ui,Roboto,sans-serif;color:#222;font-size:11pt;line-height:1.5;margin:0}
.cab{display:flex;align-items:center;justify-content:space-between;background:var(--marca);color:#fff;padding:14px 20px;border-radius:6px;margin-bottom:18px}
.cab img{height:34px}.cab .t{text-align:right;font-size:10pt;color:#C9D6EE}
h1{color:#1F2B53;font-size:19pt;margin:0 0 8px}
h2{color:#1F2B53;font-size:14pt;border-left:4px solid #134095;padding-left:10px;margin:20px 0 8px}
h3{color:#1F2B53;font-size:12pt}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:8px 0;table-layout:fixed;word-break:break-word}
th,td{border:1px solid #E2E8F0;padding:5px 7px;text-align:left;vertical-align:top}th{background:#F1F5F9;color:#1F2B53}
code{font-family:Consolas,monospace;font-size:8.5pt;background:#F1F5F9;padding:0 3px;border-radius:3px;word-break:break-all}
pre{background:#F1F5F9;padding:8px;border-radius:6px;font-size:8.5pt;white-space:pre-wrap}
pre.mermaid{background:none;text-align:center}.mermaid svg{max-width:100%;height:auto}
blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid #134095;background:#F1F5F9;color:#5A6275}
"""
PIE = '<div style="font-size:8px;color:#5A6275;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'


def marca(config):
    import yaml
    cfg = (yaml.safe_load(Path(config).read_text(encoding="utf-8")) or {}).get("paso_produccion") or {}
    m = cfg.get("marca") or {}
    logo = ""
    if m.get("logo") and Path(m["logo"]).exists():
        logo = "data:image/png;base64," + base64.b64encode(Path(m["logo"]).read_bytes()).decode()
    return logo, m.get("color", "#0A1A4F"), m.get("subtitulo", "")


def md_a_html(md, logo, color, subtitulo):
    texto = md.read_text(encoding="utf-8")
    m = re.match(r"#\s+(.+)\n", texto)
    titulo = m.group(1).strip() if m else md.stem
    texto = texto[m.end():] if m else texto
    bloques = []
    def guardar(x):
        bloques.append(x.group(1)); return f"\n\nMERMAID{len(bloques)-1}\n\n"
    texto = re.sub(r"```mermaid\n(.*?)```", guardar, texto, flags=re.S)
    cuerpo = markdown.markdown(texto, extensions=["tables", "fenced_code", "sane_lists"])
    for i, blk in enumerate(bloques):
        cuerpo = cuerpo.replace(f"<p>MERMAID{i}</p>", f'<pre class="mermaid">{html.escape(blk)}</pre>')
    img = f'<img src="{logo}" alt="">' if logo else "<span></span>"
    cab = f'<div class="cab">{img}<div class="t">{html.escape(subtitulo)}</div></div><h1>{html.escape(titulo)}</h1>'
    extra = (MERMAID + "<script>mermaid.initialize({startOnLoad:true,theme:'neutral',securityLevel:'strict'});</script>") if bloques else ""
    return (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{html.escape(titulo)}</title>'
            f'<style>:root{{--marca:{color}}}{CSS}</style></head><body>{cab}{cuerpo}{extra}</body></html>'), len(bloques)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--carpeta", required=True)
    ap.add_argument("archivos", nargs="*")
    a = ap.parse_args()
    P = Path(a.carpeta)
    logo, color, sub = marca(a.config)
    if a.archivos:
        entradas = [P / x if not Path(x).is_absolute() else Path(x) for x in a.archivos]
    else:
        excluir = {"paquete.md", "readme.md"}
        entradas = [p for p in sorted(P.glob("*.md")) if p.name.lower() not in excluir and not p.name.startswith("correo")]
        entradas += [p for p in [P / "manual-usuario.html"] if p.exists()]
    fuente = P / "pdf-fuente"; fuente.mkdir(exist_ok=True)
    sys.path.insert(0, str(Path(__file__).parent))
    fallos = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page()
        for e in entradas:
            if e.suffix.lower() == ".md":
                doc, n = md_a_html(e, logo, color, sub)
                h = fuente / (e.stem + ".html"); h.write_text(doc, encoding="utf-8")
            else:
                h, n = e, 0
            pg.goto(h.resolve().as_uri(), wait_until="networkidle")
            if n:
                pg.wait_for_function(f"document.querySelectorAll('.mermaid svg').length === {n}", timeout=30000)
            pg.pdf(path=str(P / (e.stem + ".pdf")), format="A4", print_background=True,
                   margin={"top": "14mm", "bottom": "16mm", "left": "12mm", "right": "12mm"},
                   display_header_footer=True, header_template="<span></span>", footer_template=PIE)
            from verificar_pdf import problemas
            pr = problemas(str(P / (e.stem + ".pdf")))
            print("pdf", e.stem + ".pdf", "· OK" if not pr else "· REVISAR: " + "; ".join(pr))
            fallos += bool(pr)
        b.close()
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
