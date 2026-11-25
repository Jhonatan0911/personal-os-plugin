"""Arma el proyecto HyperFrames del video tutorial desde un guion JSON (sin editar HTML a mano).

  python -I video.py --guion <P>/video.json --carpeta <P> [--config <fuentes.yaml>]

Copia `plantillas/video-tutorial/` (sonidos, package.json) a <P>/video/, pone las capturas y el logo en
assets/img/ y escribe index.html y una composición por escena. Valida antes de escribir nada: que cada
captura exista, que cada foco de cámara no deje ver lo recortado (cabecera, menú) y que la duración
total quede entre `min_s` y `max_s`. Sale con 1 y la lista de errores si algo no cumple.

Guion (JSON). `*palabra*` marca la palabra en color de acento:
  {"gancho": ["Llega un *paciente*", "¿Ya está *registrado*?"],
   "pasos": [{"titulo": ["Búscalo por *documento*"], "captura": "capturas/01-inicio.png",
              "foco": [680, 331, 1.45], "foco_fin": [1000, 331, 1.45], "clic": [1000, 331], "segundos": 6}],
   "beneficios": ["Busca", "Crea", "Asigna"],          # opcional, 2 a 4 bloques antes del cierre
   "cierre": {"producto": "Nombre del módulo", "ruta": "Menú › Opción"}}
  `foco` = [px, py, zoom] en píxeles de la captura; `foco_fin` (opcional) mueve la cámara; `clic` (opcional)
  muestra el cursor haciendo clic en ese punto al final del movimiento.

Configuración opcional en `paso_produccion.video` de fuentes.yaml:
  recorte: {x: 0, y: 0}   píxeles de la captura que nunca se muestran (menú lateral a la izquierda, cabecera arriba)
  suelo: "#eef2f8"  tinta: "#1f2b53"  acento: <marca.color>
  min_s: 20  max_s: 90
El logo y el color del cierre salen de `paso_produccion.marca` ({logo, color}).
"""
import argparse, html, json, re, shutil, struct, sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

PLANTILLA = Path(__file__).resolve().parents[1] / "plantillas" / "video-tutorial"
W, H = 1020, 780  # ventana donde se ve la captura
T_GANCHO, T_BENEF, T_CIERRE, T_PASO = 4.5, 4.5, 5.5, 6.0


def leer_cfg(ruta):
    if not ruta:
        return {}
    texto = Path(ruta).read_text(encoding="utf-8-sig")
    if str(ruta).lower().endswith((".yaml", ".yml")):
        import yaml
        datos = yaml.safe_load(texto) or {}
    else:
        datos = json.loads(texto)
    return datos.get("paso_produccion") or datos


