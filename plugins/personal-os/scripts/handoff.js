#!/usr/bin/env node
/*
 * Personal OS — índice de frentes del handoff (modo multi-frente).
 *
 * Una raíz multi-frente es una carpeta donde varias pestañas de Claude Code trabajan temas distintos
 * a la vez (tu carpeta de estado, tu home, un monorepo…). Ahí:
 *   · cada frente vive en `handoff/<slug>.md` (lo escribe la skill checkpoint);
 *   · la fuente del índice es `handoff/_indice.json`;
 *   · `HANDOFF.md` de la raíz es SOLO el índice y se regenera desde el JSON bajo un candado
 *     (`handoff/.lock`) con escritura atómica, para que dos checkpoints simultáneos no se pisen.
 * Si alguien edita `HANDOFF.md` a mano, el cambio no se pierde: se guarda en `handoff/_entrada/`
 * antes de regenerar y se avisa.
 *
 * La raíz se pasa con --root <ruta>; si no se pasa, es el directorio actual.
 *
 * Uso:
 *   node handoff.js init   [--root R]                     # convierte la raíz en multi-frente
 *   node handoff.js list   [--root R] [--json] [--todos]
 *   node handoff.js match  [--root R] "<texto con claves de issue o temas>"
 *   node handoff.js set    [--root R] --slug S [--titulo T] [--ambito laboral|personal|<otro>]
 *                          [--etiquetas "A,B"] [--estado E] [--siguiente X]
 *                          [--cerrado [AAAA-MM-DD] | --abierto]
 *   node handoff.js render [--root R]
 *
 * Código de salida: 0 ok · 2 uso incorrecto · 1 error de E/S (candado, JSON corrupto…).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// La hora sale de la zona configurada del Personal OS si existe; si no, la del sistema.
let comun = null;
try { comun = require('./lib/comun.js'); } catch (_) { comun = null; }

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; }
    } else o._.push(a);
  }
  return o;
}

const A = args(process.argv.slice(2));
const cmd = A._[0];
const ROOT = path.resolve(typeof A.root === 'string' ? A.root : process.cwd());
const DIR = path.join(ROOT, 'handoff');
const IDX = path.join(DIR, '_indice.json');
const MD = path.join(ROOT, 'HANDOFF.md');
const LOCK = path.join(DIR, '.lock');
const AMBITOS_BASE = ['laboral', 'personal'];

function ahora() {
  if (comun && typeof comun.ahora === 'function') {
    try { const a = comun.ahora(); return `${a.ymd} ${a.hm}`; } catch (_) { /* cae al sistema */ }
  }
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

// Lanza en vez de process.exit: así el `finally` del candado siempre lo libera.
class ErrorUso extends Error {}
function fallar(msg) { throw new ErrorUso(msg); }

function writeAtomic(f, txt) {
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, txt, 'utf8');
  fs.renameSync(tmp, f);
}

function dormir(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function conCandado(fn) {
  fs.mkdirSync(DIR, { recursive: true });
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(LOCK); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Un candado de más de 30 s es de un proceso que murió: se libera.
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 30000) { fs.rmdirSync(LOCK); continue; } } catch (_) {}
      if (Date.now() - t0 > 15000) throw new Error('No se obtuvo el candado de handoff/.lock en 15 s');
      dormir(150);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(LOCK); } catch (_) {} }
}

function leer() {
  if (!fs.existsSync(IDX)) return { frentes: [], md_sha: null };
  let t = fs.readFileSync(IDX, 'utf8');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const ix = JSON.parse(t);
  if (!Array.isArray(ix.frentes)) ix.frentes = [];
  return ix;
}

const esc = s => String(s || '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function fila(f) {
  return `| [${esc(f.titulo)}](handoff/${f.slug}.md) | ${esc(f.actualizado)} | ${esc(f.estado)} | ${esc(f.siguiente)} |`;
}

function ambitos(ix) {
  const otros = [...new Set(ix.frentes.map(f => f.ambito).filter(a => a && !AMBITOS_BASE.includes(a)))].sort();
  return [...AMBITOS_BASE, ...otros];
}

const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

function render(ix) {
  const orden = (a, b) => String(b.actualizado).localeCompare(String(a.actualizado));
  const abiertos = amb => ix.frentes.filter(f => !f.cerrado && f.ambito === amb).sort(orden);
  const cab = '| Frente | Actualizado | Estado | Siguiente paso |\n|---|---|---|---|';
  const sec = (t, l) => `## ${t}\n${l.length ? cab + '\n' + l.map(fila).join('\n') : '_(ninguno)_'}\n`;
  const cerrados = ix.frentes.filter(f => f.cerrado).sort((a, b) => String(b.cerrado).localeCompare(String(a.cerrado)));
  return [
    '# HANDOFF — índice de frentes',
    '> Lo regenera `handoff.js` en cada checkpoint; **no se edita a mano** (se perdería). Cada frente vive en `handoff/<slug>.md`.',
    `> Retomar muestra este índice, pregunta de qué se va a hablar y solo entonces lee el frente. Actualizado: ${ahora()}`,
    '',
    ...ambitos(ix).map(a => sec(capital(a), abiertos(a))),
    '## Cerrados',
    cerrados.length ? '| Frente | Cerrado | Último estado |\n|---|---|---|\n' +
      cerrados.map(f => `| [${esc(f.titulo)}](handoff/${f.slug}.md) | ${esc(f.cerrado)} | ${esc(f.estado)} |`).join('\n') : '_(ninguno)_',
    ''
  ].join('\n');
}

