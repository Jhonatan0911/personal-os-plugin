#!/usr/bin/env python3
"""Controles del almacén de credenciales (lib/credenciales.py) con cuentas ficticias que se borran al final.
   python scripts/pruebas/credenciales.prueba.py"""
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(AQUI, "..", "lib")
sys.path.insert(0, LIB)
import credenciales as K  # noqa: E402

CUENTA = "prueba-personal-os-borrar"
fallos, total = 0, 0


def v(nombre, ok):
    global fallos, total
    total += 1
    fallos += 0 if ok else 1
    print(f"{'OK   ' if ok else 'FALLO'} {nombre}")


try:
    K.borrar(CUENTA)
    try:
        K.leer(CUENTA)
        v("una cuenta que no existe da NoExiste", False)
    except K.NoExiste:
        v("una cuenta que no existe da NoExiste", True)
    raro = "Clave_ñ;{}=\"'á&|^% 1"
    K.guardar(CUENTA, raro)
    v("guarda y lee igual (tildes, llaves, comillas, espacios)", K.leer(CUENTA) == raro)
    K.guardar(CUENTA, "otra")
    v("guardar otra vez la reemplaza", K.leer(CUENTA) == "otra")
    v("password_de lee del almacén si está marcada", K.password_de(CUENTA, {"password_en": "almacen", "password": "vieja"}) == "otra")
    v("password_de acepta el formato viejo en claro", K.password_de("x", {"password": "vieja"}) == "vieja")
    # CLI: el secreto viaja por stdin/stdout
    cli = os.path.join(LIB, "credenciales.py")
    r = subprocess.run([sys.executable, cli, "guardar", CUENTA], input="por-stdin", capture_output=True, text=True, encoding="utf-8")
    r2 = subprocess.run([sys.executable, cli, "leer", CUENTA], capture_output=True, text=True, encoding="utf-8")
    v("CLI guardar/leer por stdin y stdout", r.returncode == 0 and r2.returncode == 0 and r2.stdout == "por-stdin")
    K.borrar(CUENTA)
    r3 = subprocess.run([sys.executable, cli, "leer", CUENTA], capture_output=True, text=True)
    v("CLI leer una cuenta borrada da código 4", r3.returncode == 4)

    # Migración sobre un OS_HOME temporal
    home = tempfile.mkdtemp(prefix="cred-")
    arch = os.path.join(home, "conexiones", "bd-x.json")
    os.makedirs(os.path.dirname(arch))
    with open(arch, "w", encoding="utf-8-sig", newline="") as f:
        f.write(json.dumps({"servidor": "192.0.2.1", "password": "secreta", "otro": 1}, indent=2).replace("\n", "\r\n") + "\r\n")
    with open(arch + ".antes-consola", "w", encoding="utf-8") as f:
        json.dump({"password": "secreta"}, f)
    with open(os.path.join(home, "conexiones-bd.json"), "w", encoding="utf-8") as f:
        json.dump({"conexiones": [{"id": CUENTA, "archivo": arch}]}, f)
    K.migrar(home, aplicar=False)
    v("migrar en simulación no toca nada", "secreta" in open(arch, encoding="utf-8-sig").read())
    K.migrar(home, aplicar=True)
    crudo = open(arch, "rb").read()
    d = json.loads(crudo.decode("utf-8-sig"))
    v("migrar quita la contraseña del archivo y marca almacen", "password" not in d and d.get("password_en") == "almacen" and d.get("otro") == 1)
    v("migrar conserva BOM y CRLF", crudo.startswith(b"\xef\xbb\xbf") and b"\r\n" in crudo)
    v("migrar deja la contraseña en el almacén", K.leer(CUENTA) == "secreta")
    v("migrar limpia el respaldo .antes-consola", "secreta" not in open(arch + ".antes-consola", encoding="utf-8").read())
finally:
    K.borrar(CUENTA)

print(f"\n{fallos} control(es) fallan." if fallos else f"\nLos {total} controles pasan.")
sys.exit(1 if fallos else 0)
