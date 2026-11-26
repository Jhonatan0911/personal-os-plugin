#!/usr/bin/env python3
"""
credenciales.py — contraseñas de las conexiones de BD en el almacén de credenciales del sistema (26/11/2026).

Windows: Administrador de credenciales (credencial genérica «personal-os-bd/<cuenta>», por usuario; se ve y se
borra en Panel de control > Administrador de credenciales). macOS: Llavero (`security`). Linux: Secret Service
(`secret-tool`). Sin dependencias: en Windows usa advapi32 por ctypes.

El JSON de la conexión ya no guarda `password`: lleva `"password_en": "almacen"` y la cuenta es el id de la
conexión en ⚙ Config · Bases de datos. Un JSON viejo con `password` en claro se sigue leyendo (compatibilidad)
hasta migrarlo.

CLI (la usa os-servidor.js; el secreto viaja por stdin/stdout, nunca en argumentos):
  credenciales.py guardar <cuenta>   (secreto por stdin)
  credenciales.py leer <cuenta>      (secreto por stdout; código 4 si no existe)
  credenciales.py borrar <cuenta>
  credenciales.py migrar [--os-home <dir>] [--aplicar]   (sin --aplicar solo dice qué haría)
"""
import json
import os
import subprocess
import sys

SERVICIO = os.environ.get("PERSONAL_OS_CRED_SERVICIO") or "personal-os-bd"   # las pruebas usan otro espacio de nombres


class NoExiste(Exception):
    pass


# ── Windows: advapi32 ───────────────────────────────────────────────────────────────────────────────
def _win():
    import ctypes
    from ctypes import wintypes

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD), ("TargetName", wintypes.LPWSTR),
                    ("Comment", wintypes.LPWSTR), ("LastWritten", wintypes.FILETIME),
                    ("CredentialBlobSize", wintypes.DWORD), ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                    ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
                    ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR)]
    adv = ctypes.WinDLL("advapi32", use_last_error=True)
    adv.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
    adv.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    adv.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
    adv.CredFree.argtypes = [ctypes.c_void_p]
    return ctypes, CREDENTIAL, adv


GENERICA, PERSISTE_LOCAL, NO_ENCONTRADA = 1, 2, 1168


def _objetivo(cuenta):
    return f"{SERVICIO}/{cuenta}"


def _win_guardar(cuenta, secreto):
    ctypes, CREDENTIAL, adv = _win()
    blob = secreto.encode("utf-16-le")
    buf = (ctypes.c_ubyte * len(blob)).from_buffer_copy(blob) if blob else None
    c = CREDENTIAL()
    c.Type, c.Persist = GENERICA, PERSISTE_LOCAL
    c.TargetName = _objetivo(cuenta)
    c.Comment = "Contraseña de una conexión de BD del Personal OS (⚙ Config · Bases de datos)"
    c.UserName = cuenta
    c.CredentialBlobSize = len(blob)
    c.CredentialBlob = ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)) if buf else None
    if not adv.CredWriteW(ctypes.byref(c), 0):
        raise OSError(f"CredWrite falló ({ctypes.get_last_error()})")


def _win_leer(cuenta):
    ctypes, CREDENTIAL, adv = _win()
    p = ctypes.POINTER(CREDENTIAL)()
    if not adv.CredReadW(_objetivo(cuenta), GENERICA, 0, ctypes.byref(p)):
        err = ctypes.get_last_error()
        if err == NO_ENCONTRADA:
            raise NoExiste(cuenta)
        raise OSError(f"CredRead falló ({err})")
    try:
        n = p.contents.CredentialBlobSize
        return bytes(p.contents.CredentialBlob[:n]).decode("utf-16-le") if n else ""
    finally:
        adv.CredFree(p)


def _win_borrar(cuenta):
    ctypes, _, adv = _win()
    if not adv.CredDeleteW(_objetivo(cuenta), GENERICA, 0):
        err = ctypes.get_last_error()
        if err != NO_ENCONTRADA:
            raise OSError(f"CredDelete falló ({err})")


# ── macOS y Linux ───────────────────────────────────────────────────────────────────────────────────
def _correr(args, entrada=None):
    return subprocess.run(args, input=entrada, capture_output=True, text=True, timeout=15)


def guardar(cuenta, secreto):
    if os.name == "nt":
        return _win_guardar(cuenta, secreto)
    if sys.platform == "darwin":
        # `security` no lee el secreto de stdin; -U actualiza si ya existe.
        r = _correr(["security", "add-generic-password", "-U", "-s", SERVICIO, "-a", cuenta, "-w", secreto])
    else:
        r = _correr(["secret-tool", "store", f"--label={SERVICIO} {cuenta}", "servicio", SERVICIO, "cuenta", cuenta], secreto)
    if r.returncode != 0:
        raise OSError("no se pudo guardar en el almacén de credenciales")


