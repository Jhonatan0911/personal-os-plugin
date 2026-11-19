import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

import yaml

SKILL = Path(__file__).resolve().parents[2]
BUILD = SKILL / "scripts" / "build.py"


def correr(*args):
    r = subprocess.run([sys.executable, "-I", str(BUILD), *args], capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout + r.stderr


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.conf = self.tmp / "config"
        (self.conf / "reglas-empresa").mkdir(parents=True)
        reg = yaml.safe_load((SKILL / "plantillas" / "registro-ejemplo.yaml").read_text(encoding="utf-8"))
        reg["salida"]["rules"] = str(self.tmp / "rules")
        reg["bloqueos"]["servidores"]["deny"] = ["10.0.0.5"]
        self.reg = reg
        self.guardar()
        (self.conf / "reglas-empresa" / "repos.yaml").write_text("nuevos: [api-nueva]\nlegados: []\n", encoding="utf-8")
        (self.conf / "fuentes.yaml").write_text("jira:\n  sitio: x\n", encoding="utf-8")
        self.home = self.tmp / "oshome"

    def guardar(self):
        (self.conf / "reglas-empresa" / "registro.yaml").write_text(
            yaml.safe_dump(self.reg, allow_unicode=True, sort_keys=False), encoding="utf-8")

    def build(self, *extra):
        return correr("--config-dir", str(self.conf), "--os-home", str(self.home), "--estado", str(self.tmp / "estado"), *extra)

    def test_genera_todo(self):
        rc, out = self.build()
        self.assertEqual(rc, 0, out)
        self.assertIn("RE-001", (self.tmp / "rules" / "00-nucleo.md").read_text(encoding="utf-8"))
        archivo = (self.tmp / "rules" / "20-guia-de-arquitectura-backend.md").read_text(encoding="utf-8")
        self.assertTrue(archivo.startswith("---\npaths:"))
        self.assertIn("api-nueva", archivo)
        self.assertEqual(json.loads((self.home / "guardia-empresa.json").read_text(encoding="utf-8"))["servidores_deny"], ["10.0.0.5"])
        f = yaml.safe_load((self.conf / "fuentes.yaml").read_text(encoding="utf-8"))
        self.assertEqual(f["revision_pr"]["proyectos_nuevos"]["repos_nuevos"], ["api-nueva"])
        self.assertEqual(f["revision_pr"]["azure_devops"]["organizacion"], "<organizacion>")
        self.assertEqual([r["id"] for r in f["reglas_empresa"]["por_skill"]["planear-sprint"]], ["RE-002", "RE-020"])
        self.assertEqual(f["jira"]["sitio"], "x")

    def test_idempotente(self):
        self.build()
        rc, out = self.build()
        self.assertNotIn("[cambia]", out)
        self.assertNotIn("[nuevo]", out)

    def test_error_no_escribe(self):
        self.reg["reglas"].append(dict(self.reg["reglas"][0]))
        self.guardar()
        rc, out = self.build()
        self.assertEqual(rc, 1)
        self.assertIn("id repetido", out)
        self.assertFalse((self.tmp / "rules").exists())

    def test_marcador_viejo_y_seccion_a_mano(self):
        f = self.conf / "fuentes.yaml"
        f.write_text("jira: {}\n# >>> revision_pr (texto viejo)\nrevision_pr: {}\n# <<< revision_pr\n", encoding="utf-8")
        rc, out = self.build()
        self.assertEqual(rc, 0, out)
        self.assertEqual(f.read_text(encoding="utf-8").count("revision_pr:"), 1)
        f.write_text("revision_pr:\n  a: 1\n", encoding="utf-8")
        shutil.rmtree(self.tmp / "rules", ignore_errors=True)
        rc, out = self.build()
        self.assertNotEqual(rc, 0)
        self.assertFalse((self.tmp / "rules").exists())

    def test_vista(self):
        rc, _ = self.build("--vista", str(self.tmp / "v.html"))
        self.assertEqual(rc, 0)
        pagina = (self.tmp / "v.html").read_text(encoding="utf-8")
        self.assertIn("Convenciones de desarrollo", pagina)
        self.assertIn("nadie se conecta", pagina)            # texto_equipo manda en la página
        self.assertNotIn("Nunca conectarse", pagina)         # el texto para el asistente no sale
        self.assertIn("Política de acceso a datos", pagina)  # fuente_equipo

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
