"""Paso 7. Plan de migración a partir de las decisiones «Migrar» y «Va a otro proyecto».
Por defecto NO escribe nada en Azure: arma el plan y, con --repos, muestra exactamente qué haría con ese lote.

Uso:
  python plan_migracion.py <carpeta_decisiones> <data.json> <carpeta_trabajo>
  python plan_migracion.py ... --repos repo1,repo2                 (simulación del lote: lee Azure, no escribe)
  python plan_migracion.py ... --repos repo1,repo2 --ejecutar      (escribe en Azure)
  [--alias "<Nombre visible>=<PROYECTO>"]   (repetible: nombre que pudo quedar en una decisión → proyecto real)
  [--ramas-v2 "develop,qa,staging"] [--sin-ramas-v2]   (la organización sale de data.json o de --org)

Qué hace por repo:
  1. Crea el repo en el proyecto destino si no existe, con `nombre` si la decisión lo trae (cambio de nombre).
  2. Sube la rama decidida como `main` y, desde ella, las ramas de --ramas-v2 (por defecto `develop`, `qa` y
     `staging`, Política de Branching V2; --sin-ramas-v2 lo apaga). Las ramas adicionales suben con su mismo nombre.
  3. `modo: "solo-rama"` (desarrollo que no está en producción): sube solo la rama con su nombre, sin main ni V2.
  4. `fuente: {org, proyecto?, repo, rama}`: el origen es otro repo u otra organización (p. ej. la vieja).
Nunca fuerza: si alguna rama a crear ya existe en el destino, el repo se salta y se reporta.
--ejecutar es una escritura en Azure DevOps: solo con la orden explícita del líder para ESE lote de repos."""
import os, sys, json, glob, argparse, subprocess, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

ap = argparse.ArgumentParser()
ap.add_argument("decisiones"); ap.add_argument("data"); ap.add_argument("trabajo")
ap.add_argument("--repos", default="")
ap.add_argument("--ejecutar", action="store_true")
ap.add_argument("--sin-ramas-v2", action="store_true")
ap.add_argument("--ramas-v2", nargs="?", const="develop,qa,staging", default="develop,qa,staging")
ap.add_argument("--alias", action="append", default=[])
a = ap.parse_args()

meta = json.load(open(a.data, encoding="utf-8"))
azdo.exigir_org(meta.get("org"))
data = {r["n"]: r for r in meta["repos"]}
PROY = dict(x.split("=", 1) for x in a.alias if "=" in x)
V2 = [b.strip() for b in a.ramas_v2.split(",") if b.strip()]
dec = {}
for f in glob.glob(os.path.join(a.decisiones, "*.json")):
    d = json.load(open(f, encoding="utf-8")); d = d.get("data", d); dec[d["repo"]] = d

plan = []
for repo, d in sorted(dec.items(), key=lambda kv: kv[0].lower()):
    # «otro» = va a otro proyecto de Azure (transversal u otro cliente): se migra igual, a ese proyecto
    if d["decision"] not in ("migrar", "otro") or repo not in data:
        continue
    x = data[repo]
    f = d.get("fuente") or {}
    destino = (d.get("destino") or x["dest"])[0]
    solo = d.get("modo") == "solo-rama"
    rama = f.get("rama") or d["rama"]
    if solo:
        crear = {rama: rama}
    else:
        crear = {"main": rama}
        if not a.sin_ramas_v2:
            crear.update({b: rama for b in V2})
    for e in d.get("extras") or []:
        crear[e] = e
    plan.append({"repo": repo, "org_origen": f.get("org") or azdo.ORG,
                 "proyecto_origen": f.get("proyecto") or (f.get("repo") if f.get("org") else x.get("o") or meta["origen"][0]),
                 "repo_origen": f.get("repo") or repo, "rama": rama, "destino": PROY.get(destino, destino),
                 "repo_destino": d.get("nombre") or repo, "crear": crear, "otro": d["decision"] == "otro"})

md = [f"# Plan de migración · {len(plan)} repos", "",
      "| Repo origen | Origen | Destino | Repo destino | Ramas en destino ← origen |", "|---|---|---|---|---|"]
md += [f"| {p['repo_origen']} | {p['org_origen']}/{p['proyecto_origen']} | {p['destino']} | {p['repo_destino']} | "
       + ", ".join(f"{k} ← {v}" for k, v in p["crear"].items()) + " |" for p in plan]
