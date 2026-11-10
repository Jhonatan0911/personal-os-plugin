"""Capa 0 (máquina) de revisar-pr: chequeos deterministas sobre el diff y los metadatos del PR.

  python -I capa0.py --diff diff_completo.diff [--pr pr.json] [--expediente expediente.json]
                     [--jira jira.json] [--config fuentes.yaml] [--verificar-registro]
                     [--salida capa0.json] [--diff-ia diff_para_ia.diff]

- Nunca ejecuta código del PR: solo lee texto.
- Los secretos y datos de pacientes salen ENMASCARADOS en capa0.json y se tachan en diff_para_ia.diff
  (que es lo único que se le pasa a la IA). Los archivos de `excluir_de_ia` no llegan a la IA.
- jira.json (opcional) lo arma la skill con la lectura de Jira: {"clave", "estado", "estimacion_h", "fecha_limite"}.
- --verificar-registro consulta los registros públicos (nuget, npm, PyPI) para ver si cada dependencia nueva
  existe. Es la única salida de red de este script y es de solo lectura.
"""
import argparse, json, re, sys
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import comun, diffutil  # noqa: E402

# ─── Patrones ──────────────────────────────────────────────────────────────────────────────────────
SECRETOS = [
    ("password_en_cadena", "alta", r"(?i)\b(?:password|pwd)\s*=\s*(?P<v>[^;\"'\s<>{}$]{3,})"),
    ("uri_con_credenciales", "alta", r"(?i)\b[a-z][a-z0-9+.-]*://[^/\s:@\"']+:(?P<v>[^@\s\"'/]{3,})@"),
    ("jwt", "alta", r"\b(?P<v>eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})"),
    ("llave_privada", "alta", r"(?P<v>-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----)"),
    ("llave_aws", "alta", r"\b(?P<v>AKIA[0-9A-Z]{16})\b"),
    ("llave_azure_storage", "alta", r"(?i)AccountKey=(?P<v>[A-Za-z0-9+/=]{20,})"),
    ("firma_sas", "alta", r"(?i)[?&]sig=(?P<v>[A-Za-z0-9%+/=]{20,})"),
    ("bearer_literal", "alta", r"(?i)\bbearer\s+(?P<v>[A-Za-z0-9\-_.=]{24,})"),
    ("asignacion_secreta", "alta",
     r"(?i)[\"']?[\w.-]*(?:secret|token|apikey|api_key|passwd|password|contrasena|contraseña|privatekey|clientsecret|client_secret|secretkey)[\w.-]*[\"']?\s*[:=]\s*[\"'](?P<v>[^\"'\s]{8,})[\"']"),
    ("trust_server_certificate", "media", r"(?i)(?P<v>TrustServerCertificate\s*=\s*True)"),
]
MARCADORES = re.compile(r"^\$\{|^\{\{|^<.*>$|^#\{|^__.*__$|^\*+$|^x{3,}$|changeme|cambiar|your[-_]|tu[-_]|ejemplo|example|"
                        r"placeholder|dummy|process\.env|environment\.|configuration\[|^https?://", re.I)
PACIENTES = [
    ("documento_con_etiqueta", "alta",
     r"(?i)(?:c[eé]dula|documento|identificaci[oó]n|num(?:ero)?_?doc\w*|nro_?doc\w*|nuip|\bCC\b|\bTI\b)[\"']?\s*[:=,]?\s*[\"']?(?P<v>\d{6,11})\b"),
    ("nombre_con_etiqueta", "media",
     # «nombre» a secas no cuenta: en el código casi siempre es el nombre de una cosa, no de una persona.
     r"(?i)[\"']?(?:apellidos?|nombres_?(?:y_?)?apellidos|nombre_?completo|nombre_?(?:del_?)?paciente|(?:primer|segundo)_?(?:nombre|apellido)|paciente(?:_?nombre)?)[\"']?\s*[:=]\s*[\"'](?P<v>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})[\"']"),
    ("celular", "media", r"(?<![\d.])(?P<v>(?:\+?57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4})(?![\d.])"),
    ("correo", "media", r"(?P<v>[A-Za-z0-9._%+-]+@(?!example\.|ejemplo\.|test\.|dominio\.|correo\.|mail\.com\b|localhost)[A-Za-z0-9.-]+\.[A-Za-z]{2,})"),
    ("fecha_nacimiento", "media",
     r"(?i)(?:fecha_?nacimiento|fechanacimiento|birth_?date|dob)[\"']?\s*[:=]\s*[\"']?(?P<v>\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})"),
]
DATOS = re.compile(r"(?i)\.(json|csv|sql|xml|ya?ml|txt|http|tsv)$|seed|fixture|mock|/data/|testdata|\.spec\.|test")
TEST = re.compile(r"(?i)(\.spec\.[tj]sx?$|\.test\.[tj]sx?$|tests?\.cs$|_test\.py$|(^|/)test_[^/]*\.py$|(^|/)tests?/|\.tests?/|__tests__/)")
DOC = re.compile(r"(?i)(\.md$|(^|/)docs?/)")
SQL = re.compile(r"(?i)\.sql$")
ROLLBACK = re.compile(r"(?i)rollback|reversa|revert|undo|(^|[/_.-])down([_.-]|$)")
GENERADO = re.compile(r"(?i)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|packages\.lock\.json|\.designer\.cs$|\.g\.cs$|"
                      r"\.min\.(js|css)$|\.snap$|(^|/)migrations/|modelsnapshot\.cs$|\.svg$|(^|/)dist/|(^|/)wwwroot/lib/)")
