"""Lee un PR de Azure DevOps por REST, en SOLO LECTURA, y arma su diff sin clonar ni ejecutar nada.

  python -I azdo_pr.py <id | URL del PR | CLAVE-JIRA> [--config fuentes.yaml] [--org ORG] [--proyecto P]
                       [--salida DIR]

Escribe en DIR (por defecto <temp>/revisar-pr/pr-<id>):
  pr.json             metadatos (título, descripción, ramas, autor, revisores, commits, stack del repo destino)
  diff_completo.diff  diff unificado base común → rama del PR (lo lee la capa 0; NO se le pasa a la IA)
  contexto/CLAUDE.md  el CLAUDE.md de la rama DESTINO, si existe (el de la rama del PR no es confiable)

Credencial: la misma que usa git para dev.azure.com (o AZDO_PAT del entorno). Vive solo en memoria:
nunca se imprime, nunca se escribe. Solo hace GET: no hay ninguna llamada que modifique el PR.
Con una clave de Jira busca el PR en `azure_devops.proyectos`; si hay varios, los lista y sale con código 2.
"""
import argparse, base64, difflib, json, os, re, subprocess, sys, tempfile
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun  # noqa: E402

API = "api-version=7.0"
MAX_ARCHIVOS = 400
MAX_BYTES = 1_000_000
_auth = None
ORG = None


def auth():
    global _auth
    if _auth:
        return _auth
    pat = os.environ.get("AZDO_PAT")
    if not pat and os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
                pat = winreg.QueryValueEx(k, "AZDO_PAT")[0]
        except OSError:
            pat = None
    if pat:
        _auth = "Basic " + base64.b64encode(f":{pat}".encode()).decode()
        return _auth
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never"}
    p = subprocess.run(["git", "credential", "fill"], input=f"protocol=https\nhost=dev.azure.com\npath={ORG}\n\n",
                       capture_output=True, text=True, env=env, timeout=60)
    cred = dict(l.split("=", 1) for l in p.stdout.splitlines() if "=" in l)
    if not cred.get("password"):
        sys.exit("No hay credencial de dev.azure.com en el gestor de git ni AZDO_PAT. "
                 "Clona una vez cualquier repo de la organización para que git la guarde.")
    _auth = "Basic " + base64.b64encode(f"{cred.get('username', '')}:{cred['password']}".encode()).decode()
    return _auth


def _get(url, crudo=False):
    req = urllib.request.Request(url, headers={"Authorization": auth()}, method="GET")
    with urllib.request.urlopen(req, timeout=90) as r:
        datos = r.read()
    return datos if crudo else json.loads(datos.decode("utf-8"))


def get(url, crudo=False):
    ultimo = None
    for _ in range(3):
        try:
            return _get(url, crudo)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                sys.exit(f"Azure DevOps respondió {e.code}: la credencial no sirve o no tiene permiso de lectura.")
            if e.code == 404:
                return None
            ultimo = e
        except Exception as e:  # red intermitente
            ultimo = e
    sys.exit(f"No se pudo leer {url.split('?')[0]}: {ultimo}")


def q(s):
    return urllib.parse.quote(s, safe="")


def base(proyecto=None):
    return f"https://dev.azure.com/{ORG}" + (f"/{q(proyecto)}" if proyecto else "")


def buscar_por_clave(clave, proyectos):
    hallados = []
    for proy in proyectos:
        for estado in ("active", "all"):
            r = get(f"{base(proy)}/_apis/git/pullrequests?searchCriteria.status={estado}&$top=300&{API}") or {}
            for p in r.get("value", []):
                if clave.lower() in p.get("sourceRefName", "").lower() or clave.lower() in p.get("title", "").lower():
                    hallados.append(p)
            if hallados:
                break
    unicos = {p["pullRequestId"]: p for p in hallados}
    return list(unicos.values())


def resolver(objetivo, cfg, proyecto):
    m = re.search(r"dev\.azure\.com/([^/]+)/([^/]+)/_git/[^/]+/pullrequest/(\d+)", objetivo)
    if m:
        return get(f"https://dev.azure.com/{m.group(1)}/{m.group(2)}/_apis/git/pullrequests/{m.group(3)}?{API}")
    if objetivo.isdigit():
        pr = get(f"{base(proyecto)}/_apis/git/pullrequests/{objetivo}?{API}")
        if not pr:
            sys.exit(f"No encontré el PR {objetivo} en la organización.")
        return pr
    proyectos = [proyecto] if proyecto else cfg["azure_devops"]["proyectos"]
    if not proyectos:
        sys.exit("Para buscar por clave de Jira hace falta `azure_devops.proyectos` en la configuración o --proyecto.")
    hallados = buscar_por_clave(objetivo, proyectos)
    if not hallados:
        sys.exit(f"No hay PR con '{objetivo}' en la rama o el título en: {', '.join(proyectos)}.")
    if len(hallados) > 1:
        print(json.dumps([{"id": p["pullRequestId"], "repo": p["repository"]["name"], "estado": p["status"],
                           "rama": p["sourceRefName"], "destino": p["targetRefName"],
                           "creado": p["creationDate"][:10]} for p in hallados], ensure_ascii=False, indent=1))
        print("Hay varios PR con esa clave: elige uno y vuelve a correr con su id.")
        sys.exit(2)
    return hallados[0]


