"""Acceso de solo lectura a la API de Azure DevOps con la credencial que ya tiene git.
La credencial sale de `git credential fill` y vive solo en memoria: nunca se imprime ni se guarda.

La organización no viene escrita aquí: todos los scripts aceptan `--org <organizacion>` (este módulo lo
toma de la línea de comandos antes de que cada script lea sus argumentos) o la variable AZDO_ORG.
Los scripts que leen data.json o pendientes.json la recuperan de ahí si no se pasa."""
import os, sys, json, base64, subprocess, urllib.request, urllib.parse

os.environ["GIT_TERMINAL_PROMPT"] = "0"
sys.stdout.reconfigure(encoding="utf-8")

ORG = os.environ.get("AZDO_ORG") or None
BASE = None


def usar_org(org):
    """Fija la organización para todo el proceso."""
    global ORG, BASE
    ORG = (org or "").strip() or None
    BASE = f"https://dev.azure.com/{ORG}" if ORG else None


def _org_de_argv():
    for i, a in enumerate(list(sys.argv)):
        if a == "--org" and i + 1 < len(sys.argv):
            v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
        if a.startswith("--org="):
            del sys.argv[i]; return a.split("=", 1)[1]
    return None


usar_org(_org_de_argv() or ORG)


def exigir_org(respaldo=None):
    """Si no llegó --org ni AZDO_ORG, usa la guardada en el JSON de trabajo; si tampoco, termina con un mensaje claro."""
    if not ORG and respaldo:
        usar_org(respaldo)
    if not ORG:
        sys.exit("Falta la organización de Azure DevOps: pasa --org <organizacion> "
                 "(sale de migrar_ramas.azure_devops.organizacion en fuentes.yaml) o define AZDO_ORG.")
    return ORG


_auth = None


def auth():
    global _auth
    if _auth:
        return _auth
    exigir_org()
    # Token explícito del líder: variable de entorno del proceso o, en Windows, la de usuario (HKCU\Environment).
    # Manda sobre el de git y nunca se imprime. Se borra al terminar la migración.
    if not os.environ.get("AZDO_PAT") and os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
                os.environ["AZDO_PAT"] = winreg.QueryValueEx(k, "AZDO_PAT")[0]
        except OSError:
            pass
    if os.environ.get("AZDO_PAT"):
        _auth = "Basic " + base64.b64encode(f":{os.environ['AZDO_PAT']}".encode()).decode()
        return _auth
    p = subprocess.run(["git", "credential", "fill"], input=f"protocol=https\nhost=dev.azure.com\npath={ORG}\n\n",
                       capture_output=True, text=True, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
    cred = dict(l.split("=", 1) for l in p.stdout.splitlines() if "=" in l)
    if not cred.get("password"):
        sys.exit("No hay credencial de dev.azure.com en el gestor de git. Clona cualquier repo de la organización una vez para que git la guarde.")
    _auth = "Basic " + base64.b64encode(f"{cred.get('username', '')}:{cred['password']}".encode()).decode()
    return _auth


def get(url, intentos=3):
    err = None
    for _ in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": auth()}), timeout=90) as r:
                return json.load(r)
        except Exception as e:
            err = e
    return {"error": str(err)}


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": auth(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def q(s):
    return urllib.parse.quote(s, safe="")


def proyectos():
    exigir_org()
    return sorted(x["name"] for x in get(f"{BASE}/_apis/projects?api-version=7.0&$top=500").get("value", []))


def repos(proyecto):
    exigir_org()
    return get(f"{BASE}/{q(proyecto)}/_apis/git/repositories?api-version=7.0").get("value", [])


def git_url(proyecto, repo):
    exigir_org()
    return f"{BASE}/{q(proyecto)}/_git/{q(repo)}"
