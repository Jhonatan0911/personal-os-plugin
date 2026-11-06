#!/usr/bin/env node
'use strict';
/*
 * Personal OS — ownership de código y bus factor por frente.
 *
 *   node personas-doa.js --repos <carpeta donde están los clones>
 *   node personas-doa.js --repos ... --escribir      (actualiza personas/_bus-factor.md)
 *
 * QUÉ HACE
 *   1. Por cada repo, lee `git log --numstat` (todo local, no toca ningún servidor).
 *   2. Calcula el Degree of Authorship de cada (autor, archivo):
 *        · FA — ¿creó el archivo?          empujón fuerte
 *        · DL — cuántas veces lo cambió    suma
 *        · AC — cambios de OTROS después   resta, en curva logarítmica
 *      Normaliza 0..1 contra el máximo del archivo. Experto = DOA >= 0.75.
 *   3. Agrega por repo y por carpeta de primer nivel — NO por archivo. La unidad de decisión del
 *      usuario es el frente funcional, no el archivo.
 *   4. Calcula el bus factor con el algoritmo de Avelino: saca al experto de más archivos, cuenta
 *      los que quedan huérfanos, repite hasta que más de la mitad no tenga experto.
 *
 * QUÉ NO HACE, Y HAY QUE DECIRLO CADA VEZ
 *   El DOA solo ve código. No ve pruebas, análisis, acompañamiento funcional ni conocimiento de
 *   negocio. Que alguien no aparezca aquí NO significa que no sepa del frente: significa que no
 *   lo commiteó. Este número complementa las fichas; no las reemplaza.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./personas-lib.js');

/*
 * Coeficientes del modelo de Fritz et al. Se dejan CONFIGURABLES y a la vista, no incrustados,
 * porque son la parte del cálculo que no se ha verificado contra el paper.
 * Antes de tomar una decisión de personal con este número: contrastarlos con la publicación.
 * El orden de magnitud y el signo sí están confirmados: crear pesa, cambiar suma, que otros
 * cambien después resta en curva logarítmica.
 */
const COEF = {
  base: 3.293,
  primerAutor: 1.098,     // FA
  entrega: 0.164,         // DL
  ajeno: 0.321,           // AC  (se resta como  ajeno * ln(1 + AC))
  umbralExperto: 0.75,
  _verificado: false,
};

const dirRepos = L.arg('--repos', '');
const unRepo = L.arg('--repo', '');
const escribir = process.argv.includes('--escribir');

if (!dirRepos && !unRepo) {
  process.stdout.write(`
personas-doa — ownership de código y bus factor por frente

  node personas-doa.js --repo  <un repo clonado>          [--escribir]
  node personas-doa.js --repos <carpeta con varios>        [--escribir]

⚠️  ESTO NO ES UN BARRIDO. Si la organización tiene cientos de repositorios, clonarlos todos no
    tiene sentido. El uso previsto es BAJO DEMANDA:

      "¿quién domina de verdad el módulo de facturación?"
         → se clona ESE repo, una vez, y se responde con datos.

    Un repo con historial pesa poco si se clona sin blobs:
      git clone --filter=blob:none --no-checkout <url> <destino>/<repo>

    Y como el análisis es 100% local (git log), no hace falta API del proveedor de git ni un
    token dedicado: basta que el clon exista y que git tenga con qué autenticarse.

    Antes de correrlo, mapear los autores en <estado>/personas/_identidades.yaml (campo git:).
    Sin ese mapeo el script NO adivina: los reporta como "sin mapear" y no los atribuye a nadie.
`);
  process.exit(0);
}

const base = L.stateDir();
const hoy = L.hoyISO();
if (escribir && !base) fallar(L.SIN_ESTADO);

if (dirRepos && !fs.existsSync(dirRepos)) fallar(`No existe la carpeta de repos: ${dirRepos}`);
if (unRepo && !fs.existsSync(unRepo)) fallar(`No existe el repo: ${unRepo}`);

// ───────────────────────────────────────────────── identidades: nada se adivina

const identidades = L.cargarIdentidades(base);
const porEmail = new Map();
for (const p of identidades) {
  const gits = Array.isArray(p.git) ? p.git : (p.git ? [p.git] : []);
  for (const g of gits) if (g) porEmail.set(L.normalizar(g), p.slug);
  if (p.correo) porEmail.set(L.normalizar(p.correo), p.slug);
}

// ─────────────────────────────────────────────────────────── recorrer repos

const repos = unRepo ? [unRepo] : fs.readdirSync(dirRepos, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(dirRepos, d.name))
  .filter((r) => fs.existsSync(path.join(r, '.git')) || fs.existsSync(path.join(r, 'HEAD')));

if (!repos.length) fallar(`No hay repositorios git en ${dirRepos}`);

const sinMapear = new Map();
const resultados = [];

