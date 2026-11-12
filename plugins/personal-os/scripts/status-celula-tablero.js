#!/usr/bin/env node
'use strict';
/*
 * Construye el tablero de planeación de la célula (la página que se publica como Artifact) a partir de:
 *   - la plantilla   skills/status-celula/tablero/plantilla.html  (diseño, vistas e interacción: no se edita a mano por célula)
 *   - la célula      --config <json>         personas, Jira, festivos, jornada, SLA, clientes, textos
 *   - la empresa     --organizacion <json>   nombre, pie y logo (perfil de organización)
 *   - el inventario  --inventario <json>     lista de pendientes que arranca el Gantt ([] si no hay)
 *
 *   node status-celula-tablero.js --config celula.json --organizacion org.json --inventario inv.json --salida tablero.html
 *
 * Valida lo mínimo que la página necesita para arrancar y sale con 1 (sin escribir) si falta algo.
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const PLANTILLA = arg('plantilla', path.join(__dirname, '..', 'skills', 'status-celula', 'tablero', 'plantilla.html'));
const leerJson = (r, nombre) => {
  if (!r) { console.error(`Falta --${nombre}`); process.exit(1); }
  let t = fs.readFileSync(r, 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  try { return JSON.parse(t); } catch (e) { console.error(`--${nombre} no es JSON válido (${r}): ${e.message}`); process.exit(1); }
};

const cfg = leerJson(arg('config'), 'config');
const org = leerJson(arg('organizacion'), 'organizacion');
const inv = arg('inventario') ? leerJson(arg('inventario'), 'inventario') : [];
const salida = arg('salida');
if (!salida) { console.error('Falta --salida'); process.exit(1); }

// ---- validación: lo que la plantilla lee sin respaldo
const faltan = [];
const req = (cond, msg) => { if (!cond) faltan.push(msg); };
req(cfg.pagina && cfg.pagina.titulo, 'pagina.titulo');
req(Array.isArray(cfg.lanes) && cfg.lanes.length, 'lanes[] (al menos una persona)');
(cfg.lanes || []).forEach((l, i) => req(l.id && l.nm, `lanes[${i}].id y .nm`));
req(new Set((cfg.lanes || []).map(l => l.id)).size === (cfg.lanes || []).length, 'lanes[].id sin repetir');
req(cfg.nombres && cfg.nombres.lider, 'nombres.lider');
req(cfg.jira && cfg.jira.cloud && cfg.jira.servidor_mcp, 'jira.cloud y jira.servidor_mcp');
req(cfg.jira && Array.isArray(cfg.jira.proyectos_cliente) && cfg.jira.proyectos_cliente.length, 'jira.proyectos_cliente[]');
req(cfg.jira && Array.isArray(cfg.jira.proyectos_crear) && cfg.jira.proyectos_crear.length, 'jira.proyectos_crear[]');
req(cfg.m365 && cfg.m365.servidor_mcp, 'm365.servidor_mcp');
req(cfg.jornada && ['normal', 'viernes', 'efectiva_normal', 'efectiva_viernes', 'horas_por_dia_estimadas'].every(k => typeof cfg.jornada[k] === 'number'), 'jornada.{normal, viernes, efectiva_normal, efectiva_viernes, horas_por_dia_estimadas}');
req(cfg.sla && ['revisar', 'certificar', 'publicar'].every(k => typeof cfg.sla[k] === 'number'), 'sla.{revisar, certificar, publicar}');
req(cfg.ia && cfg.ia.contexto, 'ia.contexto');
req(org.nombre && org.pie && org.logo && org.logo.src, 'organizacion: nombre, pie, logo.src');
req(Array.isArray(inv), 'inventario: debe ser una lista');
if (faltan.length) { console.error('Configuración incompleta, falta:\n  - ' + faltan.join('\n  - ')); process.exit(1); }

// la organización alimenta también lo que la página nombra en sus textos
cfg.org = Object.assign({}, cfg.org, { nombre: (cfg.org && cfg.org.nombre) || org.nombre });

// ---- ensamblado
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enScript = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
let html = fs.readFileSync(PLANTILLA, 'utf8');
const marcas = {
  __TITULO__: escHtml(cfg.pagina.titulo),
  __SUBTITULO__: escHtml(cfg.pagina.subtitulo || ''),
  __PIE_ORG__: escHtml(org.pie),
  __PIE_USO__: escHtml(cfg.pagina.pie_uso || ''),
  __ORG_LOGO_ALT__: escHtml(org.logo.alt || org.nombre),
  __ORG_LOGO_ANCHO__: String(org.logo.ancho || 120),
  __ORG_LOGO_ALTO__: String(org.logo.alto || 28),
  __ORG_LOGO_SRC__: escHtml(org.logo.src),
  __CONFIG__: enScript(JSON.stringify(cfg)),
  __INVENTARIO__: enScript(JSON.stringify(inv)),
};
for (const [m, v] of Object.entries(marcas)) {
  if (!html.includes(m)) { console.error(`La plantilla no trae la marca ${m}: ¿plantilla equivocada?`); process.exit(1); }
  html = html.split(m).join(v);
}
const resto = html.match(/__[A-Z_]{4,}__/g);
if (resto) { console.error('Quedaron marcas sin reemplazar: ' + [...new Set(resto)].join(', ')); process.exit(1); }

fs.writeFileSync(salida, html, 'utf8');
console.log(`OK ${salida} · ${Buffer.byteLength(html)} bytes · ${cfg.lanes.length} carriles · ${inv.length} pendientes`);