def tam_png(p):
    """(ancho, alto) de un PNG leyendo su cabecera; None si no es PNG."""
    with open(p, "rb") as f:
        cab = f.read(24)
    if cab[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", cab[16:24])


def palabras(linea, acento_cls="acento"):
    out = []
    for w in linea.split():
        m = re.fullmatch(r"\*(.+)\*([.,;:!?¿¡]*)", w)
        if m:
            # la puntuación va pegada a la palabra (si va en su propio span, sale con espacio: «registrado ?»)
            out.append(f'<span><span class="{acento_cls}">{html.escape(m.group(1))}</span>{html.escape(m.group(2))}</span>')
        else:
            out.append(f"<span>{html.escape(w.replace('*', ''))}</span>")
    return "".join(out)


def validar(guion, carpeta, vcfg):
    err, pasos = [], guion.get("pasos") or []
    rx, ry = (vcfg.get("recorte") or {}).get("x", 0), (vcfg.get("recorte") or {}).get("y", 0)
    if not guion.get("gancho"):
        err.append("falta `gancho` (1 o 2 líneas)")
    if not pasos:
        err.append("falta al menos un paso en `pasos`")
    if not (guion.get("cierre") or {}).get("producto"):
        err.append("falta `cierre.producto`")
    b = guion.get("beneficios") or []
    if b and not 2 <= len(b) <= 4:
        err.append(f"`beneficios` lleva 2 a 4 bloques; trae {len(b)}")
    tamanos = []
    for i, p in enumerate(pasos, 1):
        cap = (carpeta / p.get("captura", "")).resolve() if p.get("captura") else None
        if not cap or not cap.is_file():
            err.append(f"paso {i}: no existe la captura {p.get('captura')!r}")
            tamanos.append(None)
            continue
        t = tam_png(cap)
        if not t:
            err.append(f"paso {i}: {cap.name} no es PNG")
        tamanos.append(t)
        for nombre in ("foco", "foco_fin"):
            f = p.get(nombre)
            if f is None:
                if nombre == "foco":
                    err.append(f"paso {i}: falta `foco` [px, py, zoom]")
                continue
            if len(f) != 3 or f[2] <= 0:
                err.append(f"paso {i}: `{nombre}` debe ser [px, py, zoom>0]")
                continue
            px, py, k = f
            minx, miny = rx + (W / 2) / k, ry + (H / 2) / k
            if px < minx or py < miny:
                err.append(f"paso {i}: `{nombre}` {f} deja ver lo recortado; con zoom {k} pide px ≥ {minx:.0f} y py ≥ {miny:.0f}")
            if t:
                maxx, maxy = t[0] - (W / 2) / k, t[1] - (H / 2) / k
                if px > maxx or py > maxy:
                    err.append(f"paso {i}: `{nombre}` {f} se sale de la captura ({t[0]}x{t[1]}); pide px ≤ {maxx:.0f} y py ≤ {maxy:.0f}")
    total = duracion(guion)
    lo, hi = float(vcfg.get("min_s", 20)), float(vcfg.get("max_s", 90))
    if not lo <= total <= hi:
        err.append(f"el video duraría {total:.1f} s; se espera entre {lo:g} y {hi:g} s (ajusta `segundos` de los pasos)")
    return err, tamanos


def duracion(guion):
    t = T_GANCHO + sum(float(p.get("segundos", T_PASO)) for p in guion.get("pasos") or []) + T_CIERRE
    return t + (T_BENEF if guion.get("beneficios") else 0)


ESTILO_BASE = """#root {{ position: absolute; inset: 0; background: {suelo}; font-family: "Inter", sans-serif; overflow: hidden; }}
    .linea {{ position: absolute; left: 120px; width: 600px; font-size: 66px; font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; color: {tinta}; }}
    .linea span {{ display: inline-block; margin-right: 0.22em; }}
    .acento {{ color: {acento}; }}"""


def comp_gancho(guion, c):
    lineas = guion["gancho"][:2]
    divs = "\n".join(f'    <div class="linea" id="g-t{i}" style="top:{420 + i * 0}px">{palabras(l)}</div>'
                     for i, l in enumerate(lineas, 1))
    # la primera línea ya está en pantalla en t=0: ese fotograma es la miniatura en Teams y WhatsApp
    js = ['tl.fromTo("#g-t1 span", { y: 14 }, { y: 0, duration: 0.5, stagger: 0.05, ease: "expo.out" }, 0);']
    if len(lineas) > 1:
        js = ['gsap.set("#g-t2 span", { opacity: 0 });'] + js + [
            'tl.to("#g-t1 span", { opacity: 0, filter: "blur(6px)", duration: 0.14, stagger: 0.04, ease: "power2.in" }, 1.9);',
            'tl.fromTo("#g-t2 span", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, stagger: 0.08, ease: "power4.out" }, 2.2);']
    js.append(f'tl.to("#root .linea span", {{ opacity: 0, filter: "blur(6px)", duration: 0.14, stagger: 0.03, ease: "power2.in" }}, {T_GANCHO - 0.45});')
    return plantilla_comp("gancho", ESTILO_BASE.format(**c) + "\n    .linea { left: 120px; width: 1500px; font-size: 88px; }",
                          divs, "\n    ".join(js))


def comp_paso(i, p, tam, c, rx, ry):
    seg = float(p.get("segundos", T_PASO))
    ancho, alto = tam or (1440, 900)
    titulo = p.get("titulo") or []
    titulo = [titulo] if isinstance(titulo, str) else titulo
    lineas = "\n".join(f'    <div class="linea" id="p-t{j}" style="top:{420 + (j - 1) * 80}px">{palabras(l)}</div>'
                       for j, l in enumerate(titulo, 1))
    f0, f1 = p["foco"], p.get("foco_fin")
    clic = p.get("clic")
    cuerpo = f"""{lineas}
    <div id="p-win">
      <div id="p-cam">
        <img src="assets/img/{html.escape(Path(p['captura']).name)}" style="position:absolute;left:{-rx}px;top:{-ry}px;width:{ancho}px;height:{alto}px" alt="" />
        <svg id="p-cursor" viewBox="0 0 26 34"><path d="M2 2 L2 28 L9 21 L14 32 L19 30 L14 19 L24 19 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
    </div>"""
    estilo = ESTILO_BASE.format(**c) + f"""
    #p-win {{ position: absolute; left: 780px; top: 150px; width: {W}px; height: {H}px; border-radius: 18px; overflow: hidden;
      background: #ffffff; box-shadow: 0 30px 60px rgba(10, 26, 79, 0.18); }}
    #p-cam {{ position: absolute; left: 0; top: 0; width: {ancho}px; height: {alto}px; }}
    #p-cursor {{ position: absolute; left: 0; top: 0; width: 26px; height: 34px; opacity: 0; }}"""
    js = [f"const W = {W}, H = {H}, RX = {rx}, RY = {ry};",
          "const F = (px, py, k) => ({ x: W / 2 - k * (px - RX), y: H / 2 - k * (py - RY), scale: k });",
          f'gsap.set("#p-cam", {{ transformOrigin: "0 0", ...F({f0[0]}, {f0[1]}, {f0[2]}) }});',
          'tl.fromTo("#p-win", { scale: 1.05, opacity: 0, filter: "blur(10px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, 0);',
          'tl.fromTo("#root .linea span", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, stagger: 0.08, ease: "power4.out" }, 0.3);']
    fin_mov = 1.2
    if f1:
        js.append(f'tl.to("#p-cam", {{ ...F({f1[0]}, {f1[1]}, {f1[2]}), duration: 1.0, ease: "power2.inOut" }}, 1.2);')
        fin_mov = 2.2
    else:  # sin movimiento pedido: acercamiento lento para que la escena no quede muerta (dead_stretch)
        js.append(f'tl.to("#p-cam", {{ ...F({f0[0]}, {f0[1]}, {f0[2] * 1.08:.3f}), duration: {seg - 1.4:.2f}, ease: "sine.inOut" }}, 0.6);')
    if clic:
        k = (f1 or f0)[2]
        cx, cy = clic[0] - rx, clic[1] - ry
        js += [f'tl.set("#p-cursor", {{ scale: {1 / k:.3f}, transformOrigin: "0 0", x: {cx - 160}, y: {cy + 120} }}, {fin_mov});',
               f'tl.to("#p-cursor", {{ opacity: 1, duration: 0.12 }}, {fin_mov});',
               f'tl.to("#p-cursor", {{ x: {cx}, y: {cy}, duration: 0.7, ease: "power3.inOut" }}, {fin_mov + 0.05});',
               f'tl.to("#p-cursor", {{ scale: {0.8 / k:.3f}, duration: 0.06, yoyo: true, repeat: 1 }}, {fin_mov + 0.8});']
    js += [f'tl.to("#root .linea span", {{ opacity: 0, filter: "blur(6px)", duration: 0.14, stagger: 0.03, ease: "power2.in" }}, {seg - 0.45:.2f});',
           f'tl.to("#p-win", {{ opacity: 0, filter: "blur(8px)", duration: 0.3, ease: "power3.in" }}, {seg - 0.35:.2f});']
    return plantilla_comp(f"paso-{i}", estilo, cuerpo, "\n    ".join(js)), seg, (fin_mov + 0.85 if clic else None)


def comp_beneficios(guion, c):
    b = guion["beneficios"]
    ancho = 1680 // len(b)
    tiles = "\n".join(f'    <div class="b-tile" style="left:{120 + n * ancho}px;width:{ancho - 40}px">{html.escape(t)}</div>'
                      for n, t in enumerate(b))
    estilo = ESTILO_BASE.format(**c) + f"""
    .b-tile {{ position: absolute; top: 400px; height: 280px; border-radius: 26px; background: {c['acento']}; color: #fff;
      display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 30px;
      font-size: 64px; font-weight: 700; letter-spacing: -0.02em; }}"""
    js = ['tl.fromTo(".b-tile", { y: 80, opacity: 0, scale: 1.08 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.12, ease: "expo.out" }, 0.1);',
          f'tl.to(".b-tile", {{ opacity: 0, y: -40, duration: 0.3, stagger: 0.05, ease: "power3.in" }}, {T_BENEF - 0.5});']
    return plantilla_comp("beneficios", estilo, tiles, "\n    ".join(js))


def comp_cierre(guion, c):
    ci = guion["cierre"]
    logo = '<img id="k-logo" src="assets/img/logo.png" alt="" />' if c.get("logo") else ""
    ruta = f'<div id="k-ruta">En el menú: <b>{html.escape(ci["ruta"])}</b></div>' if ci.get("ruta") else ""
    estilo = f"""#root {{ position: absolute; inset: 0; background: {c['marca']}; font-family: "Inter", sans-serif; overflow: hidden; }}
    #k-logo {{ position: absolute; left: 660px; top: 300px; width: 600px; height: 180px; object-fit: contain; }}
    #k-prod {{ position: absolute; left: 0; top: 560px; width: 1920px; text-align: center; font-size: 58px; font-weight: 700; color: #ffffff; letter-spacing: -0.015em; }}
    #k-prod span {{ display: inline-block; margin: 0 0.12em; }}
    #k-ruta {{ position: absolute; left: 0; top: 664px; width: 1920px; text-align: center; font-size: 36px; font-weight: 400; color: rgba(255,255,255,0.78); }}
    #k-ruta b {{ color: #ffffff; font-weight: 700; }}"""
    cuerpo = f'    {logo}\n    <div id="k-prod">{palabras(ci["producto"], "x")}</div>\n    {ruta}'
    js = ['gsap.set("#k-prod span", { opacity: 0 });']
    if logo:
        js.append('tl.fromTo("#k-logo", { clipPath: "inset(0% 100% 0% 0%)", scale: 1.06 }, { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 0.7, ease: "expo.out" }, 0.25);')
    js.append('tl.fromTo("#k-prod span", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, stagger: 0.08, ease: "power4.out" }, 1.0);')
    if ruta:
        js.append('tl.fromTo("#k-ruta", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.22, ease: "power4.out" }, 1.7);')
    js.append(f"tl.set({{}}, {{}}, {T_CIERRE - 0.1});")
    return plantilla_comp("cierre", estilo, cuerpo, "\n    ".join(js))


def plantilla_comp(cid, estilo, cuerpo, js):
    return f"""<template>
  <style>
    {estilo}
  </style>
  <div id="root" data-composition-id="{cid}" data-width="1920" data-height="1080">
{cuerpo}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {js}
    window.__timelines["{cid}"] = tl;
  </script>
</template>
"""


def index_html(escenas, sonidos, total, c, con_musica):
    clips = "\n".join(
        f'      <div id="{cid}" class="clip" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html"\n'
        f'        data-start="{ini:g}" data-duration="{dur:g}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>'
        for cid, ini, dur in escenas)
    musica = (f'      <audio id="bgm" class="clip" src="assets/music/bgm.wav" data-start="0" data-duration="{total:g}" data-track-index="2" '
              f'data-volume="0.55" data-fade-in="0.3" data-fade-out="2.5"></audio>') if con_musica else ""
    sfx = "\n".join(f'      <audio id="sfx-{n}" class="clip" src="assets/sfx/{f}" data-start="{t:.2f}" data-duration="{d}" '
                    f'data-track-index="{3 + n % 2}" data-volume="{v}"></audio>' for n, (f, t, d, v) in enumerate(sonidos))
    return f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: {c['suelo']}; }}
      #root {{ position: relative; width: 100%; height: 100%; font-family: "Inter", sans-serif; background: {c['suelo']}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:g}" data-width="1920" data-height="1080">
{clips}
{musica}
{sfx}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--guion", required=True)
    ap.add_argument("--carpeta", required=True, help="carpeta del paquete <P>; las rutas de las capturas son relativas a ella")
    ap.add_argument("--config")
    a = ap.parse_args()

    carpeta = Path(a.carpeta).resolve()
    guion = json.loads(Path(a.guion).read_text(encoding="utf-8-sig"))
    cfg = leer_cfg(a.config)
    vcfg, marca = cfg.get("video") or {}, cfg.get("marca") or {}
    err, tamanos = validar(guion, carpeta, vcfg)
    logo = Path(marca["logo"]) if marca.get("logo") else None
    if logo and not logo.is_file():
        err.append(f"no existe el logo de `marca.logo`: {logo}")
    if err:
        print("El guion del video no cumple:\n- " + "\n- ".join(err))
        sys.exit(1)

    c = {"suelo": vcfg.get("suelo", "#eef2f8"), "tinta": vcfg.get("tinta", "#1f2b53"),
         "acento": vcfg.get("acento") or marca.get("color") or "#134095",
         "marca": marca.get("color") or "#1f2b53", "logo": bool(logo)}
    rec = vcfg.get("recorte") or {}
    rx, ry = rec.get("x", 0), rec.get("y", 0)

    destino = carpeta / "video"
    if destino.exists() and any((destino / "compositions").glob("*.html")):
        respaldo = carpeta / "video.anterior"
        shutil.rmtree(respaldo, ignore_errors=True)
        shutil.copytree(destino, respaldo)
        print(f"Había un proyecto de video: respaldado en {respaldo}")
    shutil.copytree(PLANTILLA, destino, dirs_exist_ok=True)
    (destino / "assets" / "img").mkdir(parents=True, exist_ok=True)
    comp = destino / "compositions"
    comp.mkdir(exist_ok=True)
    for viejo in comp.glob("*.html"):
        viejo.unlink()
    if logo:
        shutil.copy2(logo, destino / "assets" / "img" / "logo.png")

    escenas, sonidos, t = [], [], 0.0
    (comp / "gancho.html").write_text(comp_gancho(guion, c), encoding="utf-8")
    escenas.append(("gancho", t, T_GANCHO))
    t += T_GANCHO
    for i, (p, tam) in enumerate(zip(guion["pasos"], tamanos), 1):
        shutil.copy2(carpeta / p["captura"], destino / "assets" / "img" / Path(p["captura"]).name)
        texto, seg, t_clic = comp_paso(i, p, tam, c, rx, ry)
        (comp / f"paso-{i}.html").write_text(texto, encoding="utf-8")
        escenas.append((f"paso-{i}", t, seg))
        sonidos.append(("whoosh-short.mp3", t - 0.15, 0.57, 0.7))  # causa: entra la ventana
        if t_clic:
            sonidos.append(("click.mp3", t + t_clic, 0.37, 1))  # causa: el cursor hace clic
        t += seg
    if guion.get("beneficios"):
        (comp / "beneficios.html").write_text(comp_beneficios(guion, c), encoding="utf-8")
        escenas.append(("beneficios", t, T_BENEF))
        sonidos.append(("pop.mp3", t + 0.1, 0.72, 0.7))  # causa: entran los bloques (uno solo: superpuestos suenan sucio)
        t += T_BENEF
    (comp / "cierre.html").write_text(comp_cierre(guion, c), encoding="utf-8")
    escenas.append(("cierre", t, T_CIERRE))
    sonidos += [("riser.mp3", max(0, t - 2.5), 3, 0.5), ("impact-bass-1.mp3", t + 0.3, 2, 0.9)]
    t += T_CIERRE

    con_musica = (destino / "assets" / "music" / "bgm.wav").is_file()
    (destino / "index.html").write_text(index_html(escenas, sonidos, t, c, con_musica), encoding="utf-8")
    (destino / "guion.json").write_text(json.dumps(guion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Proyecto del video en {destino} · {len(escenas)} escenas · {t:g} s")
    if not con_musica:
        print(f"Sin música todavía: python scripts/musica.py \"{destino / 'assets' / 'music' / 'bgm.wav'}\" {t:g} \"<prompt>\" "
              f"y vuelve a correr este script para enlazarla.")


if __name__ == "__main__":
    main()
