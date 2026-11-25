"""Toma las capturas del manual de usuario recorriendo la pantalla real con Playwright (Chromium headless).

  python -I capturas.py --guion <guion.json> --salida <P>/capturas

El guion declara la URL, el viewport, el localStorage que la pantalla espera (p. ej. el usuario de sesión
que deja el menú) y los pasos. Pantalla completa sin barra de navegador: no se ve la URL de TEST.
SOLO DATOS FICTICIOS. Un paso que guarda en la base (crear, editar) se marca con "escribe": true y el
script se niega a correrlo sin --permitir-escritura, que solo se pasa con el OK del líder en el chat.

Pasos (todos con "selector" CSS salvo donde se indica):
  {"accion": "ir"}                                    abre la URL del guion
  {"accion": "clic", "selector": "button:has-text('Buscar')"}
  {"accion": "llenar", "selector": "input[formcontrolname='x']", "valor": "PRUEBA"}
  {"accion": "teclear", "selector": "...", "valor": "15/03/1990"}   (calendarios: tecla por tecla + Tab)
  {"accion": "lista", "selector": "p-dropdown[...]", "opcion": "OPCIÓN", "exacta": true}  (PrimeNG dropdown)
  {"accion": "multiple", "selector": "p-multiselect[...]", "opciones": ["OPCIÓN A", "OPCIÓN B"]}
  {"accion": "esperar", "ms": 1500}
  {"accion": "esperar", "selector": "h3:has-text('Nuevo paciente')"}   espera un ESTADO (visible; "estado": "hidden"
                                                                        para que desaparezca un spinner). Preferible al tiempo fijo
  {"accion": "clic", "selector": "...", "espera": "p-card:has-text('Paciente encontrado')"}  clic + espera su resultado
  {"accion": "captura", "nombre": "01-inicio.png"}
  {"accion": "sede"}                                  elige la primera sede del diálogo «Seleccione la sede actual»
  {"accion": "sede", "nombre": "SEDE X"}              elige esa sede; si ya no está en la lista, avisa y toma la primera
  {"accion": "menu", "opcion": "Nombre de la opción"} abre la opción del menú lateral (expande grupos si hace falta)

Un microfrontend se captura DENTRO del menú. Para entrar sin pedirle nada al líder, el guion trae:
  "login": {"credenciales": "~/.claude/<organizacion>/cuenta-test.json",   # {usuario, clave}; fuera de todo repo
            "usuario": "input[formcontrolname='userControl']", "clave": "input[formcontrolname='passwordControl']",
            "boton": "button:has-text('Continuar')"}
Las credenciales nunca se copian al guion, a un documento ni a la salida. Solo cuentas de TEST.
"""
import argparse, json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def correr(guion, salida, permitir_escritura):
    salida.mkdir(parents=True, exist_ok=True)
    escribe = [p for p in guion["pasos"] if p.get("escribe")]
    if escribe and not permitir_escritura:
        sys.exit(f"El guion tiene {len(escribe)} paso(s) que escriben en la base. Pide el OK y corre con --permitir-escritura.")
    vp = guion.get("viewport") or {"width": 1366, "height": 900}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport=vp)
        for k, v in (guion.get("localStorage") or {}).items():
            ctx.add_init_script(f"localStorage.setItem({json.dumps(k)}, {json.dumps(json.dumps(v))});")
        pg = ctx.new_page()
        for i, paso in enumerate(guion["pasos"], 1):
            a, sel = paso["accion"], paso.get("selector")
            if a == "ir":
                pg.goto(guion["url"], wait_until="networkidle", timeout=60000)
                lg = guion.get("login")
                if lg and pg.locator(lg["usuario"]).count():
                    cred = json.loads(Path(lg["credenciales"]).expanduser().read_text(encoding="utf-8"))
                    pg.fill(lg["usuario"], cred["usuario"]); pg.fill(lg["clave"], cred["clave"])
                    pg.click(lg["boton"]); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(2500)
            elif a == "sede":
                if pg.get_by_text("Seleccione la sede actual").count():
                    pg.locator(".p-dialog .p-dropdown").first.click()
                    items = pg.locator(".p-dropdown-items li")
                    items.first.wait_for(state="visible", timeout=10000)
                    elegida = items.filter(has_text=paso["nombre"]) if paso.get("nombre") else items
                    if paso.get("nombre") and not elegida.count():
                        # La sede pedida ya no está en la lista del usuario: se toma la primera y se avisa.
                        print(f"aviso: la sede «{paso['nombre']}» no está en la lista; se usa la primera")
                        elegida = items
                    elegida.first.click()
                    pg.locator(".p-dialog button:has-text('Guardar')").first.click()
                    pg.locator(".p-dialog").first.wait_for(state="hidden", timeout=15000)
                    pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1500)
            elif a == "menu":
                def enlace(txt):   # el <a> del ítem del menú (el texto interno no recibe el clic)
                    return pg.locator("li[app-menuitem] a, nav a, aside a").filter(
                        has_text=re.compile(rf"^\s*{re.escape(txt)}\s*$"))
                op = enlace(paso["opcion"])
                href = op.first.get_attribute("href") if op.count() else None
                if href:   # lo más estable: navegar a la ruta del ítem (el menú queda alrededor igual)
                    pg.goto(re.match(r"https?://[^/]+", pg.url).group(0) + href, wait_until="networkidle")
                    pg.wait_for_timeout(4000)
                    pg.wait_for_timeout(int(paso.get("despues_ms", 300)))
                    continue
                if not (op.count() and op.first.is_visible()):
                    for txt in paso.get("grupos", ["Configuracion", "Configuración"]):
                        for g in enlace(txt).all():
                            if op.count() and op.first.is_visible():
                                break
                            try:
                                g.click(timeout=3000); pg.wait_for_timeout(600)
                            except Exception:
                                pass
                op.first.scroll_into_view_if_needed()
                op.first.click(timeout=5000)
                pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(4000)
            elif a == "clic":
                pg.locator(sel).first.click()
                pg.wait_for_load_state("networkidle")
                if paso.get("espera"):     # selector que debe aparecer tras el clic (p. ej. el resultado)
                    pg.locator(paso["espera"]).first.wait_for(state="visible", timeout=20000)
            elif a == "llenar":
                pg.locator(sel).first.fill(paso["valor"])
            elif a == "teclear":
                c = pg.locator(sel).first
                c.click(); c.press_sequentially(paso["valor"], delay=60); pg.keyboard.press("Tab")
            elif a == "lista":
                pg.locator(sel).first.click(); pg.wait_for_timeout(500)
                items = pg.locator(".p-dropdown-items li:visible")
                patron = rf"^\s*{re.escape(paso['opcion'])}\s*$" if paso.get("exacta") else re.escape(paso["opcion"])
                items.filter(has_text=re.compile(patron)).first.click()
                pg.wait_for_load_state("networkidle")
            elif a == "multiple":
                pg.locator(sel).first.click(); pg.wait_for_timeout(600)
                for o in paso["opciones"]:
                    pg.locator(".p-multiselect-items li:visible").filter(has_text=o).first.click()
                pg.keyboard.press("Escape")
            elif a == "esperar":
                if paso.get("selector"):   # espera el ESTADO, no un tiempo fijo
                    pg.locator(paso["selector"]).first.wait_for(
                        state=paso.get("estado", "visible"), timeout=int(paso.get("ms", 20000)))
                else:
                    pg.wait_for_timeout(int(paso.get("ms", 1000)))
            elif a == "captura":
                pg.wait_for_timeout(800)
                pg.screenshot(path=str(salida / paso["nombre"]), full_page=True)
                print("captura", paso["nombre"])
            else:
                sys.exit(f"Paso {i}: acción desconocida «{a}»")
            pg.wait_for_timeout(int(paso.get("despues_ms", 300)))
        b.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--guion", required=True)
    ap.add_argument("--salida", required=True)
    ap.add_argument("--permitir-escritura", action="store_true")
    a = ap.parse_args()
    correr(json.loads(Path(a.guion).read_text(encoding="utf-8")), Path(a.salida), a.permitir_escritura)