def leer(cuenta):
    if os.name == "nt":
        return _win_leer(cuenta)
    if sys.platform == "darwin":
        r = _correr(["security", "find-generic-password", "-s", SERVICIO, "-a", cuenta, "-w"])
    else:
        r = _correr(["secret-tool", "lookup", "servicio", SERVICIO, "cuenta", cuenta])
    if r.returncode != 0:
        raise NoExiste(cuenta)
    return r.stdout.rstrip("\n")


def borrar(cuenta):
    if os.name == "nt":
        return _win_borrar(cuenta)
    if sys.platform == "darwin":
        _correr(["security", "delete-generic-password", "-s", SERVICIO, "-a", cuenta])
    else:
        _correr(["secret-tool", "clear", "servicio", SERVICIO, "cuenta", cuenta])


def password_de(cuenta, datos):
    """La contraseña de una conexión: del almacén si está marcada; si no, la vieja en claro (compatibilidad)."""
    if (datos or {}).get("password_en") == "almacen":
        return leer(cuenta)
    return (datos or {}).get("password") or ""


# ── Migración de los JSON en claro ─────────────────────────────────────────────────────────────────
def _leer_json(ruta):
    with open(ruta, "rb") as f:
        crudo = f.read()
    txt = crudo.decode("utf-8-sig")
    return json.loads(txt), crudo.startswith(b"\xef\xbb\xbf"), ("\r\n" if b"\r\n" in crudo else "\n")


def _escribir_json(ruta, datos, bom, eol):
    tmp = ruta + ".tmp-credenciales"
    texto = json.dumps(datos, ensure_ascii=False, indent=2).replace("\n", eol) + eol
    with open(tmp, "w", encoding="utf-8-sig" if bom else "utf-8", newline="") as f:
        f.write(texto)
    os.replace(tmp, ruta)


def _limpiar_copias(archivo, os_home, aplicar):
    """Respaldos que también traen la contraseña en claro: se les quita el campo (no se borran)."""
    copias = [archivo + ".antes-consola"]
    pap = os.path.join(os_home, "_papelera-conexiones")
    if os.path.isdir(pap):
        copias += [os.path.join(pap, n) for n in os.listdir(pap) if n.endswith(".json")]
    hechas = []
    for c in copias:
        try:
            d, bom, eol = _leer_json(c)
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and d.get("password"):
            if aplicar:
                d.pop("password", None)
                d["password_en"] = "retirada (vive en el almacén de credenciales)"
                _escribir_json(c, d, bom, eol)
            hechas.append(c)
    return hechas


def migrar(os_home, aplicar):
    reg_ruta = os.path.join(os_home, "conexiones-bd.json")
    reg, _, _ = _leer_json(reg_ruta)
    total = 0
    for c in reg.get("conexiones", []):
        cuenta, archivo = c.get("id"), c.get("archivo")
        try:
            d, bom, eol = _leer_json(archivo)
        except (OSError, ValueError) as e:
            print(f"  ! {cuenta}: no se puede leer su archivo ({type(e).__name__})")
            continue
        pwd = d.get("password")
        if not pwd:
            estado = "ya en el almacén" if d.get("password_en") == "almacen" else "sin contraseña"
            print(f"  = {cuenta}: {estado}")
        elif not aplicar:
            print(f"  ~ {cuenta}: se movería al almacén")
        else:
            guardar(cuenta, pwd)
            if leer(cuenta) != pwd:   # se comprueba antes de quitarla del archivo
                raise OSError(f"{cuenta}: la contraseña leída del almacén no coincide; no se quitó del archivo")
            d.pop("password", None)
            d["password_en"] = "almacen"
            _escribir_json(archivo, d, bom, eol)
            print(f"  ✓ {cuenta}: movida al almacén y quitada del archivo")
            total += 1
        for copia in _limpiar_copias(archivo, os_home, aplicar):
            print(f"    {'✓ limpiado' if aplicar else '~ se limpiaría'} el respaldo {os.path.basename(copia)}")
    print(f"{total} contraseña(s) movidas." if aplicar else "(simulación: corre con --aplicar para moverlas)")


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    cmd = argv[0]
    try:
        if cmd == "migrar":
            os_home = argv[argv.index("--os-home") + 1] if "--os-home" in argv else (
                os.environ.get("PERSONAL_OS_HOME") or os.path.join(os.path.expanduser("~"), ".claude", "personal-os"))
            migrar(os.path.abspath(os_home), "--aplicar" in argv)
            return 0
        if len(argv) != 2:
            print("Uso: credenciales.py guardar|leer|borrar <cuenta>", file=sys.stderr)
            return 2
        cuenta = argv[1]
        if cmd == "guardar":
            guardar(cuenta, sys.stdin.read())
        elif cmd == "leer":
            sys.stdout.write(leer(cuenta))
        elif cmd == "borrar":
            borrar(cuenta)
        else:
            return 2
        return 0
    except NoExiste:
        return 4
    except OSError as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
