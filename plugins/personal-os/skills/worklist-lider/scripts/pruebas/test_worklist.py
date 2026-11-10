"""Pruebas de worklist-lider: build.py, cargar.py y sync-jira.py con una carpeta de estado temporal. Sin red.

  python -I -m unittest discover -s <skill>/scripts/pruebas -v

Si hay Node en el PATH (o en $NODE), además revisa la sintaxis del JS de la página construida.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).parent
SCRIPTS = AQUI.parent

FUENTES_BASE = """owner:
  nombre: "<Tu nombre>"
jira:
  sitio: "<tu-sitio>.atlassian.net"
  cloud_id: "<cloudId>"
equipo:
  - nombre: "Ana"
    account_id: "acc-ana"
"""
FUENTES_FLUJO = """owner:
  nombre: "Líder de prueba"
jira:
  sitio: "ejemplo.atlassian.net"
  cloud_id: "00000000-0000-0000-0000-000000000000"
status_celula:
  estados:
    revision: ["Por revisar", "QA interno*"]
flujo:
  niveles_activos: {activos}
  nivel_por_defecto: "C"
  niveles:
    A: {{ nombre: "Trámite o configuración", minutos_lider: "10-15", pasos: {{ p0: corto, p5: evidencia }} }}
    B: {{ nombre: "Bug o incidente", minutos_lider: "30-60", pasos: {{ p0: corto, p1: corto, p4: ia_y_humana, p5: evidencia, p6: corto }} }}
    C: {{ nombre: "Requerimiento o proyecto", pasos: {{ p0: completo, p1: completo, p2: completo, p3: completo, p4: completo, p5: matriz, p6: completo }} }}
