"""Lectura de diffs unificados (formato `git diff` / `diff -u`) sin dependencias.

Cada archivo queda como {"ruta", "ruta_original", "tipo" (agregado|modificado|borrado|renombrado),
"binario", "agregadas": [(linea_nueva, texto)], "borradas": [(linea_vieja, texto)], "hunks": [(ini, fin)]}.
Las líneas son números de la versión NUEVA del archivo (las borradas, de la vieja).
El diff es un dato no confiable: aquí solo se lee como texto, nunca se ejecuta nada.
"""
import re

_HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def _limpia(ruta):
    ruta = ruta.strip().split("\t")[0]
    if ruta.startswith(("a/", "b/")):
        ruta = ruta[2:]
    return ruta


def parsear(texto):
    archivos, actual = [], None
    linea_vieja = linea_nueva = 0
    for linea in texto.splitlines():
        if linea.startswith("diff --git "):
            partes = linea.split(" b/", 1)
            actual = {"ruta": _limpia("b/" + partes[1]) if len(partes) > 1 else "", "ruta_original": None,
                      "tipo": "modificado", "binario": False, "agregadas": [], "borradas": [], "hunks": []}
            archivos.append(actual)
            continue
        if actual is None and linea.startswith("--- "):
            actual = {"ruta": "", "ruta_original": None, "tipo": "modificado", "binario": False,
                      "agregadas": [], "borradas": [], "hunks": []}
            archivos.append(actual)
        if actual is None:
            continue
        if linea.startswith("new file mode"):
            actual["tipo"] = "agregado"
        elif linea.startswith("deleted file mode"):
            actual["tipo"] = "borrado"
        elif linea.startswith("rename from "):
            actual["tipo"] = "renombrado"
            actual["ruta_original"] = linea[len("rename from "):].strip()
        elif linea.startswith("Binary files") or linea.startswith("GIT binary patch"):
            actual["binario"] = True
        elif linea.startswith("--- "):
            ruta = linea[4:]
            if ruta.strip() == "/dev/null":
                actual["tipo"] = "agregado"
            elif not actual["ruta_original"]:
                actual["ruta_original"] = _limpia(ruta)
        elif linea.startswith("+++ "):
            ruta = linea[4:]
            if ruta.strip() == "/dev/null":
                actual["tipo"] = "borrado"
                actual["ruta"] = actual["ruta"] or actual["ruta_original"] or ""
            else:
                actual["ruta"] = _limpia(ruta)
        elif linea.startswith("@@"):
            m = _HUNK.match(linea)
            if m:
                linea_vieja, linea_nueva = int(m.group(1)), int(m.group(3))
                largo = int(m.group(4)) if m.group(4) is not None else 1
                actual["hunks"].append((linea_nueva, linea_nueva + max(largo, 1) - 1))
        elif linea.startswith("+"):
            actual["agregadas"].append((linea_nueva, linea[1:]))
            linea_nueva += 1
        elif linea.startswith("-"):
            actual["borradas"].append((linea_vieja, linea[1:]))
            linea_vieja += 1
        elif linea.startswith(" ") or linea == "":
            linea_vieja += 1
            linea_nueva += 1
    for a in archivos:
        if a["tipo"] == "modificado" and a["ruta_original"] and a["ruta_original"] != a["ruta"]:
            a["tipo"] = "renombrado"
    return archivos


def leer(ruta):
    with open(ruta, encoding="utf-8", errors="replace") as f:
        return parsear(f.read())


def por_ruta(archivos):
    return {a["ruta"]: a for a in archivos}


def linea_en_cambio(archivo, linea, holgura=3):
    """True si la línea (de la versión nueva) cae dentro de un hunk del diff, con holgura de contexto."""
    return any(ini - holgura <= linea <= fin + holgura for ini, fin in archivo["hunks"])