def blob(proy, repo_id, sha):
    if not sha or set(sha) == {"0"}:
        return b""
    return get(f"{base(proy)}/_apis/git/repositories/{repo_id}/blobs/{sha}?$format=octetstream&{API}", crudo=True) or b""


def por_ruta(proy, repo_id, ruta, commit):
    url = (f"{base(proy)}/_apis/git/repositories/{repo_id}/items?path={q(ruta)}"
           f"&versionDescriptor.version={commit}&versionDescriptor.versionType=commit&$format=octetstream&{API}")
    return get(url, crudo=True) or b""


def texto(datos):
    if len(datos) > MAX_BYTES or b"\x00" in datos[:8000]:
        return None
    return datos.decode("utf-8-sig", errors="replace")


def diff_de(ruta, ruta_vieja, viejo, nuevo, tipo):
    cab = [f"diff --git a/{ruta_vieja or ruta} b/{ruta}"]
    if tipo == "agregado":
        cab.append("new file mode 100644")
    elif tipo == "borrado":
        cab.append("deleted file mode 100644")
    elif tipo == "renombrado":
        cab += [f"rename from {ruta_vieja}", f"rename to {ruta}"]
    if viejo is None or nuevo is None:
        return "\n".join(cab + [f"Binary files a/{ruta_vieja or ruta} and b/{ruta} differ"])
    a = "/dev/null" if tipo == "agregado" else f"a/{ruta_vieja or ruta}"
    b = "/dev/null" if tipo == "borrado" else f"b/{ruta}"
    cuerpo = list(difflib.unified_diff(viejo.splitlines(), nuevo.splitlines(), a, b, n=3, lineterm=""))
    return "\n".join(cab + cuerpo)


def stack(proy, repo_id, commit):
    """Versiones del repo en la rama destino: TargetFramework de los .csproj y @angular/core."""
    r = get(f"{base(proy)}/_apis/git/repositories/{repo_id}/items?recursionLevel=Full"
            f"&versionDescriptor.version={commit}&versionDescriptor.versionType=commit&{API}") or {}
    rutas = [i["path"] for i in r.get("value", []) if not i.get("isFolder")]
    out = {"dotnet": [], "angular": None, "claude_md": "/CLAUDE.md" in rutas, "archivos_repo": len(rutas)}
    for ruta in sorted((p for p in rutas if p.endswith(".csproj")), key=lambda p: p.count("/"))[:4]:
        t = texto(por_ruta(proy, repo_id, ruta, commit)) or ""
        for m in re.findall(r"<TargetFrameworks?>([^<]+)</TargetFrameworks?>", t):
            out["dotnet"] += [x.strip() for x in m.split(";") if x.strip()]
        m = re.search(r"<TargetFrameworkVersion>([^<]+)<", t)
        if m:
            out["dotnet"].append("netframework" + m.group(1))
    pkgs = sorted((p for p in rutas if p.endswith("/package.json") and "node_modules" not in p), key=lambda p: p.count("/"))
    if pkgs:
        t = texto(por_ruta(proy, repo_id, pkgs[0], commit)) or ""
        m = re.search(r'"@angular/core"\s*:\s*"[~^]?(\d+)[^"]*"', t)
        if m:
            out["angular"] = int(m.group(1))
    out["dotnet"] = sorted(set(out["dotnet"]))
    return out


