"""Base de Playwright para la pasada por pantalla de la regresión guiada (fase 7).
Sacada de lo que funcionó en una corrida real. Copiar a <mesa>/.regresion/.

Variables de entorno:
  REGV_VISIBLE=1     muestra el Chromium en pantalla (si el responsable quiere verlo)
  REGV_SLOWMO=400    cámara lenta en ms (solo tiene sentido con REGV_VISIBLE=1)
  REGRESION_MESA     carpeta de la mesa
  REGV_ZONA / REGV_LOCALE  zona horaria y locale del navegador (por defecto, los de <mesa>/kit/perfil.json)

Reglas que ya están resueltas aquí:
  - Todo el tráfico del navegador pasa por el proxy-sumidero (127.0.0.1:4809); solo localhost queda directo.
  - Login como el mismo usuario del periodo sin conocer su clave: el front lee localStorage REGV_LOGIN
    (cambio LOCAL sin commit en el front, ver PANTALLAS.md del repo) o se inyecta el token que emite el servicio de autenticación del sistema.
  - El campo de clave del login no admite pegar: se TECLEA (tipear), nunca fill.
  - Capturas siempre enmascaradas (mask) y registradas en ejecucion/capturas.jsonl.
  - Cada paso queda en ejecucion/pantallas.jsonl (la compuerta de la fase 7 lo exige).
"""
import datetime, json, os, re, unicodedata
from contextlib import contextmanager
from playwright.sync_api import sync_playwright

MESA = os.environ.get("REGRESION_MESA", os.getcwd())
PROXY = {"server": "http://127.0.0.1:4809", "bypass": "localhost,127.0.0.1,[::1]"}
try:
    _PERFIL = json.load(open(os.path.join(MESA, "kit", "perfil.json"), encoding="utf-8-sig"))
except Exception:
    _PERFIL = {}
ZONA = os.environ.get("REGV_ZONA") or _PERFIL.get("zona_horaria") or None
LOCALE = os.environ.get("REGV_LOCALE") or _PERFIL.get("locale") or "es-CO"

# Selectores de datos de persona que se tapan en TODA captura. Cada grupo agrega los suyos desde PANTALLAS.md.
MASCARA_BASE = [
    "[formcontrolname*='ombre' i]", "[formcontrolname*='pellido' i]", "[formcontrolname*='ocumento' i]",
    "[formcontrolname*='elefono' i]", "[formcontrolname*='elular' i]", "[formcontrolname*='orreo' i]",
    "[formcontrolname*='mail' i]", "[formcontrolname*='ireccion' i]", "[formcontrolname*='identificacion' i]",
    ".datos-paciente", ".paciente-info", "app-header-paciente",
]
# Tablas con listados de PERSONAS (pacientes, usuarios): agrégalas por pantalla con mascara_extra=[MASCARA_TABLAS].
MASCARA_TABLAS = "table tbody"


def sitio(app, ruta=""):
    """URL de un front según el modo. <mesa>/kit/sitios.json:
    {"modo": "staging" | "local", "local": {"citas": "http://localhost:4202"},
     "staging": {"citas": "https://<sitio-de-staging>"}}
    Post-publicación = "staging": las páginas desplegadas, nunca producción. Variable REGV_MODO manda."""
    j = json.load(open(os.path.join(MESA, "kit", "sitios.json"), encoding="utf-8-sig"))
    modo = os.environ.get("REGV_MODO") or j.get("modo", "local")
    base = j[modo][app].rstrip("/")
    return f"{base}/{ruta.lstrip('/')}" if ruta else base


def credencial_prueba(rol):
    """Usuario y clave de PRUEBA de staging para un rol (credenciales/usuarios-prueba.json: {"<rol>": {"usuario":..,"clave":..}}).
    En staging desplegado no existe el atajo local REGV_LOGIN: se entra por el login real. Nunca se imprime."""
    j = json.load(open(os.path.join(MESA, "credenciales", "usuarios-prueba.json"), encoding="utf-8-sig"))
    return j[rol]["usuario"], j[rol]["clave"]