// Si alguien editó HANDOFF.md a mano (o una pestaña con una skill vieja), se guarda antes de regenerar.
function guardarAjeno(ix) {
  if (!fs.existsSync(MD)) return null;
  const actual = fs.readFileSync(MD, 'utf8');
  if (!ix.md_sha || sha(actual) === ix.md_sha) return null;
  const dest = path.join(DIR, '_entrada');
  fs.mkdirSync(dest, { recursive: true });
  const f = path.join(dest, `HANDOFF-ajeno-${ahora().replace(/[: ]/g, '-')}.md`);
  fs.writeFileSync(f, actual, 'utf8');
  return f;
}

function regenerar(ix) {
  const ajeno = guardarAjeno(ix);
  const md = render(ix);
  ix.md_sha = sha(md);
  writeAtomic(IDX, JSON.stringify(ix, null, 2) + '\n');
  writeAtomic(MD, md);
  if (ajeno) console.log(`AVISO: HANDOFF.md tenía cambios hechos fuera del índice; se guardaron en ${ajeno}. Pásalos a su frente.`);
}

function lista(ix, todos) {
  const vis = ix.frentes.filter(f => todos || !f.cerrado);
  for (const amb of ambitos(ix)) {
    const l = vis.filter(f => f.ambito === amb).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
    if (!l.length) continue;
    console.log(`\n${amb.toUpperCase()}`);
    for (const f of l) {
      console.log(`- ${f.slug} · ${f.titulo} · ${f.actualizado}${f.cerrado ? ' · CERRADO ' + f.cerrado : ''}` +
        `\n    siguiente: ${f.siguiente || '—'}\n    etiquetas: ${(f.etiquetas || []).join(', ')}`);
    }
  }
}

function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,79}$/;

function main() {
  if (cmd === 'init') {
    conCandado(() => {
      const existia = fs.existsSync(IDX);
      const ix = leer();
      regenerar(ix);
      console.log(existia ? `ok · ya era multi-frente: ${ROOT}` : `ok · raíz multi-frente creada: ${ROOT}`);
    });
  } else if (cmd === 'list') {
    const ix = leer();
    if (A.json) console.log(JSON.stringify(ix.frentes.filter(f => A.todos || !f.cerrado), null, 2));
    else if (!ix.frentes.length) console.log('(sin frentes: no hay handoff/_indice.json o está vacío)');
    else lista(ix, A.todos);
  } else if (cmd === 'match') {
    const ix = leer();
    const txt = norm(A._.slice(1).join(' '));
    const res = ix.frentes.map(f => {
      const hits = [f.slug, f.titulo, ...(f.etiquetas || [])].filter(e => e && txt.includes(norm(e)));
      return { slug: f.slug, titulo: f.titulo, cerrado: f.cerrado || null, puntaje: hits.length, coincide: hits };
    }).filter(r => r.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje);
    console.log(JSON.stringify(res, null, 2));
  } else if (cmd === 'set') {
    if (!A.slug || A.slug === true) fallar('Falta --slug');
    if (!SLUG_OK.test(A.slug)) fallar('--slug debe ser kebab-case: minúsculas, números y guiones (máx. 80)');
    conCandado(() => {
      const ix = leer();
      let f = ix.frentes.find(x => x.slug === A.slug);
      if (!f) {
        if (!A.titulo || A.titulo === true || !A.ambito || A.ambito === true) fallar('Frente nuevo: requiere --titulo y --ambito');
        f = { slug: A.slug, etiquetas: [] };
        ix.frentes.push(f);
      }
      if (typeof A.titulo === 'string') f.titulo = A.titulo;
      if (typeof A.ambito === 'string') {
        const amb = norm(A.ambito).trim();
        if (!/^[a-z0-9-]{1,30}$/.test(amb)) fallar('--ambito: una palabra (laboral, personal u otra propia)');
        f.ambito = amb;
      }
      if (typeof A.etiquetas === 'string') {
        f.etiquetas = [...new Set([...(f.etiquetas || []), ...A.etiquetas.split(',').map(s => s.trim()).filter(Boolean)])];
      }
      if (typeof A.estado === 'string') f.estado = A.estado;
      if (typeof A.siguiente === 'string') f.siguiente = A.siguiente;
      if (A.cerrado) f.cerrado = A.cerrado === true ? ahora().slice(0, 10) : A.cerrado;
      if (A.abierto) delete f.cerrado;
      f.actualizado = ahora();
      if (!fs.existsSync(path.join(DIR, `${f.slug}.md`))) console.log(`AVISO: no existe handoff/${f.slug}.md; créalo.`);
      regenerar(ix);
      console.log(`ok · ${f.slug} · ${f.actualizado}`);
    });
  } else if (cmd === 'render') {
    conCandado(() => { regenerar(leer()); console.log('ok'); });
  } else {
    fallar('Comandos: init | list | match | set | render (ver la cabecera del archivo)');
  }
}

try { main(); } catch (e) {
  if (e instanceof ErrorUso) { console.error(e.message); process.exit(2); }
  console.error(`handoff.js: ${e && e.message ? e.message : e}`);
  process.exit(1);
}
