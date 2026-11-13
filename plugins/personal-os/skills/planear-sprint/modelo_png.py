"""Convierte el modelo de BD de una subtarea en una imagen PNG, igual al diagrama de la página.

Uso:
  python modelo_png.py <plan.json | documento de la base> <id o parte del título de la subtarea> <salida.png>

El dibujo sale de las mismas funciones de la plantilla del cronograma (erLayout/erSvg), así que la imagen
es idéntica a lo que el líder aprobó. Necesita Microsoft Edge o Google Chrome instalados (modo headless).
La imagen se sube a la subtarea de Jira con uploadAttachmentToJiraIssue y se incrusta en la descripción
(ver references/cronograma.md, «Modelo de BD en Jira»).
"""
import json, os, re, shutil, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
PLANTILLA = os.path.join(AQUI, "cronograma-plantilla.html")
NAVEGADORES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
COLORES = ("--bg:#FFFFFF;--panel:#F1F5F9;--card:#FFFFFF;--ink:#222222;--muted:#5A6275;--soft:#9CA3AF;--line:#E2E8F0;"
           "--action:#134095;--mid:#1860A5;--f-body:'Segoe UI',system-ui,Arial,sans-serif;--f-mono:Consolas,'Cascadia Mono',monospace")


def falla(m):
    print("error: " + m, file=sys.stderr); sys.exit(1)


def funcion(js, nombre):
    i = js.find("function " + nombre + "(")
    if i < 0:
        falla(f"no encontré la función {nombre} en la plantilla")
    j = js.index("{", i); prof = 0; k = j
    while True:
        if js[k] == "{": prof += 1
        elif js[k] == "}":
            prof -= 1
            if prof == 0: return js[i:k + 1]
        k += 1


def buscar_modelo(datos, clave):
    items = datos.get("items") or [x for h in datos.get("historias", []) for x in h.get("items", [])]
    for it in items:
        if it.get("modelo") and (it.get("id") == clave or clave.lower() in it.get("titulo", "").lower()):
            return it
    falla(f"ninguna subtarea con modelo coincide con «{clave}»")


def navegador():
    for n in NAVEGADORES + [shutil.which("msedge") or "", shutil.which("google-chrome") or "", shutil.which("chromium") or ""]:
        if n and os.path.exists(n): return n
    falla("no encontré Edge ni Chrome para dibujar la imagen")


def main():
    if len(sys.argv) != 4:
        falla(__doc__.strip().splitlines()[2].strip())
    datos = json.load(open(sys.argv[1], encoding="utf-8"))
    it = buscar_modelo(datos, sys.argv[2])
    js = open(PLANTILLA, encoding="utf-8").read()
    codigo = "\n".join(funcion(js, n) for n in ("esc", "erTab", "erLayout", "erSvg"))
    m = it["modelo"]
    titulo = it["titulo"]
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>:root{{{COLORES}}}
body{{margin:0;background:#F1F5F9;font-family:var(--f-body)}}
.h{{padding:14px 24px 0;color:#1F2B53;font:600 15px var(--f-body)}}.s{{padding:2px 24px 0;color:#5A6275;font:12px var(--f-body)}}</style></head>
<body><div class="h" id="h"></div><div class="s">Tablas nuevas en azul · existentes (solo lectura) en gris · 🔑 llave primaria · 🔗 referencia · ? admite null · {"aprobado por el líder el " + m["aprobado"]["fecha"] if m.get("aprobado") else "sin aprobar"}</div>
<div id="c"></div><script>let ERZ=1;{codigo}
const M={json.dumps(m, ensure_ascii=False)};document.getElementById("h").textContent={json.dumps("Modelo de BD · " + titulo, ensure_ascii=False)};
document.getElementById("c").innerHTML=erSvg(M);const s=document.querySelector("svg");document.title=s.getAttribute("width")+"x"+s.getAttribute("height");</script></body></html>"""
    tmp = tempfile.mkdtemp(prefix="modelo_png_")
    ruta = os.path.join(tmp, "modelo.html")
    open(ruta, "w", encoding="utf-8").write(html)
    # tamaño: calcula el del SVG con el mismo layout (ancho y alto vienen en el título tras cargar)
    nav = navegador()
    dump = subprocess.run([nav, "--headless=new", "--disable-gpu", "--dump-dom", "file:///" + ruta.replace("\\", "/")],
                          capture_output=True, text=True, encoding="utf-8", timeout=60).stdout
    t = re.search(r"<title>(\d+)x(\d+)</title>", dump)
    if not t: falla("no pude medir el diagrama")
    w, h = int(t.group(1)), int(t.group(2)) + 60
    salida = os.path.abspath(sys.argv[3])
    subprocess.run([nav, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--window-size={w},{h}", f"--screenshot={salida}", "file:///" + ruta.replace("\\", "/")],
                   capture_output=True, timeout=60)
    shutil.rmtree(tmp, ignore_errors=True)
    if not os.path.exists(salida): falla("el navegador no generó la imagen")
    print(f"ok {salida} · {len(m['tablas'])} tablas · {w}x{h} px (x2)")


if __name__ == "__main__":
    main()
