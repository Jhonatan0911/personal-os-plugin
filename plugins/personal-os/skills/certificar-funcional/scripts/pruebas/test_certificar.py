"""Pruebas de certificar-funcional: matriz desde la especificación, verificación y retro. Sin red.

  python -I -m unittest discover -s <skill>/scripts/pruebas -v
"""
import csv, os, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

AQUI = Path(__file__).parent
SCRIPTS = AQUI.parent
sys.path.insert(0, str(SCRIPTS))
import base, matriz  # noqa: E402

COLS = matriz.COLUMNAS


def correr(script, *args, ok=True):
    r = subprocess.run([sys.executable, "-I", str(SCRIPTS / script), *map(str, args)], capture_output=True, text=True,
                       encoding="utf-8", env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    if ok and r.returncode != 0:
        raise AssertionError(f"{script} falló: {r.stderr or r.stdout}")
    return r.stdout


def escribir_csv(ruta, filas):
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLS)
        for x in filas:
            w.writerow([x.get(c, "") for c in COLS])


class Certificar(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.exp = self.tmp / "expediente.json"
        shutil.copy(AQUI / "expediente_ejemplo.json", self.exp)
        ev = self.tmp / "evidencias"
        for i in ("CA-1", "CA-2", "QA-1", "MF-1"):
            (ev / i).mkdir(parents=True)
            (ev / i / "resultado.txt").write_text(f"Prueba {i} con PAC-0001: resultado correcto", encoding="utf-8")
        (ev / "CA-2" / "pantalla.png").write_bytes(b"\x89PNG\r\n")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def llena(self, **cambios):
        filas = []
        for f in matriz.filas_esperadas(base.leer_json(self.exp)):
            filas.append({"ID": f["ID"], "Qué se verifica": f["Qué se verifica"], "Pasos": "1. Entrar con PAC-0001",
                          "Resultado obtenido": "Como se esperaba", "Estado": "OK", **cambios.get(f["ID"], {})})
        return filas

    def test_filas_esperadas(self):
        ids = [f["ID"] for f in matriz.filas_esperadas(base.leer_json(self.exp))]
        self.assertEqual(ids, ["CA-1", "CA-2", "QA-1", "MF-1"])  # el modo de falla sin a_regresion no entra

    def test_genera_y_lee_los_tres_formatos(self):
        for ext in ("xlsx", "csv", "md"):
            salida = self.tmp / f"m.{ext}"
            correr("matriz.py", "--expediente", self.exp, "--salida", salida)
            filas, _ = matriz.leer(salida)
            self.assertEqual([f["id"] for f in filas], ["CA-1", "CA-2", "QA-1", "MF-1"], ext)
            self.assertTrue(all(base.estado(f["estado"]) == "pendiente" for f in filas), ext)

    def test_plantilla_existente_por_nombre_de_columna(self):
        import openpyxl
        wb = openpyxl.Workbook()
        wb.active.title = "00 Resumen"
        ws = wb.create_sheet("01 Matriz de pruebas")
        ws.append(["ID", "Módulo", "Funcionalidad", "Escenario", "Tipo de prueba", "Origen", "Prioridad", "Objetivo",
                   "Pasos", "Resultado esperado", "Evidencia requerida", "Resultado obtenido", "Estado", "Observaciones"])
        wb.save(self.tmp / "plantilla.xlsx")
        salida = self.tmp / "con-plantilla.xlsx"
        out = correr("matriz.py", "--expediente", self.exp, "--salida", salida, "--plantilla", self.tmp / "plantilla.xlsx")
        self.assertIn("01 Matriz de pruebas", out)
        ws = openpyxl.load_workbook(salida)["01 Matriz de pruebas"]
        self.assertEqual(ws["A5"].value, "MF-1")
        self.assertEqual(ws["G5"].value, "Crítica")
        self.assertEqual(ws["E5"].value, "Regresión")
        self.assertEqual(ws["M2"].value, "Pendiente")

    def test_matriz_completa_certifica_y_escribe_el_expediente(self):
        m = self.tmp / "llena.csv"
        escribir_csv(m, self.llena())
        out = correr("verificar_matriz.py", "--expediente", self.exp, "--matriz", m, "--imagenes-revisadas", "--escribir",
                     "--salida", self.tmp / "v.json", "--fecha", "2026-11-12")
        self.assertIn("certificada", out)
        v = base.leer_json(self.tmp / "v.json")
        self.assertEqual(v["veredicto"], "certificada")
        exp = base.leer_json(self.exp)
        self.assertEqual(len(exp["matriz_pruebas"]), 4)
        self.assertEqual({m["estado"] for m in exp["matriz_pruebas"]}, {"ok"})
        self.assertEqual(exp["chequeos"]["p5"]["estado"], "aceptado")

    def test_imagen_sin_revisar_deja_incompleta(self):
        m = self.tmp / "llena.csv"
        escribir_csv(m, self.llena())
        v = correr("verificar_matriz.py", "--expediente", self.exp, "--matriz", m)
        self.assertIn("incompleta", v)
        self.assertIn("pantalla.png", v)

    def test_datos_reales_rechazan(self):
        m = self.tmp / "con-datos.csv"
        escribir_csv(m, self.llena(**{"CA-1": {"Resultado obtenido": "Paciente: Pedro Gómez Ruiz, CC 1.023.456.789"}}))
        (self.tmp / "evidencias" / "MF-1" / "log.txt").write_text("celular " + "300" + "1234567", encoding="utf-8")
        correr("verificar_matriz.py", "--expediente", self.exp, "--matriz", m, "--imagenes-revisadas",
               "--salida", self.tmp / "v.json")
        v = base.leer_json(self.tmp / "v.json")
        self.assertEqual(v["veredicto"], "rechazada")
        tipos = {d["tipo"] for d in v["datos_personales"]}
        self.assertEqual(tipos, {"nombre", "documento", "celular"})
        texto = (self.tmp / "v.json").read_text(encoding="utf-8")
        self.assertNotIn("1.023.456.789", texto)
        self.assertNotIn("Gómez Ruiz", texto)

    def test_sinteticos_y_seudonimos_no_rechazan(self):
        det = base.Detector(base.cargar_config())
        self.assertEqual(det.buscar("Paciente: Prueba Uno Sintético, documento PAC-0001", "x"), [])
        self.assertEqual(len(det.buscar("Paciente: Ana María Rojas", "x")), 1)

    def test_falla_faltante_y_sin_evidencia(self):
        m = self.tmp / "parcial.csv"
        filas = self.llena(**{"CA-2": {"Estado": "Falla"}})
        filas = [f for f in filas if f["ID"] != "QA-1"]
        escribir_csv(m, filas)
        shutil.rmtree(self.tmp / "evidencias" / "MF-1")
        correr("verificar_matriz.py", "--expediente", self.exp, "--matriz", m, "--imagenes-revisadas",
               "--salida", self.tmp / "v.json")
        v = base.leer_json(self.tmp / "v.json")
        self.assertEqual(v["veredicto"], "no_certificada")
        self.assertEqual(v["faltan"], ["QA-1"])
        self.assertTrue(any("MF-1" in p and "sin evidencia" in p for p in v["problemas"]))

    def test_retro(self):
        out = correr("retro.py", "--expediente", self.exp, "--horas-reales", "13", "--leccion", "Pedir los CA antes del PR",
                     "--escribir", "--fecha", "2026-11-13")
        self.assertIn('"pr_devueltos": 1', out)
        exp = base.leer_json(self.exp)
        self.assertEqual(exp["retro"]["horas_estimadas"], 10)
        self.assertEqual(exp["retro"]["desvio_pct"], 30.0)
        self.assertEqual(exp["retro"]["lecciones"], ["Pedir los CA antes del PR"])
        self.assertFalse(exp["retro"]["enviada"])


if __name__ == "__main__":
    unittest.main()
