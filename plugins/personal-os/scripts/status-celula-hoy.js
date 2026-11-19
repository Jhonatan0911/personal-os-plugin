#!/usr/bin/env node
'use strict';
/*
 * Personal OS — status de la célula: qué hace HOY cada persona, agrupado por su global, para ponerle a cada grupo un
 * título corto («Correcciones doble RIPS», «Validador de derechos») que la página muestra en «Ocupación de hoy».
 *
 *   node status-celula-hoy.js --datos <datos.json> --inventario <inventario.json> [--hoy AAAA-MM-DD] [--json]
 *
 * Global = el ancestro más alto de la tarea (macro; si no hay, la historia; si no tiene padre, la propia tarea), con los
 * padres de datos.jira.issues + datos.jira.padres. Entra lo que el inventario pone a trabajar hoy: abierto, fuera de las
 * colas, con inicio ≤ hoy ≤ vencimiento, o vencido y abierto (se suma a hoy). Las reuniones no entran.
 *
 * Imprime, por persona y global, las tareas de hoy, para que quien corre la skill escriba el título corto en
 * datos.jira.cortos = { "<carril>|<CLAVE-GLOBAL>": "título", "<CLAVE-GLOBAL>": "título genérico" } (2 a 4 palabras, lo
 * que hace hoy, sin el nombre del cliente ni del macro). status-celula-compartido.js lo sube a jira/cortos.
 * Con --json imprime la misma lista en JSON (con el título que ya tenga en datos.jira.cortos).
 * No consulta nada ni escribe archivos.
 */
const fs = require('fs');

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const rutaDatos = arg('--datos'), rutaInv = arg('--inventario');
if (!rutaDatos || !rutaInv) { console.error('Uso: --datos <datos.json> --inventario <inventario.json> [--hoy AAAA-MM-DD] [--json]'); process.exit(2); }
const hoy = arg('--hoy', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
const d = JSON.parse(fs.readFileSync(rutaDatos, 'utf8'));
const inv = JSON.parse(fs.readFileSync(rutaInv, 'utf8')).filter(Boolean);

const nodo = {};
for (const i of (d.jira && d.jira.issues) || []) { const k = i.clave || i.key; if (k) nodo[k] = { t: i.titulo || '', it: i.tipo || '', pa: i.padre || null }; }
const extra = (d.jira && d.jira.padres) || {};
(Array.isArray(extra) ? extra : Object.entries(extra).map(([clave, v]) => Object.assign({ clave }, v))).forEach((p) => {
  if (p && p.clave && !nodo[p.clave]) nodo[p.clave] = { t: p.titulo || '', it: p.tipo || '', pa: p.padre || null }; });
const cortos = (d.jira && d.jira.cortos) || {};

function globalDe(k) { let g = k, n = 0; while (nodo[g] && nodo[g].pa && n < 8) { g = nodo[g].pa; n++; } return g; }
const esReunion = (it) => /^reuni/i.test((nodo[it.key] || {}).it || '') || /^\s*(daily|reuni[oó]n)\b/i.test(it.titulo || '');

const grupos = {};
for (const it of inv) {
  if (!it.lane || it.grupo === 'colas' || it.cola || it.cerrada || esReunion(it)) continue;
  const ini = it.inicio || it.fin, fin = it.fin || it.inicio;
  const vencida = fin && fin < hoy, enCurso = ini && fin && ini <= hoy && hoy <= fin;
  if (!vencida && !enCurso) continue;
  const g = String(it.key).startsWith('L-') ? it.key : globalDe(it.key);
  const id = it.lane + '|' + g;
  const x = grupos[id] = grupos[id] || { carril: it.lane, global: g, nombre_global: (nodo[g] || {}).t || it.titulo || g, titulo: cortos[id] || cortos[g] || '', tareas: [] };
  x.tareas.push({ clave: it.key, titulo: it.titulo || '', historia: (nodo[(nodo[it.key] || {}).pa] || {}).t || '', vencida: !!vencida });
}
const lista = Object.values(grupos).sort((a, b) => a.carril.localeCompare(b.carril) || b.tareas.length - a.tareas.length);
if (process.argv.includes('--json')) { console.log(JSON.stringify(lista, null, 2)); process.exit(0); }
console.log(`Qué hace hoy (${hoy}) cada persona, por global. Escribe el título corto en datos.jira.cortos["<carril>|<global>"].`);
for (const x of lista) {
  console.log(`\n${x.carril}|${x.global} · ${x.nombre_global}${x.titulo ? `  → «${x.titulo}»` : ''} · ${x.tareas.length} tarea(s)`);
  const hist = {}; x.tareas.forEach((t) => { hist[t.historia || '—'] = (hist[t.historia || '—'] || 0) + 1; });
  Object.entries(hist).slice(0, 4).forEach(([h, n]) => console.log(`   historia: ${h.slice(0, 80)} (${n})`));
  x.tareas.slice(0, 5).forEach((t) => console.log(`   - ${t.clave} ${t.titulo.slice(0, 90)}${t.vencida ? ' (vencida)' : ''}`));
  if (x.tareas.length > 5) console.log(`   … y ${x.tareas.length - 5} más`);
}
