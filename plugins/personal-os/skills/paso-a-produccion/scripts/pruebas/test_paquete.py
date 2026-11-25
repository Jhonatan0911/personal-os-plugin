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

    # --- Calidad del contenido (24/11/2026): un archivo con el nombre correcto no basta ---
    def _cfg_calidad(self, requiere):
        cfg = json.loads(json.dumps(CONFIG))
        cfg["paso_produccion"]["entregables"] = [{"id": "manual", "nombre": "Manual", "requiere": requiere}]
        cfg["paso_produccion"]["aprobaciones"] = []
        self.cfg.write_text(json.dumps(cfg), encoding="utf-8")
        p = self.exp.parent / "paso-produccion"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _estado(self):
        rc, _ = correr("--caso", "demo-1", "--raiz", str(self.tmp), "--config", str(self.cfg))
        res = json.loads((self.exp.parent / "paso-produccion" / "paquete.json").read_text(encoding="utf-8"))
        return rc, res["filas"][0]

    def test_manual_sin_capturas_ni_pdf_queda_incompleto(self):
        p = self._cfg_calidad({"pdf": True, "imagenes": 2})
        (p / "manual.html").write_text("<p>[Captura: buscar]</p>", encoding="utf-8")
        rc, fila = self._estado()
        self.assertEqual((rc, fila["estado"]), (1, "incompleto"))
        texto = " ".join(fila["motivos"])
        self.assertIn("PDF", texto)
        self.assertIn("imagen", texto)
        self.assertIn("[Captura", texto)

    def test_manual_con_capturas_y_pdf_queda_listo(self):
        p = self._cfg_calidad({"pdf": True, "imagenes": 2})
        img = '<img src="data:image/png;base64,AAAA">'
        (p / "manual.html").write_text(img * 2, encoding="utf-8")
        (p / "manual.pdf").write_bytes(b"%PDF-1.4")
        rc, fila = self._estado()
        self.assertEqual((rc, fila["estado"]), (0, "listo"))

    def test_contenido_exigido_y_sin_marcadores(self):
        p = self._cfg_calidad({"contiene": [r"Fecha\s*\|\s*\d{2}/\d{2}/\d{4}"]})
        (p / "manual.md").write_text("| Fecha | por definir |", encoding="utf-8")
        self.assertEqual(self._estado()[1]["estado"], "incompleto")
        (p / "manual.md").write_text("| Fecha | 30/11/2026 |", encoding="utf-8")
        rc, fila = self._estado()
        self.assertEqual((rc, fila["estado"]), (0, "listo"))

    def test_todo_del_espanol_no_es_marcador(self):
        p = self._cfg_calidad({})
        (p / "manual.md").write_text("Todo en una transacción; aplica a todo el flujo. Entrega parcial del 1955.", encoding="utf-8")
        self.assertEqual(self._estado()[1]["estado"], "listo")
        (p / "manual.md").write_text("TODO: completar. Estado: PARCIAL.", encoding="utf-8")
        self.assertEqual(self._estado()[1]["estado"], "incompleto")

    def test_evidencia_en_su_carpeta(self):
        p = self._cfg_calidad({"evidencia": ["pruebas-unitarias-*"]})
        (p / "manual.md").write_text("380/380", encoding="utf-8")
        self.assertEqual(self._estado()[1]["estado"], "incompleto")
        (p / "evidencias").mkdir()
        (p / "evidencias" / "pruebas-unitarias-back.txt").write_text("ok", encoding="utf-8")
        self.assertEqual(self._estado()[1]["estado"], "listo")

    # --- Qué se genera (25/11/2026): por defecto todo; cada persona puede omitir ---
    def _cfg_omitir(self, omitir, extra=None):
        cfg = json.loads(json.dumps(CONFIG))
        cfg["paso_produccion"]["entregables"] += [
            {"id": "comunicado", "nombre": "Comunicado"},
            {"id": "video", "nombre": "Video", "con": "comunicado"},
        ] + (extra or [])
        if omitir is not None:
            cfg["paso_produccion"]["omitir"] = omitir
        self.cfg.write_text(json.dumps(cfg), encoding="utf-8")
        rc, _ = correr("--caso", "demo-1", "--raiz", str(self.tmp), "--config", str(self.cfg))
        res = json.loads((self.exp.parent / "paso-produccion" / "paquete.json").read_text(encoding="utf-8"))
        return rc, res

    def test_sin_omitir_se_exige_todo(self):
        rc, res = self._cfg_omitir(None)
        self.assertEqual(res["omitidos"], [])
        self.assertIn("video", res["faltan"])

    def test_omitir_comunicado_arrastra_el_video(self):
        rc, res = self._cfg_omitir(["comunicado"])
        self.assertEqual(res["omitidos"], ["comunicado", "video"])
        self.assertNotIn("video", res["faltan"])
        self.assertIn("impacto", res["faltan"])  # lo demás sigue exigido

    def test_omitir_solo_el_video_no_toca_el_comunicado(self):
        rc, res = self._cfg_omitir(["video"])
        self.assertEqual(res["omitidos"], ["video"])
        self.assertIn("comunicado", res["faltan"])

    def test_genera_false_y_omitido_cuenta_como_completo(self):
        p = self.exp.parent / "paso-produccion"
        (p / "aprobaciones").mkdir(parents=True)
        for n in ("tecnica.md", "impacto.md", "comunicado.md"):
            (p / n).write_text("x", encoding="utf-8")
        (p / "aprobaciones" / "cliente.pdf").write_text("x", encoding="utf-8")
        rc, res = self._cfg_omitir([], extra=[{"id": "guia", "nombre": "Guía", "genera": False}])
        self.assertIn("guia", res["omitidos"])
        self.assertEqual(res["faltan"], ["video"])  # control positivo: el video sigue faltando
        rc, res = self._cfg_omitir(["video"], extra=[{"id": "guia", "nombre": "Guía", "genera": False}])
        self.assertEqual((rc, res["faltan"]), (0, []))

    def test_omitir_id_inexistente_se_denuncia(self):
        cfg = json.loads(json.dumps(CONFIG))
        cfg["paso_produccion"]["omitir"] = ["no-existe"]
        self.cfg.write_text(json.dumps(cfg), encoding="utf-8")
        r = subprocess.run([sys.executable, "-I", str(SCRIPT), "--caso", "demo-1", "--raiz", str(self.tmp),
                            "--config", str(self.cfg)], capture_output=True, text=True, encoding="utf-8")
        self.assertIn("no-existe", r.stderr)

    def test_dentro_de_una_mesa_exige_final(self):
        mesa = self.tmp / "mesa"
        (mesa / "repos").mkdir(parents=True)
        rc, out = correr("--caso", "demo-1", "--raiz", str(self.tmp), "--config", str(self.cfg),
                         "--carpeta", str(mesa / "docs" / "paquete"))
        self.assertEqual(rc, 2)
        self.assertIn("final", out)
        rc, _ = correr("--caso", "demo-1", "--raiz", str(self.tmp), "--config", str(self.cfg),
                       "--carpeta", str(mesa / "final"))
        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
