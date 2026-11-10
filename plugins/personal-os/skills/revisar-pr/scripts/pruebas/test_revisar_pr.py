"""Pruebas de la capa 0, la verificación de anclas y el veredicto sobre un diff de ejemplo.

  python -I -m unittest discover -s <skill>/scripts/pruebas -v
No usan red ni Azure DevOps.
"""
import json, os, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

AQUI = Path(__file__).parent
SCRIPTS = AQUI.parent
sys.path.insert(0, str(SCRIPTS))
import capa0, comun, diffutil  # noqa: E402

# Los datos «de paciente» del ejemplo se arman aquí para que ningún archivo de la skill traiga números de persona.
DOC, CEL = "12345" + "67890", "300" + "1234567"


def diff_ejemplo(carpeta):
    destino = Path(carpeta) / "ejemplo.diff"
    texto = (AQUI / "ejemplo.diff").read_text(encoding="utf-8").replace("{{DOC}}", DOC).replace("{{CEL}}", CEL)
    destino.write_text(texto, encoding="utf-8")
    return destino


def correr(script, *args):
    r = subprocess.run([sys.executable, "-I", str(SCRIPTS / script), *map(str, args)], capture_output=True, text=True,
                       encoding="utf-8", env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    if r.returncode != 0:
        raise AssertionError(f"{script} falló: {r.stderr or r.stdout}")
    return r.stdout


class Capa0(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.exp = cls.tmp / "expediente.json"
        shutil.copy(AQUI / "expediente_ejemplo.json", cls.exp)
        correr("capa0.py", "--diff", diff_ejemplo(cls.tmp), "--pr", AQUI / "ejemplo_pr.json", "--expediente", cls.exp,
               "--salida", cls.tmp / "capa0.json", "--diff-ia", cls.tmp / "diff_para_ia.diff")
        cls.r = comun.leer_json(cls.tmp / "capa0.json")
        cls.reglas = [h["regla"] for h in cls.r["hallazgos"]]
        cls.texto = (cls.tmp / "capa0.json").read_text(encoding="utf-8")
        cls.diff_ia = (cls.tmp / "diff_para_ia.diff").read_text(encoding="utf-8")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_parser_numera_lineas(self):
        a = diffutil.por_ruta(diffutil.leer(AQUI / "ejemplo.diff"))
        ctrl = a["src/Api/Controllers/ReporteController.cs"]
        self.assertEqual(ctrl["agregadas"][0], (11, "    [AllowAnonymous]"))
        self.assertEqual(a["tests/Api.Tests/ViejoTests.cs"]["tipo"], "borrado")
        self.assertEqual(a["db/semillas/pacientes.json"]["tipo"], "agregado")

    def test_rama_y_clave(self):
        self.assertEqual(self.r["clave"], "PROY-42")
        self.assertIn("rama_formato", self.reglas)
        h = []
        capa0.chequear_rama({"rama": "feature/PROY-42+algo", "destino": "qa"}, comun.cargar_config(), h)
        self.assertEqual([x["regla"] for x in h], ["destino_no_permitido"])
        h = []
        self.assertIsNone(capa0.chequear_rama({"rama": "arreglos-varios", "destino": "develop"}, comun.cargar_config(), h))
        self.assertIn("rama_sin_clave", [x["regla"] for x in h])

    def test_secretos_enmascarados(self):
        self.assertIn("secreto:password_en_cadena", self.reglas)
        self.assertIn("secreto:trust_server_certificate", self.reglas)
        self.assertNotIn("SuperSecreta123", self.texto)
        self.assertTrue(self.r["bloqueante"])

    def test_datos_de_pacientes(self):
        self.assertIn("paciente:documento_con_etiqueta", self.reglas)
        self.assertIn("paciente:nombre_con_etiqueta", self.reglas)
        self.assertIn("paciente:celular", self.reglas)
        self.assertNotIn(DOC, self.texto)
        self.assertNotIn("Pedro Gomez", self.texto)

    def test_diff_para_ia_sin_secretos_ni_excluidos(self):
        self.assertNotIn("SuperSecreta123", self.diff_ia)
        self.assertNotIn(DOC, self.diff_ia)
        self.assertIn("archivo excluido de la revisión IA", self.diff_ia)
        self.assertIn("«[oculto por capa 0]»", self.diff_ia)
        # el tachado conserva la numeración: el resto del diff sigue igual
        self.assertIn("+    [AllowAnonymous]", self.diff_ia)

    def test_dependencias(self):
        deps = {d["nombre"]: d for d in self.r["dependencias"]}
        self.assertEqual(deps["left-padd-ultra-ia"]["tipo"], "nueva")
        self.assertEqual(deps["@angular/core"]["tipo"], "actualizada")
        self.assertEqual(deps["Newtonsoft.Json"]["tipo"], "nueva")
        self.assertNotIn("Serilog", deps)
        self.assertIn("dependencia_version_no_fija", self.reglas)

    def test_entregables_de_la_subtarea(self):
        e = self.r["entregables"]
        self.assertEqual(sorted(e["requeridos"]), ["docs", "script_bd+rollback", "tests"])
        self.assertEqual(sorted(e["faltantes"]), ["docs", "rollback"])
        self.assertIn("sql_no_idempotente", self.reglas)
        destructivo = [h for h in self.r["hallazgos"] if h["regla"] == "sql_destructivo"][0]
        self.assertEqual(destructivo["lineas"], [2, 3])  # la línea 4 es un comentario: no cuenta

    def test_pruebas_debilitadas(self):
        for regla in ("test_saltado", "assert_trivial", "asserts_reducidos", "test_borrado"):
            self.assertIn(regla, self.reglas)

    def test_any_y_config_de_agente(self):
        self.assertIn("tipo_any", self.reglas)
        self.assertIn("config_de_agente_en_rama", self.reglas)
        self.assertEqual(self.r["config_de_agente_tocada"], [".claude/settings.json"])

    def test_senales_para_la_ia(self):
        sen = {s["regla"] for s in self.r["senales_para_ia"]}
        for regla in ("sql_armado_con_texto", "endpoint_anonimo", "autorizacion_borrada", "validacion_borrada",
                      "html_sin_sanitizar", "log_con_dato_sensible"):
            self.assertIn(regla, sen)

    def test_criterios_filtrados_por_subtarea(self):
        self.assertEqual([c["id"] for c in self.r["criterios"]], ["CA-1"])
        self.assertEqual(self.r["tipo_repo"]["backend"], "legado")


class SegundaPasadaYVeredicto(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.exp = self.tmp / "expediente.json"
        shutil.copy(AQUI / "expediente_ejemplo.json", self.exp)
        correr("capa0.py", "--diff", diff_ejemplo(self.tmp), "--pr", AQUI / "ejemplo_pr.json", "--expediente", self.exp,
               "--salida", self.tmp / "capa0.json", "--diff-ia", self.tmp / "diff_para_ia.diff")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_anclas_y_veredicto(self):
        rev = {"pr": "101", "criterios_fuente": "expediente",
               "veredicto_por_ca": {"CA-1": {"estado": "no", "evidencia": "src/Api/Controllers/ReporteController.cs:11",
                                             "nota": "Quitó la política y dejó el endpoint anónimo"}},
               "hallazgos": [
                   {"id": "IA-1", "titulo": "Endpoint anónimo expone reportes", "severidad": "alta", "punto_checklist": 3,
                    "archivo": "src/Api/Controllers/ReporteController.cs", "linea": 11, "cita": "[AllowAnonymous]",
                    "explicacion": "Cualquiera puede leer reportes.", "sugerencia": "Restaurar la política.",
                    "verificacion": "confirmado"},
                   {"id": "IA-2", "titulo": "Línea que el PR no tocó", "severidad": "media",
                    "archivo": "src/Api/Controllers/ReporteController.cs", "linea": 80, "cita": "algo"},
                   {"id": "IA-3", "titulo": "Archivo inventado", "severidad": "alta", "archivo": "src/NoExiste.cs", "linea": 3},
                   {"id": "IA-4", "titulo": "Cita que no está", "severidad": "media",
                    "archivo": "src/Api/Controllers/ReporteController.cs", "linea": 15, "cita": "ExecuteSqlRaw(texto)"},
                   {"id": "IA-5", "titulo": "Falta la prueba del CA-1", "severidad": "media", "archivo": None,
                    "verificacion": "confirmado", "explicacion": "Ninguna prueba llama sin permiso."}]}
        comun.escribir_json(self.tmp / "rev.json", rev)
        correr("verificar_hallazgos.py", "--diff", self.tmp / "diff_para_ia.diff", "--revision", self.tmp / "rev.json")
        rev = comun.leer_json(self.tmp / "rev.json")
        anclas = {h["id"]: h["ancla"] for h in rev["hallazgos"]}
        self.assertEqual(anclas, {"IA-1": "ok", "IA-2": "linea_fuera_del_cambio", "IA-3": "archivo_fuera_del_diff",
                                  "IA-4": "cita_no_coincide", "IA-5": "general"})
        self.assertTrue(rev["veredicto_por_ca"]["CA-1"]["evidencia_verificada"])
        (self.tmp / "diff_completo.diff").write_text("x", encoding="utf-8")
        salida = correr("guardar_revision.py", "--capa0", self.tmp / "capa0.json", "--revision", self.tmp / "rev.json",
                        "--informe", self.tmp / "informe.md", "--expediente", self.exp, "--carpeta", self.tmp,
                        "--fecha", "2026-11-11")
        self.assertIn("Devolver", salida)
        self.assertFalse((self.tmp / "diff_completo.diff").exists())
        exp = comun.leer_json(self.exp)
        r = exp["revisiones_pr"][-1]
        self.assertEqual(r["veredicto"], "devolver")
        self.assertEqual(r["veredicto_por_ca"], {"CA-1": "no"})
        self.assertFalse(r["publicado"])
        self.assertIn("rollback", r["entregables_faltantes"])
        self.assertEqual(exp["chequeos"]["p4"]["estado"], "pendiente")
        informe = (self.tmp / "informe.md").read_text(encoding="utf-8")
        self.assertIn("BORRADOR", informe)
        self.assertNotIn("SuperSecreta123", informe)
        self.assertNotIn("Archivo inventado", informe.split("Descartados")[0])

    def test_sin_segunda_pasada_no_hay_informe(self):
        comun.escribir_json(self.tmp / "rev.json", {"veredicto_por_ca": {}, "hallazgos": [{"id": "IA-1", "titulo": "x"}]})
        r = subprocess.run([sys.executable, "-I", str(SCRIPTS / "guardar_revision.py"), "--capa0", str(self.tmp / "capa0.json"),
                            "--revision", str(self.tmp / "rev.json"), "--informe", str(self.tmp / "i.md")],
                           capture_output=True, text=True, encoding="utf-8")
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse((self.tmp / "i.md").exists())

    def test_pr_limpio_queda_listo(self):
        diff = ("diff --git a/src/Util.cs b/src/Util.cs\n--- a/src/Util.cs\n+++ b/src/Util.cs\n@@ -1,2 +1,3 @@\n"
                " public static class Util {\n+    public static int Doble(int x) => x * 2;\n }\n"
                "diff --git a/tests/UtilTests.cs b/tests/UtilTests.cs\nnew file mode 100644\n--- /dev/null\n+++ b/tests/UtilTests.cs\n"
                "@@ -0,0 +1,1 @@\n+[TestMethod] public void Doble_Dos_Cuatro() => Assert.AreEqual(4, Util.Doble(2));\n")
        (self.tmp / "d.diff").write_text(diff, encoding="utf-8")
        comun.escribir_json(self.tmp / "pr.json", {"id": 7, "rama": "feature/PROY-42+doble", "destino": "develop",
                                                   "titulo": "PROY-42 doble", "descripcion": "PROY-42. Probé con dotnet test."})
        correr("capa0.py", "--diff", self.tmp / "d.diff", "--pr", self.tmp / "pr.json", "--salida", self.tmp / "c.json")
        comun.escribir_json(self.tmp / "rev.json", {"veredicto_por_ca": {"CA-1": {"estado": "cumple", "evidencia": "src/Util.cs:2"}},
                                                    "hallazgos": []})
        correr("verificar_hallazgos.py", "--diff", self.tmp / "d.diff", "--revision", self.tmp / "rev.json")
        salida = correr("guardar_revision.py", "--capa0", self.tmp / "c.json", "--revision", self.tmp / "rev.json",
                        "--informe", self.tmp / "i.md")
        self.assertIn("Listo para aprobar", salida)


if __name__ == "__main__":
    unittest.main()
