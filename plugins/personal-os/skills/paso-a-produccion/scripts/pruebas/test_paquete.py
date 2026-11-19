import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "paquete.py"

CONFIG = {"paso_produccion": {
    "normativa": "POL-1", "aprobador": "Arquitectura",
    "entregables": [
        {"id": "funcional", "nombre": "Especificación funcional", "campos": ["historias"], "archivos": ["funcional.*"]},
        {"id": "tecnica", "nombre": "Especificación técnica", "campos": ["documentacion.tecnica"]},
        {"id": "impacto", "nombre": "Análisis de impacto"},
    ],
    "aprobaciones": [{"id": "cliente", "nombre": "Aprobación del cliente"}],
}}


def correr(*args):
    r = subprocess.run([sys.executable, "-I", str(SCRIPT), *args], capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout


class PaqueteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.cfg = self.tmp / "fuentes.json"
        self.cfg.write_text(json.dumps(CONFIG), encoding="utf-8")
        d = self.tmp / "requerimientos" / "demo-1"
        d.mkdir(parents=True)
        self.exp = d / "expediente.json"
        self.exp.write_text(json.dumps({"id": "demo-1", "titulo": "Demo", "jira": "ABC-12",
                                        "historias": [{"clave": "ABC-13", "criterios": []}],
                                        "documentacion": {"tecnica": {}}}), encoding="utf-8")

    def test_incompleto_por_clave(self):
        rc, out = correr("--caso", "ABC-13", "--raiz", str(self.tmp), "--config", str(self.cfg))
        self.assertEqual(rc, 1)
        res = json.loads((self.exp.parent / "paso-produccion" / "paquete.json").read_text(encoding="utf-8"))
        self.assertEqual(res["faltan"], ["tecnica", "impacto", "cliente"])
        self.assertIn("INCOMPLETO", out)

    def test_completo_con_archivos(self):
        p = self.exp.parent / "paso-produccion"
        (p / "aprobaciones").mkdir(parents=True)
        (p / "tecnica.md").write_text("x", encoding="utf-8")
        (p / "impacto.md").write_text("x", encoding="utf-8")
        (p / "aprobaciones" / "cliente.pdf").write_text("x", encoding="utf-8")
        rc, _ = correr("--caso", "demo-1", "--raiz", str(self.tmp), "--config", str(self.cfg), "--escribir")
        self.assertEqual(rc, 0)
        exp = json.loads(self.exp.read_text(encoding="utf-8"))
        self.assertTrue(exp["paso_produccion"]["completo"])

    def test_jira_como_objeto(self):
        d = self.tmp / "requerimientos" / "otro"
        d.mkdir(parents=True)
        (d / "expediente.json").write_text(json.dumps({"id": "otro", "jira": {"epica": "XYZ-7", "historias": ["XYZ-8"]}}),
                                           encoding="utf-8")
        rc, out = correr("--caso", "xyz-8", "--raiz", str(self.tmp), "--config", str(self.cfg))
        self.assertEqual(rc, 1)
        self.assertTrue((d / "paso-produccion" / "paquete.json").exists())

    def test_sin_expediente(self):
        rc, _ = correr("--caso", "NO-1", "--raiz", str(self.tmp), "--config", str(self.cfg))
        self.assertEqual(rc, 2)


if __name__ == "__main__":
    unittest.main()
