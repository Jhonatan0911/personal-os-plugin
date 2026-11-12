#!/usr/bin/env node
'use strict';
/*
 * Arma el inventario de pendientes con el que arranca el Gantt del tablero de planeación, a partir del
 * JSON de datos de status-celula (lo que se leyó de Jira en la corrida) y la configuración de la célula.
 *
 *   node status-celula-inventario.js --datos datos-AAAA-MM-DD.json --config celula.json [--extras extras.json] --salida inventario.json
 *
 * extras.json (opcional, lo mantiene el líder; nunca va en el plugin):
 *   { "comprometido": { "CLAVE-123": "por qué está prometido al cliente" },
 *     "manuales": [ { "key": "M-ALGO", "titulo": "...", "grupo": "cliente|bloqueado|priorizar",
 *                     "persona": "<id de carril>", "estado": "Sin issue", "fin": null, "nota": "...", "proyecto": "CLI" } ] }
 *
 * Reglas (las mismas del tablero): entra todo lo de las personas con carril y lo sin responsable de los
 * proyectos del cliente; lo prometido va a «Cliente»; lo que está en revisión, certificación o listo para
 * implementación va a sus colas; lo activo, a «Priorizar». Nada se descarta en silencio: al final se imprime
 * cuánto quedó fuera y por qué.
 */
const fs = require('fs');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const leer = (r, n) => { if (!r) { console.error('Falta --' + n); process.exit(1); } let t = fs.readFileSync(r, 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1); return JSON.parse(t); };
const datos = leer(arg('datos'), 'datos');
const cfg = leer(arg('config'), 'config');
const extras = arg('extras') && fs.existsSync(arg('extras')) ? leer(arg('extras'), 'extras') : {};
const salida = arg('salida');
if (!salida) { console.error('Falta --salida'); process.exit(1); }

const hoy = arg('hoy') || new Date().toISOString().slice(0, 10);
const J = cfg.jira || {};
const CLIENTE = new Set(J.proyectos_cliente || []);
const TRANS = J.proyecto_transversal || '';
const PERMITIDOS = new Set([...(J.proyectos_cliente || []), ...(J.proyectos_crear || []), ...(TRANS ? [TRANS] : [])]);
const FUERA = new Set(J.transversal_fuera || []);
const E = Object.assign({
  revisar: ['Listo para revisión', 'En revisión técnica'],
  certificar: ['Certificación PO (Analista)'],
  publicar: ['Listo para implementación'],
  activos: '^(sin iniciar|análisis|en desarrollo|nuevo requerimiento|listo para desarrollo|levantamiento|en estudio|pruebas internas|listo para demostraci|pausado)',
}, cfg.estados || {});
const COLA = {};
E.revisar.forEach(s => COLA[s.toLowerCase()] = 'revisar');
E.certificar.forEach(s => COLA[s.toLowerCase()] = 'certificar');
E.publicar.forEach(s => COLA[s.toLowerCase()] = 'publicar');
const ACTIVO = new RegExp(E.activos, 'i');
const LANE = {}; (cfg.lanes || []).forEach(l => { if (l.nombre_jira) LANE[l.nombre_jira] = l; });
const COMP = extras.comprometido || {};

const out = [], vistos = new Set(), fuera = {};
const sale = (motivo) => { fuera[motivo] = (fuera[motivo] || 0) + 1; };
const add = x => { if (vistos.has(x.key)) return; vistos.add(x.key); out.push(x); };

for (const m of (extras.manuales || [])) {
  const { persona, ...resto } = m;
  add(Object.assign({ estado: 'Sin issue', fin: null, est: null, nota: '' }, resto, { lane: persona || '', origen: 'manual' }));
}

const issues = ((datos.jira || {}).issues) || [];
for (const i of issues) {
  const key = i.clave || i.key;
  const proyecto = i.proyecto || String(key).split('-')[0];
  const l = LANE[i.persona];
  const sinResp = !i.persona && CLIENTE.has(proyecto);
  if (!l && !sinResp) { sale(i.persona ? 'persona sin carril' : 'sin responsable fuera de los proyectos del cliente'); continue; }
  if (!PERMITIDOS.has(proyecto)) { sale('proyecto fuera de la configuración'); continue; }
  if (FUERA.has(key)) { sale('transversal marcado fuera'); continue; }
  const estado = i.estado || '';
  const base = { key, titulo: i.titulo, lane: l ? l.id : '', estado, fin: i.fin || null, inicio: i.inicio || null,
    est: i.estimado || null, proyecto, url: i.url, origen: 'jira', prioridad_jira: i.prioridad };
  if (COMP[key]) { add(Object.assign(base, { grupo: 'cliente', nota: COMP[key] })); continue; }
  const cola = COLA[estado.toLowerCase()];
  if (cola) { add(Object.assign(base, { grupo: 'colas', cola })); continue; }
  if (l && l.solo_colas) { sale('carril que solo cuenta colas'); continue; }
  if (ACTIVO.test(estado)) { add(Object.assign(base, { grupo: 'priorizar', pausado: /^pausado/i.test(estado), sin_responsable: sinResp })); continue; }
  sale('estado cerrado o fuera del flujo (' + estado + ')');
}
for (const x of out) x.vencida = !!(x.fin && x.fin < hoy && x.grupo !== 'colas');

fs.writeFileSync(salida, JSON.stringify(out), 'utf8');
const por = {}; out.forEach(x => { const k = x.grupo + (x.cola ? ':' + x.cola : ''); por[k] = (por[k] || 0) + 1; });
console.log(`OK ${salida} · ${out.length} pendientes de ${issues.length} issues · ` + Object.entries(por).map(([k, v]) => `${k} ${v}`).join(', '));
if (Object.keys(fuera).length) console.log('Fuera del inventario: ' + Object.entries(fuera).map(([k, v]) => `${v} ${k}`).join(' · '));