SKIP_TEST = re.compile(r"\[Ignore\b|\[(Fact|Theory)\(\s*Skip|\bSkip\s*=\s*\"|\bxit\(|\bxdescribe\(|\bfdescribe\(|\bfit\(|"
                       r"\b(it|describe|test)\.skip\(|@pytest\.mark\.skip|@Disabled|@unittest\.skip|\[Explicit\]")
ASSERT_TRIVIAL = re.compile(r"Assert\.(IsTrue|True)\(\s*true\s*\)|expect\(\s*true\s*\)\.toBe(Truthy)?\(\s*(true)?\s*\)|"
                            r"^\s*assert\s+True\s*$|Assert\.Pass\(\)")
ASSERT = re.compile(r"Assert\.|expect\(|\bassert\b|Should\(\)|\.Should\.")
ANY_TS = re.compile(r":\s*any\b|\bas\s+any\b|<any>|\bany\[\]")
SENALES_AGREGADAS = [
    ("sql_armado_con_texto", r"(FromSqlRaw|ExecuteSqlRaw|ExecuteSqlCommand|SqlQueryRaw|new\s+SqlCommand|CommandText\s*=|\.Query(Async)?<?.*>?\()\s*\(?[^;]*(\+\s*[\w(]|\$\"|String\.Format|string\.Format)"),
    ("sql_concatenado", r"(?i)\"\s*(select|insert\s+into|update|delete\s+from)\b[^\"]*\"\s*\+"),
    ("mongo_filtro_texto", r"BsonDocument\.Parse\([^)]*\+|\$where|JsonCommand<"),
    ("html_sin_sanitizar", r"\[innerHTML\]|\.innerHTML\s*=|bypassSecurityTrust\w*|\beval\(|new\s+Function\(|outerHTML\s*="),
    ("endpoint_anonimo", r"\[AllowAnonymous\]|\.AllowAnonymous\(\)"),
    ("cors_abierto", r"AllowAnyOrigin\(\)|SetIsOriginAllowed\(\s*_\s*=>\s*true\)|Access-Control-Allow-Origin\"?\s*[:,]\s*\"\*\""),
    ("catch_vacio", r"catch\s*(\([^)]*\))?\s*\{\s*\}"),
    ("log_con_dato_sensible", r"(?i)(log\w*|console)\.\w+\(.*\b(documento|cedula|cédula|paciente|diagnostico|diagnóstico|password|token)\b"),
    ("ssl_desactivado", r"(?i)ServerCertificateCustomValidationCallback\s*=.*true|rejectUnauthorized\s*:\s*false|verify\s*=\s*False"),
    ("ruta_con_id", r"\[(Http(Get|Put|Delete|Post))\(\s*\"[^\"]*\{(id|\w+Id)\}"),
]
SENALES_BORRADAS = [
    ("autorizacion_borrada", r"\[Authorize|\.RequireAuthorization\(|canActivate|AuthGuard"),
    ("validacion_borrada", r"\[Required|\[MaxLength|\[Range|RuleFor\(|Validators\.|ArgumentNullException|ModelState\.IsValid|"
                           r"throw new \w*(Validation|Argument)\w*Exception|\.NotEmpty\(\)|\.NotNull\(\)|ThrowIfNull"),
]
SQL_DESTRUCTIVO = re.compile(r"(?i)\b(drop\s+(table|column|procedure|proc|view|index|database|function|trigger)|truncate\s+table|"
                             r"alter\s+table\s+\S+\s+drop)\b")
