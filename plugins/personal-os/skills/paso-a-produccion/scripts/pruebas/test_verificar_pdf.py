"""El caso del 24/11/2026: un adorno que se sale del ancho deja una franja blanca en el PDF del comunicado."""
import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verificar_pdf import problemas


def pdf_de(html, ancho=600, alto=800):
    from playwright.sync_api import sync_playwright
    d = Path(tempfile.mkdtemp())
    (d / "p.html").write_text(html, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": ancho, "height": alto})
        pg.goto((d / "p.html").as_uri())
        pg.pdf(path=str(d / "p.pdf"), width=f"{ancho}px", height=f"{alto}px", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    return str(d / "p.pdf")


BASE = "<style>html,body{margin:0}.hoja{width:600px;height:800px;background:#0A1A4F;position:relative;%s}" \
       ".adorno{position:absolute;right:-200px;top:0;width:400px;height:400px;border-radius:50%%;background:#134095}</style>" \
       "<div class='hoja'><div class='adorno'></div></div>"


class VerificarPdfTest(unittest.TestCase):
    def test_adorno_desbordado_deja_franja_y_se_detecta(self):
        p = problemas(pdf_de(BASE % ""), sangrado=True, paginas=1)
        self.assertTrue(any("franja blanca" in x for x in p), p)

    def test_con_recorte_no_hay_franja(self):
        html = "<style>html,body{overflow:hidden}</style>" + BASE % "overflow:hidden"
        self.assertEqual(problemas(pdf_de(html), sangrado=True, paginas=1), [])

    def test_paginas_de_mas(self):
        html = "<style>html,body{margin:0}</style><div style='height:2000px;background:#0A1A4F'></div>"
        p = problemas(pdf_de(html), sangrado=True, paginas=1)
        self.assertTrue(any("página(s)" in x for x in p), p)


if __name__ == "__main__":
    unittest.main()