def login(pg, url, usuario, clave, sel_usuario, sel_clave, sel_entrar):
    """Login real (selectores desde PANTALLAS.md). La clave se teclea: el campo no admite pegar."""
    pg.goto(url, wait_until="networkidle", timeout=120000)
    pg.locator(sel_usuario).fill(usuario)
    tipear(pg, sel_clave, clave)
    pg.locator(sel_entrar).click()
    pg.wait_for_load_state("networkidle", timeout=120000)


def primer_ingreso(pg, rol, clave_actual):
    """Si el login cae en /auth/change-password (usuario recién creado), cambia la clave por una aleatoria,
    la guarda en credenciales/usuarios-prueba.json y vuelve a entrar. Devuelve True si hubo cambio."""
    if "change-password" not in pg.url:
        return False
    import secrets, string
    nueva = "Qa" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8)) + "9#"
    tipear(pg, "input[formcontrolname='currentPassword']", clave_actual)
    tipear(pg, "input[formcontrolname='newPassword']", nueva)
    tipear(pg, "input[formcontrolname='confirmNewPassword']", nueva)
    pg.locator("button:has-text('Continuar')").last.click()
    pg.wait_for_timeout(5000)
    ruta = os.path.join(MESA, "credenciales", "usuarios-prueba.json")
    j = json.load(open(ruta, encoding="utf-8-sig"))
    j[rol]["clave"] = nueva
    j[rol]["_clave_cambiada"] = datetime.datetime.now().isoformat(timespec="seconds")
    json.dump(j, open(ruta, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return True


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


def _jsonl(nombre, d):
    ruta = os.path.join(MESA, "ejecucion", nombre)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "a", encoding="utf-8") as f:
        f.write(json.dumps({"t": datetime.datetime.now().isoformat(timespec="seconds"), **d}, ensure_ascii=False) + "\n")


@contextmanager
def navegador():
    visible = os.environ.get("REGV_VISIBLE") == "1"
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=not visible, slow_mo=int(os.environ.get("REGV_SLOWMO", "0")), proxy=PROXY)
        try:
            yield nav
        finally:
            nav.close()


def pagina(nav, usuario=None, token=None, clave_token="token"):
    """Contexto con la zona horaria del perfil. usuario -> localStorage REGV_LOGIN; token -> localStorage[clave_token].
    El token nunca se imprime ni se guarda en evidencias."""
    ctx = nav.new_context(**({"timezone_id": ZONA} if ZONA else {}), locale=LOCALE, viewport={"width": 1440, "height": 1100})
    if usuario:
        ctx.add_init_script(f"try {{ localStorage.setItem('REGV_LOGIN', {json.dumps(usuario)}); }} catch (e) {{}}")
    if token:
        ctx.add_init_script(f"try {{ localStorage.setItem({json.dumps(clave_token)}, {json.dumps(token)}); }} catch (e) {{}}")
    pg = ctx.new_page()
    pg._regv = {"api": [], "errores": []}
    pg.on("response", lambda r: pg._regv["api"].append(f"{r.request.method} {r.url.split('?')[0][-120:]} -> {r.status}")
          if r.request.resource_type in ("xhr", "fetch") else None)
    pg.on("response", lambda r: pg._regv["errores"].append(f"HTTP {r.status} {r.url[:140]}") if r.status >= 400 else None)
    pg.on("requestfailed", lambda q: pg._regv["errores"].append(f"FALLA {q.method} {q.url[:140]}"))
    return pg


def tipear(pg, selector, valor, demora=55):
    """Para campos que bloquean pegar (la clave del login). No imprime el valor."""
    e = pg.locator(selector)
    e.click()
    e.press_sequentially(valor, delay=demora)


