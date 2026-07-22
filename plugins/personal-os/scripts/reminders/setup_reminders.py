#!/usr/bin/env python3
"""
Personal OS - Provisiona recordatorios recurrentes como tareas del Programador
de tareas de Windows. Pensado para el paso /os-setup del plugin.

Crea 2 tareas (Lunes a Viernes) que se disparan LOCALMENTE, en la sesion ya
autenticada del usuario (por eso los MCP de Jira/Outlook funcionan en lectura y
la entrega es local, sin depender de permisos de envio de correo):

  08:00  Brief matutino     -> lanza Claude headless (lee Jira/Outlook, regenera
                               el tablero) + abre el tablero + notificacion.
  17:00  Recordatorio cierre -> notificacion para dejar el comentario de avances
                               del entregable #1.

Uso:
  python setup_reminders.py              # crea/actualiza las tareas
  python setup_reminders.py --uninstall  # elimina las tareas
  python setup_reminders.py --status     # consulta el estado

Nota: por ahora solo Windows (usa schtasks). En Mac/Linux se implementara con
cron/launchd en una version futura.
"""
import os
import sys
import platform
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
MORNING_PS1 = os.path.join(HERE, "brief_matutino.ps1")
EVENING_PS1 = os.path.join(HERE, "recordatorio_cierre.ps1")

DAYS = "MON,TUE,WED,THU,FRI"
TASKS = [
    {"name": r"PersonalOS\Brief matutino 8am", "time": "08:00", "ps1": MORNING_PS1},
    {"name": r"PersonalOS\Recordatorio cierre 5pm", "time": "17:00", "ps1": EVENING_PS1},
]


def _require_windows():
    if platform.system() != "Windows":
        print("[INFO] Por ahora los recordatorios automaticos solo estan "
              "soportados en Windows (schtasks). En Mac/Linux: pendiente "
              "(cron/launchd).")
        sys.exit(2)


def _tr(ps1_path):
    # Comando de la tarea. Se pasa como UN solo argumento a schtasks; las comillas
    # internas toleran espacios en la ruta del plugin.
    return ('powershell.exe -NoProfile -ExecutionPolicy Bypass '
            '-WindowStyle Hidden -File "{}"'.format(ps1_path))


def create():
    _require_windows()
    for t in TASKS:
        if not os.path.exists(t["ps1"]):
            print("[ERROR] Falta el wrapper:", t["ps1"])
            sys.exit(1)
        cmd = ["schtasks", "/Create", "/F",
               "/TN", t["name"],
               "/TR", _tr(t["ps1"]),
               "/SC", "WEEKLY",
               "/D", DAYS,
               "/ST", t["time"]]
        r = subprocess.run(cmd, capture_output=True, text=True)
        out = (r.stdout or r.stderr).strip()
        print("[{}] {} @ {} L-V -> {}".format(
            "OK" if r.returncode == 0 else "FALLO", t["name"], t["time"], out))
        if r.returncode != 0:
            sys.exit(r.returncode)
    print("\nListo. Las tareas corren solo cuando la sesion de Windows esta "
          "iniciada. Gestionalas en el Programador de tareas (carpeta PersonalOS).")


def uninstall():
    _require_windows()
    for t in TASKS:
        r = subprocess.run(["schtasks", "/Delete", "/F", "/TN", t["name"]],
                           capture_output=True, text=True)
        print((r.stdout or r.stderr).strip())


def status():
    _require_windows()
    for t in TASKS:
        r = subprocess.run(["schtasks", "/Query", "/TN", t["name"]],
                           capture_output=True, text=True)
        print((r.stdout or r.stderr).strip(), "\n---")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--uninstall":
        uninstall()
    elif arg == "--status":
        status()
    else:
        create()