DELETE_SIN_WHERE = re.compile(r"(?i)\bdelete\s+from\s+[\w.\[\]]+\s*;?\s*$")
IDEMPOTENTE = re.compile(r"(?i)if\s+(not\s+)?exists|object_id\s*\(|create\s+or\s+alter|\bmerge\b|col_length\s*\(|if\s+@@|"
                         r"drop\s+\w+\s+if\s+exists")
MUTA = re.compile(r"(?i)\b(create|alter|insert|update|delete|drop)\b")


def _hallazgo(lista, regla, severidad, mensaje, archivo=None, linea=None, evidencia=None, punto=None):
    lista.append({"id": f"M-{len(lista) + 1}", "capa": 0, "regla": regla, "severidad": severidad, "mensaje": mensaje,
                  "archivo": archivo, "linea": linea, "evidencia": evidencia, "punto_checklist": punto})


def _compilar(lista, extra, sev_defecto):
    out = [(n, s, re.compile(p)) for n, s, p in lista]
    for i, p in enumerate(extra or []):
        if isinstance(p, dict):
            out.append((p.get("nombre", f"extra_{i}"), p.get("severidad", sev_defecto), re.compile(p["patron"])))
        else:
            out.append((f"extra_{i}", sev_defecto, re.compile(p)))
    return out


# ─── Chequeos ──────────────────────────────────────────────────────────────────────────────────────
def chequear_rama(pr, cfg, H):
    rama, destino = pr.get("rama", ""), pr.get("destino", "")
    clave = None
    m = re.match(cfg["rama"]["patron"], rama)
    if m:
        clave = m.groupdict().get("clave")
    else:
        t = re.search(cfg["rama"]["patron_tolerante"], rama, re.I)
        if t:
            clave = t.groupdict().get("clave", t.group(0)).upper()
            _hallazgo(H, "rama_formato", "baja", f"La rama trae la clave {clave} pero no cumple el formato exacto.",
                      evidencia=rama, punto=None)
        else:
            _hallazgo(H, "rama_sin_clave", "media", "La rama no trae clave de Jira: no se puede ligar el PR a su issue.",
                      evidencia=rama)
    tipo = rama.split("/", 1)[0] if "/" in rama else rama
    permitidos = cfg["rama"]["destinos"].get(tipo)
    if permitidos is None:
        _hallazgo(H, "rama_tipo_desconocido", "media",
                  f"El tipo de rama «{tipo}» no está en la política de destinos: confirma que puede ir a {destino}.",
                  evidencia=f"{rama} → {destino}")
    elif destino and destino not in permitidos:
        _hallazgo(H, "destino_no_permitido", "alta",
                  f"Una rama «{tipo}» no puede ir a «{destino}» (permitido: {', '.join(permitidos)}).",
                  evidencia=f"{rama} → {destino}")
    if not clave:  # la clave también puede venir en el título
        t = re.search(cfg["rama"]["patron_tolerante"], pr.get("titulo", ""), re.I)
        clave = t.group(0).upper() if t else None
    return clave


def chequear_jira(jira, clave, cfg, H):
    if not jira:
        if clave:
            _hallazgo(H, "issue_no_verificada", "info", f"No se leyó la issue {clave}: su estado no está verificado.")
        return
    validos = cfg["jira"]["estados_validos"]
    if validos and jira.get("estado") not in validos:
        _hallazgo(H, "issue_estado", "media",
                  f"La issue {jira.get('clave')} está en «{jira.get('estado')}», no en {', '.join(validos)}.")
    if not jira.get("estimacion_h"):
        _hallazgo(H, "issue_sin_estimacion", "baja", f"La issue {jira.get('clave')} no tiene estimación.")
    if not jira.get("fecha_limite"):
        _hallazgo(H, "issue_sin_fecha", "baja", f"La issue {jira.get('clave')} no tiene fecha límite.")


def chequear_descripcion(pr, clave, H):
    d = (pr.get("descripcion") or "") + " " + (pr.get("titulo") or "")
    if clave and clave.lower() not in d.lower():
        _hallazgo(H, "descripcion_sin_ticket", "baja", "El título y la descripción del PR no mencionan la clave de la issue.",
                  punto=22)
    if not re.search(r"(?i)prob[éeóoa]|prueba|test|verifi", pr.get("descripcion") or ""):
        _hallazgo(H, "descripcion_sin_pruebas", "baja", "La descripción no dice qué se probó ni cómo.", punto=22)


