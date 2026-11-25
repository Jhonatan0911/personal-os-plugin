"""Revisa un PDF ya generado, tal como lo verá quien lo recibe (renderizado con pymupdf), no el HTML.

  python -I verificar_pdf.py <archivo.pdf> [--sangrado] [--paginas N]

--sangrado  pieza a sangre (comunicado): ningún borde puede salir blanco (franja = algo se salió del ancho).
--paginas N número exacto de páginas esperado (el comunicado es 1).
Sale con 0 si está bien y 1 con la lista de problemas. Lo llaman comunicado.py y pdf.py al terminar.
Nació el 24/11/2026: el HTML del comunicado se veía bien y el PDF traía una barra blanca a la derecha.
"""
import sys


def problemas(ruta, sangrado=False, paginas=None, umbral=245, tolerancia=0.05):
    import pymupdf
    doc = pymupdf.open(ruta)
    out = []
    if paginas is not None and len(doc) != paginas:
        out.append(f"tiene {len(doc)} página(s); se esperaban {paginas}")
    for n, pg in enumerate(doc, 1):
        pix = pg.get_pixmap(dpi=50)
        w, h = pix.width, pix.height
        def blanco(c):
            return min(c[:3]) > umbral
        if sangrado:
            bordes = {
                "derecho": [pix.pixel(w - 1, y) for y in range(0, h, max(1, h // 60))],
                "izquierdo": [pix.pixel(0, y) for y in range(0, h, max(1, h // 60))],
                "inferior": [pix.pixel(x, h - 1) for x in range(0, w, max(1, w // 60))],
                "superior": [pix.pixel(x, 0) for x in range(0, w, max(1, w // 60))],
            }
            for nombre, muestras in bordes.items():
                frac = sum(blanco(c) for c in muestras) / len(muestras)
                if frac > tolerancia:
                    out.append(f"página {n}: franja blanca en el borde {nombre} ({frac:.0%} del borde)")
        else:
            # documento normal: el contenido no puede tocar el borde derecho (señal de que se salió del ancho)
            col = [pix.pixel(w - 2, y) for y in range(0, h, max(1, h // 80))]
            if sum(not blanco(c) for c in col) / len(col) > 0.5:
                out.append(f"página {n}: el contenido llega al borde derecho (posible desborde de ancho)")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    ruta = args[0]
    pags = int(args[args.index("--paginas") + 1]) if "--paginas" in args else None
    p = problemas(ruta, sangrado="--sangrado" in args, paginas=pags)
    print("\n".join(p) if p else f"OK {ruta}")
    sys.exit(1 if p else 0)
