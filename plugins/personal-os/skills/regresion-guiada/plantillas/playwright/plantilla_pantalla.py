"""PLANTILLA: reproducir por pantalla una operación del periodo de referencia. Copiar como <mesa>/.regresion/pw_<flujo>.py y
llenar desde conocimiento/<repo>/PANTALLAS.md (selectores y orden) y golden/<flujo>.jsonl (qué digitar).

Uso: python -I pw_<flujo>.py [--solo N] [--desde N]      (REGV_VISIBLE=1 REGV_SLOWMO=400 para verlo en pantalla)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_base import (MESA, navegador, pagina, sitio, credencial_prueba, login, multisel, select_nativo, hora, swal,
                     captura, registrar)

REPO = "<repo-del-front>"              # p. ej. citas-frontend
FLUJO = "<flujo>"                      # p. ej. crear-agenda
APP = "<app>"                          # clave en kit/sitios.json, p. ej. "citas"
URL = sitio(APP, "<ruta>")             # local o staging desplegado según kit/sitios.json / REGV_MODO
MODO = os.environ.get("REGV_MODO") or json.load(open(os.path.join(MESA, "kit", "sitios.json"), encoding="utf-8-sig")).get("modo", "local")
LOGIN = dict(sel_usuario="<sel>", sel_clave="<sel>", sel_entrar="<sel>")   # de PANTALLAS.md
GOLDEN = os.path.join(MESA, "golden", f"{FLUJO}.jsonl")
MASCARA = []                           # selectores extra de datos de persona de esta pantalla (PANTALLAS.md)

arg = lambda n, d=None: next((int(sys.argv[i + 1]) for i, a in enumerate(sys.argv) if a == n and i + 1 < len(sys.argv)), d)
casos = [json.loads(l) for l in open(GOLDEN, encoding="utf-8") if l.strip()]
casos = casos[arg("--desde", 0):][: arg("--solo", len(casos))]

with navegador() as nav:
    for i, c in enumerate(casos):
        if MODO == "staging":                        # sitio desplegado: login real con usuario de prueba del mismo rol
            usuario, clave = credencial_prueba(c["rol"])
            pg = pagina(nav)
        else:                                        # local: el mismo usuario del periodo por REGV_LOGIN
            usuario, clave = c["usuario"], None
            pg = pagina(nav, usuario=usuario)
        try:
            if clave:
                login(pg, sitio(APP), usuario, clave, **LOGIN)
            pg.goto(URL, wait_until="networkidle", timeout=120000); pg.wait_for_timeout(1500)
            captura(pg, REPO, FLUJO, i, "01-inicio", MASCARA)
            # --- Campos en el orden de PANTALLAS.md; cada valor sale del golden ---
            # multisel(pg, "SSede_Id", c["sede"])
            # select_nativo(pg, "TipoDocumento", c["tipo_documento"])
            # hora(pg, 0, c["hora_ini_h"], c["hora_ini_m"])
            # pg.locator("[formcontrolname='Observacion']").fill(c["observacion"])
            captura(pg, REPO, FLUJO, i, "02-lleno", MASCARA)
            # pg.get_by_role("button", name="Guardar").click()
            mensajes = swal(pg)
            captura(pg, REPO, FLUJO, i, "03-resultado", MASCARA)
            resultado = "ok"  # comparar con lo que quedó en el periodo (fase 7, paso 3) -> ok | diferente | validacion
            registrar(pg, REPO, FLUJO, "guardar", usuario, resultado, " / ".join(mensajes), caso=i)
        except Exception as e:
            try: captura(pg, REPO, FLUJO, i, "x-error", MASCARA)
            except Exception: pass
            registrar(pg, REPO, FLUJO, "guardar", usuario, "error", f"{type(e).__name__}: {e}", caso=i)
        finally:
            pg.context.close()
        print(f"caso {i}: listo")             # nunca imprimir datos de pacientes