def escanear(archivos, secretos, pacientes, excluir, H, tachar):
    for a in archivos:
        ruta = a["ruta"]
        es_datos = bool(DATOS.search(ruta))
        if comun.coincide(ruta, ["**/*.pfx", "**/*.p12", "**/*.pem", "**/*.key", "*.pfx", "*.p12", "*.pem", "*.key"]) \
                and a["tipo"] != "borrado":
            _hallazgo(H, "archivo_de_llave", "alta", "El PR agrega un archivo de certificado o llave.", ruta, None, ruta, 1)
        if ruta.endswith("settings.local.json") and a["tipo"] != "borrado":
            _hallazgo(H, "settings_local", "alta", "El PR sube un settings.local.json (aprobaciones locales del agente).",
                      ruta, None, ruta, 1)
        for n, texto in a["agregadas"]:
            for nombre, sev, rx in secretos:
                for m in rx.finditer(texto):
                    v = m.groupdict().get("v") or m.group(0)
                    if nombre in ("asignacion_secreta", "password_en_cadena") and MARCADORES.search(v):
                        continue
                    _hallazgo(H, f"secreto:{nombre}", sev, "Posible secreto en una línea agregada.", ruta, n,
                              comun.enmascarar(v), 1)
                    tachar.setdefault(ruta, []).append((n, v))
            for nombre, sev, rx in pacientes:
                if nombre != "documento_con_etiqueta" and not es_datos:
                    continue
                for m in rx.finditer(texto):
                    v = m.groupdict().get("v") or m.group(0)
                    _hallazgo(H, f"paciente:{nombre}", sev,
                              "Posible dato real de una persona en una línea agregada (confirmar si es sintético).",
                              ruta, n, comun.enmascarar(v, 2), 5)
                    tachar.setdefault(ruta, []).append((n, v))


DEP_CSPROJ = re.compile(r"<PackageReference\s+Include=\"(?P<n>[^\"]+)\"(?:\s+Version=\"(?P<v>[^\"]*)\")?")
DEP_PKGCFG = re.compile(r"<package\s+id=\"(?P<n>[^\"]+)\"\s+version=\"(?P<v>[^\"]*)\"")
DEP_NPM = re.compile(r"^\s*\"(?P<n>@?[a-z0-9][\w.-]*(?:/[\w.-]+)?)\"\s*:\s*\"(?P<v>[~^<>=*]?\s*[\d*x][^\"]*|latest|next|npm:[^\"]+|file:[^\"]+|git[^\"]*|https?:[^\"]+)\"")
DEP_PY = re.compile(r"^\s*(?P<n>[A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?P<v>(==|>=|<=|~=|!=|>|<)\s*[^\s;#]+)?\s*(#.*)?$")
NO_DEP_NPM = {"name", "version", "description", "main", "module", "types", "typings", "license", "node", "npm", "engines"}


def dependencias(archivos):
    out = []
    for a in archivos:
        ruta = a["ruta"]
        nombre_arch = ruta.rsplit("/", 1)[-1].lower()
        if nombre_arch.endswith(".csproj") or nombre_arch == "directory.packages.props":
            rx, eco = DEP_CSPROJ, "nuget"
        elif nombre_arch == "packages.config":
            rx, eco = DEP_PKGCFG, "nuget"
        elif nombre_arch == "package.json":
            rx, eco = DEP_NPM, "npm"
        elif nombre_arch.startswith("requirements") and nombre_arch.endswith(".txt"):
            rx, eco = DEP_PY, "pypi"
        else:
            continue
        viejas = {}
        for _, t in a["borradas"]:
            m = rx.search(t)
            if m:
                viejas[m.group("n").lower()] = m.groupdict().get("v")
        for n, t in a["agregadas"]:
            m = rx.search(t)
            if not m or (eco == "npm" and m.group("n") in NO_DEP_NPM):
                continue
            nombre, version = m.group("n"), (m.groupdict().get("v") or "").strip()
            previa = viejas.get(nombre.lower())
            if previa is not None and previa == version:
                continue
            out.append({"ecosistema": eco, "nombre": nombre, "version": version, "archivo": ruta, "linea": n,
                        "tipo": "actualizada" if nombre.lower() in viejas else "nueva", "version_previa": previa,
                        "version_fija": bool(version) and not re.match(r"^[~^*<>]|latest|next|x", version)})
    return out


