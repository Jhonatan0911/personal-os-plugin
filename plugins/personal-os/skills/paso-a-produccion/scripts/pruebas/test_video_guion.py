"""video.py valida el guion antes de escribir nada y arma el proyecto con el guion bueno (25/11/2026)."""
import json, struct, subprocess, sys, tempfile, unittest, zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "video.py"


def png(ruta, w=1440, h=900):
    fila = b"\x00" + b"\xff\xff\xff" * w
    datos = zlib.compress(fila * h)
    trozo = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                     + trozo(b"IDAT", datos) + trozo(b"IEND", b""))


class VideoGuionTest(unittest.TestCase):
    def setUp(self):
        self.p = Path(tempfile.mkdtemp())
        (self.p / "capturas").mkdir()
        png(self.p / "capturas" / "01.png")
        (self.p / "cfg.json").write_text(json.dumps({"paso_produccion": {"video": {"recorte": {"x": 300, "y": 62}}}}),
                                         encoding="utf-8")

    def correr(self, guion):
        (self.p / "video.json").write_text(json.dumps(guion), encoding="utf-8")
        r = subprocess.run([sys.executable, "-I", str(SCRIPT), "--guion", str(self.p / "video.json"),
                            "--carpeta", str(self.p), "--config", str(self.p / "cfg.json")],
                           capture_output=True, text=True, encoding="utf-8")
        return r.returncode, r.stdout

    def guion(self, **cambios):
        g = {"gancho": ["Hola *mundo*"], "pasos": [
            {"titulo": ["Paso"], "captura": "capturas/01.png", "foco": [800, 450, 1.2], "segundos": 12}],
             "cierre": {"producto": "Módulo", "ruta": "Menú › Opción"}}
        g.update(cambios)
        return g

    def test_guion_bueno_arma_el_proyecto(self):
        rc, out = self.correr(self.guion())
        self.assertEqual(rc, 0, out)
        v = self.p / "video"
        self.assertTrue((v / "index.html").is_file())
        self.assertTrue((v / "compositions" / "paso-1.html").is_file())
        self.assertTrue((v / "assets" / "img" / "01.png").is_file())
        self.assertIn('data-duration="22"', (v / "index.html").read_text(encoding="utf-8"))

    def test_foco_que_muestra_lo_recortado_se_rechaza(self):
        g = self.guion()
        g["pasos"][0]["foco"] = [400, 100, 1.2]
        rc, out = self.correr(g)
        self.assertEqual(rc, 1)
        self.assertIn("deja ver lo recortado", out)
        self.assertFalse((self.p / "video").exists())  # nada escrito

    def test_foco_fuera_de_la_captura_se_rechaza(self):
        g = self.guion()
        g["pasos"][0]["foco_fin"] = [1400, 450, 1.2]
        rc, out = self.correr(g)
        self.assertIn("se sale de la captura", out)

    def test_captura_inexistente_y_duracion(self):
        g = self.guion()
        g["pasos"][0]["captura"] = "capturas/no.png"
        g["pasos"][0]["segundos"] = 200
        rc, out = self.correr(g)
        self.assertEqual(rc, 1)
        self.assertIn("no existe la captura", out)
        self.assertIn("duraría", out)

    def test_puntuacion_pegada_al_acento(self):
        rc, _ = self.correr(self.guion(gancho=["¿Ya está *registrado*?"]))
        html = (self.p / "video" / "compositions" / "gancho.html").read_text(encoding="utf-8")
        self.assertIn('<span class="acento">registrado</span>?</span>', html)


if __name__ == "__main__":
    unittest.main()