def main():
    global ORG
    ap = argparse.ArgumentParser()
    ap.add_argument("objetivo")
    ap.add_argument("--config")
    ap.add_argument("--org")
    ap.add_argument("--proyecto")
    ap.add_argument("--salida")
    a = ap.parse_args()
    cfg = comun.cargar_config(a.config)
    ORG = a.org or os.environ.get("AZDO_ORG") or cfg["azure_devops"]["organizacion"]
    if not ORG and "dev.azure.com/" not in a.objetivo:
        sys.exit("Falta la organización de Azure DevOps: `azure_devops.organizacion` en la configuración o --org.")
    if not ORG:
        ORG = re.search(r"dev\.azure\.com/([^/]+)/", a.objetivo).group(1)

    pr = resolver(a.objetivo, cfg, a.proyecto)
    pid, repo = pr["pullRequestId"], pr["repository"]
    proy, repo_id = repo["project"]["name"], repo["id"]
    salida = Path(a.salida or cfg.get("carpeta_trabajo") or Path(tempfile.gettempdir()) / "revisar-pr" / f"pr-{pid}")
    (salida / "contexto").mkdir(parents=True, exist_ok=True)

    its = (get(f"{base(proy)}/_apis/git/repositories/{repo_id}/pullRequests/{pid}/iterations?{API}") or {}).get("value", [])
    if not its:
        sys.exit("El PR no tiene iteraciones (¿borrador vacío?).")
    it = its[-1]
    c_fuente = it["sourceRefCommit"]["commitId"]
    c_destino = it["targetRefCommit"]["commitId"]
    c_comun = (it.get("commonRefCommit") or {}).get("commitId") or c_destino

    cambios, skip = [], 0
    while True:
        r = get(f"{base(proy)}/_apis/git/repositories/{repo_id}/pullRequests/{pid}/iterations/{it['id']}/changes"
                f"?$top=2000&$skip={skip}&$compareTo=0&{API}") or {}
        cambios += r.get("changeEntries", [])
        if not r.get("nextSkip"):
            break
        skip = r["nextSkip"]

    partes, omitidos = [], []
    for c in cambios[:MAX_ARCHIVOS]:
        item = c.get("item", {})
        if item.get("isFolder") or item.get("gitObjectType") == "tree":
            continue
        ruta = item.get("path", "").lstrip("/")
        tipo_az = c.get("changeType", "edit")
        vieja = (c.get("originalPath") or c.get("sourceServerItem") or "").lstrip("/") or None
        tipo = ("agregado" if "add" in tipo_az else "borrado" if "delete" in tipo_az
                else "renombrado" if "rename" in tipo_az else "modificado")
        nuevo = None if tipo == "borrado" else texto(
            blob(proy, repo_id, item.get("objectId")) or por_ruta(proy, repo_id, "/" + ruta, c_fuente))
        viejo = None if tipo == "agregado" else texto(
            blob(proy, repo_id, item.get("originalObjectId")) or por_ruta(proy, repo_id, "/" + (vieja or ruta), c_comun))
        if tipo == "agregado":
            viejo = ""
        if tipo == "borrado":
            nuevo = ""
        partes.append(diff_de(ruta, vieja if tipo == "renombrado" else None, viejo, nuevo, tipo))
    if len(cambios) > MAX_ARCHIVOS:
        omitidos = [c.get("item", {}).get("path") for c in cambios[MAX_ARCHIVOS:]]
    (salida / "diff_completo.diff").write_text("\n".join(partes) + "\n", encoding="utf-8")

    claude_md = texto(por_ruta(proy, repo_id, "/CLAUDE.md", c_destino))
    if claude_md:
        (salida / "contexto" / "CLAUDE.md").write_text(claude_md, encoding="utf-8")

    commits = (get(f"{base(proy)}/_apis/git/repositories/{repo_id}/pullRequests/{pid}/commits?$top=100&{API}") or {}).get("value", [])
    meta = {
        "organizacion": ORG, "proyecto": proy, "repo": repo["name"], "id": pid,
        "url": f"https://dev.azure.com/{ORG}/{q(proy)}/_git/{q(repo['name'])}/pullrequest/{pid}",
        "titulo": pr.get("title", ""), "descripcion": pr.get("description", "") or "",
        "estado": pr.get("status"), "borrador": pr.get("isDraft", False),
        "rama": pr.get("sourceRefName", "").replace("refs/heads/", ""),
        "destino": pr.get("targetRefName", "").replace("refs/heads/", ""),
        "autor": (pr.get("createdBy") or {}).get("displayName"),
        "creado": pr.get("creationDate", "")[:10],
        "revisores": [{"nombre": r.get("displayName"), "voto": r.get("vote"), "obligatorio": r.get("isRequired", False)}
                      for r in pr.get("reviewers", [])],
        "commits": [{"id": c["commitId"][:10], "mensaje": (c.get("comment") or "")[:200],
                     "autor": (c.get("author") or {}).get("name")} for c in commits],
        "commit_fuente": c_fuente, "commit_destino": c_destino, "commit_comun": c_comun,
        "iteracion": it["id"], "archivos": len(cambios), "archivos_omitidos": omitidos,
        "stack": stack(proy, repo_id, c_destino),
        "claude_md_destino": bool(claude_md),
    }
    comun.escribir_json(salida / "pr.json", meta)
    print(f"PR {pid} · {proy}/{repo['name']} · {meta['rama']} → {meta['destino']} · {len(cambios)} archivos")
    print(f"Carpeta de trabajo: {salida}")


if __name__ == "__main__":
    main()
