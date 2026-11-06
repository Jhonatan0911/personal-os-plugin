#!/usr/bin/env node
/*
 * Personal OS — búsqueda en TODAS las fuentes.
 *
 * Por qué existe: una vez se afirmó que un acuerdo de equipo "no decía nada" de un tema porque se
 * buscó en una sola carpeta; la regla estaba en otra. Afirmar que algo NO está escrito exige haber
 * barrido todas las fuentes; este script es esa barrida, y el hook verificar-ausencia.js comprueba
 * que se usó antes de afirmar una ausencia.
 *
 * Fuentes que barre:
 *   · el estado del usuario (stateDir), recursivo;
 *   · el núcleo y las skills del plugin;
 *   · ~/.claude/personal-os (config, notas sueltas);
 *   · las instrucciones globales (~/.claude/*.md) y la memoria persistente (~/.claude/projects/<x>/memory);
 *   · las carpetas extra declaradas en config.json → busqueda.fuentes (texto) y busqueda.binarios
 *     (PDF/Office: solo se compara el NOMBRE del archivo).
 *
 * Uso:  node os-buscar.js <término> [<término> ...] [--regex] [--todo]
 *   Los términos se buscan sin distinguir mayúsculas ni tildes (OR entre términos).
 *   --regex  trata cada término como expresión regular.
 *   --todo   no recorta resultados por archivo.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const C = require('./lib/comun.js');

const HOME = os.homedir();
const CLAUDE = path.join(HOME, '.claude');
const TXT = ['.md', '.yaml', '.yml', '.json', '.txt'];

// Fuentes de texto: [etiqueta, ruta, recursivo, extensiones]
const TEXTO = [];
const estado = C.stateDir();
if (estado) TEXTO.push(['estado (fuente de verdad)', estado, true, TXT]);
TEXTO.push(['núcleo del plugin (CORE, preámbulo)', C.PLUGIN_ROOT, false, ['.md']]);
TEXTO.push(['skills del plugin', path.join(C.PLUGIN_ROOT, 'skills'), true, ['.md']]);
TEXTO.push(['configuración del OS', C.OS_HOME, false, ['.md', '.json']]);
TEXTO.push(['instrucciones globales', CLAUDE, false, ['.md']]);
try {
  for (const p of fs.readdirSync(path.join(CLAUDE, 'projects'))) {
    const mem = path.join(CLAUDE, 'projects', p, 'memory');
    let n = 0;
    try { n = fs.readdirSync(mem).filter((f) => f.endsWith('.md')).length; } catch (e) { /* no existe */ }
    if (n) TEXTO.push([`memoria persistente (${p.length > 48 ? '…' + p.slice(-47) : p})`, mem, false, ['.md']]);
  }
} catch (e) { /* sin memoria persistente */ }

const busq = C.config().busqueda || {};
for (const f of Array.isArray(busq.fuentes) ? busq.fuentes : []) {
  if (f && f.ruta) TEXTO.push([f.etiqueta || f.ruta, f.ruta, f.recursivo !== false, Array.isArray(f.ext) && f.ext.length ? f.ext : TXT]);
}
// Fuentes binarias: solo se compara el NOMBRE del archivo (el contenido no se lee).
const BINARIOS = [];
for (const b of Array.isArray(busq.binarios) ? busq.binarios : []) {
  if (b && b.ruta) BINARIOS.push([b.etiqueta || b.ruta, b.ruta]);
}
const EXT_BIN = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.xls'];
const SALTAR = new Set(['node_modules', '.git', '_archivo', '.obsidian', '_datos']);

const args = process.argv.slice(2);
const usarRegex = args.includes('--regex');
const todo = args.includes('--todo');
const terminos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--estado' || args[i] === '--hoy') { i++; continue; }
  if (!args[i].startsWith('--')) terminos.push(args[i]);
}
if (!terminos.length) {
  console.log('Uso: node os-buscar.js <término> [<término> ...] [--regex] [--todo]');
  process.exit(1);
}

const plano = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const patrones = terminos.map((t) => usarRegex
  ? new RegExp(t, 'i')
  : new RegExp(plano(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
const coincide = (linea) => { const p = plano(linea); return patrones.some((r) => r.test(p)); };

function listar(dir, recursivo, filtro, acc = [], prof = 0) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursivo && !SALTAR.has(e.name) && prof < 6) listar(full, recursivo, filtro, acc, prof + 1);
    } else if (filtro(e.name)) acc.push(full);
  }
  return acc;
}

const MAX_POR_ARCHIVO = todo ? Infinity : 3;
const barridas = [];
const vistos = new Set();
let total = 0;

for (const [etiqueta, dir, rec, exts] of TEXTO) {
  if (!fs.existsSync(dir)) { barridas.push(`  ✗ ${etiqueta} — no existe la ruta`); continue; }
  const archivos = listar(dir, rec, (n) => exts.includes(path.extname(n).toLowerCase()))
    .filter((f) => !vistos.has(f));
  archivos.forEach((f) => vistos.add(f));
  let hits = 0;
  const salida = [];
  for (const f of archivos) {
    let lineas;
    try { lineas = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch (e) { continue; }
    const enArchivo = [];
    lineas.forEach((l, i) => { if (coincide(l)) enArchivo.push(`    ${i + 1}: ${l.trim().slice(0, 180)}`); });
    if (enArchivo.length) {
      hits += enArchivo.length;
      salida.push(`  ${f.replace(/\\/g, '/')}  (${enArchivo.length})`);
      salida.push(...enArchivo.slice(0, MAX_POR_ARCHIVO));
      if (enArchivo.length > MAX_POR_ARCHIVO) salida.push(`    … ${enArchivo.length - MAX_POR_ARCHIVO} más (usa --todo)`);
    }
  }
  total += hits;
  barridas.push(`  ✓ ${etiqueta} — ${archivos.length} archivos, ${hits} coincidencias`);
  if (salida.length) { console.log(`\n## ${etiqueta}`); console.log(salida.join('\n')); }
}

for (const [etiqueta, dir] of BINARIOS) {
  if (!fs.existsSync(dir)) { barridas.push(`  ✗ ${etiqueta} — no existe la ruta`); continue; }
  const archivos = listar(dir, true, (n) => EXT_BIN.includes(path.extname(n).toLowerCase()));
  const hits = archivos.filter((f) => coincide(path.basename(f)));
  total += hits.length;
  barridas.push(`  ✓ ${etiqueta} — ${archivos.length} archivos (solo nombre), ${hits.length} coincidencias`);
  if (hits.length) {
    console.log(`\n## ${etiqueta} (coincide el nombre; el contenido NO se leyó)`);
    hits.slice(0, todo ? hits.length : 15).forEach((f) => console.log(`  ${f.replace(/\\/g, '/')}`));
  }
}

console.log(`\n---\nFuentes barridas para: ${terminos.join(' | ')}`);
console.log(barridas.join('\n'));
console.log('  ✗ NO barrido: contenido de PDF/Word/PowerPoint, correos, chats y Jira.');
if (!busq.fuentes || !busq.fuentes.length) {
  console.log('  (Puedes sumar carpetas de documentos en config.json → busqueda.fuentes / busqueda.binarios.)');
}
if (total === 0) {
  console.log('\n0 coincidencias. Se dice "no lo encontré en <fuentes barridas>", NUNCA "no existe" ni');
  console.log('"no está escrito". Antes de afirmarlo: probar sinónimos, y si el tema puede vivir en un');
  console.log('PDF, un correo o Jira, buscar ahí o preguntarle al usuario.');
}
process.exit(0);
