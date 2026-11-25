#!/usr/bin/env node
/**
 * Pruebas de control de os-servidor.js (CO-030): levanta una instancia en un puerto de prueba y la ataca
 * como lo haría una página ajena (Host, Origin, token, acciones fuera de la lista, traversal). Cada caso
 * dice qué código espera; ninguno escribe en el estado. Correr antes de cada versión del plugin:
 *   node scripts/pruebas/os-servidor.prueba.js [--puerto 7399]
 * Sale con código 1 si algún control falla.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const i = process.argv.indexOf('--puerto');
const P = i > -1 ? Number(process.argv[i + 1]) : 7399;
const SRV = path.join(__dirname, '..', 'os-servidor.js');
const OS_HOME = process.env.PERSONAL_OS_HOME || path.join(os.homedir(), '.claude', 'personal-os');

function pedir({ metodo = 'GET', ruta = '/', host = `127.0.0.1:${P}`, cab = {}, cuerpo = null }) {
  return new Promise((ok) => {
    const req = http.request({ host: '127.0.0.1', port: P, method: metodo, path: ruta, headers: Object.assign({ Host: host }, cab) }, (res) => {
      let d = ''; res.on('data', (x) => { d += x; }); res.on('end', () => ok({ codigo: res.statusCode, d }));
    });
    req.on('error', (e) => ok({ codigo: 0, d: e.message }));
    if (cuerpo !== null) req.write(cuerpo);
    req.end();
  });
}

// fuentes.yaml de prueba: copia temporal (de --fuentes <ruta> si se da, o una sintética). Nunca el real.
const jF = process.argv.indexOf('--fuentes');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'os-srv-prueba-'));
const FUENTES = path.join(TMP, 'fuentes.yaml');
const SINTETICA = [
  'proyectos: []',
  'paso_produccion:',
  '  normativa: "N-0 · ejemplo"   # comentario',
  '  carpeta: null',
  '  entregables:',
  '    # un comentario dentro de la lista',
  '    - { id: funcional, nombre: "Especificación funcional: con dos puntos", archivos: ["funcional.*"], responsable: "líder" }',
  '    - { id: comunicado, nombre: "Comunicado de una página", archivos: ["comunicado.*"] }',
  '    - { id: video, nombre: "Video tutorial", archivos: ["video*.mp4"], con: comunicado }',
  '    - id: manual',
  '      nombre: "Manual de usuario"',
  '      archivos: ["manual.*"]',
  '  aprobaciones:',
  '    - { id: cliente, nombre: "Aprobación del cliente" }',
  'otra_seccion:',
  '  omitir: ["no-es-de-paso"]',
  '',
].join('\r\n');
fs.writeFileSync(FUENTES, jF > -1 ? fs.readFileSync(process.argv[jF + 1]) : '﻿' + SINTETICA);
const ORIGINAL = fs.readFileSync(FUENTES);
/** El archivo sin las líneas `omitir:` del bloque paso_produccion (la única que el servidor puede tocar). */
function sinOmitir(buf) {
  const t = buf.toString('utf8'), eol = t.includes('\r\n') ? '\r\n' : '\n';
  let dentro = false;
  return t.split(eol).filter((l) => {
    if (/^paso_produccion:/.test(l)) dentro = true; else if (/^\S/.test(l)) dentro = false;
    return !(dentro && /^\s+omitir:\s*\[/.test(l));
  }).join(eol);
}

(async () => {
  const srv = spawn(process.execPath, [SRV, '--puerto', String(P), '--fuentes', FUENTES], { stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));
  await new Promise((r) => setTimeout(r, 900));
  const pag = await pedir({ ruta: '/estado/consola.html' });
  const token = (pag.d.match(/OS_TOKEN\s*=\s*"([0-9a-f]+)"/) || [])[1];
  const O = `http://127.0.0.1:${P}`;
  const J = { 'Content-Type': 'application/json' };
  const T = (extra) => Object.assign({ Origin: O, 'X-OS-Token': token }, J, extra || {});
  const casos = [
    ['salud con Host propio', 200, { ruta: '/salud' }],
    ['salud con Host ajeno (DNS rebinding)', 403, { ruta: '/salud', host: 'evil.example:' + P }],
    ['la raíz lleva a la consola', 302, { ruta: '/' }],
    ['la consola trae el token y el módulo', 'token', null],
    ['el módulo de la app', 200, { ruta: '/plantillas/consola-app.js' }],
    ['estado', 200, { ruta: '/api/estado' }],
    ['indicadores', 200, { ruta: '/api/indicadores' }],
    ['traversal con ..', [403, 404], { ruta: '/estado/../../.claude/personal-os/config.json' }],
    ['traversal codificado', [403, 404], { ruta: '/estado/%2e%2e/%2e%2e/x.json' }],
    ['extensión no permitida', 403, { ruta: '/estado/algo.yaml' }],
    ['traversal por /_vendor', [403, 404], { ruta: '/_vendor/%2e%2e/%2e%2e/.claude/personal-os/config.json' }],
    ['módulo de identidad compartido', 200, { ruta: '/plantillas/identidad-agente.js' }],
    ['POST sin Origin', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: Object.assign({ 'X-OS-Token': token }, J), cuerpo: '{}' }],
    ['POST con Origin ajeno', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ Origin: 'https://evil.example' }), cuerpo: '{}' }],
    ['POST sin token', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: Object.assign({ Origin: O }, J), cuerpo: '{}' }],
    ['POST con token falso', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ 'X-OS-Token': 'a'.repeat(48) }), cuerpo: '{}' }],
    ['POST como formulario (no JSON)', 415, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ 'Content-Type': 'text/plain' }), cuerpo: '{}' }],
    ['acción fuera de la lista', 404, { metodo: 'POST', ruta: '/api/accion/rm-rf', cab: T(), cuerpo: '{}' }],
    ['acción válida con destino inexistente (sin efecto)', 500, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T(), cuerpo: '{"destino":"nada"}' }],
    ['exigencia con nivel inexistente (sin efecto)', 500, { metodo: 'POST', ruta: '/api/accion/exigencia', cab: T(), cuerpo: '{"nivel":"relajado"}' }],
    ['GET a una acción', 404, { ruta: '/api/accion/abrir' }],
    ['PUT', 405, { metodo: 'PUT', ruta: '/api/accion/abrir' }],
  ];
  let fallos = 0;
  for (const [nombre, espera, req] of casos) {
    let ok, obtenido;
    if (espera === 'token') { ok = !!token && token.length === 48 && pag.d.includes('/plantillas/consola-app.js'); obtenido = ok ? 'sí' : 'no'; }
    else { const r = await pedir(req); obtenido = r.codigo; ok = Array.isArray(espera) ? espera.includes(r.codigo) : r.codigo === espera; }
    if (!ok) fallos++;
    console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}: esperado ${espera}, obtenido ${obtenido}`);
  }
  // ---- paso a producción: qué se genera (escribe SOLO en la copia temporal)
  const PP = '/api/config/paso-produccion';
  const leerPP = async () => JSON.parse((await pedir({ ruta: PP })).d);
  const postPP = (omitir, cab) => pedir({ metodo: 'POST', ruta: PP, cab: cab || T(), cuerpo: JSON.stringify({ omitir }) });
  const ver = (nombre, ok, detalle) => { if (!ok) fallos++; console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` (${detalle})` : ''}`); return ok; };
  let n = 0;
  const g0 = await leerPP(); n++;
  const ids = g0.entregables.map((e) => e.id);
  const hijo = g0.entregables.find((e) => e.con && ids.includes(e.con));
  const libre = g0.entregables.find((e) => !e.con && (!hijo || e.id !== hijo.con)) || g0.entregables[0];
  ver('pp: lee los entregables del bloque', g0.seccion && ids.length > 0 && !ids.includes('no-es-de-paso') && !ids.includes('cliente'), ids.join(','));
  n++; ver('pp: POST sin token', (await postPP([libre.id], Object.assign({ Origin: O }, J))).codigo === 403);
  n++; ver('pp: POST con Origin ajeno', (await postPP([libre.id], T({ Origin: 'https://evil.example' }))).codigo === 403);
  n++; ver('pp: id desconocido rechazado', (await postPP(['rm-rf'])).codigo === 400 && fs.readFileSync(FUENTES).equals(ORIGINAL));
  n++; ver('pp: omitir que no es lista', (await postPP('x')).codigo === 400 && fs.readFileSync(FUENTES).equals(ORIGINAL));
  n++; ver('pp: id de otra sección no cuenta', (await postPP(['no-es-de-paso'])).codigo === 400);
  n++; const r1 = await postPP([libre.id, libre.id]);
  ver('pp: crear omitir', r1.codigo === 200 && JSON.parse(r1.d).omitir.join() === libre.id);
  n++; ver('pp: el resto del archivo intacto byte a byte', sinOmitir(fs.readFileSync(FUENTES)) === sinOmitir(ORIGINAL));
  n++; ver('pp: respaldo .antes-omitir igual al original', fs.existsSync(FUENTES + '.antes-omitir') && fs.readFileSync(FUENTES + '.antes-omitir').equals(ORIGINAL));
  n++; ver('pp: GET refleja lo omitido', (await leerPP()).entregables.find((e) => e.id === libre.id).omitido === true);
  if (hijo) {
    n++; await postPP([hijo.con]);
    const e = (await leerPP()).entregables.find((x) => x.id === hijo.id);
    ver(`pp: «${hijo.id}» se omite con su padre «${hijo.con}»`, e.omitido === false && e.efectivo_omitido === true);
  }
  n++; const r2 = await postPP([]);
  ver('pp: quitar (se genera todo)', r2.codigo === 200 && (await leerPP()).entregables.every((e) => !e.omitido));
  n++; ver('pp: tras quitar, el resto sigue intacto', sinOmitir(fs.readFileSync(FUENTES)) === sinOmitir(ORIGINAL));
  n++; const bom = ORIGINAL.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const ahora = fs.readFileSync(FUENTES);
  ver('pp: conserva BOM y fin de línea', ahora.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) === bom
    && ahora.toString('utf8').includes('\r\n') === ORIGINAL.toString('utf8').includes('\r\n'));

  srv.kill();
  try { fs.unlinkSync(path.join(OS_HOME, `_servidor-${P}.json`)); } catch (_) { /* ya no estaba */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* temporal */ }
  console.log(fallos ? `\n${fallos} FALLO(S)` : `\nLos ${casos.length + n} controles pasan.`);
  process.exit(fallos ? 1 : 0);
})();
