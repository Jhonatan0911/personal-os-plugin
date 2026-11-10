#!/usr/bin/env node
'use strict';
/*
 * Personal OS — status de la célula: prepara la carga del TABLERO COMPARTIDO (un Artifact con base de datos
 * compartida) desde el mismo JSON de datos del tablero local. No sube nada: deja un archivo por documento y
 * un `writes.json` para UNA sola llamada `ArtifactData` `batch` que hace la skill.
 *
 *   node status-celula-compartido.js <datos.json> --salida <carpeta> [--corte-texto "dd/mm/aaaa hh:mm"]
 *        [--jira-at <ISO de la lectura de Jira>] [--meta-actual <jira-meta.json>] [--versiones <versiones.json>]
 *        [--excluir CLAVE-1,CLAVE-2] [--personas-extra "Nombre en Jira 1,Nombre 2"]
 *
 * Documentos (colección/id):
 *   estado/bloqueos    cliente, equipo, recursos, requerimientos, frentes_status, resuelto
 *   estado/timesheets  métricas ya calculadas por el motor (no se recalculan en la página)
 *   estado/frentes     titulares/backups y el roster (nombre, rol, préstamo)
 *   privado/lider      la pestaña del líder (la regla de la base debe ser read/write: owner)
 *   jira/cNN + jira/meta  foto de Jira en trozos de 350 issues
 *
 * Reglas que el script hace cumplir:
 *   · La foto de Jira SOLO se sube si es más reciente que la que ya tiene el tablero (`--meta-actual`, el
 *     documento jira/meta leído antes): si alguien pulsó «Actualizar todo» después, la foto en vivo gana. Si se
 *     sube, se borran los trozos sobrantes de la foto anterior.
 *   · `--versiones` ({"estado/bloqueos": 7, …}) añade `if_version` a cada escritura: un documento que otra
 *     persona cambió después de leerlo no se pisa.
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');
const Legado = require('./lib/status-celula-legado.js');
const { construir } = require('./status-celula.js');

function main() {
  const conValor = new Set(['--salida', '--corte-texto', '--jira-at', '--meta-actual', '--versiones', '--excluir', '--personas-extra', '--estado', '--hoy']);
  const a = process.argv.slice(2);
  let entrada = null;
  for (let i = 0; i < a.length; i++) { if (conValor.has(a[i])) { i++; continue; } if (!a[i].startsWith('--')) { entrada = a[i]; break; } }
  const salida = C.arg('--salida', null);
  if (!entrada || !salida) { console.error('Uso: node status-celula-compartido.js <datos.json> --salida <carpeta> [--corte-texto "…"] [--jira-at ISO] [--meta-actual archivo] [--versiones archivo] [--excluir A-1,B-2]'); process.exit(1); }
  let datos = C.leerJson(path.resolve(entrada), null);
  if (!datos) { console.error('No pude leer el JSON: ' + entrada); process.exit(1); }
  if (Legado.esLegado(datos)) datos = Legado.convertir(datos);
  const d = construir(datos);
  const corteTxt = C.arg('--corte-texto', null) || d.corte;
  const fuera = new Set(String(C.arg('--excluir', '') || '').split(',').map((s) => s.trim()).filter(Boolean));
  const versiones = C.leerJson(C.arg('--versiones', '') || '', {}) || {};
  const metaActual = C.leerJson(C.arg('--meta-actual', '') || '', null);

  const docs = new Map();
  docs.set('estado/bloqueos', { corte: corteTxt, cliente: d.bloqueos_cliente || [], equipo: d.bloqueos_equipo || [], recursos: d.recursos || [],
    requerimientos: d.requerimientos || [], frentes_status: d.frentes_status || [], resuelto: d.resuelto || [] });
  if (d.timesheets && d.timesheets.metricas) {
    docs.set('estado/timesheets', { corte: corteTxt, desde: d.timesheets.desde, hasta: d.timesheets.hasta, metricas: d.timesheets.metricas });
  }
  const nom = (slug) => ((d.personas.find((p) => p.slug === slug) || {}).nombre) || null;
  const frentes = (d.acuerdo_frentes && d.acuerdo_frentes.length ? d.acuerdo_frentes : (d.frentes || []).filter((f) => f.titular !== undefined))
    .map((f) => ({ frente: f.nombre, cliente: f.cliente || '', titular: nom(f.titular) || f.titular_txt || null, backup: nom(f.backup) || f.backup_txt || null }));
  docs.set('estado/frentes', { corte: corteTxt, frentes, roster: d.personas.map((p) => ({ nombre: p.nombre, rol: p.rol || (p.lider ? 'Líder' : ''), prestamo: p.prestamo || '' })) });
  if (d.lider) docs.set('privado/lider', Object.assign({}, d.lider, { corte: corteTxt }));

  // Foto de Jira: tus proyectos + todo lo de la célula (en el proyecto que sea) + lo que solo vive en los items.
  const jiraAt = C.arg('--jira-at', null) || `${d.corte}T12:00:00.000Z`;
  const subirJira = !(metaActual && metaActual.at && metaActual.at >= jiraAt);
  const borrar = [];
  if (subirJira && d.jira) {
    const claves = new Set((d.jira.proyectos || []).map((p) => p.clave));
    // --personas-extra: displayNames de fuera de la célula cuyas issues también ve el tablero (p. ej. analistas).
    const celula = new Set(d.personas.filter((p) => p.jira).map((p) => C.sinTildes(p.jira))
      .concat(String(C.arg('--personas-extra', '') || '').split(',').map((s) => C.sinTildes(s)).filter(Boolean)));
    const iss = [];
    for (const i of d.jira.issues || []) {
      const k = i.clave || i.key;
      if (!k || fuera.has(k)) continue;
      if (claves.has(i.proyecto) || celula.has(C.sinTildes(i.persona || ''))) {
        iss.push({ k, t: i.titulo || '', p: i.persona || '', e: i.estado || '', c: i.categoria || '', f: i.fin || null, i: i.inicio || null,
          s: i.estimado == null ? null : i.estimado, u: i.actualizado || null, cr: i.creado || null, pr: i.proyecto || k.split('-')[0] });
      }
    }
    const vistos = new Set(iss.map((x) => x.k));
    const jiraDe = (slug) => ((d.personas.find((p) => p.slug === slug) || {}).jira) || '';
    for (const it of d.items) {
      const k = it.id || '';
      if (vistos.has(k) || fuera.has(k) || !/^[A-Z][A-Z0-9]*-\d+$/.test(k)) continue;
      if (it.tipo === 'implementacion' || it.cerrada || it.tipo === 'redefinido') {
        iss.push({ k, t: it.titulo || '', p: jiraDe(it.persona), e: it.estado || (it.cerrada ? 'Cerrada' : ''), c: 'done', f: it.cerrada ? it.fin : null, i: null,
          s: +it.horas || null, u: it.recortada || it.fin || null, cr: null, pr: k.split('-')[0] });
        vistos.add(k);
      }
    }
    const trozos = [];
    for (let n = 0; n < iss.length; n += 350) trozos.push(iss.slice(n, n + 350));
    trozos.forEach((c, n) => docs.set(`jira/c${String(n).padStart(2, '0')}`, { issues: c }));
    const ids = trozos.map((_, n) => `c${String(n).padStart(2, '0')}`);
    docs.set('jira/meta', { at: jiraAt, por: '', n: iss.length, chunks: ids, parcial: false, nota: `Foto del status de la célula (${corteTxt}); se reemplaza al pulsar «Actualizar todo».` });
    for (const viejo of (metaActual && metaActual.chunks) || []) if (!ids.includes(viejo)) borrar.push(viejo);
  }

  const dir = path.resolve(salida);
  fs.mkdirSync(dir, { recursive: true });
  const writes = [];
  for (const [clave, cuerpo] of docs) {
    const [col, id] = clave.split('/');
    const ruta = path.join(dir, `${col}-${id}.json`);
    fs.writeFileSync(ruta, JSON.stringify(cuerpo), 'utf8');
    const w = { op: 'set', collection: col, doc_id: id, file_path: ruta };
    if (versiones[clave] != null) w.if_version = versiones[clave];
    writes.push(w);
    console.log(`  ${clave}  ${fs.statSync(ruta).size} bytes${w.if_version != null ? '  if_version ' + w.if_version : ''}`);
  }
  borrar.forEach((id) => writes.push({ op: 'delete', collection: 'jira', doc_id: id }));
  fs.writeFileSync(path.join(dir, 'writes.json'), JSON.stringify(writes, null, 1), 'utf8');
  console.log(subirJira ? `Foto de Jira incluida (${(docs.get('jira/meta') || {}).n || 0} issues${borrar.length ? `; se borran ${borrar.join(', ')}` : ''}).`
    : `Foto de Jira OMITIDA: la del tablero (${metaActual.at}) es igual o más reciente que esta (${jiraAt}).`);
  console.log(`writes.json: ${path.join(dir, 'writes.json')} · ${writes.length} escrituras para UNA llamada ArtifactData batch.`);
}

if (require.main === module) main();
