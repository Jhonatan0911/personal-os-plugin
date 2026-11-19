#!/usr/bin/env node
'use strict';
/*
 * Personal OS — status de la célula: qué hace HOY cada persona, agrupado por su global, para ponerle a cada grupo un
 * título que diga lo que hace hoy («Correcciones del doble RIPS», «Dashboard del validador de derechos»), que la
 * página muestra en «Ocupación de hoy». Guía completa y ejemplos: skills/status-celula/references/titulos-hoy.md.
 *
 *   node status-celula-hoy.js --datos <datos.json> --inventario <inventario.json> [--hoy AAAA-MM-DD] [--json | --validar]
 *
 * Global = el ancestro más alto de la tarea (macro; si no hay, la historia; si no tiene padre, la propia tarea), con los
 * padres de datos.jira.issues + datos.jira.padres. Entra lo que el inventario pone a trabajar hoy: abierto, fuera de las
 * colas, con inicio ≤ hoy ≤ vencimiento, o vencido y abierto (se suma a hoy). Las reuniones de Jira no entran.
 *
 * Sin opción: imprime, por persona y global, el contexto para escribir el título (macro, historias, tipos, tareas,
 * pista de reunión o seguimiento) en datos.jira.cortos = { "<carril>|<CLAVE-GLOBAL>": "título",
 * "<CLAVE-GLOBAL>": "título genérico" }. status-celula-compartido.js lo sube a jira/cortos.
 * --json      la misma lista en JSON.
 * --validar   revisa datos.jira.cortos contra la guía y sale con 1 si algo falla (faltantes, largo, sin tipo de
 *             trabajo, igual al macro, claves de Jira o siglas sueltas). No consulta nada ni escribe archivos.
 */
const fs = require('fs');

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const rutaDatos = arg('--datos'), rutaInv = arg('--inventario');
if (!rutaDatos || !rutaInv) { console.error('Uso: --datos <datos.json> --inventario <inventario.json> [--hoy AAAA-MM-DD] [--json | --validar]'); process.exit(2); }
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
  const x = grupos[id] = grupos[id] || { carril: it.lane, global: g, nombre_global: (nodo[g] || {}).t || it.titulo || g,
    tipo_global: (nodo[g] || {}).it || '', titulo: cortos[id] || '', generico: cortos[g] || '', tareas: [] };
  const pa = (nodo[it.key] || {}).pa;
  x.tareas.push({ clave: it.key, titulo: it.titulo || '', tipo: (nodo[it.key] || {}).it || '', historia: pa && pa !== g ? (nodo[pa] || {}).t || '' : '', vencida: !!vencida });
}
const lista = Object.values(grupos).sort((a, b) => a.carril.localeCompare(b.carril) || b.tareas.length - a.tareas.length);
// pista: hoy solo tiene el propio macro / seguimiento → suele ser reunión o seguimiento
lista.forEach((x) => { x.pista = x.tareas.every((t) => t.clave === x.global) && /macro|seguimiento/i.test(x.tipo_global) ? 'solo el macro: ¿reunión o seguimiento?' : ''; });

if (process.argv.includes('--json')) { console.log(JSON.stringify(lista, null, 2)); process.exit(0); }

if (process.argv.includes('--validar')) {
  const TIPOS = /^(desarrollo|dashboard|integraci[oó]n|pantalla|api|m[oó]dulo|correcci[oó]n|correcciones|ajuste|ajustes|error|revisi[oó]n|pruebas?|regresi[oó]n|certificaci[oó]n|carga|parametrizaci[oó]n|migraci[oó]n|definir|definici[oó]n|plan|documentar|documentaci[oó]n|reuni[oó]n|seguimiento|escalas|hc|historia|lista|entorno|empalme|consentimiento|monitoreo|soporte|implementaci[oó]n|publicaci[oó]n|despliegue|levantamiento|an[aá]lisis|dise[ñn]o|refactor|whatsapp|telemedicina|facturaci[oó]n|exento|variables|plantillas|trazabilidad|copago|depuraci[oó]n|cobro|incidencias|[oó]rdenes|ordenamiento|pago|signos|atenci[oó]n|integraciones|pendientes|nota|impresi[oó]n|errores)\b/i;
  const errores = [], avisos = [];
  for (const x of lista) {
    const id = x.carril + '|' + x.global, t = x.titulo || x.generico;
    if (!t) { errores.push(`${id}: sin título (ni por persona ni genérico)`); continue; }
    const pal = t.trim().split(/\s+/).length;
    if (pal < 3 || pal > 7) errores.push(`${id}: «${t}» tiene ${pal} palabras (3 a 7)`);
    if (/\b[A-Z][A-Z0-9]+-\d+\b|GLPI|\bS\d{2}\b|feature\//.test(t)) errores.push(`${id}: «${t}» lleva una clave, GLPI o jerga interna`);
    if (t.trim().toLowerCase() === String(x.nombre_global).trim().toLowerCase()) errores.push(`${id}: «${t}» es el nombre del macro, no lo que hace hoy`);
    if (!TIPOS.test(t.trim())) avisos.push(`${id}: «${t}» no empieza por un tipo de trabajo de la guía; revísalo`);
    if (x.pista && !/^(reuni[oó]n|seguimiento)/i.test(t.trim())) avisos.push(`${id}: hoy solo tiene el macro (${x.global}); si es una reunión o un seguimiento, dilo en el título`);
    if (!x.titulo && x.tareas.length > 1) avisos.push(`${id}: usa el genérico «${t}»; si hoy hace algo más puntual, escribe el suyo`);
  }
  avisos.forEach((a) => console.log('⚠ ' + a));
  errores.forEach((e) => console.log('✗ ' + e));
  console.log(errores.length ? `\n${errores.length} error(es): corrige datos.jira.cortos y vuelve a validar.` : `\nOK · ${lista.length} grupos con título${avisos.length ? ` · ${avisos.length} aviso(s) para revisar` : ''}.`);
  process.exit(errores.length ? 1 : 0);
}

console.log(`Qué hace hoy (${hoy}) cada persona, por global. Guía: references/titulos-hoy.md.`);
console.log('Escribe en datos.jira.cortos["<carril>|<global>"] un título «tipo de trabajo + sobre qué» (3 a 6 palabras) y valida con --validar.');
for (const x of lista) {
  console.log(`\n${x.carril}|${x.global} [${x.tipo_global || '¿tipo?'}] · ${x.nombre_global}${x.titulo ? `  → «${x.titulo}»` : (x.generico ? `  → genérico «${x.generico}»` : '')} · ${x.tareas.length} tarea(s)${x.pista ? '  ⚑ ' + x.pista : ''}`);
  const hist = {}; x.tareas.forEach((t) => { if (t.historia) hist[t.historia] = (hist[t.historia] || 0) + 1; });
  Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([h, n]) => console.log(`   historia: ${h.slice(0, 90)} (${n})`));
  x.tareas.slice(0, 6).forEach((t) => console.log(`   - ${t.clave} [${t.tipo || '?'}] ${t.titulo.slice(0, 95)}${t.vencida ? ' (vencida)' : ''}`));
  if (x.tareas.length > 6) console.log(`   … y ${x.tareas.length - 6} más`);
}
