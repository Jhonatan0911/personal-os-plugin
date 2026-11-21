#!/usr/bin/env node
/*
 * Personal OS — conocimiento-build.js: genera la CORTEZA (saber común) para Claude Code.
 *
 * El cerebro separa por contexto el control (qué reglas y alarmas aplican) pero no el saber: lo
 * abstraído es compartido. Aquí el saber técnico propio del usuario vive como notas atómicas CO-###
 * (título = la afirmación; porqué; caso de origen abstraído; procedencia) y este script las convierte
 * en reglas de Claude Code que se cargan por tipo de archivo en CUALQUIER proyecto, laboral o personal.
 *
 * Configuración (config.json → "conocimiento"):
 *   "conocimiento": {
 *     "dir": "/ruta/a/conocimiento",              // carpeta de las notas CO-*.md (fuente única)
 *     "salida": "~/.claude/rules/conocimiento",   // reglas generadas (no editar a mano)
 *     "terminosProhibidos": ["Cliente X", "srv-prod"]  // integridad contextual: nada de esto cruza
 *   }
 * Frontmatter de cada nota: id, titulo, tema, aplica_a (globs; [] = método general → índice),
 *   nivel (duro|criterio), procedencia, fuentes, estado (propuesta|vigente|archivada), creado.
 *
 *   node conocimiento-build.js            # genera (solo notas `vigente`)
 *   node conocimiento-build.js --check    # valida todo (también las propuestas) y no escribe
 *   node conocimiento-build.js --dir <carpeta> --check   # validar un borrador fuera de la corteza
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const C = require('./lib/comun.js');

const CHECK = process.argv.includes('--check');
const cfg = C.config().conocimiento || {};
const expandir = (p) => path.resolve(String(p || '').replace(/^~(?=$|[\\/])/, os.homedir()));
const DIR = expandir(C.arg('--dir', null) || cfg.dir || '');
const SALIDA = expandir(cfg.salida || '~/.claude/rules/conocimiento');
const PROHIBIDOS = (cfg.terminosProhibidos || []).map((t) => C.sinTildes(t)).filter(Boolean);
const AVISO = '<!-- GENERADO por conocimiento-build.js desde las notas CO-### de la corteza. No editar a mano: editar la nota y regenerar. -->';
const TEMAS = ['arquitectura', 'backend', 'frontend', 'bd', 'pruebas', 'seguridad', 'git', 'entorno', 'metodo'];

if (!cfg.dir && !C.arg('--dir', null)) { console.error('Falta config.json → conocimiento.dir'); process.exit(1); }
if (!fs.existsSync(DIR)) { console.error(`No existe la carpeta de conocimiento: ${DIR}`); process.exit(1); }

/** Frontmatter simple: `clave: valor`, listas en línea ["a","b"] y comillas. Sin anidación. */
function leerNota(ruta) {
  const texto = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { ruta, fm: {}, cuerpo: texto, texto };
  const fm = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const k = linea.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*(#.*)?$/);
    if (!k) continue;
    let v = k[2];
    if (/^\[.*\]$/.test(v)) {
      try { v = JSON.parse(v.replace(/'/g, '"')); } catch (_) { v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean); }
    } else v = v.replace(/^["']|["']$/g, '');
    fm[k[1]] = v;
  }
  return { ruta, fm, cuerpo: m[2].trim(), texto };
}

/** Primer párrafo de «**Regla.**» como texto de una línea. */
function regla(cuerpo) {
  const m = cuerpo.match(/\*\*Regla\.\*\*\s*([\s\S]*?)(\n\s*\n|$)/);
  return (m ? m[1] : cuerpo.split(/\n\s*\n/)[0]).replace(/\s+/g, ' ').trim();
}

const notas = fs.readdirSync(DIR).filter((n) => /^CO-\d+.*\.md$/i.test(n)).sort()
  .map((n) => leerNota(path.join(DIR, n)));

const errores = [];
const ids = new Set();
for (const n of notas) {
  const f = n.fm; const nom = path.basename(n.ruta);
  if (!f.id || !/^CO-\d{3,}$/.test(f.id)) errores.push(`${nom}: id inválido o ausente`);
  else if (ids.has(f.id)) errores.push(`${nom}: id repetido ${f.id}`); else ids.add(f.id);
  if (!f.titulo) errores.push(`${nom}: falta titulo`);
  if (!TEMAS.includes(f.tema)) errores.push(`${nom}: tema «${f.tema}» no es uno de ${TEMAS.join('|')}`);
  if (!Array.isArray(f.aplica_a)) errores.push(`${nom}: aplica_a debe ser una lista (use [] para método general)`);
  if (!['duro', 'criterio'].includes(f.nivel)) errores.push(`${nom}: nivel debe ser duro|criterio`);
  if (!['propuesta', 'vigente', 'archivada'].includes(f.estado)) errores.push(`${nom}: estado debe ser propuesta|vigente|archivada`);
  if (!/\*\*Regla\.\*\*/.test(n.cuerpo)) errores.push(`${nom}: falta el párrafo **Regla.**`);
  if (!/\*\*Por qu[eé]\.\*\*/.test(n.cuerpo)) errores.push(`${nom}: falta el párrafo **Por qué.** (casos con su porqué, no reglas desnudas)`);
  const plano = C.sinTildes(n.texto);
  for (const t of PROHIBIDOS) if (plano.includes(t)) errores.push(`${nom}: contiene un término confidencial («${t}»): abstraerlo antes de que cruce de contexto`);
}

if (errores.length) {
  console.error(`La corteza tiene ${errores.length} problema(s); no se genera nada:`);
  for (const e of errores) console.error('  - ' + e);
  process.exit(1);
}
const vigentes = notas.filter((n) => n.fm.estado === 'vigente');
if (CHECK) {
  console.log(`Corteza válida: ${notas.length} nota(s) · vigentes ${vigentes.length} · propuestas ${notas.filter((n) => n.fm.estado === 'propuesta').length}.`);
  process.exit(0);
}

// Agrupar por tema + conjunto de globs: cada grupo es un archivo de reglas con su `paths`.
const linea = (n) => `- **${n.fm.id} · ${n.fm.titulo}**${n.fm.nivel === 'criterio' ? ' _(criterio)_' : ''} ${regla(n.cuerpo)} → \`${n.ruta.replace(/\\/g, '/')}\``;
const grupos = new Map();
const generales = [];
for (const n of vigentes) {
  const globs = [...new Set(n.fm.aplica_a)].sort();
  if (!globs.length) { generales.push(n); continue; }
  const clave = `${n.fm.tema}|${globs.join(',')}`;
  if (!grupos.has(clave)) grupos.set(clave, { tema: n.fm.tema, globs, notas: [] });
  grupos.get(clave).notas.push(n);
}

const salidas = new Map();
const cabecera = '# Conocimiento común (corteza)\n\nSaber técnico propio del usuario: aplica igual en proyectos de la empresa y personales. '
  + 'Cada línea cita su nota (porqué, caso de origen, cuándo no aplica): leerla antes de desviarse. '
  + '_(criterio)_ = consideración que se pondera, no orden. Cuando una de estas guíe una decisión, citar su id.\n\n'
  + '**Su criterio primero en arquitectura:** antes de proponer un diseño técnico (capas, estructura, integración, '
  + 'modelo de datos), preguntarle al usuario qué haría él y luego contrastar; en lo operativo, proponer directo.\n';
salidas.set('00-indice.md', `${AVISO}\n\n${cabecera}\n`
  + (generales.length ? '## Método (siempre)\n\n' + generales.map(linea).join('\n') + '\n\n' : '')
  + `Notas por tipo de archivo: ${vigentes.length - generales.length} (se cargan al tocar esos archivos). Fuente: \`${DIR.replace(/\\/g, '/')}\`.\n`);
const contador = {};
for (const g of grupos.values()) {
  contador[g.tema] = (contador[g.tema] || 0) + 1;
  const nombre = `${g.tema}${contador[g.tema] > 1 ? '-' + contador[g.tema] : ''}.md`;
  salidas.set(nombre, `---\npaths:\n${g.globs.map((x) => `  - "${x}"`).join('\n')}\n---\n${AVISO}\n\n# Conocimiento común · ${g.tema}\n\n`
    + 'Saber propio, aplica en cualquier proyecto (las reglas de la empresa, si las hay, se suman encima).\n\n'
    + g.notas.map(linea).join('\n') + '\n');
}

fs.mkdirSync(SALIDA, { recursive: true });
for (const [nombre, contenido] of salidas) {
  const p = path.join(SALIDA, nombre);
  const previo = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (previo !== contenido) fs.writeFileSync(p, contenido, 'utf8');
  console.log(`  [${previo === null ? 'nuevo' : previo === contenido ? 'igual' : 'cambia'}] ${p}`);
}
for (const viejo of fs.readdirSync(SALIDA)) {
  const p = path.join(SALIDA, viejo);
  if (!salidas.has(viejo) && viejo.endsWith('.md') && fs.readFileSync(p, 'utf8').includes('GENERADO por conocimiento-build.js')) {
    fs.unlinkSync(p); console.log(`  [sobra] ${p} → borrado`);
  }
}
console.log(`Corteza: ${vigentes.length} nota(s) vigentes · ${generales.length} de método · ${grupos.size} archivo(s) por tipo.`);