def multisel(pg, control, texto):
    """Combo angular2-multiselect por formcontrolname. Busca coincidencia exacta normalizada y luego parcial."""
    m = pg.locator(f"angular2-multiselect[formcontrolname='{control}']")
    m.locator(".c-btn").first.click(); pg.wait_for_timeout(500)
    busc = m.locator("input.c-input")
    if busc.count() and busc.first.is_visible():
        busc.first.fill(str(texto).split(" ")[-1][:20]); pg.wait_for_timeout(600)
    items = m.locator("li.pure-checkbox")
    ops = [t.strip() for t in items.all_inner_texts()]
    obj = norm(texto)
    idx = next((i for i, t in enumerate(ops) if norm(t) == obj), None)
    if idx is None:
        idx = next((i for i, t in enumerate(ops) if obj in norm(t) or (norm(t) in obj and len(norm(t)) > 6)), None)
    if idx is None:
        pg.keyboard.press("Escape"); pg.mouse.click(5, 300)
        raise LookupError(f"{control}: no aparece '{texto}' ({len(ops)} opciones)")
    items.nth(idx).click(); pg.wait_for_timeout(300)
    pg.keyboard.press("Escape"); pg.mouse.click(5, 300); pg.wait_for_timeout(1300)
    return ops[idx]


def select_nativo(pg, control, texto):
    """<select formcontrolname=...> o p-dropdown sencillo por texto visible."""
    sel = pg.locator(f"select[formcontrolname='{control}']")
    if sel.count():
        sel.select_option(label=texto)
        return texto
    dd = pg.locator(f"p-dropdown[formcontrolname='{control}']")
    dd.click(); pg.wait_for_timeout(400)
    pg.locator("li.p-dropdown-item, li[role='option']").filter(has_text=texto).first.click()
    return texto


def hora(pg, n, h, m):
    """n-ésimo ngb-timepicker, en 24 h (corrige AM/PM si el control es de 12 h)."""
    tp = pg.locator("ngb-timepicker").nth(n)
    tp.locator("input[aria-label='Hours']").fill(str(h % 12 or 12))
    tp.locator("input[aria-label='Minutes']").fill(f"{m:02d}")
    tp.locator("input[aria-label='Minutes']").press("Tab")
    btn = tp.locator("button.ngb-tp-meridian, button:has-text('m.')").first
    if btn.count() and ("p" in btn.inner_text().lower()) != (h >= 12):
        btn.click()


def swal(pg, confirmar=True, maximo=4):
    """Lee (y confirma) los SweetAlert que salgan. Devuelve sus textos: son el 'mensaje' del caso."""
    textos = []
    for _ in range(maximo):
        sw = pg.locator(".swal2-popup:visible")
        if not sw.count():
            break
        textos.append(re.sub(r"\s+", " ", sw.first.inner_text())[:300])
        ok = sw.locator("button.swal2-confirm:visible")
        if not (confirmar and ok.count()):
            break
        ok.first.click(); pg.wait_for_timeout(1200)
    return textos


def captura(pg, repo, flujo, caso, paso, mascara_extra=(), enmascarable=True):
    """Captura de página completa con los datos de persona tapados. Registra en ejecucion/capturas.jsonl."""
    carpeta = os.path.join(MESA, "evidencias", "capturas", repo)
    os.makedirs(carpeta, exist_ok=True)
    archivo = os.path.join(carpeta, f"{flujo}-{caso}-{paso}.png")
    mascara = [pg.locator(s) for s in list(MASCARA_BASE) + list(mascara_extra)]
    pg.screenshot(path=archivo, full_page=True, mask=mascara if enmascarable else [], mask_color="#1F2B53")
    _jsonl("capturas.jsonl", {"archivo": os.path.relpath(archivo, MESA), "repo": repo, "pantalla": pg.url.split("?")[0],
                              "caso": caso, "paso": paso, "enmascarada": bool(enmascarable), "revisada": False})
    return archivo


def registrar(pg, repo, pantalla, accion, usuario, resultado, mensaje="", caso=None):
    """Una línea por paso en ejecucion/pantallas.jsonl (compuerta de la fase 7). resultado: ok|error|diferente|validacion."""
    _jsonl("pantallas.jsonl", {"repo": repo, "pantalla": pantalla, "accion": accion, "usuario": usuario, "caso": caso,
                               "resultado": resultado, "mensaje": mensaje[:300],
                               "api": pg._regv["api"][-15:], "errores": pg._regv["errores"][-10:]})
    pg._regv["api"].clear(); pg._regv["errores"].clear()
