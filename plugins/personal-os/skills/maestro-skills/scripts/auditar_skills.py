#!/usr/bin/env python3
"""Auditor determinista de Agent Skills (Claude Code).

Revisa una skill o una carpeta llena de skills y devuelve, por skill, los hallazgos
de forma (frontmatter, tamaño, referencias, rutas, portabilidad, datos personales
metidos en el texto) y un puntaje de 0 a 100. No juzga la calidad del contenido:
eso lo hace el agente con references/rubrica.md. Este script solo mide lo medible.

Uso:
  python auditar_skills.py <ruta> [<ruta> ...] [--json] [--personal datos.json]

  <ruta>        carpeta de una skill (con SKILL.md) o carpeta que contiene skills
  --json        salida en JSON (para que otro script o un artefacto la consuma)
  --personal    JSON con {"terminos": ["<usuario>", "<cedula>", ...]}: palabras que
                delatan datos de una persona concreta (nombres, cédula, correos,
                rutas de su equipo). Sin él se usan solo patrones genéricos.

Salida: código 0 siempre que pudo leer; 2 si una ruta no existe.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

# Límites documentados por Anthropic (code.claude.com/docs/en/skills y
# platform.claude.com/.../agent-skills/best-practices), consultados el 09/11/2026.
MAX_LINEAS_SKILL = 500          # SKILL.md recomendado por debajo de 500 líneas
MAX_DESC_API = 1024             # tope de description en la API y claude.ai
MAX_DESC_LISTADO = 1536         # description + when_to_use se truncan aquí en Claude Code
MAX_NAME = 64                   # tope de name en la API
REF_LINEAS_INDICE = 100         # referencias más largas piden índice al inicio
TOKENS_POR_CARACTER = 0.25      # aproximación de 4 caracteres por token (texto mixto)
SOLAPE_ALTO = 0.35              # Jaccard de palabras clave a partir del cual dos descripciones compiten

CAMPOS_CLAUDE_CODE = {
    "name", "description", "when_to_use", "argument-hint", "arguments",
    "disable-model-invocation", "user-invocable", "allowed-tools", "disallowed-tools",
    "model", "effort", "context", "agent", "background", "hooks", "paths", "shell",
    "metadata", "license", "compatibility", "version",
}
# Fuera de Claude Code (claude.ai, Skills API, package_skill.py) cualquier otra clave es error duro.
CAMPOS_PORTABLES = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}

PATRONES_PERSONALES = [
    (re.compile(r"[A-Za-z]:\\Users\\[^\\\s]+", re.I), "ruta absoluta de un usuario de Windows"),
    (re.compile(r"/(?:home|Users)/[a-z0-9_.-]+/", re.I), "ruta absoluta de un usuario"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"), "correo electrónico"),
    # Número suelto de 8-10 dígitos; no cuenta si va pegado a un nombre de archivo, ruta, id o fecha.
    (re.compile(r"(?<![\w./\\:#-])\d{8,10}(?![\w./\\:-])"), "número largo (¿cédula, teléfono o id?)"),
    (re.compile(r"OneDrive\s-\s", re.I), "carpeta de OneDrive de una organización"),
]
# Marcadores con que se escriben los ejemplos genéricos: <usuario>, fulano, ejemplo, ${VAR}.
MARCADOR = re.compile(r"<[^>]*>|fulano|ejemplo|example|\$\{", re.I)
STOP = set("""a al algo ante con contra de del desde donde el ella en entre era es esa ese eso esta este esto
la las le lo los mas me mi muy no o os para pero por que se si sin sobre su sus te tu un una uno unos y ya
the and or of to in for on with is are be when use this that it as by from an at your you skill skills
usala usalo cuando digan pidan pida diga hace cada todo toda todos""".split())


def leer(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def frontmatter(texto: str):
    """Devuelve (dict_campos, cuerpo, error). Parser YAML mínimo: claves de primer nivel."""
    if not texto.startswith("---"):
        return {}, texto, "el archivo no empieza con '---': Claude Code lo trata todo como contenido"
    partes = texto.split("\n---", 1)
    if len(partes) < 2:
        return {}, texto, "frontmatter sin cierre '---'"
    bruto, cuerpo = partes[0][3:], partes[1].lstrip("-").lstrip("\n")
    campos, clave = {}, None
    for linea in bruto.splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", linea)
        if m:
            clave = m.group(1)
            campos[clave] = m.group(2).strip().strip('"').strip("'")
        elif clave and linea.startswith((" ", "\t")):
            campos[clave] = (campos[clave] + " " + linea.strip()).strip()
    return campos, cuerpo, None


def palabras_clave(texto: str) -> set:
    return {w for w in re.findall(r"[a-záéíóúñü0-9-]{4,}", texto.lower()) if w not in STOP}


def auditar(skill_dir: Path, personales: list) -> dict:
    skill_md = skill_dir / "SKILL.md"
    texto = leer(skill_md)
    campos, cuerpo, err = frontmatter(texto)
    H = []  # (gravedad, regla, detalle)  gravedad: alta | media | baja

    def h(g, regla, detalle):
        H.append({"gravedad": g, "regla": regla, "detalle": detalle})

    if err:
        h("alta", "frontmatter", err)

    nombre = campos.get("name") or skill_dir.name
    desc = campos.get("description", "")
    cuando = campos.get("when_to_use", "")

    # --- name
    if not re.fullmatch(r"[a-z0-9-]+", nombre):
        h("media", "name", f"'{nombre}' no es minúsculas/números/guiones (la API lo rechaza)")
    if len(nombre) > MAX_NAME:
        h("media", "name", f"name de {len(nombre)} caracteres (> {MAX_NAME})")
    if re.search(r"claude|anthropic", nombre):
        h("media", "name", "name con 'claude' o 'anthropic' (reservado en la API)")
    if campos.get("name") and campos["name"] != skill_dir.name:
        h("baja", "name", f"name '{campos['name']}' distinto de la carpeta '{skill_dir.name}'")

    # --- description
    if not desc:
        h("alta", "description", "sin description: Claude no sabe cuándo usarla")
    else:
        if len(desc) > MAX_DESC_API:
            h("media", "description", f"{len(desc)} caracteres (> {MAX_DESC_API}: no portable a claude.ai/API)")
        if len(desc) + len(cuando) > MAX_DESC_LISTADO:
            h("alta", "description", f"description + when_to_use = {len(desc)+len(cuando)} (> {MAX_DESC_LISTADO}: se trunca en el listado)")
        if len(desc) < 80:
            h("media", "description", "muy corta: falta el qué y el cuándo con palabras que diría el usuario")
        if not re.search(r"\b(úsal[ao]|use when|cuando|when)\b", (desc + " " + cuando).lower()):
            h("media", "description", "no dice cuándo usarla ('Úsala cuando…')")
        if re.match(r"^\s*(yo |puedo |i can |i will |te ayudo)", desc.lower()):
            h("baja", "description", "en primera persona: va en tercera ('Genera…', 'Audita…')")
        if "<" in desc and ">" in desc:
            h("baja", "description", "trae etiquetas tipo XML (la API las rechaza)")

    # --- campos
    desconocidos = set(campos) - CAMPOS_CLAUDE_CODE
    if desconocidos:
        h("baja", "frontmatter", f"campos que Claude Code ignora: {', '.join(sorted(desconocidos))}")
    no_portables = set(campos) - CAMPOS_PORTABLES
    portable = not no_portables

    # --- tamaño
    lineas = cuerpo.count("\n") + 1
    tokens_cuerpo = int(len(cuerpo) * TOKENS_POR_CARACTER)
    tokens_listado = int((len(nombre) + len(desc) + len(cuando)) * TOKENS_POR_CARACTER)
    if lineas > MAX_LINEAS_SKILL:
        h("alta", "tamaño", f"SKILL.md de {lineas} líneas (> {MAX_LINEAS_SKILL}): partir en references/")
    elif lineas > 350:
        h("media", "tamaño", f"SKILL.md de {lineas} líneas: cerca del límite, revisar qué sobra")
    if tokens_cuerpo > 5000:
        h("media", "tamaño", f"~{tokens_cuerpo} tokens: tras compactar solo sobreviven los primeros 5.000; lo crítico va arriba")

    # --- estilo
    gritos = len(re.findall(r"\b(SIEMPRE|NUNCA|MUST|NEVER|ALWAYS|OBLIGATORIO|PROHIBIDO)\b", cuerpo))
    if gritos > 12:
        h("baja", "estilo", f"{gritos} mayúsculas imperativas: explicar el porqué rinde más que gritar")
    if not re.search(r"(?im)^#+\s.*(no (la )?us|cuándo no|when not|fuera de alcance|no es para)", cuerpo):
        h("baja", "estilo", "sin sección de cuándo NO usarla (ayuda a no chocar con otras skills)")

    # --- referencias y rutas
    refs = re.findall(r"\]\(([^)#\s]+)\)|`((?:references|reference|scripts|assets|agents)/[^`\s]+)`", cuerpo)
    for a, b in refs:
        r = (a or b).strip()
        if r.startswith(("http", "mailto:", "$", "{")) or "<" in r or "*" in r:
            continue
        destino = (skill_dir / r).resolve()
        if not destino.exists():
            h("media", "referencias", f"apunta a '{r}', que no existe en la skill")
    if re.search(r"(?<![\\])\b(scripts|references|assets)\\[\w.-]+", cuerpo):
        h("baja", "rutas", "rutas internas con barra invertida: usar '/'")
    for ref in skill_dir.rglob("*.md"):
        if ref.name == "SKILL.md":
            continue
        n = leer(ref).count("\n") + 1
        if n > REF_LINEAS_INDICE and not re.search(r"(?im)^#+\s*(índice|indice|contenido|contents)", leer(ref)):
            h("baja", "referencias", f"{ref.relative_to(skill_dir)} tiene {n} líneas y no tiene índice al inicio")

    # --- basura y scripts huérfanos
    if any(skill_dir.rglob("__pycache__")):
        h("baja", "limpieza", "trae __pycache__: borrarlo y añadirlo a .gitignore")
    for s in skill_dir.glob("scripts/*"):
        if s.is_file() and s.name not in texto:
            h("baja", "referencias", f"scripts/{s.name} no se nombra en SKILL.md: Claude no sabe que existe ni cuándo correrlo")

    # --- datos personales (generalización)
    personal = []
    todo = texto + "\n" + "\n".join(leer(p) for p in skill_dir.rglob("*") if p.is_file() and p.suffix in {".md", ".py", ".js", ".json", ".ps1", ".sh"} and p != skill_md)
    for pat, que in PATRONES_PERSONALES:
        for m in set(pat.findall(todo)):
            if MARCADOR.search(m):  # ejemplos de documentación, no datos reales
                continue
            personal.append(f"{que}: {m}")
    for t in personales:
        if t and re.search(re.escape(t), todo, re.I):
            personal.append(f"término personal: {t}")
    personal = sorted(set(personal))
    if personal:
        g = "alta" if len(personal) >= 5 else "media"
        h(g, "generalización", f"{len(personal)} dato(s) de una persona o equipo metidos en el texto: no sirve tal cual a otro líder")

    peso = {"alta": 15, "media": 6, "baja": 2}
    puntaje = max(0, 100 - sum(peso[x["gravedad"]] for x in H))
    return {
        "skill": nombre, "ruta": str(skill_dir), "puntaje": puntaje,
        "lineas": lineas, "tokens_cuerpo": tokens_cuerpo, "tokens_listado": tokens_listado,
        "portable_fuera_de_claude_code": portable,
        "campos_no_portables": sorted(no_portables),
        "generalizable": not personal,
        "datos_personales": personal[:30],
        "hallazgos": H, "_kw": palabras_clave(desc + " " + cuando),
        "_hash": hashlib.sha1(texto.encode("utf-8")).hexdigest(),
    }


def encontrar(rutas):
    vistos = []
    for r in rutas:
        p = Path(r).expanduser()
        if not p.exists():
            print(f"No existe: {p}", file=sys.stderr)
            sys.exit(2)
        if (p / "SKILL.md").exists():
            vistos.append(p)
        else:
            vistos += sorted(s.parent for s in p.rglob("SKILL.md") if "node_modules" not in s.parts)
    return vistos


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("rutas", nargs="+")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--personal")
    a = ap.parse_args()
    try:  # la consola de Windows usa cp1252 y revienta con tildes y símbolos
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    personales = json.loads(Path(a.personal).read_text(encoding="utf-8")).get("terminos", []) if a.personal else []

    res = [auditar(d, personales) for d in encontrar(a.rutas)]

    # Solape de descripciones: dos skills que compiten por los mismos pedidos.
    for i, x in enumerate(res):
        for y in res[i + 1:]:
            if not x["_kw"] or not y["_kw"]:
                continue
            j = len(x["_kw"] & y["_kw"]) / len(x["_kw"] | y["_kw"])
            if x["skill"] == y["skill"]:
                igual = x["_hash"] == y["_hash"]
                det = (f"copia idéntica en {y['ruta']}: dejar una sola fuente" if igual
                       else f"COPIA DIVERGENTE en {y['ruta']}: comparar y unificar antes de editar")
                for z, otra in ((x, y), (y, x)):
                    z["hallazgos"].append({"gravedad": "media" if igual else "alta", "regla": "duplicado",
                                           "detalle": det if z is x else det.replace(y["ruta"], x["ruta"])})
            elif j >= SOLAPE_ALTO:
                x["hallazgos"].append({"gravedad": "media", "regla": "solape", "detalle": f"compite con '{y['skill']}' (similitud {j:.0%})"})
    for x in res:
        x.pop("_kw")
        x.pop("_hash")
        peso = {"alta": 15, "media": 6, "baja": 2}
        x["puntaje"] = max(0, 100 - sum(peso[f["gravedad"]] for f in x["hallazgos"]))

    total_listado = sum(x["tokens_listado"] for x in res)
    if a.json:
        print(json.dumps({"skills": res, "tokens_listado_total": total_listado}, ensure_ascii=False, indent=2))
        return
    for x in sorted(res, key=lambda r: r["puntaje"]):
        print(f"\n## {x['skill']}  ·  {x['puntaje']}/100  ·  {x['lineas']} líneas  ·  ~{x['tokens_cuerpo']} tokens al cargarse  ·  {x['ruta']}")
        for f in sorted(x["hallazgos"], key=lambda f: ["alta", "media", "baja"].index(f["gravedad"])):
            print(f"  [{f['gravedad']}] {f['regla']}: {f['detalle']}")
        for d in x["datos_personales"][:8]:
            print(f"     · {d}")
        if not x["hallazgos"]:
            print("  sin hallazgos de forma")
    print(f"\n{len(res)} skill(s). Listado (name+description) ≈ {total_listado} tokens en cada sesión.")


if __name__ == "__main__":
    main()
