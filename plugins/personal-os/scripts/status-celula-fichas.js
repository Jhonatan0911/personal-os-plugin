#!/usr/bin/env node
'use strict';
/*
 * Personal OS — status de la célula: guarda en la ficha de cada persona (<stateDir>/personas/) qué hizo
 * cada día según su timesheet.
 *
 *   node status-celula-fichas.js <datos.json> [--dry-run] [--estado <carpeta>]
 *
 * Por qué en la ficha y no en la bitácora: la bitácora se rota, y `personas-query.js dia <persona> <fecha>`
 * lee las líneas fechadas de la ficha. Así «¿qué hacía X el día Y?» se responde con lo que la persona
 * misma reportó, dentro de un mes o de seis.
 *
 * Reglas:
 *   · Una línea por persona y día: `- **AAAA-MM-DD** — Timesheet dd/mm: N h, X % con issue. …`.
 *   · No duplica: si la ficha ya tiene la línea «Timesheet» de ese día, no la vuelve a escribir.
 *   · Escribe SOLO por personas-append.js, que aplica el guardarraíl de datos de personas: si una tarea lo
 *     dispara, esa línea no se escribe y se reporta. Nunca se fuerza.
 *   · Solo el hecho laboral: horas, % con issue, las actividades principales y las horas sin tarea.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('./lib/comun.js');
const L = require('./personas-lib.js');
const Legado = require('./lib/status-celula-legado.js');
const { construir } = require('./status-celula.js');

const APPEND = path.join(__dirname, 'personas-append.js');
const h = (x) => (Math.round(x * 100) / 100).toString().replace('.', ',');
const esEspera = (t) => /espera|sin asignaci|sin tarea/i.test(t || '');

function resumen(d) {
  const pct = d.horas ? Math.round(d.horas_jira / d.horas * 100) : 0;
  const acts = d.actividades || [];
  const espera = acts.filter((a) => esEspera(a.tarea)).reduce((s, a) => s + a.horas, 0);
  // Una entrada por issue (la tarea de más horas da el texto); lo sin issue va por tarea. Las ceremonias no.
  const agr = new Map();
  for (const a of acts) {
    if (esEspera(a.tarea) || /\bdaily\b/i.test(a.tarea || '')) continue;
    const k = a.jira || '·' + a.tarea;
    if (agr.has(k)) agr.get(k).horas += a.horas; else agr.set(k, Object.assign({}, a));
  }
  const principales = [...agr.values()].sort((a, b) => b.horas - a.horas).filter((a) => a.horas >= 0.5).slice(0, 4);
  const cuerpo = principales.map((a) => `${a.jira ? a.jira + ' ' : ''}${String(a.tarea || '').slice(0, 70).trim()} (${h(a.horas)} h)`).join('; ');
  let t = `Timesheet ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}: ${h(d.horas)} h, ${pct} % con issue.${cuerpo ? ' ' + cuerpo + '.' : ''}`;
  if (espera) t += ` Sin tarea asignada: ${h(espera)} h.`;
  return t;
}

function main() {
  const entrada = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== C.arg('--estado'));
  const dry = process.argv.includes('--dry-run');
  if (!entrada) { console.error('Uso: node status-celula-fichas.js <datos.json> [--dry-run] [--estado <carpeta>]'); process.exit(1); }
  let datos = C.leerJson(path.resolve(entrada), null);
  if (!datos) { console.error('No pude leer el JSON: ' + entrada); process.exit(1); }
  if (Legado.esLegado(datos)) datos = Legado.convertir(datos);
  if (!datos.timesheets) { console.log('El JSON no trae bloque timesheets: no hay nada que guardar.'); return; }
  const m = construir(datos).timesheets.metricas;
  const fichas = L.leerFichas();
  if (!fichas.length) { console.error('No encuentro fichas en <stateDir>/personas/ (¿stateDir configurado? usa --estado).'); process.exit(1); }

  let escritas = 0, ya = 0;
  const fallidas = [];
  for (const p of m.personas) {
    const r = L.resolverPersona(fichas, p.nombre) || L.resolverPersona(fichas, String(p.nombre).split(' ')[0]);
    if (!r || r.ambiguo) { fallidas.push([p.nombre, '-', r ? 'nombre ambiguo' : 'sin ficha']); continue; }
    const f = r.ficha;
    for (const d of p.dias) {
      if (!d.horas) continue;
      if (f.texto.includes(`**${d.fecha}** — Timesheet`)) { ya++; continue; }
      const env = p.envios.find((e) => (e.fecha_correo || '').slice(0, 10) >= d.fecha);
      const evid = env ? 'timesheet enviado el ' + String(env.fecha_correo).replace('T', ' ') : 'timesheet sin correo posterior';
      const args = [APPEND, f.slug, '--hecho', resumen(d), '--desde', d.fecha, '--fuente', 'mixto', '--evidencia', evid];
      const est = C.arg('--estado', null); if (est) args.push('--estado', est);
      if (dry) args.push('--dry-run');
      const res = spawnSync(process.execPath, args, { encoding: 'utf8' });
      if (res.status === 0) { escritas++; console.log(`  ${f.slug} ${d.fecha} ✓${dry ? ' (simulado)' : ''}`); }
      else fallidas.push([f.slug, d.fecha, String(res.stderr || res.stdout).trim().slice(0, 160)]);
    }
  }
  console.log(`escritas ${escritas} · ya estaban ${ya} · no escritas ${fallidas.length}`);
  fallidas.forEach((x) => console.log('  NO ESCRITA', x.join(' · ')));
}

if (require.main === module) main();
module.exports = { resumen };
