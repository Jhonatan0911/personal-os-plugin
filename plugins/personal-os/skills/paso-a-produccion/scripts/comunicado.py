"""Comunicado (boletín de una página con diseño) para anunciar una funcionalidad nueva a los usuarios.

  python -I comunicado.py --config <fuentes.yaml> --contenido <P>/comunicado.json --carpeta <P>

Escribe <P>/comunicado.html, comunicado.png (Teams / WhatsApp) y comunicado.pdf (correo).
El logo y el color salen de `paso_produccion.marca`. Contenido (JSON):
  {"titulo": "...", "kicker": "Área · Cliente", "subtitulo": "...", "etiqueta": "NOVEDAD",
   "captura": "<P>/capturas/xx.png",
   "beneficios": [{"icono": "buscar|crear|servicios|solicitud", "titulo": "...", "texto": "..."}, ... 2 o 4],
   "pie": "texto con <b>negrillas</b> permitidas", "cta": "Menú › Opción"}
Solo datos ficticios en la captura. Mira el PNG antes de entregarlo: nada tapado ni cortado.
"""
import argparse, base64, html, json
from pathlib import Path
import yaml
from playwright.sync_api import sync_playwright

ICO = {
 "buscar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
 "crear": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6"/></svg>',
 "servicios": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l2 2 4-4M7 15h10"/></svg>',
 "solicitud": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7M10 14L21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--contenido", required=True)
    ap.add_argument("--carpeta", required=True)
    a = ap.parse_args()
    P = Path(a.carpeta)
    c = json.loads(Path(a.contenido).read_text(encoding="utf-8"))
    m = (yaml.safe_load(Path(a.config).read_text(encoding="utf-8")).get("paso_produccion") or {}).get("marca") or {}
    logo = "data:image/png;base64," + base64.b64encode(Path(m["logo"]).read_bytes()).decode() if m.get("logo") else ""
    cap = "data:image/png;base64," + base64.b64encode(Path(c["captura"]).read_bytes()).decode()
    tarjetas = "\n".join(
        f'  <div class="card"><div class="ico">{ICO.get(b.get("icono"), ICO["servicios"])}</div><div><b>{html.escape(b["titulo"])}</b>'
        f'<span>{html.escape(b["texto"])}</span></div></div>' for b in c["beneficios"])
    HTML = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{html.escape(c['titulo'])}</title>
<style>
:root{{--marca:#0A1A4F;--azul:#134095;--medio:#1860A5;--cielo:#E6ECF7;--tinta:#1F2B53;--gris:#5A6275;--ok:#1E6B45}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:"Segoe UI","Segoe UI Variable",system-ui,sans-serif;color:var(--tinta);background:#fff}}
@page{{size:1080px auto;margin:0}}html,body{{margin:0;padding:0;width:1080px;background:#F4F7FC;overflow:hidden}}.hoja{{width:1080px;position:relative;overflow:hidden;background:#F4F7FC}}
.hero{{background:linear-gradient(135deg,#0A1A4F 0%,#134095 62%,#1860A5 100%);color:#fff;padding:52px 64px 140px;position:relative}}
.hero:after{{content:"";position:absolute;right:-120px;top:-120px;width:460px;height:460px;border-radius:50%;background:rgba(255,255,255,.06)}}
.hero:before{{content:"";position:absolute;right:120px;top:200px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.05)}}
.top{{display:flex;justify-content:space-between;align-items:center}}
.top img{{height:46px}}
.chip{{background:#fff;color:var(--azul);font-weight:700;font-size:20px;letter-spacing:.08em;padding:10px 22px;border-radius:999px}}
.kicker{{margin-top:52px;font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#C9D6EE;font-weight:600}}
h1{{font-size:68px;line-height:1.02;margin:14px 0 18px;font-weight:800;max-width:860px}}
.sub{{font-size:28px;line-height:1.4;color:#DCE5F5;max-width:820px;margin:0}}
.captura{{margin:-110px 64px 0;background:#fff;border-radius:22px;padding:14px;box-shadow:0 24px 60px rgba(10,26,79,.28);position:relative}}
.captura img{{width:100%;display:block;border-radius:12px;aspect-ratio:1366/640;object-fit:cover;object-position:top}}
.sec{{padding:44px 64px 0}}
.sec h2{{font-size:34px;margin:0 0 22px;font-weight:800}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}
.card{{background:#fff;border-radius:18px;padding:24px 26px;display:flex;gap:18px;align-items:flex-start;box-shadow:0 6px 18px rgba(10,26,79,.07)}}
.ico{{flex:0 0 58px;height:58px;border-radius:16px;background:var(--cielo);color:var(--azul);display:flex;align-items:center;justify-content:center}}
.ico svg{{width:30px;height:30px}}
.card b{{display:block;font-size:24px;margin-bottom:4px}}
.card span{{font-size:20px;line-height:1.4;color:var(--gris)}}
.pie{{margin-top:44px;background:var(--marca);color:#fff;padding:30px 64px;display:flex;justify-content:space-between;align-items:center}}
.pie .quien{{font-size:20px;color:#C9D6EE;line-height:1.45;max-width:640px}}
.pie .quien b{{color:#fff}}
.pie .cta{{background:#fff;color:var(--marca);font-weight:800;font-size:22px;padding:16px 26px;border-radius:14px}}
</style></head><body><div class="hoja">
<div class="hero">
  <div class="top"><img src="{logo}" alt="Logo"><div class="chip">{html.escape(c.get('etiqueta','NOVEDAD'))}</div></div>
  <div class="kicker">{html.escape(c['kicker'])}</div>
  <h1>{html.escape(c['titulo'])}</h1>
  <p class="sub">{html.escape(c['subtitulo'])}</p>
</div>
<div class="captura"><img src="{cap}" alt=""></div>
<div class="sec"><h2>¿Qué hay de nuevo?</h2>
<div class="grid">
{tarjetas}
</div></div>
<div class="pie">
  <div class="quien">{c["pie"]}</div>
  <div class="cta">{html.escape(c["cta"])}</div>
</div>
</div></body></html>"""
    (P / "comunicado.html").write_text(HTML, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1500}, device_scale_factor=2)
        pg.goto((P / "comunicado.html").resolve().as_uri(), wait_until="load")
        alto = int(pg.evaluate("document.querySelector('.hoja').getBoundingClientRect().height"))
        pg.set_viewport_size({"width": 1080, "height": alto})
        pg.screenshot(path=str(P / "comunicado.png"))
        pg.pdf(path=str(P / "comunicado.pdf"), width="1080px", height=f"{alto}px", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from verificar_pdf import problemas
    p = problemas(str(P / "comunicado.pdf"), sangrado=True, paginas=1)
    if p:
        print("EL PDF DEL COMUNICADO NO SALE BIEN (no entregar):\n- " + "\n- ".join(p))
        sys.exit(1)
    print("comunicado.html / .png / .pdf · PDF verificado: 1 página, sin franjas blancas")


if __name__ == "__main__":
    main()
