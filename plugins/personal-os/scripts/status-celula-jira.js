#!/usr/bin/env node
'use strict';
/*
 * Personal OS — status de la célula: normaliza los volcados del conector de Atlassian al bloque `jira`
 * del JSON de datos. No consulta nada por red: solo normaliza, así el tablero se regenera sin conexión.
 *
 *   node status-celula-jira.js --corte AAAA-MM-DD --roster <roster.json> --salida <jira.json>
 *        --celula <volcados…> [--proyectos <volcados…>] [--delta <volcados…>] [--changelog <carpeta|archivos…>]
 *        [--campo-inicio customfield_XXXXX]
 *
 *   --celula      issues del equipo y del líder (con comentarios y tiempos): el detalle navegable.
 *   --proyectos   TODO lo abierto de tus proyectos, tenga o no responsable: la tabla por proyecto.
 *                 Una issue que esté en los dos se queda con la versión de --celula (la más rica).
 *   --delta       lecturas posteriores (`updated >= "<hora de la última lectura>"`), EN ORDEN: cada una
 *                 se aplica encima de lo anterior. Nunca mezclar dos lecturas completas de horas distintas:
 *                 la misma issue sale abierta y cerrada a la vez.
 *   --changelog   salidas de getJiraIssue con expand=changelog (el historial solo llega issue por issue).
 *   --roster      JSON con `celula` [{jira, nombre, rol?}], `externos` [{jira, nombre}], `proyectos`
 *                 [{clave, nombre}] y `frentes` opcional. Acepta también `proyectos_cliente` (formato anterior).
 *                 El `jira` de cada persona es el displayName EXACTO: una tilde de diferencia la saca de su célula.
 *
 * Un volcado es la respuesta del conector: {"issues": {"nodes": [...]}}, {"issues": [...]}, una lista o una issue.
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

function listaArg(nombre) {
  const a = process.argv.slice(2), out = [];
  const i = a.indexOf(nombre); if (i < 0) return out;
  for (let k = i + 1; k < a.length && !a[k].startsWith('--'); k++) out.push(a[k]);
  return out;
}
function expandir(rutas) {
  const out = [];
  for (const r of rutas) {
    try {
      const st = fs.statSync(r);
      if (st.isDirectory()) fs.readdirSync(r).sort().forEach((f) => out.push(path.join(r, f)));
      else out.push(r);
    } catch (e) { console.error('  no existe: ' + r); }
  }
  return out;
}
function cargar(ruta) {
  const d = C.leerJson(ruta, null);
  if (!d) { console.error('  no es JSON: ' + ruta); return []; }
  if (Array.isArray(d)) return d;
  if (d.issues) return Array.isArray(d.issues) ? d.issues : (d.issues.nodes || []);
  if (d.fields) return [d];
  return [];
}
const horas = (v) => (typeof v === 'number' ? Math.round(v / 36) / 100 : null);   // Jira guarda segundos; null = no se sabe
function texto(body) {
  if (typeof body === 'string') return body.trim();
  const trozos = [];
  const rec = (n) => { if (Array.isArray(n)) n.forEach(rec); else if (n && typeof n === 'object') { if (n.type === 'text') trozos.push(n.text || ''); rec(n.content || []); } };
  rec(body);
  return trozos.join(' ').replace(/\s+/g, ' ').trim();
}
function normalizar(it, campoInicio) {
  const f = it.fields || {}, st = f.status || {};
  const comentarios = (((f.comment || {}).comments) || []).map((c) => ({ autor: (c.author || {}).displayName || '?', fecha: String(c.created || '').slice(0, 16).replace('T', ' '), texto: texto(c.body) }));
  const historial = [];
  for (const h of ((it.changelog || {}).histories) || []) {
    for (const x of h.items || []) historial.push({ fecha: String(h.created || '').slice(0, 16).replace('T', ' '), autor: (h.author || {}).displayName || '?', campo: x.field || '', de: x.fromString, a: x.toString });
  }
  historial.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    clave: it.key, titulo: f.summary || '', proyecto: (f.project || {}).key || String(it.key || '').split('-')[0], proyecto_nombre: (f.project || {}).name || '',
    tipo: (f.issuetype || {}).name || '', persona: (f.assignee || {}).displayName || null, estado: st.name || '?',
    categoria: ((st.statusCategory || {}).key) || '', prioridad: (f.priority || {}).name || null, padre: (f.parent || {}).key || null,
    inicio: campoInicio ? f[campoInicio] || null : null, fin: f.duedate || null, creado: String(f.created || '').slice(0, 10) || null,
    actualizado: String(f.updated || '').slice(0, 10) || null, actualizado_ts: f.updated || null,
    estimado: horas(f.timeoriginalestimate), trabajado: horas(f.timespent), url: it.webUrl || '', comentarios, historial,
  };
}

function main() {
  const salida = C.arg('--salida', null), rosterRuta = C.arg('--roster', null);
  if (!salida || !rosterRuta) { console.error('Uso: node status-celula-jira.js --corte AAAA-MM-DD --roster <roster.json> --salida <jira.json> --celula <volcados…> [--proyectos …] [--delta …] [--changelog …] [--campo-inicio customfield_X]'); process.exit(1); }
  const roster = C.leerJson(rosterRuta, null);
  if (!roster) { console.error('No pude leer el roster: ' + rosterRuta); process.exit(1); }
  const campo = C.arg('--campo-inicio', null);
  const issues = new Map();
  const poner = (n, ambito) => { if (n.clave) issues.set(n.clave, Object.assign(issues.get(n.clave) && ambito === 'delta' ? issues.get(n.clave) : {}, n)); };
  for (const r of expandir(listaArg('--proyectos'))) cargar(r).forEach((it) => poner(normalizar(it, campo), 'base'));
  for (const r of expandir(listaArg('--celula'))) cargar(r).forEach((it) => poner(normalizar(it, campo), 'celula'));
  let nDelta = 0;
  for (const r of expandir(listaArg('--delta'))) cargar(r).forEach((it) => { const n = normalizar(it, campo); const prev = issues.get(n.clave);
    // Un delta trae el estado nuevo; si viene sin comentarios conserva los que ya había.
    if (prev && !n.comentarios.length) n.comentarios = prev.comentarios; if (prev && !n.historial.length) n.historial = prev.historial;
    // Lo que el delta no pidió (campo de inicio, tipo, url…) llega vacío: no borra lo que ya se sabía.
    if (prev) ['inicio', 'creado', 'url', 'proyecto_nombre', 'tipo', 'prioridad', 'padre'].forEach((k) => { if ((n[k] == null || n[k] === '') && prev[k]) n[k] = prev[k]; });
    poner(n, 'delta'); nDelta++; });
  let nHist = 0;
  for (const r of expandir(listaArg('--changelog'))) cargar(r).forEach((it) => { const x = issues.get(it.key); if (x && it.changelog) { x.historial = normalizar(it, campo).historial; nHist++; } });

  const celula = (roster.celula || []).map((p) => p.jira), externos = (roster.externos || []).map((p) => p.jira);
  const alias = {};
  (roster.celula || []).concat(roster.externos || []).forEach((p) => { alias[p.jira] = p.nombre || p.jira; });
  for (const v of issues.values()) {
    v.ambito = !v.persona ? 'huerfano' : celula.includes(v.persona) ? 'celula' : externos.includes(v.persona) ? 'externo' : 'otro';
    delete v.actualizado_ts;
  }
  const corte = C.arg('--corte', null) || C.hoyISO();
  const mov = new Date(Date.parse(corte + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0, 10);
  const bloque = { corte, corte_movimiento: mov, proyectos: roster.proyectos || roster.proyectos_cliente || [], externos: roster.externos || [],
    frentes: roster.frentes || [], alias, issues: [...issues.values()].sort((a, b) => a.proyecto.localeCompare(b.proyecto) || a.clave.localeCompare(b.clave, 'es', { numeric: true })),
    con_historial: nHist };
  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  fs.writeFileSync(path.resolve(salida), JSON.stringify(bloque, null, 1), 'utf8');
  const n = bloque.issues.length, cel = bloque.issues.filter((i) => i.ambito === 'celula').length, hue = bloque.issues.filter((i) => i.ambito === 'huerfano').length;
  console.log(`Bloque jira -> ${path.resolve(salida)}\n  ${n} issues · ${cel} de la célula · ${hue} sin responsable · ${nHist} con historial · ${nDelta} actualizadas por delta`);
  const nombres = new Set(bloque.issues.map((i) => i.persona).filter(Boolean));
  celula.filter((j) => !nombres.has(j)).forEach((j) => console.log(`  AVISO: «${j}» no aparece en ninguna issue leída. Si no es el displayName exacto, su trabajo desaparece sin avisar.`));
}

if (require.main === module) main();
