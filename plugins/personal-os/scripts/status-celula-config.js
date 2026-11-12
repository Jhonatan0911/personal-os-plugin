#!/usr/bin/env node
'use strict';
/*
 * Sincroniza la configuración del tablero entre la base del artifact (lo que el líder guarda en la pestaña
 * ⚙ Configuración) y los archivos locales con los que se arma la página. Se corre ANTES de regenerar.
 *
 *   1. Bajar la base:  ArtifactData list  collection "config"  out_dir <base>   (celula, organizacion)
 *                      ArtifactData list  collection "privado" out_dir <base>   (config_extras, config_motor)
 *   2. node status-celula-config.js --base <base> --celula celula.json --organizacion org.json \
 *        [--extras extras.json] [--motor motor.json] [--subir <carpeta>] [--aplicar]
 *
 * Por cada documento compara el contenido (sin _meta) con su archivo:
 *   igual       nada que hacer
 *   bajar       la base es más nueva que el archivo → se escribe el archivo (respaldo .antes-config-AAAAMMDD)
 *   subir       el archivo es más nuevo (lo editaron a mano después de guardar en la pestaña) → deja en
 *               --subir el JSON para escribirlo en la base con ArtifactData (set con if_version), porque la
 *               página usa lo de la base antes que lo que trae incrustado
 *   solo-local  la base no lo tiene: la página usa lo incrustado al regenerar; no hace falta subirlo
 * Sin --aplicar solo informa. Sale con 0 si pudo comparar todo y 1 si algo está roto (no escribe nada).
 */
const fs = require('fs');
const path = require('path');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const APLICAR = process.argv.includes('--aplicar');
const BASE = arg('base');
if (!BASE || !arg('celula') || !arg('organizacion')) {
  console.error('Uso: --base <carpeta de ArtifactData> --celula <json> --organizacion <json> [--extras <json>] [--motor <json>] [--subir <carpeta>] [--aplicar]');
  process.exit(1);
}
const leer = r => { let t = fs.readFileSync(r, 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1); return JSON.parse(t); };
// ArtifactData puede dejar el documento solo o envuelto con su versión: se aceptan las dos formas.
const desenvolver = o => (o && typeof o === 'object' && o.data && typeof o.data === 'object' && ('version' in o || 'id' in o)) ? o.data : o;
const sinMeta = o => { const c = JSON.parse(JSON.stringify(o || {})); delete c._meta; return c; };
// Igualdad de contenido sin depender del orden de las claves de los objetos (la base puede reordenarlas).
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object')
  ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
const igual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// Al bajar se respeta el orden de claves del archivo local cuando existe (para que el diff quede limpio).
function ordenarComo(nuevo, viejo) {
  if (Array.isArray(nuevo)) return nuevo.map((x, i) => ordenarComo(x, Array.isArray(viejo) ? viejo[i] : undefined));
  if (!nuevo || typeof nuevo !== 'object') return nuevo;
  const o = {}; const ref = (viejo && typeof viejo === 'object' && !Array.isArray(viejo)) ? Object.keys(viejo) : [];
  for (const k of ref) if (k in nuevo) o[k] = ordenarComo(nuevo[k], viejo[k]);
  for (const k of Object.keys(nuevo)) if (!(k in o)) o[k] = ordenarComo(nuevo[k], undefined);
  return o;
}

const DOCS = [
  { clave: 'celula', col: 'config', id: 'celula', archivo: arg('celula') },
  { clave: 'organizacion', col: 'config', id: 'organizacion', archivo: arg('organizacion') },
  { clave: 'extras', col: 'privado', id: 'config_extras', archivo: arg('extras') },
  { clave: 'motor', col: 'privado', id: 'config_motor', archivo: arg('motor') },
];
const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const plan = []; let roto = false;
for (const d of DOCS) {
  const enBase = path.join(BASE, d.col, d.id + '.json');
  let db = null, local = null, mtime = 0;
  try { if (fs.existsSync(enBase)) db = desenvolver(leer(enBase)); } catch (e) { console.error(`✗ ${d.col}/${d.id}: el documento bajado no es JSON (${e.message})`); roto = true; continue; }
  if (d.archivo && fs.existsSync(d.archivo)) {
    try { local = leer(d.archivo); mtime = fs.statSync(d.archivo).mtimeMs; } catch (e) { console.error(`✗ ${d.archivo}: no es JSON (${e.message})`); roto = true; continue; }
  }
  if (!db) { plan.push({ d, accion: local ? 'solo-local' : 'nada' }); continue; }
  if (!d.archivo) { console.error(`✗ La base trae ${d.col}/${d.id} pero no pasaste --${d.clave}: dime dónde guardarlo.`); roto = true; continue; }
  const t = Number((db._meta || {}).t) || 0;
  if (local && igual(sinMeta(db), local)) plan.push({ d, accion: 'igual' });
  else if (!local || t > mtime) plan.push({ d, accion: 'bajar', db, local, t });
  else plan.push({ d, accion: 'subir', local, mtime, t });
}
if (roto) { console.error('No se escribió nada: corrige lo de arriba y vuelve a correr.'); process.exit(1); }

const SUBIR = arg('subir');
const fecha = t => t ? new Date(t).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—';
for (const p of plan) {
  const { d } = p; const nom = `${d.col}/${d.id}`.padEnd(22);
  if (p.accion === 'nada') { console.log(`· ${nom} no está en la base ni en local (se usan los valores por defecto)`); continue; }
  if (p.accion === 'igual') { console.log(`= ${nom} igual a ${d.archivo}`); continue; }
  if (p.accion === 'solo-local') { console.log(`· ${nom} no está en la base: la página usa ${path.basename(d.archivo)}`); continue; }
  if (p.accion === 'bajar') {
    console.log(`↓ ${nom} guardada en la pestaña el ${fecha(p.t)} → ${d.archivo}`);
    if (APLICAR) {
      if (p.local) fs.copyFileSync(d.archivo, `${d.archivo}.antes-config-${hoy}`);
      fs.mkdirSync(path.dirname(d.archivo), { recursive: true });
      fs.writeFileSync(d.archivo, JSON.stringify(ordenarComo(sinMeta(p.db), p.local), null, 2) + '\n', 'utf8');
    }
    continue;
  }
  // subir: el archivo cambió después de lo guardado en la pestaña
  console.log(`↑ ${nom} ${path.basename(d.archivo)} (${fecha(p.mtime)}) es más nuevo que la base (${fecha(p.t)}): hay que subirlo`);
  if (APLICAR && SUBIR) {
    fs.mkdirSync(SUBIR, { recursive: true });
    const destino = path.join(SUBIR, `${d.col}__${d.id}.json`);
    fs.writeFileSync(destino, JSON.stringify(Object.assign({}, p.local, { _meta: { t: Math.round(p.mtime), por: 'claude-code' } }), null, 2) + '\n', 'utf8');
    console.log(`  → ${destino}  (ArtifactData set: collection "${d.col}", doc_id "${d.id}", file_path, if_version de la lectura)`);
  } else if (!SUBIR) console.log('  (pasa --subir <carpeta> para preparar el archivo)');
}
const n = a => plan.filter(p => p.accion === a).length;
console.log(`${APLICAR ? 'Aplicado' : 'Simulación'}: ${n('bajar')} para bajar · ${n('subir')} para subir · ${n('igual')} iguales${APLICAR ? '' : ' (corre con --aplicar para escribir)'}`);