open(os.path.join(a.trabajo, "plan_migracion.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
json.dump(plan, open(os.path.join(a.trabajo, "plan_migracion.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Plan: {len(plan)} repos → {os.path.join(a.trabajo, 'plan_migracion.md')}")

if a.repos.startswith("@"):  # --repos @archivo.txt: lista separada por comas o por líneas
    a.repos = open(a.repos[1:], encoding="utf-8-sig").read().replace("\n", ",")
lote = [r.strip() for r in a.repos.split(",") if r.strip()]
if not lote:
    sys.exit(0)
falta = [r for r in lote if r not in {p["repo"] for p in plan}]
if falta:
    sys.exit(f"Estos repos no están marcados «Migrar» ni «Va a otro proyecto»: {', '.join(falta)}")


def git(*args, cwd=None):
    # Con AZDO_PAT, git usa ese token solo para la organización destino (azdo.ORG), vía variables
    # de entorno del proceso: no queda en la línea de comandos ni en la configuración de git.
    env = dict(os.environ)
    if env.get("AZDO_PAT"):
        env.update({"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": f"http.{azdo.BASE}/.extraHeader",
                    "GIT_CONFIG_VALUE_0": "Authorization: " + azdo.auth()})
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", timeout=900, env=env)


def url(org, proyecto, repo):
    return f"https://dev.azure.com/{org}/{azdo.q(proyecto)}/_git/{azdo.q(repo)}"


modo = "EJECUCIÓN" if a.ejecutar else "SIMULACIÓN (no escribe nada)"
print(f"\n=== Lote: {', '.join(lote)} · {modo}")
ids = {}
# Reanudable: cada repo deja una línea en ejecucion.jsonl; al volver a correr se compara contra Azure y solo
# se crea lo que falta. Una rama que ya existe en el destino con el mismo commit del origen cuenta como hecha.
diario = os.path.join(a.trabajo, "ejecucion.jsonl")


def anotar(**k):
    if a.ejecutar:
        k["fecha"] = __import__("datetime").datetime.now().isoformat(timespec="seconds")
        open(diario, "a", encoding="utf-8").write(json.dumps(k, ensure_ascii=False) + "\n")


def heads(salida):
    return {l.split("\t")[1].replace("refs/heads/", ""): l.split("\t")[0] for l in salida.splitlines() if "\trefs/heads/" in l}


resumen = {}
for p in [p for p in plan if p["repo"] in lote]:
    r, dst, nom = p["repo"], p["destino"], p["repo_destino"]
    print(f"\n[{r}] {p['org_origen']}/{p['proyecto_origen']}/{p['repo_origen']} @ {p['rama']}  →  {azdo.ORG}/{dst}/{nom}", flush=True)
    u_o = url(p["org_origen"], p["proyecto_origen"], p["repo_origen"])
    ro = git("ls-remote", "--heads", u_o)
    oh = heads(ro.stdout) if ro.returncode == 0 else {}
    if p["rama"] not in oh or any(src not in oh for src in p["crear"].values()):
        msg = "origen no accesible o falta una rama: " + ((ro.stderr.strip().splitlines() or [''])[-1][:150] if ro.returncode else
                                                          ", ".join(s for s in set(p["crear"].values()) if s not in oh))
        print("  → SE SALTA:", msg); resumen[r] = "saltado"; anotar(repo=r, destino=f"{dst}/{nom}", estado="saltado", detalle=msg); continue
    print("  origen: rama encontrada", oh[p["rama"]][:8])
    existe = nom.lower() in {x["name"].lower() for x in azdo.repos(dst)}
    dh = heads(git("ls-remote", "--heads", url(azdo.ORG, dst, nom)).stdout) if existe else {}
    hechas = [b for b, src in p["crear"].items() if dh.get(b) == oh[src]]
    choque = [b for b, src in p["crear"].items() if b in dh and dh[b] != oh[src]]
    faltan = [b for b in p["crear"] if b not in dh]
    print("  destino:", f"el repo YA EXISTE en {dst}" if existe else f"el repo no existe en {dst}: se crea «{nom}»")
    for b, src in p["crear"].items():
        print(f"    rama {b:<12} ← {src}" + ("   ✓ ya está" if b in hechas else "   ⚠ existe con OTRO commit, NO se toca" if b in choque else ""))
    if choque:
        msg = "ramas con otro commit en destino: " + ", ".join(choque)
        print("  → SE SALTA:", msg); resumen[r] = "saltado"; anotar(repo=r, destino=f"{dst}/{nom}", estado="saltado", detalle=msg); continue
    if not faltan:
        print("  → ya migrado"); resumen[r] = "migrado"; anotar(repo=r, destino=f"{dst}/{nom}", estado="migrado", detalle="ya estaba completo", ramas={b: oh[s][:8] for b, s in p["crear"].items()}); continue
    if not a.ejecutar:
        print("  → listo para ejecutar"); continue
    try:
        if not existe:
            if dst not in ids:
                ids[dst] = azdo.get(f"{azdo.BASE}/_apis/projects/{azdo.q(dst)}?api-version=7.0")["id"]
            azdo.post(f"{azdo.BASE}/{azdo.q(dst)}/_apis/git/repositories?api-version=7.0", {"name": nom, "project": {"id": ids[dst]}})
            print(f"  repo creado: {dst}/{nom}")
    except Exception as e:
        print("  ERROR al crear el repo:", str(e)[:200]); resumen[r] = "error"; anotar(repo=r, destino=f"{dst}/{nom}", estado="error", detalle="crear repo: " + str(e)[:200]); continue
    tmp = tempfile.mkdtemp(prefix="mig-")
    errores = []
    try:
        git("init", "--bare", "-q", tmp)
        fuentes = sorted(set(p["crear"][b] for b in faltan))
        fe = git("fetch", "-q", "--no-tags", u_o, *[f"+refs/heads/{b}:refs/heads/{b}" for b in fuentes], cwd=tmp)
        if fe.returncode:
            errores.append("fetch: " + fe.stderr.strip()[:200])
        else:
            primero = "main" if "main" in faltan else faltan[0]
            for b in [primero] + [x for x in faltan if x != primero]:  # main primero: queda como rama por defecto
                s = git("push", "-q", url(azdo.ORG, dst, nom), f"refs/heads/{p['crear'][b]}:refs/heads/{b}", cwd=tmp)
                print(f"  {b:<12} " + ("OK" if not s.returncode else "ERROR: " + s.stderr.strip()[:200]), flush=True)
                if s.returncode:
                    errores.append(f"{b}: " + s.stderr.strip()[:150])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    resumen[r] = "error" if errores else "migrado"
    anotar(repo=r, destino=f"{dst}/{nom}", estado=resumen[r], detalle="; ".join(errores) or "creado",
           ramas={b: oh[s][:8] for b, s in p["crear"].items()})

if resumen:
    from collections import Counter
    print("\n=== Resumen:", dict(Counter(resumen.values())))
    for r, e in resumen.items():
        if e != "migrado":
            print(f"  {e}: {r}")