def existe_en_registro(dep):
    n = dep["nombre"]
    urls = {"nuget": f"https://api.nuget.org/v3-flatcontainer/{n.lower()}/index.json",
            "npm": "https://registry.npmjs.org/" + urllib.parse.quote(n, safe="@"),
            "pypi": f"https://pypi.org/pypi/{n}/json"}
    try:
        with urllib.request.urlopen(urllib.request.Request(urls[dep["ecosistema"]], headers={"User-Agent": "revisar-pr"}),
                                    timeout=20) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return False if e.code == 404 else None
    except Exception:
        return None


def chequear_dependencias(deps, verificar, internos, H):
    for d in deps:
        if d["tipo"] == "nueva":
            _hallazgo(H, "dependencia_nueva", "media",
                      f"Dependencia nueva {d['nombre']} {d['version']} ({d['ecosistema']}): requiere aprobación del líder.",
                      d["archivo"], d["linea"], f"{d['nombre']} {d['version']}", 2)
        if not d["version_fija"] and not d["version"].startswith(("file:", "git", "http")):
            _hallazgo(H, "dependencia_version_no_fija", "baja", f"{d['nombre']} no fija la versión ({d['version'] or 'sin versión'}).",
                      d["archivo"], d["linea"], d["version"], 2)
        if verificar and not any(d["nombre"].lower().startswith(p.lower()) for p in internos):
            existe = existe_en_registro(d)
            d["existe_en_registro"] = existe
            if existe is False:
                _hallazgo(H, "dependencia_inexistente", "alta",
                          f"{d['nombre']} no existe en el registro público de {d['ecosistema']}: posible paquete inventado "
                          "(o de un feed interno no declarado).", d["archivo"], d["linea"], d["nombre"], 2)


def chequear_entregables(archivos, requeridos, H):
    tocados = [a for a in archivos if a["tipo"] != "borrado"]
    sqls = [a for a in tocados if SQL.search(a["ruta"])]
    presentes = {
        "tests": any(TEST.search(a["ruta"]) for a in tocados),
        "docs": any(DOC.search(a["ruta"]) for a in tocados),
        "script_bd": any(not ROLLBACK.search(a["ruta"]) for a in sqls) or any("/migrations/" in a["ruta"].lower() for a in tocados),
        "rollback": any(ROLLBACK.search(a["ruta"]) for a in sqls),
    }
    faltan = []
    for e in requeridos:
        partes = ["script_bd", "rollback"] if e.replace(" ", "") in ("script_bd+rollback", "scriptbd+rollback") else [e]
        faltan += [p for p in partes if not presentes.get(p, False)]
    for f in faltan:
        _hallazgo(H, "entregable_faltante", "media" if f != "rollback" else "alta",
                  f"Falta el entregable «{f}» que pide la subtarea.", punto=11 if f in ("script_bd", "rollback") else 10)
    if any(not ROLLBACK.search(a["ruta"]) for a in sqls) and not presentes["rollback"] and "rollback" not in faltan:
        _hallazgo(H, "script_bd_sin_rollback", "media",
                  "El PR trae scripts de BD y ningún script de rollback (toda escritura va con publicación + rollback).",
                  sqls[0]["ruta"], None, None, 11)
    for a in sqls:
        codigo = [(n, re.sub(r"--.*$", "", t)) for n, t in a["agregadas"]]  # los comentarios SQL no se ejecutan
        cuerpo = "\n".join(t for _, t in codigo)
        for n, t in codigo:
            protegido = IDEMPOTENTE.search(t) or re.search(r"(?i)drop\s+table\s+#|delete\s+from\s+[@#]", t)  # guardado o temporal
            if (SQL_DESTRUCTIVO.search(t) or DELETE_SIN_WHERE.search(t)) and not protegido:
                _hallazgo(H, "sql_destructivo", "media", "Sentencia destructiva en un script de BD: revisarla línea por línea.",
                          a["ruta"], n, t.strip()[:120], 11)
        if not ROLLBACK.search(a["ruta"]) and MUTA.search(cuerpo) and not IDEMPOTENTE.search(cuerpo):
            _hallazgo(H, "sql_no_idempotente", "media", "El script de BD no muestra guardas de idempotencia (IF EXISTS, MERGE…).",
                      a["ruta"], None, None, 11)
    return {"requeridos": requeridos, "presentes": [k for k, v in presentes.items() if v], "faltantes": faltan}