"""


def chequeos(pasos, estado_p0="aceptado"):
    return {f"p{i}": {"estado": (estado_p0 if i == 0 else "pendiente")} for i in pasos}


def exp_completo(slug, nivel=None):
    E = {
        "esquema": 2, "id": slug, "tipo": "requerimiento", "titulo": "Reporte de ventas de Cliente A",
        "jira": ["PROY-142"], "modulos": ["reportes"],
        "cabecera": {"descripcion_corta": "Un reporte", "cliente": "Cliente A", "solicitante": "Coordinación",
                     "motivo": "Auditoría", "para_que": "Cuadrar ventas", "expectativas": "alta",
                     "pedido_por_gerencia": False, "prioridad_wsjf": 3.5, "fecha_compromiso": "2026-03-20",
                     "responsables": ["Ana"]},
        "paso_actual": 3, "chequeos": chequeos(range(7)),
        "impacto": {"criticidad_modulo": {"transaccionalidad": 3, "dinero": 4, "norma": 2, "usuarios": 3, "reversibilidad": 2},
                    "peso_operacion": "Medio", "modos_falla": [{"modo": "Totales mal", "efecto": "Cuadre", "severidad": 4, "a_regresion": True}]},
        "historias": [{"clave": "PROY-142", "titulo": "Reporte", "criterios": [{"id": "CA-1", "texto": "Suma bien"}]}],
        "subtareas": [{"clave": "PROY-150", "titulo": "Consulta", "que_hacer": "Escribir la consulta", "horas": 3}],
        "calidad": [{"id": "QA-1"}], "adr": [{"id": "ADR-1"}], "proyectos": [{"repo": "api"}],
        "cortes": [{"fecha": "2026-03-10", "que_se_revisa": "Consulta", "criterios": ["CA-1"], "responsable": "Ana",
                    "tipo": "revision_lider", "estado": "pendiente", "nota": ""}],
        "compromisos": [{"id": "K1", "fecha": "2026-03-20", "que": "Reporte en producción", "a_quien": "Cliente A",
                         "fuente": "F1", "estado": "vigente", "reemplaza": None, "nota": ""}],
        "pendientes": [{"id": "P1", "texto": "¿Incluye anuladas?", "a_quien": "Cliente A", "desde": "2026-03-01",
                        "bloquea": ["CA-1"], "estado": "abierto"}],
        "documentacion": {"tecnica": "docs/reporte.md"}, "retro": {},
    }
    if nivel:
        E["nivel"] = nivel
    return E


def exp_corto(slug, nivel, ficha=True, extra_chequeos=None):
    pasos = {"A": (0, 5), "B": (0, 1, 4, 5, 6)}[nivel]
    E = {"esquema": 2, "id": slug, "tipo": "bug" if nivel == "B" else "requerimiento", "nivel": nivel,
         "titulo": "Plantilla de mensajería" if nivel == "A" else "Error al guardar", "jira": ["PROY-201"],
         "modulos": ["mensajeria"], "cabecera": {"responsables": ["Luis"]}, "paso_actual": 0,
         "chequeos": chequeos(pasos),
         "cortes": [{"fecha": "2026-03-05", "que_se_revisa": "Plantilla aprobada", "responsable": "Luis",
                     "tipo": "tercero", "estado": "pendiente"}]}
    if ficha:
        E["ficha_corta"] = {"que": "Cambiar la plantilla", "para_cuando": "2026-03-06", "quien_pidio": "Cliente A",
                            "evidencia_cierre": "Captura de la plantilla aprobada", "fuente": "F1"}
    for k, v in (extra_chequeos or {}).items():
        E["chequeos"][k] = v
    return E


def correr(script, *args, ok=True):
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    r = subprocess.run([sys.executable, "-I", str(SCRIPTS / script), *map(str, args)], capture_output=True,
                       text=True, encoding="utf-8", env=env)
    if ok and r.returncode != 0:
        raise AssertionError(f"{script} falló ({r.returncode}): {r.stderr or r.stdout}")
    return r


class Base(unittest.TestCase):
    fuentes = FUENTES_BASE

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="wl-"))
        (self.tmp / "config").mkdir()
        (self.tmp / "config" / "fuentes.yaml").write_text(self.fuentes, encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def poner(self, E):
        d = self.tmp / "requerimientos" / E["id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "expediente.json").write_text(json.dumps(E, ensure_ascii=False), encoding="utf-8")

    def cargar(self, ok=True):
        r = correr("cargar.py", "--estado", self.tmp, ok=ok)
        carga = self.tmp / "worklist" / "carga"
        return r, json.loads((carga / "resumen.json").read_text(encoding="utf-8")), carga

    def construir(self):
        correr("build.py", "--estado", self.tmp)
        return (self.tmp / "worklist" / "worklist.html").read_text(encoding="utf-8")


class SinFlujo(Base):
    def test_completo_y_sin_nivel_como_siempre(self):
        self.poner(exp_completo("reporte-ventas"))
        self.poner(exp_completo("con-nivel", nivel="A"))
        r, res, carga = self.cargar()
        self.assertTrue(res["reporte-ventas"]["valido"])
        self.assertIsNone(res["reporte-ventas"]["nivel"])
        self.assertEqual(res["reporte-ventas"]["completitud"], 100)
        self.assertIn("flujo completo", " ".join(res["con-nivel"]["avisos"]))
        req = json.loads((carga / "req-reporte-ventas.json").read_text(encoding="utf-8"))
        self.assertEqual(req["completitud"], 100)
        self.assertEqual(req["proximo_corte"]["responsable"], "Ana")
        self.assertIn("revision_lider · Ana", r.stdout)
        lote = json.loads((carga / "lote.json").read_text(encoding="utf-8"))
        self.assertEqual(len(lote["lotes"][0]), 4)

    def test_expediente_corto_sin_flujo_no_valida(self):
        self.poner(exp_corto("plantilla", "A"))  # sin flujo recorre el completo: faltan chequeos p1-p6
        r, res, _ = self.cargar(ok=False)
        self.assertEqual(r.returncode, 1)
        self.assertFalse(res["plantilla"]["valido"])

    def test_pagina_neutra_sin_niveles(self):
        html = self.construir()
        self.assertNotRegex(html, r"__[A-Z_]+__")
        cfg = json.loads(re.search(r"const CFG=(\{.*?\});\n", html).group(1))
        self.assertFalse(cfg["flujo"]["activos"])
        self.assertEqual(cfg["jira"]["cloud_id"], "")
        self.assertEqual(cfg["jira"]["web"], "")
        self.assertEqual(cfg["lider"], "")
        self.assertNotIn("<img", html)
        revisar_js(self, html)


class ConFlujo(Base):
    fuentes = FUENTES_FLUJO.format(activos="true")

    def test_niveles(self):
        self.poner(exp_completo("reporte-ventas", nivel="C"))
        self.poner(exp_completo("sin-nivel"))
        self.poner(exp_corto("plantilla", "A", extra_chequeos={"p3": {"estado": "hecho"}}))
        self.poner(exp_corto("error-guardar", "B"))
        r, res, carga = self.cargar()
        self.assertEqual(res["sin-nivel"]["nivel"], "C")
        self.assertEqual(res["plantilla"]["nivel"], "A")
        self.assertEqual(res["plantilla"]["pasos"], ["p0", "p5"])
        # A: 4 de la ficha + responsables + paso actual + chequeo p0 = 7, todos llenos
        self.assertEqual(res["plantilla"]["completitud"], 100)
        self.assertIn("se carga como no_aplica", " ".join(res["plantilla"]["avisos"]))
        E = json.loads((carga / "expediente-plantilla.json").read_text(encoding="utf-8"))
        self.assertEqual(E["chequeos"]["p3"]["estado"], "no_aplica")
        self.assertEqual(E["chequeos"]["p2"]["estado"], "no_aplica")
        self.assertEqual(E["completitud"]["nivel"], "A")
        self.assertLess(E["completitud_niveles"]["C"]["porcentaje"], 50)
        req = json.loads((carga / "req-plantilla.json").read_text(encoding="utf-8"))
        self.assertEqual(req["nivel"], "A")
        self.assertEqual(req["ficha_corta"]["para_cuando"], "2026-03-06")
        self.assertEqual(req["fecha_compromiso"], "2026-03-06")
        self.assertEqual(req["proximo_corte"]["tipo"], "tercero")
        # B: además «módulo ubicado» (p1 corto)
        self.assertEqual(res["error-guardar"]["completitud"], 100)
        self.assertNotIn("Módulo ubicado en el mapa de criticidad", res["reporte-ventas"]["por_completar"])

    def test_ficha_corta_obligatoria_y_nivel_inexistente(self):
        self.poner(exp_corto("sin-ficha", "A", ficha=False))
        E = exp_completo("nivel-raro")
        E["nivel"] = "Z"
        self.poner(E)
        r, res, _ = self.cargar(ok=False)
        self.assertEqual(r.returncode, 1)
        self.assertIn("ficha_corta: obligatoria", " ".join(res["sin-ficha"]["errores"]))
        self.assertIn("no existe en flujo.niveles", " ".join(res["nivel-raro"]["errores"]))

    def test_pagina_con_niveles(self):
        html = self.construir()
        cfg = json.loads(re.search(r"const CFG=(\{.*?\});\n", html).group(1))
        self.assertTrue(cfg["flujo"]["activos"])
        self.assertEqual(sorted(cfg["flujo"]["niveles"]), ["A", "B", "C"])
        self.assertEqual(cfg["flujo"]["niveles"]["A"]["pasos"], {"p0": "corto", "p5": "evidencia"})
        self.assertEqual(cfg["jira"]["web"], "https://ejemplo.atlassian.net/browse/")
        self.assertEqual(cfg["revision"], ["Por revisar", "QA interno*"])
        revisar_js(self, html)

    def test_marca(self):
        logo = self.tmp / "config" / "logo.svg"
        logo.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', encoding="utf-8")
        marca = self.tmp / "config" / "marca.json"
        marca.write_text(json.dumps({"nombre": "Mi empresa", "logo": "logo.svg", "claro": {"--marca": "#123456"}}), encoding="utf-8")
        correr("build.py", "--estado", self.tmp, "--marca", marca)
        html = (self.tmp / "worklist" / "worklist.html").read_text(encoding="utf-8")
        self.assertIn(":root{--marca:#123456}", html)
        self.assertIn('alt="Mi empresa"', html)

    def test_sync_jira(self):
        self.poner(exp_completo("reporte-ventas", nivel="C"))
        resp = {"issues": {"nodes": [
            {"key": "PROY-142", "fields": {"summary": "Reporte", "status": {"name": "En curso", "statusCategory": {"key": "indeterminate"}}}},
            {"key": "PROY-150", "fields": {"summary": "Consulta", "status": {"name": "Por revisar"}, "timeoriginalestimate": 10800,
                                           "updated": "2026-03-04T10:00:00", "parent": {"key": "PROY-142"}}},
            {"key": "PROY-151", "fields": {"summary": "Pruebas", "status": {"name": "QA interno (equipo)"},
                                           "parent": {"key": "PROY-142"}}},
            {"key": "OTRO-9", "fields": {"summary": "Suelta", "status": {"name": "Por revisar"}}},
        ]}}
        ruta = self.tmp / "resp.json"
        ruta.write_text(json.dumps(resp), encoding="utf-8")
        correr("sync-jira.py", "--estado", self.tmp, "--hoy", "2026-03-05", ruta)
        E = json.loads((self.tmp / "requerimientos" / "reporte-ventas" / "expediente.json").read_text(encoding="utf-8"))
        self.assertEqual(E["cola_revision"]["claves"], ["PROY-150", "PROY-151"])
        self.assertEqual(E["cola_revision"]["horas"], 3.0)
        cola = json.loads((self.tmp / "requerimientos" / "_cola_revision.json").read_text(encoding="utf-8"))
        self.assertEqual(cola["tareas"], 3)
        self.assertEqual([g["slug"] for g in cola["grupos"]], ["reporte-ventas", None])
        self.assertEqual(cola["grupos"][0]["nivel"], "C")
        q = correr("sync-jira.py", "--estado", self.tmp, "--consultas").stdout
        self.assertIn("key in (PROY-142, PROY-150)", q)
        self.assertIn("statusCategory != Done", q)  # hay un estado con prefijo


class NivelesInactivos(Base):
    fuentes = FUENTES_FLUJO.format(activos="false")

    def test_todo_completo(self):
        self.poner(exp_completo("reporte-ventas", nivel="A"))
        _, res, _ = self.cargar()
        self.assertIsNone(res["reporte-ventas"]["nivel"])
        self.assertEqual(res["reporte-ventas"]["completitud"], 100)
        self.assertIn("niveles_activos es false", " ".join(res["reporte-ventas"]["avisos"]))
        cfg = json.loads(re.search(r"const CFG=(\{.*?\});\n", self.construir()).group(1))
        self.assertFalse(cfg["flujo"]["activos"])


def node():
    for c in (os.environ.get("NODE"), shutil.which("node"), r"C:\nvm4w\nodejs\node.exe"):
        if c and os.path.exists(c):
            return c
    return None


def revisar_js(test, html):
    n = node()
    if not n:
        return
    js = re.search(r"<script>(.*)</script>", html, re.S).group(1)
    ruta = Path(tempfile.mkdtemp(prefix="wl-js-")) / "pagina.js"
    ruta.write_text(js, encoding="utf-8")
    r = subprocess.run([n, "--check", str(ruta)], capture_output=True, text=True)
    shutil.rmtree(ruta.parent, ignore_errors=True)
    test.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