for (const repo of repos) {
  const nombre = path.basename(path.resolve(repo));
  let log = '';
  try {
    log = execFileSync('git', [
      '-C', repo, 'log', '--no-merges', '--numstat', '--date=short',
      '--pretty=format:::%H|%an|%ae|%ad',
    ], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  } catch (e) {
    process.stderr.write(`⚠️  ${nombre}: no se pudo leer el log (${e.message.split('\n')[0]})\n`);
    continue;
  }
  resultados.push(analizarRepo(nombre, log));
}

render(resultados);

// ═══════════════════════════════════════════════════════════════ funciones

/**
 * Recorre el log de un repo y calcula el DOA de cada (autor, archivo).
 * El log viene del más reciente al más antiguo, así que se invierte para poder saber quién CREÓ
 * cada archivo — sin eso, FA (la señal más fuerte del modelo) no se puede calcular.
 */
function analizarRepo(nombre, log) {
  const commits = [];
  let actual = null;

  for (const linea of log.split(/\r?\n/)) {
    if (linea.startsWith('::')) {
      const [hash, an, ae, ad] = linea.slice(2).split('|');
      actual = { hash, autor: an, email: (ae || '').toLowerCase(), fecha: ad, archivos: [] };
      commits.push(actual);
      continue;
    }
    if (!actual || !linea.trim()) continue;
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(linea);
    if (!m) continue;
    let archivo = m[3];
    const ren = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(archivo);   // renombrado con llaves
    if (ren) archivo = (ren[1] + ren[3] + ren[4]).replace(/\/\//g, '/');
    else if (archivo.includes(' => ')) archivo = archivo.split(' => ').pop();
    actual.archivos.push(archivo);
  }
  commits.reverse();   // del más antiguo al más reciente

  const archivos = new Map();   // ruta -> {creador, porAutor:Map, eventos:[]}
  let n = 0;
  for (const c of commits) {
    const quien = identificar(c);
    for (const a of c.archivos) {
      if (!archivos.has(a)) archivos.set(a, { creador: quien, porAutor: new Map(), eventos: [] });
      const reg = archivos.get(a);
      const prev = reg.porAutor.get(quien) || { dl: 0, ultimo: -1 };
      prev.dl += 1;
      prev.ultimo = n;
      reg.porAutor.set(quien, prev);
      reg.eventos.push({ quien, idx: n });
    }
    n += 1;
  }

  // DOA por archivo, normalizado contra el máximo de ese archivo
  const expertosPorArchivo = new Map();   // ruta -> Set(slug)
  const porPersona = new Map();           // slug -> {archivos, experto, carpetas:Map}

  for (const [ruta, reg] of archivos) {
    const doas = [];
    for (const [quien, datos] of reg.porAutor) {
      const fa = reg.creador === quien ? 1 : 0;
      const ac = reg.eventos.filter((e) => e.quien !== quien && e.idx > datos.ultimo).length;
      const doa = COEF.base
        + COEF.primerAutor * fa
        + COEF.entrega * datos.dl
        - COEF.ajeno * Math.log(1 + ac);
      doas.push({ quien, doa });
    }
    const max = Math.max(...doas.map((d) => d.doa));
    const expertos = new Set();
    for (const d of doas) {
      const norm = max > 0 ? d.doa / max : 0;
      if (!porPersona.has(d.quien)) porPersona.set(d.quien, { archivos: 0, experto: 0, carpetas: new Map() });
      const p = porPersona.get(d.quien);
      p.archivos += 1;
      if (norm >= COEF.umbralExperto) {
        p.experto += 1;
        expertos.add(d.quien);
        // Un archivo suelto en la raíz no es una carpeta: agruparlo por su propio nombre
        // inventaría "carpetas" como `README.md` y ensuciaría el mapeo carpeta → frente.
        const carpeta = ruta.includes('/') ? ruta.split('/')[0] : '(raíz)';
        p.carpetas.set(carpeta, (p.carpetas.get(carpeta) || 0) + 1);
      }
    }
    expertosPorArchivo.set(ruta, expertos);
  }

  return {
    repo: nombre,
    totalArchivos: archivos.size,
    totalCommits: commits.length,
    porPersona,
    busFactor: calcularBusFactor(expertosPorArchivo),
  };
}

/**
 * Algoritmo de Avelino. Saca iterativamente al experto de más archivos y cuenta los huérfanos;
 * para cuando más de la mitad de los archivos se quedó sin ningún experto.
 */
function calcularBusFactor(expertosPorArchivo) {
  const vivos = new Map();
  for (const [ruta, set] of expertosPorArchivo) vivos.set(ruta, new Set(set));
  const total = vivos.size;
  if (!total) return { numero: 0, salida: [], huerfanosIniciales: 0 };

  const huerfanosIniciales = [...vivos.values()].filter((s) => s.size === 0).length;
  const sacados = [];

  while (true) {
    const huerfanos = [...vivos.values()].filter((s) => s.size === 0).length;
    if (huerfanos > total / 2) break;

    const cuenta = new Map();
    for (const set of vivos.values()) for (const q of set) cuenta.set(q, (cuenta.get(q) || 0) + 1);
    if (!cuenta.size) break;

    const [top] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    sacados.push(top);
    for (const set of vivos.values()) set.delete(top);
  }
  return { numero: sacados.length, salida: sacados, huerfanosIniciales };
}

/** email/nombre de git → slug de persona. Lo no mapeado se REPORTA, nunca se inventa. */
function identificar(commit) {
  const porCorreo = porEmail.get(L.normalizar(commit.email));
  if (porCorreo) return porCorreo;
  const porNombre = porEmail.get(L.normalizar(commit.autor));
  if (porNombre) return porNombre;
  const clave = `${commit.autor} <${commit.email}>`;
  sinMapear.set(clave, (sinMapear.get(clave) || 0) + 1);
  return `??:${commit.email || commit.autor}`;
}

function render(resultados) {
  const dominios = L.cargarDominios(base);
  const frentePorRepo = new Map();
  for (const f of dominios.frentes) {
    const repos = Array.isArray(f.repos) ? f.repos : (f.repos ? [f.repos] : []);
    for (const r of repos) frentePorRepo.set(L.normalizar(r), f);
  }

  const out = [];
  out.push(`# Bus factor y ownership de código — corte ${hoy}`);
  out.push('');
  out.push('> Calculado con `personas-doa.js` sobre los clones locales. **Solo ve código:** no ve');
  out.push('> pruebas, análisis, acompañamiento funcional ni conocimiento de negocio. Que alguien no');
  out.push('> aparezca aquí no significa que no sepa del frente — significa que no lo commiteó.');
  if (!COEF._verificado) {
    out.push('>');
    out.push('> ⚠️ Los coeficientes del DOA están **sin verificar contra el paper de Fritz**. Antes de');
    out.push('> usar este número para una decisión de personal, contrastarlos.');
  }
  out.push('');

  for (const r of resultados) {
    const frente = frentePorRepo.get(L.normalizar(r.repo));
    out.push(`## ${r.repo}${frente ? `  →  frente: ${frente.nombre || frente.clave}` : '  → (repo sin frente en _dominios.md)'}`);
    out.push('');
    out.push(`- ${r.totalArchivos} archivos · ${r.totalCommits} commits`);
    out.push(`- **Bus factor: ${r.busFactor.numero}**` +
      (r.busFactor.numero <= 1 ? '  🔴 si esa persona sale, más de la mitad del repo queda sin experto' : ''));
    if (r.busFactor.salida.length) {
      out.push(`- Orden de criticidad: ${r.busFactor.salida.map(nombrePersona).join(' → ')}`);
    }
    if (r.busFactor.huerfanosIniciales) {
      out.push(`- ⚠️ ${r.busFactor.huerfanosIniciales} archivos ya no tienen ningún experto hoy`);
    }
    out.push('');
    const filas = [...r.porPersona.entries()]
      .sort((a, b) => b[1].experto - a[1].experto)
      .slice(0, 10);
    out.push('| Persona | Archivos donde es experto | Tocó | Carpetas principales |');
    out.push('|---|---|---|---|');
    for (const [slug, p] of filas) {
      const carpetas = [...p.carpetas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([c, n]) => `${c} (${n})`).join(', ');
      out.push(`| ${nombrePersona(slug)} | ${p.experto} | ${p.archivos} | ${carpetas || '—'} |`);
    }
    out.push('');
  }

  if (sinMapear.size) {
    out.push('## ⚠️ Autores de git sin mapear a una persona');
    out.push('');
    out.push('Mientras estén aquí, su trabajo NO cuenta para ninguna ficha. Agregar su correo al');
    out.push('campo `git:` en `_identidades.yaml`. El script no adivina: mezclar dos humanos en un');
    out.push('perfil contamina el bus factor del frente entero.');
    out.push('');
    for (const [quien, n] of [...sinMapear.entries()].sort((a, b) => b[1] - a[1])) {
      out.push(`- \`${quien}\` — ${n} commits`);
    }
    out.push('');
  }

  const texto = out.join('\n');
  process.stdout.write(texto + '\n');

  if (escribir) {
    const dir = L.dirPersonas(base);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ruta = path.join(dir, '_bus-factor.md');
    fs.writeFileSync(ruta, texto + '\n', 'utf8');
    process.stderr.write(`\nEscrito: ${ruta}\n`);
    const cache = path.join(dir, '_cache');
    if (!fs.existsSync(cache)) fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(path.join(cache, `doa-${hoy}.json`),
      JSON.stringify(resultados.map((r) => ({
        repo: r.repo, totalArchivos: r.totalArchivos, totalCommits: r.totalCommits,
        busFactor: r.busFactor,
        personas: [...r.porPersona.entries()].map(([slug, p]) => ({
          slug, experto: p.experto, archivos: p.archivos, carpetas: [...p.carpetas.entries()],
        })),
      })), null, 2), 'utf8');
  }
}

function nombrePersona(slug) {
  if (slug.startsWith('??:')) return `**${slug.slice(3)}** (sin mapear)`;
  const p = identidades.find((i) => i.slug === slug);
  return p ? p.nombre : slug;
}

function fallar(msg) { process.stderr.write(msg + '\n'); process.exit(1); }