def chequear_tests(archivos, H):
    for a in archivos:
        es_test = bool(TEST.search(a["ruta"]))
        if a["tipo"] == "borrado" and es_test:
            _hallazgo(H, "test_borrado", "media", "Se borró un archivo de pruebas: debe estar justificado en la descripción.",
                      a["ruta"], None, None, 7)
            continue
        for n, t in a["agregadas"]:
            if SKIP_TEST.search(t):
                _hallazgo(H, "test_saltado", "media", "Se agregó una marca que salta o aísla pruebas.", a["ruta"], n, t.strip()[:120], 7)
            if ASSERT_TRIVIAL.search(t):
                _hallazgo(H, "assert_trivial", "media", "Assert que siempre pasa.", a["ruta"], n, t.strip()[:120], 9)
        if es_test and a["tipo"] != "agregado":
            quitados = sum(1 for _, t in a["borradas"] if ASSERT.search(t))
            puestos = sum(1 for _, t in a["agregadas"] if ASSERT.search(t))
            if quitados > puestos:
                _hallazgo(H, "asserts_reducidos", "media",
                          f"El archivo de pruebas pierde asserts ({quitados} quitados, {puestos} agregados).", a["ruta"], None, None, 7)


def chequear_any(archivos, nuevo_front, H):
    for a in archivos:
        if not a["ruta"].endswith(".ts") or a["ruta"].endswith(".d.ts"):
            continue
        lineas = [(n, t) for n, t in a["agregadas"] if ANY_TS.search(t) and not t.strip().startswith("//")]
        if lineas:
            _hallazgo(H, "tipo_any", "media" if nuevo_front else "baja",
                      f"{len(lineas)} línea(s) agregadas usan `any`.", a["ruta"], lineas[0][0], lineas[0][1].strip()[:120], 15)


def senales(archivos):
    out = []
    agregadas = [(n, re.compile(p)) for n, p in SENALES_AGREGADAS]
    borradas = [(n, re.compile(p)) for n, p in SENALES_BORRADAS]
    for a in archivos:
        if a["binario"]:
            continue
        for n, t in a["agregadas"]:
            for nombre, rx in agregadas:
                if rx.search(t):
                    out.append({"regla": nombre, "archivo": a["ruta"], "linea": n, "lado": "agregada", "extracto": t.strip()[:160]})
        for n, t in a["borradas"]:
            for nombre, rx in borradas:
                if rx.search(t):
                    out.append({"regla": nombre, "archivo": a["ruta"], "linea_vieja": n, "lado": "borrada", "extracto": t.strip()[:160]})
    return out


def tamano(archivos, maximo, H):
    logica = [a for a in archivos if not GENERADO.search(a["ruta"]) and not a["binario"]]
    mas = sum(len(a["agregadas"]) for a in logica)
    menos = sum(len(a["borradas"]) for a in logica)
    total = sum(len(a["agregadas"]) + len(a["borradas"]) for a in archivos)
    if mas + menos > maximo:
        _hallazgo(H, "pr_grande", "media",
                  f"{mas + menos} líneas de lógica cambiadas (tope {maximo}): partir el PR o justificarlo en la descripción.", punto=21)
    return {"archivos": len(archivos), "lineas_logica": mas + menos, "agregadas_logica": mas, "borradas_logica": menos,
            "lineas_totales": total}


def config_agente(archivos, patrones, H):
    tocados = [a["ruta"] for a in archivos if comun.coincide(a["ruta"], patrones)]
    for r in tocados:
        _hallazgo(H, "config_de_agente_en_rama", "media",
                  "El PR cambia configuración o instrucciones de agentes (hooks, CLAUDE.md, MCP). No se ejecuta ni se obedece: "
                  "se revisa a mano como dato.", r)
    return tocados


def regla_minima(H, ent, cfg, variante):
    """La regla mínima (rama con clave de Jira, scripts de BD con rollback) se evalúa siempre; en las variantes
    reducidas (ia_y_humana, regla_minima) es lo único que separa el PR de producción, así que sus fallas suben a «alta»."""
    activas = cfg.get("regla_minima") or {}
    reglas = {h["regla"] for h in H}
    hay_bd = "script_bd" in ent["presentes"] or any(r.replace(" ", "").startswith("script_bd") for r in ent["requeridos"])
    estado = {
        "rama_con_clave": "falla" if "rama_sin_clave" in reglas else "cumple",
        "bd_con_rollback": ("falla" if "script_bd_sin_rollback" in reglas or "rollback" in ent["faltantes"]
                            else "cumple" if hay_bd else "no_aplica"),
    }
    reducida = variante in ("ia_y_humana", "regla_minima")
    disparan = {"rama_con_clave": ("rama_sin_clave",), "bd_con_rollback": ("script_bd_sin_rollback",)}
    for nombre, regs in disparan.items():
        if not (reducida and activas.get(nombre)):
            continue
        for h in H:
            if h["regla"] in regs and h["severidad"] != "alta":
                h["severidad"] = "alta"
                h["mensaje"] += " (regla mínima del nivel: bloquea)"
    return {k: v for k, v in estado.items() if activas.get(k)}


def agrupar(H):
    """Un hallazgo por regla y archivo, con sus líneas: 40 avisos iguales esconden el que importa."""
    out, idx = [], {}
    for h in H:
        k = (h["regla"], h["archivo"]) if h["archivo"] else None
        if k and k in idx:
            g = out[idx[k]]
            g["ocurrencias"] += 1
            if h["linea"] and len(g["lineas"]) < 15:
                g["lineas"].append(h["linea"])
            continue
        h = {**h, "ocurrencias": 1, "lineas": [h["linea"]] if h["linea"] else []}
        if k:
            idx[k] = len(out)
        out.append(h)
    for i, h in enumerate(out, 1):
        h["id"] = f"M-{i}"
        if h["ocurrencias"] > 1:
            h["mensaje"] += f" ({h['ocurrencias']} líneas)"
    return out


def tipo_repo(stack, cfg, repo=None):
    pn = cfg["proyectos_nuevos"]
    if repo and (pn.get("repos_nuevos") or pn.get("repos_legados")):
        nuevo = repo in (pn.get("repos_nuevos") or [])
        return {"backend": "nuevo" if nuevo else "legado", "frontend": "nuevo" if nuevo else "legado",
                "guia_backend": pn.get("guia_backend") if nuevo else None,
                "guia_frontend": pn.get("guia_frontend") if nuevo else None, "criterio": "lista de la configuración",
                "dotnet": stack.get("dotnet", []), "angular": stack.get("angular")}
    nets = []
    for t in stack.get("dotnet", []):
        m = re.match(r"net(\d+)\.", t)
        if m:
            nets.append(int(m.group(1)))
    back_nuevo = bool(pn.get("dotnet_min")) and bool(nets) and min(nets) >= pn["dotnet_min"]
    front_nuevo = bool(pn.get("angular_min")) and bool(stack.get("angular")) and stack["angular"] >= pn["angular_min"]
    return {"backend": "nuevo" if back_nuevo else ("legado" if stack.get("dotnet") else None),
            "frontend": "nuevo" if front_nuevo else ("legado" if stack.get("angular") else None),
            "guia_backend": pn.get("guia_backend") if back_nuevo else None,
            "guia_frontend": pn.get("guia_frontend") if front_nuevo else None,
            "criterio": "versión del stack (confirmar con el líder: la versión no prueba que sea proyecto nuevo)",
            "dotnet": stack.get("dotnet", []), "angular": stack.get("angular")}


def criterios_del_expediente(exp, clave):
    if not exp:
        return [], [], None
    subtareas = [s for s in exp.get("subtareas", []) if clave and (s.get("clave") == clave or s.get("historia") == clave)]
    historias = exp.get("historias", [])
    if clave:
        propias = [h for h in historias if h.get("clave") == clave or any(s.get("historia") == h.get("clave") for s in subtareas)]
        historias = propias or historias
    ids = {c for s in subtareas for c in s.get("criterios", [])}
    criterios = []
    for h in historias:
        for c in h.get("criterios", []):
            if not ids or c.get("id") in ids:
                criterios.append({"historia": h.get("clave"), **c})
    entregables = sorted({e for s in subtareas for e in s.get("entregables", [])})
    return criterios, entregables, [s.get("titulo") for s in subtareas]


def diff_para_ia(texto, excluir, tachar):
    out, ruta, excluido, nueva = [], None, False, 0
    for linea in texto.splitlines():
        if linea.startswith("diff --git "):
            ruta = linea.split(" b/", 1)[-1]
            excluido = comun.coincide(ruta, excluir)
            out.append(linea)
            if excluido:
                out.append(f"@@ [archivo excluido de la revisión IA por configuración: la capa 0 ya lo escaneó] @@")
            continue
        if excluido:
            continue
        if linea.startswith("@@"):
            m = diffutil._HUNK.match(linea)
            nueva = int(m.group(3)) if m else nueva
        elif linea.startswith("+") and not linea.startswith("+++"):
            for n, v in tachar.get(ruta, []):
                if n == nueva and v:
                    linea = linea.replace(v, "«[oculto por capa 0]»")
            nueva += 1
        elif linea.startswith(" "):
            nueva += 1
        out.append(linea)
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff", required=True)
    ap.add_argument("--pr")
    ap.add_argument("--expediente")
    ap.add_argument("--jira")
    ap.add_argument("--config")
    ap.add_argument("--verificar-registro", action="store_true")
    ap.add_argument("--salida")
    ap.add_argument("--diff-ia")
    ap.add_argument("--variante", help="fuerza la variante de p4 (el líder insiste): completo|ia_y_humana|regla_minima")
    a = ap.parse_args()
    cfg = comun.cargar_config(a.config)
    texto = Path(a.diff).read_text(encoding="utf-8", errors="replace")
    archivos = diffutil.parsear(texto)
    pr = comun.leer_json(a.pr) if a.pr else {}
    exp = comun.leer_json(a.expediente) if a.expediente else None
    jira = comun.leer_json(a.jira) if a.jira else None
    nivel = comun.resolver_nivel(a.config or {}, exp, variante=a.variante)
    H, tachar = [], {}

    clave = chequear_rama(pr, cfg, H) if pr else None
    if pr:
        chequear_descripcion(pr, clave, H)
    chequear_jira(jira, clave, cfg, H)
    secretos = _compilar(SECRETOS, cfg["patrones_extra"].get("secretos"), "alta")
    pacientes = _compilar(PACIENTES, cfg["patrones_extra"].get("pacientes"), "media")
    escanear(archivos, secretos, pacientes, cfg["excluir_de_ia"], H, tachar)
    deps = dependencias(archivos)
    chequear_dependencias(deps, a.verificar_registro, cfg.get("feeds_internos_prefijos", []), H)
    criterios, entregables, subtareas = criterios_del_expediente(exp, clave)
    ent = chequear_entregables(archivos, entregables or cfg["entregables_por_defecto"], H)
    chequear_tests(archivos, H)
    repo = tipo_repo(pr.get("stack", {}), cfg, pr.get("repo"))
    chequear_any(archivos, repo["frontend"] == "nuevo", H)
    agente = config_agente(archivos, cfg["no_tocar_de_la_rama"], H)
    tam = tamano(archivos, cfg["tamano_max_lineas"], H)
    minima = regla_minima(H, ent, cfg, nivel["variante"])
    H = agrupar(H)
    sen = senales(archivos)
    excluidos = [x["ruta"] for x in archivos if comun.coincide(x["ruta"], cfg["excluir_de_ia"])]

    cuenta = {s: sum(1 for h in H if h["severidad"] == s) for s in ("alta", "media", "baja", "info")}
    resultado = {
        "pr": {k: pr.get(k) for k in ("id", "repo", "proyecto", "rama", "destino", "autor", "titulo", "url")} if pr else None,
        "clave": clave, "tipo_repo": repo, "resumen": {**cuenta, "senales": len(sen)},
        "bloqueante": cuenta["alta"] > 0, "hallazgos": H, "senales_para_ia": sen, "dependencias": deps,
        "entregables": ent, "tamano": tam, "config_de_agente_tocada": agente, "excluidos_de_ia": excluidos,
        "criterios": criterios, "subtareas": subtareas,
        "criterios_fuente": "expediente" if criterios else None,
        "nivel": nivel, "regla_minima": minima,
    }
    if a.salida:
        comun.escribir_json(a.salida, resultado)
    if a.diff_ia:
        Path(a.diff_ia).write_text(diff_para_ia(texto, cfg["excluir_de_ia"], tachar), encoding="utf-8")
    print(f"Capa 0 · clave {clave or '—'} · {tam['archivos']} archivos · {tam['lineas_logica']} líneas de lógica")
    if nivel["niveles_activos"] or nivel["forzado"]:
        print(f"Nivel {nivel['nivel'] or '—'} ({nivel['origen']}) · p4: {nivel['variante'] or 'no aplica'}"
              + (" (forzada por el líder)" if nivel["forzado"] else "") + (f" · {nivel['aviso']}" if nivel["aviso"] else ""))
    print(f"Hallazgos: {cuenta['alta']} alta · {cuenta['media']} media · {cuenta['baja']} baja · {len(sen)} señales para la IA")
    for h in H:
        if h["severidad"] in ("alta", "media"):
            donde = f" ({h['archivo']}:{h['linea']})" if h["archivo"] else ""
            print(f"  [{h['severidad']}] {h['regla']}{donde}: {h['mensaje']}")
    if not a.salida:
        print(json.dumps(resultado, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
